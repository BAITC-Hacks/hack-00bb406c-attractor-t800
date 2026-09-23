// Synthetic demo data and rules, not an official bank assessment policy.
export const DEMO_MONTH = '2026-10';
export const PASS_SCORE = 80;
export const CATEGORIES = [
  { id:'backend',label:'Backend-разработка',icon:'code' },
  { id:'data',label:'Данные и AI',icon:'database' },
  { id:'product',label:'Продукт и бизнес',icon:'layers' },
  { id:'communication',label:'Коммуникация',icon:'message-circle' },
  { id:'leadership',label:'Лидерство',icon:'users' },
];
const q = (id,prompt,options,correct,explanation) => ({id,prompt,options,correct,explanation});
export const TESTS = [
 {id:'python',skillId:'python',title:'Python',category:'backend',level:1,duration:5,mustHave:true,description:'Коллекции, исключения и надёжный код.',questions:[
 q('py1','Какой тип подходит для уникальных значений?',['list','set','tuple','str'],1,'Множество set хранит уникальные элементы и поддерживает проверку принадлежности.'),
 q('py2','Что делает блок finally?',['Выполняется только при ошибке','Всегда выполняет завершающие действия','Игнорирует исключение','Перезапускает функцию'],1,'finally выполняет завершающие действия и при успехе, и при выходе из-за исключения.'),
 q('py3','Почему изменяемый список как аргумент по умолчанию опасен?',['Он всегда пустой','Он не поддерживает append','Один объект разделяется между вызовами','Он копируется при каждом вызове'],2,'Значение аргумента по умолчанию создаётся один раз и может сохранить изменения между вызовами.'),
 q('py4','Как безопасно закрывать открытый файл?',['Через with open(...)','Не закрывать','Вызвать print','Удалить имя переменной'],0,'Контекстный менеджер with закрывает файл при выходе из блока, в том числе при исключении.'),
 q('py5','Что возвращает генератор при вызове функции с yield?',['Готовый список','Итератор','Число элементов','Только None'],1,'Генератор возвращает итератор и вычисляет элементы по мере обращения.') ]},
 {id:'api-design',skillId:'api',title:'API Design',category:'backend',level:2,duration:6,mustHave:true,description:'Контракты, ошибки и повторные запросы.',questions:[
 q('api1','Клиент повторил создание платежа после таймаута. Что предотвратит дубль?',['Больше таймаут','Idempotency key','Ещё один POST','Кэш браузера'],1,'Ключ идемпотентности позволяет вернуть результат первой операции вместо повторного создания.'),
 q('api2','Как ответить на корректный запрос к отсутствующему ресурсу?',['200','404','500','301'],1,'404 обозначает отсутствие запрошенного ресурса, а не внутреннюю ошибку сервера.'),
 q('api3','Что полезно включить в ответ об ошибке?',['Пароль БД','Трассировку с секретами','Код ошибки и correlation ID','Только пустой ответ'],2,'Стабильный код помогает клиенту обработать ошибку, correlation ID — найти её в журнале.'),
 q('api4','Как возвращать большой изменяющийся список?',['Весь список сразу','Курсорная пагинация','Случайные 10 строк','Только число строк'],1,'Курсорная пагинация ограничивает объём ответа и снижает риск пропусков при изменении списка.'),
 q('api5','Где проверять право пользователя на конкретный объект?',['Только в UI','На сервере при каждом запросе','Только при регистрации','В названии URL'],1,'Серверная проверка доступа необходима независимо от того, скрыта ли кнопка в интерфейсе.') ]},
 {id:'git',skillId:'git',title:'Git и code review',category:'backend',level:1,duration:5,mustHave:true,description:'Работа в команде без потери изменений.',questions:[
 q('git1','Как предложить изменения в общей ветке для проверки?',['Удалить ветку','Создать pull request','Прислать скриншот','Сделать force push в main'],1,'Pull request позволяет обсудить diff, запустить проверки и провести ревью до слияния.'),
 q('git2','Что сделать перед разрешением конфликта?',['Выбрать весь свой файл','Понять обе версии изменений','Удалить маркеры наугад','Отменить чужой коммит'],1,'Конфликт разрешают с учётом намерений обеих сторон, чтобы не потерять поведение.'),
 q('git3','Куда поместить токен доступа?',['В README','В коммит','В хранилище секретов','В имя ветки'],2,'Секреты хранят отдельно от репозитория и передают через защищённую конфигурацию.'),
 q('git4','Как безопаснее отменить опубликованный коммит в общей ветке?',['git revert','Удалить .git','Переписать всю историю','Удалить remote'],0,'git revert создаёт обратный коммит, сохраняя общую опубликованную историю.'),
 q('git5','Что делает ревью полезным?',['Проверка рисков и поведения','Только число строк','Только личный вкус','Одобрение без чтения'],0,'Ревью проверяет корректность, понятность и риски изменения, а не только оформление.') ]},
 {id:'system-design',skillId:'system-design',title:'System Design',category:'backend',level:3,duration:7,mustHave:false,description:'Спроектируйте устойчивый сервис под нагрузкой.',questions:[
 q('sd1','С чего начать проектирование сервиса?',['С выбора модной БД','С требований, нагрузки и ограничений','С микросервисов','С написания Dockerfile'],1,'Требования, нагрузка и ограничения определяют архитектурные решения и критерии успеха.'),
 q('sd2','Как защитить зависимый сервис от лавины повторов?',['Бесконечные retry','Ограниченные retry с backoff и jitter','Нулевой таймаут','Повторять без задержки'],1,'Ограничения, backoff и jitter снижают синхронные пики повторной нагрузки.'),
 q('sd3','Что даёт transactional outbox?',['Гарантию отсутствия любых ошибок','Связь записи данных и события в одной транзакции','Замены авторизации','Ускорение всех SQL'],1,'Outbox атомарно сохраняет данные и запись события; доставку и дедупликацию решают отдельно.'),
 q('sd4','Как проверить обещание по задержке?',['Средним за год','Метрикой p95/p99 под целевой нагрузкой','Только на ноутбуке','Количеством серверов'],1,'Перцентили под целевой нагрузкой показывают задержку большинства и хвостовых запросов.'),
 q('sd5','Какое свойство обязательно для денежных операций?',['Потеря допустима','Случайный порядок списаний','Корректность инвариантов и аудит','Только красивый UI'],2,'Денежные операции требуют сохранения инвариантов и проверяемой истории действий.') ]},
 {id:'sql',skillId:'sql',title:'SQL и анализ данных',category:'data',level:2,duration:6,mustHave:false,description:'Объединения, агрегаты и проверка выводов.',questions:[
 q('sql1','Как сохранить строки левой таблицы без совпадения справа?',['INNER JOIN','LEFT JOIN','CROSS JOIN','UNION ALL'],1,'LEFT JOIN сохраняет все строки слева, подставляя NULL для отсутствующих соответствий справа.'),
 q('sql2','Чем фильтровать группы после агрегирования?',['WHERE','ORDER BY','HAVING','LIMIT'],2,'HAVING фильтрует результат группировки, WHERE применяется к строкам до неё.'),
 q('sql3','Что делает COUNT(column) с NULL?',['Считает как 1','Пропускает','Выдаёт ошибку','Считает дважды'],1,'COUNT(column) учитывает ненулевые значения; COUNT(*) считает строки.'),
 q('sql4','После JOIN сумма выросла в 3 раза. Что проверить первым?',['Цвет графика','Кардинальность и дубликаты ключей','Часовой пояс монитора','Имя запроса'],1,'Связь один-ко-многим может размножить строки и завысить агрегаты.'),
 q('sql5','Как сравнить конверсию двух отделов?',['Только число успехов','Успехи / сопоставимые входящие обращения','Самый большой отдел','Сумму всех процентов'],1,'Нужны одинаковые определения числителя и знаменателя и сопоставимый период.') ]},
 {id:'ai-literacy',skillId:'ai-literacy',title:'AI в работе',category:'data',level:1,duration:5,mustHave:false,description:'Проверяемые ответы и бережная работа с данными.',questions:[
 q('ai1','Как поступить с уверенным ответом AI без источников?',['Сразу отправить клиенту','Проверить по надёжным источникам','Считать всегда истинным','Удалить все данные'],1,'Уверенный тон модели не гарантирует точность; значимые выводы требуют проверки.'),
 q('ai2','Что делать с персональными данными в запросе?',['Отправить в любой сервис','Использовать только разрешённый контур и минимум данных','Опубликовать промпт','Заменить пароль именем'],1,'Минимизация данных и разрешённый контур снижают риск несанкционированного раскрытия.'),
 q('ai3','Как оценить AI-помощника?',['По одному удачному ответу','По набору типичных и сложных задач','По длине ответа','По логотипу'],1,'Разнообразный проверочный набор выявляет устойчивость, ошибки и реальные ограничения.'),
 q('ai4','Как помочь модели ответить по документу?',['Не давать контекста','Дать релевантный фрагмент и попросить ссылки','Просить угадать','Запретить говорить о неопределённости'],1,'Релевантный контекст и указание основания помогают проверить связь ответа с документом.'),
 q('ai5','Что делать при недостатке данных?',['Придумать число','Указать неопределённость и запросить данные','Выбрать случайно','Скрыть ограничения'],1,'Явная неопределённость предотвращает принятие решений на выдуманных данных.') ]},
 {id:'product-discovery',skillId:'product',title:'Product Discovery',category:'product',level:2,duration:6,mustHave:false,description:'От реальной боли к проверяемой гипотезе.',questions:[
 q('pr1','Какой вопрос полезнее на интервью?',['Вам нравится наша идея?','Расскажите о последнем случае этой проблемы','Купите это прямо сейчас?','Мы ведь правы?'],1,'Конкретный прошлый опыт даёт больше фактов, чем согласие с предложенной идеей.'),
 q('pr2','Какая гипотеза проверяема?',['Сделаем лучше','Сократим время заявки с 10 до 5 минут','Добавим инновации','Будем лидерами'],1,'Измеримый результат, исходное значение и критерий позволяют проверить гипотезу.'),
 q('pr3','Что выбрать для первого MVP?',['Все функции рынка','Минимальный сценарий проверки основной ценности','Самую сложную интеграцию','Только презентацию'],1,'MVP должен проверять ключевую ценность с минимально необходимым объёмом реализации.'),
 q('pr4','Что означает рост кликов без роста успешных заявок?',['Однозначный успех','Нужно проверить воронку и целевой результат','Можно удалить аналитику','Доход точно вырос'],1,'Промежуточная активность не равна ценности; нужен анализ завершения целевого сценария.'),
 q('pr5','Как выбрать приоритет?',['По громкости просьбы','По эффекту, уверенности и стоимости проверки','По цвету карточки','Случайно'],1,'Приоритет учитывает ожидаемый эффект, качество доказательств и необходимые ресурсы.') ]},
 {id:'communication',skillId:'communication',title:'Сложные диалоги',category:'communication',level:2,duration:5,mustHave:false,description:'Обратная связь и ясные договорённости.',questions:[
 q('co1','Как начать разговор о сорванном сроке?',['Ты всегда подводишь','Вчера задача не была готова: что помешало?','Молчать неделю','Обвинить при всех'],1,'Конкретный факт и открытый вопрос помогают обсудить причину без личного обвинения.'),
 q('co2','Как проверить понимание договорённости?',['Надеяться','Кратко повторить действие, ответственного и срок','Добавить всех в копию','Отправить эмодзи'],1,'Действие, ответственный и срок делают договорённость проверяемой.'),
 q('co3','Что помогает при конфликте интересов?',['Обсудить общую цель и ограничения','Игнорировать другую сторону','Перейти на личности','Ускорить спор'],0,'Общая цель и ограничения помогают найти решение вместо борьбы позиций.'),
 q('co4','Как дать полезную обратную связь?',['Ярлык человеку','Наблюдаемое поведение, эффект и следующий шаг','Только похвала','Слухи коллег'],1,'Конкретное поведение и его эффект дают основу для понятного изменения.'),
 q('co5','Когда стоит уточнить задачу?',['После сдачи','Когда цель или критерии успеха неясны','Никогда','Только по пятницам'],1,'Раннее уточнение цели и критериев снижает риск сделать ненужную работу.') ]},
 {id:'leadership',skillId:'leadership',title:'Лидерство команды',category:'leadership',level:2,duration:6,mustHave:false,description:'Делегирование, развитие и результат команды.',questions:[
 q('le1','Что важно при делегировании?',['Каждый клик исполнителя','Ожидаемый результат, границы и точки связи','Только срок','Передать без контекста'],1,'Ясный результат, полномочия и согласованные точки связи поддерживают самостоятельность.'),
 q('le2','Команда скрывает ошибки. Что поможет?',['Наказывать за сообщения','Разбирать причины и улучшать процесс','Запретить обсуждение','Считать ошибок нет'],1,'Безопасное обсуждение причин и системные улучшения повышают обнаружение проблем.'),
 q('le3','Как выбирать задачу для развития сотрудника?',['Самую случайную','Связать цель, текущие навыки и поддержку','Только рутину','Без права задавать вопросы'],1,'Развивающая задача учитывает цель сотрудника, зону роста и доступную поддержку.'),
 q('le4','Что обсудить на 1:1?',['Только отчёт о статусе','Барьеры, обратную связь и развитие','Других сотрудников за спиной','Только зарплату'],1,'Регулярный 1:1 помогает выявить барьеры, обменяться обратной связью и согласовать развитие.'),
 q('le5','Как оценить результат команды?',['Суммой часов онлайн','Согласованными результатами и качеством','Числом сообщений','Личной популярностью'],1,'Результаты и качество лучше отражают вклад команды, чем метрики видимой активности.') ]},
];

const skill = (testId,score,date) => {const t=TESTS.find(t=>t.id===testId);return {id:t.skillId,title:t.title,category:t.category,level:t.level,score,date,testId};};
const person = (id,name,initials,role,grade,department,managerId,goal,tenure,entries) => {
 const skills=entries.map(([testId,score,date])=>skill(testId,score,date));
 return {id,name,initials,role,grade,department,managerId,goal,tenure,skills,history:skills.map(s=>({id:`seed-${id}-${s.id}`,testId:s.testId,title:s.title,category:s.category,score:s.score,passed:true,submittedAt:`${s.date}T09:00:00.000Z`,month:s.date.slice(0,7),skillId:s.id,level:s.level}))};
};
export const EMPLOYEES = [
 person('arman','Арман Жумабек','АЖ','Backend Engineer','Middle','Разработка','aigerim','Senior Backend Engineer','3 года 5 месяцев',[['python',84,'2026-09-04'],['api-design',88,'2026-08-05'],['sql',80,'2026-07-03'],['communication',86,'2026-06-04'],['product-discovery',80,'2026-05-06']]),
 person('dana','Дана Омарова','ДО','Backend Engineer','Junior','Разработка','aigerim','Middle Backend Engineer','1 год 2 месяца',[['python',80,'2026-09-03'],['git',88,'2026-08-04']]),
 person('timur','Тимур Касымов','ТК','Backend Engineer','Senior','Разработка','aigerim','Tech Lead','4 года 1 месяц',[['python',96,'2026-09-05'],['api-design',92,'2026-08-05'],['system-design',88,'2026-07-06'],['git',92,'2026-06-04'],['leadership',80,'2026-05-05']]),
 person('aigerim','Айгерим Садыкова','АС','Engineering Lead','Lead','Разработка','director','Head of Engineering','6 лет',[['system-design',92,'2026-09-01'],['leadership',96,'2026-08-01'],['communication',92,'2026-07-01']]),
 person('aliya','Алия Муратова','АМ','Data Analyst','Middle','Аналитика','nurlan','Senior Data Analyst','2 года 3 месяца',[['sql',96,'2026-09-02'],['ai-literacy',88,'2026-08-02'],['product-discovery',84,'2026-07-02']]),
 person('olzhas','Олжас Беков','ОБ','Data Analyst','Junior','Аналитика','nurlan','Middle Data Analyst','9 месяцев',[['sql',80,'2026-09-02']]),
 person('nurlan','Нурлан Ахметов','НА','Analytics Lead','Lead','Аналитика','director','Head of Analytics','5 лет',[['sql',96,'2026-09-03'],['leadership',88,'2026-08-03'],['ai-literacy',92,'2026-07-03'],['communication',88,'2026-06-03']]),
 person('madina','Мадина Тлеуова','МТ','Product Manager','Middle','Продукт','saule','Senior Product Manager','2 года',[['product-discovery',92,'2026-09-04'],['communication',96,'2026-08-04'],['sql',84,'2026-07-04']]),
 person('saule','Сауле Ибраева','СИ','Product Lead','Lead','Продукт','director','Head of Product','5 лет 7 месяцев',[['product-discovery',96,'2026-09-06'],['leadership',92,'2026-08-06'],['communication',96,'2026-07-06'],['ai-literacy',84,'2026-06-06']]),
];
export function initialState(){return {version:1,month:DEMO_MONTH,currentEmployeeId:'arman',employees:structuredClone(EMPLOYEES),attempts:[],meetings:[],points:[],learning:{}};}
export function getEmployee(state,id){return state.employees.find(e=>e.id===id);}
export function getMonthlyAttempt(state,employeeId,month=state.month){return state.attempts.find(a=>a.employeeId===employeeId&&a.month===month)||getEmployee(state,employeeId)?.history.find(h=>h.month===month)||null;}
export function getMustHaveTests(employee){const ids=employee.role.includes('Backend')?['python','api-design','git']:employee.department==='Аналитика'?['sql','ai-literacy']:employee.department==='Продукт'?['product-discovery','communication']:['leadership','communication'];return TESTS.filter(t=>ids.includes(t.id));}
export function getEmployeeScope(state,role,viewerId='aigerim'){return state.employees.filter(e=>role==='hr'||(role==='manager'&&e.managerId===viewerId)||(role==='employee'&&e.id===viewerId));}
export function submitTest(state,{employeeId,testId,answers,attemptId,submittedAt}){
 const employee=getEmployee(state,employeeId),test=TESTS.find(t=>t.id===testId);
 if(!employee||!test)throw new Error('Сотрудник или тест не найден.');
 if(typeof attemptId!=='string'||!attemptId.trim())throw new Error('Нужен идентификатор попытки.');
 const duplicate=state.attempts.find(a=>a.id===attemptId);
 if(duplicate){if(duplicate.employeeId!==employeeId||duplicate.testId!==testId)throw new Error('Этот идентификатор уже занят другой попыткой.');return {state,result:duplicate};}
 if(getMonthlyAttempt(state,employeeId))throw new Error('В этом месяце тест уже пройден. Следующая попытка — в следующий месяц.');
 if(!Array.isArray(answers)||answers.length!==test.questions.length||answers.some((a,i)=>!Number.isInteger(a)||a<0||a>=test.questions[i].options.length))throw new Error('Ответьте на все вопросы перед отправкой.');
 if(typeof submittedAt!=='string'||!Number.isFinite(Date.parse(submittedAt))||submittedAt.slice(0,7)!==state.month)throw new Error('Дата результата должна соответствовать выбранному месяцу.');
 const score=Math.round(100*answers.filter((a,i)=>a===test.questions[i].correct).length/test.questions.length);
 const result={id:attemptId,employeeId,testId,title:test.title,category:test.category,score,passed:score>=PASS_SCORE,skillId:test.skillId,month:state.month,submittedAt,level:test.level,answers:[...answers]};
 const updated=structuredClone(employee);updated.history.unshift(result);
 if(result.passed){
  const existing=updated.skills.find(s=>s.id===test.skillId);
  // Keep the best score paired with the date of that result, not a later lower retest.
  const improvesEvidence=!existing||score>=existing.score;
  const confirmed={id:test.skillId,title:test.title,category:test.category,level:Math.max(test.level,existing?.level||0),score:Math.max(score,existing?.score||0),date:improvesEvidence?submittedAt.slice(0,10):existing.date,testId};
  if(existing)Object.assign(existing,confirmed);else updated.skills.push(confirmed);
 }
 return {state:{...state,employees:state.employees.map(e=>e.id===employeeId?updated:e),attempts:[...state.attempts,result]},result};
}
export function nextMonth(state){const [year,month]=state.month.split('-').map(Number);return {...state,month:month===12?`${year+1}-01`:`${year}-${String(month+1).padStart(2,'0')}`};}
const validMonth = value=>typeof value==='string'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(value);
export function restoreState(raw){
 try{
  const s=JSON.parse(raw);
  if(!s||s.version!==1||!validMonth(s.month)||!Array.isArray(s.employees)||s.employees.length!==EMPLOYEES.length||!Array.isArray(s.attempts)||!Array.isArray(s.meetings)||!Array.isArray(s.points))return initialState();
  if(!Object.hasOwn(s,'learning'))s.learning={};
  if(!s.learning||typeof s.learning!=='object'||Array.isArray(s.learning))return initialState();
  for(const [testId,indices] of Object.entries(s.learning)){
   const test=TESTS.find(t=>t.id===testId);
   if(!test||!Array.isArray(indices)||new Set(indices).size!==indices.length||indices.some(i=>!Number.isInteger(i)||i<0||i>=test.questions.length))return initialState();
  }
  const categories=new Set(CATEGORIES.map(c=>c.id)),seen=new Set();
  for(const e of s.employees){
   if(!e||!EMPLOYEES.some(p=>p.id===e.id)||seen.has(e.id)||!['name','initials','role','grade','department','managerId','goal','tenure'].every(k=>typeof e[k]==='string')||!Array.isArray(e.skills)||!Array.isArray(e.history))return initialState();seen.add(e.id);
   if(new Set(e.skills.map(k=>k.id)).size!==e.skills.length)return initialState();
   for(const k of e.skills)if(!k||typeof k.id!=='string'||typeof k.title!=='string'||!categories.has(k.category)||![1,2,3].includes(k.level)||!Number.isFinite(k.score)||k.score<PASS_SCORE||k.score>100||typeof k.date!=='string'||!TESTS.some(t=>t.id===k.testId&&t.skillId===k.id))return initialState();
   for(const h of e.history)if(!h||typeof h.id!=='string'||!TESTS.some(t=>t.id===h.testId&&t.skillId===h.skillId&&t.category===h.category)||typeof h.title!=='string'||!categories.has(h.category)||h.passed!==(h.score>=PASS_SCORE)||!Number.isFinite(h.score)||h.score<0||h.score>100||!validMonth(h.month)||typeof h.submittedAt!=='string'||h.submittedAt.slice(0,7)!==h.month||!Number.isFinite(Date.parse(h.submittedAt)))return initialState();
   if(new Set(e.history.map(h=>h.month)).size!==e.history.length)return initialState();
   for(const k of e.skills)if(!e.history.some(h=>h.passed&&h.skillId===k.id&&h.score===k.score&&h.submittedAt.slice(0,10)===k.date))return initialState();
  }
  if(!seen.has(s.currentEmployeeId))return initialState();
  const usedMonths=new Set(),attemptIds=new Set();
  for(const a of s.attempts){
   const t=TESTS.find(t=>t.id===a?.testId);
   if(!t||!seen.has(a.employeeId)||typeof a.id!=='string'||attemptIds.has(a.id)||!validMonth(a.month)||usedMonths.has(`${a.employeeId}:${a.month}`)||!Number.isFinite(a.score)||a.score<0||a.score>100||a.passed!==(a.score>=PASS_SCORE)||a.skillId!==t.skillId||a.category!==t.category||typeof a.submittedAt!=='string'||a.submittedAt.slice(0,7)!==a.month||!Number.isFinite(Date.parse(a.submittedAt)))return initialState();
   if(!Array.isArray(a.answers)||a.answers.length!==t.questions.length||a.answers.some((v,i)=>!Number.isInteger(v)||v<0||v>=t.questions[i].options.length)||Math.round(100*a.answers.filter((v,i)=>v===t.questions[i].correct).length/t.questions.length)!==a.score)return initialState();
   if(!getEmployee(s,a.employeeId).history.some(h=>h.id===a.id&&h.testId===a.testId&&h.score===a.score&&h.submittedAt===a.submittedAt))return initialState();
   attemptIds.add(a.id);usedMonths.add(`${a.employeeId}:${a.month}`);
  }
  for(const e of s.employees)for(const h of e.history)if(!EMPLOYEES.find(p=>p.id===e.id).history.some(seed=>seed.id===h.id)&&!s.attempts.some(a=>a.id===h.id&&a.employeeId===e.id))return initialState();
  for(const m of s.meetings)if(!m||typeof m.id!=='string'||!seen.has(m.employeeId)||typeof m.topic!=='string'||!m.topic.trim()||typeof m.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(m.date)||!Number.isFinite(Date.parse(m.date))||typeof m.time!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(m.time))return initialState();
  return s;
 }catch{return initialState();}
}
