# Halyk · Мой рост — UI prototype

**Throwaway, fully mocked interface.** No backend, real login, Jira access, messages, or persistent storage. The prototype answers: “How should an employee-growth mini-app live inside Halyk, with a tenure-based tree, career goals and its own navigation?”

## Run

Requires Node.js 20 or newer. No installation or build step.

```sh
cd ui-three-progress
npm run dev
```

Open [localhost:4173](http://localhost:4173). The landing view is the authenticated Halyk banking home. An employee-only **Мой рост** service card opens the mini-app.

For a presentation without the developer variant bar, use `npm run preview`. Set `PORT=4174 npm run dev` if the default port is occupied. The server binds only to the local computer.

## One source of mock data

[`mock-data.json`](./mock-data.json) is the single mock-data document, loaded by the UI at startup. It contains fictional employees, the banking-home context, tests and answer keys, role requirements, career goals, XP rules and levels, tree choices, themes, contributions, Jira fixtures and meeting slots. Edit that document and reload the page to change the scenario.

All interactions mutate an in-memory copy. A reload or a profile change restores the starting snapshot. `localStorage`, cookies and real APIs are not used. The initial XP is a seeded historical balance; it is not recomputed from the displayed historical sample. New rewards are calculated by the UI and awarded only once.

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

Verified in the browser at desktop and 390 × 844 mobile size: entry gating, employee navigation and Halyk return, test save/resume and +200 XP, optional test enrollment, goal changes, scheduled meetings, profile updates, Jira confirmation and duplicate-sync prevention, level-8 theme unlock, saved apple/night customization, six-month tree sizing, and all three layouts. Browser error/warning logs were empty during the checked flow. JavaScript syntax and the mock JSON were also checked. No automated test suite was added for this throwaway prototype.

**Verdict:** the proposed service-card entry and dedicated mini-app navigation make the Halyk return action clear without crowding the banking tab bar. The interactive prototype demonstrates the requested behavior; the final layout choice and production architecture remain open.

Captured on branch **`ui-three-askarbek`**. The changes are isolated in this folder; no production implementation is promoted to main.
