# E2E tests (Playwright)

Full-stack specs: real Postgres + real Express API + real Vite dev server.
No mocking — the specs drive the browser and assert against the database.

## One-time setup

```bash
npm install                 # installs @playwright/test
npx playwright install chromium
```

## Start the stack

Three processes. Playwright does **not** manage them, so a failing spec leaves
everything up for debugging.

**1. Postgres** (Windows Docker Desktop CLI from WSL):

```bash
docker.exe run -d --name tg-e2e-pg \
  -e POSTGRES_USER=trustguard -e POSTGRES_PASSWORD=trustguard \
  -e POSTGRES_DB=trustguard -p 5432:5432 postgres:15-alpine

# wait for it, then load the schema + fixtures
until docker.exe exec tg-e2e-pg pg_isready -U trustguard >/dev/null 2>&1; do sleep 1; done
docker.exe exec -i tg-e2e-pg psql -U trustguard -d trustguard < init.sql
docker.exe exec -i tg-e2e-pg psql -U trustguard -d trustguard < e2e/seed.sql
```

`e2e/seed.sql` is idempotent — re-run it any time to reset fixtures.

**2. API** on port 3000:

```bash
./e2e/start-api.sh
```

**3. Web** on port 8080:

```bash
npm run dev
```

## Run

```bash
npx playwright test                    # all specs
npx playwright test e2e/auth.spec.ts   # one spec
npx playwright test --ui               # interactive
npx playwright show-report             # after a CI run
```

## Seeded accounts

All three use password `E2ePass@2026!`:

| Email | Role |
|---|---|
| `e2e-admin@trustguard.test` | admin |
| `e2e-analyst@trustguard.test` | tprm_analyst |
| `e2e-vendor@trustguard.test` | vendor |

## Environment overrides

| Var | Default |
|---|---|
| `E2E_WEB_URL` | `http://localhost:8080` |
| `E2E_API_URL` | `http://localhost:3000` |

## Notes

- `workers: 1`, `fullyParallel: false` — specs share one database and the
  fixtures assume no concurrent writers.
- `NODE_ENV=test` (set by `start-api.sh`) raises the rate limits. Without it the
  auth limiter trips after ~20 logins and the suite 429s.
- On WSL `/mnt/c` the Vite HMR websocket does not fire (9p filesystem). Restart
  `npm run dev` after editing `src/` or the browser keeps serving stale modules.
