import http from "node:http";
import { promisify } from "node:util";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import mysql from "mysql2/promise";
import { initPaymentDocuments, handlePaymentDocuments } from "./payment-documents.mjs";
import { initMigrationDocuments, handleMigrationDocuments } from "./migration-documents.mjs";
import { initServicesDocuments, handleServicesDocuments } from "./services-documents.mjs";
import { initMedicalDocuments, handleMedicalDocuments } from "./medical-documents.mjs";
import { createNotificationMailer, initMessageNotifications, startNotificationWorker, validEmail } from "./mail-notifications.mjs";
import { handleMessages } from "./messages.mjs";

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
const notificationMailer = createNotificationMailer();

async function hashPassword(value) {
  const salt = randomBytes(16);
  const derived = await scrypt(value, salt, 64);
  return `${salt.toString("hex")}:${Buffer.from(derived).toString("hex")}`;
}

async function verifyPassword(value, stored) {
  const [saltHex, hashHex] = String(stored || "").split(":");
  if (!saltHex || !hashHex) return false;
  const derived = await scrypt(value, Buffer.from(saltHex, "hex"), 64);
  const expected = Buffer.from(hashHex, "hex");
  return expected.length === derived.length && timingSafeEqual(expected, Buffer.from(derived));
}

async function ensureColumn(table, column, definition) {
  const [rows] = await pool.query(`SHOW COLUMNS FROM ${table} LIKE ?`, [column]);
  if (!rows.length) await pool.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

async function initDatabase() {
  await pool.query(`CREATE TABLE IF NOT EXISTS users (id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT, login VARCHAR(190) NOT NULL UNIQUE, password_hash VARCHAR(255) NOT NULL, role ENUM('admin','viewer','student') NOT NULL, full_name VARCHAR(190) NOT NULL, email VARCHAR(190) NULL, country VARCHAR(120) NULL, student_id VARCHAR(80) NULL UNIQUE, track ENUM('onsite','distance') NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  try { await pool.query("ALTER TABLE users MODIFY role ENUM('admin','viewer','student') NOT NULL"); } catch (error) { console.error("role migration", error.message); }
  await ensureColumn("users", "email", "VARCHAR(190) NULL");
  await pool.query(`CREATE TABLE IF NOT EXISTS sessions (token CHAR(64) PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL, expires_at DATETIME NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX idx_sessions_user (user_id), CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.query(`CREATE TABLE IF NOT EXISTS progress (user_id BIGINT UNSIGNED NOT NULL, track ENUM('onsite','distance') NOT NULL, step_index TINYINT UNSIGNED NOT NULL, completed BOOLEAN NOT NULL DEFAULT FALSE, admin_completed BOOLEAN NOT NULL DEFAULT FALSE, answer TEXT NULL, student_date DATE NULL, admin_date DATE NULL, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, PRIMARY KEY (user_id, track, step_index), CONSTRAINT fk_progress_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await ensureColumn("progress", "answer", "TEXT NULL");
  await ensureColumn("progress", "admin_completed", "BOOLEAN NOT NULL DEFAULT FALSE");
  await ensureColumn("progress", "student_date", "DATE NULL");
  await ensureColumn("progress", "admin_date", "DATE NULL");
  await pool.query(`CREATE TABLE IF NOT EXISTS profiles (user_id BIGINT UNSIGNED PRIMARY KEY, data JSON NOT NULL, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, CONSTRAINT fk_profiles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.query(`CREATE TABLE IF NOT EXISTS messages (id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT, sender_id BIGINT UNSIGNED NOT NULL, recipient_id BIGINT UNSIGNED NOT NULL, body TEXT NOT NULL, read_at DATETIME NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX idx_messages_pair (sender_id, recipient_id, created_at), CONSTRAINT fk_messages_sender FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE, CONSTRAINT fk_messages_recipient FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  const [rows] = await pool.query("SELECT COUNT(*) AS count FROM users");
  if (Number(rows[0].count) === 0) {
    const login = process.env.ADMIN_LOGIN;
    const password = process.env.ADMIN_PASSWORD;
    if (!login || !password) throw new Error("ADMIN_LOGIN and ADMIN_PASSWORD must be configured before the first start");
    await pool.execute("INSERT INTO users (login, password_hash, role, full_name) VALUES (?, ?, 'admin', ?)", [login, await hashPassword(password), "Приёмная комиссия"]);
  }
  const viewerLogin = String(process.env.VIEWER_LOGIN || "").trim();
  const viewerPassword = String(process.env.VIEWER_PASSWORD || "");
  if (viewerLogin && viewerPassword) {
    const [existing] = await pool.execute("SELECT id FROM users WHERE login = ?", [viewerLogin]);
    if (!existing.length) await pool.execute("INSERT INTO users (login, password_hash, role, full_name) VALUES (?, ?, 'viewer', ?)", [viewerLogin, await hashPassword(viewerPassword), "Наблюдатель"]);
  }
}

function parseCookies(request) {
  return Object.fromEntries((request.headers.cookie || "").split(";").map((part) => part.trim()).filter(Boolean).map((part) => { const index = part.indexOf("="); return [part.slice(0, index), part.slice(index + 1)]; }));
}

function sendJson(response, status, bodyValue, headers = {}) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers });
  response.end(JSON.stringify(bodyValue));
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
  const [rows] = await pool.execute("SELECT u.id, u.login, u.role, u.full_name, u.email, u.country, u.student_id, u.track FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires_at > NOW()", [token]);
  const user = rows[0];
  return user ? { id: user.id, login: user.login, role: user.role, name: user.full_name, email: user.email, country: user.country, studentId: user.student_id, track: user.track } : null;
}

function authError(response, status = 401) { sendJson(response, status, { error: status === 403 ? "Недостаточно прав" : "Требуется вход" }); }
function roleAllowed(user, roles) { return roles.includes(user.role); }
function cleanDate(value) { return value ? String(value).slice(0, 10) : null; }

async function route(request, response) {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  try {
    if (request.method === "GET" && url.pathname === "/api/health") return sendJson(response, 200, { ok: true });
    if (request.method === "POST" && url.pathname === "/api/auth/login") {
      const payload = await body(request);
      const login = String(payload.login || "").trim();
      const password = String(payload.password || "");
      const [rows] = await pool.execute("SELECT id, login, password_hash, role, full_name, email, country, student_id, track FROM users WHERE login = ?", [login]);
      const candidate = rows[0];
      if (!candidate || !(await verifyPassword(password, candidate.password_hash))) return sendJson(response, 401, { error: "Неверный логин или пароль" });
      const token = randomBytes(32).toString("hex");
      await pool.execute("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))", [token, candidate.id]);
      const secure = process.env.COOKIE_SECURE === "true" ? "; Secure" : "";
      const cookie = `spbgmu_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${sessionTtlSeconds}${secure}`;
      return sendJson(response, 200, { user: { id: candidate.id, login: candidate.login, role: candidate.role, name: candidate.full_name, email: candidate.email, country: candidate.country, studentId: candidate.student_id, track: candidate.track } }, { "Set-Cookie": cookie });
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
    if (await handlePaymentDocuments(request, response, url, user, pool)) return;
    if (await handleMigrationDocuments(request, response, url, user, pool)) return;
    if (await handleServicesDocuments(request, response, url, user, pool)) return;
    if (await handleMedicalDocuments(request, response, url, user, pool)) return;
    if (await handleMessages(request, response, url, user, pool, { readBody: body, mailer: notificationMailer })) return;

    if (url.pathname === "/api/students") {
      if (!roleAllowed(user, ["admin", "viewer"])) return authError(response, 403);
      const track = url.searchParams.get("track");
      if (request.method === "GET") {
        const [students] = await pool.execute("SELECT id, login, full_name, email, country, student_id, track, created_at FROM users WHERE role = 'student' AND (? IS NULL OR track = ?) ORDER BY created_at DESC", [track, track]);
        const result = [];
        for (const student of students) {
          const [progress] = await pool.execute("SELECT track, step_index, completed, admin_completed, answer, student_date, admin_date, updated_at FROM progress WHERE user_id = ? ORDER BY track, step_index", [student.id]);
          const [profiles] = await pool.execute("SELECT data FROM profiles WHERE user_id = ?", [student.id]);
          result.push({ ...student, profile: profiles[0]?.data || {}, progress });
        }
        return sendJson(response, 200, { students: result });
      }
      if (request.method === "POST") {
        if (user.role !== "admin") return authError(response, 403);
        const payload = await body(request);
        const login = String(payload.login || "").trim();
        const password = String(payload.password || "");
        const name = String(payload.name || "").trim();
        const studentId = String(payload.studentId || "").trim();
        const country = String(payload.country || "").trim();
        const email = String(payload.email || "").trim() || null;
        if (email && !validEmail(email)) return sendJson(response, 400, { error: "Укажите корректный email" });
        const selectedTrack = payload.track === "distance" ? "distance" : "onsite";
        if (!login || !password || !name || !studentId || !country) return sendJson(response, 400, { error: "Заполните ФИО, ID, страну, логин и пароль" });
        const [result] = await pool.execute("INSERT INTO users (login, password_hash, role, full_name, email, country, student_id, track) VALUES (?, ?, 'student', ?, ?, ?, ?, ?)", [login, await hashPassword(password), name, email, country, studentId, selectedTrack]);
        return sendJson(response, 201, { id: result.insertId, login, name, email, country, studentId, track: selectedTrack });
      }
    }

    if (request.method === "POST" && url.pathname === "/api/users/viewer") {
      if (user.role !== "admin") return authError(response, 403);
      const payload = await body(request);
      const login = String(payload.login || "").trim();
      const password = String(payload.password || "");
      const name = String(payload.name || "Наблюдатель").trim();
      if (!login || !password) return sendJson(response, 400, { error: "Укажите логин и пароль наблюдателя" });
      const [result] = await pool.execute("INSERT INTO users (login, password_hash, role, full_name) VALUES (?, ?, 'viewer', ?)", [login, await hashPassword(password), name]);
      return sendJson(response, 201, { id: result.insertId, login, name, role: "viewer" });
    }

    if (request.method === "GET" && url.pathname === "/api/progress") {
      const targetId = user.role === "student" ? user.id : Number(url.searchParams.get("userId") || 0);
      if (!targetId) return sendJson(response, 400, { error: "Не указан студент" });
      const track = url.searchParams.get("track") || user.track || "onsite";
      const [rows] = await pool.execute("SELECT step_index, completed, admin_completed, answer, student_date, admin_date, updated_at FROM progress WHERE user_id = ? AND track = ? ORDER BY step_index", [targetId, track]);
      return sendJson(response, 200, { track, progress: rows });
    }
    if (request.method === "POST" && url.pathname === "/api/progress") {
      const payload = await body(request);
      const targetId = user.role === "student" ? user.id : Number(payload.userId || 0);
      if (!targetId || (user.role !== "student" && user.role !== "admin")) return authError(response, 403);
      const track = payload.track === "distance" ? "distance" : "onsite";
      const stepIndex = Number(payload.stepIndex);
      if (!Number.isInteger(stepIndex) || stepIndex < 0 || stepIndex > 30) return sendJson(response, 400, { error: "Некорректный этап" });
      const completed = payload.completed ? 1 : 0;
      const adminCompleted = payload.adminCompleted ? 1 : 0;
      const answer = user.role === "student" ? (payload.answer == null ? null : String(payload.answer)) : undefined;
      const studentDate = user.role === "student" ? cleanDate(payload.studentDate) : undefined;
      const adminDate = user.role === "admin" ? cleanDate(payload.adminDate) : undefined;
      if (user.role === "student") {
        await pool.execute("INSERT INTO progress (user_id, track, step_index, completed, answer, student_date) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE completed = VALUES(completed), answer = VALUES(answer), student_date = VALUES(student_date), updated_at = CURRENT_TIMESTAMP", [targetId, track, stepIndex, completed, answer, studentDate]);
      } else {
        await pool.execute("INSERT INTO progress (user_id, track, step_index, admin_completed, admin_date) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE admin_completed = VALUES(admin_completed), admin_date = VALUES(admin_date), updated_at = CURRENT_TIMESTAMP", [targetId, track, stepIndex, adminCompleted, adminDate]);
      }
      return sendJson(response, 200, { ok: true });
    }

    if (url.pathname === "/api/profile") {
      const targetId = user.role === "student" ? user.id : Number(url.searchParams.get("studentId") || 0);
      if (!targetId || (user.role !== "student" && !roleAllowed(user, ["admin", "viewer"]))) return authError(response, 403);
      if (request.method === "GET") {
        const [rows] = await pool.execute("SELECT data FROM profiles WHERE user_id = ?", [targetId]);
        const profile = rows[0]?.data || {};
        return sendJson(response, 200, { profile: user.role === "student" && profile.email == null ? { ...profile, email: user.email || "" } : profile });
      }
      if (request.method === "POST") {
        if (user.role !== "student") return authError(response, 403);
        const payload = await body(request);
        const profile = payload.profile || {};
        if (typeof profile !== "object" || Array.isArray(profile)) return sendJson(response, 400, { error: "Некорректная анкета" });
        if (profile.email != null) {
          profile.email = String(profile.email).trim();
          if (profile.email && !validEmail(profile.email)) return sendJson(response, 400, { error: "Укажите корректный email" });
        }
        const connection = await pool.getConnection();
        try {
          await connection.beginTransaction();
          await connection.execute("INSERT INTO profiles (user_id, data) VALUES (?, ?) ON DUPLICATE KEY UPDATE data = VALUES(data), updated_at = CURRENT_TIMESTAMP", [targetId, JSON.stringify(profile)]);
          if (profile.email != null) await connection.execute("UPDATE users SET email=? WHERE id=?", [profile.email || null, targetId]);
          await connection.commit();
        } catch (error) { await connection.rollback(); throw error; }
        finally { connection.release(); }
        return sendJson(response, 200, { ok: true });
      }
    }

    sendJson(response, 404, { error: "Не найдено" });
  } catch (error) {
    console.error(error);
    const duplicate = error?.code === "ER_DUP_ENTRY";
    sendJson(response, duplicate ? 409 : 500, { error: duplicate ? "Такой логин или ID уже существует" : "Ошибка сервера" });
  }
}

await initDatabase();
await initPaymentDocuments(pool);
await initMigrationDocuments(pool);
await initServicesDocuments(pool);
await initMedicalDocuments(pool);
await initMessageNotifications(pool);
startNotificationWorker(pool, notificationMailer);
http.createServer((request, response) => route(request, response)).listen(port, "0.0.0.0", () => console.log(`API listening on http://0.0.0.0:${port}`));
