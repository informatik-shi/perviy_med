import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import mysql from "mysql2/promise";

test("migration documents and planned arrival", { skip: process.env.PAYMENT_TEST_LOCAL !== "1" }, async (t) => {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
  });
  const origin = process.env.PAYMENT_TEST_ORIGIN || "http://127.0.0.1:4000";
  const users = [];
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a54sAAAAASUVORK5CYII=", "base64");
  const fixture = async (role) => {
    const name = "qa-migration-" + randomBytes(8).toString("hex");
    const [result] = await db.execute("INSERT INTO users (login,password_hash,role,full_name,student_id,track) VALUES (?, ?, ?, ?, ?, 'onsite')", [name, "test-session-only", role, name, role === "student" ? name : null]);
    users.push(result.insertId);
    const token = randomBytes(32).toString("hex");
    await db.execute("INSERT INTO sessions (token,user_id,expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR))", [token, result.insertId]);
    return { id: result.insertId, cookie: "spbgmu_session=" + token };
  };
  const request = (user, path, options = {}) => fetch(origin + path, { ...options, headers: { ...(user ? { Cookie: user.cookie } : {}), ...options.headers } });
  const upload = (user, kind, studentId) => request(user, "/api/migration-documents?kind=" + kind + (studentId ? "&studentId=" + studentId : ""), {
    method: "POST", headers: { "Content-Type": "image/png", "X-File-Name": encodeURIComponent(kind + ".png") }, body: png,
  });
  try {
    const student = await fixture("student");
    const other = await fixture("student");
    const admin = await fixture("admin");
    const viewer = await fixture("viewer");
    let visaId;
    let registrationId;
    await t.test("anonymous access is denied", async () => {
      assert.equal((await request(null, "/api/migration-documents")).status, 401);
    });
    await t.test("visa and ticket are stored as distinct documents with history", async () => {
      const visa = await upload(student, "visa");
      assert.equal(visa.status, 201);
      visaId = (await visa.json()).id;
      assert.equal((await upload(student, "ticket")).status, 201);
      assert.equal((await upload(student, "visa")).status, 201);
      const registration = await upload(student, "registration");
      assert.equal(registration.status, 201);
      registrationId = (await registration.json()).id;
      const { documents } = await (await request(student, "/api/migration-documents")).json();
      assert.equal(documents.length, 4);
      assert.deepEqual(documents.map((doc) => doc.kind).sort(), ["registration", "ticket", "visa", "visa"]);
      const [stored] = await db.execute("SELECT file_data FROM migration_documents WHERE id = ?", [visaId]);
      assert.deepEqual(stored[0].file_data, png);
      const payment = await (await request(student, "/api/payment-documents")).json();
      assert.equal(payment.documents.length, 0);
    });
    await t.test("admin and viewer can view and download student documents", async () => {
      for (const user of [admin, viewer]) {
        const list = await request(user, "/api/migration-documents?studentId=" + student.id);
        assert.equal(list.status, 200);
        assert.equal((await list.json()).documents.length, 4);
        const file = await request(user, "/api/migration-documents/" + visaId + "?download=1");
        assert.equal(file.status, 200);
        assert.match(file.headers.get("content-disposition"), /^attachment;/);
        assert.deepEqual(Buffer.from(await file.arrayBuffer()), png);
        const registration = await request(user, "/api/migration-documents/" + registrationId);
        assert.equal(registration.status, 200);
        assert.deepEqual(Buffer.from(await registration.arrayBuffer()), png);
      }
    });
    await t.test("other students cannot read or attach files for this student", async () => {
      assert.equal((await request(other, "/api/migration-documents/" + visaId)).status, 404);
      assert.equal((await request(other, "/api/migration-documents?studentId=" + student.id)).status, 403);
      assert.equal((await upload(other, "visa", student.id)).status, 403);
      assert.equal((await request(other, "/api/migration-documents/" + registrationId)).status, 404);
      assert.equal((await upload(other, "registration", student.id)).status, 403);
    });
    await t.test("staff cannot upload in place of students and invalid document kinds are denied", async () => {
      for (const user of [admin, viewer]) assert.equal((await upload(user, "visa", student.id)).status, 403);
      for (const kind of ["invoice", "receipt", "unknown"]) assert.equal((await upload(student, kind)).status, 403);
    });
    await t.test("planned arrival date is shared between student route and admin record", async () => {
      const response = await request(student, "/api/progress", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ track: "onsite", stepIndex: 9, completed: false, studentDate: "2027-09-15" }) });
      assert.equal(response.status, 200);
      for (const user of [student, admin]) {
        const payload = await (await request(user, "/api/progress?track=onsite&userId=" + student.id)).json();
        assert.equal(payload.progress.find((row) => row.step_index === 9).student_date.slice(0, 10), "2027-09-15");
      }
    });
  } finally {
    for (const id of users) await db.execute("DELETE FROM users WHERE id = ? AND login LIKE 'qa-migration-%'", [id]);
    await db.end();
  }
});
