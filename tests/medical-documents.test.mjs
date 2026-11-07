import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import mysql from "mysql2/promise";

test("Medical examination documents", { skip: process.env.PAYMENT_TEST_LOCAL !== "1" }, async (t) => {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
  });
  const origin = process.env.PAYMENT_TEST_ORIGIN || "http://127.0.0.1:4000";
  const users = [];
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a54sAAAAASUVORK5CYII=", "base64");
  const fixture = async (role) => {
    const name = "qa-medical-" + randomBytes(8).toString("hex");
    const [result] = await db.execute("INSERT INTO users (login,password_hash,role,full_name,student_id,track) VALUES (?, ?, ?, ?, ?, 'onsite')", [name, "test-session-only", role, name, role === "student" ? name : null]);
    users.push(result.insertId);
    const token = randomBytes(32).toString("hex");
    await db.execute("INSERT INTO sessions (token,user_id,expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR))", [token, result.insertId]);
    return { id: result.insertId, cookie: "spbgmu_session=" + token };
  };
  const request = (user, path, options = {}) => fetch(origin + path, { ...options, headers: { ...(user ? { Cookie: user.cookie } : {}), ...options.headers } });
  const upload = (user, kind = "results", studentId, data = png) => request(user, "/api/medical-documents?kind=" + kind + (studentId ? "&studentId=" + studentId : ""), {
    method: "POST", headers: { "Content-Type": "image/png", "X-File-Name": encodeURIComponent("Медицинское обследование.png") }, body: data,
  });
  try {
    const student = await fixture("student"), other = await fixture("student");
    const admin = await fixture("admin"), viewer = await fixture("viewer");
    let id, greenCardId, clearanceId;
    await t.test("anonymous access is denied", async () => assert.equal((await request(null, "/api/medical-documents")).status, 401));
    await t.test("Medical results is stored in MySQL with upload history", async () => {
      const response = await upload(student);
      assert.equal(response.status, 201);
      id = (await response.json()).id;
      assert.equal((await upload(student)).status, 201);
      const { documents } = await (await request(student, "/api/medical-documents")).json();
      assert.equal(documents.length, 2);
      assert.ok(documents.every((doc) => doc.kind === "results" && !("file_data" in doc)));
      const [stored] = await db.execute("SELECT file_data FROM medical_documents WHERE id = ?", [id]);
      assert.deepEqual(stored[0].file_data, png);
    });
    await t.test("green cards are stored separately without replacing medical results", async () => {
      const response = await upload(student, "green_card");
      assert.equal(response.status, 201);
      greenCardId = (await response.json()).id;
      assert.equal((await upload(student, "green_card")).status, 201);
      const { documents } = await (await request(student, "/api/medical-documents")).json();
      assert.equal(documents.filter((doc) => doc.kind === "results").length, 2);
      assert.equal(documents.filter((doc) => doc.kind === "green_card").length, 2);
      const [stored] = await db.execute("SELECT kind, file_data FROM medical_documents WHERE id = ?", [greenCardId]);
      assert.equal(stored[0].kind, "green_card");
      assert.deepEqual(stored[0].file_data, png);
    });
    await t.test("medical clearances are stored separately with upload history", async () => {
      const response = await upload(student, "clearance");
      assert.equal(response.status, 201);
      clearanceId = (await response.json()).id;
      assert.equal((await upload(student, "clearance")).status, 201);
      const { documents } = await (await request(student, "/api/medical-documents")).json();
      for (const kind of ["results", "green_card", "clearance"]) assert.equal(documents.filter((doc) => doc.kind === kind).length, 2);
      const [stored] = await db.execute("SELECT kind, file_data FROM medical_documents WHERE id = ?", [clearanceId]);
      assert.equal(stored[0].kind, "clearance");
      assert.deepEqual(stored[0].file_data, png);
    });
    await t.test("admin and viewer can list and download all medical document types", async () => {
      for (const user of [admin, viewer]) {
        const response = await request(user, "/api/medical-documents?studentId=" + student.id);
        assert.equal(response.status, 200);
        const { documents } = await response.json();
        assert.equal(documents.length, 6);
        assert.ok(documents.some((doc) => doc.kind === "green_card"));
        assert.ok(documents.some((doc) => doc.kind === "clearance"));
        for (const documentId of [id, greenCardId, clearanceId]) {
          const file = await request(user, "/api/medical-documents/" + documentId + "?download=1");
          assert.equal(file.status, 200);
          assert.deepEqual(Buffer.from(await file.arrayBuffer()), png);
        }
      }
    });
    await t.test("students cannot access each other's Medical results", async () => {
      for (const documentId of [id, greenCardId, clearanceId]) assert.equal((await request(other, "/api/medical-documents/" + documentId)).status, 404);
      assert.equal((await request(other, "/api/medical-documents?studentId=" + student.id)).status, 403);
      assert.equal((await upload(other, "results", student.id)).status, 403);
      assert.equal((await upload(other, "green_card", student.id)).status, 403);
      assert.equal((await upload(other, "clearance", student.id)).status, 403);
    });
    await t.test("invalid uploads and staff writes are rejected", async () => {
      assert.equal((await upload(student, "visa")).status, 403);
      assert.equal((await upload(student, "results", undefined, Buffer.from("not a PNG"))).status, 415);
      assert.equal((await upload(student, "green_card", undefined, Buffer.from("not a PNG"))).status, 415);
      assert.equal((await upload(student, "clearance", undefined, Buffer.from("not a PNG"))).status, 415);
      for (const user of [admin, viewer]) {
        for (const kind of ["results", "green_card", "clearance"]) assert.equal((await upload(user, kind, student.id)).status, 403);
      }
    });

  } finally {
    for (const id of users) await db.execute("DELETE FROM users WHERE id = ? AND login LIKE 'qa-medical-%'", [id]);
    await db.end();
  }
});
