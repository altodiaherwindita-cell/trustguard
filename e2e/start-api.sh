#!/usr/bin/env bash
# Start TrustGuard API against the E2E Postgres container.
# ponytail: local E2E only; env is inline, no .env file so dev config is untouched.
set -euo pipefail
cd "$(dirname "$0")/../server"
export DB_HOST=localhost DB_PORT=5432 DB_USER=trustguard DB_PASSWORD=trustguard DB_NAME=trustguard
export JWT_SECRET=e2e-test-secret-not-for-production
export PORT=3000 NODE_ENV=test FRONTEND_URL=http://localhost:8080
export UPLOAD_PATH=/tmp/tg-e2e-uploads
mkdir -p "$UPLOAD_PATH"
exec node index.js
