"use client";

import { useEffect, useState } from "react";

type TrackKey = "onsite" | "distance";
type Role = "student" | "admin";
type Student = { name: string; id: string; country: string; track: TrackKey; login?: string; password?: string; progress?: Array<{ track: TrackKey; step_index: number; completed: number | boolean }> };
type AuthUser = { id: number; login: string; role: Role; name: string; country: string | null; studentId: string | null; track: TrackKey | null };

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

const initialStudents: Student[] = [
  { name: "Амира Нур", id: "SPB-24018", country: "Египет", track: "onsite" },
  { name: "Мигель Сантос", id: "SPB-24012", country: "Бразилия", track: "onsite" },
  { name: "Ирина Даниленко", id: "SPB-24007", country: "Узбекистан", track: "onsite" },
];

const demoAdminProgress: Record<string, boolean[]> = {
  "Мигель Сантос": [true, true, true, false, false, false, false],
  "Ирина Даниленко": [true, false, false, false, false, false, false],
};

function initials(name: string) {
  return name.split(" ").map((part) => part[0]).join("").slice(0, 2);
}

function LoginScreen({ onLogin, error, busy }: { onLogin: (login: string, password: string) => Promise<void>; error: string; busy: boolean }) {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  return <main className="login-page"><div className="login-aside"><div className="brand-lockup"><div className="brand-mark">П</div><div><strong>ПСПбГМУ</strong><span>Подготовительное отделение</span></div></div><div className="login-aside-copy"><span className="eyebrow">ЛИЧНЫЙ КАБИНЕТ · 2026</span><h1>Ваш маршрут<br />к зачислению.</h1><p>Единое пространство для студентов и приёмной комиссии.</p><div className="login-aside-line"><span>01</span><span>Отмечайте этапы</span><span>02</span><span>Следите за статусом</span></div></div></div><div className="login-main"><div className="login-card"><span className="eyebrow">ВХОД В СИСТЕМУ</span><h2>Добро пожаловать</h2><p className="login-lead">Введите логин и пароль, чтобы продолжить.</p><form onSubmit={(event) => { event.preventDefault(); void onLogin(login, password); }}><label className="login-label">Логин<input autoComplete="username" value={login} onChange={(event) => setLogin(event.target.value)} placeholder="Введите логин" required /></label><label className="login-label">Пароль<input autoComplete="current-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Введите пароль" required /></label>{error && <div className="login-error">{error}</div>}<button className="primary-button login-submit" disabled={busy}>{busy ? "Проверяем…" : "Войти"}<span>→</span></button></form><div className="login-security"><span>⌁</span><p>Доступ защищён сессионной cookie.<br />Регистрацию студентов выполняет администратор.</p></div></div></div></main>;
}

function AdminDashboard({ track, completed, students, onTrackChange, onExport, onRegister }: { track: TrackKey; completed: Record<TrackKey, boolean[]>; students: Student[]; onTrackChange: (track: TrackKey) => void; onExport: () => void; onRegister: (student: Student) => void }) {
  const [registerOpen, setRegisterOpen] = useState(false);
  const [form, setForm] = useState({ name: "", id: "", country: "", login: "", password: "", track });
  const steps = tracks[track].steps;
  const rows = students.filter((student) => student.track === track).map((student) => ({
    ...student,
    statuses: student.progress ? steps.map((_, index) => Boolean(student.progress?.some((item) => item.track === track && item.step_index === index && Boolean(item.completed)))) : student.name === "Амира Нур" ? completed[track] : demoAdminProgress[student.name] || steps.map(() => false),
  }));
  const totalDone = rows.reduce((sum, row) => sum + row.statuses.filter(Boolean).length, 0);
  const totalSteps = rows.length * steps.length;
  const reviewCount = rows.filter((row) => row.statuses[2]).length;

  return (
    <div className="admin-content">
      <section className="admin-hero">
        <div><p className="kicker">Панель приёмной комиссии · 2026</p><h1>Контроль маршрутов</h1><p className="hero-copy">Следите, какие этапы уже прошли студенты. Изменения из личного кабинета появляются здесь автоматически.</p></div>
        <div className="admin-actions"><button className="outline-button" onClick={() => { setForm({ name: "", id: "", country: "", login: "", password: "", track }); setRegisterOpen(true); }}><span>＋</span> Зарегистрировать студента</button><button className="primary-button export-button" onClick={onExport}><span>⇩</span> Скачать для Excel</button></div>
      </section>

      <div className="admin-toolbar"><div className="admin-track-tabs"><button className={track === "onsite" ? "selected" : ""} onClick={() => onTrackChange("onsite")}>Очный трек</button><button className={track === "distance" ? "selected" : ""} onClick={() => onTrackChange("distance")}>Дистанционный трек</button></div><span className="sync-status"><i /> Синхронизировано с личными кабинетами</span></div>

      <section className="admin-summary-grid"><div className="admin-stat panel"><span className="eyebrow">СТУДЕНТЫ В ТРЕКЕ</span><strong>{rows.length}</strong><small>активных профиля</small></div><div className="admin-stat panel"><span className="eyebrow">ВЫПОЛНЕНО</span><strong>{totalDone}<em>/{totalSteps}</em></strong><small>этапов отмечено</small></div><div className="admin-stat panel"><span className="eyebrow">НА ПРОВЕРКЕ</span><strong>{reviewCount}</strong><small>студента дошли до проверки</small></div><div className="admin-stat accent panel"><span className="eyebrow">ПОСЛЕДНЕЕ ОБНОВЛЕНИЕ</span><strong>сейчас</strong><small>данные из прототипа</small></div></section>

      <section className="admin-table-card panel"><div className="section-heading compact"><div><span className="eyebrow">ТАБЛИЦА ПРОГРЕССА</span><h2>Статусы студентов</h2></div><span className="table-note"><i /> Галочка = этап пройден</span></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Студент</th><th>Формат</th>{steps.map((step, index) => <th key={step.title} title={step.title}>Шаг {index + 1}</th>)}<th>Прогресс</th><th>Статус</th></tr></thead><tbody>{rows.map((row) => { const done = row.statuses.filter(Boolean).length; const percent = Math.round(done / steps.length * 100); const next = row.statuses.findIndex((item) => !item); return <tr key={row.id}><td><div className="student-cell"><div className="avatar table-avatar">{initials(row.name)}</div><div><strong>{row.name}</strong><small>{row.id} · {row.country}</small></div></div></td><td><span className="format-cell">{track === "onsite" ? "Очный" : "Дистанционный"}</span></td>{row.statuses.map((status, index) => <td key={`${row.id}-${index}`}><span className={`table-check ${status ? "checked" : ""}`}>{status ? "✓" : "—"}</span></td>)}<td><div className="table-progress"><div><span style={{ width: `${percent}%` }} /></div><strong>{percent}%</strong></div></td><td><span className={`row-status ${next === -1 ? "complete" : next === 2 ? "review" : "in-progress"}`}>{next === -1 ? "Готов" : next === 2 ? "Проверка" : "В работе"}</span></td></tr>; })}</tbody></table></div><div className="admin-table-footer"><span>Нажмите «Скачать для Excel», чтобы открыть сводку в Excel</span><span>{rows.length} студента · {steps.length} этапов</span></div></section>

      <section className="admin-info"><div className="notice-icon">i</div><div><strong>Доступ разделён по ролям</strong><p>Студент видит только свой личный профиль. Регистрацию и просмотр сводной таблицы выполняет администратор; в реальном проекте доступ защищается учётной записью и сервером.</p></div></section>
      {registerOpen && <div className="modal-backdrop" role="presentation" onClick={() => setRegisterOpen(false)}><div className="guide-modal register-modal" role="dialog" aria-modal="true" aria-labelledby="register-title" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setRegisterOpen(false)} aria-label="Закрыть">×</button><span className="eyebrow">ТОЛЬКО ДЛЯ АДМИНИСТРАТОРА</span><h2 id="register-title">Регистрация студента</h2><p>Создайте личный профиль, после чего студент сможет войти и отмечать свои этапы.</p><div className="register-form"><label>ФИО<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Например, Амира Нур" /></label><label>ID абитуриента<input value={form.id} onChange={(event) => setForm({ ...form, id: event.target.value })} placeholder="SPB-24021" /></label><label>Страна<input value={form.country} onChange={(event) => setForm({ ...form, country: event.target.value })} placeholder="Египет" /></label><label>Логин студента<input value={form.login} onChange={(event) => setForm({ ...form, login: event.target.value })} placeholder="amira.nur" /></label><label>Временный пароль<input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="Задайте пароль" /></label><label>Формат<select value={form.track} onChange={(event) => setForm({ ...form, track: event.target.value as TrackKey })}><option value="onsite">Очный · с въездом в РФ</option><option value="distance">Дистанционный</option></select></label></div><button className="primary-button" disabled={!form.name || !form.id || !form.country || !form.login || !form.password} onClick={() => { onRegister(form); setRegisterOpen(false); }}>Создать личный профиль</button></div></div>}
    </div>
  );
}

export default function Home() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const role: Role = authUser?.role ?? "student";
  const [track, setTrack] = useState<TrackKey>("onsite");
  const [students, setStudents] = useState<Student[]>(initialStudents);
  const [completed, setCompleted] = useState<Record<TrackKey, boolean[]>>({
    onsite: [true, true, false, false, false, false, false],
    distance: [true, false, false, false, false],
  });
  const [guideOpen, setGuideOpen] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" }).then(async (response) => {
      if (response.ok) {
        const payload = await response.json() as { user: AuthUser };
        setAuthUser(payload.user);
        if (payload.user.track) setTrack(payload.user.track);
      }
    }).catch(() => setAuthError("Сервер авторизации недоступен")).finally(() => setAuthChecked(true));
  }, []);

  async function handleLogin(login: string, password: string) {
    setAuthBusy(true);
    setAuthError("");
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ login, password }) });
      const payload = await response.json() as { user?: AuthUser; error?: string };
      if (!response.ok || !payload.user) throw new Error(payload.error || "Не удалось войти");
      setAuthUser(payload.user);
      if (payload.user.track) setTrack(payload.user.track);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Не удалось войти");
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setAuthUser(null);
    setAuthError("");
  }

  useEffect(() => {
    if (!authUser || authUser.role !== "student") return;
    fetch(`/api/progress?track=${track}`, { credentials: "include" }).then(async (response) => {
      if (!response.ok) return;
      const payload = await response.json() as { progress: Array<{ step_index: number; completed: number }> };
      const next = { onsite: tracks.onsite.steps.map(() => false), distance: tracks.distance.steps.map(() => false) };
      for (const row of payload.progress) if (row.step_index < next[track].length) next[track][row.step_index] = Boolean(row.completed);
      setCompleted(next);
    }).catch(() => setToast("Не удалось загрузить прогресс"));
  }, [authUser, track]);

  useEffect(() => {
    if (!authUser || authUser.role !== "admin") return;
    fetch(`/api/students?track=${track}`, { credentials: "include" }).then(async (response) => {
      if (!response.ok) return;
      const payload = await response.json() as { students: Array<{ id: number; login: string; full_name: string; country: string; student_id: string; track: TrackKey; progress: Array<{ track: TrackKey; step_index: number; completed: number }> }> };
      setStudents(payload.students.map((student) => ({ name: student.full_name, id: student.student_id, country: student.country, track: student.track, login: student.login, progress: student.progress })));
    }).catch(() => setToast("Не удалось загрузить студентов"));
  }, [authUser, track]);

  if (!authChecked) return <main className="login-page login-loading"><div className="login-spinner" /><span>Проверяем сессию…</span></main>;
  if (!authUser) return <LoginScreen onLogin={handleLogin} error={authError} busy={authBusy} />;

  const activeTrack = tracks[track];
  const activeCompleted = completed[track];
  const completedCount = activeCompleted.filter(Boolean).length;
  const progress = Math.round((completedCount / activeTrack.steps.length) * 100);
  const nextIndex = activeCompleted.findIndex((item) => !item);

  const currentStatus = nextIndex === -1 ? "Маршрут завершён" : nextIndex === 2 ? "Проверка документов" : "В работе";

  function toggleStep(index: number) {
    const nextValue = !activeCompleted[index];
    setCompleted((current) => {
      const next = { ...current, [track]: [...current[track]] };
      next[track][index] = nextValue;
      return next;
    });
    void fetch("/api/progress", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ track, stepIndex: index, completed: nextValue }) }).then((response) => { if (!response.ok) setToast("Не удалось сохранить этап"); });
    setToast(activeCompleted[index] ? "Этап снова отмечен как незавершённый" : "Этап отмечен как пройденный");
    window.setTimeout(() => setToast(""), 2200);
  }

  function downloadCsv() {
    const steps = tracks[track].steps;
    const headers = ["Студент", "ID", "Страна", "Формат", ...steps.map((step, index) => `Шаг ${index + 1}: ${step.title}`), "Прогресс"];
    const rows = students.filter((student) => student.track === track).map((student) => {
      const statuses = student.progress ? steps.map((_, index) => Boolean(student.progress?.some((item) => item.track === track && item.step_index === index && Boolean(item.completed)))) : steps.map(() => false);
      return [student.name, student.id, student.country, track === "onsite" ? "Очный" : "Дистанционный", ...statuses.map((status) => status ? "Пройден" : "Не пройден"), `${Math.round(statuses.filter(Boolean).length / steps.length * 100)}%`];
    });
    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(";")).join("\r\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `progress-${track}-2026.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setToast("Excel-таблица подготовлена к скачиванию");
    window.setTimeout(() => setToast(""), 2600);
  }

  async function registerStudent(student: Student) {
    const response = await fetch("/api/students", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ name: student.name, studentId: student.id, country: student.country, track: student.track, login: student.login, password: student.password }) });
    const payload = await response.json() as { id?: number; error?: string };
    if (!response.ok) { setToast(payload.error || "Не удалось зарегистрировать студента"); window.setTimeout(() => setToast(""), 2600); return; }
    setStudents((current) => [...current, student]);
    setToast(`Профиль ${student.name} зарегистрирован`);
    window.setTimeout(() => setToast(""), 2600);
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
          <div className="top-actions"><span className="role-badge">{role === "admin" ? "Администратор" : "Личный кабинет"}</span><button className="icon-button" aria-label="Уведомления">♧<span className="alert-dot" /></button><div className="top-profile"><div className="avatar">{role === "admin" ? "ПК" : initials(authUser.name)}</div><div><strong>{authUser.name}</strong><span>{authUser.login}</span></div><button className="logout-button" onClick={() => void handleLogout()}>Выйти</button></div></div>
        </header>

        {role === "student" ? <div className="content">
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
        </div> : <AdminDashboard track={track} completed={completed} students={students} onTrackChange={setTrack} onExport={downloadCsv} onRegister={registerStudent} />}
      </section>

      {guideOpen && <div className="modal-backdrop" role="presentation" onClick={() => setGuideOpen(false)}><div className="guide-modal" role="dialog" aria-modal="true" aria-labelledby="guide-title" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setGuideOpen(false)} aria-label="Закрыть">×</button><span className="eyebrow">КОРОТКАЯ ИНСТРУКЦИЯ</span><h2 id="guide-title">Как пройти маршрут</h2><p>Сначала создайте личный кабинет и загрузите обязательные документы. После проверки приёмной комиссией сформируйте заявления, подпишите их и верните сканы через сообщения кабинета.</p><div className="guide-list"><div><b>01</b><span>Загрузите только читаемые PDF-сканы</span></div><div><b>02</b><span>Следите за сообщениями приёмной комиссии</span></div><div><b>03</b><span>Отмечайте каждый пройденный этап в этом кабинете</span></div></div><button className="primary-button" onClick={() => setGuideOpen(false)}>Понятно, продолжить</button></div></div>}
      {toast && <div className="toast"><span>✓</span>{toast}</div>}
    </main>
  );
}
