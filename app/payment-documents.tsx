"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Lang = "ru" | "en";
type MigrationKind = "visa" | "ticket" | "registration";
type DocumentKind = "invoice" | "receipt" | MigrationKind;
type PaymentDocument = { id: number; kind: DocumentKind; file_name: string; byte_size: number; created_at: string };
const text = (lang: Lang, ru: string, en: string) => lang === "ru" ? ru : en;
const documentNames: Record<DocumentKind, [string, string]> = {
  invoice: ["Квитанция", "Invoice"], receipt: ["Чек об оплате", "Payment receipt"],
  visa: ["Фото однократной визы", "Single-entry visa photo"], ticket: ["Билет на самолёт", "Flight ticket"],
  registration: ["Фото регистрации (уведомления о прибытии)", "Registration photo (arrival notification)"],
};
const migrationUploads: Record<MigrationKind, [string, string]> = {
  visa: ["Прикрепите фото однократной визы", "Attach a photo of your single-entry visa"],
  ticket: ["Прикрепите билет на самолет", "Attach your flight ticket"],
  registration: ["Прикрепите фото регистрации (уведомления о прибытии)", "Attach a photo of your registration (arrival notification)"],
};

export function PaymentDocuments({ lang, studentId, readOnly = false, category = "payment", migrationKind }: { lang: Lang; studentId?: number; readOnly?: boolean; category?: "payment" | "migration"; migrationKind?: MigrationKind }) {
  const [documents, setDocuments] = useState<PaymentDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const uploadKind = useRef<DocumentKind>(migrationKind || "visa");
  const migration = category === "migration";
  const title = text(lang, migration ? "Виза, авиабилет и регистрация" : "Квитанции и чеки", migration ? "Visa, flight ticket and registration" : "Invoices and receipts");
  const root = migration ? "/api/migration-documents" : "/api/payment-documents";
  const endpoint = studentId ? `${root}?studentId=${studentId}` : root;
  const documentUrl = (id: number, download = false) => `${root}/${id}${download ? "?download=1" : ""}`;
  const load = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch(endpoint, { credentials: "include", signal });
    if (!response.ok) throw new Error("load");
    const payload = await response.json();
    setDocuments(payload.documents || []);
  }, [endpoint]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setDocuments([]);
    setError("");
    setNotice("");
    load(controller.signal).catch(() => {
      if (!controller.signal.aborted) setError(text(lang, "Не удалось загрузить документы. Попробуйте обновить список.", "Could not load documents. Please refresh the list."));
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [load, lang]);

  async function refresh() {
    setLoading(true);
    setError("");
    try { await load(); }
    catch { setError(text(lang, "Не удалось загрузить документы.", "Could not load documents.")); }
    finally { setLoading(false); }
  }

  async function upload(file: File) {
    setError("");
    setNotice("");
    if (!/\.(pdf|jpe?g|png)$/i.test(file.name) || !file.size || file.size > 5 * 1024 * 1024) {
      setError(text(lang, "Выберите PDF, JPG или PNG размером до 5 МБ.", "Choose a PDF, JPG or PNG file up to 5 MB."));
      return;
    }
    setBusy(true);
    try {
      const kind = migration ? uploadKind.current : studentId ? "invoice" : "receipt";
      const response = await fetch(`${endpoint}${endpoint.includes("?") ? "&" : "?"}kind=${kind}`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": file.type || "application/octet-stream", "X-File-Name": encodeURIComponent(file.name) },
        body: file,
      });
      if (!response.ok) throw new Error("upload");
      setNotice(migration ? text(lang, "Документ сохранён и доступен администратору.", "The document is saved and available to the administrator.") : text(lang, studentId ? "Квитанция доступна студенту для скачивания." : "Чек сохранён и доступен администратору.", studentId ? "The student can now download the invoice." : "Your receipt is saved and available to the administrator."));
      await load();
    } catch {
      setError(text(lang, "Не удалось загрузить документ. Проверьте формат файла и соединение, затем обновите список.", "Could not upload the document. Check the file format and connection, then refresh the list."));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  const invoice = documents.find((doc) => doc.kind === "invoice");
  if (migration && !studentId) {
    const kinds: readonly MigrationKind[] = migrationKind ? [migrationKind] : ["visa", "ticket", "registration"];
    return <div className="migration-upload">
      <input ref={input} type="file" accept=".pdf,.jpg,.jpeg,.png" hidden aria-label={text(lang, ...documentNames[migrationKind || "visa"])} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} />
      {kinds.map((kind) => <button key={kind} type="button" className="outline-button" disabled={busy || loading} onClick={() => { uploadKind.current = kind; input.current?.click(); }}>{text(lang, ...migrationUploads[kind])}</button>)}
      {notice && <p className="payment-success" role="status">{notice}</p>}
      {error && <p className="login-error" role="alert">{error}</p>}
      {!loading && documents.filter((doc) => !migrationKind || doc.kind === migrationKind).map((doc) => <p className="payment-file-help" key={doc.id}>{text(lang, "Прикреплено: ", "Attached: ")}{doc.file_name}</p>)}
    </div>;
  }
  return <section className="payment-documents" aria-label={title}>
    <div className="payment-documents-heading">
      <h2>{title}</h2>
      <button type="button" className="text-button" disabled={loading || busy} onClick={() => void refresh()}>{text(lang, "Обновить список", "Refresh list")}</button>
    </div>
    <div className="payment-document-actions">
      {!migration && (invoice ? <a className="outline-button" href={documentUrl(invoice.id, true)} download>{text(lang, "Скачать квитанцию", "Download invoice")} ↓</a>
        : <button type="button" className="outline-button" disabled>{text(lang, "Скачать квитанцию", "Download invoice")} ↓</button>)}
      {!readOnly && <>
        <input ref={input} type="file" accept=".pdf,.jpg,.jpeg,.png" hidden aria-label={migration ? text(lang, "Файл визы или авиабилета", "Visa or flight ticket file") : text(lang, studentId ? "Файл квитанции" : "Файл чека об оплате", studentId ? "Invoice file" : "Payment receipt file")} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} />
        {migration ? <>
          <button type="button" className="primary-button" disabled={busy || loading} onClick={() => { uploadKind.current = "visa"; input.current?.click(); }}>{busy && uploadKind.current === "visa" ? text(lang, "Загружаем…", "Uploading…") : text(lang, "Прикрепите фото однократной визы", "Attach a photo of your single-entry visa")} ↑</button>
          <button type="button" className="outline-button" disabled={busy || loading} onClick={() => { uploadKind.current = "ticket"; input.current?.click(); }}>{busy && uploadKind.current === "ticket" ? text(lang, "Загружаем…", "Uploading…") : text(lang, "Прикрепите билет на самолет", "Attach your flight ticket")} ↑</button>
        </> : <button type="button" className="primary-button" disabled={busy || loading} onClick={() => input.current?.click()}>{busy ? text(lang, "Загружаем…", "Uploading…") : text(lang, studentId ? "Загрузить квитанцию" : "Загрузить чек об оплате", studentId ? "Upload invoice" : "Upload payment receipt")} ↑</button>}
      </>}
    </div>
    <p className="payment-file-help">{text(lang, "PDF, JPG или PNG · до 5 МБ", "PDF, JPG or PNG · up to 5 MB")}</p>
    {!migration && !loading && !invoice && <p className="payment-file-help">{text(lang, studentId ? "Прикрепите квитанцию — студент сможет скачать её в разделе «Оплата»." : "Администратор ещё не прикрепил квитанцию. После добавления здесь появится файл для скачивания.", studentId ? "Attach an invoice for the student to download in Payment." : "The administrator has not attached an invoice yet. It will be available to download here once added.")}</p>}
    {notice && <p className="payment-success" role="status">{notice}</p>}
    {error && <p className="login-error" role="alert">{error}</p>}
    {loading ? <p role="status">{text(lang, "Загружаем документы…", "Loading documents…")}</p>
      : <ul className="payment-file-list">{documents.map((doc) => <li key={doc.id}>
        <div><strong>{text(lang, ...documentNames[doc.kind])}</strong>
          <span>{doc.file_name}</span><small>{new Date(doc.created_at).toLocaleString(lang === "ru" ? "ru-RU" : "en-GB")} · {Math.max(1, Math.ceil(doc.byte_size / 1024))} {text(lang, "КБ", "KB")}</small></div>
        <div className="payment-file-links"><a href={documentUrl(doc.id)} target="_blank" rel="noopener noreferrer">{text(lang, "Просмотреть", "View")}</a><a href={documentUrl(doc.id, true)} download>{text(lang, "Скачать", "Download")}</a></div>
      </li>)}</ul>}
    {!loading && documents.length === 0 && <p className="payment-file-help">{text(lang, "Документы пока не загружены.", "No documents uploaded yet.")}</p>}
  </section>;
}

export function MigrationDocuments({ lang, studentId, kind }: { lang: Lang; studentId?: number; kind?: MigrationKind }) {
  return <PaymentDocuments lang={lang} studentId={studentId} category="migration" migrationKind={kind} readOnly={Boolean(studentId)} />;
}

export function PaymentPanel({ lang }: { lang: Lang }) {
  return <section className="page-panel payment-panel">
    <span className="eyebrow">{text(lang, "ОПЛАТА ОБУЧЕНИЯ", "TUITION PAYMENT")}</span>
    <h2>{text(lang, "Как оплатить обучение", "How to pay tuition")}</h2>
    <p className="payment-methods">{text(lang, "Оплатить можно в приложении «Сбербанк Онлайн», в банкомате или отделении банка.", "You can pay in the Sberbank Online app, at an ATM or at a bank branch.")}</p>
    <div className="payment-options">
      <div className="payment-option"><span>{text(lang, "Сразу за год", "Full year")}</span><strong>270 000 ₽</strong><p>{text(lang, "Один платёж за полный учебный год.", "One payment for the full academic year.")}</p></div>
      <div className="payment-option"><span>{text(lang, "Двумя платежами", "Two instalments")}</span><strong>2 × 135 000 ₽</strong>
        <p>{text(lang, "Первый платёж — до 10 октября.", "First payment — by 10 October.")}<br />{text(lang, "Второй платёж — до 10 февраля.", "Second payment — by 10 February.")}</p>
      </div>
    </div>
    <PaymentDocuments lang={lang} />
  </section>;
}
