"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Lang = "ru" | "en";
type Message = { id: number; body: string; sender_role: string; sender_name: string; created_at: string; email_status?: string | null };
type Conversation = { id: number; full_name: string; student_id: string; last_message_at: string; unread_count: number };
const text = (lang: Lang, ru: string, en: string) => lang === "ru" ? ru : en;

export function MessagesPanel({ lang, studentId, studentName, readOnly, onClose }: { lang: Lang; studentId: number; studentName: string; readOnly: boolean; onClose?: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [emailConfigured, setEmailConfigured] = useState<boolean>();
  const sending = useRef(false);
  const loadVersion = useRef(0);
  const requestKey = useRef({ body: "", token: "" });
  const thread = useRef<HTMLDivElement>(null);
  const load = useCallback(async (signal?: AbortSignal) => {
    const version = ++loadVersion.current;
    const response = await fetch(`/api/messages?studentId=${studentId}`, { credentials: "include", signal, cache: "no-store" });
    if (!response.ok) throw new Error("Cannot load messages");
    const payload = await response.json();
    if (signal?.aborted || version !== loadVersion.current) return;
    const next: Message[] = payload.messages || [];
    setMessages((current) => JSON.stringify(current) === JSON.stringify(next) ? current : next);
    setEmailConfigured(payload.emailConfigured);
    setLoadError(false);
  }, [studentId]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setMessages([]); setDraft(""); setError(""); setNotice("");
    requestKey.current = { body: "", token: "" };
    const refresh = () => {
      if (document.visibilityState === "hidden") return;
      void load(controller.signal).catch(() => { if (!controller.signal.aborted) setLoadError(true); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    };
    refresh();
    const timer = window.setInterval(refresh, 3000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { controller.abort(); window.clearInterval(timer); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [load]);
  useEffect(() => { const element = thread.current; if (element) element.scrollTop = element.scrollHeight; }, [messages.length]);
  async function send() {
    const body = draft.trim();
    if (!body || readOnly || sending.current) return;
    sending.current = true; setBusy(true); setError(""); setNotice("");
    try {
      if (requestKey.current.body !== body) {
        const token = Array.from(crypto.getRandomValues(new Uint8Array(16)), (value) => value.toString(16).padStart(2, "0")).join("");
        requestKey.current = { body, token };
      }
      const response = await fetch("/api/messages", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ studentId, message: body, clientToken: requestKey.current.token }) });
      if (!response.ok) throw new Error("Cannot send message");
      const result = await response.json();
      setDraft(""); requestKey.current = { body: "", token: "" };
      setNotice(result.notification === "not_configured" ? text(lang, "Ответ сохранён в чате. Email-уведомление ожидает настройки почты системным администратором.", "The reply is saved in the chat. Email notification is waiting for mail setup by the system administrator.") : result.notification === "missing_email" ? text(lang, "Ответ сохранён в чате. У студента не указан корректный email для уведомления.", "The reply is saved in the chat. The student has no valid notification email.") : result.notification === "queued" ? text(lang, "Ответ сохранён. Email-уведомление поставлено в очередь.", "The reply is saved. Email notification has been queued.") : text(lang, "Сообщение отправлено.", "Message sent."));
      try { await load(); } catch { setLoadError(true); }
    } catch { setError(text(lang, "Не удалось отправить сообщение. Текст остался в поле — попробуйте ещё раз.", "Could not send the message. Your text is still in the field — please try again.")); }
    finally { sending.current = false; setBusy(false); }
  }
  return <section className="page-panel messages-panel">
    <div className="panel-title-row"><div><span className="eyebrow">{text(lang, "КОММУНИКАЦИЯ", "MESSAGES")}</span><h1>{text(lang, "Сообщения", "Messages")}</h1><p>{studentName}</p></div>{onClose && <button className="outline-button" onClick={onClose}>{text(lang, "Назад", "Back")}</button>}</div>
    <p className="chat-help">{text(lang, "Задавайте вопросы администратору здесь. Новые ответы появляются автоматически.", "Ask the administrator questions here. New replies appear automatically.")}</p>
    {emailConfigured === undefined ? <p className="chat-help">{text(lang, "Email-уведомления об ответах направляются на почту из анкеты, когда системный администратор подключит почтовый сервис.", "Reply notifications go to the email in your questionnaire once the system administrator connects the mail service.")}</p> : !emailConfigured && <p className="chat-help">{text(lang, "Почтовый сервис ещё не подключён системным администратором. Чат работает; уведомления ожидают настройки.", "The system administrator has not connected the mail service yet. Chat works; notifications await configuration.")}</p>}
    {loadError && <p className="login-error" role="alert">{text(lang, "Не удалось обновить переписку. Повторная попытка выполняется автоматически.", "Could not refresh the conversation. Retrying automatically.")}</p>}
    <div className="message-thread" role="log" aria-live="polite" aria-label={text(lang, "Переписка", "Conversation")} ref={thread}>
      {loading ? <div className="empty-state">{text(lang, "Загрузка сообщений…", "Loading messages…")}</div> : !messages.length ? <div className="empty-state">{text(lang, "Сообщений пока нет. Напишите первым.", "No messages yet. Start the conversation.")}</div> : messages.map((message) => <div className={`message-bubble ${message.sender_role === "student" ? "from-student" : "from-admin"}`} key={message.id}>
        <strong>{message.sender_name}</strong><p>{message.body}</p><small>{new Date(message.created_at).toLocaleString(lang === "ru" ? "ru-RU" : "en-GB")}</small>
        {emailConfigured !== undefined && message.sender_role === "admin" && <small>{message.email_status === "sent" ? text(lang, "Уведомление принято почтовым сервером", "Notification accepted by the mail server") : message.email_status === "failed" ? text(lang, "Email не отправлен — требуется проверка почтовой настройки", "Email not sent — check mail configuration") : message.email_status ? text(lang, "Email в очереди отправки", "Email queued") : text(lang, "Email-уведомление не создано", "No email notification created")}</small>}
      </div>)}
    </div>
    {!readOnly && <form className="message-composer" onSubmit={(event) => { event.preventDefault(); void send(); }}>
      <label className="chat-composer-label">{text(lang, "Ваше сообщение", "Your message")}<textarea value={draft} disabled={busy} maxLength={10000} onChange={(event) => setDraft(event.target.value)} placeholder={text(lang, "Напишите сообщение…", "Write a message…")} rows={3} /></label>
      <button type="submit" className="primary-button" disabled={busy || !draft.trim()}>{busy ? text(lang, "Отправляем…", "Sending…") : text(lang, "Отправить", "Send")}</button>
    </form>}
    {readOnly && <div className="read-only-note">{text(lang, "Режим просмотра: отправка сообщений отключена.", "View-only mode: sending messages is disabled.")}</div>}
    {notice && <p className="payment-success" role="status">{notice}</p>}
    {error && <p className="login-error" role="alert">{error}</p>}
  </section>;
}

export function MessagesInbox({ lang, onSelect }: { lang: Lang; onSelect: (student: { dbId: number; name: string; id: string }) => void }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const refresh = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const response = await fetch("/api/conversations", { credentials: "include", signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error("Cannot load conversations");
        setConversations((await response.json()).conversations || []); setError(false);
      } catch { if (!controller.signal.aborted) setError(true); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, []);
  return <div className="content"><section className="page-panel messages-panel"><div className="panel-title-row"><div><span className="eyebrow">{text(lang, "КОММУНИКАЦИЯ", "MESSAGES")}</span><h1>{text(lang, "Сообщения студентов", "Student messages")}</h1><p>{text(lang, "Выберите диалог, чтобы прочитать вопрос и ответить.", "Select a conversation to read the question and reply.")}</p></div></div>
    {error && <p role="alert" className="login-error">{text(lang, "Не удалось обновить список. Повторяем автоматически.", "Could not refresh the list. Retrying automatically.")}</p>}
    {loading ? <p>{text(lang, "Загрузка…", "Loading…")}</p> : !conversations.length ? <div className="empty-state">{text(lang, "Студенты пока не написали. Начать диалог можно из таблицы студентов.", "No student messages yet. You can start a conversation from the student table.")}</div> : <div className="chat-conversations">{conversations.map((item) => <button type="button" className="chat-conversation" key={item.id} onClick={() => onSelect({ dbId: item.id, name: item.full_name, id: item.student_id })}>
      <span><strong>{item.full_name}</strong><small>{item.student_id}</small></span><span><small>{new Date(item.last_message_at).toLocaleString(lang === "ru" ? "ru-RU" : "en-GB")}</small>{Number(item.unread_count) > 0 && <b>{text(lang, "Новых: ", "New: ")}{item.unread_count}</b>}</span>
    </button>)}</div>}
  </section></div>;
}
