# Careers (SFIA-based role & skill explorer)

This project is a small Express + EJS web app for browsing:
- Roles (e.g. Solution Architecture) by pathway (IC/LM) and level
- The SFIA skills relevant for a given role/pathway/level, including required level and skill-level descriptions

It supports two data sources:
- Files (default): reads `roles.json` and the SFIA CSV in this repo
- Postgres: reads the same data after importing it into a Postgres schema

## Quickstart

### Prerequisites
- Node.js
- npm

### Install & run
- `npm install`
- `npm start`
- Open `http://localhost:3000`

## Routes

- `/roles` — role table by pathway and level
- `/roles/:roleId/pathway/:pathwayId/level/:levelId` — role detail (skill requirements)
- `/skills` — SFIA skills list
- `/skills/:skillId/` — skill levels
- `/skills/:skillId/level/:levelId` — level description
- `/sfia/` — SFIA CSV browsing
- `/sfia/:code/level/:levelId` — SFIA skill detail (from CSV)

## Data model (files)

### Role requirements (`roles.json`)
For each role, each pathway (`ic`/`lm`) contains levels `1..7`. Each level has:
- `title` — human-readable title
- `selected_skills` — list of required skills with required levels:

```json
{
  "title": "Distinguished Solution Architect",
  "selected_skills": [
    { "skill_id": "ARCH", "required_level": 5 },
    { "skill_id": "STPL", "required_level": 5 }
  ]
}
```

### SFIA skill data
- Source CSV: `sfia-8_en_220221.xlsx - Skills.csv`
- SFIA level names/descriptions: `sfia_levels.json`
- AI overlay for missing level descriptions: `sfia_ai_descriptions.json`

Generate/refresh the AI overlay:
- `python3 scripts/generate_sfia_ai_descriptions.py`

## Data source selection

Set `CAREERS_DATA_SOURCE`:
- `file` (default)
- `db`

See `.env.example` for connection variables.

## Postgres (dev via Docker)

This repo includes a `docker-compose.yml` that can run **both** the app and Postgres.

### Start / stop
- Start app + DB: `docker compose up -d --build`
- Start DB only: `docker compose up -d postgres`
- Stop: `docker compose down`

Convenience scripts:
- `bin/docker-up.sh`
- `bin/docker-down.sh`
- `bin/docker-logs.sh`
- `bin/docker-reset-db.sh`

Make scripts executable once:
- `chmod +x bin/docker-*.sh`

### Persistence
- Postgres data is persisted to `./.pgdata/` and survives restarts/reboots.
- To wipe the DB: stop Postgres and delete `./.pgdata/`.

### Automatic initialization
When `./.pgdata/` is empty, Postgres runs init scripts automatically:
- `db/init_roles.sh` creates/updates the app DB role (`CAREERS_DB_USER`)
- `db/init_dev.sql` imports the SFIA CSV and `roles.json`

To force re-init:
- `docker compose down`
- `rm -rf .pgdata`
- `docker compose up -d postgres`

## Project layout

- `index.js` — app entrypoint (server only starts when run directly)
- `lib/dataStore.js` — loads data from file or Postgres and builds in-memory indexes
- `routes/` — Express routers
- `views/` — EJS templates
- `db/` — Postgres init scripts
- `scripts/` — maintenance scripts (e.g. AI overlay generator)

## Notes

- SFIA content may be subject to licensing restrictions. Be cautious before publishing full SFIA descriptions publicly.
