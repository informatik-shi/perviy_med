import http from "node:http";
import { promisify } from "node:util";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import mysql from "mysql2/promise";

const scrypt = promisify(scryptCallback);
const port = Number(process.env.API_PORT || 4000);
const sessionTtlSeconds = 60 * 60 * 24 * 7;

const pool = mysql.createPool({
  host: process.env.DB_HOST || "mysql",
  port: Number(process.env.DB_PORT || 3306),
  database: process.env.DB_NAME || "spbgmu",
  user: process.env.DB_USER || "spbgmu_app",
  password: process.env.DB_PASSWORD,
  waitForConnections: true,
  connectionLimit: 10,
  charset: "utf8mb4",
});

async function hashPassword(value) {
  const salt = randomBytes(16);
  const derived = await scrypt(value, salt, 64);
  return `${salt.toString("hex")}:${Buffer.from(derived).toString("hex")}`;
}

async function verifyPassword(value, stored) {
  const [saltHex, hashHex] = String(stored).split(":");
  if (!saltHex || !hashHex) return false;
  const derived = await scrypt(value, Buffer.from(saltHex, "hex"), 64);
  const expected = Buffer.from(hashHex, "hex");
  return expected.length === derived.length && timingSafeEqual(expected, Buffer.from(derived));
}

async function initDatabase() {
  await pool.query(`CREATE TABLE IF NOT EXISTS users (id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT, login VARCHAR(190) NOT NULL UNIQUE, password_hash VARCHAR(255) NOT NULL, role ENUM('admin','student') NOT NULL, full_name VARCHAR(190) NOT NULL, country VARCHAR(120) NULL, student_id VARCHAR(80) NULL UNIQUE, track ENUM('onsite','distance') NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.query(`CREATE TABLE IF NOT EXISTS sessions (token CHAR(64) PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL, expires_at DATETIME NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX idx_sessions_user (user_id), CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.query(`CREATE TABLE IF NOT EXISTS progress (user_id BIGINT UNSIGNED NOT NULL, track ENUM('onsite','distance') NOT NULL, step_index TINYINT UNSIGNED NOT NULL, completed BOOLEAN NOT NULL DEFAULT FALSE, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, PRIMARY KEY (user_id, track, step_index), CONSTRAINT fk_progress_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  const [rows] = await pool.query("SELECT COUNT(*) AS count FROM users");
  if (Number(rows[0].count) === 0) {
    const login = process.env.ADMIN_LOGIN;
    const password = process.env.ADMIN_PASSWORD;
    if (!login || !password) throw new Error("ADMIN_LOGIN and ADMIN_PASSWORD must be configured before the first start");
    await pool.execute("INSERT INTO users (login, password_hash, role, full_name) VALUES (?, ?, 'admin', ?)", [login, await hashPassword(password), "Приёмная комиссия"]);
  }
}

function parseCookies(request) {
  return Object.fromEntries((request.headers.cookie || "").split(";").map((part) => part.trim()).filter(Boolean).map((part) => { const index = part.indexOf("="); return [part.slice(0, index), part.slice(index + 1)]; }));
}

function sendJson(response, status, body, headers = {}) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers });
  response.end(JSON.stringify(body));
}

async function body(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function currentUser(request) {
  const token = parseCookies(request).spbgmu_session;
  if (!token) return null;
  const [rows] = await pool.execute("SELECT u.id, u.login, u.role, u.full_name, u.country, u.student_id, u.track FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires_at > NOW()", [token]);
  const user = rows[0];
  return user ? { id: user.id, login: user.login, role: user.role, name: user.full_name, country: user.country, studentId: user.student_id, track: user.track } : null;
}

function authError(response, status = 401) { sendJson(response, status, { error: status === 403 ? "Недостаточно прав" : "Требуется вход" }); }

async function route(request, response) {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  try {
    if (request.method === "GET" && url.pathname === "/api/health") return sendJson(response, 200, { ok: true });
    if (request.method === "POST" && url.pathname === "/api/auth/login") {
      const payload = await body(request);
      const login = String(payload.login || "").trim();
      const password = String(payload.password || "");
      const [rows] = await pool.execute("SELECT id, login, password_hash, role, full_name, country, student_id, track FROM users WHERE login = ?", [login]);
      const candidate = rows[0];
      if (!candidate || !(await verifyPassword(password, candidate.password_hash))) return sendJson(response, 401, { error: "Неверный логин или пароль" });
      const token = randomBytes(32).toString("hex");
      await pool.execute("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))", [token, candidate.id]);
      const secure = process.env.COOKIE_SECURE === "true" ? "; Secure" : "";
      const cookie = `spbgmu_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${sessionTtlSeconds}${secure}`;
      return sendJson(response, 200, { user: { id: candidate.id, login: candidate.login, role: candidate.role, name: candidate.full_name, country: candidate.country, studentId: candidate.student_id, track: candidate.track } }, { "Set-Cookie": cookie });
    }
    if (request.method === "POST" && url.pathname === "/api/auth/logout") {
      const token = parseCookies(request).spbgmu_session;
      if (token) await pool.execute("DELETE FROM sessions WHERE token = ?", [token]);
      return sendJson(response, 200, { ok: true }, { "Set-Cookie": "spbgmu_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0" });
    }
    if (request.method === "GET" && url.pathname === "/api/auth/me") {
      const user = await currentUser(request);
      return user ? sendJson(response, 200, { user }) : authError(response);
    }

    const user = await currentUser(request);
    if (!user) return authError(response);
    if (request.method === "GET" && url.pathname === "/api/progress") {
      const track = url.searchParams.get("track") || user.track || "onsite";
      const [rows] = await pool.execute("SELECT step_index, completed FROM progress WHERE user_id = ? AND track = ? ORDER BY step_index", [user.id, track]);
      return sendJson(response, 200, { track, progress: rows });
    }
    if (request.method === "POST" && url.pathname === "/api/progress") {
      if (user.role !== "student") return authError(response, 403);
      const payload = await body(request);
      const track = payload.track === "distance" ? "distance" : "onsite";
      const stepIndex = Number(payload.stepIndex);
      const completed = payload.completed ? 1 : 0;
      if (!Number.isInteger(stepIndex) || stepIndex < 0 || stepIndex > 20) return sendJson(response, 400, { error: "Некорректный этап" });
      await pool.execute("INSERT INTO progress (user_id, track, step_index, completed) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE completed = VALUES(completed), updated_at = CURRENT_TIMESTAMP", [user.id, track, stepIndex, completed]);
      return sendJson(response, 200, { ok: true });
    }
    if (url.pathname === "/api/students") {
      if (user.role !== "admin") return authError(response, 403);
      const track = url.searchParams.get("track");
      if (request.method === "GET") {
        const [students] = await pool.execute("SELECT id, login, full_name, country, student_id, track, created_at FROM users WHERE role = 'student' AND (? IS NULL OR track = ?) ORDER BY created_at DESC", [track, track]);
        const result = [];
        for (const student of students) {
          const [progress] = await pool.execute("SELECT track, step_index, completed FROM progress WHERE user_id = ? ORDER BY track, step_index", [student.id]);
          result.push({ ...student, progress });
        }
        return sendJson(response, 200, { students: result });
      }
      if (request.method === "POST") {
        const payload = await body(request);
        const login = String(payload.login || "").trim();
        const password = String(payload.password || "");
        const name = String(payload.name || "").trim();
        const studentId = String(payload.studentId || "").trim();
        const country = String(payload.country || "").trim();
        const selectedTrack = payload.track === "distance" ? "distance" : "onsite";
        if (!login || !password || !name || !studentId || !country) return sendJson(response, 400, { error: "Заполните все поля" });
        const [result] = await pool.execute("INSERT INTO users (login, password_hash, role, full_name, country, student_id, track) VALUES (?, ?, 'student', ?, ?, ?, ?)", [login, await hashPassword(password), name, country, studentId, selectedTrack]);
        return sendJson(response, 201, { id: result.insertId, login, name, country, studentId, track: selectedTrack });
      }
    }
    sendJson(response, 404, { error: "Не найдено" });
  } catch (error) {
    console.error(error);
    sendJson(response, 500, { error: "Ошибка сервера" });
  }
}

await initDatabase();
http.createServer((request, response) => route(request, response)).listen(port, "0.0.0.0", () => console.log(`API listening on http://0.0.0.0:${port}`));
