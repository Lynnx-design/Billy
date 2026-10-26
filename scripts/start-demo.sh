#!/bin/sh
# Runs the API and the web app in one service (used by render.yaml).
# The API listens on 4000 inside the container; the web app takes $PORT and forwards /api to it.
set -e
API_PORT=4000 pnpm --filter @billy/api start &
exec pnpm --filter @billy/web exec next start -p "${PORT:-3000}"
