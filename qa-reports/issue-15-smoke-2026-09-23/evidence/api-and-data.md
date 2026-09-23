# API and data evidence

Observed during the local smoke run; session cookies and raw tokens were not collected.

```text
GET /api/health                         200; dataset_version 1.0; as_of_date 2026-10-01
GET /api/demo/accounts                  200; 200 accounts
POST /api/demo/login (E0174)            200
GET /api/me/profile                     200; employee E0174; history_count 5
GET /api/employees/E0001 (as E0174)     403
GET /api/me/profile (anonymous)         401
GET /api/operator/clock                 200; 2026-10-01
PUT /api/operator/clock (2026-10-15)    200; 2026-10-15
API restart; GET /api/operator/clock    200; 2026-10-15 persisted
POST /api/operator/clock/reset          200; 2026-10-01

PostgreSQL counts after restart:
employees=200
events=40
skills=60
role_profiles=32
history=2743
```

The browser account selector searched for both E0174 and E0003. E0003 has no career goal; the profile showed the explicit no-goal state and its real source history. The later account switch to E0174 persisted through reload and a second API restart.
