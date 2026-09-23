import { skillTree, treeFrame, treeScale } from './tree-map.mjs';
import { createCall, tickCall, clockText, CALL_TARGET_MS, CALL_XP, canEditTest, actorFromCookie } from './growth-model.mjs';
import { SKILLS, POSITIONS, getSkill } from './test-generation/catalog.mjs';
import { buildPrompt } from './test-generation/prompts.mjs';

// THROWAWAY UI PROTOTYPE. Full-screen skill tree and in-memory employee state.
// Domain fixtures come from mock-data.json. The separate test lab can call OpenAI.

const paths = {
  arrow:'M5 12h14m-5-5 5 5-5 5', back:'m14 6-6 6 6 6', chevron:'m9 6 6 6-6 6', close:'m6 6 12 12M18 6 6 18',
  check:'m5 12 4 4L19 6', circle:'M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0', retry:'M4 10a8 8 0 1 1 1 8M4 4v6h6',
  sprout:'M12 21v-9M12 15C3 16 3 7 3 7s9-1 9 8m0-5C11 2 21 3 21 3s0 9-9 9',
  tree:'M12 22v-5M7 17a4 4 0 0 1-3-7 4 4 0 0 1 4-6 4 4 0 0 1 8 0 4 4 0 0 1 4 6 4 4 0 0 1-3 7Z',
  book:'M3 4h6q3 0 3 3v14q0-3-3-3H3Zm18 0h-6q-3 0-3 3v14q0-3 3-3h6Z',
  target:'M21 12a9 9 0 1 1-9-9m5 9a5 5 0 1 1-5-5m0 5 9-9m-5 0h5v5',
  person:'M16 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0M4 22v-3a8 8 0 0 1 16 0v3',
  people:'M14 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0M4 21v-2a7 7 0 0 1 14 0v2M18 4a3 3 0 0 1 0 6m2 4q3 1 3 5',
  home:'m3 10 9-7 9 7v10H3Zm6 10v-6h6v6', card:'M3 4h18v16H3Zm0 5h18M6 16h4',
  wallet:'M3 6h18v15H3Zm1 0V3h14v3m-2 5h6v5h-6Z',cash:'M2 6h20v13H2ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0M5 12h1m12 0h1',
  chart:'m3 17 6-6 4 4 8-11M16 4h5v5M3 21h18', bag:'M4 7h16l-1 14H5Zm4 0V5a4 4 0 0 1 8 0v2',
  plane:'m2 13 8 1 3 7 2-1-1-7 6-5q3-3 1-5-2-2-5 1l-5 6-7-1Z',shield:'m12 2 9 4v6q-1 7-9 10-8-3-9-10V6Zm-4 9 3 3 5-6',
  building:'M3 21h18M5 21V9h14v12M3 9l9-6 9 6M9 12v6m6-6v6', transfer:'M3 7h17m-4-4 4 4-4 4M21 17H4m4-4-4 4 4 4',
  receipt:'M5 3h14v19l-3-2-4 2-4-2-3 2ZM8 8h8m-8 4h8m-8 4h4', qr:'M3 3h6v6H3Zm12 0h6v6h-6ZM3 15h6v6H3Zm12 0v3h3v3h3v-6h-3m-6-3h-1m-2 6h1',
  search:'M16 10a6 6 0 1 1-12 0 6 6 0 0 1 12 0m-2 4 7 7', bell:'M5 16h14l-2-4V8a5 5 0 0 0-10 0v4Zm4 4h6',
  star:'m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z',spark:'m12 3 2 6 6 3-6 2-2 7-2-7-7-2 7-3Zm7-2 1 3 3 1-3 1-1 3-1-3-3-1 3-1Z',
  clock:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0m-9-5v6l4 2',calendar:'M3 5h18v16H3ZM3 10h18M7 2v6m10-6v6m-10 8h3',
  palette:'M12 3a9 9 0 1 0 0 18h2q3 0 1-3t2-3h1q3 0 3-3a9 9 0 0 0-9-9Zm-5 7h.01M10 7h.01m5 1h.01m3 4h.01',
  code:'m8 6-6 6 6 6m8-12 6 6-6 6m-3-14-2 16',jira:'m12 2 10 10-10 10L2 12Zm0 7-3 3 3 3 3-3Z',
  lock:'M5 10h14v12H5Zm3 0V6a4 4 0 0 1 8 0v4m-4 5v3',plus:'M12 4v16M4 12h16', info:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0m-9-1v6m0-10v1',
  award:'M18 8a6 6 0 1 1-12 0 6 6 0 0 1 12 0M8 13l-2 9 6-3 6 3-2-9',message:'M3 3h18v14H9l-6 4Zm4 5h10m-10 4h7',
  leaf:'M20 3Q2 1 3 14q1 7 8 6Q23 17 20 3ZM4 20 16 8',sun:'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2',
  moon:'M20 15A9 9 0 0 1 9 3 9 9 0 1 0 20 15', settings:'M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1Zm7 9a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  mail:'M3 5h18v15H3Zm0 0 9 8 9-8',logout:'M9 3H3v18h6m5-15 6 6-6 6m-6-6h12', coffee:'M3 7h13v11q-1 3-6 3t-7-3Zm13 1h2a4 4 0 0 1 0 8h-2M6 2v2m4-2v2', heart:'M12 21 3 12C-4 4 7-2 12 6 17-2 28 4 21 12Z',download:'M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4'
};
const icon = (name, cls='') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.leaf}"/></svg>`;
const halykIcon = `<svg class="halyk-symbol" viewBox="0 0 30 30" fill="none" aria-hidden="true"><path d="m15 2 5 3 5 1 1 6 2 3-3 5-1 5-6 1-3 2-5-3-5-1-1-6-2-3 3-5 1-5 6-1Z" stroke="currentColor" stroke-width="1.5"/><path d="M15 6a9 9 0 1 0 9 9 9 9 0 0 0-9-9Z" stroke="currentColor" stroke-width="1.4"/><path d="M10 18q4-1 4-6l6-2-2 6-8 5Z" fill="currentColor"/></svg>`;
const esc = value => String(value??'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = value => new Intl.NumberFormat('ru-RU').format(value);
const clone = value => structuredClone(value);
const data = await fetch('./mock-data.json').then(r=>{if(!r.ok)throw new Error('mock-data.json unavailable');return r.json()});
const app = document.querySelector('#app');
const modalRoot = document.querySelector('#modal-root');
const qs = new URLSearchParams(location.search);

let state;
let modalReturnFocus;
let toastTimer;
let modalType = null;
let actorId = actorFromCookie(document.cookie);
let newestAchievement = null;
let treeSearch = '';
let treeFilter = 'all';
const canEdit = id => canEditTest({tests:state?.tests||data.tests}, actorId, id);
const hasAuthorAccess = () => state.tests.some(t => canEdit(t.id));
const actor = () => data.access.users.find(user => user.id === actorId) || data.access.users[0];
const statusName = {passed:'Пройдено',new:'Не начато',failed:'Повторить'};
function reset(employeeId='aizhan', view='bank') {
  const employee = clone(data.employees.find(e=>e.id===employeeId)||data.employees[0]);
  newestAchievement = null; treeSearch = ''; treeFilter = 'all';
  state = {questions:clone(data.questions), call:createCall(), leadXp:data.call.leadInitialXp, employee, isEmployee:employeeId!=='guest', view, tests:clone(data.tests), plan:[], goalId:employee.goalId, xp:employee.xp, tree:employee.tree, theme:employee.theme, testTab:'required', filter:'all', category:'Все', search:'', quiz:null, result:null, attempts:[], contributions:clone(data.contributions), earned:[...data.tests.filter(t=>t.status==='passed').map(t=>'test-'+t.id),...data.contributions.filter(c=>c.status==='confirmed').map(c=>c.id)], meetings:[], jiraConnected:true, jiraSynced:false, lastSync:data.jira.lastSync, draft:null};
  closeModal(false); render();
}
const currentLevel = () => data.levels.filter(l=>state.xp>=l.xp).at(-1);
const nextLevel = () => data.levels.find(l=>l.xp>state.xp);
const levelProgress = () => nextLevel()?Math.min(100,100*(state.xp-currentLevel().xp)/(nextLevel().xp-currentLevel().xp)):100;
const tenure = (months=state.employee.tenureMonths) => months===12?'1 год':months===24?'2 года':`${months} месяцев`;
const goal = () => data.goals.find(g=>g.id===state.goalId);
const test = id => state.tests.find(t=>t.id===id);
const countStatus = name => state.tests.filter(t=>t.required&&t.status===name).length;
const tree = (props={}) => {
  const {species=state.tree,theme=state.theme,months=state.employee.tenureMonths,miniature=false}=props;
  const speciesData=data.trees.find(t=>t.id===species);
  const size=treeScale(months), frame=treeFrame(speciesData,months);
  return `<span class="tree-art generated-tree ${theme} ${miniature?'miniature':''}" style="--tree-scale:${size}"><img src="${frame.asset}" alt="${speciesData.name}, стаж ${months} месяцев" width="${frame.width}" height="${frame.height}" draggable="false">${theme==='night'?'<i class="firefly f1"></i><i class="firefly f2"></i><i class="firefly f3"></i>':''}</span>`;
};
const progress = (value) => `<div class="progress"><span style="width:${Math.max(0,Math.min(100,value))}%"></span></div>`;
const xp = value => `<span class="xp-pill">${icon('spark')}+${fmt(value)} XP</span>`;
const pill = (text,name='',type='')=>`<span class="pill ${type}">${name?icon(name):''}${text}</span>`;
function header(title,{back=null,sub='',action='notifications',actionIcon='bell'}={}) {
  return `<header class="app-header"><button class="app-brand" data-action="navigate" data-view="bank" aria-label="Вернуться в Halyk">${halykIcon}<strong>Halyk</strong></button><span class="brand-rule"></span>${back?`<button class="icon-btn" data-action="navigate" data-view="${back}" aria-label="Назад">${icon('back')}</button>`:''}<div class="grow"><div class="header-eyebrow">МОЙ РОСТ</div><h2>${esc(title)}</h2></div><span class="header-identity">${esc(state.employee.role)}<small>${esc(state.employee.department)}</small></span><button class="icon-btn header-meeting" data-action="navigate" data-view="call" aria-label="Видеовстреча 1:1">${icon('people')}</button><button class="avatar" data-action="navigate" data-view="profile" aria-label="Профиль сотрудника">${esc(state.employee.initials)}</button></header>`;
}
function bottomNav() {
  if(state.view==='bank') return `<nav class="bottom-nav" aria-label="Навигация Halyk">${[['home','Главная'],['wallet','Мой банк'],['qr','QR'],['transfer','Переводы'],['receipt','Платежи']].map(([i,t],n)=>`<button class="nav-item ${n===0?'active':''} ${n===2?'qr':''}" data-action="bank-service" data-name="${t}" ${n===0?'aria-current="page"':''}>${icon(i)}<span>${t}</span></button>`).join('')}</nav>`;
  const active=['test','quiz','result'].includes(state.view)?'tests':['custom','activities','call'].includes(state.view)?'growth':state.view;
  return `<nav class="bottom-nav" aria-label="Навигация Мой рост">${[['growth','tree','Дерево'],['tests','book','Тесты'],['goals','target','Цели'],['profile','person','Профиль'],['bank',null,'Halyk']].map(([v,i,t])=>`<button class="nav-item ${active===v?'active':''} ${v==='bank'?'halyk-tab':''}" data-action="navigate" data-view="${v}" ${active===v?'aria-current="page"':''} aria-label="${v==='bank'?'Вернуться в Halyk':t}">${i?icon(i):halykIcon}<span>${t}</span></button>`).join('')}</nav>`;
}
function bankView() {
  return `<div class="bank-header"><button class="avatar" data-action="demo-profile" aria-label="Выбрать демо-профиль">${state.isEmployee?state.employee.initials:'Г'}</button><label class="search">${icon('search')}<input aria-label="Поиск сервисов Halyk" placeholder="Поиск" id="bank-search"></label><div class="bonus"><span>◉</span>${fmt(data.bank.cashback)}</div></div><main class="screen" id="screen">
    <section class="bank-banner">${pill('БЛИЖЕ К ВАМ')}<h3>Всё важное —<br>в Halyk</h3><p>Банк, покупки и возможности<br>в одном приложении.</p><div class="mini-bank-card">Halyk</div></section>
    <section class="bank-services" aria-label="Сервисы">${data.bank.services.map(s=>`<button class="bank-service" data-action="bank-service" data-name="${esc(s.name)}">${icon(s.icon)}<span>${esc(s.name)}</span></button>`).join('')}</section>
    ${state.isEmployee?`<section class="growth-entry" tabindex="0" role="button" data-action="navigate" data-view="growth" aria-label="Открыть Мой рост"><div class="eyebrow">СОТРУДНИКАМ HALYK</div><h3>Время расти.<br>В своём темпе.</h3><p>Ваши навыки, цели<br>и новые возможности.</p><span class="primary-btn">Мой рост ${icon('arrow')}</span>${tree()}</section>`:`<div class="card" style="margin-top:17px"><div class="eyebrow">ДОБРО ПОЖАЛОВАТЬ</div><h3 style="font-size:19px;margin-top:10px">Каждый день с Halyk</h3><p class="body-copy">Все ваши банковские сервисы — в одном месте.</p></div>`}
    <div class="section-heading"><h3>Все сервисы</h3><button class="text-btn" data-action="all-services">Смотреть ${icon('chevron')}</button></div><div class="services-more">${[['heart','Appteka'],['coffee','Рестораны'],['transfer','Halyk FX']].map(([i,t])=>`<button class="service-small" data-action="bank-service" data-name="${t}">${icon(i)}${t}</button>`).join('')}</div>
    ${state.isEmployee?`<p class="bank-greeting">${icon('shield')}Профиль сотрудника подтверждён</p>`:''}</main>`;
}
function statuses() { return `<div class="map-legend">${['passed','new','failed'].map(name=>`<button data-action="tree-filter" data-filter="${name}" aria-pressed="${treeFilter===name}"><i class="legend-leaf ${name}"></i>${statusName[name]} <strong>${state.tests.filter(t=>t.status===name).length}</strong></button>`).join('')}</div>`; }
function stepDone(step){
  if(step.testId)return test(step.testId)?.status==='passed';
  if(step.callRequired)return state.meetings.some(meeting=>meeting.status==='completed');
  if(step.activityId)return state.contributions.filter(c=>c.type===step.activityId&&c.status==='confirmed').length>=(step.minimum||1);
  return !!step.done;
}
function goalReadiness(g=goal()) {const count=g.steps.filter(stepDone).length;return {count,percent:Math.round(100*count/g.steps.length)};}
function nextTest(){return state.tests.find(t=>t.required&&t.status==='new')||state.tests.find(t=>t.required&&t.status==='failed')||state.tests.find(t=>!t.required&&t.status==='new');}
function growthView(){
  const all=state.tests;
  const shown=all.filter(t=>(treeFilter==='all'||t.status===treeFilter)&&(!treeSearch||(t.title+' '+t.skill).toLowerCase().includes(treeSearch.toLowerCase())));
  const completed=all.filter(t=>t.status==='passed').length;
  const artwork=data.trees.find(tree=>tree.id===state.tree);
  return header('Дерево навыков')+`<main class="screen growth-screen" id="screen">
    ${skillTree(all,{months:state.employee.tenureMonths,species:state.tree,theme:state.theme,highlight:newestAchievement,artwork})}
    <section class="tree-information" id="tree-information" tabindex="-1" aria-label="Информация о дереве">
      <div class="tree-information-heading"><h1>Ваш прогресс</h1><span>${esc(state.employee.firstName)} · ${esc(state.employee.role)}</span></div>
      <div class="growth-overview"><div class="tree-stat"><strong data-passed-count>${completed.toString().padStart(2,'0')}</strong><span>тестов пройдено</span></div><div class="tree-stat"><strong>${all.length}</strong><span>навыков доступно</span></div><div class="tree-stat"><strong>${tenure()}</strong><span>в Halyk</span></div><button class="tree-xp" data-action="navigate" data-view="activities"><span>УРОВЕНЬ ${currentLevel().level} <b>${fmt(state.xp)} XP</b></span>${progress(levelProgress())}<small>${nextLevel()?fmt(nextLevel().xp-state.xp)+' XP до следующего уровня':'Все уровни открыты'} ${icon('arrow')}</small></button></div>
      <div class="tree-information-actions"><button class="text-btn" data-action="navigate" data-view="custom">${icon('palette')}Оформление</button><button class="text-btn" data-action="navigate" data-view="call">${icon('people')}1:1 с тимлидом ${icon('arrow')}</button></div>
      <div class="map-toolbar">${statuses()}<label class="tree-search">${icon('search')}<input id="tree-search" aria-label="Найти навык" placeholder="Найти навык" value="${esc(treeSearch)}"></label></div>
      <div class="tree-skill-directory">${shown.map(t=>`<button class="directory-skill ${t.status}" data-action="test-open" data-id="${t.id}" aria-label="${esc(t.title)} · ${statusName[t.status]}"><span class="directory-dot" aria-hidden="true">${t.status==='passed'?'✓':t.status==='failed'?'↻':'+'}</span><span>${esc(t.title)}</span>${icon('chevron')}</button>`).join('')||'<p class="empty">Ничего не найдено.</p>'}</div>
      <p class="tree-information-note">Сданные тесты появляются на дереве. Его размер зависит от стажа.</p>
      <section class="tree-next"><div><span class="eyebrow">КАРЬЕРНАЯ ЦЕЛЬ</span><h2>${esc(goal().title)}</h2><p>${goalReadiness().count} из ${goal().total} шагов подтверждено</p></div><button class="primary-btn" data-action="navigate" data-view="goals">Открыть мой план ${icon('arrow')}</button></section>
    </section>
  </main>`;
}
function testRow(t){return `<button class="test-row" data-action="test-open" data-id="${t.id}"><span class="icon-tile ${t.status==='failed'?'coral':''}">${icon(t.status==='passed'?'check':t.status==='failed'?'retry':'book')}</span><div class="grow"><h3>${esc(t.title)}</h3><p>${statusName[t.status]}${t.score!==null?' · '+t.score+'%':' · '+t.minutes+' мин'}</p></div>${t.status==='passed'?pill('Готово','check'):xp(t.xp)}${icon('chevron')}</button>`;}
function testsView(){
  const term=state.search.toLowerCase().trim();
  const available=state.tests.filter(t=>state.testTab==='catalog'?!t.required:t.required||state.plan.includes(t.id));
  const filtered=available.filter(t=>(state.filter==='all'||t.status===state.filter)&&(state.category==='Все'||t.category===state.category)&&(!term||(t.title+' '+t.description+' '+t.category).toLowerCase().includes(term)));
  return header('Тесты и навыки')+`<main class="screen" id="screen">${hasAuthorAccess()?`<a class="author-entry" href="/test-lab.html" target="_blank" rel="noopener">${icon('settings')}Студия автора тестов<span>${esc(actor().name)}</span>${icon('arrow')}</a>`:''}<div class="segmented"><button data-action="test-tab" data-tab="required" class="${state.testTab==='required'?'selected':''}">Мой план <small>${new Set([...state.tests.filter(t=>t.required).map(t=>t.id),...state.plan]).size}</small></button><button data-action="test-tab" data-tab="catalog" class="${state.testTab==='catalog'?'selected':''}">Каталог</button></div><label class="search">${icon('search')}<input id="test-search" aria-label="Найти тест" placeholder="Найти тест или навык" value="${esc(state.search)}"></label>
    ${state.testTab==='required'?`<div class="chips">${[['all','Все'],['new','Не начато'],['passed','Пройдено'],['failed','Повторить']].map(([id,n])=>`<button class="chip ${state.filter===id?'selected':''}" data-action="filter" data-filter="${id}">${n}</button>`).join('')}</div><div class="status-summary">${esc(state.employee.role)} · ${filtered.length} тестов</div>`:`<p class="body-copy">Любопытство — тоже навык.<br>Добавьте в план то, что интересно вам.</p><div class="chips">${['Все',...new Set(state.tests.filter(t=>!t.required).map(t=>t.category))].map(c=>`<button class="chip ${c===state.category?'selected':''}" data-action="category" data-category="${c}">${c}</button>`).join('')}</div>`}
    ${state.quiz?`<button class="goal-card" style="margin-bottom:13px" data-action="resume-quiz"><span class="icon-tile">${icon('clock')}</span><div class="grow"><div class="goal-title">Продолжить ${test(state.quiz.testId).title}</div><div class="tiny muted">Вопрос ${state.quiz.index+1} · ответы сохранены в этой сессии</div></div>${icon('chevron')}</button>`:''}
    ${filtered.length?state.testTab==='catalog'?filtered.map(t=>`<article class="catalog-card"><div class="row between"><span class="icon-tile">${icon(t.category==='Лидерство'?'people':'spark')}</span>${pill(t.category)}</div><h3>${esc(t.title)}</h3><p>${esc(t.description)}</p><div class="row bottom between"><div>${xp(t.xp)}<span class="tiny muted" style="margin-left:8px">${t.minutes} мин</span></div><button class="secondary-btn" data-action="${state.plan.includes(t.id)?'test-open':'add-test'}" data-id="${t.id}">${icon(state.plan.includes(t.id)?'check':'plus')}${state.plan.includes(t.id)?'В вашем плане':'В мой план'}</button></div></article>`).join(''):`<section class="test-list">${filtered.map(testRow).join('')}</section>`:`<div class="empty">${icon('search')}<h3>Пока ничего не нашлось</h3><p>Попробуйте другой запрос или фильтр.</p><button class="secondary-btn" data-action="clear-filters">Сбросить фильтры</button></div>`}
  </main>`;
}
function testView(){const t=test(state.selectedTest),q=state.questions[t.questionSet];return header(t.title,{back:'tests'})+`<main class="screen" id="screen">${canEdit(t.id)?`<button class="author-entry full" data-action="edit-test" data-id="${t.id}">${icon('settings')}Настройки теста <span>Вы — назначенный автор</span>${icon('arrow')}</button>`:''}<div class="test-intro-icon">${icon('book')}</div>${pill(t.required?'Для вашей роли':'По вашему выбору')}<h3 class="test-detail-title" style="margin-top:14px">${esc(t.title)}</h3><p class="body-copy">${esc(t.description)}</p><div class="test-metrics"><div><strong>${q.length}</strong><span>вопросов</span></div><div><strong>${t.passScore}%</strong><span>для прохождения</span></div><div><strong>+${t.xp}</strong><span>XP за результат</span></div></div>
  ${t.status==='failed'?`<div class="card"><div class="row between"><span class="small">Прошлая попытка</span>${pill(`${t.score}% · Повторить`,'retry','coral')}</div><p class="body-copy" style="margin-bottom:0">Ошибки — часть пути. Повторите материал и попробуйте ещё раз.</p></div>`:''}
  ${t.status==='passed'?`<div class="card"><div class="row between"><span class="small">Ваш результат</span>${pill(t.score+'%','check')}</div><p class="body-copy" style="margin-bottom:0">Навык подтверждён. Награда уже учтена в вашем опыте.</p></div><button class="primary-btn full" style="margin-top:22px" data-action="navigate" data-view="tests">К моему плану</button>`:`<ul class="checklist"><li>${icon('check')}Один правильный ответ на вопрос</li><li>${icon('check')}Можно вернуться к предыдущему вопросу</li><li>${icon('check')}Результат и объяснения после завершения</li></ul><button class="primary-btn full" data-action="start-quiz" data-id="${t.id}" ${t.draft?'disabled':''}>${t.draft?'Вопросы готовятся':state.quiz?.testId===t.id?'Продолжить тест':'Начать тест'} ${icon('arrow')}</button>`}
  <section class="preparation"><span class="eyebrow">ПЕРЕД НАЧАЛОМ</span><h3>Вспомните свою практику</h3><p>${esc(t.preparation)}</p><div class="preparation-topics">${getSkill(t.id)?.topics.map(topic=>`<span>${esc(topic)}</span>`).join('')||''}</div></section><div class="help-text">${icon('info')}Короткая демо-версия теста. Ответы и результат останутся в этой сессии.</div></main>`;}
function quizView(){const session=state.quiz,t=test(session.testId),questions=state.questions[t.questionSet],q=questions[session.index];return header(t.title,{back:'tests'})+`<main class="screen" id="screen"><div class="quiz-top"><span>Вопрос ${session.index+1} из ${questions.length}</span><span>${pill(t.skill)}</span></div><div class="quiz-progress">${questions.map((_,i)=>`<i class="${i<session.index?'done':i===session.index?'current':''}"></i>`).join('')}</div><div class="eyebrow">ОДИН ПРАВИЛЬНЫЙ ОТВЕТ</div><h3 class="quiz-question">${esc(q.text)}</h3><div role="group" aria-label="Варианты ответа">${q.options.map((o,i)=>`<button class="answer ${session.answers[session.index]===i?'selected':''}" data-action="answer" data-answer="${i}" aria-pressed="${session.answers[session.index]===i}"><span class="radio"></span>${esc(o)}</button>`).join('')}</div><div class="quiz-actions"><button class="secondary-btn" data-action="question-back" ${session.index===0?'disabled':''} aria-label="Предыдущий вопрос">${icon('back')}</button><button class="primary-btn" data-action="question-next" ${session.answers[session.index]===undefined?'disabled':''}>${session.index===questions.length-1?'Завершить тест':'Дальше'} ${icon('arrow')}</button></div><button class="text-btn" style="margin-top:22px" data-action="navigate" data-view="tests">Сохранить и выйти</button></main>`;}
function resultView(){const r=state.result,t=test(r.testId);return header('Результат теста',{back:'tests'})+`<main class="screen" id="screen"><section class="result-hero ${r.passed?'':'failed'}"><div class="result-medal">${icon(r.passed?'star':'sprout')}</div><h3>${r.passed?'Отличная работа, '+state.employee.firstName+'!':'Каждый шаг — это опыт'}</h3><p>${esc(t.title)}</p><div class="result-score">${r.score}%</div><p>${r.correct} из ${r.total} верно · Порог ${t.passScore}%</p><div style="margin-top:14px">${pill(r.passed?'Тест пройден':'Попробуйте ещё раз',r.passed?'check':'retry',r.passed?'':'coral')}</div><div class="reward-card"><div class="row between"><strong>${r.reward?'+'+r.reward+' XP':'Следующий шаг — повторить'}</strong>${r.reward?pill('Уровень '+currentLevel().level):''}</div><p style="margin-top:9px">${r.reward?`${fmt(state.xp)} / ${fmt(nextLevel()?.xp||state.xp)} XP`:'Сначала разберите ответы. XP начисляется за пройденный тест.'}</p>${r.reward?progress(levelProgress()):''}</div></section><div class="section-heading"><h3>Разбор ответов</h3><span class="tiny muted">${r.correct}/${r.total}</span></div>${state.questions[t.questionSet].map((q,i)=>`<div class="feedback-row ${r.answers[i]===q.correct?'':'incorrect'}">${icon(r.answers[i]===q.correct?'check':'info')}<div><strong style="font-weight:500">${esc(q.text)}</strong><p class="muted" style="margin-top:5px">${esc(q.explanation)}</p></div></div>`).join('')}<button class="primary-btn full" style="margin-top:22px" data-action="${r.passed?'navigate':'start-quiz'}" ${r.passed?'data-view="growth"':`data-id="${t.id}"`}>${r.passed?'Вернуться к дереву':'Попробовать ещё раз'} ${icon('arrow')}</button></main>`;}
function stepRow(step,i){const done=stepDone(step);return `<div class="step"><span class="${done?'done':step.testId?'current':''}">${done?icon('check'):i+1}</span><div class="grow"><h3>${step.title}</h3><p>${done?'Навык подтверждён':step.detail}</p>${!done?step.testId?`<button class="text-btn" data-action="test-open" data-id="${step.testId}">К тесту ${icon('arrow')}</button>`:`<button class="text-btn" data-action="${step.activityId?'activity-open':'schedule'}" data-id="${step.activityId||'meeting'}">${step.activityId?'Добавить практику':'Запланировать встречу'} ${icon('arrow')}</button>`:''}</div></div>`;}
function goalsView(){const g=goal(),r=goalReadiness();return header('Моя цель')+`<main class="screen" id="screen"><div class="segmented"><button data-action="goal-picker" data-type="promotion" class="${g.type==='promotion'?'selected':''}">${icon('chart')} Повышение</button><button data-action="goal-picker" data-type="transfer" class="${g.type==='transfer'?'selected':''}">Смена команды</button></div><section class="goal-hero">${pill(g.department,'building')}<h3>${g.title}</h3><p>${g.description}</p><div class="row between"><span class="goal-readiness">${r.percent}%</span><span class="tiny muted">${r.count} из ${g.total} шагов</span></div>${progress(r.percent)}</section><div class="section-heading"><h3>Ваш путь к цели</h3><button class="text-btn" data-action="goal-picker">Изменить</button></div><div class="step-list">${g.steps.map(stepRow).join('')}</div><div class="mentor-card"><div class="eyebrow">С ПОДДЕРЖКОЙ РАСТИ ЛЕГЧЕ</div><h3>${g.type==='promotion'?'Разберите следующий шаг с тимлидом':'Познакомьтесь с новой командой'}</h3><p>${g.type==='promotion'?esc(state.employee.manager)+' поможет составить план практики и обсудить готовность к новой роли.':'Обсудите ожидания и попробуйте небольшую задачу вместе с будущими коллегами.'}</p><button class="primary-btn" data-action="schedule">${icon('people')}Запланировать 1:1</button></div><div class="help-text">${icon('info')}${g.type==='promotion'?'Повышение обсуждается с руководителем. XP и тесты не заменяют оценку рабочих результатов.':'Переход согласуется с текущим и новым руководителями.'}</div></main>`;}
function profileView(){const e=state.employee;return header('Мой профиль',{action:'demo-profile',actionIcon:'settings'})+`<main class="screen" id="screen"><section class="profile-card"><div class="row"><span class="avatar large">${esc(e.initials)}</span><div><h3>${esc(e.name)}</h3><div class="role">${esc(e.role)}</div>${pill('Сотрудник Halyk','shield')}</div></div><div class="profile-grid"><div><label>КОМАНДА</label><strong>${esc(e.department)}</strong></div><div><label>СТАЖ В КОМПАНИИ</label><strong>${tenure()}</strong></div><div><label>РУКОВОДИТЕЛЬ</label><strong>${esc(e.manager)}</strong></div><div><label>ГОРОД</label><strong>${esc(e.city)}</strong></div></div><div class="profile-stats"><div><strong>${currentLevel().level}</strong><span>уровень</span></div><div><strong>${fmt(state.xp)}</strong><span>опыта XP</span></div><div><strong>${state.tests.filter(t=>t.status==='passed').length}</strong><span>тестов пройдено</span></div></div></section><div class="section-heading"><h3>Всё о вашем развитии</h3></div><section class="menu-list">${[
    ['award','Навыки и сертификаты','Навыков: '+state.tests.filter(t=>t.status==='passed').length+' · сертификатов: '+e.certificates.length,'profile-detail','skills'],
    ['book','Тесты и история попыток','Все результаты в одном месте','profile-detail','attempts'],
    ['target','Цель и план развития',goal().title,'navigate','goals'],
    ['spark','Вклад и достижения',state.contributions.filter(c=>c.status==='confirmed').length+' подтверждения','navigate','activities'],
    ['people','Встречи и обратная связь',state.meetings.length?'Всего: '+state.meetings.length+' · состоялось: '+state.meetings.filter(m=>m.status==='completed').length:'Ваши разговоры о росте','profile-detail','meetings'],
    ['person','Данные сотрудника',e.employeeId,'profile-detail','employee']
  ].map(([i,t,d,a,id])=>`<button class="menu-row" data-action="${a}" data-id="${id}" data-view="${id}">${icon(i)}<div><h3>${t}</h3><p>${d}</p></div>${icon('chevron')}</button>`).join('')}</section><div class="section-heading"><h3>Подключения</h3></div><section class="menu-list"><button class="menu-row" data-action="jira-settings">${icon('jira')}<div><h3>Jira</h3><p>${state.jiraConnected?'Подключено · Digital Banking':'Не подключено'}</p></div>${pill('Демо')}${icon('chevron')}</button><button class="menu-row" data-action="profile-detail" data-id="privacy">${icon('shield')}<div><h3>Данные и доступ</h3><p>Что хранит система и кто это видит</p></div>${icon('chevron')}</button></section></main>`;}
function customView(){const d=state.draft;return header('Моё дерево',{back:'growth'})+`<main class="screen" id="screen"><section class="custom-hero ${d.theme}">${pill('Уровень '+currentLevel().level,'star')}${tree({species:d.tree,theme:d.theme})}<div class="tree-caption">${tenure()} в Halyk · размер зависит от стажа</div></section><div class="tenure-scale">${[6,12,24].map(m=>`<div class="${m===state.employee.tenureMonths?'selected':''}">${tree({species:d.tree,theme:d.theme,months:m,miniature:true})}${tenure(m)}${m===state.employee.tenureMonths?' · Вы':''}</div>`).join('')}</div><div class="section-heading"><h3>Характер вашего дерева</h3></div><div class="tree-choices">${data.trees.map(t=>`<button class="tree-choice ${d.tree===t.id?'selected':''}" data-action="tree-choice" data-id="${t.id}" aria-label="Выбрать ${t.name}" aria-pressed="${d.tree===t.id}">${d.tree===t.id?`<span class="choice-check">${icon('check')}</span>`:state.xp<t.xp?`<span class="choice-check">${icon('lock')}</span>`:''}${tree({species:t.id,theme:d.theme,miniature:true})}${t.name}</button>`).join('')}</div><div class="section-heading"><h3>Маленький мир вокруг</h3>${xp(state.xp).replace('+','')}</div><div class="theme-choices">${data.themes.map(t=>`<button class="theme-choice ${d.theme===t.id?'selected':''}" data-action="theme-choice" data-id="${t.id}" aria-label="Тема ${t.name}" aria-pressed="${d.theme===t.id}"><span class="theme-swatch ${t.id}">${icon(state.xp<t.xp?'lock':t.id==='night'?'moon':t.id==='autumn'?'leaf':'sun')}</span>${t.name}<small>${state.xp<t.xp?t.xp+' XP':'Доступно'}</small></button>`).join('')}</div><div class="help-text">${icon('spark')}${state.xp<1600?`Ещё ${fmt(1600-state.xp)} XP до Ночного сада.`:'Ночной сад открыт. Вы заслужили свою магию.'} Опыт не тратится при выборе темы.</div><div class="custom-save"><button class="primary-btn full" data-action="save-custom">Сохранить оформление ${icon('check')}</button></div></main>`;}
function historyItem(c){return `<article class="history-item"><div class="row"><span class="icon-tile ${c.type==='jira'?'jira-icon':''}">${icon(data.activities.find(a=>a.id===c.type)?.icon||'book')}</span><div class="grow"><h3>${esc(c.title)}</h3><p>${esc(c.detail)}</p></div></div><div class="row between">${pill(c.status==='confirmed'?'Подтверждено':c.status==='scheduled'?'Запланировано':'Ждёт подтверждения',c.status==='confirmed'?'check':'clock',c.status==='confirmed'?'':'gold')}${xp(c.xp)}</div>${c.status!=='confirmed'?`<button class="text-btn" data-action="confirm-preview" data-id="${c.id}">Подтвердить результат · демо ${icon('arrow')}</button>`:''}</article>`;}
function activitiesView(){return header('Опыт и вклад',{back:'growth'})+`<main class="screen" id="screen"><section class="activities-xp">${tree()}<div class="grow"><span class="tiny muted">ВАШ ОПЫТ РАСТЁТ</span><h3>${fmt(state.xp)} <span class="small">XP</span></h3><div class="tiny muted">Уровень ${currentLevel().level} · ${nextLevel()?fmt(nextLevel().xp-state.xp)+' XP до следующего':'Все уровни открыты'}</div>${progress(levelProgress())}</div></section><div class="section-heading"><h3>Расти можно по-разному</h3></div><div class="activity-grid">${data.activities.map(a=>`<button class="activity-card" data-action="activity-open" data-id="${a.id}">${icon(a.icon)}<h3>${a.title}</h3><p>+${a.xp} XP</p></button>`).join('')}</div><div class="help-text">${icon('info')}Опыт начисляется за прохождение или подтверждённый вклад. Один результат — одна награда.</div><div class="card jira-card"><div class="row"><span class="icon-tile jira-icon">${icon('jira')}</span><div class="grow"><strong class="small">Jira · ${data.jira.workspace}</strong><p class="tiny muted" style="margin-top:5px">${state.jiraConnected?'Синхронизация '+state.lastSync:'Подключение отключено'} · демо</p></div><button class="icon-btn" data-action="jira-sync" aria-label="Синхронизировать Jira">${icon('retry')}</button></div></div><div class="section-heading"><h3>История вклада</h3><span class="tiny muted">${state.contributions.length} записей</span></div>${state.contributions.map(historyItem).join('')}</main>`;}

const views={call:callView,bank:bankView,growth:growthView,tests:testsView,test:testView,quiz:quizView,result:resultView,goals:goalsView,profile:profileView,custom:customView,activities:activitiesView};
function render(preserve=false){
  if(!state.isEmployee&&state.view!=='bank')state.view='bank';
  if(state.view==='custom'&&!state.draft)state.draft={tree:state.tree,theme:state.theme};
  const top=window.scrollY;
  app.dataset.view=state.view; document.body.dataset.view=state.view;
  app.innerHTML=views[state.view]()+bottomNav();
  if(preserve)window.scrollTo({top,behavior:'instant'});else window.scrollTo({top:0,behavior:'instant'});
  document.title=`Halyk · ${state.view==='bank'?'Суперапп':'Мой рост'}`;
  renderStudio();
}
function renderStudio(){
  document.querySelector('#demo-widget').hidden=document.documentElement.dataset.prototype==='false';
  const snapshot={view:state.view,employee:state.employee.name,role:state.employee.role,tenureMonths:state.employee.tenureMonths,xp:state.xp,leadXp:state.leadXp,leaves:state.tests.filter(t=>t.status==='passed').length,skills:state.tests.length,actor:actor().name,call:{status:state.call.status,elapsed:Math.floor(state.call.elapsed/1000),rewarded:state.call.rewarded}};
  const output=document.querySelector('#demo-state');if(output)output.textContent=JSON.stringify(snapshot,null,2);
}
function navigate(view){if(!views[view]||(!state.isEmployee&&view!=='bank'))return;if(view==='call')tickActiveCall();if(view==='custom'&&state.view!=='custom')state.draft={tree:state.tree,theme:state.theme};state.view=view;const url=new URL(location.href);url.searchParams.set('view',view);history.replaceState({},'',url);closeModal(false);render();}
function toast(message){const el=document.querySelector('#toast');clearTimeout(toastTimer);el.textContent=message;el.classList.add('visible');toastTimer=setTimeout(()=>el.classList.remove('visible'),3500);}
function openModal(title,body,type='info'){
  modalReturnFocus=document.activeElement;modalType=type;
  modalRoot.innerHTML=`<div class="modal-backdrop" data-action="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" tabindex="-1"><div class="modal-handle"></div><div class="modal-header"><h3 id="modal-title">${title}</h3><button class="icon-btn" data-action="close-modal" aria-label="Закрыть">${icon('close')}</button></div>${body}</section></div>`;
  app.inert=true;document.querySelector('#demo-widget').inert=true;document.body.classList.add('modal-open');
  modalRoot.querySelector('.modal').focus();
}
function closeModal(restore=true){modalRoot.innerHTML='';modalType=null;app.inert=false;document.querySelector('#demo-widget').inert=false;document.body.classList.remove('modal-open');if(restore&&modalReturnFocus?.isConnected)modalReturnFocus.focus();}
function award(id,amount){if(state.earned.includes(id))return 0;state.earned.push(id);state.xp+=amount;state.employee.xp=state.xp;return amount;}
function openTest(id){state.selectedTest=id;navigate('test');}
function startQuiz(id){
  if(!state.questions[test(id).questionSet]?.length){toast('Вопросы ещё готовятся назначенным автором.');return;}
  if(test(id).status==='passed'){toast('Этот навык уже подтверждён.');return;}
  if(state.quiz&&state.quiz.testId!==id){openModal('Продолжить или начать новый?',`<p class="body-copy">У вас есть незавершённый тест «${test(state.quiz.testId).title}». Начало нового теста заменит текущую попытку.</p><div class="modal-actions"><button class="secondary-btn" data-action="resume-quiz">Продолжить</button><button class="primary-btn" data-action="replace-quiz" data-id="${id}">Начать новый</button></div>`);return;}
  if(!state.quiz)state.quiz={testId:id,index:0,answers:[]};
  if(!test(id).required&&!state.plan.includes(id))state.plan.push(id);
  navigate('quiz');
}
function finishQuiz(){const q=state.quiz,t=test(q.testId),questions=state.questions[t.questionSet],correct=questions.filter((question,i)=>question.correct===q.answers[i]).length,score=Math.round(correct/questions.length*100),passed=score>=t.passScore;
  t.score=score;t.status=passed?'passed':'failed';
  if(passed){newestAchievement=t.id;const skill=state.employee.skills.find(s=>s.name===t.skill);if(skill)skill.score=Math.max(skill.score,score);else state.employee.skills.push({name:t.skill,score});}
  const reward=passed?award('test-'+t.id,t.xp):0;
  state.result={testId:t.id,score,correct,total:questions.length,passed,reward,answers:[...q.answers]};
  state.attempts.unshift({testId:t.id,score,passed});
  if(passed&&reward)state.contributions.unshift({id:'test-'+t.id,title:t.title,detail:'Тест навыка · '+score+'%',type:'test',status:'confirmed',xp:reward,date:'Сегодня'});
  state.quiz=null;navigate('result');
}
function goalPicker(type){const filtered=type?data.goals.filter(g=>g.type===type):data.goals;openModal('Куда хотите расти?',`<p class="body-copy">Выберите направление. План подстроится под требования новой роли.</p>${filtered.map(g=>`<button class="goal-choice ${state.goalId===g.id?'selected':''}" data-action="set-goal" data-id="${g.id}"><h3>${g.title}</h3><p>${g.description}</p>${pill(g.department)}${state.goalId===g.id?pill('Ваша цель','check'):''}</button>`).join('')}<div class="help-text">${icon('info')}Сохранение цели не запускает перевод или повышение.</div>`,'goal');}
function schedule(){openModal('Встреча о вашем росте',`<button class="author-entry full" data-action="navigate" data-view="call">${icon('people')}Попробовать видеовстречу · демо ${icon('arrow')}</button><div class="row"><span class="avatar">ДА</span><div><strong class="small">${esc(state.employee.manager)}</strong><p class="tiny muted" style="margin-top:5px">Тимлид · 30 минут</p></div></div><form id="meeting-form"><label class="field">Тема встречи<input name="topic" value="${goal().type==='promotion'?'Мой следующий шаг к Senior':'Карьерный переход: '+esc(goal().department)}" required maxlength="120"></label><div class="small muted" style="margin:17px 0 10px">Удобное время</div>${data.meetingSlots.map((slot,i)=>`<label class="slot"><input type="radio" name="slot" value="${slot}" ${i===0?'checked':''}>${slot}</label>`).join('')}<div class="help-text">${icon('info')}+100 XP после встречи и подтверждения тимлидом.</div><button class="primary-btn full" style="margin-top:20px" type="submit">Запланировать встречу ${icon('calendar')}</button></form>`,'meeting');}
function activityOpen(id){const a=data.activities.find(a=>a.id===id);if(id==='test'){state.testTab='required';navigate('tests');return;}if(id==='meeting'){schedule();return;}if(id==='jira'){navigate('activities');jiraSettings();return;}openModal(a.title,`<div class="row between"><span class="icon-tile">${icon(a.icon)}</span>${xp(a.xp)}</div><p class="body-copy">${a.detail}. После подтверждения руководителем вклад появится в истории.</p><form id="contribution-form" data-kind="${id}"><label class="field">Что вы сделали?<input name="title" required maxlength="120" placeholder="${id==='review'?'Например, review PR #152':id==='mentoring'?'Например, разбор задачи с коллегой':'Например, доклад о React patterns'}"></label><label class="field">Результат или ссылка<textarea name="detail" required maxlength="400" placeholder="Расскажите, чем ваш вклад помог команде"></textarea></label><button type="submit" class="primary-btn full">Отправить на подтверждение ${icon('arrow')}</button></form>`,'contribution');}
function jiraSettings(){openModal('Подключение Jira',`<div class="row"><span class="icon-tile jira-icon">${icon('jira')}</span><div><strong class="small">${data.jira.workspace}</strong><p class="tiny muted" style="margin-top:5px">Проект ${data.jira.project} · ${state.jiraConnected?'подключено':'не подключено'}</p></div></div><p class="body-copy">Завершённые задачи появляются в истории вклада. Тимлид подтверждает результат перед начислением опыта.</p><div class="demo-warning">Демонстрация интеграции: синхронизация добавляет одну заранее подготовленную задачу из mock-data.json. Доступ к реальной Jira не используется.</div><div class="modal-actions"><button class="secondary-btn" data-action="jira-toggle">${state.jiraConnected?'Отключить':'Подключить'}</button><button class="primary-btn" data-action="jira-sync" ${state.jiraConnected?'':'disabled'}>Синхронизировать</button></div>`,'jira');}
function profileDetail(id){const e=state.employee;
  if(id==='skills')openModal('Навыки и сертификаты',`${state.tests.filter(t=>t.status==='passed').map(t=>({name:t.title,score:t.score})).map(s=>`<div class="skill-row"><div class="row between"><strong>${esc(s.name)}</strong><span class="muted">${s.score}%</span></div>${progress(s.score)}</div>`).join('')}<div class="section-heading"><h3>Сертификаты</h3></div>${e.certificates.map(c=>`<div class="certificate">${icon('award')}${c}</div>`).join('')}`);
  if(id==='attempts')openModal('История тестов',`${state.attempts.map(a=>`<div class="attempt-row"><div>${test(a.testId).title}<p>Сегодня · новая попытка</p></div>${pill(a.score+'%',a.passed?'check':'retry',a.passed?'':'coral')}</div>`).join('')}${data.tests.filter(t=>t.score!==null).map(t=>`<div class="attempt-row"><div>${esc(t.title)}<p>Предыдущий результат</p></div>${pill(t.score+'%',t.status==='passed'?'check':'retry',t.status==='passed'?'':'coral')}</div>`).join('')}`);
  if(id==='employee')openModal('Данные сотрудника',`<div class="demo-warning">Вымышленный профиль для демонстрации.</div>${[['Полное имя',e.name],['Идентификатор',e.employeeId],['Должность',e.role],['Подразделение',e.department],['Команда',e.team],['Руководитель',e.manager],['Начало работы',e.startDate],['Стаж',tenure()],['Город',e.city],['Рабочая почта',e.email]].map(([label,value])=>`<div class="attempt-row"><span class="muted">${label}</span><strong style="font-size:10px;font-weight:500;text-align:right">${esc(value)}</strong></div>`).join('')}`);
  if(id==='meetings')openModal('Встречи и обратная связь',`${state.meetings.length?state.meetings.map(m=>`<div class="card"><h3 class="small">${esc(m.topic)}</h3><p class="body-copy">${m.slot}<br>${esc(e.manager)}</p>${pill(m.status==='completed'?'Состоялась · +100 XP каждому':'Запланировано',m.status==='completed'?'check':'calendar')}</div>`).join(''):`<div class="empty">${icon('people')}<h3>Начните с разговора</h3><p>На встрече можно обсудить цель,<br>сложную задачу или обратную связь.</p></div>`}<button class="primary-btn full" data-action="navigate" data-view="call" style="margin-top:15px">Открыть видеовстречу 1:1</button><button class="text-btn" data-action="schedule">Запланировать на другое время</button>`);
  if(id==='privacy')openModal('Данные и доступ',`<p class="body-copy">Ваш профиль объединяет данные, которые помогают планировать развитие.</p><ul class="modal-list"><li>HR-профиль: роль, подразделение, руководитель и стаж.</li><li>Развитие: тесты, попытки, навыки, сертификаты и цели.</li><li>Вклад: встречи, code review, наставничество и задачи Jira.</li><li>Игровой прогресс: XP, уровень и оформление дерева.</li></ul><div class="card"><h3 class="small">Кто видит данные</h3><p class="body-copy">Вы — весь свой профиль. Руководитель — план развития и подтверждаемый вклад. HR — карьерные цели и навыки.</p></div><div class="help-text">${icon('info')}Изменения профиля остаются в памяти до перезагрузки. Студия автора отправляет запросы генерации в OpenAI отдельно от данных сотрудника.</div>`);
}
function demoProfile(){openModal('Демо-профиль',`<div class="demo-warning">Смена профиля перезапускает демо. Так можно сравнить размер дерева по стажу и проверить вход сотрудника.</div>${data.employees.map(e=>`<button class="goal-choice" data-action="employee" data-id="${e.id}"><h3>${esc(e.name)}</h3><p>${esc(e.role)}</p>${pill(tenure(e.tenureMonths)+' в компании')}${pill(fmt(e.xp)+' XP')}</button>`).join('')}<button class="goal-choice" data-action="employee" data-id="guest"><h3>Клиент Halyk</h3><p>Не сотрудник · сервис «Мой рост» скрыт</p></button>`);}

function openDemoSettings(){
  const e=state.employee;
  openModal('Пульт прототипа',`<p class="modal-intro">Изменения сразу видны во всех разделах. Данные вымышленные и сбрасываются при перезагрузке.</p><div class="live-indicator"><i></i> Синхронизация в реальном времени</div><div class="settings-grid">
  <label class="field">Имя сотрудника<input data-demo-field="name" value="${esc(e.name)}" maxlength="70"></label>
  <label class="field">Должность<select data-demo-field="role">${POSITIONS.map(p=>`<option value="${esc(p.title)}" ${p.title===e.role?'selected':''}>${esc(p.title)}</option>`).join('')}</select></label>
  <label class="field">Подразделение<input data-demo-field="department" value="${esc(e.department)}" maxlength="70"></label>
  <label class="field">Руководитель<input data-demo-field="manager" value="${esc(e.manager)}" maxlength="70"></label>
  <label class="field">Стаж, месяцев<input type="number" data-demo-field="tenureMonths" min="1" max="120" value="${e.tenureMonths}"></label>
  <label class="field">Опыт сотрудника, XP<input type="number" data-demo-field="xp" min="0" max="100000" value="${state.xp}"></label>
  <label class="field">Опыт тимлида, XP<input type="number" data-demo-field="leadXp" min="0" max="100000" value="${state.leadXp}"></label>
  <label class="field">Карьерная цель<select data-demo-field="goalId">${data.goals.map(g=>`<option value="${g.id}" ${g.id===state.goalId?'selected':''}>${esc(g.title)}</option>`).join('')}</select></label>
  <label class="field">Вид дерева<select data-demo-field="tree">${data.trees.map(t=>`<option value="${t.id}" ${state.tree===t.id?'selected':''}>${t.name}</option>`).join('')}</select></label>
  <label class="field">Палитра<select data-demo-field="theme">${data.themes.map(t=>`<option value="${t.id}" ${state.theme===t.id?'selected':''}>${t.name}</option>`).join('')}</select></label></div>
  <div class="settings-section"><h4>Доступ к тестам</h4><label class="field">Посмотреть интерфейс от имени<select data-demo-field="actor">${data.access.users.map(user=>`<option value="${user.id}" ${user.id===actorId?'selected':''}>${esc(user.name)} — ${esc(user.label)}</option>`).join('')}</select></label><p class="field-note">Только назначенные авторы могут менять вопросы, порог и параметры своих тестов. Этот переключатель имитирует вход пользователя.</p></div>
  <div class="settings-section"><h4>Навыки</h4><p class="field-note">Добавьте навык в список. После прохождения его отметка появится на дереве.</p><form id="add-skill-form" class="inline-form"><input name="skillName" aria-label="Название нового навыка" placeholder="Например, Kubernetes" maxlength="50" required><button class="secondary-btn" type="submit">${icon('plus')}Добавить</button></form><label class="field">Состояние навыка<select id="demo-skill">${state.tests.map(t=>`<option value="${t.id}">${esc(t.title)}</option>`).join('')}</select></label><div class="demo-status-buttons"><button class="secondary-btn" data-action="demo-status" data-status="new">Не начато</button><button class="secondary-btn" data-action="demo-status" data-status="passed">Пройдено</button><button class="secondary-btn" data-action="demo-status" data-status="failed">Повторить</button></div><p class="field-note">Смена состояния здесь — симуляция. XP за тест начисляется при настоящем прохождении демо-вопросов.</p></div>
  <details class="demo-debug"><summary>Состояние интерфейса</summary><pre id="demo-state"></pre></details><div class="modal-actions"><button class="text-btn" data-action="demo-profile">Сменить сотрудника</button><button class="text-btn" data-action="reset">Сбросить демо</button><button class="primary-btn" data-action="close-modal">Готово ${icon('check')}</button></div>`,'settings');
  renderStudio();
}
function updateDemo(input){
  const key=input.dataset.demoField;
  if(key==='actor'){
    if(!data.access.users.some(user=>user.id===input.value))return;
    actorId=input.value;document.cookie=`halyk_demo_actor=${actorId}; Path=/; SameSite=Strict`;
  } else if(['xp','leadXp','tenureMonths'].includes(key)){
    if(!input.value||!input.checkValidity())return;
    const value=Math.round(Number(input.value));
    if(key==='tenureMonths'){state.employee.tenureMonths=value;const date=new Date(data._document.date);date.setMonth(date.getMonth()-value);state.employee.startDate=new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',year:'numeric'}).format(date);}else state[key]=value;
  } else if(key==='role'){
    state.employee.role=input.value;
    const position=POSITIONS.find(p=>p.title===input.value);
    state.tests.forEach(t=>{t.required=position.skills.includes(t.id);});state.category='Все';state.filter='all';state.search='';
  } else if(['name','department','manager'].includes(key)){
    state.employee[key]=input.value;
    if(key==='name'){state.employee.firstName=input.value.trim().split(' ')[0]||'Сотрудник';state.employee.initials=input.value.trim().split(/\s+/).slice(0,2).map(n=>n[0]||'').join('').toUpperCase();}
  } else if(['goalId','tree','theme'].includes(key)) state[key]=input.value;
  state.employee.xp=state.xp;state.employee.goalId=state.goalId;state.employee.tree=state.tree;state.employee.theme=state.theme;
  state.draft={tree:state.tree,theme:state.theme};
  render(true);app.inert=true;
}
function addDemoSkill(form){
  const title=form.elements.skillName.value.trim();if(!title)return;
  const id='custom-'+crypto.randomUUID();
  // A custom skill starts as a draft until an assigned author writes its questions.
  const t={id,title,skill:title,category:'Дополнительные',required:false,status:'new',score:null,minutes:10,xp:200,passScore:80,questionSet:id,description:'Новый навык в вашем плане развития.',preparation:'Вспомните задачу, где вы применяли этот навык, и опишите полученный результат.',editorIds:['daniyar'],draft:true};
  state.tests.push(t);state.questions[id]=[];state.plan.push(id);
  render(true);openDemoSettings();toast('Навык добавлен. Назначенный автор может подготовить вопросы.');
}
function testPrompt(t){
  const position=POSITIONS.find(p=>p.title===state.employee.role&&p.skills.includes(t.id))||POSITIONS.find(p=>p.skills.includes(t.id));
  if(!position)return 'Создайте вопросы по навыку «'+t.title+'» для роли «'+state.employee.role+'». Укажите варианты, один верный ответ и объяснение.';
  const prompt=buildPrompt({positionId:position.id,skillId:t.id,level:position.level,language:'ru',questionCount:10});
  return `SYSTEM\n${prompt.system}\n\nUSER\n${prompt.user}`;
}
function editTest(id){
  if(!canEdit(id)){toast('Настройки доступны только назначенному автору этого теста.');return;}
  const t=test(id),questions=state.questions[t.questionSet];
  openModal('Настройки · '+esc(t.title),`<div class="live-indicator">${icon('shield')}${esc(actor().name)} · назначенный автор</div><form id="test-editor" data-id="${id}"><div class="settings-grid"><label class="field">Порог прохождения, %<input name="passScore" type="number" min="1" max="100" value="${t.passScore}" required></label><label class="field">Награда, XP<input name="xp" type="number" min="0" max="2000" value="${t.xp}" required></label></div><label class="field">Подготовка для сотрудника<textarea name="preparation" maxlength="1000" required>${esc(t.preparation)}</textarea></label><div class="section-heading"><h3 id="editor-count">Вопросы · ${questions.length}</h3><button type="button" class="text-btn" data-action="editor-add-question">${icon('plus')}Добавить</button></div><div id="editor-questions">${questions.map((q,i)=>questionEditor(q,i)).join('')}</div><details class="prompt-source"><summary>Промпт генерации для этого навыка</summary><pre>${esc(testPrompt(t))}</pre></details>${getSkill(id)?`<a class="author-entry" href="/test-lab.html?skill=${id}" target="_blank" rel="noopener">${icon('spark')}Открыть генератор вопросов ${icon('arrow')}</a>`:''}<div class="help-text">Настройки действуют в этой сессии. Сохранение не меняет уже полученные награды.</div><div class="modal-actions"><button type="button" class="secondary-btn" data-action="close-modal">Отмена</button><button type="submit" class="primary-btn">Сохранить тест ${icon('check')}</button></div></form>`,'test-editor');
}
function questionEditor(q,i){return `<fieldset class="question-editor"><legend>Вопрос ${i+1}</legend><label class="field">Формулировка<textarea name="q${i}" required maxlength="1000">${esc(q.text)}</textarea></label><div class="question-options">${q.options.map((option,j)=>`<label><input type="radio" name="correct${i}" value="${j}" ${q.correct===j?'checked':''} required aria-label="Верный ответ ${j+1}"><input name="q${i}o${j}" aria-label="Вариант ${j+1}" value="${esc(option)}" required maxlength="500"></label>`).join('')}</div><label class="field">Объяснение<textarea name="explanation${i}" required maxlength="1000">${esc(q.explanation)}</textarea></label><p class="field-note">Отметьте один правильный ответ.</p></fieldset>`;}
function saveTestEditor(form){
  const id=form.dataset.id;if(!canEdit(id)){closeModal();toast('Нет доступа к редактированию.');return;}
  const t=test(id),values=new FormData(form),sets=[...form.querySelectorAll('.question-editor')];
  if(!sets.length){toast('Добавьте хотя бы один вопрос.');return;}
  const questions=sets.map((_,i)=>({text:values.get('q'+i).trim(),options:[0,1,2,3].map(j=>values.get(`q${i}o${j}`).trim()),correct:Number(values.get('correct'+i)),explanation:values.get('explanation'+i).trim()}));
  if(questions.some(q=>!q.text||!q.explanation||q.options.some(o=>!o)||new Set(q.options).size!==4)){toast('Заполните вопросы и четыре разных варианта ответа.');return;}
  // Copy on edit so tests that started from the same demo question set stay independent.
  t.questionSet='edited-'+id;state.questions[t.questionSet]=questions;t.passScore=Number(values.get('passScore'));t.xp=Number(values.get('xp'));t.preparation=values.get('preparation').trim();t.draft=false;
  if(state.quiz?.testId===id)state.quiz=null;
  closeModal(false);render(true);toast('Вопросы и настройки теста сохранены.');
}
function callView(){
  const c=state.call,ended=c.status==='ended';
  return header('Встреча 1:1',{back:'growth'})+`<main class="screen call-screen" id="screen"><div class="call-intro"><div><span class="eyebrow">РАЗВИТИЕ НАЧИНАЕТСЯ С РАЗГОВОРА</span><h1>Время <em>для 1:1.</em></h1><p>${esc(goal().title)} · ${esc(state.employee.manager)}</p></div><span class="demo-badge">ДЕМО ВИДЕОВСТРЕЧИ</span></div><div class="recording-notice">${icon('info')}Камера и микрофон не включаются. Аудио и видео в демо не записываются.</div><div class="call-stage"><section class="participant employee-video"><span class="participant-top">${c.status==='active'?'<i class="record-dot"></i>Симуляция записи аудио и видео':'Видеовстреча · демо'}</span><div class="participant-avatar">${esc(state.employee.initials)}</div><div class="participant-footer"><div><strong>${esc(state.employee.name)}</strong><span>Сотрудник · <b id="call-employee-xp">${fmt(state.xp)}</b> XP</span></div><span>${c.muted?'Микрофон выкл.':'Вы'}</span></div></section><section class="participant lead-video ${c.leadPresent?'':'absent'}"><span class="participant-top">${c.leadPresent?'Участник подключён':'Тимлид отключился · таймер на паузе'}</span><div class="participant-avatar">${state.employee.manager.split(' ').map(n=>esc(n[0]||'')).slice(0,2).join('')}</div><div class="participant-footer"><div><strong>${esc(state.employee.manager)}</strong><span>Тимлид · <b id="call-lead-xp">${fmt(state.leadXp)}</b> XP</span></div><span>Демо</span></div></section></div>
  <div class="call-control-bar"><div class="call-timer"><span id="call-clock">${clockText(c.elapsed)}</span><small>из 15:00 совместного разговора</small></div><div class="call-controls">${c.status==='ready'||ended?`<button class="primary-btn" data-action="call-consent">${icon('people')}${ended?'Новая встреча':'Начать демо-встречу'}</button>`:`<button class="secondary-btn" data-action="call-mute" aria-pressed="${!!c.muted}">${icon('message')}${c.muted?'Включить микрофон':'Микрофон'}</button><button class="secondary-btn" data-action="call-pause">${icon('clock')}${c.status==='paused'?'Продолжить':'Пауза'}</button><button class="end-call" data-action="call-end">Завершить</button>`}</div></div>
  <div class="call-progress">${progress(Math.min(100,c.elapsed/CALL_TARGET_MS*100))}</div><div id="call-reward" class="call-reward ${c.rewarded?'earned':''}" role="status">${callRewardText()}</div>
  <div class="call-details"><section><span class="eyebrow">О ЧЁМ ПОГОВОРИТЬ</span><h3>Следующий шаг к вашей цели</h3><ol><li>Что получилось за последние две недели?</li><li>Где нужна помощь или обратная связь?</li><li>Какую практическую задачу взять следующей?</li></ol></section><section class="call-demo-controls"><span class="eyebrow">ПУЛЬТ ДЕМО</span><p>Таймер идёт, пока оба участника подключены и микрофон включён. Ускорение позволяет проверить начисление XP без ожидания.</p><div class="row"><button class="secondary-btn" data-action="call-near-end" ${c.status!=='active'||!c.leadPresent||c.muted||c.rewarded?'disabled':''}>До 14:59</button><button class="secondary-btn" data-action="call-plus" ${c.status!=='active'||!c.leadPresent||c.muted?'disabled':''}>+1 мин · демо</button></div><button class="text-btn" data-action="call-lead" ${['ready','ended'].includes(c.status)?'disabled':''}>${c.leadPresent?'Отключить тимлида':'Подключить тимлида'} · демо</button><p class="field-note" id="call-mode">${c.demoAdvanced?'Время ускорено в демо.':'Реальное течение времени в симуляции.'}</p></section></div></main>`;
}
function callRewardText(){const c=state.call;return c.rewarded?`${icon('check')}Встреча засчитана · +${CALL_XP} XP сотруднику и +${CALL_XP} XP тимлиду${c.demoAdvanced?' · время ускорено в демо':''}`:c.status==='ended'?`${icon('info')}Меньше 15 минут совместного разговора. XP не начислен.`:`${icon('spark')}После 15 минут · +${CALL_XP} XP каждому участнику`;}
function tickActiveCall(){
  if(!state)return;
  const reward=tickCall(state.call,performance.now());
  if(reward){state.xp+=reward;state.leadXp+=reward;state.employee.xp=state.xp;state.meetings.push({id:'call-'+state.call.id,topic:goal().title,slot:'Сегодня · 15 минут разговора',status:'completed'});state.contributions.unshift({id:'call-'+state.call.id,title:'1:1 · '+state.employee.manager,detail:'15 минут совместного разговора'+(state.call.demoAdvanced?' · ускоренная симуляция':' · симуляция'),type:'meeting',status:'confirmed',xp:reward,date:'Сегодня'});toast(`Встреча засчитана. +${reward} XP каждому участнику.`);if(state.view!=='call')render(true);}
}
function updateCallReadout(){
  if(!state||state.view!=='call')return;
  const c=state.call;
  const clock=document.querySelector('#call-clock');if(!clock)return;
  clock.textContent=clockText(c.elapsed);document.querySelector('.call-progress .progress span').style.width=Math.min(100,c.elapsed/CALL_TARGET_MS*100)+'%';
  document.querySelector('#call-employee-xp').textContent=fmt(state.xp);document.querySelector('#call-lead-xp').textContent=fmt(state.leadXp);
  const reward=document.querySelector('#call-reward');const signature=[c.rewarded,c.status==='ended',c.demoAdvanced].join(':');if(reward.dataset.state!==signature){reward.innerHTML=callRewardText();reward.dataset.state=signature;}reward.classList.toggle('earned',c.rewarded);
  const fast=document.querySelector('[data-action="call-near-end"]');if(fast)fast.disabled=c.rewarded||c.status!=='active'||!c.leadPresent||c.muted;
}
function callConsent(){
  openModal('Перед началом встречи',`<div class="recording-policy"><span class="record-dot"></span><strong>Уведомление о записи</strong><p>В рабочем сценарии аудио и видео встречи записываются после согласия обоих участников. До подключения каждый участник видит это уведомление.</p></div><div class="demo-warning">Это симуляция: доступ к камере и микрофону не запрашивается, файлы записи не создаются.</div><label class="consent-check"><input id="employee-consent" type="checkbox">Сотрудник ознакомлен с уведомлением · демо</label><label class="consent-check"><input id="lead-consent" type="checkbox">Тимлид ознакомлен с уведомлением · демо</label><button class="primary-btn full" data-action="call-start" style="margin-top:20px">Начать симуляцию ${icon('arrow')}</button><p class="field-note">XP начисляется каждому один раз за встречу после 15 минут совместного разговора.</p>`,'call-consent');
}
function handleExtraAction(action,el){
  const id=el.dataset.id;
  if(action==='tree-passed'){treeFilter='passed';treeSearch='';render(true);document.querySelector('#tree-information').scrollIntoView({behavior:'smooth',block:'start'});return true;}
  if(action==='tree-details'){document.querySelector('#tree-information').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});return true;}
  if(action==='tree-filter'){treeFilter=treeFilter===el.dataset.filter?'all':el.dataset.filter;render(true);return true;}
  if(action==='demo-settings'){openDemoSettings();return true;}
  if(action==='edit-test'){editTest(id);return true;}
  if(action==='editor-add-question'){if(modalType!=='test-editor')return true;const list=document.querySelector('#editor-questions');list.insertAdjacentHTML('beforeend',questionEditor({text:'',options:['','','',''],correct:0,explanation:''},list.children.length));document.querySelector('#editor-count').textContent='Вопросы · '+list.children.length;list.lastElementChild.querySelector('textarea').focus();return true;}
  if(action==='demo-status'){const t=test(document.querySelector('#demo-skill').value);t.status=el.dataset.status;t.score=t.status==='passed'?100:t.status==='failed'?60:null;if(t.status==='passed')newestAchievement=t.id;render(true);app.inert=true;return true;}
  if(!action.startsWith('call-'))return false;
  tickActiveCall();let c=state.call;
  if(action==='call-consent'){callConsent();return true;}
  if(action==='call-start'){
    if(!document.querySelector('#employee-consent')?.checked||!document.querySelector('#lead-consent')?.checked){toast('Нужно подтверждение обоих участников.');return true;}
    state.call=createCall();c=state.call;c.consent=true;c.status='active';c.startedAt=performance.now();navigate('call');return true;
  }
  if(action==='call-end'){c.status='ended';c.startedAt=null;render(true);return true;}
  if(action==='call-pause'){if(!['active','paused'].includes(c.status))return true;c.status=c.status==='paused'?'active':'paused';c.startedAt=c.status==='active'?performance.now():null;}
  if(action==='call-lead'){c.leadPresent=!c.leadPresent;}
  if(action==='call-mute'){c.muted=!c.muted;}
  if(['call-plus','call-near-end'].includes(action)&&c.status==='active'&&c.leadPresent&&!c.muted){c.demoAdvanced=true;c.elapsed=action==='call-near-end'?Math.max(c.elapsed,CALL_TARGET_MS-1000):c.elapsed+60000;tickActiveCall();}
  render(true);return true;
}
function initializeWidget(){
  const widget=document.querySelector('#demo-widget');let drag=null,suppressClick=false;
  widget.innerHTML=icon('settings');
  widget.addEventListener('pointerdown',event=>{if(event.button!==0)return;const box=widget.getBoundingClientRect();drag={x:event.clientX,y:event.clientY,left:box.left,top:box.top,moved:false};widget.setPointerCapture(event.pointerId);});
  widget.addEventListener('pointermove',event=>{if(!drag)return;const dx=event.clientX-drag.x,dy=event.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>5)drag.moved=true;if(!drag.moved)return;widget.style.right='auto';widget.style.bottom='auto';widget.style.left=Math.min(innerWidth-62,Math.max(8,drag.left+dx))+'px';widget.style.top=Math.min(innerHeight-80,Math.max(8,drag.top+dy))+'px';});
  widget.addEventListener('pointerup',()=>{suppressClick=!!drag?.moved;drag=null;});
  widget.addEventListener('pointercancel',()=>{drag=null;suppressClick=true;});
  widget.addEventListener('click',event=>{if(suppressClick){event.stopPropagation();suppressClick=false;}},true);
  widget.addEventListener('keydown',event=>{if(!event.key.startsWith('Arrow'))return;event.preventDefault();const box=widget.getBoundingClientRect(),delta=event.shiftKey?40:10;widget.style.right='auto';widget.style.bottom='auto';widget.style.left=Math.min(innerWidth-62,Math.max(8,box.left+(event.key==='ArrowLeft'?-delta:event.key==='ArrowRight'?delta:0)))+'px';widget.style.top=Math.min(innerHeight-80,Math.max(8,box.top+(event.key==='ArrowUp'?-delta:event.key==='ArrowDown'?delta:0)))+'px';});
  window.addEventListener('resize',()=>{if(!widget.style.left)return;widget.style.left=Math.max(8,Math.min(innerWidth-62,parseFloat(widget.style.left)))+'px';widget.style.top=Math.max(8,Math.min(innerHeight-80,parseFloat(widget.style.top)))+'px';});
}

document.addEventListener('click',event=>{
  const el=event.target.closest('[data-action]');if(!el||el.disabled)return;
  const {action,id,view}=el.dataset;
  if(handleExtraAction(action,el))return;
  if(action==='navigate'){navigate(view);return;}
  if(action==='close-modal'){closeModal();return;}
  if(action==='modal-backdrop'){if(event.target===el)closeModal();return;}
  if(action==='reset'){reset(state.isEmployee?state.employee.id:'guest');toast('Демо началось заново');return;}
  if(action==='employee'){actorId='employee';document.cookie='halyk_demo_actor=employee; Path=/; SameSite=Strict';reset(id);return;}
  if(action==='demo-profile'){demoProfile();return;}
  if(action==='test-open'){openTest(id);return;}
  if(action==='status-filter'){state.filter=el.dataset.filter;state.testTab='required';state.category='Все';state.search='';navigate('tests');return;}
  if(action==='test-tab'){state.testTab=el.dataset.tab;state.filter='all';state.category='Все';state.search='';render();return;}
  if(action==='filter'){state.filter=el.dataset.filter;render(true);return;}
  if(action==='category'){state.category=el.dataset.category;render(true);return;}
  if(action==='clear-filters'){state.filter='all';state.search='';state.category='Все';render();return;}
  if(action==='add-test'){if(!state.plan.includes(id))state.plan.push(id);render(true);toast('«'+test(id).title+'» добавлен в ваш план');return;}
  if(action==='start-quiz'){startQuiz(id);return;}
  if(action==='replace-quiz'){state.quiz=null;startQuiz(id);return;}
  if(action==='resume-quiz'){navigate('quiz');return;}
  if(action==='answer'){state.quiz.answers[state.quiz.index]=Number(el.dataset.answer);render(true);document.querySelector(`[data-action="answer"][data-answer="${el.dataset.answer}"]`).focus({preventScroll:true});return;}
  if(action==='question-back'){state.quiz.index--;render();return;}
  if(action==='question-next'){if(state.quiz.answers[state.quiz.index]===undefined)return;const t=test(state.quiz.testId);if(state.quiz.index===state.questions[t.questionSet].length-1)finishQuiz();else{state.quiz.index++;render();}return;}
  if(action==='goal-picker'){goalPicker(el.dataset.type);return;}
  if(action==='set-goal'){state.goalId=id;closeModal(false);navigate('goals');toast('Новая цель сохранена. Ваш план обновлён.');return;}
  if(action==='tree-choice'||action==='theme-choice'){const option=(action==='tree-choice'?data.trees:data.themes).find(x=>x.id===id);if(state.xp<option.xp){toast(`Ещё ${fmt(option.xp-state.xp)} XP, чтобы открыть «${option.name}»`);return;}state.draft[action==='tree-choice'?'tree':'theme']=id;render(true);return;}
  if(action==='save-custom'){state.tree=state.draft.tree;state.theme=state.draft.theme;navigate('growth');toast('Ваше дерево обрело новый характер');return;}
  if(action==='schedule'){schedule();return;}
  if(action==='activity-open'){activityOpen(id);return;}
  if(action==='confirm-preview'){const c=state.contributions.find(c=>c.id===id);openModal('Подтвердить результат',`<div class="demo-warning">Действие руководителя в демо. В реальном приложении сотрудник не подтверждает собственный вклад.</div><h3 class="small">${esc(c.title)}</h3><p class="body-copy">${esc(c.detail)}</p><div class="row between"><span class="small muted">После подтверждения</span>${xp(c.xp)}</div><button class="primary-btn full" style="margin-top:20px" data-action="confirm-contribution" data-id="${id}">Подтвердить · демо</button>`);return;}
  if(action==='confirm-contribution'){const c=state.contributions.find(c=>c.id===id);const earned=award(c.id,c.xp);c.status='confirmed';c.detail='Подтвердил: '+state.employee.manager;closeModal(false);render(true);toast(earned?`Вклад подтверждён. +${earned} XP в вашу копилку`:'Этот вклад уже учтён');return;}
  if(action==='jira-settings'){jiraSettings();return;}
  if(action==='jira-toggle'){state.jiraConnected=!state.jiraConnected;closeModal(false);render(true);toast(state.jiraConnected?'Демо-подключение Jira активно':'Демо-подключение Jira отключено');return;}
  if(action==='jira-sync'){if(!state.jiraConnected){jiraSettings();return;}const added=!state.jiraSynced;if(added){state.contributions.unshift(clone(data.jira.newTask));state.jiraSynced=true;}state.lastSync='11:24';closeModal(false);render(true);toast(added?'Jira синхронизирована: 1 новый результат ждёт подтверждения':'Всё актуально. Новых результатов нет.');return;}
  if(action==='profile-detail'){profileDetail(id);return;}
  if(action==='notifications'){openModal('Хорошие новости',`<div class="card"><div class="row">${icon('sprout')}<h3 class="small">У вас есть следующий шаг</h3></div><p class="body-copy">${nextTest()?.title||'Все тесты завершены'} — небольшая инвестиция в ваше развитие.</p><button class="text-btn" data-action="navigate" data-view="tests">Открыть мой план ${icon('arrow')}</button></div><div class="card"><h3 class="small">Ваш вклад ждёт подтверждения</h3><p class="body-copy">${state.contributions.filter(c=>c.status!=='confirmed').length} записей в истории вклада.</p><button class="text-btn" data-action="navigate" data-view="activities">Посмотреть ${icon('arrow')}</button></div>`);return;}
  if(action==='all-services'){openModal('Сервисы Halyk',`<div class="bank-services" style="margin-top:0">${data.bank.services.map(s=>`<button class="bank-service" data-action="bank-service" data-name="${esc(s.name)}">${icon(s.icon)}${esc(s.name)}</button>`).join('')}</div>${state.isEmployee?`<button class="goal-card" style="margin-top:16px" data-action="navigate" data-view="growth"><span class="icon-tile">${icon('sprout')}</span><div class="grow"><strong class="small">Мой рост</strong><p class="tiny muted" style="margin-top:5px">Для сотрудников Halyk</p></div>${icon('chevron')}</button>`:''}`);return;}
  if(action==='bank-service'){const name=el.dataset.name;if(name==='Главная')return;if(name==='Карты'||name==='Мой банк'){openModal('Мой банк',`<div class="bank-product"><span class="pill">${data.bank.card}</span><h3>•••• ${data.bank.lastDigits}</h3><strong>${fmt(data.bank.balance)} ₸</strong><p class="small muted">Демонстрационный баланс</p></div><button class="secondary-btn full" style="margin-top:17px" data-action="close-modal">Вернуться на главную</button>`);}else{openModal(name,`<div class="empty">${icon(data.bank.services.find(s=>s.name===name)?.icon||'qr')}<h3>${name} в Halyk</h3><p>Это контекст банковского супераппа.<br>Интерактивный сценарий развития доступен в «Мой рост».</p></div>${state.isEmployee?`<button class="primary-btn full" data-action="navigate" data-view="growth">Открыть Мой рост ${icon('arrow')}</button>`:''}`);}return;}
});
document.addEventListener('input',event=>{
  if(event.target.id==='tree-search'){const position=event.target.selectionStart;treeSearch=event.target.value;render(true);const input=document.querySelector('#tree-search');input.focus({preventScroll:true});input.setSelectionRange(position,position);}
  if(event.target.matches('[data-demo-field]'))updateDemo(event.target);
  if(event.target.id==='test-search'){const position=event.target.selectionStart;state.search=event.target.value;render(true);const input=document.querySelector('#test-search');input.focus({preventScroll:true});input.setSelectionRange(position,position);}
  if(event.target.id==='bank-search'){const term=event.target.value.toLowerCase();document.querySelectorAll('.bank-service,.service-small').forEach(el=>el.hidden=!el.textContent.toLowerCase().includes(term));const entry=document.querySelector('.growth-entry');if(entry)entry.hidden=!!term&&!('рост развитие сотрудники навыки'.includes(term));}
});
document.addEventListener('change',event=>{if(event.target.id==='employee-select')reset(event.target.value);});
document.addEventListener('submit',event=>{
  event.preventDefault();const form=event.target,values=new FormData(form);
  if(form.id==='test-editor'){saveTestEditor(form);return;}
  if(form.id==='add-skill-form'){addDemoSkill(form);return;}
  if(form.id==='meeting-form'){const topic=String(values.get('topic')).trim(),slot=String(values.get('slot'));if(!topic)return;const id='meeting-'+slot;if(state.contributions.some(c=>c.id===id)){toast('Встреча на это время уже запланирована');return;}state.meetings.push({id,topic,slot});state.contributions.unshift({id,title:'1:1 · '+topic,detail:slot+' · '+state.employee.manager,type:'meeting',status:'scheduled',xp:100,date:slot});closeModal(false);render(true);toast('Встреча запланирована на '+slot);}
  if(form.id==='contribution-form'){const title=String(values.get('title')).trim(),detail=String(values.get('detail')).trim();if(!title||!detail)return;const kind=form.dataset.kind;state.contributions.unshift({id:'contribution-'+crypto.randomUUID(),title,detail,type:kind,status:'pending',xp:data.activities.find(a=>a.id===kind).xp,date:'Сегодня'});closeModal(false);navigate('activities');toast('Ваш вклад отправлен на подтверждение');}
});
document.addEventListener('keydown',event=>{
  if(modalType){if(event.key==='Escape'){closeModal();return;}if(event.key==='Tab'){const targets=[...modalRoot.querySelectorAll('button:not([disabled]), input, select, textarea, [tabindex="0"]')];const first=targets[0],last=targets.at(-1);if(event.shiftKey&&(document.activeElement===first||document.activeElement===modalRoot.querySelector('.modal'))){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}return;}
  if(['INPUT','TEXTAREA','SELECT','BUTTON'].includes(document.activeElement?.tagName)||document.activeElement?.isContentEditable)return;

  if((event.key==='Enter'||event.key===' ')&&event.target.matches('[role="button"][data-action]')){event.preventDefault();event.target.click();}
});
initializeWidget();
setInterval(()=>{tickActiveCall();updateCallReadout();},250);
reset(data.employees.some(e=>e.id===qs.get('employee'))?qs.get('employee'):'aizhan',['growth','tests','call','profile','goals'].includes(qs.get('view'))?qs.get('view'):qs.has('variant')?'growth':'bank');
