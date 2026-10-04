# Fix "Failed to fetch" — backend unavailable

## What was found
- The app's code is not the cause. Every sign-in and data request fails because the Lovable Cloud backend (database + login) is not responding.
- Checks done today (04/10/2026):
  - Backend status check: "database unreachable" (server answers with error 521 — server down).
  - Database health check: no metrics available (same 521 error).
  - Direct test of the login service: 521 (down). The front door of the data service answers, but the database behind it does not.
- The backend is not paused and a restart was already attempted earlier; it did not come back.

## Plan
1. Check the backend status once more; if it is still down, trigger one more restart and wait a few minutes, re-checking until it reports "running normally".
2. If it recovers: sign in with your account in the preview, open Dashboard and Movimentos, and confirm data loads and the error is gone. Also confirm the published app works.
3. If it is still down after the second restart: this is an infrastructure problem that only Lovable support can fix. You will need to contact support (from the Help menu) mentioning "backend unreachable, error 521 after restart". No app changes will be made, since changing code would not fix it.

## Technical details
- `cloud_status`: `backend_unreachable_db: auth→database probe: data plane responded 521`.
- `db_health`: `metrics_unavailable: 521`.
- `GET /auth/v1/health` → 521; `GET /rest/v1/` → 401 (gateway up, no key auth), so the gateway is alive but Postgres/auth upstream is down.
- Instance: Tiny, not paused. If it recovers but goes down again, consider upgrading the instance size (possible resource exhaustion) — to be decided after recovery with logs available.
