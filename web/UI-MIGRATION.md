# Halyk «Мой рост» — issue #30

UI source: `origin/ui-three-askarbek`, pinned to
`5153f9030ea081aa0496d8589952d60f91c44e8c` (`ui-three-progress`).
Variant A («Живое дерево») is the default assumption in the approved issue.
The green Halyk shell, service entry, tree composition and navigation are adapted
into the existing React/Vite app. `public/trees/oak.png` is copied unchanged from
that commit's `ui-three-progress/assets/oak.png`. The prototype server, mock data,
AI test laboratory, variants B/C and developer controls are not dependencies.

## Run

From the repository root:

```sh
docker compose up -d --build
```

Open http://localhost:8080. Search by employee ID, name, role or department;
select an account, then select **Мой рост**. Navigation includes **Дерево**,
**Тесты**, **Цели**, **Профиль** and **Halyk**. The HttpOnly server session
survives reloads. **Выйти** returns to account selection.

Profile, career goal, skills, requirements, history and demo date come from the
existing API. All returned skills and history records are shown. Tenure is the
stored `tenure_months` value from the official dataset, not a calculation from
the demo date. Tree appearance is decorative; XP and tree levels have no data.
Tests, goal editing and bank operations are explicitly unavailable. No fake
balances, completion results, awards or manager permissions are introduced.

Operators use **Войти как оператор** to save or reset the demo date. Date saves
and logout only report success after a successful server response. Expired
sessions clear the current identity; failed profile loads have retry states.

## Acceptance boundary

Run browser checks against a **disposable** Compose project/database: the
operator checks change the shared demo date. For example, create an override:

```yaml
# /tmp/career-quest-acceptance.yml
services:
  web:
    ports: !override
      - "127.0.0.1:18090:80"
```

```sh
docker compose -p issue30 -f docker-compose.yml -f /tmp/career-quest-acceptance.yml up -d --build
python3 scripts/acceptance/foundation.py http://localhost:18090
```

The foundation scenario leaves a `2026-10-15` persistence marker. Restart the
isolated services and check the date before resetting it. Browser checks require
Node 20+ and Playwright (install into a temporary tools directory, or use an
existing runtime; no new production dependency is needed):

```sh
npm install --prefix /tmp/career-quest-browser playwright
/tmp/career-quest-browser/node_modules/.bin/playwright install chromium
NODE_PATH=/tmp/career-quest-browser/node_modules node scripts/acceptance/growth-ui.cjs http://localhost:18090
npm --prefix web run build
```

Use `SCREENSHOT_DIR=/tmp/growth-ui` to retain desktop/mobile screenshots.
The browser scenario uses real nginx/API/database responses for the main flow;
response interception is used only for unavailable-server, expired-session,
loading and empty-state checks. This JavaScript project has no configured
TypeScript checker or unit-test suite; Vite's production build checks syntax and
module resolution, and the HTTP/browser suites cover the agreed boundaries.

## Existing volumes from other branches

If startup says `Can't locate revision identified by '0006_development_consents'`,
the volume was migrated by a different branch. This checkout ends at
`0002_optional_activity_due_date`; do not downgrade or delete an existing volume
to test the UI. Use the separate Compose project above. During this implementation
that mismatch was observed on the main local volume; the prior API image was
restarted without migrations to preserve its existing data. The fresh acceptance
project uses the unchanged Compose startup and migrations successfully.
