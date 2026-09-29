# TrustGuard AI - Third-Party Risk Management Platform

A comprehensive TPRM platform for managing vendor security assessments with AI-powered risk analysis.

## 🚀 Features

- **Vendor Management**: Create, track, and manage vendor relationships
- **Security Assessments**: Data-driven questionnaires for security evaluation
- **Deterministic Risk Scoring**: Answers are weighted and scored 0–100 on the
  server, banded low / medium / high / critical. No model in the loop — the same
  answers always produce the same score.
- **AI Assistant**: Optional BYOK chat over assessment context. Off until a
  provider and key are set; the endpoint returns 503 otherwise, and the UI says
  so rather than failing silently.
- **Configurable SMTP & AI**: Admins set email delivery and AI provider from
  Settings, no redeploy. Stored values take precedence over `SMTP_*` / `AI_*`
  environment variables, which remain the fallback. Both cards have a live
  connection test.
- **Role-Based Access Control**: Admin, TPRM Analyst, and Vendor roles
- **Dashboard & Reporting**: Risk metrics, plus PDF / Excel export
- **Audit Trail**: Evidence and remediation actions are recorded with actor and
  resource. There is no global logging middleware, so this is not a complete
  record of every request.

## 🏗️ Architecture

### Frontend
- React 18 + TypeScript
- Vite for build tooling
- Tailwind CSS + shadcn/ui for styling
- React Query for data fetching
- React Router for navigation

### Backend
- Node.js + Express
- PostgreSQL database
- JWT authentication
- RESTful API

### Infrastructure
- Docker & Docker Compose
- Nginx for production serving, and it proxies `/api/` to the API container so
  the browser only ever talks to one origin
- Health checks on all three services

## 📋 Prerequisites

- Node.js 20+
- Docker & Docker Compose (for containerized deployment)
- PostgreSQL 15+ (for local development without Docker)
- npm (both `package-lock.json` and `bun.lockb` are committed; the Docker builds
  use `npm ci`, so npm is the path of least surprise)

## 🛠️ Local Development Setup

### Option 1: Using Docker Compose (Recommended)

1. **Clone the repository**
```bash
git clone <repository-url>
cd trustguard
```

2. **Configure environment variables**
```bash
cp .env.example .env
# Fill in DB_PASSWORD and JWT_SECRET (generate both, see the file for commands).
# Set ADMIN_PASSWORD too, or you will have no way to log in — see the note below.
```

3. **Start all services**
```bash
docker compose up -d
```

This will start:
- PostgreSQL database on port 5432
- Backend API on port 3000
- Frontend web app on port 80

4. **Access the application**
- Frontend: http://localhost
- API: http://localhost:3000
- API Health: http://localhost:3000/health

There is no default admin password. `init.sql` seeds `admin@trustguard.ai`
using the `ADMIN_PASSWORD` environment variable, hashed at seed time with
pgcrypto. Leave it blank and no admin is created. Either way the account has
`must_change_password = true` and is forced to set a new password on first
login.

`ADMIN_PASSWORD` is read **only on first initialization** — i.e. when the
`postgres_data` volume is empty. On an existing volume, changing it in `.env`
does nothing. To reset the database and reseed:

```bash
docker compose down -v   # -v drops the volume; this deletes all data
docker compose up -d
```

### Option 2: Local Development

1. **Install dependencies**
```bash
# Frontend
npm install

# Backend
cd server
npm install
```

2. **Setup database**
```bash
# Create database
createdb trustguard

# Run initialization script
psql -d trustguard -f init.sql
```

3. **Configure environment**
```bash
cp .env.example .env
# Update DB_HOST=localhost in .env
```

4. **Start backend**
```bash
cd server
npm run dev
```

5. **Start frontend** (in another terminal)
```bash
npm run dev
```

The dev server listens on **http://localhost:8080** and proxies `/api` to
`http://localhost:3000` (override with `VITE_API_PROXY_TARGET`). This is a
different port from the Docker deployment's :80 — see the note under Docker
Commands.

## 🐳 Docker Commands

Compose v2 is assumed (`docker compose`). `docker-compose` v1 also works.

```bash
# Build all images
docker compose build

# Start services
docker compose up -d

# Stop services
docker compose down

# View logs
docker compose logs -f

# Restart a service
docker compose restart api

# Rebuild and restart
docker compose up -d --build
```

**The frontend is baked at build time.** `VITE_API_URL` is compiled into the
bundle by the `web` image's build stage, so editing it in `.env` has no effect
until you rebuild:

```bash
docker compose up -d --build web
```

If you change frontend source and the app on :80 still looks stale, this is
why. Rebuild rather than restart.

## 📁 Project Structure

```
trustguard/
├── src/                    # Frontend React code
│   ├── components/        # UI components (shadcn/ui based)
│   ├── contexts/          # React contexts (AuthContext)
│   ├── hooks/             # Custom hooks
│   ├── pages/             # Route-level components
│   ├── lib/               # api.ts, riskScoring.ts, utils.ts
│   ├── styles/            # design-tokens.css
│   └── types/             # TypeScript types
├── server/                 # Backend API
│   ├── app.js             # Express app and route mounting
│   ├── db.js              # Postgres pool
│   ├── index.js           # Entry point; listen + DB retry
│   ├── routes/            # API route handlers
│   ├── middleware/        # auth.js — JWT, roles, session timeout
│   ├── services/          # riskScoring, emailService, scheduler
│   └── test/              # Jest suite (real routers, mocked pool)
├── e2e/                    # Playwright specs (see e2e/README.md)
├── docker-compose.yml     # Docker orchestration
├── Dockerfile             # Frontend image (build → nginx)
├── Dockerfile.api         # Backend image
├── init.sql               # Database schema and seed
├── nginx.conf             # Nginx config; proxies /api/ to the API
└── security-headers.conf  # CSP and friends, included per-location
```

## 🔐 Security Considerations

1. **Set `ADMIN_PASSWORD` before first boot**, then change it on first login
   (`must_change_password` forces this).
2. **Use strong `JWT_SECRET`** in production (generate with `openssl rand -hex 32`)
3. **Enable HTTPS** in production. `security-headers.conf` deliberately does not
   send HSTS — this server listens on plain HTTP :80, so sending it would lock
   users out. Add it at whichever layer terminates TLS.
4. **Regular security updates** for dependencies
5. **Database backups** should be configured
6. **Environment variables** should never be committed

Sessions end after **15 minutes of inactivity** and force a re-login after
**8 hours** regardless of activity. The inactivity clock is process-local: an
API restart hands every user a fresh 15-minute window.

## 📊 API Endpoints

All routes are mounted under `/api` and require a `Bearer` token unless marked
**public**. `(admin, tprm_analyst)` means `requireRole` restricts it; unmarked
routes require only a valid token, and enforce per-record ownership in the
handler instead.

### Authentication — `/api/auth`
- `POST /register` - **public**; always 404. Admins create users instead.
- `POST /login` - **public**; auth rate limit, 20 per 15 min
- `GET /me` - Current user
- `POST /change-password` - Change password
- `POST /logout` - Logout

### Users — `/api/users`
- `GET /` - List all users (admin)
- `POST /` - Create user (admin)
- `GET /:id` - Get user by ID (admin, tprm_analyst)
- `PATCH /:id/role` - Update role (admin)
- `PATCH /:id/status` - Activate/deactivate (admin)

### Vendors — `/api/vendors`
- `GET /` - List vendors (admin, tprm_analyst)
- `GET /my-vendors` - Vendors the caller owns
- `GET /:id` - Get vendor details
- `POST /` - Create vendor (admin, tprm_analyst)
- `PATCH /:id` - Update vendor
- `DELETE /:id` - Delete vendor (admin, tprm_analyst)

### Assessments — `/api/assessments`
- `GET /` - List assessments (admin, tprm_analyst)
- `GET /my-assessments` - Assessments for vendors the caller owns
- `GET /:id` - Get assessment
- `GET /:id/details` - Assessment with responses
- `GET /:id/responses` - Responses only
- `POST /` - Create assessment (admin, tprm_analyst)
- `POST /:id/responses` - Submit response
- `POST /:id/submit` - Submit for review
- `POST /:id/review` - Review assessment (admin, tprm_analyst)
- `GET /:id/reviews` - Review history
- `POST /:id/comments` - Add review comment (admin, tprm_analyst)

### Questions — `/api/questions`
- `GET /` - List questions
- `POST /` - Create question (admin, tprm_analyst)
- `PUT /:id` - Update question (admin, tprm_analyst)
- `DELETE /:id` - Delete question (admin, tprm_analyst)

### Invitations — `/api/invitations`
- `GET /:token` - **public** lookup; what the invite page reads
- `POST /:token/accept` - Bind the invitation's vendor to the caller
- `POST /` - Create invitation (admin, tprm_analyst)

### Evidence — `/api/evidence`
- `POST /` - Upload document (multipart, field `file`)
- `GET /` - List evidence
- `GET /:assessmentId` - Evidence for one assessment
- `GET /:id/download` - Download
- `PATCH /:id/verify` - Validate or reject (admin, tprm_analyst)
- `DELETE /:id` - Delete

### Remediation — `/api/remediation`
- `GET /` - List all items (admin, tprm_analyst)
- `GET /:assessmentId` - Items for one assessment
- `POST /` - Create item (admin, tprm_analyst)
- `PATCH /:id` - Update item
- `PATCH /:id/complete` - Mark complete
- `PATCH /:id/verify` - Verify (admin, tprm_analyst)
- `PATCH /:id/close` - Close (admin, tprm_analyst)
- `POST /:id/comment` - Add comment

### Audit Logs — `/api/audit-logs`
- `GET /` - Query logs (admin)
- `GET /user/:userId` - Logs for one user
- `GET /export` - Export JSON or CSV (admin)
- `GET /stats` - Aggregate stats (admin)

### Notifications — `/api/notifications`
- `GET /` - List notifications
- `GET /unread-count` - Unread count
- `PATCH /:id/read` - Mark one read
- `PATCH /read-all` - Mark all read
- `POST /` - Create notification (admin, tprm_analyst)
- `GET /templates` - List templates (admin, tprm_analyst)
- `PATCH /templates/:id` - Update template (admin)

### Reports — `/api/reports`
- `GET /assessment/:id/pdf` - Assessment PDF
- `GET /assessment/:id/excel` - Assessment Excel
- `GET /vendors/summary/excel` - Vendor summary Excel (admin, tprm_analyst)

### AI — `/api/ai`
- `POST /chat` - Chat completion (admin, tprm_analyst). Returns 503 until a
  provider and API key are configured (Settings UI or environment).

### Settings — `/api/settings` (admin)
- `GET /` - Current SMTP / AI config. Stored secrets are never returned; the
  response carries `secretsSet` booleans instead.
- `PATCH /` - Update any subset of `SMTP_*` / `AI_*`. Send `""` to clear an
  override and fall back to the environment. Unknown keys are ignored.
- `POST /test-email` - Sends a message to the caller's own address.
- `POST /test-ai` - One request to the configured provider.

### Health
- `GET /health` - Liveness. Returns **200** with `database: "disconnected"` when
  the DB is unreachable, so it will not fail a container healthcheck on its own.
  A database outage therefore shows as a healthy container serving 500s.

## 🧪 Testing

```bash
# Backend unit tests — Jest, real routers against a mocked pool (220 tests)
cd server && npm test

# Frontend unit tests — Vitest
npm run test

# End-to-end — Playwright, real Postgres + API + dev server
# Requires the stack from e2e/README.md to be running first.
npm run test:e2e
```

The backend suite imports the real routers (`server/test/app.js` shims
`createApp()`), so it fails when a route's behavior changes, not just when a
mock does. The e2e specs assume ports 5432 / 3000 / 8080 and share one database
— they run serially, and can leave rows behind between runs.

Manual check: `curl http://localhost:3000/health`

## 🔄 Migration from Supabase

This project has been migrated from Supabase to a self-hosted PostgreSQL setup. Key changes:

1. **Authentication**: Moved from Supabase Auth to JWT-based auth
2. **Database**: Schema adapted from Supabase migrations to standalone PostgreSQL
3. **API**: New Express backend replaces direct Supabase client calls
4. **Frontend**: Updated to use REST API instead of Supabase client

The `supabase/` directory of original migrations has since been removed; the
schema in `init.sql` is now the source of truth.

## 📝 Environment Variables

See `.env.example` for all available options:

| Variable | Description | Default |
|----------|-------------|---------|
| DB_USER | Database username | trustguard |
| DB_PASSWORD | Database password | **required** — `openssl rand -base64 24` |
| DB_NAME | Database name | trustguard |
| DB_HOST | Database host | db (compose); localhost for bare-metal |
| DB_PORT | Database port | 5432 |
| ADMIN_PASSWORD | Seeds `admin@trustguard.ai`; blank seeds no admin | blank |
| JWT_SECRET | JWT signing secret | **required** — `openssl rand -hex 32` |
| API_PORT | Published API port | 3000 |
| WEB_PORT | Published web port | 80 |
| FRONTEND_URL | Origin invitation links point at; must be reachable by the recipient's browser | http://localhost |
| VITE_API_URL | Separate API host; blank = same origin | blank |

`docker compose up` refuses to start until `DB_PASSWORD` and `JWT_SECRET` are
set — there are no working defaults.

`DATABASE_URL` overrides the `DB_*` values if set. `VITE_API_URL` is a
build-time variable — it is compiled into the frontend bundle, so changing it
requires rebuilding the `web` image.

`SMTP_*` and `AI_*` are optional. They are the **fallback** for anything not set
in Settings: the admin UI writes to an `app_settings` table, and a key with no
row there (or a blank one) reads the environment instead. So an existing
`.env`-only deployment keeps working, and clearing a field in the UI restores
the environment value rather than blanking the config. Both sets are passed into
the api container by compose, so `.env` works for them too.

## 🚨 Production Deployment

1. **Update .env** with secure values
2. **Build images**: `docker compose build`
3. **Deploy** to your cloud provider
4. **Configure SSL/TLS** termination
5. **Set up monitoring** and alerts
6. **Configure backups** for PostgreSQL volume

## 📄 License

MIT

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request
