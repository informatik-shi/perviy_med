import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import mysql from "mysql2/promise";

test("SNILS documents and Russian phone number", { skip: process.env.PAYMENT_TEST_LOCAL !== "1" }, async (t) => {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
  });
  const origin = process.env.PAYMENT_TEST_ORIGIN || "http://127.0.0.1:4000";
  const users = [];
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a54sAAAAASUVORK5CYII=", "base64");
  const fixture = async (role) => {
    const name = "qa-services-" + randomBytes(8).toString("hex");
    const [result] = await db.execute("INSERT INTO users (login,password_hash,role,full_name,student_id,track) VALUES (?, ?, ?, ?, ?, 'onsite')", [name, "test-session-only", role, name, role === "student" ? name : null]);
    users.push(result.insertId);
    const token = randomBytes(32).toString("hex");
    await db.execute("INSERT INTO sessions (token,user_id,expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR))", [token, result.insertId]);
    return { id: result.insertId, cookie: "spbgmu_session=" + token };
  };
  const request = (user, path, options = {}) => fetch(origin + path, { ...options, headers: { ...(user ? { Cookie: user.cookie } : {}), ...options.headers } });
  const upload = (user, kind = "snils", studentId, data = png) => request(user, "/api/services-documents?kind=" + kind + (studentId ? "&studentId=" + studentId : ""), {
    method: "POST", headers: { "Content-Type": "image/png", "X-File-Name": encodeURIComponent("СНИЛС.png") }, body: data,
  });
  try {
    const student = await fixture("student"), other = await fixture("student");
    const admin = await fixture("admin"), viewer = await fixture("viewer");
    let id;
    await t.test("anonymous access is denied", async () => assert.equal((await request(null, "/api/services-documents")).status, 401));
    await t.test("SNILS is stored in MySQL with upload history", async () => {
      const response = await upload(student);
      assert.equal(response.status, 201);
      id = (await response.json()).id;
      assert.equal((await upload(student)).status, 201);
      const { documents } = await (await request(student, "/api/services-documents")).json();
      assert.equal(documents.length, 2);
      assert.ok(documents.every((doc) => doc.kind === "snils" && !("file_data" in doc)));
      const [stored] = await db.execute("SELECT file_data FROM services_documents WHERE id = ?", [id]);
      assert.deepEqual(stored[0].file_data, png);
    });
    await t.test("admin and viewer can list and download SNILS", async () => {
      for (const user of [admin, viewer]) {
        const response = await request(user, "/api/services-documents?studentId=" + student.id);
        assert.equal(response.status, 200);
        assert.equal((await response.json()).documents.length, 2);
        const file = await request(user, "/api/services-documents/" + id);
        assert.equal(file.status, 200);
        assert.deepEqual(Buffer.from(await file.arrayBuffer()), png);
      }
    });
    await t.test("students cannot access each other's SNILS", async () => {
      assert.equal((await request(other, "/api/services-documents/" + id)).status, 404);
      assert.equal((await request(other, "/api/services-documents?studentId=" + student.id)).status, 403);
      assert.equal((await upload(other, "snils", student.id)).status, 403);
    });
    await t.test("invalid uploads and staff writes are rejected", async () => {
      assert.equal((await upload(student, "visa")).status, 403);
      assert.equal((await upload(student, "snils", undefined, Buffer.from("not a PNG"))).status, 415);
      for (const user of [admin, viewer]) assert.equal((await upload(user, "snils", student.id)).status, 403);
    });
    await t.test("phone number is saved and visible to the administrator", async () => {
      const response = await request(student, "/api/progress", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ track: "onsite", stepIndex: 17, completed: false, answer: "+70000000000" }) });
      assert.equal(response.status, 200);
      for (const user of [student, admin]) {
        const payload = await (await request(user, "/api/progress?track=onsite&userId=" + student.id)).json();
        assert.equal(payload.progress.find((row) => row.step_index === 17).answer, "+70000000000");
      }
    });
  } finally {
    for (const id of users) await db.execute("DELETE FROM users WHERE id = ? AND login LIKE 'qa-services-%'", [id]);
    await db.end();
  }
});
