import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import mysql from "mysql2/promise";
import { deliverNotification, initMessageNotifications } from "../server/mail-notifications.mjs";

test("local chat, privacy, email queue and retry", { skip: process.env.CHAT_TEST_LOCAL !== "1" }, async (t) => {
  const pool = mysql.createPool({ host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME, connectionLimit: 3 });
  const origin = process.env.CHAT_TEST_ORIGIN || "http://127.0.0.1:4000";
  const users = [];
  const fixture = async (role, email = null) => {
    const name = "qa-chat-" + randomBytes(8).toString("hex");
    const [result] = await pool.execute("INSERT INTO users (login,password_hash,role,full_name,student_id,email,track) VALUES (?,'test-session-only',?,?,?,?, 'onsite')", [name, role, name, role === "student" ? name : null, email]);
    users.push(result.insertId);
    const token = randomBytes(32).toString("hex");
    await pool.execute("INSERT INTO sessions (token,user_id,expires_at) VALUES (?,?,DATE_ADD(NOW(), INTERVAL 1 HOUR))", [token, result.insertId]);
    return { id: result.insertId, cookie: "spbgmu_session=" + token };
  };
  const request = (user, path, options = {}) => fetch(origin + path, { ...options, headers: { ...(user ? { Cookie: user.cookie } : {}), ...options.headers } });
  const post = (user, path, payload) => request(user, path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  try {
    const student = await fixture("student", "registered@example.test"), other = await fixture("student");
    const admin = await fixture("admin"), viewer = await fixture("viewer");
    let replyId;
    await t.test("notification migrations are idempotent", async () => { await initMessageNotifications(pool); await initMessageNotifications(pool); });
    await t.test("anonymous users and students cannot list other conversations", async () => {
      assert.equal((await request(null, "/api/messages")).status, 401);
      assert.equal((await request(student, "/api/conversations")).status, 403);
      assert.equal((await request(student, "/api/messages?studentId=" + other.id)).status, 403);
      assert.equal((await post(student, "/api/messages", { studentId: other.id, message: "Spoof" })).status, 403);
    });
    await t.test("students send questions once, staff see them and viewers cannot reply", async () => {
      const payload = { message: "Тестовый вопрос студентом", clientToken: randomBytes(16).toString("hex") };
      const sent = await post(student, "/api/messages", payload);
      assert.equal(sent.status, 201);
      assert.equal((await sent.json()).notification, "not_applicable");
      assert.equal((await post(student, "/api/messages", payload)).status, 200);
      const [rows] = await pool.execute("SELECT id FROM messages WHERE sender_id=?", [student.id]);
      assert.equal(rows.length, 1);
      const inbox = await (await request(viewer, "/api/conversations")).json();
      assert.equal(Number(inbox.conversations.find((item) => item.id === student.id).unread_count), 1);
      const thread = await (await request(viewer, "/api/messages?studentId=" + student.id)).json();
      assert.equal(thread.messages.length, 1);
      const [unread] = await pool.execute("SELECT read_at FROM messages WHERE id=?", [rows[0].id]);
      assert.equal(unread[0].read_at, null);
      assert.equal((await post(viewer, "/api/messages", { studentId: student.id, message: "Forbidden" })).status, 403);
    });
    await t.test("profile email is validated and synchronised with the account", async () => {
      assert.equal((await post(student, "/api/profile", { profile: { email: "bad\r\nemail" } })).status, 400);
      assert.equal((await post(student, "/api/profile", { profile: { email: "questionnaire@example.test", phone: "+70000000000" } })).status, 200);
      const [rows] = await pool.execute("SELECT email FROM users WHERE id=?", [student.id]);
      assert.equal(rows[0].email, "questionnaire@example.test");
    });
    await t.test("admin reply and email job commit together, retries do not duplicate them", async () => {
      const payload = { studentId: student.id, message: "Ответ администратора", clientToken: randomBytes(16).toString("hex") };
      const response = await post(admin, "/api/messages", payload);
      assert.equal(response.status, 201);
      const result = await response.json(); replyId = result.id;
      assert.equal(result.notification, "not_configured");
      assert.equal((await post(admin, "/api/messages", payload)).status, 200);
      const [jobs] = await pool.execute("SELECT * FROM message_email_notifications WHERE message_id=?", [replyId]);
      assert.equal(jobs.length, 1); assert.equal(jobs[0].recipient, "questionnaire@example.test"); assert.equal(jobs[0].status, "pending");
      const thread = await (await request(student, "/api/messages")).json();
      assert.equal(thread.messages.length, 2);
      assert.equal(thread.messages.at(-1).body, payload.message);
      const unrelated = await (await request(other, "/api/messages")).json();
      assert.equal(unrelated.messages.length, 0);
      assert.equal((await post(admin, "/api/messages", { ...payload, message: "Changed content" })).status, 409);
    });
    await t.test("SMTP outage preserves the answer and schedules retry; a later send succeeds once", async () => {
      assert.equal(await deliverNotification(pool, { configured: false }, replyId), false);
      assert.equal(await deliverNotification(pool, { configured: true, send: async () => { throw Object.assign(new Error("secret SMTP details"), { code: "EAUTH" }); } }, replyId), false);
      let [rows] = await pool.execute("SELECT * FROM message_email_notifications WHERE message_id=?", [replyId]);
      assert.equal(rows[0].status, "pending"); assert.equal(rows[0].attempts, 1); assert.equal(rows[0].error_code, "EAUTH");
      const [messages] = await pool.execute("SELECT body FROM messages WHERE id=?", [replyId]); assert.equal(messages[0].body, "Ответ администратора");
      await pool.execute("UPDATE message_email_notifications SET next_attempt_at=NOW() WHERE message_id=?", [replyId]);
      let sends = 0;
      const fakeMailer = { configured: true, send: async ({ recipient, messageId }) => { sends++; assert.equal(recipient, "questionnaire@example.test"); assert.equal(messageId, replyId); } };
      assert.equal(await deliverNotification(pool, fakeMailer, replyId), true);
      assert.equal(await deliverNotification(pool, fakeMailer, replyId), false);
      [rows] = await pool.execute("SELECT status,attempts,error_code FROM message_email_notifications WHERE message_id=?", [replyId]);
      assert.equal(rows[0].status, "sent"); assert.equal(rows[0].attempts, 2); assert.equal(rows[0].error_code, null); assert.equal(sends, 1);
    });
    await t.test("missing email, invalid targets, empty and oversized messages are handled", async () => {
      const noEmail = await post(admin, "/api/messages", { studentId: other.id, message: "Reply without email" });
      assert.equal(noEmail.status, 201); const item = await noEmail.json(); assert.equal(item.notification, "missing_email");
      const [jobs] = await pool.execute("SELECT message_id FROM message_email_notifications WHERE message_id=?", [item.id]); assert.equal(jobs.length, 0);
      assert.equal((await post(admin, "/api/messages", { studentId: admin.id, message: "Wrong role" })).status, 404);
      assert.equal((await post(student, "/api/messages", { message: " " })).status, 400);
      assert.equal((await post(student, "/api/messages", { message: "x".repeat(10001) })).status, 400);
      assert.equal((await post(student, "/api/messages", { message: "x", clientToken: "bad" })).status, 400);
      const inbox = await (await request(admin, "/api/conversations")).json(); assert(inbox.conversations.some((entry) => entry.id === student.id));
    });
  } finally {
    for (const id of users) await pool.execute("DELETE FROM users WHERE id=? AND login LIKE 'qa-chat-%'", [id]);
    await pool.end();
  }
});
