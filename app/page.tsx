"use client";

import { useEffect, useMemo, useState } from "react";

type TrackKey = "onsite" | "distance";

type Step = {
  title: string;
  description: string;
  date?: string;
  detail?: string;
};

const tracks: Record<TrackKey, { eyebrow: string; title: string; cost: string; places: string; steps: Step[] }> = {
  onsite: {
    eyebrow: "ОСНОВНОЙ МАРШРУТ",
    title: "Очное отделение · с въездом в РФ",
    cost: "270 000 ₽",
    places: "120 контрактных мест · 20 мест гослинии",
    steps: [
      { title: "Создать личный кабинет", description: "Зарегистрироваться на официальном сайте и подтвердить email.", date: "с 1 июня", detail: "Личный кабинет создан" },
      { title: "Заполнить анкету и загрузить документы", description: "Загрузить PDF-сканы паспорта, документа об образовании и медсправки.", date: "до 29 июля", detail: "Сканы должны быть читаемыми; фотографии с телефона не принимаются" },
      { title: "Пройти проверку приёмной комиссии", description: "Дождаться проверки полного комплекта документов в личном кабинете.", date: "обычно 3–5 дней", detail: "После проверки появится кнопка «Сформировать заявление»" },
      { title: "Сформировать и подписать заявления", description: "Скачать, подписать и вернуть сканы заявлений, согласия, анкеты, договора и приглашения.", date: "после проверки", detail: "Для очного трека — 5 заявлений, договор и согласие" },
      { title: "Участвовать в конкурсном отборе", description: "Проверить свой рейтинг и дождаться публикации конкурсных списков.", date: "6 августа", detail: "Рейтинг: химия + биология + физика + средний балл + индивидуальные достижения" },
      { title: "Получить приказ о зачислении", description: "Проверить приказ в личном кабинете после прохождения конкурса.", date: "7 августа", detail: "Вторая волна — до заполнения 100% мест" },
      { title: "Оформить приглашение и приехать", description: "После приказа получить приглашение, оформить визу и явиться в деканат.", date: "до 40 дней после приказа", detail: "После приезда регистрация в ОВиР обязательна в течение 3 суток" },
    ],
  },
  distance: {
    eyebrow: "ГИБКИЙ ФОРМАТ",
    title: "Дистанционное отделение",
    cost: "140 000 ₽",
    places: "Зачисление после полной оплаты обучения",
    steps: [
      { title: "Создать личный кабинет", description: "Зарегистрироваться на официальном сайте и подтвердить email.", date: "с 1 октября", detail: "Онлайн-регистрация обязательна" },
      { title: "Заполнить анкету и загрузить документы", description: "Загрузить PDF-сканы паспорта, документа об образовании и подписанных форм.", date: "до 30 ноября", detail: "Паспорт и образование — с нотариально заверенным переводом" },
      { title: "Пройти проверку приёмной комиссии", description: "Дождаться проверки полного комплекта документов в личном кабинете.", date: "после отправки", detail: "В конкурсе участвуют только кандидаты с полным комплектом" },
      { title: "Подписать договор и оплатить обучение", description: "Сформировать документы в кабинете, подписать договор и внести полную оплату.", date: "до 30 ноября", detail: "Зачисление на дистанционный трек — после оплаты" },
      { title: "Получить приказ о зачислении", description: "Проверить приказ и данные для старта обучения в личном кабинете.", date: "30 ноября", detail: "Дальше кабинет остаётся точкой связи с отделением" },
    ],
  },
};

const schedule = [
  ["01 июн", "Старт приёма документов", "done"],
  ["08 июл", "Конец 1 этапа", "done"],
  ["15 июл", "Конкурсные списки", "done"],
  ["16 июл", "Приказ · 60% мест", "done"],
  ["17 июл", "Старт 2 этапа", "done"],
  ["29 июл", "Конец 2 этапа", "done"],
  ["06 авг", "Конкурсные списки 2 этапа", "done"],
  ["07 авг", "Приказ · 100% мест", "done"],
];

function initials(name: string) {
  return name.split(" ").map((part) => part[0]).join("").slice(0, 2);
}

export default function Home() {
  const [track, setTrack] = useState<TrackKey>("onsite");
  const [completed, setCompleted] = useState<Record<TrackKey, boolean[]>>({
    onsite: [true, true, false, false, false, false, false],
    distance: [true, false, false, false, false],
  });
  const [guideOpen, setGuideOpen] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    const stored = window.localStorage.getItem("spbgmu-route-progress");
    if (stored) {
      try { setCompleted(JSON.parse(stored)); } catch { /* use the sample progress */ }
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("spbgmu-route-progress", JSON.stringify(completed));
  }, [completed]);

  const activeTrack = tracks[track];
  const activeCompleted = completed[track];
  const completedCount = activeCompleted.filter(Boolean).length;
  const progress = Math.round((completedCount / activeTrack.steps.length) * 100);
  const nextIndex = activeCompleted.findIndex((item) => !item);

  const currentStatus = useMemo(() => {
    if (nextIndex === -1) return "Маршрут завершён";
    if (nextIndex === 2) return "Проверка документов";
    return "В работе";
  }, [nextIndex]);

  function toggleStep(index: number) {
    setCompleted((current) => {
      const next = { ...current, [track]: [...current[track]] };
      next[track][index] = !next[track][index];
      return next;
    });
    setToast(activeCompleted[index] ? "Этап снова отмечен как незавершённый" : "Этап отмечен как пройденный");
    window.setTimeout(() => setToast(""), 2200);
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark">П</div>
          <div><strong>ПСПбГМУ</strong><span>Поступление 2026</span></div>
        </div>
        <div className="side-label">ЛИЧНЫЙ КАБИНЕТ</div>
        <nav className="nav-list" aria-label="Основная навигация">
          <button className="nav-item"><span className="nav-icon">⌂</span> Обзор</button>
          <button className="nav-item active"><span className="nav-icon">◎</span> Мой маршрут <span className="nav-count">2</span></button>
          <button className="nav-item"><span className="nav-icon">▤</span> Документы</button>
          <button className="nav-item"><span className="nav-icon">◌</span> Сообщения <span className="nav-dot" /></button>
          <button className="nav-item"><span className="nav-icon">?</span> Справка</button>
        </nav>
        <div className="sidebar-bottom">
          <div className="side-help"><span className="help-icon">?</span><div><strong>Нужна помощь?</strong><span>Напишите приёмной комиссии</span></div></div>
          <div className="side-profile"><div className="avatar small">{initials("Амира Нур")}</div><div><strong>Амира Нур</strong><span>Абитуриент</span></div><span className="more">•••</span></div>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="breadcrumbs"><span>ПОДГОТОВИТЕЛЬНОЕ ОТДЕЛЕНИЕ</span><b>/</b><strong>МОЙ МАРШРУТ</strong></div>
          <div className="top-actions"><button className="icon-button" aria-label="Уведомления">♧<span className="alert-dot" /></button><div className="top-profile"><div className="avatar">АН</div><div><strong>Амира Нур</strong><span>Изменить профиль</span></div><span className="chevron">⌄</span></div></div>
        </header>

        <div className="content">
          <section className="hero-row">
            <div><p className="kicker">Путь абитуриента · 2026</p><h1>Маршрут к зачислению</h1><p className="hero-copy">От регистрации до первого дня в университете — отмечайте этапы, чтобы ничего не пропустить.</p></div>
            <button className="outline-button" onClick={() => setGuideOpen(true)}><span>↗</span> Открыть инструкцию</button>
          </section>

          <section className="track-switcher" aria-label="Выберите формат обучения">
            {(Object.keys(tracks) as TrackKey[]).map((key) => (
              <button key={key} className={`track-tab ${track === key ? "selected" : ""}`} onClick={() => setTrack(key)}>
                <span className="track-radio">{track === key ? "●" : "○"}</span><span><b>{key === "onsite" ? "Очное отделение" : "Дистанционное отделение"}</b><small>{key === "onsite" ? "с въездом в РФ" : "онлайн-формат"}</small></span>
              </button>
            ))}
          </section>

          <section className="stats-grid">
            <div className="progress-card panel"><div className="panel-heading"><div><span className="eyebrow">ТЕКУЩИЙ ПРОГРЕСС</span><h2>{progress}% <em>пройдено</em></h2></div><span className="progress-ring">{completedCount}<small>/{activeTrack.steps.length}</small></span></div><div className="progress-bar"><span style={{ width: `${progress}%` }} /></div><div className="progress-footer"><span>{completedCount} из {activeTrack.steps.length} этапов</span><span className="status-pill"><i /> {currentStatus}</span></div></div>
            <div className="next-card panel"><div className="eyebrow">СЛЕДУЮЩИЙ ШАГ</div><div className="next-body"><div className="step-number">{nextIndex === -1 ? "✓" : String(nextIndex + 1).padStart(2, "0")}</div><div><h3>{nextIndex === -1 ? "Все этапы пройдены" : activeTrack.steps[nextIndex].title}</h3><p>{nextIndex === -1 ? "Вы готовы к зачислению" : activeTrack.steps[nextIndex].description}</p></div></div><button className="text-button" onClick={() => nextIndex !== -1 && toggleStep(nextIndex)}>Отметить выполненным <span>→</span></button></div>
            <div className="detail-card panel"><div className="eyebrow">ВАШ ФОРМАТ</div><h3>{activeTrack.title}</h3><div className="detail-line"><span>Стоимость</span><strong>{activeTrack.cost}</strong></div><div className="detail-line"><span>Места</span><strong>{activeTrack.places}</strong></div></div>
          </section>

          <div className="lower-grid">
            <section className="route-section"><div className="section-heading"><div><span className="eyebrow">ПОШАГОВЫЙ ПЛАН</span><h2>Ваш маршрут</h2></div><span className="saved-label"><i /> Прогресс сохраняется автоматически</span></div><div className="timeline">{activeTrack.steps.map((step, index) => { const isDone = activeCompleted[index]; const isNext = index === nextIndex; return <article className={`timeline-item ${isDone ? "done" : ""} ${isNext ? "current" : ""}`} key={step.title}><div className="timeline-rail"><button className="check-button" onClick={() => toggleStep(index)} aria-label={`${isDone ? "Снять отметку" : "Отметить"}: ${step.title}`}>{isDone ? "✓" : index + 1}</button>{index < activeTrack.steps.length - 1 && <span className="rail-line" />}</div><div className="timeline-content"><div className="timeline-meta"><span className={`stage-tag ${isDone ? "complete" : isNext ? "active" : ""}`}>{isDone ? "ПРОЙДЕНО" : isNext ? "СЕЙЧАС" : "ДАЛЕЕ"}</span><span>{step.date}</span></div><h3>{step.title}</h3><p>{step.description}</p>{(isNext || isDone) && <div className="step-detail"><span>i</span>{step.detail}</div>}<button className="mark-button" onClick={() => toggleStep(index)}>{isDone ? "Вернуть в план" : "Отметить этап"}<span>→</span></button></div></article>; })}</div></section>

            <aside className="right-column"><section className="calendar-card panel"><div className="section-heading compact"><div><span className="eyebrow">КАЛЕНДАРЬ 2026</span><h2>Ключевые даты</h2></div><button className="dots" aria-label="Ещё">•••</button></div><div className="schedule-list">{(track === "onsite" ? schedule : [["01 окт", "Старт дистанционного приёма", "upcoming"], ["30 ноя", "Конец приёма и приказ", "upcoming"]]).map(([date, label, state]) => <div className="schedule-row" key={date + label}><span className={`date-badge ${state}`}>{date}</span><span>{label}</span><i className={state === "done" ? "check" : "upcoming-dot"}>{state === "done" ? "✓" : ""}</i></div>)}</div><a href="https://abit.1spbgmu.ru/dovuzovskoe-obrazovanie/podgotovitelnoe-otdelenie-dlya-inostrannih-grajdan" target="_blank" rel="noreferrer" className="card-link">Открыть полный календарь <span>↗</span></a></section>
              <section className="notice-card"><div className="notice-icon">!</div><div><h3>Важно для участия в конкурсе</h3><p>Приёмная комиссия рассматривает только полный комплект документов. Загружайте сканы в PDF — фото с телефона не принимаются.</p><button className="notice-link" onClick={() => setGuideOpen(true)}>Посмотреть список документов <span>→</span></button></div></section>
              <section className="contact-card panel"><div className="contact-avatar">МВ</div><div><span className="eyebrow">ПРИЁМНАЯ КОМИССИЯ</span><h3>Мария Кривенцова</h3><p>Ответственный секретарь</p><a href="mailto:prepspbgmu@yandex.ru">prepspbgmu@yandex.ru</a><a href="tel:+79312378086">+7 931 237-80-86 · WhatsApp</a></div></section>
            </aside>
          </div>
        </div>
      </section>

      {guideOpen && <div className="modal-backdrop" role="presentation" onClick={() => setGuideOpen(false)}><div className="guide-modal" role="dialog" aria-modal="true" aria-labelledby="guide-title" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setGuideOpen(false)} aria-label="Закрыть">×</button><span className="eyebrow">КОРОТКАЯ ИНСТРУКЦИЯ</span><h2 id="guide-title">Как пройти маршрут</h2><p>Сначала создайте личный кабинет и загрузите обязательные документы. После проверки приёмной комиссией сформируйте заявления, подпишите их и верните сканы через сообщения кабинета.</p><div className="guide-list"><div><b>01</b><span>Загрузите только читаемые PDF-сканы</span></div><div><b>02</b><span>Следите за сообщениями приёмной комиссии</span></div><div><b>03</b><span>Отмечайте каждый пройденный этап в этом кабинете</span></div></div><button className="primary-button" onClick={() => setGuideOpen(false)}>Понятно, продолжить</button></div></div>}
      {toast && <div className="toast"><span>✓</span>{toast}</div>}
    </main>
  );
}
