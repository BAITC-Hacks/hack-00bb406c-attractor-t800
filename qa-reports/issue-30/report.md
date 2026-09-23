# Issue #30 — acceptance, 2026-09-23

Implemented Halyk «Мой рост», variant A, from
`5153f9030ea081aa0496d8589952d60f91c44e8c` in the existing React/Vite client.
Foundation contracts, API, schema and Compose configuration are unchanged.

## Validation

- [Production build](evidence/build.log): passes. The project has no configured
  typechecker or unit-test suite; no typechecking claim is made.
- [Foundation HTTP acceptance](evidence/foundation.jsonl): all 15 checks pass
  against isolated Compose project `issue30`, port 18090, fresh PostgreSQL volume.
- [Full browser acceptance](evidence/browser.log): passes using real nginx/API/DB
  for account search, login, Halyk entry, navigation, real and absent career goals,
  every returned skill/history record, reload and account switching; operator
  date save, reload, employee visibility and reset also pass.
- HTTP-boundary fault injection verifies loading, 503/retry, failed logout,
  failed date save, session expiry during navigation and restoration, and empty
  skills/history. These error fixtures are not persisted to the database.
- [Restart checks](evidence/persistence.log): custom and reset dates persist;
  operator session survives restart; full employee profile, skills and history
  compare equal before/after restarting all three services.
- Mobile 390×844 and desktop 1440×1000: no horizontal overflow, all image requests
  loaded, navigation in viewport, keyboard focus visible, no uncaught page errors.
  [Mobile tree](evidence/mobile-tree.png), [desktop tree](evidence/desktop-tree.png).
- First browser tracer failed on the old interface. A restoration-expiry
  regression test also failed before the fix and passed after rebuilding.

## Review

**Standards:** one test gap found (repeated history titles could hide an omitted
record), fixed with row count plus ordered event/date assertions. Reviewer
confirmed resolved; no outstanding findings.

**Spec:** one session restoration gap found (401 from profile was treated as an
anonymous visit), fixed by only suppressing the API's explicit missing-cookie
response. Regression passes; reviewer confirmed resolved.

**Visual finish:** independent inspection of all six mobile/desktop captures and
source prototype returned **ship**. [Mechanical detector](evidence/design-detector.json)
reported no findings. The source tree illustration, palette, service entry and
navigation are retained; mocked balances, XP, readiness and tests are not shown
as real data.

## Local environment caveat

The pre-existing main database volume has migration `0006_development_consents`,
while this checkout ends at `0002_optional_activity_due_date`. A default rebuild
exposed this mismatch. No database records, migration stamps or volumes were
removed or downgraded. The prior local API image was restored using a temporary
Compose override that starts uvicorn without rerunning migrations; the new web
client is serving at port 8080. Clean startup and restart verification used the
isolated fresh database, not that incompatible volume. See
[run and test instructions](../../web/UI-MIGRATION.md).

Pre-existing uncommitted README content and root prototypes were excluded from
the implementation commit; only the new issue #30 README section was staged.
