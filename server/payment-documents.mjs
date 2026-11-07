const MAX_BYTES = 5 * 1024 * 1024;
const metadataColumns = "id, user_id, kind, file_name, mime_type, byte_size, created_at";

export async function initPaymentDocuments(pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS payment_documents (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    kind ENUM('invoice','receipt') NOT NULL,
    file_name VARCHAR(190) NOT NULL,
    mime_type VARCHAR(50) NOT NULL,
    byte_size INT UNSIGNED NOT NULL,
    file_data MEDIUMBLOB NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_payment_student (user_id, kind, created_at),
    CONSTRAINT fk_payment_student FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

function json(response, status, value) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(value));
}

function readUpload(request) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let chunks = [];
    let exceeded = false;
    request.on("data", (chunk) => {
      if (exceeded) return;
      size += chunk.length;
      if (size > MAX_BYTES) {
        exceeded = true;
        chunks = [];
        reject(Object.assign(new Error("Максимальный размер файла — 5 МБ"), { status: 413 }));
      } else chunks.push(chunk);
    });
    request.on("end", () => { if (!exceeded) resolve(Buffer.concat(chunks)); });
    request.on("error", reject);
    request.on("aborted", () => reject(new Error("Upload aborted")));
  });
}

function fileType(data) {
  if (data.subarray(0, 5).toString("ascii") === "%PDF-") return "application/pdf";
  if (data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (data.length >= 3 && data[0] === 255 && data[1] === 216 && data[2] === 255) return "image/jpeg";
  return null;
}

export async function handlePaymentDocuments(request, response, url, user, pool) {
  return handleStudentDocuments(request, response, url, user, pool, {
    root: "/api/payment-documents", table: "payment_documents", studentKinds: ["receipt"], adminKinds: ["invoice"],
  });
}

// Configuration is supplied only by server modules, never by request parameters.
export async function handleStudentDocuments(request, response, url, user, pool, { root, table, studentKinds, adminKinds }) {
  if (url.pathname !== root && !url.pathname.startsWith(root + "/")) return false;
  const error = (status, message) => { json(response, status, { error: message }); return true; };
  if (!["admin", "viewer", "student"].includes(user.role)) return error(403, "Недостаточно прав");

  if (url.pathname !== root) {
    if (request.method !== "GET") return error(405, "Метод не поддерживается");
    const id = url.pathname.slice(root.length + 1);
    if (!/^[1-9]\d*$/.test(id)) return error(404, "Документ не найден");
    const [rows] = await pool.execute(`SELECT ${metadataColumns}, file_data FROM ${table} WHERE id = ?${user.role === "student" ? " AND user_id = ?" : ""}`, user.role === "student" ? [id, user.id] : [id]);
    const doc = rows[0];
    if (!doc) return error(404, "Документ не найден");
    response.writeHead(200, {
      "Content-Type": doc.mime_type,
      "Content-Length": doc.byte_size,
      "Content-Disposition": `${url.searchParams.get("download") === "1" ? "attachment" : "inline"}; filename="payment-document"; filename*=UTF-8''${encodeURIComponent(doc.file_name)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox; default-src 'none'",
    });
    response.end(doc.file_data);
    return true;
  }

  const requestedId = url.searchParams.get("studentId");
  if (user.role === "student" && requestedId && Number(requestedId) !== user.id) return error(403, "Недостаточно прав");
  const studentId = user.role === "student" ? user.id : Number(requestedId);
  if (!Number.isSafeInteger(studentId) || studentId < 1) return error(400, "Не указан студент");
  const [students] = await pool.execute("SELECT id FROM users WHERE id = ? AND role = 'student'", [studentId]);
  if (!students.length) return error(404, "Студент не найден");

  if (request.method === "GET") {
    const [documents] = await pool.execute(`SELECT ${metadataColumns} FROM ${table} WHERE user_id = ? ORDER BY created_at DESC, id DESC`, [studentId]);
    json(response, 200, { documents });
    return true;
  }
  if (request.method !== "POST") return error(405, "Метод не поддерживается");
  const kind = url.searchParams.get("kind");
  if ((user.role === "student" && !studentKinds.includes(kind)) || (user.role === "admin" && !adminKinds.includes(kind)) || user.role === "viewer") return error(403, "Недостаточно прав");
  if (Number(request.headers["content-length"]) > MAX_BYTES) { request.resume(); return error(413, "Максимальный размер файла — 5 МБ"); }
  let name;
  try { name = decodeURIComponent(String(request.headers["x-file-name"] || "")).split(/[\\/]/).pop().replace(/[\x00-\x1f\x7f]/g, "").trim(); }
  catch { return error(400, "Некорректное имя файла"); }
  if (!name || name.length > 190) return error(400, "Некорректное имя файла");
  let data;
  try { data = await readUpload(request); }
  catch (err) { if (err.status) return error(err.status, err.message); throw err; }
  const mime = fileType(data);
  const extensions = { "application/pdf": /\.pdf$/i, "image/png": /\.png$/i, "image/jpeg": /\.jpe?g$/i };
  if (!mime || !extensions[mime].test(name)) return error(415, "Допустимы PDF, JPG и PNG");
  const [result] = await pool.execute(`INSERT INTO ${table} (user_id, kind, file_name, mime_type, byte_size, file_data) VALUES (?, ?, ?, ?, ?, ?)`, [studentId, kind, name, mime, data.length, data]);
  json(response, 201, { id: result.insertId });
  return true;
}
