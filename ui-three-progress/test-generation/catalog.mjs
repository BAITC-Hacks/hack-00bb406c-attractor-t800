// Versioned, portable data. Brief personas are not an official Halyk job catalogue.
export const CATALOG_VERSION = '1.0.0';
export const SOURCE_NOTE = 'Бриф описывает 4 роли приложения, но не штатное расписание. Ещё 4 должности взяты из демо. Все связи ролей и навыков — предлагаемая матрица для прототипа.';

const skill = (id, title, category, topics, focus, source = 'existing-app') => ({ id, title, category, topics, focus, source });
export const SKILLS = [
  skill('react', 'React patterns', 'IT', ['Component boundaries', 'State and effects', 'Rendering behavior', 'Async UI'],
    'Assess component composition, ownership of state, effect dependencies and cleanup, stale closures, stable keys, race conditions and loading/error states. Use small code or behavior scenarios. Do not substitute TypeScript syntax trivia for React reasoning.'),
  skill('typescript', 'TypeScript', 'IT', ['Narrowing', 'Generics', 'Unions and exhaustiveness', 'Runtime boundaries'],
    'Assess narrowing unknown data, generic constraints, discriminated unions and exhaustive handling. Distinguish compile-time guarantees from runtime validation. Include short self-contained code with explicit compiler assumptions. Do not recycle React lifecycle questions.'),
  skill('architecture', 'System Design', 'IT', ['Requirements and tradeoffs', 'Data and consistency', 'Scalability and caching', 'Reliability and messaging'],
    'Assess system design decisions using explicit traffic, latency, durability and consistency constraints. Cover caching and invalidation, queues and idempotent consumers, partitioning, failure recovery and observability. State the constraints that make one design best; do not imply one architecture is universally correct. Use fictional banking or internal platform scenarios appropriate to the selected role.'),
  skill('sql', 'Основы SQL', 'IT', ['Joins and aggregation', 'Nulls and duplicates', 'Indexes and plans', 'Transactions'],
    'Assess relational reasoning, joins, GROUP BY/HAVING, NULL, window functions, index tradeoffs and transactions. Specify PostgreSQL when syntax is dialect-specific. Supply all table columns and sample rows needed to solve a query question; never ask to infer missing data.'),
  skill('security', 'Безопасная разработка', 'IT', ['Authorization', 'Input and output handling', 'Secrets and sessions', 'Data protection'],
    'Assess defensive development: server-side authorization, parameterized queries, safe output encoding, session handling, secret management and data minimization. Distinguish authentication from authorization. Ask how to prevent or remediate a flaw; do not generate operational exploit instructions or claim invented internal bank policies.'),
  skill('git', 'Git и командная работа', 'IT', ['Branches and commits', 'Conflict resolution', 'Shared history', 'Pull request workflow'],
    'Assess everyday Git collaboration using explicit branch/history states. Cover conflict resolution, reverting a published change, rebase versus merge, atomic commits and reviewable pull requests. Clearly distinguish private and shared branches before proposing history rewriting.'),
  skill('api', 'Проектирование API', 'IT', ['Contracts and validation', 'Errors and HTTP semantics', 'Pagination and versioning', 'Idempotency and authorization'],
    'Assess API contracts through concrete request/response examples, validation, status codes, stable pagination, compatibility, idempotency and per-resource authorization. State business constraints and retry behavior. Focus on API boundaries rather than generic infrastructure architecture.'),
  skill('css', 'CSS и адаптивность', 'IT', ['Layout and sizing', 'Responsive behavior', 'Cascade and specificity', 'Overflow and content'],
    'Assess flex/grid layout, intrinsic sizing, the cascade, responsive breakpoints, long content, overflow and zoom. Include sufficient HTML/CSS and viewport details to determine the answer. Avoid browser-specific behavior unless the browser/version is stated.'),
  skill('testing', 'Тестирование интерфейсов', 'IT', ['Test boundaries', 'User behavior', 'Async and reliability', 'Regression coverage'],
    'Assess choosing unit, integration and end-to-end tests, testing observable user behavior, accessible selectors, async waits, realistic mocks, and regression coverage. Use framework-neutral examples unless the framework is explicit. Prefer reliable behavior assertions over mirroring implementation details.'),
  skill('accessibility', 'Доступность интерфейсов', 'IT', ['Semantics and names', 'Keyboard and focus', 'Forms and feedback', 'Perceivable content'],
    'Assess semantic HTML, accessible names, keyboard navigation, focus management, form labels and errors, contrast and non-color cues. Include dialogs and dynamic updates. Do not equate adding ARIA with accessibility or claim legal compliance from a quiz.'),
  skill('performance', 'Web Performance', 'IT', ['Measurement', 'Loading and bundles', 'Main thread and interaction', 'Rendering and assets'],
    'Assess profiling before optimizing, loading waterfalls, code splitting, image sizing, long tasks, layout shifts, caching and field versus lab measurements. Supply enough measured evidence to select the next action. Avoid memorizing thresholds or treating one metric as the entire user experience.'),
  skill('review', 'Практика code review', 'IT', ['Correctness and edge cases', 'Maintainability', 'Risk-based feedback', 'Verification'],
    'Assess identifying correctness and security risks in small changes, prioritizing actionable findings, reviewing edge cases, asking for meaningful validation and giving clear respectful feedback. Distinguish preferences from defects; provide enough context to establish a real issue.'),
  skill('discovery', 'Product discovery', 'Продукт', ['Problem framing', 'Research design', 'Hypothesis validation', 'Prioritization'],
    'Assess separating a user problem from a proposed solution, non-leading interviews, research sampling, explicit falsifiable hypotheses, experiments and prioritization under uncertainty. Avoid assuming interviews or stated preferences establish causal impact.'),
  skill('metrics', 'Продуктовые метрики', 'Продукт', ['Metric definitions', 'Funnels and cohorts', 'Experiments', 'Guardrails'],
    'Assess metric denominators and time windows, funnels, retention cohorts, experiment interpretation, guardrail metrics and confounding. Supply data for calculations and keep arithmetic manageable. Distinguish correlation from causation and learning completion from business outcomes.'),
  skill('mentor', 'Навыки наставника', 'Лидерство', ['Learning goals', 'Coaching and feedback', 'Practice and autonomy', 'Progress review'],
    'Assess agreed learning goals, diagnostic questions, actionable feedback, scaffolded practice, autonomy and reviewing progress. Use realistic conversations with plausible alternatives. Do not reward taking over the mentee’s work or treating course attendance as mastery.'),
  skill('communication', 'Сложные разговоры', 'Лидерство', ['Listening and clarification', 'Evidence-based feedback', 'Conflict and alignment', 'Next steps'],
    'Assess active listening, separating observations from assumptions, respectful feedback, resolving conflicting expectations and agreeing measurable follow-up. Supply role and context; do not infer personality or protected attributes. All distractors should sound professionally plausible.'),
  skill('evidence', 'Подтверждение результатов', 'Результаты', ['Evidence quality', 'Goal traceability', 'Attribution and duplication', 'Clarification and audit'],
    'Assess whether submitted work has verifiable evidence, maps to an agreed goal and period, avoids double counting, and can be attributed appropriately. Ask when to confirm versus request clarification. If scoring is relevant provide a fictional rule in the question; the actual Halyk OTK formula is unknown.', 'brief-derived-proposal'),
  skill('planning', 'Планирование целей', 'Результаты', ['Measurable goals', 'Baseline and target', 'Dependencies', 'Plan versus actual'],
    'Assess defining measurable goals with baseline, target, owner and time window, handling dependencies, interpreting plan versus actual and updating a plan transparently. Separate personal development, workplace outcomes, and game achievements. Do not invent mandatory company policies.', 'brief-derived-proposal'),
  skill('team-results', 'Анализ результатов команды', 'Лидерство', ['Comparable groups', 'Aggregation rules', 'Contribution traceability', 'Interpretation'],
    'Assess interpreting team plan/actual results, comparing equivalent roles and periods, tracing confirmed individual contributions to aggregate indicators and avoiding duplicated credit. Provide any aggregation formula explicitly as fictional. Do not assume employee OTK automatically determines manager OTK.', 'brief-derived-proposal'),
  skill('career', 'Карьерное развитие', 'Развитие', ['Role gaps', 'Development actions', 'Evidence of growth', 'Career conversations'],
    'Assess comparing current and target role requirements, selecting courses, mentoring or practical tasks against a skill gap, and gathering evidence of learning transfer. Distinguish forecast progress from demonstrated competence and promotion decisions. Use only fictional requirements supplied in a scenario.', 'brief-derived-proposal'),
  skill('competencies', 'Карта компетенций', 'HR', ['Competency definitions', 'Gap analysis', 'Evidence and calibration', 'Responsible aggregation'],
    'Assess behavior-based competency definitions, role-specific gap analysis, evidence quality, calibration across teams, and access-appropriate aggregate reporting. Distinguish missing evidence from low ability. Avoid public employee leaderboards and ranking incomparable jobs.', 'brief-derived-proposal'),
  skill('learning-impact', 'Эффективность обучения', 'HR', ['Learning objectives', 'Assessment design', 'Transfer to work', 'Impact and confounding'],
    'Assess mapping training to identified gaps, assessing before/after learning, observing transfer to work, and separating participation, knowledge gain and business impact. Treat retention benefits as a hypothesis requiring evidence. Do not claim a test score alone proves workplace competence.', 'brief-derived-proposal'),
];

export const POSITIONS = [
  { id: 'employee', title: 'Сотрудник', source: 'brief', description: 'Общая роль сотрудника из брифа; конкретная должность не указана.', level: 'middle', skills: ['career', 'planning', 'communication', 'evidence'] },
  { id: 'analyst', title: 'Аналитик — подтверждение результатов', source: 'brief', description: 'Проверяет выполненные работы, подтверждения и связь с целью.', level: 'middle', skills: ['evidence', 'planning', 'metrics', 'communication'] },
  { id: 'manager', title: 'Руководитель / Team Lead', source: 'brief', description: 'Следит за результатами команды и развитием сотрудников.', level: 'senior', skills: ['team-results', 'planning', 'evidence', 'mentor', 'communication', 'career'] },
  { id: 'hr', title: 'HR — развитие компании', source: 'brief', description: 'Анализирует компетенции, траектории и эффективность обучения.', level: 'middle', skills: ['competencies', 'learning-impact', 'career', 'metrics', 'communication'] },
  { id: 'middle-frontend', title: 'Middle Frontend Developer', source: 'existing-app', description: 'Текущая должность двух вымышленных сотрудников в демо.', level: 'middle', skills: ['react', 'typescript', 'architecture', 'sql', 'security', 'git', 'api', 'css', 'testing', 'accessibility', 'performance', 'review', 'communication'] },
  { id: 'senior-frontend', title: 'Senior Frontend Developer', source: 'existing-app', description: 'Целевая должность в демо; Senior также упоминается в брифе.', level: 'senior', skills: ['react', 'typescript', 'architecture', 'sql', 'security', 'git', 'api', 'css', 'testing', 'accessibility', 'performance', 'review', 'mentor', 'communication'] },
  { id: 'product-manager', title: 'Product Manager', source: 'existing-app', description: 'Карьерный переход из существующего демо.', level: 'middle', skills: ['discovery', 'metrics', 'planning', 'communication', 'evidence', 'career'] },
  { id: 'frontend-platform', title: 'Frontend Platform Engineer', source: 'existing-app', description: 'Карьерный переход в платформенную команду из демо.', level: 'senior', skills: ['typescript', 'react', 'architecture', 'performance', 'api', 'testing', 'security', 'git', 'review', 'accessibility', 'css'] },
];

export const LEVELS = { junior: 'Junior', middle: 'Middle', senior: 'Senior' };
export const LANGUAGES = { ru: 'Русский', en: 'English', kk: 'Қазақша' };
export const getSkill = id => SKILLS.find(s => s.id === id);
export const getPosition = id => POSITIONS.find(p => p.id === id);
