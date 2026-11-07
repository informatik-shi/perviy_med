"use client";

import { MedicalDocuments } from "./services-panel";

type Lang = "ru" | "en";
const text = (lang: Lang, ru: string, en: string) => lang === "ru" ? ru : en;

export function MedicalPanel({ lang }: { lang: Lang }) {
  return <div className="migration-panels">
    <section className="page-panel" aria-label={text(lang, "Миграционный центр", "Migration centre")}>
      <h2 className="medical-centre-title">{text(lang, "Миграционный центр", "Migration centre")}</h2>
      <p className="medical-centre-title">{text(lang, "Санкт-Петербург, ул. Красного Текстильщика, д. 10–12, лит. В", "Saint Petersburg, 10–12 Krasnogo Tekstilshchika Street, building letter V")}</p>

      <h3>{text(lang, "Медицинское освидетельствование", "Medical examination")}</h3>
      <p>{text(lang, "По требованиям законодательства РФ — в течение 30 дней с даты въезда. С целью своевременной подготовки документов для многократной визы нужно пройти в ближайшие дни после приезда.", "Under Russian legislation, the examination must be completed within 30 days of entry. To prepare the documents for a multiple-entry visa in time, complete the examination within the first few days after arrival.")}</p>
      <h3>{text(lang, "Документы для прохождения", "Documents required for the examination")}</h3>
      <ul className="migration-methods">
        <li>{text(lang, "Паспорт и нотариально заверенный перевод паспорта", "Passport and a notarised translation of the passport")}</li>
        <li>{text(lang, "Миграционная карта", "Migration card")}</li>
        <li>{text(lang, "Сведения о регистрации или миграционном учёте", "Registration or migration registration details")}</li>
      </ul>
      <p>{text(lang, "При первом приезде медицинское освидетельствование можно пройти до получения регистрации.", "On your first arrival, you can undergo the medical examination before obtaining registration.")}</p>
      <MedicalDocuments lang={lang} />
      <p>{text(lang, "Получение зеленой карты по адресу ул. Красного Текстильщика 15А", "Collect your green card at 15A Krasnogo Tekstilshchika Street")}</p>
      <MedicalDocuments lang={lang} kind="green_card" />

      <h3>{text(lang, "Срок действия медицинских документов", "Validity of medical documents")}</h3>
      <p><strong>{text(lang, "1 год", "1 year")}</strong></p>
      <p>{text(lang, "Срок действия медицинского освидетельствования", "Validity period of the medical examination")}</p>
      <h3>{text(lang, "Повторное освидетельствование", "Repeat examination")}</h3>
      <p>{text(lang, "Пройти вновь не позднее даты окончания срока действия.", "Complete another examination no later than the expiry date.")}</p>
      <p>{text(lang, "Рекомендовано за месяц до окончания медицинских сертификатов.", "It is recommended to do so one month before the medical certificates expire.")}</p>
      <p>{text(lang, "Независимо от выезда из России.", "This applies regardless of whether you leave Russia.")}</p>
      <p>{text(lang, "Дактилоскопию и фотографирование проходят однократно.", "Fingerprinting and photography are completed once.")}</p>

      <h3>{text(lang, "Дактилоскопия и фотографирование", "Fingerprinting and photography")}</h3>
      <p><strong>{text(lang, "В течение 30 дней с даты въезда", "Within 30 days of entry")}</strong></p>
      <p>{text(lang, "Адрес: Санкт-Петербург, ул. Красного Текстильщика, д. 10–12, лит. В", "Address: Saint Petersburg, 10–12 Krasnogo Tekstilshchika Street, building letter V")}</p>
      <h3>{text(lang, "Документы", "Documents")}</h3>
      <ul className="migration-methods">
        <li>{text(lang, "Документ, удостоверяющий личность (паспорт): оригинал и копия страницы с персональными данными и фото", "Identity document (passport): original and a copy of the page with personal details and photo")}</li>
        <li>{text(lang, "Нотариально заверенный перевод паспорта", "A notarised translation of the passport")}</li>
        <li>{text(lang, "Справка о медицинском освидетельствовании (мед.центр передает данные самостоятельно)", "Medical examination certificate (the medical centre submits the data itself)")}</li>
      </ul>

      <h3>{text(lang, "Результат и контроль сроков", "Results and deadline monitoring")}</h3>
      <h4>{text(lang, "Подтверждение прохождения", "Confirmation of completion")}</h4>
      <p>{text(lang, "После процедур иностранный гражданин получает документ, подтверждающий дактилоскопическую регистрацию и фотографирование.", "After completing the procedures, a foreign national receives a document confirming fingerprint registration and photography.")}</p>
      <h4>{text(lang, "Последствия нарушения сроков", "Consequences of missing deadlines")}</h4>
      <p>{text(lang, "При неисполнении обязанностей может рассматриваться вопрос о сокращении срока временного пребывания в России.", "Failure to fulfil these obligations may lead to consideration of a reduction in the permitted period of temporary stay in Russia.")}</p>

      <h3>{text(lang, "Дополнительные последствия нарушений", "Additional consequences of violations")}</h3>
      <h4>{text(lang, "В предоставленном документе указаны", "The provided document lists")}</h4>
      <ul className="migration-methods">
        <li>{text(lang, "Сокращение срока временного пребывания", "A reduction in the permitted period of temporary stay")}</li>
        <li>{text(lang, "Возможное решение о нежелательности пребывания или проживания в России", "A possible decision declaring the person's stay or residence in Russia undesirable")}</li>
        <li>{text(lang, "Возможный запрет на въезд при непрохождении процедур в установленные сроки", "A possible entry ban if the procedures are not completed within the prescribed deadlines")}</li>
      </ul>
      <p>{text(lang, "Также документ связывает возможный запрет с выявлением употребления наркотических или психотропных средств, ВИЧ-инфекции либо опасных инфекционных заболеваний.", "The document also links a possible ban to the detection of narcotic or psychotropic substance use, HIV infection or dangerous infectious diseases.")}</p>

      <h3>{text(lang, "Личное обращение в центр", "Visiting the centre in person")}</h3>
      <h4>{text(lang, "Студент обращается лично", "The student must attend in person")}</h4>
      <p>{text(lang, "Ответственность за прохождение процедур лежит на иностранном студенте.", "The foreign student is responsible for completing the procedures.")}</p>
      <h4>{text(lang, "Процедура платная", "The procedure is subject to a fee")}</h4>
      <p>{text(lang, "Размер оплаты и порядок записи нужно уточнить в центре.", "Please contact the centre to confirm the fee and appointment procedure.")}</p>
    </section>

    <section className="page-panel" aria-label={text(lang, "Поликлиника университета", "University clinic")}>
      <h2>{text(lang, "Поликлиника университета", "University clinic")}</h2>
      <p>{text(lang, "Поликлиника с клинико-диагностическим центром ПСПбГМУ:", "Pavlov University outpatient clinic and clinical diagnostic centre:")}</p>
      <p>{text(lang, "Санкт-Петербург, ул. Льва Толстого, д. 6–8, корпус 5.", "Saint Petersburg, 6–8 Lva Tolstogo Street, building 5.")}</p>
      <p><a href={"https://yandex.ru/maps/?text=" + encodeURIComponent("Санкт-Петербург, ул. Льва Толстого, д. 6–8, корпус 5")} target="_blank" rel="noopener noreferrer">{text(lang, "Открыть точку на Яндекс Картах", "Open location in Yandex Maps")}</a></p>
      <h3>{text(lang, "Для посещения кабинета № 41 в поликлинике необходимо подготовить:", "To visit room 41 at the clinic, prepare:")}</h3>
      <ol className="migration-methods">
        <li>{text(lang, "Медицинские справки из Миграционного центра", "Medical certificates from the Migration Centre")}</li>
        <li>{text(lang, "Паспорт", "Passport")}</li>
        <li>{text(lang, "Миграционную карту", "Migration card")}</li>
        <li>{text(lang, "Регистрацию (по месту жительства)", "Registration at your place of residence")}</li>
        <li>{text(lang, "СНИЛС", "SNILS")}</li>
        <li>{text(lang, "Номер телефона", "Phone number")}</li>
        <li>{text(lang, "Направление из деканата (было выдано в кабинете 9а)", "Referral from the dean’s office (issued in room 9a)")}</li>
      </ol>
      <h3>{text(lang, "Первый визит:", "First visit:")}</h3>
      <ol className="migration-methods">
        <li>{text(lang, "Кабинет № 41 (2-й этаж)", "Room 41 (2nd floor)")}</li>
        <li>{text(lang, "Оплата анализов", "Pay for the tests")}</li>
      </ol>
      <h3>{text(lang, "Второй визит:", "Second visit:")}</h3>
      <ol className="migration-methods" start={3}>
        <li>{text(lang, "Сдача крови и другие анализы (утром, натощак)", "Blood sampling and other tests (in the morning, on an empty stomach)")}</li>
      </ol>
      <h3>{text(lang, "Третий визит:", "Third visit:")}</h3>
      <ol className="migration-methods" start={4}>
        <li>{text(lang, "Посещение терапевта и получение справки", "Visit the general practitioner and obtain a certificate")}</li>
        <li>{text(lang, "Предоставление справки в деканат", "Submit the certificate to the dean’s office")}</li>
      </ol>
      <MedicalDocuments lang={lang} kind="clearance" />
    </section>
  </div>;
}
