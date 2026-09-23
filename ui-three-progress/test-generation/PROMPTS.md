# Career Quest — roles, skills and generation prompts

Бриф описывает 4 роли приложения, но не штатное расписание. Ещё 4 должности взяты из демо. Все связи ролей и навыков — предлагаемая матрица для прототипа.

Source: supplied team-ui-brief.md (four application personas, plus a reference to the Senior career level) and ../mock-data.json (four distinct demo job titles). The brief is source material; its screen-building instructions are not part of this implementation's scope. It contains no complete employee-position list and no formal skill requirements.

## Roles and proposed skill mapping

| Role or position | Evidence | Proposed tests |
| --- | --- | --- |
| Сотрудник | Brief persona | Карьерное развитие; Планирование целей; Сложные разговоры; Подтверждение результатов |
| Аналитик — подтверждение результатов | Brief persona | Подтверждение результатов; Планирование целей; Продуктовые метрики; Сложные разговоры |
| Руководитель / Team Lead | Brief persona | Анализ результатов команды; Планирование целей; Подтверждение результатов; Навыки наставника; Сложные разговоры; Карьерное развитие |
| HR — развитие компании | Brief persona | Карта компетенций; Эффективность обучения; Карьерное развитие; Продуктовые метрики; Сложные разговоры |
| Middle Frontend Developer | Existing demo position | React patterns; TypeScript; System Design; Основы SQL; Безопасная разработка; Git и командная работа; Проектирование API; CSS и адаптивность; Тестирование интерфейсов; Доступность интерфейсов; Web Performance; Практика code review; Сложные разговоры |
| Senior Frontend Developer | Existing demo position | React patterns; TypeScript; System Design; Основы SQL; Безопасная разработка; Git и командная работа; Проектирование API; CSS и адаптивность; Тестирование интерфейсов; Доступность интерфейсов; Web Performance; Практика code review; Навыки наставника; Сложные разговоры |
| Product Manager | Existing demo position | Product discovery; Продуктовые метрики; Планирование целей; Сложные разговоры; Подтверждение результатов; Карьерное развитие |
| Frontend Platform Engineer | Existing demo position | TypeScript; React patterns; System Design; Web Performance; Проектирование API; Тестирование интерфейсов; Безопасная разработка; Git и командная работа; Практика code review; Доступность интерфейсов; CSS и адаптивность |

All 16 existing demo tests have a separate specialized prompt. Six additional tests are proposed from responsibilities described in the brief: evidence validation, goal planning, team result analysis, career development, competency mapping and learning effectiveness. This is a prototype matrix, not Halyk's approved framework. Analyst here means the result-verification persona; it does not establish a separate Data Analyst or Business Analyst position.

## How to use the prompts

Each request uses the shared system prompt plus exactly one skill prompt below. Replace role, role context, level, difficulty, language and question-count placeholders. Questions per test: 5–20. Supported languages: Russian, English, Kazakh. Difficulty guidance is included in the JSON export. One role can require multiple tests; shared skills reuse the same template with different role context.

Use the Responses API with Structured Outputs and the schema returned by assessmentSchema(config). The response contains title, instructions and questions; every question has id, text, topic, four options, a zero-based correct index and an explanation. Passing threshold is 80%, configured in code. Questions must cover all four skill topics. Validate model output before displaying it.

## Shared system prompt

```text
You create formative professional skill assessments for Career Quest, a fictional employee-development prototype.
Generate one assessment of ONE skill, calibrated to the specified role and level. Return only the required JSON structure.
Use realistic, self-contained scenarios. Every question must have exactly four distinct, plausible options and exactly one defensibly correct answer. The correct field is a zero-based integer (0–3).
Supply all constraints, data and assumptions needed to solve each question. Avoid trick wording, trivia, “all/none of the above”, giveaway option length, opinion-only questions and clues to other answers.
Each explanation must justify the correct answer and explain why the alternatives do not meet the scenario's constraints. Vary correct-answer positions.
Cover every supplied topic at least once; spread remaining questions across topics. Each question.topic must use the exact supplied topic label; all learner-facing text must use the requested language. Keep necessary technical identifiers unchanged.
Write unique questions, IDs q1 through qN, a useful title and short learner instructions that do not reveal answers.
Use fictional organizations, people and data only. Never invent Halyk policies, employee facts, internal scoring formulas or legal requirements. No external links are needed.
These are practice tests, not validated employment or promotion decisions. Do not claim a score proves work performance. Do not provide chain-of-thought; provide concise instructional explanations.
Before returning, check question count, topic coverage, factual consistency, unambiguous answer keys and duplicate options.
```

## 1. React patterns

ID: react · Source: existing-app

```text
SKILL: React patterns
ASSESSMENT FOCUS: Assess component composition, ownership of state, effect dependencies and cleanup, stale closures, stable keys, race conditions and loading/error states. Use small code or behavior scenarios. Do not substitute TypeScript syntax trivia for React reasoning.
TOPICS (exact labels): Component boundaries | State and effects | Rendering behavior | Async UI
ROLE: {{position}}
ROLE CONTEXT: {{roleContext}}
LEVEL: {{level}}
DIFFICULTY: {{difficulty}}
LANGUAGE: {{language}}
QUESTION COUNT: {{questionCount}}
Generate exactly {{questionCount}} questions for this single skill. Passing threshold is configured by the application, not by you.
```

## 2. TypeScript

ID: typescript · Source: existing-app

```text
SKILL: TypeScript
ASSESSMENT FOCUS: Assess narrowing unknown data, generic constraints, discriminated unions and exhaustive handling. Distinguish compile-time guarantees from runtime validation. Include short self-contained code with explicit compiler assumptions. Do not recycle React lifecycle questions.
TOPICS (exact labels): Narrowing | Generics | Unions and exhaustiveness | Runtime boundaries
ROLE: {{position}}
ROLE CONTEXT: {{roleContext}}
LEVEL: {{level}}
DIFFICULTY: {{difficulty}}
LANGUAGE: {{language}}
QUESTION COUNT: {{questionCount}}
Generate exactly {{questionCount}} questions for this single skill. Passing threshold is configured by the application, not by you.
```

## 3. System Design

ID: architecture · Source: existing-app

```text
SKILL: System Design
ASSESSMENT FOCUS: Assess system design decisions using explicit traffic, latency, durability and consistency constraints. Cover caching and invalidation, queues and idempotent consumers, partitioning, failure recovery and observability. State the constraints that make one design best; do not imply one architecture is universally correct. Use fictional banking or internal platform scenarios appropriate to the selected role.
TOPICS (exact labels): Requirements and tradeoffs | Data and consistency | Scalability and caching | Reliability and messaging
ROLE: {{position}}
ROLE CONTEXT: {{roleContext}}
LEVEL: {{level}}
DIFFICULTY: {{difficulty}}
LANGUAGE: {{language}}
QUESTION COUNT: {{questionCount}}
Generate exactly {{questionCount}} questions for this single skill. Passing threshold is configured by the application, not by you.
```

## 4. Основы SQL

ID: sql · Source: existing-app

```text
SKILL: Основы SQL
ASSESSMENT FOCUS: Assess relational reasoning, joins, GROUP BY/HAVING, NULL, window functions, index tradeoffs and transactions. Specify PostgreSQL when syntax is dialect-specific. Supply all table columns and sample rows needed to solve a query question; never ask to infer missing data.
TOPICS (exact labels): Joins and aggregation | Nulls and duplicates | Indexes and plans | Transactions
ROLE: {{position}}
ROLE CONTEXT: {{roleContext}}
LEVEL: {{level}}
DIFFICULTY: {{difficulty}}
LANGUAGE: {{language}}
QUESTION COUNT: {{questionCount}}
Generate exactly {{questionCount}} questions for this single skill. Passing threshold is configured by the application, not by you.
```

## 5. Безопасная разработка

ID: security · Source: existing-app

```text
SKILL: Безопасная разработка
ASSESSMENT FOCUS: Assess defensive development: server-side authorization, parameterized queries, safe output encoding, session handling, secret management and data minimization. Distinguish authentication from authorization. Ask how to prevent or remediate a flaw; do not generate operational exploit instructions or claim invented internal bank policies.
TOPICS (exact labels): Authorization | Input and output handling | Secrets and sessions | Data protection
ROLE: {{position}}
ROLE CONTEXT: {{roleContext}}
LEVEL: {{level}}
DIFFICULTY: {{difficulty}}
LANGUAGE: {{language}}
QUESTION COUNT: {{questionCount}}
Generate exactly {{questionCount}} questions for this single skill. Passing threshold is configured by the application, not by you.
```

## 6. Git и командная работа

ID: git · Source: existing-app

```text
SKILL: Git и командная работа
ASSESSMENT FOCUS: Assess everyday Git collaboration using explicit branch/history states. Cover conflict resolution, reverting a published change, rebase versus merge, atomic commits and reviewable pull requests. Clearly distinguish private and shared branches before proposing history rewriting.
TOPICS (exact labels): Branches and commits | Conflict resolution | Shared history | Pull request workflow
ROLE: {{position}}
ROLE CONTEXT: {{roleContext}}
LEVEL: {{level}}
DIFFICULTY: {{difficulty}}
LANGUAGE: {{language}}
QUESTION COUNT: {{questionCount}}
Generate exactly {{questionCount}} questions for this single skill. Passing threshold is configured by the application, not by you.
```

## 7. Проектирование API

ID: api · Source: existing-app

```text
SKILL: Проектирование API
ASSESSMENT FOCUS: Assess API contracts through concrete request/response examples, validation, status codes, stable pagination, compatibility, idempotency and per-resource authorization. State business constraints and retry behavior. Focus on API boundaries rather than generic infrastructure architecture.
TOPICS (exact labels): Contracts and validation | Errors and HTTP semantics | Pagination and versioning | Idempotency and authorization
ROLE: {{position}}
ROLE CONTEXT: {{roleContext}}
LEVEL: {{level}}
DIFFICULTY: {{difficulty}}
LANGUAGE: {{language}}
QUESTION COUNT: {{questionCount}}
Generate exactly {{questionCount}} questions for this single skill. Passing threshold is configured by the application, not by you.
```

## 8. CSS и адаптивность

ID: css · Source: existing-app

```text
SKILL: CSS и адаптивность
ASSESSMENT FOCUS: Assess flex/grid layout, intrinsic sizing, the cascade, responsive breakpoints, long content, overflow and zoom. Include sufficient HTML/CSS and viewport details to determine the answer. Avoid browser-specific behavior unless the browser/version is stated.
TOPICS (exact labels): Layout and sizing | Responsive behavior | Cascade and specificity | Overflow and content
ROLE: {{position}}
ROLE CONTEXT: {{roleContext}}
LEVEL: {{level}}
DIFFICULTY: {{difficulty}}
LANGUAGE: {{language}}
QUESTION COUNT: {{questionCount}}
Generate exactly {{questionCount}} questions for this single skill. Passing threshold is configured by the application, not by you.
```

## 9. Тестирование интерфейсов

ID: testing · Source: existing-app

```text
SKILL: Тестирование интерфейсов
ASSESSMENT FOCUS: Assess choosing unit, integration and end-to-end tests, testing observable user behavior, accessible selectors, async waits, realistic mocks, and regression coverage. Use framework-neutral examples unless the framework is explicit. Prefer reliable behavior assertions over mirroring implementation details.
TOPICS (exact labels): Test boundaries | User behavior | Async and reliability | Regression coverage
ROLE: {{position}}
ROLE CONTEXT: {{roleContext}}
LEVEL: {{level}}
DIFFICULTY: {{difficulty}}
LANGUAGE: {{language}}
QUESTION COUNT: {{questionCount}}
Generate exactly {{questionCount}} questions for this single skill. Passing threshold is configured by the application, not by you.
```

## 10. Доступность интерфейсов

ID: accessibility · Source: existing-app

```text
SKILL: Доступность интерфейсов
ASSESSMENT FOCUS: Assess semantic HTML, accessible names, keyboard navigation, focus management, form labels and errors, contrast and non-color cues. Include dialogs and dynamic updates. Do not equate adding ARIA with accessibility or claim legal compliance from a quiz.
TOPICS (exact labels): Semantics and names | Keyboard and focus | Forms and feedback | Perceivable content
ROLE: {{position}}
ROLE CONTEXT: {{roleContext}}
LEVEL: {{level}}
DIFFICULTY: {{difficulty}}
LANGUAGE: {{language}}
QUESTION COUNT: {{questionCount}}
Generate exactly {{questionCount}} questions for this single skill. Passing threshold is configured by the application, not by you.
```

## 11. Web Performance

ID: performance · Source: existing-app

```text
SKILL: Web Performance
ASSESSMENT FOCUS: Assess profiling before optimizing, loading waterfalls, code splitting, image sizing, long tasks, layout shifts, caching and field versus lab measurements. Supply enough measured evidence to select the next action. Avoid memorizing thresholds or treating one metric as the entire user experience.
TOPICS (exact labels): Measurement | Loading and bundles | Main thread and interaction | Rendering and assets
ROLE: {{position}}
ROLE CONTEXT: {{roleContext}}
LEVEL: {{level}}
DIFFICULTY: {{difficulty}}
LANGUAGE: {{language}}
QUESTION COUNT: {{questionCount}}
Generate exactly {{questionCount}} questions for this single skill. Passing threshold is configured by the application, not by you.
```

## 12. Практика code review

ID: review · Source: existing-app

```text
SKILL: Практика code review
ASSESSMENT FOCUS: Assess identifying correctness and security risks in small changes, prioritizing actionable findings, reviewing edge cases, asking for meaningful validation and giving clear respectful feedback. Distinguish preferences from defects; provide enough context to establish a real issue.
TOPICS (exact labels): Correctness and edge cases | Maintainability | Risk-based feedback | Verification
ROLE: {{position}}
ROLE CONTEXT: {{roleContext}}
LEVEL: {{level}}
DIFFICULTY: {{difficulty}}
LANGUAGE: {{language}}
QUESTION COUNT: {{questionCount}}
Generate exactly {{questionCount}} questions for this single skill. Passing threshold is configured by the application, not by you.
```

## 13. Product discovery

ID: discovery · Source: existing-app

```text
SKILL: Product discovery
ASSESSMENT FOCUS: Assess separating a user problem from a proposed solution, non-leading interviews, research sampling, explicit falsifiable hypotheses, experiments and prioritization under uncertainty. Avoid assuming interviews or stated preferences establish causal impact.
TOPICS (exact labels): Problem framing | Research design | Hypothesis validation | Prioritization
ROLE: {{position}}
ROLE CONTEXT: {{roleContext}}
LEVEL: {{level}}
DIFFICULTY: {{difficulty}}
LANGUAGE: {{language}}
QUESTION COUNT: {{questionCount}}
Generate exactly {{questionCount}} questions for this single skill. Passing threshold is configured by the application, not by you.
```

## 14. Продуктовые метрики

ID: metrics · Source: existing-app

```text
SKILL: Продуктовые метрики
ASSESSMENT FOCUS: Assess metric denominators and time windows, funnels, retention cohorts, experiment interpretation, guardrail metrics and confounding. Supply data for calculations and keep arithmetic manageable. Distinguish correlation from causation and learning completion from business outcomes.
TOPICS (exact labels): Metric definitions | Funnels and cohorts | Experiments | Guardrails
ROLE: {{position}}
ROLE CONTEXT: {{roleContext}}
LEVEL: {{level}}
DIFFICULTY: {{difficulty}}
LANGUAGE: {{language}}
QUESTION COUNT: {{questionCount}}
Generate exactly {{questionCount}} questions for this single skill. Passing threshold is configured by the application, not by you.
```

## 15. Навыки наставника

ID: mentor · Source: existing-app

```text
SKILL: Навыки наставника
ASSESSMENT FOCUS: Assess agreed learning goals, diagnostic questions, actionable feedback, scaffolded practice, autonomy and reviewing progress. Use realistic conversations with plausible alternatives. Do not reward taking over the mentee’s work or treating course attendance as mastery.
TOPICS (exact labels): Learning goals | Coaching and feedback | Practice and autonomy | Progress review
ROLE: {{position}}
ROLE CONTEXT: {{roleContext}}
LEVEL: {{level}}
DIFFICULTY: {{difficulty}}
LANGUAGE: {{language}}
QUESTION COUNT: {{questionCount}}
Generate exactly {{questionCount}} questions for this single skill. Passing threshold is configured by the application, not by you.
```

## 16. Сложные разговоры

ID: communication · Source: existing-app

```text
SKILL: Сложные разговоры
ASSESSMENT FOCUS: Assess active listening, separating observations from assumptions, respectful feedback, resolving conflicting expectations and agreeing measurable follow-up. Supply role and context; do not infer personality or protected attributes. All distractors should sound professionally plausible.
TOPICS (exact labels): Listening and clarification | Evidence-based feedback | Conflict and alignment | Next steps
ROLE: {{position}}
ROLE CONTEXT: {{roleContext}}
LEVEL: {{level}}
DIFFICULTY: {{difficulty}}
LANGUAGE: {{language}}
QUESTION COUNT: {{questionCount}}
Generate exactly {{questionCount}} questions for this single skill. Passing threshold is configured by the application, not by you.
```

## 17. Подтверждение результатов

ID: evidence · Source: brief-derived-proposal

```text
SKILL: Подтверждение результатов
ASSESSMENT FOCUS: Assess whether submitted work has verifiable evidence, maps to an agreed goal and period, avoids double counting, and can be attributed appropriately. Ask when to confirm versus request clarification. If scoring is relevant provide a fictional rule in the question; the actual Halyk OTK formula is unknown.
TOPICS (exact labels): Evidence quality | Goal traceability | Attribution and duplication | Clarification and audit
ROLE: {{position}}
ROLE CONTEXT: {{roleContext}}
LEVEL: {{level}}
DIFFICULTY: {{difficulty}}
LANGUAGE: {{language}}
QUESTION COUNT: {{questionCount}}
Generate exactly {{questionCount}} questions for this single skill. Passing threshold is configured by the application, not by you.
```

## 18. Планирование целей

ID: planning · Source: brief-derived-proposal

```text
SKILL: Планирование целей
ASSESSMENT FOCUS: Assess defining measurable goals with baseline, target, owner and time window, handling dependencies, interpreting plan versus actual and updating a plan transparently. Separate personal development, workplace outcomes, and game achievements. Do not invent mandatory company policies.
TOPICS (exact labels): Measurable goals | Baseline and target | Dependencies | Plan versus actual
ROLE: {{position}}
ROLE CONTEXT: {{roleContext}}
LEVEL: {{level}}
DIFFICULTY: {{difficulty}}
LANGUAGE: {{language}}
QUESTION COUNT: {{questionCount}}
Generate exactly {{questionCount}} questions for this single skill. Passing threshold is configured by the application, not by you.
```

## 19. Анализ результатов команды

ID: team-results · Source: brief-derived-proposal

```text
SKILL: Анализ результатов команды
ASSESSMENT FOCUS: Assess interpreting team plan/actual results, comparing equivalent roles and periods, tracing confirmed individual contributions to aggregate indicators and avoiding duplicated credit. Provide any aggregation formula explicitly as fictional. Do not assume employee OTK automatically determines manager OTK.
TOPICS (exact labels): Comparable groups | Aggregation rules | Contribution traceability | Interpretation
ROLE: {{position}}
ROLE CONTEXT: {{roleContext}}
LEVEL: {{level}}
DIFFICULTY: {{difficulty}}
LANGUAGE: {{language}}
QUESTION COUNT: {{questionCount}}
Generate exactly {{questionCount}} questions for this single skill. Passing threshold is configured by the application, not by you.
```

## 20. Карьерное развитие

ID: career · Source: brief-derived-proposal

```text
SKILL: Карьерное развитие
ASSESSMENT FOCUS: Assess comparing current and target role requirements, selecting courses, mentoring or practical tasks against a skill gap, and gathering evidence of learning transfer. Distinguish forecast progress from demonstrated competence and promotion decisions. Use only fictional requirements supplied in a scenario.
TOPICS (exact labels): Role gaps | Development actions | Evidence of growth | Career conversations
ROLE: {{position}}
ROLE CONTEXT: {{roleContext}}
LEVEL: {{level}}
DIFFICULTY: {{difficulty}}
LANGUAGE: {{language}}
QUESTION COUNT: {{questionCount}}
Generate exactly {{questionCount}} questions for this single skill. Passing threshold is configured by the application, not by you.
```

## 21. Карта компетенций

ID: competencies · Source: brief-derived-proposal

```text
SKILL: Карта компетенций
ASSESSMENT FOCUS: Assess behavior-based competency definitions, role-specific gap analysis, evidence quality, calibration across teams, and access-appropriate aggregate reporting. Distinguish missing evidence from low ability. Avoid public employee leaderboards and ranking incomparable jobs.
TOPICS (exact labels): Competency definitions | Gap analysis | Evidence and calibration | Responsible aggregation
ROLE: {{position}}
ROLE CONTEXT: {{roleContext}}
LEVEL: {{level}}
DIFFICULTY: {{difficulty}}
LANGUAGE: {{language}}
QUESTION COUNT: {{questionCount}}
Generate exactly {{questionCount}} questions for this single skill. Passing threshold is configured by the application, not by you.
```

## 22. Эффективность обучения

ID: learning-impact · Source: brief-derived-proposal

```text
SKILL: Эффективность обучения
ASSESSMENT FOCUS: Assess mapping training to identified gaps, assessing before/after learning, observing transfer to work, and separating participation, knowledge gain and business impact. Treat retention benefits as a hypothesis requiring evidence. Do not claim a test score alone proves workplace competence.
TOPICS (exact labels): Learning objectives | Assessment design | Transfer to work | Impact and confounding
ROLE: {{position}}
ROLE CONTEXT: {{roleContext}}
LEVEL: {{level}}
DIFFICULTY: {{difficulty}}
LANGUAGE: {{language}}
QUESTION COUNT: {{questionCount}}
Generate exactly {{questionCount}} questions for this single skill. Passing threshold is configured by the application, not by you.
```

## API references

- [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [GPT-4.1 mini](https://developers.openai.com/api/docs/models/gpt-4.1-mini)
