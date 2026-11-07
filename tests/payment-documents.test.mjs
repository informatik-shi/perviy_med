import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import mysql from "mysql2/promise";

// Run only inside the explicitly selected local Compose API container.
test("payment documents: persistence and role isolation", { skip: process.env.PAYMENT_TEST_LOCAL !== "1" }, async (t) => {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST, user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
  });
  const users = [];
  const origin = process.env.PAYMENT_TEST_ORIGIN || "http://127.0.0.1:4000";
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a54sAAAAASUVORK5CYII=", "base64");
  const fixture = async (role) => {
    const name = "qa-payment-" + randomBytes(8).toString("hex");
    const [result] = await db.execute("INSERT INTO users (login,password_hash,role,full_name,student_id,track) VALUES (?, ?, ?, ?, ?, 'onsite')", [name, "test-session-only", role, name, role === "student" ? name : null]);
    users.push(result.insertId);
    const token = randomBytes(32).toString("hex");
    await db.execute("INSERT INTO sessions (token,user_id,expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR))", [token, result.insertId]);
    return { id: result.insertId, cookie: "spbgmu_session=" + token };
  };
  const call = (user, path = "", options = {}) => fetch(origin + "/api/payment-documents" + path, { ...options, headers: { ...(user ? { Cookie: user.cookie } : {}), ...options.headers } });
  const upload = (user, kind, data = png, name = "чек.png", studentId) => call(user, "?kind=" + kind + (studentId ? "&studentId=" + studentId : ""), { method: "POST", headers: { "Content-Type": "image/png", "X-File-Name": encodeURIComponent(name) }, body: data });
  try {
    const student = await fixture("student");
    const other = await fixture("student");
    const admin = await fixture("admin");
    const viewer = await fixture("viewer");
    let receiptId;
    await t.test("authentication is required", async () => {
      assert.equal((await call(null)).status, 401);
    });
    await t.test("student uploads multiple receipts without losing history", async () => {
      const first = await upload(student, "receipt");
      assert.equal(first.status, 201);
      receiptId = (await first.json()).id;
      assert.equal((await upload(student, "receipt", png, "второй-чек.png")).status, 201);
      const list = await (await call(student)).json();
      assert.equal(list.documents.length, 2);
      assert.ok(list.documents.every((doc) => doc.kind === "receipt" && !("file_data" in doc)));
    });
    await t.test("binary contents are stored in MySQL and served intact", async () => {
      const [rows] = await db.execute("SELECT file_data, byte_size FROM payment_documents WHERE id = ?", [receiptId]);
      assert.deepEqual(rows[0].file_data, png);
      assert.equal(rows[0].byte_size, png.length);
      const response = await call(admin, "/" + receiptId + "?download=1");
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("content-type"), "image/png");
      assert.match(response.headers.get("content-disposition"), /^attachment;/);
      assert.match(response.headers.get("cache-control"), /no-store/);
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), png);
    });
    await t.test("another student cannot read or upload another student's files", async () => {
      assert.equal((await call(other, "/" + receiptId)).status, 404);
      assert.equal((await call(other, "?studentId=" + student.id)).status, 403);
      assert.equal((await upload(other, "receipt", png, "чек.png", student.id)).status, 403);
      assert.equal((await (await call(other)).json()).documents.length, 0);
    });
    await t.test("admin and viewer can read receipts; only admin can issue invoices", async () => {
      for (const user of [admin, viewer]) {
        const response = await call(user, "?studentId=" + student.id);
        assert.equal(response.status, 200);
        assert.equal((await response.json()).documents.length, 2);
        assert.equal((await call(user, "/" + receiptId)).status, 200);
      }
      assert.equal((await upload(student, "invoice")).status, 403);
      assert.equal((await upload(viewer, "invoice", png, "invoice.png", student.id)).status, 403);
      assert.equal((await upload(viewer, "receipt", png, "receipt.png", student.id)).status, 403);
      const invoice = await upload(admin, "invoice", png, "квитанция.png", student.id);
      assert.equal(invoice.status, 201);
      const invoiceId = (await invoice.json()).id;
      assert.equal((await call(student, "/" + invoiceId + "?download=1")).status, 200);
    });
    await t.test("invalid formats and oversized files are rejected", async () => {
      assert.equal((await upload(student, "receipt", Buffer.from("<html>not a receipt</html>"))).status, 415);
      assert.equal((await upload(student, "receipt", png, "receipt.html")).status, 415);
      assert.equal((await upload(student, "receipt", Buffer.alloc(0))).status, 415);
      assert.equal((await upload(student, "receipt", Buffer.alloc(5 * 1024 * 1024 + 1))).status, 413);
      const response = await call(student, "/invalid");
      assert.equal(response.status, 404);
    });
    await t.test("uploads over the default proxy limit remain downloadable", async () => {
      const large = Buffer.concat([png, Buffer.alloc(1024 * 1024)]);
      const response = await upload(student, "receipt", large, "large-receipt.png");
      assert.equal(response.status, 201);
      const id = (await response.json()).id;
      const downloaded = await call(admin, "/" + id);
      assert.equal(downloaded.status, 200);
      assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), large);
    });
  } finally {
    for (const id of users) await db.execute("DELETE FROM users WHERE id = ? AND login LIKE 'qa-payment-%'", [id]);
    await db.end();
  }
});
