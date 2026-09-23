# Halyk · Мой рост — UI prototype

**Employee-growth prototype with a working AI test-generation lab.** The banking/career demo is mocked. The test lab can call OpenAI with a key supplied by the user. There is no real login, Jira access, messaging, or persistent storage.

## Run

Requires Node.js 20 or newer. No installation or build step.

```sh
cd ui-three-progress
npm run dev
```

Open [localhost:4173](http://localhost:4173). The landing view is the authenticated Halyk banking home. An employee-only **Мой рост** service card opens the mini-app.

For a presentation without the developer variant bar, use `npm run preview`. Set `PORT=4174 npm run dev` if the default port is occupied. The server binds only to the local computer.

## Generate and take real tests

Open [the test lab](http://localhost:4173/test-lab.html), or choose **Тесты → Создать тест с AI** in the mini-app.

1. Choose a role, level (Junior/Middle/Senior), language (Russian/English/Kazakh), and one or more skills.
2. Select 5, 10, 15 or 20 questions per skill. Paste an OpenAI API key in the password field. The default model is `gpt-4.1-mini`; an editable model field supports other Responses API models with Structured Outputs, subject to your account's access.
3. Click **Сгенерировать тест**. Each selected skill makes one separate API request. The page shows progress, keeps completed tests if later requests fail, supports cancellation and allows retrying an individual failed test. Requests are never automatically retried.
4. Click **Пройти тест**, answer the questions, and finish to see the score and explanations. You can go back, change answers, close/resume an unfinished test, or retake the same questions. Passing requires at least 80% correct. Generate again for new questions.
5. Download all prompts as JSON or export generated tests **including answer keys**. Everything in the lab resets on page reload. The lab's practice results do not award XP or change the mock employee's OTK, skills or promotion status.

The key stays in the page's memory and is sent to the loopback-only local server, then to `https://api.openai.com/v1/responses`. It is not stored in files, logs, cookies, browser storage or exports. The OpenAI request sets `store: false`. A browser reload/navigation clears the key. Generation uses your OpenAI API project's quota; ChatGPT subscription access alone is not an API key.

### Roles and prompts

The supplied brief names **Employee, Analyst (result verification), Manager, and HR** as application personas, plus **Senior** as a career level. It does not supply a full job catalogue or a formal competency matrix. Existing demo data adds **Middle Frontend Developer, Senior Frontend Developer, Product Manager, and Frontend Platform Engineer**. All role-to-skill mappings are explicitly proposed prototype content.

There are **22 specialized skill prompts**, including all 16 existing demo tests plus 6 proposed skills derived from the brief's responsibilities. System Design, security, APIs, TypeScript, CSS, testing and other skills each get a distinct prompt; the generator does not reuse the old unrelated mock question sets.

- [Complete role matrix and all prompts](test-generation/PROMPTS.md)
- [Machine-readable prompt library](test-generation/prompt-library.json)
- Regenerate these artifacts with `npm run prompts:export` after editing the catalogue or prompts.

### Backend handoff

The test lab is isolated from the original mock app. Modules in `test-generation/` use ES modules and no third-party dependencies:

- `catalog.mjs`: versioned roles, skills, source labels and role mappings.
- `prompts.mjs`: one specialized template per skill, shared generation instructions, configuration validation and prompt export.
- `assessment.mjs`: JSON Schema, response validation, option shuffling and deterministic grading.
- `openai.mjs`: OpenAI transport, timeout, cancellation, refusal/incomplete-output handling and safe errors.
- `server.mjs`: thin local HTTP adapter; `POST /api/generate-test` accepts `{ apiKey, config: { positionId, skillId, level, language, questionCount, model } }` and returns `{ assessment }` or `{ error }`. Keys are request-scoped; no settings file or environment variable is needed.

For the backend move, keep the catalogue, prompt builder and validation modules. Replace the local adapter with the authenticated service, manage provider credentials there, persist test versions and attempts, and return questions without `correct`/`explanation` until grading. The current practice runner receives answer keys in memory and is not an exam-security boundary. AI-generated questions can still be factually ambiguous; review before any formal assessment use.

Implementation references: [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs) and [GPT-4.1 mini](https://developers.openai.com/api/docs/models/gpt-4.1-mini).

### Generation checks

Run `npm test` for catalogue coverage, every role/skill prompt, strict schemas, response validation, shuffling, scoring, provider failures, cancellation, timeouts, API-key handling, origin/host protections and static routes. These checks use simulated OpenAI responses and consume no API quota. Real output quality and account/model access require a generation with your own key.

Browser verification covers all eight role selectors, generation, partial batch failure, individual retry, cancellation, answer changes, back/resume, pass/fail scoring, retakes, HTML escaping, exports and key clearing. Desktop and 390px mobile layouts were checked for overflow; reload clears the key and tests. To repeat the simulated browser flow on a fresh lab page, run `npx agent-browser open http://localhost:4173/test-lab.html`, then `npx agent-browser eval --stdin < test-generation/browser-smoke.js`. The harness intercepts generation requests and uses a fake key; reload afterwards to clear its sample tests.

## One source of mock data

[`mock-data.json`](./mock-data.json) is the single mock-data document, loaded by the UI at startup. It contains fictional employees, the banking-home context, tests and answer keys, role requirements, career goals, XP rules and levels, tree choices, themes, contributions, Jira fixtures and meeting slots. Edit that document and reload the page to change the scenario.

The original banking/career demo mutates an in-memory copy. A reload or a profile change restores its starting snapshot. It uses no `localStorage`, cookies or real APIs; the separate test lab described above calls OpenAI. The initial XP is a seeded historical balance; it is not recomputed from the displayed historical sample. New rewards are calculated by the mock UI and awarded only once.

## Navigation decisions

- The banking app retains its five original navigation items. **Рост is not added to the banking bottom bar.**
- Employees enter through the **Мой рост** service card or the **Все сервисы** sheet.
- The employee mini-app has exactly **Дерево / Тесты / Цели / Профиль / Halyk** at the bottom.
- The rightmost **Halyk** emblem and label follow the return-tab pattern supplied by the user. It returns to banking home and preserves this session's employee progress.
- A client who is not an employee has no growth entry. Switch the demo profile using the avatar on banking home, the profile settings button, or the desktop demo selector.

## Three layout variants

The mini-app's shared flows remain the same; its home hierarchy changes structurally:

| URL | Direction | Main interaction |
| --- | --- | --- |
| [`/?variant=A&view=growth`](http://localhost:4173/?variant=A&view=growth) | Живое дерево | A tree with skill nodes, status counts and the next test |
| [`/?variant=B&view=growth`](http://localhost:4173/?variant=B&view=growth) | Путь к цели | A vertical career roadmap with actions at each step |
| [`/?variant=C&view=growth`](http://localhost:4173/?variant=C&view=growth) | Мой фокус | One prominent learning action, followed by the personal garden |

Use the floating prototype bar or the left/right arrow keys to switch. Arrows do not override form controls. The URL retains the chosen variant. The bar is hidden by `npm run preview`.

The desktop side panel exposes the current mock state. Each render also logs `[Halyk prototype state]` to the browser console. No layout winner has been declared; A is the default reference direction.

## Working demo flows

1. **Bank → growth → bank:** open the employee card and use the persistent Halyk return tab.
2. **Tests:** filter passed/unattempted/failed role tests, search, add optional catalog tests, start a test, change answers, save/resume, finish and inspect answer explanations. A score below the pass threshold allows a retry and gives no XP. A passing test adds +200 XP once and updates the profile and relevant career step.
3. **Goals:** select promotion to Senior or transfer to Product / Engineering Platform. The roadmap, goal card and profile reflect the saved direction. Goals never automatically trigger a real promotion or transfer.
4. **Employee record:** inspect the role, tenure, manager, skills, certificates, test history, meetings, contributions and data-access explanation.
5. **Tree:** preview oak, apple and pine; compare six-month, one-year and two-year sizes; select an earned theme; save. Leaving without saving discards the preview. Tree size uses company tenure (0.65 / 0.85 / 1.0 scale). XP unlocks appearance and is not spent on it.
6. **XP:** schedule 1:1s, submit code review, mentoring and knowledge-sharing contributions. These remain pending until the explicit, labelled **demo manager confirmation** is used. Employees cannot confirm themselves in the proposed real product.
7. **Jira:** connect/disconnect and sync a prepared task. Repeated sync does not duplicate the task. A completed Jira task still requires confirmation before XP is awarded.
8. **Unlocks:** start at 1,240 XP, pass React (+200), then confirm both Jira tasks (+100 each) to reach 1,640 and unlock **Ночной сад** at level 8.

Banking products outside the employee-growth scope open contextual mock sheets, not functional banking workflows.

## Tree artwork

`assets/oak.png`, `assets/apple.png` and `assets/pine.png` were generated through **Higgsfield / GPT Image 2.5** for this prototype. Their job IDs and source URLs are recorded in `mock-data.json`. Assets are committed locally, so generation-service availability is not required to run the demo. Tenure scaling, autumn tint, night lighting and fireflies are rendered by CSS. No external image requests are made by the UI.

The optional Golos Text font is loaded from Google Fonts, with a local system-font fallback. The UI and its data still work without that font request.

## Verification and capture

The original mock prototype was verified in the browser at desktop and 390 × 844 mobile size: entry gating, employee navigation and Halyk return, test save/resume and +200 XP, optional test enrollment, goal changes, scheduled meetings, profile updates, Jira confirmation and duplicate-sync prevention, level-8 theme unlock, saved apple/night customization, six-month tree sizing, and all three layouts. Browser error/warning logs were empty during that checked flow. JavaScript syntax and the mock JSON were also checked. The generation lab now has the automated suite described above.

**Verdict:** the proposed service-card entry and dedicated mini-app navigation make the Halyk return action clear without crowding the banking tab bar. The interactive prototype demonstrates the requested behavior; the final layout choice and production architecture remain open.

Captured on branch **`ui-three-askarbek`**. The changes are isolated in this folder; no production implementation is promoted to main.
