"use client";

import { MigrationDocuments } from "./payment-documents";

type Lang = "ru" | "en";
const text = (lang: Lang, ru: string, en: string) => lang === "ru" ? ru : en;

export function MigrationPanel({ lang, arrivalDate, onArrivalDateChange }: {
  lang: Lang; arrivalDate: string; onArrivalDateChange: (date: string) => void;
}) {
  return <div className="migration-panels">
    <section className="page-panel">
      <p>{text(lang, "Уведомление об оформлении электронного приглашения будет направлено на почту. После получения необходимо обратиться в консульство РФ в вашей стране для оформления визы.", "Notification that your electronic invitation has been issued will be sent by email. Once you receive it, contact the Russian consulate in your country to apply for a visa.")}</p>
      <MigrationDocuments lang={lang} kind="visa" />
      <label className="migration-arrival-field">
        {text(lang, "Укажите планируемую дату приезда", "Enter your planned arrival date")}
        <input type="date" value={arrivalDate} onInput={(event) => onArrivalDateChange(event.currentTarget.value)} />
      </label>
      <MigrationDocuments lang={lang} kind="ticket" />
      <p>{text(lang, "Уведомить ОВИР университета о прибытии в течение 2-х дней после приезда", "Notify the university’s OVIR office of your arrival within 2 days after arriving.")}</p>
      <p>{text(lang, "Предоставить бланк регистрации в течение 7 дней с даты приезда", "Provide your registration form within 7 days of your arrival date.")}</p>
      <MigrationDocuments lang={lang} kind="registration" />
      <h3>{text(lang, "При регистрации в хостеле или квартире", "When registering at a hostel or apartment")}</h3>
      <p>{text(lang, "Уточняйте у собственника квартиры или администратора хостела, каким способом он передаст данные:", "Ask the apartment owner or hostel administrator how they will submit your details:")}</p>
      <ul className="migration-methods">
        <li>{text(lang, "Самостоятельное внесение в базу данных", "Direct entry into the database")}</li>
        <li>{text(lang, "Личное обращение в МВД", "An in-person visit to the Ministry of Internal Affairs (MVD)")}</li>
        <li>{text(lang, "Подача через Госуслуги", "Submission through Gosuslugi")}</li>
      </ul>

      <h3>{text(lang, "Оформление многократной визы", "Applying for a multiple-entry visa")}</h3>
      <p><strong>{text(lang, "Подача документов за 35 дней до окончания действия визы", "Submit your documents 35 days before your visa expires")}</strong></p>
      <p>{text(lang, "Для оформления многократной визы рекомендуем избегать подачи по почте и через МФЦ: передача документов в МВД может затянуться и создать проблемы при оформлении визы.", "When applying for a multiple-entry visa, we recommend avoiding submission by post or through an MFC: forwarding the documents to the Ministry of Internal Affairs (MVD) may take longer and cause problems with your visa application.")}</p>

      <h3>{text(lang, "Комплект документов", "Required documents")}</h3>
      <ul className="migration-methods">
        <li>{text(lang, "Паспорт иностранного гражданина и копии всех страниц с визами: 2 копии", "Foreign citizen’s passport and copies of all pages containing visas: 2 copies")}</li>
        <li>{text(lang, "Миграционная карта: 2 копии", "Migration card: 2 copies")}</li>
        <li>{text(lang, "Регистрация: 2 копии", "Registration: 2 copies")}</li>
        <li>{text(lang, "Выписка из приказа о зачислении: кабинет № 8А", "Extract from the enrollment order: room No. 8A")}</li>
        <li>{text(lang, "Договор на обучение или направление по гослинии: 1 копия", "Tuition contract or government-funded study referral: 1 copy")}</li>
        <li>{text(lang, "Медицинское заключение: 1 копия", "Medical report: 1 copy")}</li>
        <li>{text(lang, "Копия дактилоскопии (зелёная карта): 1 копия", "Fingerprint registration document (green card): 1 copy")}</li>
        <li>{text(lang, "Фотографии: 2 шт. При первичной подаче: 3 шт.", "Photographs: 2. For the first application: 3.")}</li>
        <li>{text(lang, "Справка от коменданта общежития при первичной подаче", "Certificate from the dormitory superintendent for the first application")}</li>
        <li>{text(lang, "Госпошлина за миграционный учёт: 500 руб., оплата в Сбере", "State fee for migration registration: RUB 500, payable at Sber")}</li>
        <li>{text(lang, "Госпошлина за многократную визу: 6000 руб., оплата в Сбербанке", "State fee for a multiple-entry visa: RUB 6,000, payable at Sberbank")}</li>
      </ul>

      <h3>{text(lang, "Срок действия паспорта", "Passport validity")}</h3>
      <p>{text(lang, "Для учебных виз — 1,5 года (18 месяцев).", "For student visas — 1.5 years (18 months).")}</p>
      <p>{text(lang, "Срок действия паспорта не должен истекать ранее чем через 18 месяцев с даты начала действия визы.", "Your passport must not expire earlier than 18 months after the visa’s start date.")}</p>

      <h3>{text(lang, "Миграционный учёт при смене адреса", "Migration registration when changing address")}</h3>
      <p><strong>{text(lang, "Новое место пребывания", "New place of stay")}</strong></p>
      <p>{text(lang, "Иностранному студенту необходимо сделать новую регистрацию (уведомление о прибытии) в следующих основных случаях:", "An international student must obtain a new registration (arrival notification) in the following main cases:")}</p>
      <ul className="migration-methods">
        <li>{text(lang, "Переезд из общежития на съемную квартиру или из одной квартиры в другую.", "Moving from a dormitory to a rented apartment, or from one apartment to another.")}</li>
        <li>{text(lang, "Временный выезд и проживание в другом месте на территории РФ (например, заселение в гостиницу, профилакторий, больницу или временное проживание у родственников или друзей).", "Temporarily leaving and staying elsewhere in the Russian Federation (for example, at a hotel, a preventive care facility, a hospital, or temporarily with relatives or friends).")}</li>
      </ul>
      <p>{text(lang, "Миграционный учёт привязан к конкретному адресу.", "Migration registration is linked to a specific address.")}</p>
      <p><strong>{text(lang, "Обязательно сообщить в деканат о своем перемещении!!!", "You must inform the dean’s office of any change in your place of stay!")}</strong></p>
    </section>
  </div>;
}
