"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Lang = "ru" | "en";
type SnilsDocument = { id: number; kind: string; file_name: string; created_at: string };
const text = (lang: Lang, ru: string, en: string) => lang === "ru" ? ru : en;

export function ServicesDocuments({ lang, studentId, category = "services" }: { lang: Lang; studentId?: number; category?: "services" | "medical" | "green-card" | "clinic-clearance" }) {
  const [documents, setDocuments] = useState<SnilsDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const medical = category !== "services";
  const greenCard = category === "green-card";
  const clearance = category === "clinic-clearance";
  const kind = medical ? (clearance ? "clearance" : greenCard ? "green_card" : "results") : "snils";
  const root = medical ? "/api/medical-documents" : "/api/services-documents";
  const documentTitle = (documentKind: string) => documentKind === "clearance" ? text(lang, "Допуск к занятиям от терапевта", "Medical clearance for classes from a general practitioner") : documentKind === "green_card" ? text(lang, "Зеленая карта", "Green card") : medical ? text(lang, "Результаты медицинского обследования", "Medical examination results") : text(lang, "СНИЛС", "SNILS");
  const title = medical && studentId ? text(lang, "Медицинские документы", "Medical documents") : medical ? documentTitle(kind) : text(lang, "Документы СНИЛС", "SNILS documents");
  const endpoint = root + (studentId ? "?studentId=" + studentId : "");
  const load = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch(endpoint, { credentials: "include", signal });
    if (!response.ok) throw new Error("Cannot load documents");
    const files: SnilsDocument[] = (await response.json()).documents || [];
    setDocuments(studentId ? files : files.filter((doc) => doc.kind === kind));
  }, [endpoint, studentId, kind]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setDocuments([]); setError(""); setNotice("");
    load(controller.signal).catch(() => {
      if (!controller.signal.aborted) setError(medical ? text(lang, "Не удалось загрузить медицинские документы. Перезагрузите страницу.", "Could not load medical documents. Please reload the page.") : text(lang, "Не удалось загрузить данные СНИЛС. Перезагрузите страницу.", "Could not load SNILS documents. Please reload the page."));
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [load, lang, medical]);
  async function upload(file: File) {
    setError(""); setNotice("");
    try {
      if (!/\.(pdf|jpe?g|png)$/i.test(file.name) || !file.size || file.size > 5 * 1024 * 1024) {
        setError(text(lang, "Выберите PDF, JPG или PNG размером до 5 МБ.", "Choose a PDF, JPG or PNG file up to 5 MB."));
        return;
      }
      setBusy(true);
      const response = await fetch(root + "?kind=" + kind, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": file.type || "application/octet-stream", "X-File-Name": encodeURIComponent(file.name) },
        body: file,
      });
      if (!response.ok) throw new Error("Upload failed");
      await load();
      setNotice(clearance ? text(lang, "Допуск сохранён и доступен администратору.", "The medical clearance is saved and available to the administrator.") : medical ? text(lang, "Фото сохранено и доступно администратору.", "The photo is saved and available to the administrator.") : text(lang, "СНИЛС сохранён и доступен администратору.", "SNILS is saved and available to the administrator."));
    } catch {
      setError(medical ? text(lang, "Не удалось загрузить фото. Проверьте формат файла и соединение, затем перезагрузите страницу.", "Could not upload the photo. Check the file format and connection, then reload the page.") : text(lang, "Не удалось загрузить СНИЛС. Проверьте формат файла и соединение, затем перезагрузите страницу.", "Could not upload SNILS. Check the file format and connection, then reload the page."));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }
  return <section className={studentId ? "payment-documents" : "migration-upload"} aria-label={title}>
    {studentId ? <h2>{medical ? title : text(lang, "СНИЛС", "SNILS")}</h2> : <>
      <input ref={input} type="file" accept=".pdf,.jpg,.jpeg,.png" hidden aria-label={medical ? title : text(lang, "Файл СНИЛС", "SNILS file")} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} />
      <button type="button" className="outline-button" disabled={busy || loading} onClick={() => input.current?.click()}>{clearance ? documentTitle(kind) : greenCard ? text(lang, "Прикрепите фото зеленой карты", "Attach a photo of your green card") : medical ? text(lang, "Прикрепите фото с указанием даты получения результатов медицинского обследования", "Attach a photo showing the date for receiving your medical examination results") : text(lang, "Загрузить СНИЛС", "Upload SNILS")}</button>
    </>}
    {notice && <p className="payment-success" role="status">{notice}</p>}
    {error && <p className="login-error" role="alert">{error}</p>}
    {studentId ? <ul className="payment-file-list">{documents.map((doc) => <li key={doc.id}>
      <div><strong>{documentTitle(doc.kind)}</strong><span>{doc.file_name}</span><small>{new Date(doc.created_at).toLocaleString(lang === "ru" ? "ru-RU" : "en-GB")}</small></div>
      <div className="payment-file-links"><a href={root + "/" + doc.id} target="_blank" rel="noopener noreferrer">{text(lang, "Просмотреть", "View")}</a><a href={root + "/" + doc.id + "?download=1"} download>{text(lang, "Скачать", "Download")}</a></div>
    </li>)}</ul> : documents.map((doc) => <p className="payment-file-help" key={doc.id}>{text(lang, "Прикреплено: ", "Attached: ")}{doc.file_name}</p>)}
    {studentId && !loading && !documents.length && <p className="payment-file-help">{medical ? text(lang, "Фото пока не загружено.", "No photo has been uploaded yet.") : text(lang, "СНИЛС пока не загружен.", "SNILS has not been uploaded yet.")}</p>}
  </section>;
}

export function MedicalDocuments({ lang, studentId, kind = "results" }: { lang: Lang; studentId?: number; kind?: "results" | "green_card" | "clearance" }) {
  return <ServicesDocuments lang={lang} studentId={studentId} category={kind === "clearance" ? "clinic-clearance" : kind === "green_card" ? "green-card" : "medical"} />;
}

export function ServicesPanel({ lang, phone, onPhoneChange }: { lang: Lang; phone: string; onPhoneChange: (phone: string) => void }) {
  const [draft, setDraft] = useState(phone);
  useEffect(() => setDraft(phone), [phone]);
  return <div className="migration-panels"><section className="page-panel">
    <h2>{text(lang, "СНИЛС", "SNILS")}</h2>
    <p>{text(lang, "В Санкт-Петербурге оформить СНИЛС иностранному гражданину можно только в двух специализированных секторах МФЦ:", "In Saint Petersburg, foreign citizens can obtain SNILS only at two specialised MFC service locations:")}</p>
    <ul className="migration-methods">
      <li>{text(lang, "Центральный район: ул. Красного Текстильщика, д. 10–12, лит. О (7-й этаж)", "Tsentralny District: 10–12 Krasnogo Tekstilshchika Street, building letter O (7th floor)")}</li>
      <li>{text(lang, "Адмиралтейский район: Старо-Петергофский пр., д. 30, корп. 1, лит. А (на базе ПАО «Сбербанк»)", "Admiralteysky District: 30 Staro-Petergofsky Avenue, building 1, letter A (at Sberbank PJSC)")}</li>
    </ul>
    <p>{text(lang, "Что взять:", "What to bring:")}</p>
    <ul className="migration-methods">
      <li>{text(lang, "Иностранный паспорт или иной документ, удостоверяющий личность", "Your foreign passport or another identity document")}</li>
      <li>{text(lang, "Нотариально заверенный перевод паспорта на русский", "A notarised Russian translation of your passport")}</li>
    </ul>
    <p>{text(lang, "Анкету заполняют на месте. В клиентской службе СФР номер обычно выдают сразу; сейчас это электронное уведомление, а не зелёная карточка.", "The application form is completed on site. At a Social Fund (SFR) customer service office, the number is usually issued immediately; it is now an electronic notification rather than a green card.")}</p>
    <ServicesDocuments lang={lang} />

    <h3>{text(lang, "Госуслуги", "Gosuslugi")}</h3>
    <p>{text(lang, "Создайте учётную запись как иностранный гражданин, внесите паспортные данные и СНИЛС. Для подтверждения можно обратиться в МФЦ или банк. Нужны паспорт, его нотариальный перевод, СНИЛС и электронная почта; российский номер на этом этапе не обязателен.", "Create an account as a foreign citizen and enter your passport and SNILS details. You can verify it at an MFC or bank. You need your passport, its notarised translation, SNILS and an email address; a Russian phone number is not required at this stage.")}</p>

    <h3>{text(lang, "Биометрия", "Biometrics")}</h3>
    <p>{text(lang, "Биометрия необходима для оформления сим-карты, счета в банке и т.д.", "Biometrics are required to get a SIM card, open a bank account and access other services.")}</p>
    <p>{text(lang, "Нужно лично прийти в банк, который работает с Единой биометрической системой, с паспортом, нотариальным переводом и СНИЛС. Сотрудник зарегистрирует фото лица и голос. Подходящее отделение можно найти на карте Банка России.", "Visit a bank that works with the Unified Biometric System in person, bringing your passport, notarised translation and SNILS. An employee will register your facial image and voice. You can find a suitable branch on the Bank of Russia’s map.")}</p>

    <h3>{text(lang, "Номер телефона РФ", "Russian phone number")}</h3>
    <p>{text(lang, "После первых трёх шагов идите именно в салон связи выбранного оператора. Возьмите:", "After completing the first three steps, go to a retail store of your chosen mobile operator. Bring:")}</p>
    <ul className="migration-methods">
      <li>{text(lang, "Паспорт и нотариальный перевод", "Your passport and its notarised translation")}</li>
      <li>{text(lang, "СНИЛС", "SNILS")}</li>
      <li>{text(lang, "Доступ к подтверждённым Госуслугам", "Access to your verified Gosuslugi account")}</li>
      <li>{text(lang, "Телефон с IMEI — его обычно показывают командой *#06#.", "Your phone and its IMEI — it is usually displayed by dialling *#06#.")}</li>
    </ul>
    <p>{text(lang, "Оператор проверит Госуслуги и биометрию, внесёт IMEI в договор и выдаст SIM карту.", "The operator will check your Gosuslugi account and biometrics, record the IMEI in your contract and issue a SIM card.")}</p>
    <label className="migration-arrival-field">
      {text(lang, "Номер телефона РФ", "Russian phone number")}
      <input type="tel" inputMode="tel" autoComplete="tel" maxLength={32} value={draft} onInput={(event) => setDraft(event.currentTarget.value)} onBlur={() => { if (draft !== phone) onPhoneChange(draft); }} />
    </label>
  </section></div>;
}
