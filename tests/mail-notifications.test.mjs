import assert from "node:assert/strict";
import test from "node:test";
import { createNotificationMailer, validEmail } from "../server/mail-notifications.mjs";

test("mail is disabled until administrators configure SMTP and the public URL", () => {
  assert.equal(createNotificationMailer({}).configured, false);
  assert.equal(createNotificationMailer({ SMTP_HOST: "smtp.example.test", SMTP_FROM: "sender@example.test" }).configured, false);
});

test("SMTP uses mandatory TLS and sends only a bilingual notification with a chat link", async () => {
  let options, message;
  const mailer = createNotificationMailer({ SMTP_HOST: "smtp.example.test", SMTP_PORT: "587", SMTP_FROM: "sender@example.test", SMTP_USER: "mail-user", SMTP_PASSWORD: "test-only", APP_URL: "https://students.example.test/" }, (value) => {
    options = value;
    return { sendMail: async (value) => { message = value; return { accepted: ["student@example.test"] }; } };
  });
  assert.equal(options.requireTLS, true);
  assert.equal(options.secure, false);
  assert.equal(options.disableFileAccess, true);
  assert.equal(options.disableUrlAccess, true);
  assert.equal(options.auth.pass, "test-only");
  await mailer.send({ messageId: 77, recipient: "student@example.test" });
  assert.deepEqual(message.to, { address: "student@example.test" });
  assert.match(message.text, /section=messages/);
  assert.match(message.text, /Администратор ответил/);
  assert.match(message.text, /An administrator has replied/);
  assert.equal(message.messageId, "<chat-reply-77@students.example.test>");
  assert.equal(message.html, undefined);
  assert.equal(message.attachments, undefined);
  assert(!message.text.includes("test-only"));
});

test("SMTPS and IP-authorised university relay are supported without insecure TLS overrides", async () => {
  let options;
  createNotificationMailer({ SMTP_HOST: "relay.example.test", SMTP_PORT: "465", SMTP_SECURE: "true", SMTP_FROM: "sender@example.test", APP_URL: "https://students.example.test" }, (value) => { options = value; return {}; });
  assert.equal(options.secure, true);
  assert.equal(options.auth, undefined);
  assert.equal(options.tls, undefined);
});

test("invalid sender, credentials, URL and injected recipients are rejected", async () => {
  const env = { SMTP_HOST: "smtp.example.test", SMTP_FROM: "sender@example.test", APP_URL: "https://students.example.test" };
  for (const value of ["a@example.test\r\nBcc: leak@example.test", "x,y@example.test", "", "not-an-email"]) assert.equal(validEmail(value), false);
  assert.throws(() => createNotificationMailer({ ...env, SMTP_FROM: "X <a@example.test>" }));
  assert.throws(() => createNotificationMailer({ ...env, APP_URL: "javascript:alert(1)" }));
  assert.throws(() => createNotificationMailer({ ...env, APP_URL: "https://secret:password@example.test" }));
  assert.throws(() => createNotificationMailer({ ...env, SMTP_PORT: "bad" }));
  assert.throws(() => createNotificationMailer({ ...env, SMTP_USER: "user" }));
  const mailer = createNotificationMailer(env, () => ({ sendMail: () => { throw new Error("Must not send"); } }));
  await assert.rejects(mailer.send({ messageId: 1, recipient: "a@example.test\r\nBcc: bad@example.test" }), { code: "INVALID_EMAIL" });
});

test("rejected SMTP recipients are not treated as sent", async () => {
  const mailer = createNotificationMailer({ SMTP_HOST: "smtp.example.test", SMTP_FROM: "sender@example.test", APP_URL: "https://students.example.test" }, () => ({ sendMail: async () => ({ accepted: [] }) }));
  await assert.rejects(mailer.send({ messageId: 1, recipient: "student@example.test" }), { code: "RECIPIENT_REJECTED" });
});
