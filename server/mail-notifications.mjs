import nodemailer from "nodemailer";

export function validEmail(value) {
  return typeof value === "string" && value.length <= 190 && /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9.-]*[A-Z0-9])?\.[A-Z]{2,}$/i.test(value);
}

export function createNotificationMailer(env = process.env, createTransport = nodemailer.createTransport) {
  const host = String(env.SMTP_HOST || "").trim();
  const from = String(env.SMTP_FROM || "").trim();
  const appUrl = String(env.APP_URL || "").trim();
  if (!host || !from || !appUrl) return { configured: false };
  if (!validEmail(from)) throw new Error("SMTP_FROM must be a single valid email address");
  const link = new URL(appUrl);
  if (!["https:", "http:"].includes(link.protocol) || link.username || link.password) throw new Error("Invalid APP_URL");
  link.searchParams.set("section", "messages");
  const secure = env.SMTP_SECURE === "true";
  const port = Number(env.SMTP_PORT || (secure ? 465 : 587));
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid SMTP_PORT");
  const user = String(env.SMTP_USER || "");
  const pass = String(env.SMTP_PASSWORD || "");
  if (user && !pass) throw new Error("SMTP_PASSWORD is required with SMTP_USER");
  const transport = createTransport({
    host, port, secure, requireTLS: !secure,
    ...(user ? { auth: { user, pass } } : {}),
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
    disableFileAccess: true, disableUrlAccess: true,
  });
  return {
    configured: true,
    async send({ messageId, recipient }) {
      if (!validEmail(recipient)) throw Object.assign(new Error("Invalid recipient"), { code: "INVALID_EMAIL" });
      const result = await transport.sendMail({
        from: { name: "ПСПбГМУ · Подготовительное отделение", address: from },
        to: { address: recipient },
        subject: "Новый ответ в личном кабинете / New reply in your account",
        messageId: `<chat-reply-${messageId}@${link.hostname}>`,
        text: "Администратор ответил на ваше сообщение. Прочитать ответ и задать новый вопрос можно в разделе «Сообщения» личного кабинета.\n\n" +
          "An administrator has replied to your message. Open Messages in your personal account to read the reply and ask another question.\n\n" + link.href,
      });
      if (!result.accepted?.length) throw Object.assign(new Error("Recipient rejected"), { code: "RECIPIENT_REJECTED" });
    },
  };
}

export async function initMessageNotifications(pool) {
  const [columns] = await pool.query("SHOW COLUMNS FROM messages LIKE 'client_token'");
  if (!columns.length) await pool.query("ALTER TABLE messages ADD COLUMN client_token VARCHAR(64) NULL");
  const [indexes] = await pool.query("SHOW INDEX FROM messages WHERE Key_name = 'idx_messages_client_token'");
  if (!indexes.length) await pool.query("ALTER TABLE messages ADD UNIQUE INDEX idx_messages_client_token (sender_id, client_token)");
  await pool.query(`CREATE TABLE IF NOT EXISTS message_email_notifications (
    message_id BIGINT UNSIGNED PRIMARY KEY,
    student_id BIGINT UNSIGNED NOT NULL,
    recipient VARCHAR(190) NOT NULL,
    status ENUM('pending','sending','sent','failed') NOT NULL DEFAULT 'pending',
    attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
    next_attempt_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    locked_at DATETIME NULL,
    sent_at DATETIME NULL,
    error_code VARCHAR(80) NULL,
    INDEX idx_notification_due (status, next_attempt_at),
    CONSTRAINT fk_notification_message FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    CONSTRAINT fk_notification_student FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

export async function deliverNotification(pool, mailer, messageId) {
  if (!mailer.configured) return false;
  const [claim] = await pool.execute("UPDATE message_email_notifications SET status='sending', locked_at=NOW(), attempts=attempts+1 WHERE message_id=? AND status='pending' AND next_attempt_at <= NOW() AND attempts < 10", [messageId]);
  if (!claim.affectedRows) return false;
  const [rows] = await pool.execute("SELECT recipient, attempts FROM message_email_notifications WHERE message_id=?", [messageId]);
  const item = rows[0];
  try {
    await mailer.send({ messageId, recipient: item.recipient });
    await pool.execute("UPDATE message_email_notifications SET status='sent', sent_at=NOW(), locked_at=NULL, error_code=NULL WHERE message_id=?", [messageId]);
    return true;
  } catch (error) {
    // Never persist SMTP responses: they may contain credentials or personal data.
    const code = String(error.code || "SMTP_ERROR").replace(/[^A-Z0-9_]/gi, "").slice(0, 80) || "SMTP_ERROR";
    const delay = Math.min(3600, 60 * 2 ** (item.attempts - 1));
    await pool.execute("UPDATE message_email_notifications SET status=?, next_attempt_at=DATE_ADD(NOW(), INTERVAL ? SECOND), locked_at=NULL, error_code=? WHERE message_id=?", [item.attempts >= 10 ? "failed" : "pending", delay, code, messageId]);
    return false;
  }
}

export function startNotificationWorker(pool, mailer) {
  if (!mailer.configured) {
    console.info("Chat email notifications await SMTP_HOST, SMTP_FROM and APP_URL configuration");
    return;
  }
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await pool.query("UPDATE message_email_notifications SET status=CASE WHEN attempts>=10 THEN 'failed' ELSE 'pending' END, locked_at=NULL WHERE status='sending' AND locked_at < DATE_SUB(NOW(), INTERVAL 5 MINUTE)");
      const [due] = await pool.query("SELECT message_id FROM message_email_notifications WHERE status='pending' AND attempts < 10 AND next_attempt_at <= NOW() ORDER BY message_id LIMIT 10");
      for (const item of due) await deliverNotification(pool, mailer, item.message_id);
    } catch { console.error("Chat email queue processing failed"); }
    finally { running = false; }
  };
  void tick();
  setInterval(() => void tick(), 10000).unref();
}
