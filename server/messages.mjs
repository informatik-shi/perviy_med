import { validEmail } from "./mail-notifications.mjs";

function json(response, status, data) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(data));
}

export async function handleMessages(request, response, url, user, pool, { readBody, mailer }) {
  if (!["/api/messages", "/api/conversations"].includes(url.pathname)) return false;
  const done = (status, data) => { json(response, status, data); return true; };
  if (url.pathname === "/api/conversations") {
    if (!["admin", "viewer"].includes(user.role)) return done(403, { error: "Недостаточно прав" });
    if (request.method !== "GET") return done(405, { error: "Метод не поддерживается" });
    const [conversations] = await pool.query(`SELECT u.id, u.full_name, u.student_id, MAX(m.created_at) AS last_message_at,
      SUM(CASE WHEN m.sender_id=u.id AND m.read_at IS NULL THEN 1 ELSE 0 END) AS unread_count
      FROM users u JOIN messages m ON m.sender_id=u.id OR m.recipient_id=u.id
      WHERE u.role='student' GROUP BY u.id ORDER BY last_message_at DESC, u.id DESC`);
    return done(200, { conversations });
  }
  const payload = request.method === "POST" ? await readBody(request) : null;
  const requestedId = url.searchParams.get("studentId") || payload?.studentId;
  if (user.role === "student" && requestedId && Number(requestedId) !== user.id) return done(403, { error: "Недостаточно прав" });
  const targetId = user.role === "student" ? user.id : Number(requestedId || 0);
  if (!Number.isSafeInteger(targetId) || targetId < 1) return done(400, { error: "Не указан студент" });
  const [students] = await pool.execute("SELECT u.id, u.email, p.data FROM users u LEFT JOIN profiles p ON p.user_id=u.id WHERE u.id=? AND u.role='student'", [targetId]);
  if (!students.length) return done(404, { error: "Студент не найден" });
  if (request.method === "GET") {
    if (user.role === "student") await pool.execute("UPDATE messages SET read_at=NOW() WHERE recipient_id=? AND read_at IS NULL", [targetId]);
    else if (user.role === "admin") await pool.execute("UPDATE messages SET read_at=NOW() WHERE sender_id=? AND read_at IS NULL", [targetId]);
    const [messages] = await pool.execute(`SELECT m.id, m.sender_id, m.recipient_id, m.body, m.read_at, m.created_at,
      su.role AS sender_role, su.full_name AS sender_name, n.status AS email_status
      FROM messages m JOIN users su ON su.id=m.sender_id LEFT JOIN message_email_notifications n ON n.message_id=m.id
      WHERE (m.sender_id=? AND m.recipient_id IN (SELECT id FROM users WHERE role='admin'))
      OR (m.recipient_id=? AND su.role='admin') ORDER BY m.created_at ASC, m.id ASC`, [targetId, targetId]);
    return done(200, { messages, ...(user.role === "student" ? {} : { emailConfigured: mailer.configured }) });
  }
  if (request.method !== "POST") return done(405, { error: "Метод не поддерживается" });
  if (!["student", "admin"].includes(user.role)) return done(403, { error: "Недостаточно прав" });
  const message = String(payload?.message || "").trim();
  if (!message || message.length > 10000) return done(400, { error: "Сообщение должно содержать от 1 до 10 000 символов" });
  const token = payload?.clientToken == null ? null : String(payload.clientToken);
  if (token !== null && !/^[a-z0-9-]{16,64}$/i.test(token)) return done(400, { error: "Некорректный идентификатор сообщения" });
  let recipientId = targetId;
  if (user.role === "student") {
    const [admins] = await pool.query("SELECT id FROM users WHERE role='admin' ORDER BY id LIMIT 1");
    recipientId = admins[0]?.id;
  }
  if (!recipientId) return done(400, { error: "Получатель не найден" });
  const profile = typeof students[0].data === "string" ? JSON.parse(students[0].data) : students[0].data;
  // Prefer the address explicitly entered in the student's questionnaire.
  const email = String(profile?.email ?? students[0].email ?? "").trim();
  const emailAvailable = validEmail(email);
  const connection = await pool.getConnection();
  let messageId;
  try {
    await connection.beginTransaction();
    if (token) {
      const [existing] = await connection.execute("SELECT id, body, recipient_id FROM messages WHERE sender_id=? AND client_token=?", [user.id, token]);
      if (existing.length) {
        await connection.rollback();
        return done(existing[0].body === message && Number(existing[0].recipient_id) === Number(recipientId) ? 200 : 409, { ok: true, id: existing[0].id, duplicate: true });
      }
    }
    const [result] = await connection.execute("INSERT INTO messages (sender_id, recipient_id, body, client_token) VALUES (?, ?, ?, ?)", [user.id, recipientId, message, token]);
    messageId = result.insertId;
    if (user.role === "admin" && emailAvailable) await connection.execute("INSERT INTO message_email_notifications (message_id,student_id,recipient) VALUES (?,?,?)", [messageId, targetId, email]);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    if (error.code === "ER_DUP_ENTRY" && token) {
      const [existing] = await pool.execute("SELECT id,body,recipient_id FROM messages WHERE sender_id=? AND client_token=?", [user.id, token]);
      if (existing.length && existing[0].body === message && Number(existing[0].recipient_id) === Number(recipientId)) return done(200, { ok: true, id: existing[0].id, duplicate: true });
    }
    throw error;
  } finally { connection.release(); }
  return done(201, { ok: true, id: messageId, notification: user.role !== "admin" ? "not_applicable" : !emailAvailable ? "missing_email" : mailer.configured ? "queued" : "not_configured" });
}
