\set ON_ERROR_STOP on
\echo ''
\echo '== careers: initializing dev database =='
\echo '  stage: schema/tables'

BEGIN;

CREATE SCHEMA IF NOT EXISTS careers;
SET search_path = careers, public;

-- Allow the app role to read from this schema (dev default role name: careers)
GRANT USAGE ON SCHEMA careers TO careers;

-- Raw ingested documents (handy as an import source + for debugging)
CREATE TABLE IF NOT EXISTS raw_roles (
	id bigserial PRIMARY KEY,
	doc jsonb NOT NULL,
	loaded_at timestamptz NOT NULL DEFAULT now()
);

-- SFIA CSV table (used as the source of truth for SFIA skills)
CREATE TABLE IF NOT EXISTS sfia_skill (
	id int,
	level_1 text,
	level_2 text,
	level_3 text,
	level_4 text,
	level_5 text,
	level_6 text,
	level_7 text,
	code text PRIMARY KEY,
	skill text,
	category text,
	subcategory text,
	overall_description text,
	guidance_notes text,
	level_1_description text,
	level_2_description text,
	level_3_description text,
	level_4_description text,
	level_5_description text,
	level_6_description text,
	level_7_description text
);

CREATE TABLE IF NOT EXISTS pathways (
	id text PRIMARY KEY,
	description text NOT NULL
);

CREATE TABLE IF NOT EXISTS roles (
	id text PRIMARY KEY,
	name text NOT NULL
);

CREATE TABLE IF NOT EXISTS role_levels (
	role_id text NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
	pathway_id text NOT NULL REFERENCES pathways(id) ON DELETE CASCADE,
	level int NOT NULL CHECK (level >= 1 AND level <= 7),
	title text NOT NULL,
	PRIMARY KEY (role_id, pathway_id, level)
);

-- Optional curated selection list (per role+pathway+level) of which SFIA skills are relevant
DROP TABLE IF EXISTS role_pathway_selected_skills;
CREATE TABLE IF NOT EXISTS role_level_selected_skills (
	role_id text NOT NULL,
	pathway_id text NOT NULL,
	level int NOT NULL CHECK (level >= 1 AND level <= 7),
	skill_id text NOT NULL REFERENCES sfia_skill(code),
	required_level int NOT NULL CHECK (required_level >= 1 AND required_level <= 7),
	PRIMARY KEY (role_id, pathway_id, level, skill_id),
	FOREIGN KEY (role_id, pathway_id, level) REFERENCES role_levels(role_id, pathway_id, level) ON DELETE CASCADE
);

-- Grant read access to all tables in the schema (covers both current and future tables)
GRANT SELECT ON ALL TABLES IN SCHEMA careers TO careers;
ALTER DEFAULT PRIVILEGES IN SCHEMA careers GRANT SELECT ON TABLES TO careers;

COMMIT;

\echo ''
\echo '== careers: loading raw documents =='
\echo '  stage: sfia_skill/raw_roles'
\echo '  expects: repo mounted at /workspace inside the postgres container'
\echo '  checking: workspace files'
\! ls -la /workspace || true

\echo ''
\echo '== careers: loading SFIA CSV =='
\echo '  stage: sfia_skill'
-- sfia_skill is referenced by role tables; use CASCADE so init works from a clean slate
TRUNCATE careers.sfia_skill CASCADE;
\echo '  loading: /workspace/sfia-8_en_220221.xlsx - Skills.csv -> careers.sfia_skill'
\copy careers.sfia_skill (id, level_1, level_2, level_3, level_4, level_5, level_6, level_7, code, skill, category, subcategory, overall_description, guidance_notes, level_1_description, level_2_description, level_3_description, level_4_description, level_5_description, level_6_description, level_7_description) FROM '/workspace/sfia-8_en_220221.xlsx - Skills.csv' WITH (FORMAT csv, HEADER true);
\echo '  rows: careers.sfia_skill'
SELECT count(*) AS sfia_skill_rows FROM careers.sfia_skill;

\echo ''
\echo '== careers: loading raw roles document =='
\echo '  stage: raw_roles'

TRUNCATE careers.raw_roles;

-- psql \copy reads "client-side" (inside the container). We strip newlines so the JSON becomes 1 row.
\echo '  loading: /workspace/roles.json -> careers.raw_roles'
\copy careers.raw_roles(doc) FROM PROGRAM 'sh -c "tr -d ''\\n\\r'' < /workspace/roles.json; echo"' WITH (FORMAT text, DELIMITER E'\x1f');
\echo '  rows: careers.raw_roles'
SELECT count(*) AS raw_roles_rows FROM careers.raw_roles;

\echo ''
\echo '== careers: (re)building normalized tables from raw docs =='
\echo '  stage: normalized reference tables'

BEGIN;
SET search_path = careers, public;

-- Truncate all normalized tables in a single statement (required with FK constraints)
TRUNCATE
	careers.role_level_selected_skills,
	careers.role_levels,
	careers.roles,
	careers.pathways
CASCADE;

\echo '  inserting: pathways'
WITH roles_doc AS (SELECT doc FROM careers.raw_roles ORDER BY loaded_at DESC LIMIT 1)
INSERT INTO careers.pathways (id, description)
SELECT p->>'id', p->>'description'
FROM roles_doc, jsonb_array_elements(roles_doc.doc->'pathways') AS p;
\echo '  rows: careers.pathways'
SELECT count(*) AS pathways_rows FROM careers.pathways;

\echo '  inserting: roles'
WITH roles_doc AS (SELECT doc FROM careers.raw_roles ORDER BY loaded_at DESC LIMIT 1)
INSERT INTO careers.roles (id, name)
SELECT r->>'id', r->>'name'
FROM roles_doc, jsonb_array_elements(roles_doc.doc->'roles') AS r;
\echo '  rows: careers.roles'
SELECT count(*) AS roles_rows FROM careers.roles;

-- role_levels
\echo '  inserting: role_levels'
WITH roles_doc AS (SELECT doc FROM careers.raw_roles ORDER BY loaded_at DESC LIMIT 1),
roles AS (SELECT jsonb_array_elements(roles_doc.doc->'roles') AS r FROM roles_doc),
pathways AS (SELECT jsonb_array_elements(roles_doc.doc->'pathways') AS p FROM roles_doc),
levels AS (
	SELECT
		(r->>'id') AS role_id,
		(p->>'id') AS pathway_id,
		(l.key)::int AS level,
		(l.value->>'title') AS title,
		l.value AS level_obj
	FROM roles
	JOIN pathways ON true
	JOIN LATERAL jsonb_each(COALESCE(r->(p->>'id'), '{}'::jsonb)) AS l(key, value) ON true
	WHERE l.key ~ '^[0-9]+$'
)
INSERT INTO careers.role_levels (role_id, pathway_id, level, title)
SELECT role_id, pathway_id, level, title
FROM levels;
\echo '  rows: careers.role_levels'
SELECT count(*) AS role_levels_rows FROM careers.role_levels;

-- role_pathway_selected_skills (optional in roles.json)
\echo '  inserting: role_level_selected_skills (optional)'
WITH roles_doc AS (SELECT doc FROM careers.raw_roles ORDER BY loaded_at DESC LIMIT 1),
roles AS (SELECT jsonb_array_elements(roles_doc.doc->'roles') AS r FROM roles_doc),
pathways AS (SELECT jsonb_array_elements(roles_doc.doc->'pathways') AS p FROM roles_doc),
sel AS (
	SELECT
		(r->>'id') AS role_id,
		(p->>'id') AS pathway_id,
		(l.key)::int AS level,
		(item->>'skill_id') AS skill_id,
		(item->>'required_level')::int AS required_level
	FROM roles
	JOIN pathways ON true
	JOIN LATERAL jsonb_each(COALESCE(r->(p->>'id'), '{}'::jsonb)) AS l(key, value) ON true
	JOIN LATERAL jsonb_array_elements(COALESCE(l.value->'selected_skills', '[]'::jsonb)) AS item ON true
	WHERE l.key ~ '^[0-9]+$'
)
INSERT INTO careers.role_level_selected_skills (role_id, pathway_id, level, skill_id, required_level)
SELECT role_id, pathway_id, level, skill_id, required_level
FROM sel
WHERE skill_id <> '' AND required_level BETWEEN 1 AND 7;
\echo '  rows: careers.role_level_selected_skills'
SELECT count(*) AS role_level_selected_skills_rows FROM careers.role_level_selected_skills;

COMMIT;

\echo ''
\echo '== careers: done =='
