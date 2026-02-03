#!/usr/bin/env bash
set -euo pipefail

docker compose down
rm -rf .pgdata
docker compose up -d postgres
docker compose logs -f --tail=200 postgres

