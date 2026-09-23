# QA report: issue #15 foundation

## Run context

- Time: 2026-09-23 11:25 UTC.
- Environment: local Docker Compose, `http://localhost:8080`; branch `codex/prototype-career-map-10`, base revision `b265f99`, working tree dirty with the issue #15 implementation.
- Scope: clean initial startup/migrations/seed, employee selection and profile, session boundaries, persisted data and demonstration date, desktop browser rendering.
- Requirements: [GitHub issue #15](https://github.com/BAITC-Hacks/hack-00bb406c-attractor-t800/issues/15), project `README.md`, starter kit README.
- Browser: Chrome on macOS, observed viewport approximately 1512×826. No mobile emulation or physical device was used.
- Dataset contains synthetic people and organizations only.

## Coverage

| Scenario | Status | Observed result |
| --- | --- | --- |
| `docker compose up -d --build` from a newly created project volume | Passed | PostgreSQL, API, and web containers became healthy/running after fixes recorded below. |
| Alembic migration and first seed | Passed | Migrations `0001_initial` and `0002_optional_activity_due_date` applied; seed loaded the official 1.0 dataset. |
| Seed counts | Passed | 200 employees, 40 events, 60 skills, 32 role profiles, 2,743 history rows. Counts stayed unchanged after two API restarts. |
| Select arbitrary employee and show profile | Passed | Browser search selected E0174 and E0003; actual role, grade, department, goal/no-goal state, skill requirements, and source history appeared. |
| Change synthetic account and retain server identity | Passed | E0003 → E0174 produced the E0174 server session; E0174 remained selected after browser reload and API restart. |
| Protected profile endpoints | Passed | Anonymous `/api/me/profile` returned 401; another employee profile returned 403; selected employee returned 200. |
| Demonstration date | Passed | Advanced from 2026-10-01 to 2026-10-15, remained after API restart, then reset to 2026-10-01. Official source files were unchanged. |
| Desktop rendering | Passed | Profile, career-goal empty state, metrics, skills and history rendered without visible clipping in the inspected desktop view. The complete history count is displayed; the UI lists the latest 8 rows when a profile has more. |
| Mobile viewport / responsive interaction | Not run | The selected browser control surface did not expose viewport emulation during this run. CSS includes a narrow-screen layout, but it was not observed at mobile dimensions. |
| Android WebView | Not run | Covered by downstream issue #26; no Android device/emulator proof was collected here. |
| Full accessibility, browser console/network, performance budgets | Not run | Outside this smoke run; no claim is made about these checks. |

## Startup defects found and fixed during implementation

1. The official CSV permits an empty `due_date`; the original schema created that column `NOT NULL`. Added an explicit nullable column and Alembic migration `0002`.
2. The seed queued history before event rows had been flushed; PostgreSQL rejected the foreign key. Added a parent-row flush before history insertion. The complete seed then committed atomically.

These startup failures were reproduced and resolved before the final coverage above. No startup failure remained in the final run.

## Evidence

- [API and dataset observations](evidence/api-and-data.md)
- [Browser profile observations](evidence/browser-profile.md)
- [Container startup and migration observations](evidence/containers.md)

## Cleanup

No official data was changed. The app and PostgreSQL volume remain running so the user can inspect the result. Stale test-created synthetic sessions were removed; the final browser selection was E0003. No other test records were created.
