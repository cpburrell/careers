# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

A Node.js/Express + EJS web app for browsing SFIA-based career roles and skill requirements. Users can explore roles by pathway (IC/LM) and level (1–7), view the SFIA skills required at each level, and drill into skill descriptions.

## Commands

```bash
npm install          # Install dependencies
npm start            # Run app at http://localhost:3000 (nodemon + --inspect always on)
npm test             # Run Jest test suite (30s timeout; parses CSV)
```

Run a single test file:
```bash
npx jest tests/app.routes.test.js
```

Debug data loading (prints parsed indexes to stdout):
```bash
npm run skills    # Print all parsed SFIA skills + levels
npm run roles     # Print all roles × pathways × levels
npm run doBoth    # Both together
```

Regenerate AI descriptions overlay:
```bash
python3 scripts/generate_sfia_ai_descriptions.py
```

## Architecture

**Data flow:** `index.js` → `lib/dataStore.js` (loads + indexes all data) → routes query indexes → EJS templates render.

**`lib/dataStore.js`** is the core — it loads all data at startup, builds in-memory indexes, and exposes them to routes. Data loading always uses the `file` source:
- reads `roles.json` and `sfia-8_en_220221.xlsx - Skills.csv`

`loadAll()` is called at startup and runs `validateData({ strict: true })` after loading — this will crash the server if `roles.json` references unknown skill IDs or has other integrity errors. Validation is strict by design.

Key indexes built at startup:
- `skillsById`, `skillsByCategoryId`, `categoriesById`, `levelByNumber`
- `rolesById`, `pathwaysById`
- `sfiaByCode`

**`lib/createApp.js`** is a factory (`createApp({ dataStore })`) — it does not export a singleton app. Routes are created fresh each call. Tests exploit this to create isolated app instances with the shared dataStore.

**AI descriptions overlay (`sfia_ai_descriptions.json`):** When a SFIA skill is missing a level description in the CSV, the app falls back to entries in this file. Descriptions prefixed with `"AI created:"` are flagged as AI-generated (`is_ai: true`) and displayed differently in the UI. Internally, parsed SFIA CSV rows have a `__ai` object (`{ "3": true, "5": true }`) tracking which levels used AI-generated text.

**Voting feature:** On role-level detail pages, users can suggest a different SFIA required level for each skill, and vote to add/remove skills entirely. Votes are stored in MariaDB (`careers.votes` and `careers.skill_presence_votes`) via `db/queries.js`. The feature gracefully degrades (hidden) when MariaDB is unavailable or unconfigured — `isDatabaseConfigured()` guards all DB calls. A persistent `voter_token` cookie issued on first visit provides anonymous voter identity.

**Data model:**
- `roles.json` — roles with pathways (`ic`/`lm`) × levels (1–7); each level has a `title` and `selected_skills` array of `{skill_id, required_level}`
- `sfia_levels.json` — SFIA level names (Follow, Assist, Apply, Enable, Ensure & Advise, Initiate & Influence, Inspire & Mobilise)
- SFIA CSV — skill categories, codes, names, and level descriptions

**Routes:**
- `/roles`, `/roles/:roleId/pathway/:pathwayId/level/:levelId`
- `/skills`, `/skills/:skillId/`, `/skills/:skillId/level/:levelId`
- `/sfia/`, `/sfia/:code/level/:levelId`

**`db/queries.js`** is lazy-loaded — `mysql2` is only `require()`d when a DB function is actually called, so the app works without MariaDB configured.

## Tests

Tests always force `CAREERS_DATA_SOURCE=file`, load real CSV data, and build a full real index — no mocking. The `app` instance is created fresh in `beforeAll` via `createApp({ dataStore })`.

## Git workflow

Follows git-flow. The `master` branch is production-only (releases/hotfixes). Day-to-day work goes on `develop`; feature branches (`feature/*`) PR into `develop`. Use `bin/git-flow-init.sh` to configure git-flow tooling locally.

## Environment

Copy `.env.example` to `.env`. Key variables:
- `MARIADB_HOST`, `MARIADB_PORT`, `MARIADB_USER`, `MARIADB_PASSWORD`, `MARIADB_DATABASE` — MariaDB connection (voting feature only)
- `MARIADB_SSL` — set to `true` to enable SSL (recommended for remote servers)

## MariaDB dev notes

Schema lives in `deploy/schema.sql`. Apply manually to a running MariaDB instance. The MariaDB server must have `skip-name-resolve` set and `bind-address=0.0.0.0` for remote connections. Voting feature is disabled automatically when `MARIADB_HOST` is unset.

## Deployment

The app runs on an LXC container at `careers.cburrell.com` (192.168.2.42), Debian 12, Node 22. Deploy with:
```bash
bin/deploy.sh    # rsync + npm install + systemctl restart (~30s)
```
Provision a fresh container with `bin/provision-lxc.sh`.
