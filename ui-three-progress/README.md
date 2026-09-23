# Halyk · Мой рост

A full-screen employee-development prototype inside the Halyk SuperApp. Banking, employee data, Jira and video calls are mocked. The question library was generated through OpenAI using the existing specialized prompts.

## Run

Node.js 22+; no dependencies or build step.

```sh
cd ui-three-progress
npm run dev
```

Open [the skill tree](http://localhost:4173/?view=growth) or [Halyk home](http://localhost:4173/). `npm run preview` hides the floating prototype controls. The server listens on loopback only.

## What to try

- **Scroll the tree.** The canvas fills the application; there is no device frame. All 22 skills have their own branches. More skills extend its height without a fixed limit. Passed tests produce filled leaves; unattempted and failed tests remain outlines. Company tenure changes trunk thickness, branch reach and leaf size.
- **Pass a test.** Each skill has five generated questions, four options per question, a score threshold and explanations. A first passing result adds a leaf and +200 XP. Failure adds neither. Attempts can be paused and resumed in this session. The profile, level and career plan derive from the same state.
- **Move the settings puck.** Drag the green control anywhere, or focus it and use arrow keys (Shift for larger moves). Click to edit name, role, department, manager, tenure, XP, goal, tree and palette. Changes appear immediately. Add a custom skill to extend the tree; its assigned author must write questions before it can be taken.
- **Try a 1:1.** Open the meeting action and acknowledge the recording notice for both simulated participants. The clock counts while the call is active, both participants are present and the microphone is enabled. After 15 minutes, employee and team lead each receive +100 XP once. Pause, disconnect, mute, end early, or use the clearly labelled demo fast-forward. The call requests no camera/microphone access and creates no recordings.
- **Use the career and contribution views.** Change career direction, submit a code review, mentoring or knowledge-sharing contribution, and confirm it with the labelled demo manager action. Jira sync imports one prepared task and prevents duplicate rewards. The career checklist updates from tests, confirmed contributions and completed 1:1s.
- **Customize the tree.** Oak, apple and pine have distinct leaf shapes. XP unlocks appearance options; tenure determines physical size. The customization view retains the Higgsfield-generated tree previews.

## Navigation

Halyk retains its original banking tabs. The employee-only **Мой рост** service card opens a dedicated **Дерево / Тесты / Цели / Профиль / Halyk** navigation bar. The last item retains the Halyk return emblem. A guest has no employee entry.

The previous A/B/C study has been replaced by the selected full-screen direction. Existing `?variant=A&view=growth` links still open the tree.

## Test authors and generated questions

`mock-data.json` is the single fixture document: employees, 22 tests, 110 generated questions, goals, XP, author assignments, mock integrations and visual-reference provenance. Every test references its own question set. The OpenAI model was `gpt-4.1-mini`, with five questions per skill and the existing prompt library. Generation metadata is recorded per test. Some React question conditions were clarified against the official React documentation linked in that metadata.

The role switch in the floating controls demonstrates per-test permissions:

| Demo identity | Allowed actions |
| --- | --- |
| Employee | Preparation, taking tests, results and explanations |
| Данияр Алиев | Edit and generate the 12 assigned IT tests |
| Мадина Омарова | Edit and generate the 10 other assigned tests |

Assigned authors can edit the preparation text, pass threshold, XP, question wording, answer options, correct answer and explanation. They can add questions and open the original prompt generator for that skill. Editing creates a separate in-memory question set for that test. Employees do not get author controls. The author studio rejects employee access, filters its skills by assignment, and the generation endpoint independently checks the selected test.

**These are prototype permissions.** The `halyk_demo_actor` cookie deliberately allows the demo identity to be switched. It is not authentication. Production must use verified server sessions, persisted author assignments and server-side grading. Static mock data includes answer keys and generated content is not a validated employee assessment.

The author studio is at [test-lab.html](http://localhost:4173/test-lab.html). It supports role, level, language, model and question-count settings, cancellation, individual retry, prompt export and test export. It opens separately to preserve the main app's in-memory state; studio practice results do not award career XP.

The key used to populate the fixture was passed through a terminal with echo disabled directly into the generation process. It was not written to a file or embedded in the client. Subsequent studio requests accept a transient key and send it only to the local adapter and OpenAI, using `store: false`. No key is stored in mocks, cookies, browser storage, exports or Git.

Prompt sources and exports remain in `test-generation/`. `npm run prompts:export` rebuilds the prompt document and JSON. The optional `node test-generation/generate-fixtures.mjs` command reads one API key from stdin, generates each of the 22 tests sequentially and updates only their fixtures; invoke it deliberately because it makes paid API requests.

## Visual direction

Higgsfield generated two new UI references in `assets/references/desktop.png` and `mobile.png`. They inform the ivory, ink-green, editorial typography and botanical layout. The live tree is SVG so leaves genuinely follow test state and the map can grow with the skill list. The three earlier Higgsfield tree assets remain in the appearance picker. Images are local; the optional Golos Text font has a system fallback.

## Verification

`npm test` covers the existing prompt/generation suite plus per-test author permissions and forged body identities. Verification does not consume API quota.

Browser checks at 390 × 844 and 1280 × 900 covered scrolling, mobile overflow, successful and failed tests, one leaf/+200 XP, draggable controls, immediate profile/role/XP changes, adding a 23rd skill, author editing, employee denial, and scoped author-studio skills. The simulated call was checked before 15 minutes, after eligibility, with duplicate fast-forward, and with an absent participant. Direct model checks exercised the exact 15-minute boundary, muted/disconnected time, duplicate reward prevention, a 120-skill tree and tenure scaling.

All app changes and test edits are in memory and reset on reload. Only the switchable demo-identity cookie lasts for the browser session. No production deployment, real video service, HR integration, recording storage or real Jira connection is included.

Captured on branch **ui-three-askarbek**.
