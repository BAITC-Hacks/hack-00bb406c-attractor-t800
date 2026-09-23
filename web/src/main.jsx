import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowDownLeft, ArrowLeft, ArrowRight, CalendarDays, ChevronDown, CircleHelp, Clock3, Compass, GraduationCap, LogOut, Search, ShieldCheck, Sparkles, UserRound, UsersRound } from 'lucide-react';
import './style.css';
import Trajectory from './Trajectory';
import Activities from './Activities';
import HrDashboard from './HrDashboard';
import ImportPanel from './ImportPanel';
import WorkGoals from './WorkGoals';
import WorkResults from './WorkResults';
import WorkScores from './WorkScores';

async function api(path, options = {}) {
  const response = await fetch(path, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(Array.isArray(body.detail) ? body.detail.map(item => item.msg).join('; ') : body.detail || `Ошибка сервера (${response.status})`); }
  return response.json();
}

function App() {
  const [workRevision, setWorkRevision] = useState(0);
  const [actor, setActor] = useState(null);
  const [path, setPath] = useState(window.location.pathname);
  function navigate(nextPath) { window.history.pushState({}, '', nextPath); setPath(nextPath); }
  useEffect(() => {
    const updatePath = () => setPath(window.location.pathname);
    window.addEventListener('popstate', updatePath);
    return () => window.removeEventListener('popstate', updatePath);
  }, []);
  const [accounts, setAccounts] = useState([]);
  const [profile, setProfile] = useState(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [clock, setClock] = useState('2026-10-01');
  const [clockSaved, setClockSaved] = useState(false);

  async function refreshProfile(session) {
    if (!session) { setProfile(null); return; }
    if (['hr', 'analyst', 'analyst_backup'].includes(session.actor_role)) { setProfile(null); return; }
    if (session.actor_role === 'operator') {
      setProfile(null);
      try { setClock((await api('/api/operator/clock')).as_of_date); } catch {}
      return;
    }
    setProfile(await api('/api/me/profile'));
  }
  async function initialize() {
    setLoading(true); setError('');
    try {
      const rows = await api('/api/demo/accounts'); setAccounts(rows);
      try { const session = await api('/api/session'); setActor(session); await refreshProfile(session); }
      catch { setActor(null); setProfile(null); }
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { initialize(); }, []);
  const filtered = useMemo(() => accounts.filter(x => `${x.full_name} ${x.employee_id} ${x.role} ${x.department}`.toLowerCase().includes(query.toLowerCase())), [accounts, query]);

  async function login(employee_id, operator = false, actor_role = null) {
    setError(''); setLoading(true);
    try { await api('/api/demo/login', { method: 'POST', body: JSON.stringify({ employee_id, operator, actor_role }) }); const session = await api('/api/session'); setActor(session); await refreshProfile(session); navigate(session.actor_role === 'hr' ? '/hr' : '/'); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }
  async function logout() {
    try { await api('/api/session', { method: 'DELETE' }); } catch {}
    setActor(null); setProfile(null); setQuery('');
  }
  async function saveClock(value) {
    setError('');
    try { const saved = value === '2026-10-01' ? await api('/api/operator/clock/reset', { method: 'POST' }) : await api('/api/operator/clock', { method: 'PUT', body: JSON.stringify({ as_of_date: value }) }); setClock(saved.as_of_date); setClockSaved(true); setTimeout(() => setClockSaved(false), 2200); }
    catch (e) { setError(e.message); }
  }

  if (loading) return <div className="splash"><div className="mark">cq</div><span>Открываем Career Quest…</span></div>;
  if (!actor) return <main className="login-wrap">
    <div className="login-head"><a className="brand" href="#"><span className="brand-icon">cq</span><span>career<span className="brand-light">quest</span></span></a><span className="demo-chip"><span className="live-dot"/>ДЕМО-СРЕДА</span></div>
    <section className="login-card"><div className="eyebrow"><Sparkles size={15}/> ВАШ СЛЕДУЮЩИЙ ШАГ</div><h1>Рост начинается<br/>с <em>вас.</em></h1><p className="login-copy">Выберите синтетическую учётную запись, чтобы открыть профиль сотрудника из официального набора.</p>
      {error && <div className="error-box">{error}</div>}
      <div className="searchbox"><Search size={18}/><input autoFocus placeholder="Имя, роль или ID сотрудника" value={query} onChange={e => setQuery(e.target.value)}/><kbd>⌘ K</kbd></div>
      <div className="account-list">{filtered.slice(0, 8).map(a => <button className="account-row" key={a.employee_id} onClick={() => login(a.employee_id)}><span className="avatar">{a.full_name.split(' ').map(s => s[0]).slice(0,2).join('')}</span><span className="account-info"><b>{a.full_name}</b><small>{a.role} <i>·</i> {a.grade} <i>·</i> {a.department}</small></span><span className="account-id">{a.employee_id}</span><ArrowRight size={17}/></button>)}{filtered.length === 0 && <div className="no-results">Сотрудник не найден</div>}</div>
      <button className="hr-login-button" onClick={() => login(null, false, 'hr')}><UsersRound size={17}/> Войти как HR — развитие компании <ArrowRight size={17}/></button>
      <button className="hr-login-button" onClick={() => login(null, false, 'analyst')}>Войти как аналитик — подтверждение результатов</button>
      <button className="link-button" onClick={() => login(null, false, 'analyst_backup')}>Резервный аналитик</button>
      <div className="login-footer"><span><ShieldCheck size={15}/> Только синтетические данные</span><button onClick={() => login(null, true)}><UserRound size={15}/> Войти как оператор</button></div>
    </section><div className="login-note">ОФИЦИАЛЬНЫЙ СРЕЗ ДАННЫХ <b>·</b> 01 ОКТЯБРЯ 2026</div>
  </main>;

  if (path.startsWith('/hr') && actor.actor_role !== 'hr') return <main className="operator-page"><section className="operator-card"><h1>Сводка доступна только HR</h1><p>Текущая учётная запись не имеет доступа к развитию компании.</p><button className="primary-button" onClick={() => navigate('/')}>Вернуться в своё пространство</button><button className="link-button" onClick={logout}>Сменить учётную запись</button></section></main>;
  if (['analyst', 'analyst_backup'].includes(actor.actor_role)) return <WorkResults api={api} actor={actor} onLogout={logout}/>;
  if (actor.actor_role === 'hr') return <><HrDashboard api={api} onLogout={logout}/><WorkScores api={api}/></>;

  if (actor.actor_role === 'operator') return <main className="operator-page"><header className="topbar"><a className="brand" href="#"><span className="brand-icon">cq</span><span>career<span className="brand-light">quest</span></span></a><span className="operator-label"><ShieldCheck size={15}/> Оператор</span><button className="plain-button" onClick={logout}>Выйти <LogOut size={16}/></button></header><section className="operator-card"><div className="eyebrow">ДЕМО-КОНТУР</div><h1>Настройки демонстрации</h1><p>Время сценария хранится на сервере отдельно от официального набора. Изменение не затрагивает системные часы и исходные данные.</p><label className="clock-label">ДАТА ДЕМО-СРЕЗА<input type="date" value={clock} onChange={e => setClock(e.target.value)}/></label><div className="operator-actions"><button className="primary-button" onClick={() => saveClock(clock)}>Сохранить дату</button><button className="secondary-button" onClick={() => saveClock('2026-10-01')}>Вернуть 1 октября</button>{clockSaved && <span className="saved">Сохранено</span>}</div><div className="dataset-note"><CalendarDays size={17}/> Дата официального набора: <b>2026-10-01</b></div><button className="link-button" onClick={logout}><ArrowLeft size={16}/> К выбору аккаунта</button></section><ImportPanel api={api} onChange={async () => setAccounts(await api('/api/demo/accounts'))}/></main>;

  if (!profile) return null;
  const person = profile.employee;
  const completed = profile.history.filter(h => h.status === 'completed').length;
  return <div className="app-shell"><aside className="sidebar"><a className="brand" href="#"><span className="brand-icon">cq</span><span>career<span className="brand-light">quest</span></span></a><div className="nav-section">РАБОЧЕЕ ПРОСТРАНСТВО</div><button className="nav-item active"><Compass size={17}/> Мой рост</button><button className="nav-item muted" title="Откроется в следующих разделах"><UsersRound size={17}/> Моя команда</button><div className="sidebar-bottom"><div className="privacy-card"><ShieldCheck size={16}/><span>Ваши данные<br/><b>защищены</b></span></div><span className="build-label">Career Quest · набор 1.0</span></div></aside>
    <main className="main-area"><header className="topbar"><button className="mobile-brand"><span className="brand-icon">cq</span> careerquest</button><div className="crumb">Мой рост <span>/</span> Обзор</div><div className="top-actions"><span className="date-pill"><CalendarDays size={15}/> {new Date(`${profile.as_of_date}T00:00:00`).toLocaleDateString('ru-RU',{day:'numeric',month:'short',year:'numeric'})}</span><button className="user-menu" onClick={logout}><span className="user-mini">{person.full_name.split(' ').map(s=>s[0]).slice(0,2).join('')}</span><span>{person.full_name}</span><ChevronDown size={15}/></button></div></header>
      <div className="content"><section className="welcome-row"><div><div className="eyebrow"><span className="green-mark"/> ВАШ ПРОФИЛЬ · {person.employee_id}</div><h1>Здравствуйте, {person.full_name.split(' ')[0]}</h1><p className="subheading">Здесь собран ваш карьерный путь и история развития.</p></div><div className="profile-badge"><span className="avatar large">{person.full_name.split(' ').map(s=>s[0]).slice(0,2).join('')}</span><span><b>{person.role}</b><small>{person.grade} · {person.department}</small></span></div></section>
        {error && <div className="error-box">{error}</div>}
        <section className="hero-panel"><div className="hero-copy"><div className="hero-kicker"><Sparkles size={15}/> КАРЬЕРНАЯ ТРАЕКТОРИЯ</div><h2>{person.career_goal ? <>Шаг за шагом<br/>к новой <em>роли.</em></> : <>Ваш путь<br/>в <em>развитии.</em></>}</h2><p>{person.career_goal ? <>Цель: <b>{profile.employee.goal_label}</b>. Посмотрите, какие навыки помогут приблизиться к ней.</> : <>Карьерная цель пока не выбрана. Профиль и фактическая история уже здесь — следующий шаг можно определить позже.</>}</p><a className="hero-link" href="#skills">Посмотреть навыки <ArrowRight size={17}/></a></div><div className="hero-art"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="orbit orbit-three"/><div className="route-dot dot-a"/><div className="route-dot dot-b"/><div className="route-dot dot-c"/><div className="route-dot dot-d"/><div className="hero-center"><Compass size={42} strokeWidth={1.2}/></div><div className="art-label label-top">ВАШ МАРШРУТ</div><div className="art-label label-bottom">ОДИН ШАГ ЗА РАЗ</div></div></section>
        <section className="metric-grid"><article className="metric-card"><div className="metric-icon mint"><GraduationCap size={19}/></div><div className="metric-title">ЗАВЕРШЕНО АКТИВНОСТЕЙ</div><div className="metric-value">{completed}<span> / {profile.history_count}</span></div><div className="metric-caption">из истории набора</div></article><article className="metric-card"><div className="metric-icon lilac"><Compass size={19}/></div><div className="metric-title">ТЕКУЩИЙ УРОВЕНЬ</div><div className="metric-value">{person.grade}</div><div className="metric-caption">{person.role}</div></article><article className="metric-card goal-metric"><div className="metric-icon peach"><Sparkles size={18}/></div><div className="metric-title">КАРЬЕРНАЯ ЦЕЛЬ</div><div className="goal-value">{profile.employee.goal_label || 'Пока не выбрана'}</div><div className="metric-caption">{profile.employee.goal_label ? 'Ваш ориентир' : 'Можно определить позже'}</div></article></section>
        <WorkScores api={api} revision={workRevision}/>
        <WorkGoals key={`${person.employee_id}-${workRevision}`} api={api} actor={actor}/>
        <WorkResults key={person.employee_id} api={api} actor={actor} onChange={() => setWorkRevision(v => v + 1)}/>
        <Trajectory profile={profile}/>
        <Activities key={person.employee_id} profile={profile} api={api} onRefresh={() => refreshProfile(actor)}/>
        <section className="section-heading history-heading"><div><div className="eyebrow">ВАШИ ДАННЫЕ ИЗ НАБОРА</div><h2>История активностей</h2></div><span className="history-total">{profile.history_count} записей</span></section>
        <section className="history-card">{profile.history.slice(0, 8).map(item => <article className="history-row" key={item.record_id}><div className={`history-icon ${item.status}`}><GraduationCap size={17}/></div><div className="history-info"><b>{item.title}</b><small>{item.event_id} <i>·</i> {item.mandatory ? 'Обязательная' : 'Добровольная'}</small></div><span className={`status-pill ${item.status}`}>{item.status === 'planned' ? 'Запланировано' : item.status === 'completed' ? 'Завершено' : item.status === 'in_progress' ? 'В процессе' : item.status === 'no_show' ? 'Не посещено' : item.status === 'declined' ? 'Отклонено' : item.status === 'dropped' ? 'Прервано' : 'Просрочено'}</span><time>{new Date(`${item.date}T00:00:00`).toLocaleDateString('ru-RU',{day:'numeric',month:'short',year:'numeric'})}</time></article>)}{profile.history_count > 8 && <div className="history-more">Показаны последние 8 записей из {profile.history_count}</div>}</section>
        <footer className="page-foot"><span>Демонстрационное приложение · данные синтетические</span><a href="#top"><ArrowDownLeft size={14}/> В начало</a></footer>
      </div>
    </main>
  </div>;
}

createRoot(document.getElementById('root')).render(<App/>);
