type Lang = "ru" | "en";
const text = (lang: Lang, ru: string, en: string) => lang === "ru" ? ru : en;

export function DeanPanel({ lang }: { lang: Lang }) {
  return <div className="migration-panels">
    <section className="page-panel" aria-label={text(lang, "Адрес", "Address")}>
      <h2>{text(lang, "Адрес", "Address")}</h2>
      <p>{text(lang, "Санкт-Петербург, ул. Льва Толстого, 6/8, корпус 1, 1-й этаж", "Saint Petersburg, 6/8 Lva Tolstogo Street, building 1, 1st floor")}</p>
      <p><a href="tel:+78123386058">+7 (812) 338 60 58</a></p>
      <p>{text(lang, "Часы работы: понедельник — пятница с 11 до 16 ч (перерыв с 13 до 14 ч)", "Opening hours: Monday–Friday, 11:00–16:00 (break: 13:00–14:00)")}</p>
    </section>

    <section className="page-panel" aria-label={text(lang, "Деканат подготовительного отделения", "Preparatory department dean’s office")}>
      <h2>{text(lang, "Деканат подготовительного отделения — кабинет 9", "Preparatory department dean’s office — room 9")}</h2>
      <h3>{text(lang, "Кононова Марина Юрьевна", "Marina Yuryevna Kononova")}</h3>
      <p><a href="mailto:kononovamiu@gmail.com">kononovamiu@gmail.com</a></p>
      <p><a href="https://vk.ru/club230139798" target="_blank" rel="noopener noreferrer">https://vk.ru/club230139798</a></p>
      <h3>{text(lang, "Кошиц Ирина Васильевна", "Irina Vasilyevna Koshits")}</h3>
      <p><a href="mailto:ivkoshits@yandex.ru">ivkoshits@yandex.ru</a></p>
    </section>

    <section className="page-panel" aria-label={text(lang, "По вопросам общежития", "Dormitory enquiries")}>
      <h2>{text(lang, "По вопросам общежития", "Dormitory enquiries")}</h2>
      <p>{text(lang, "Фариброз Фоадович (кабинет 9а)", "Faribroz Foadovich (room 9a)")}</p>
    </section>

    <section className="page-panel" aria-label={text(lang, "ОВИР (отдел виз и регистрации)", "OVIR (Visa and Registration Department)")}>
      <h2>{text(lang, "ОВИР (отдел виз и регистрации)", "OVIR (Visa and Registration Department)")}</h2>
      <p>{text(lang, "Кабинет 6", "Room 6")}</p>
      <h3>{text(lang, "Ветрова Ольга Александровна", "Olga Alexandrovna Vetrova")}</h3>
      <p><a href="tel:+78123386779">+7 (812) 338 67 79</a></p>
    </section>

    <section className="page-panel" aria-label={text(lang, "Оформление страхового полиса", "Insurance policy registration")}>
      <h2>{text(lang, "Оформление страхового полиса", "Insurance policy registration")}</h2>
      <p>{text(lang, "Кабинет 1", "Room 1")}</p>
    </section>
  </div>;
}
