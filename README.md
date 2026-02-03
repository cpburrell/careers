## Dev

### Run the app

- `npm install`
- `npm start`
- Open `http://localhost:3000`

### Postgres (dev via Docker)

This repo includes a `docker-compose.yml` for running Postgres locally.

- Create `.env` from `.env.example` (optional; defaults are provided).
- Start Postgres: `docker compose up -d postgres`
- Stop Postgres: `docker compose down`

Persistence:
- Data is persisted to `./.pgdata/` (a local folder) and will survive restarts and reboots.
- To delete the data: stop Postgres (`docker compose down`) and remove `./.pgdata/`.

Initialization:
- On first container creation (empty `./.pgdata/`), Postgres automatically runs `db/init_dev.sql` and loads the current `roles.json` and SFIA CSV.
- To re-run initialization, delete `./.pgdata/` and start Postgres again.

Users:
- The container runs with an admin user (`POSTGRES_USER`, usually `postgres`).
- The init process creates/updates an app user (`CAREERS_DB_USER`, default `careers`) with password `CAREERS_DB_PASSWORD`.

### Switching data sources

By default the app reads from local files (`roles.json`, `sfia_levels.json`, and the SFIA CSV).

- File mode (default): `CAREERS_DATA_SOURCE=file`
- Postgres mode: `CAREERS_DATA_SOURCE=db` (requires the dev DB init step above)

Connection:
- Set `DATABASE_URL` (recommended) or `PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE`.
