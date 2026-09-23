import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CalendarClock,
  Check,
  CircleCheck,
  CreditCard,
  Home,
  LogOut,
  Mic,
  MicOff,
  Pause,
  Play,
  Search,
  ShieldCheck,
  Sprout,
  Target,
  Timer,
  TreeDeciduous,
  UserRound,
  Users,
  VideoOff,
  Wallet,
} from "lucide-react";
import "./style.css";

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const error = new Error(
      typeof body.detail === "string"
        ? body.detail
        : `Ошибка сервера (${response.status}). Попробуйте ещё раз.`,
    );
    error.status = response.status;
    // Only the API's explicit missing-cookie response is a normal anonymous visit.
    // A 401 after restoration has begun must explain that the session expired.
    error.anonymous =
      path === "/api/session" &&
      response.status === 401 &&
      body.detail === "Sign in with a synthetic demo account";
    throw error;
  }
  return response.json();
}
const initials = (name) =>
  name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("");
const dateLabel = (value) =>
  value
    ? new Date(`${value}T00:00:00`).toLocaleDateString("ru-RU")
    : "Нет данных";
const statusLabels = {
  completed: "Завершено",
  in_progress: "В процессе",
  no_show: "Не посещено",
  declined: "Отклонено",
  dropped: "Прервано",
  overdue: "Просрочено",
  planned: "Запланировано",
};
const tabs = [
  ["growth", TreeDeciduous, "Дерево"],
  ["meetings", Users, "Встречи"],
  ["tests", BookOpen, "Тесты"],
  ["goals", Target, "Цели"],
  ["profile", UserRound, "Профиль"],
  ["bank", Home, "Halyk"],
];

const meetingStatusLabels = {
  scheduled: "Запланирована",
  ready: "Готова к демо",
  active: "Идёт симуляция",
  paused: "На паузе",
  ended: "Завершена",
};
const formatMeetingDate = (value) =>
  new Date(value).toLocaleString("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  });
const formatDuration = (seconds) =>
  `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
const localDateTime = () => {
  const value = new Date(Date.now() + 60 * 60 * 1000);
  value.setMinutes(value.getMinutes() - value.getTimezoneOffset());
  return value.toISOString().slice(0, 16);
};

function OneToOne({ onAuthError }) {
  const [context, setContext] = useState(null);
  const [meetings, setMeetings] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [topic, setTopic] = useState("");
  const [scheduledAt, setScheduledAt] = useState(localDateTime);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const commandKeys = useRef(new Map());
  const createRequest = useRef(null);
  const selected = meetings.find((meeting) => meeting.meeting_id === selectedId);

  function keyFor(meetingId, action) {
    const key = `${meetingId}:${action}`;
    if (!commandKeys.current.has(key))
      commandKeys.current.set(key, crypto.randomUUID());
    return commandKeys.current.get(key);
  }
  async function load() {
    setLoading(true);
    setError("");
    try {
      const [nextContext, nextMeetings] = await Promise.all([
        api("/api/one-to-ones/context"),
        api("/api/one-to-ones"),
      ]);
      setContext(nextContext);
      setMeetings(nextMeetings);
      setSelectedId((current) =>
        nextMeetings.some((meeting) => meeting.meeting_id === current)
          ? current
          : nextMeetings[0]?.meeting_id || "",
      );
    } catch (e) {
      if (e.status === 401) onAuthError(e);
      else {
        if (e.status === 409) createRequest.current = null;
        setError(e.message);
      }
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function command(action) {
    if (!selected) return;
    setSaving(true);
    setError("");
    try {
      const result = await api(
        `/api/one-to-ones/${selected.meeting_id}/commands`,
        {
          method: "POST",
          body: JSON.stringify({ action, idempotency_key: keyFor(selected.meeting_id, action) }),
        },
      );
      commandKeys.current.delete(`${selected.meeting_id}:${action}`);
      setMeetings((current) =>
        current.map((meeting) =>
          meeting.meeting_id === result.meeting_id ? result : meeting,
        ),
      );
      const refreshedContext = await api("/api/one-to-ones/context");
      setContext(refreshedContext);
    } catch (e) {
      if (e.status === 401) onAuthError(e);
      else setError(e.message);
    } finally {
      setSaving(false);
    }
  }
  useEffect(() => {
    if (!selected || selected.status !== "active") return undefined;
    const interval = window.setInterval(() => {
      command("heartbeat");
    }, context?.heartbeat_interval_seconds * 1000 || 10000);
    return () => window.clearInterval(interval);
  }, [selected?.meeting_id, selected?.status, context?.heartbeat_interval_seconds]);
  async function createMeeting(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    if (!createRequest.current) {
      createRequest.current = {
        topic,
        scheduled_at: new Date(scheduledAt).toISOString(),
        idempotency_key: crypto.randomUUID(),
      };
    }
    try {
      const created = await api("/api/one-to-ones", {
        method: "POST",
        body: JSON.stringify(createRequest.current),
      });
      createRequest.current = null;
      setMeetings((current) => [created, ...current]);
      setSelectedId(created.meeting_id);
      setTopic("");
    } catch (e) {
      if (e.status === 401) onAuthError(e);
      else setError(e.message);
    } finally {
      setSaving(false);
    }
  }
  if (loading && !context)
    return <section className="empty card" role="status">Загружаем встречи…</section>;
  return (
    <div className="one-to-one-page">
      <section className="simulation-banner">
        <VideoOff size={21} />
        <div>
          <strong>Демо-симуляция, без видеосвязи</strong>
          <p>Камера, микрофон и присутствие ниже — условные. Разговор не записывается и факт реальной встречи не подтверждается.</p>
        </div>
      </section>
      {error && (
        <div className="error-box" role="alert">
          <p>{error}</p>
          <button className="secondary-btn" onClick={load} disabled={loading}>Обновить данные</button>
        </div>
      )}
      {context?.manager ? (
        <>
          <section className="meeting-context card">
            <div>
              <p className="muted">Ваш руководитель из базы</p>
              <h1>{context.manager.full_name}</h1>
              <p>{context.manager.employee_id}</p>
            </div>
            <div className="demo-xp"><Sprout size={20} /><strong>{context.demo_xp} демо-XP</strong></div>
          </section>
          <section className="meeting-schedule card">
            <h2><CalendarClock size={20} /> Запланировать встречу</h2>
            <form onSubmit={createMeeting}>
              <label>
                Тема встречи
                <input required maxLength={240} value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Например, план развития на квартал" />
              </label>
              <label>
                Дата и время
                <input required type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} />
              </label>
              <button className="primary-btn" disabled={saving || !topic.trim()}>Сохранить встречу</button>
            </form>
          </section>
          <section className="meeting-section">
            <div className="section-heading meeting-list-heading">
              <h2>Встречи и история</h2>
              <button className="secondary-btn" onClick={load} disabled={loading}>Обновить</button>
            </div>
            {!meetings.length ? (
              <p className="empty card">Пока нет встреч. Запланируйте первую — она сохранится в вашей истории.</p>
            ) : (
              <div className="meeting-layout">
                <div className="meeting-list" aria-label="Список встреч">
                  {meetings.map((meeting) => (
                    <button key={meeting.meeting_id} className={`meeting-list-item ${selectedId === meeting.meeting_id ? "selected" : ""}`} onClick={() => setSelectedId(meeting.meeting_id)}>
                      <strong>{meeting.topic}</strong>
                      <span>{formatMeetingDate(meeting.scheduled_at)}</span>
                      <small>{meetingStatusLabels[meeting.status]} · {formatDuration(meeting.qualifying_seconds)}</small>
                    </button>
                  ))}
                </div>
                {selected && (
                  <article className="meeting-detail card">
                    <div className="meeting-detail-heading">
                      <div><span className={`status ${selected.qualified ? "completed" : ""}`}>{meetingStatusLabels[selected.status]}</span><h2>{selected.topic}</h2><p>{formatMeetingDate(selected.scheduled_at)} · {selected.manager.full_name}</p></div>
                      <div className="timer"><Timer size={19} /><strong>{formatDuration(selected.qualifying_seconds)}</strong><small>учитываемое время</small></div>
                    </div>
                    <div className="discussion-prompts">
                      <strong>Подготовка к разговору</strong>
                      <ul><li>Какой навык вы хотите развить?</li><li>Что поможет сделать следующий шаг?</li><li>Какая поддержка нужна от руководителя?</li></ul>
                    </div>
                    {selected.status === "scheduled" && <button className="primary-btn" disabled={saving} onClick={() => command("confirm_demo")}><CircleCheck size={17} /> Подтвердить уведомление для демо</button>}
                    {selected.status === "ready" && <div className="meeting-actions"><button className="primary-btn" disabled={saving} onClick={() => command("start")}><Play size={17} /> Начать симуляцию</button><button className="secondary-btn" disabled={saving} onClick={() => command("toggle_manager")}><Users size={17} />{selected.manager_present ? "Убрать тимлида" : "Вернуть тимлида"}</button><button className="secondary-btn" disabled={saving} onClick={() => command("toggle_microphone")}>{selected.simulated_microphone_on ? <MicOff size={17} /> : <Mic size={17} />}{selected.simulated_microphone_on ? "Выключить микрофон" : "Включить микрофон"}</button><button className="secondary-btn" disabled={saving} onClick={() => command("finish")}>Завершить без запуска</button></div>}
                    {(selected.status === "active" || selected.status === "paused") && <div className="meeting-actions"><button className="primary-btn" disabled={saving} onClick={() => command(selected.status === "active" ? "pause" : "resume")}>{selected.status === "active" ? <Pause size={17} /> : <Play size={17} />}{selected.status === "active" ? "Пауза" : "Продолжить"}</button><button className="secondary-btn" disabled={saving} onClick={() => command("toggle_manager")}><Users size={17} />{selected.manager_present ? "Тимлид присутствует" : "Тимлид отсутствует"}</button><button className="secondary-btn" disabled={saving} onClick={() => command("toggle_microphone")}>{selected.simulated_microphone_on ? <Mic size={17} /> : <MicOff size={17} />}{selected.simulated_microphone_on ? "Микрофон включён" : "Микрофон выключен"}</button>{selected.status === "active" && <><button className="secondary-btn" disabled={saving} onClick={() => command("fast_forward_minute")}>+1 минута</button><button className="secondary-btn" disabled={saving} onClick={() => command("fast_forward_last_second")}>До 14:59</button><button className="secondary-btn" disabled={saving} onClick={() => command("fast_forward_threshold")}>До порога 15:00</button></>}<button className="secondary-btn" disabled={saving} onClick={() => command("finish")}>Завершить</button></div>}
                    {selected.status === "ended" && <p className={selected.qualified ? "saved" : "notice"}>{selected.qualified ? <><Check size={16} /> Встреча зачтена. По 100 демо-XP начислено каждому участнику.</> : "Встреча завершена до порога 15 минут учитываемого времени. Награда не начислена."}</p>}
                    {selected.status !== "ended" && <p className="notice">Учёт идёт только пока встреча активна, тимлид присутствует и условный микрофон включён. Требуется 15 минут. Симуляция не меняет навыки или карьерную цель.</p>}
                    {selected.accelerated && <p className="simulation-mark">Время ускорено командой демо.</p>}
                    {selected.qualified && selected.status !== "ended" && <p className="saved"><Check size={16} /> Порог достигнут · по 100 демо-XP обоим участникам.</p>}
                  </article>
                )}
              </div>
            )}
          </section>
        </>
      ) : (
        <section className="empty card manager-unavailable"><Users size={34} /><h1>Встреча пока недоступна</h1><p>В официальной базе для {context?.employee?.full_name || "этого сотрудника"} не указан руководитель. Обратитесь к администратору набора данных.</p></section>
      )}
    </div>
  );
}

function Brand() {
  return (
    <div className="wordmark">
      <span className="brand-seal">h</span>Halyk
      <span className="brand-divider" />
      <span className="wordmark-sub">Мой рост</span>
    </div>
  );
}
function Tree({ decorative = false }) {
  return (
    <img
      className="tree-art"
      src="/trees/oak.png"
      width="1024"
      height="1024"
      alt={
        decorative
          ? ""
          : "Демонстрационное дерево — дуб. Размер не отражает стаж или прогресс."
      }
    />
  );
}
function Goal({ employee }) {
  return (
    <>
      <p className="muted">Моя карьерная цель</p>
      <h2>{employee.goal_label || "Карьерная цель пока не выбрана"}</h2>
      <p>
        {employee.goal_label
          ? "Цель из вашего серверного профиля."
          : "Цель отсутствует в официальном наборе. Навыки и история доступны в профиле."}
      </p>
    </>
  );
}

function Bank({ employee, navigate }) {
  return (
    <>
      <section className="bank-banner">
        <span className="pill">Демонстрационная оболочка</span>
        <h1>
          Всё важное —<br />в Halyk
        </h1>
        <p>
          Банк, покупки и возможности
          <br />в одном приложении.
        </p>
        <div className="mini-bank-card" aria-hidden="true">
          Halyk
        </div>
      </section>
      <section
        className="bank-services"
        aria-label="Банковские сервисы — недоступны"
      >
        {[
          [Wallet, "Мой банк"],
          [ArrowRight, "Переводы"],
          [CreditCard, "Платежи"],
          [CalendarDays, "Рассрочка"],
        ].map(([Icon, label]) => (
          <div key={label}>
            <Icon />
            <span>{label}</span>
            <small>Недоступно</small>
          </div>
        ))}
      </section>
      <button
        className="growth-entry"
        aria-label="Открыть Мой рост"
        onClick={() => navigate("growth")}
      >
        <span className="entry-copy">
          <h2>
            Время расти.
            <br />В своём темпе.
          </h2>
          <p>
            Ваши навыки, цели
            <br />и новые возможности.
          </p>
          <span className="primary-btn">
            Мой рост <ArrowRight size={16} />
          </span>
        </span>
        <Tree decorative />
      </button>
      <p className="bank-greeting">
        <ShieldCheck size={16} /> {employee.full_name} · {employee.employee_id}
      </p>
      <p className="notice">
        Банковские операции недоступны. Балансы и бонусы не подключены.
      </p>
    </>
  );
}
function Growth({ profile, navigate }) {
  const person = profile.employee;
  return (
    <>
      <section className="tree-hero">
        <p>{person.full_name}, это ваше место роста</p>
        <h1>Расти в своём темпе</h1>
        <div className="tree-stage">
          <Tree />
          {profile.skills.slice(0, 3).map((skill, index) => (
            <button
              className={`tree-node node-${index}`}
              key={skill.skill_id}
              onClick={() => navigate("profile")}
            >
              <span className="node-circle">
                <Sprout size={13} />
              </span>
              {skill.name} · {skill.level}/5
            </button>
          ))}
        </div>
        <div className="hero-foot">
          <span>Дерево · демонстрация</span>
          <span>XP: нет данных</span>
        </div>
      </section>
      <p className="help-text">
        Вид и размер дерева иллюстративные. Уровень дерева и XP не
        рассчитываются.
      </p>
      <button className="goal-card" onClick={() => navigate("goals")}>
        <Target />
        <span>
          <small>Моя карьерная цель</small>
          <strong>{person.goal_label || "Пока не выбрана"}</strong>
        </span>
        <ArrowRight size={18} />
      </button>
      <div className="section-heading">
        <h2>Ваш следующий шаг</h2>
      </div>
      <div className="next-steps">
        <button onClick={() => navigate("profile")}>
          <UserRound />
          <strong>Навыки и история</strong>
          <span>
            Посмотреть профиль <ArrowRight size={15} />
          </span>
        </button>
        <button onClick={() => navigate("tests")}>
          <BookOpen />
          <strong>Тесты навыков</strong>
          <span>Скоро · пока недоступны</span>
        </button>
        <button onClick={() => navigate("meetings")}>
          <Users />
          <strong>One-to-one с руководителем</strong>
          <span>Запланировать и обсудить развитие <ArrowRight size={15} /></span>
        </button>
      </div>
    </>
  );
}
function Profile({ profile }) {
  const person = profile.employee;
  return (
    <>
      <section className="profile-card">
        <div className="person">
          <span className="avatar large">{initials(person.full_name)}</span>
          <div>
            <h1>{person.full_name}</h1>
            <p>
              {person.role} · {person.grade}
            </p>
            <span className="pill">{person.employee_id}</span>
          </div>
        </div>
        <dl className="profile-grid">
          <div>
            <dt>Подразделение</dt>
            <dd>{person.department}</dd>
          </div>
          <div>
            <dt>Стаж из набора</dt>
            <dd>
              {person.tenure_months == null
                ? "Нет данных"
                : `${person.tenure_months} мес.`}
            </dd>
          </div>
          <div>
            <dt>Руководитель · ID</dt>
            <dd>{person.manager_id || "Нет данных"}</dd>
          </div>
          <div>
            <dt>Последняя оценка</dt>
            <dd>{dateLabel(person.last_review_date)}</dd>
          </div>
        </dl>
      </section>
      <section className="profile-section">
        <h2>Навыки вашей роли</h2>
        <p className="muted">Текущий уровень и требования роли · шкала 0–5</p>
        {profile.skills.length ? (
          <div className="skill-list">
            {profile.skills.map((skill) => (
              <div className="skill-row" key={skill.skill_id}>
                <div>
                  <strong>{skill.name}</strong>
                  {skill.critical && (
                    <small className="critical">Критический навык</small>
                  )}
                </div>
                <span>{skill.level} / 5</span>
                <small>
                  Требование: {skill.required_level ?? "нет данных"}
                </small>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty">Навыки пока отсутствуют.</p>
        )}
      </section>
      <section className="profile-section">
        <h2>История активностей</h2>
        <p className="muted">
          Показано {profile.history.length} из {profile.history_count} записей
        </p>
        {profile.history.length ? (
          <div className="history-list">
            {profile.history.map((item) => (
              <article key={item.record_id} className="history-row">
                <div>
                  <h3>{item.title}</h3>
                  <p>
                    {item.event_id} ·{" "}
                    {item.mandatory ? "Обязательная" : "Добровольная"}
                  </p>
                </div>
                <span
                  className={`status ${item.status === "completed" ? "completed" : ""}`}
                >
                  {statusLabels[item.status] || item.status}
                </span>
                <time dateTime={item.date}>{dateLabel(item.date)}</time>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty">История активностей пока пуста.</p>
        )}
      </section>
    </>
  );
}
function Operator({ clock, setClock, saveClock, saved, busy }) {
  return (
    <section className="operator-card">
      <ShieldCheck />
      <h1>Настройки демонстрации</h1>
      <p>Дата хранится на сервере отдельно от официального набора данных.</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          saveClock(false);
        }}
      >
        <label>
          Дата демонстрации
          <input
            type="date"
            required
            value={clock}
            onChange={(event) => setClock(event.target.value)}
          />
        </label>
        <div className="operator-actions">
          <button className="primary-btn" disabled={busy || !clock}>
            Сохранить дату
          </button>
          <button
            type="button"
            className="secondary-btn"
            disabled={busy}
            onClick={() => saveClock(true)}
          >
            Вернуть 1 октября
          </button>
        </div>
      </form>
      {saved && (
        <p role="status" className="saved">
          <Check size={16} /> Сохранено: {dateLabel(saved)}
        </p>
      )}
      <p className="muted">Дата официального набора: 01.10.2026</p>
    </section>
  );
}

function App() {
  const [actor, setActor] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [profile, setProfile] = useState(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [view, setView] = useState("bank");
  const [clock, setClock] = useState("");
  const [saved, setSaved] = useState("");
  const [ready, setReady] = useState(false);
  const content = useRef(null);
  // A request generation prevents an obsolete account/profile request from repopulating the UI.
  const generation = useRef(0);

  function clearIdentity() {
    setActor(null);
    setProfile(null);
    setClock("");
    setSaved("");
    setView("bank");
    setReady(false);
  }
  function handleError(e) {
    if (e.status === 401) {
      clearIdentity();
      setError("Сессия истекла. Войдите снова.");
    } else setError(e.message);
  }
  async function loadSession() {
    const session = await api("/api/session");
    const data = await api(
      session.actor_role === "operator"
        ? "/api/operator/clock"
        : "/api/me/profile",
    );
    return { session, data };
  }
  function applySession({ session, data }) {
    setActor(session);
    if (session.actor_role === "operator") {
      setClock(data.as_of_date);
      setProfile(null);
    } else {
      setProfile(data);
      setClock("");
    }
    setReady(true);
  }
  async function initialize() {
    const current = ++generation.current;
    setBusy(true);
    setError("");
    clearIdentity();
    try {
      const [accountResult, sessionResult] = await Promise.allSettled([
        api("/api/demo/accounts"),
        loadSession(),
      ]);
      if (current !== generation.current) return;
      if (accountResult.status === "fulfilled")
        setAccounts(accountResult.value);
      if (sessionResult.status === "fulfilled")
        applySession(sessionResult.value);
      else if (!sessionResult.reason.anonymous) throw sessionResult.reason;
      if (accountResult.status === "rejected") throw accountResult.reason;
    } catch (e) {
      if (current === generation.current) handleError(e);
    } finally {
      if (current === generation.current) setBusy(false);
    }
  }
  useEffect(() => {
    initialize();
    return () => {
      generation.current++;
    };
  }, []);
  useEffect(() => {
    document.title =
      view === "bank" ? "Halyk · Career Quest" : "Halyk · Мой рост";
  }, [view]);

  async function login(employee_id, operator = false) {
    const current = ++generation.current;
    setBusy(true);
    setError("");
    clearIdentity();
    try {
      const session = await api("/api/demo/login", {
        method: "POST",
        body: JSON.stringify({ employee_id, operator }),
      });
      if (current !== generation.current) return;
      setActor(session);
      const data = await api(
        operator ? "/api/operator/clock" : "/api/me/profile",
      );
      if (current === generation.current) applySession({ session, data });
    } catch (e) {
      if (current === generation.current) handleError(e);
    } finally {
      if (current === generation.current) setBusy(false);
    }
  }
  async function logout() {
    ++generation.current;
    setBusy(true);
    setError("");
    setSaved("");
    try {
      await api("/api/session", { method: "DELETE" });
      clearIdentity();
      setQuery("");
    } catch (e) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  }
  async function navigate(next) {
    const current = ++generation.current;
    setBusy(true);
    setError("");
    try {
      const result = await loadSession();
      if (current !== generation.current) return;
      applySession(result);
      setView(next);
      requestAnimationFrame(() => {
        content.current?.focus();
        window.scrollTo(0, 0);
      });
    } catch (e) {
      if (current === generation.current) {
        setProfile(null);
        setReady(false);
        handleError(e);
      }
    } finally {
      if (current === generation.current) setBusy(false);
    }
  }
  async function saveClock(reset) {
    setBusy(true);
    setError("");
    setSaved("");
    try {
      const result = await api(
        reset ? "/api/operator/clock/reset" : "/api/operator/clock",
        reset
          ? { method: "POST" }
          : { method: "PUT", body: JSON.stringify({ as_of_date: clock }) },
      );
      setClock(result.as_of_date);
      setSaved(result.as_of_date);
    } catch (e) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  }
  const filtered = accounts.filter((account) =>
    `${account.full_name} ${account.employee_id} ${account.role} ${account.department}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <div className="app-shell">
      <header className="topbar">
        <Brand />
        {actor && (
          <button className="logout" onClick={logout} disabled={busy}>
            <LogOut size={17} /> Выйти
          </button>
        )}
      </header>
      <main
        className={`content ${!actor ? "login-content" : ""}`}
        ref={content}
        tabIndex={-1}
        aria-busy={busy}
      >
        {error && (
          <div className="error-box" role="alert">
            <p>{error}</p>
            <button
              className="secondary-btn"
              disabled={busy}
              onClick={initialize}
            >
              Повторить загрузку
            </button>
          </div>
        )}
        {busy && (
          <p role="status" className="loading">
            Загружаем данные…
          </p>
        )}
        {!busy && !actor && (
          <section className="login-card">
            <Sprout className="login-sprout" />
            <h1>Рост начинается с вас</h1>
            <p>
              Выберите синтетическую учётную запись из официального набора
              данных.
            </p>
            <label className="search">
              <Search size={20} />
              <input
                aria-label="Поиск сотрудника"
                placeholder="Имя, ID, роль или подразделение"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <p className="result-count">
              Найдено: {filtered.length}. Показано:{" "}
              {Math.min(8, filtered.length)}. Уточните поиск.
            </p>
            <div className="account-list">
              {filtered.slice(0, 8).map((account) => (
                <button
                  key={account.employee_id}
                  className="account-row"
                  onClick={() => login(account.employee_id)}
                >
                  <span className="avatar">{initials(account.full_name)}</span>
                  <span>
                    <strong>{account.full_name}</strong>
                    <small>
                      {account.role} · {account.grade} · {account.department}
                    </small>
                    <small>{account.employee_id}</small>
                  </span>
                  <ArrowRight size={18} />
                </button>
              ))}
              {!filtered.length && (
                <p className="empty">
                  Сотрудник не найден. Попробуйте другое имя или ID.
                </p>
              )}
            </div>
            <button
              className="operator-login"
              onClick={() => login(null, true)}
            >
              <ShieldCheck size={17} /> Войти как оператор
            </button>
          </section>
        )}
        {!busy && actor && !ready && (
          <section className="empty">
            <h1>Не удалось загрузить данные</h1>
            <p>Повторите загрузку или выйдите для смены аккаунта.</p>
          </section>
        )}
        {actor && ready && actor.actor_role === "operator" && (
          <Operator
            clock={clock}
            setClock={(value) => {
              setClock(value);
              setSaved("");
            }}
            saveClock={saveClock}
            saved={saved}
            busy={busy}
          />
        )}
        {!busy && actor && ready && profile && (
          <>
            <div className="page-heading">
              <div>
                <p className="muted">
                  {profile.employee.role} · {profile.employee.grade}
                </p>
                <h2>
                  {view === "bank"
                    ? "Здравствуйте, " + profile.employee.full_name
                    : "Мой рост"}
                </h2>
              </div>
              <span className="date">
                <CalendarDays size={16} /> Демо: {dateLabel(profile.as_of_date)}
              </span>
            </div>
            {view === "bank" && (
              <Bank employee={profile.employee} navigate={navigate} />
            )}
            {view === "growth" && (
              <Growth profile={profile} navigate={navigate} />
            )}
            {view === "meetings" && <OneToOne onAuthError={handleError} />}
            {view === "profile" && <Profile profile={profile} />}
            {view === "tests" && (
              <section className="empty card">
                <BookOpen size={38} />
                <h1>Тесты навыков</h1>
                <p>
                  Прохождение и генерация тестов пока недоступны. Результаты не
                  сохраняются, XP не начисляется.
                </p>
                <button
                  className="secondary-btn"
                  onClick={() => navigate("profile")}
                >
                  Посмотреть навыки
                </button>
              </section>
            )}
            {view === "goals" && (
              <section className="card goal-detail">
                <Target size={32} />
                <Goal employee={profile.employee} />
                <p className="notice">
                  Эта страница показывает сохранённую цель. Запланировать one-to-one можно во вкладке «Встречи».
                </p>
                <button className="secondary-btn" onClick={() => navigate("meetings")}>
                  <Users size={16} /> Открыть встречи
                </button>
                <button
                  className="secondary-btn"
                  onClick={() => navigate("profile")}
                >
                  Посмотреть профиль
                </button>
              </section>
            )}
            <footer className="page-foot">
              Синтетические данные · Career Quest · набор{" "}
              {profile.dataset_version}
            </footer>
          </>
        )}
      </main>
      {actor && actor.actor_role !== "operator" && (
        <nav className="bottom-nav" aria-label="Навигация Мой рост">
          {tabs.map(([id, Icon, label]) => (
            <button
              key={id}
              aria-current={view === id ? "page" : undefined}
              disabled={busy}
              onClick={() => navigate(id)}
            >
              <Icon size={23} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);
