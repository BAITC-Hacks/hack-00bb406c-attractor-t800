import React, { useEffect, useState } from 'react';

const labels = { history: 'История добровольных активностей', career_goal: 'Карьерная цель', skills: 'Уровни навыков' };

export default function DevelopmentConsents({ api, actor }) {
  const [settings, setSettings] = useState(null);
  const [team, setTeam] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let active = true;
    let revision = 0;
    async function refresh() {
      const request = ++revision;
      try {
        const [next, people] = await Promise.all([
          api('/api/me/development-consents'),
          actor.actor_role === 'manager' ? api('/api/manager/development') : Promise.resolve([]),
        ]);
        if (active && request === revision) { setSettings(next); setTeam(people); setError(''); }
      } catch (e) { if (active && request === revision) { setTeam([]); setError(e.message); } }
    }
    refresh();
    const timer = setInterval(refresh, 2000);
    window.addEventListener('focus', refresh);
    return () => { active = false; clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [api, actor.actor_role, actor.employee_id]);
  async function toggle(category) {
    setSaving(true); setError('');
    try {
      setSettings(await api(`/api/me/development-consents/${category}`, { method: 'POST', body: JSON.stringify({ enabled: !settings.consents[category], manager_id: settings.manager_id }) }));
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }
  return <section className="history-card" style={{ padding: 24, marginBottom: 24 }}>
    <h2>Доступ к моему развитию</h2>
    <p>{settings?.manager_name ? `Непосредственный руководитель: ${settings.manager_name}` : 'Непосредственный руководитель не назначен'}. Каждое согласие можно отозвать отдельно.</p>
    {error && <p role="alert" className="error-box">{error}</p>}
    {settings && Object.entries(labels).map(([key, label]) => <label key={key} style={{ display: 'block', margin: '12px 0' }}>
      <input type="checkbox" checked={settings.consents[key]} disabled={saving || !settings.manager_id} onChange={() => toggle(key)}/> {label}
    </label>)}
    <p>Согласия действуют только для указанного руководителя. Они не открывают данные HR, аналитикам и коллегам.</p>
    {actor.actor_role === 'manager' && <><h2>Развитие моей команды</h2><p>Только прямые подчинённые. Согласия обновляются автоматически каждые 2 секунды.</p>
      {team.map(person => <article key={person.employee_id} style={{ borderTop: '1px solid #ddd', padding: '16px 0' }}>
        <h3>{person.full_name}</h3>
        {Object.entries(labels).map(([key, label]) => <div key={key}><b>{label}</b>
          {!person.consents[key] ? <p>Нет согласия</p> : key === 'history' ? <ul>{person.history.map(row => <li key={row.record_id}>{row.title} · {row.date} · {row.status} · {row.completion_pct}%</li>)}{!person.history.length && <li>История пуста</li>}</ul>
            : key === 'skills' ? <ul>{person.skills.map(skill => <li key={skill.skill_id}>{skill.name}: оценённый {skill.assessed_level}, расчётный {skill.calculated_level}</li>)}</ul>
              : <p>{person.career_goal ? Object.entries(person.career_goal).map(([, value]) => String(value)).join(' · ') : 'Не выбрана'}</p>}
        </div>)}
      </article>)}{!team.length && <p>Нет доступных данных команды</p>}</>}
  </section>;
}
