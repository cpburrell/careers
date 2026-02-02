const fs = require('node:fs/promises');

let roles = {};
let skills = {};
let sfiaCSV = [];

function getDataSource() {
	return (process.env.CAREERS_DATA_SOURCE || 'file').toLowerCase();
}

let indexes = {
	categoriesById: Object.create(null),
	levelByNumber: Object.create(null),
	skillsById: Object.create(null),
	skillsByCategoryId: Object.create(null),
	pathwaysById: Object.create(null),
	rolesById: Object.create(null),
	sfiaByCode: Object.create(null),
};

let pgPool = null;

function getPgConfig() {
	if (process.env.DATABASE_URL) return { connectionString: process.env.DATABASE_URL };
	return {
		host: process.env.PGHOST || 'localhost',
		port: Number(process.env.PGPORT || 5432),
		user: process.env.PGUSER || process.env.CAREERS_DB_USER || process.env.POSTGRES_USER || 'careers',
		password: process.env.PGPASSWORD || process.env.CAREERS_DB_PASSWORD || process.env.POSTGRES_PASSWORD || 'careers',
		database: process.env.PGDATABASE || process.env.POSTGRES_DB || 'careers',
		ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined,
	};
}

function getPgPool() {
	if (pgPool) return pgPool;
	// lazy-load so file mode doesn't require pg installed
	const { Pool } = require('pg');
	pgPool = new Pool(getPgConfig());
	return pgPool;
}

async function withPgClient(fn) {
	const pool = getPgPool();
	const client = await pool.connect();
	try {
		return await fn(client);
	} finally {
		client.release();
	}
}

function rebuildSkillsIndexes() {
	indexes.categoriesById = Object.create(null);
	indexes.levelByNumber = Object.create(null);
	indexes.skillsById = Object.create(null);
	indexes.skillsByCategoryId = Object.create(null);

	if (!skills || typeof skills !== 'object') return;

	(skills.categories || []).forEach((c) => {
		if (c && c.id) indexes.categoriesById[c.id] = c;
	});

	(skills.levels || []).forEach((l) => {
		if (l && l.level != null) indexes.levelByNumber[Number(l.level)] = l;
	});

	(skills.skills || []).forEach((s) => {
		if (!s || !s.id) return;

		// normalize levels to numbers for consistent comparisons
		if (Array.isArray(s.levels)) {
			s.levels.forEach((lvl) => {
				if (lvl && lvl.level != null) lvl.level = Number(lvl.level);
			});
		}

		indexes.skillsById[s.id] = s;
		if (!indexes.skillsByCategoryId[s.category_id]) {
			indexes.skillsByCategoryId[s.category_id] = [];
		}
		indexes.skillsByCategoryId[s.category_id].push(s);
	});
}

function rebuildRolesIndexes() {
	indexes.pathwaysById = Object.create(null);
	indexes.rolesById = Object.create(null);

	if (!roles || typeof roles !== 'object') return;

	(roles.pathways || []).forEach((p) => {
		if (p && p.id) indexes.pathwaysById[p.id] = p;
	});

	(roles.roles || []).forEach((r) => {
		if (r && r.id) indexes.rolesById[r.id] = r;

		// normalize competency values to numbers (in memory only)
		(roles.pathways || []).forEach((p) => {
			const pathwayId = p && p.id;
			const pathwayObj = pathwayId ? r && r[pathwayId] : null;
			if (!pathwayObj || typeof pathwayObj !== 'object') return;

			for (let level = 1; level <= 7; level++) {
				const levelObj = pathwayObj[level] || pathwayObj[String(level)];
				if (!levelObj || typeof levelObj !== 'object') continue;

				Object.keys(levelObj).forEach((key) => {
					if (key === 'title') return;
					if (levelObj[key] == null) return;
					levelObj[key] = Number(levelObj[key]);
				});
			}
		});
	});
}

function rebuildSfiaIndexes() {
	indexes.sfiaByCode = Object.create(null);
	(sfiaCSV || []).forEach((row) => {
		if (row && row.Code) indexes.sfiaByCode[row.Code] = row;
	});
}

function validateData({ strict = true } = {}) {
	const errors = [];
	const warnings = [];

	// SFIA skills consistency
	for (const skill of skills.skills || []) {
		if (!indexes.categoriesById[skill.category_id]) {
			warnings.push(`Skill ${skill.id} references missing category ${skill.category_id}`);
		}

		for (const lvl of skill.levels || []) {
			const n = Number(lvl.level);
			if (!Number.isInteger(n) || n < 1 || n > 7) {
				errors.push(`Skill ${skill.id} has invalid level ${lvl.level}`);
			}
		}
	}

	// roles.json referential integrity (role competency keys must exist as skills)
	for (const role of roles.roles || []) {
		for (const pathway of roles.pathways || []) {
			const pathwayId = pathway.id;
			const pathwayObj = role[pathwayId];
			if (!pathwayObj || typeof pathwayObj !== 'object') {
				errors.push(`Role ${role.id} missing pathway ${pathwayId}`);
				continue;
			}

			// optional: explicit selection list per role+pathway
			const selected = pathwayObj.selected_skills;
			if (selected != null) {
				if (!Array.isArray(selected)) {
					errors.push(`Role ${role.id} pathway ${pathwayId} selected_skills must be an array`);
				} else {
					const seen = new Set();
					for (const skillId of selected) {
						if (typeof skillId !== 'string' || !skillId) {
							errors.push(`Role ${role.id} pathway ${pathwayId} selected_skills contains invalid skill id`);
							continue;
						}
						if (seen.has(skillId)) {
							warnings.push(`Role ${role.id} pathway ${pathwayId} selected_skills contains duplicate ${skillId}`);
						}
						seen.add(skillId);
						if (!indexes.skillsById[skillId]) {
							errors.push(`Role ${role.id} pathway ${pathwayId} selected_skills references unknown skill ${skillId}`);
						}
					}
				}
			}

			for (let level = 1; level <= 7; level++) {
				const levelObj = pathwayObj[level] || pathwayObj[String(level)];
				if (!levelObj || typeof levelObj !== 'object') {
					errors.push(`Role ${role.id} pathway ${pathwayId} missing level ${level}`);
					continue;
				}
				if (!levelObj.title) {
					warnings.push(`Role ${role.id} pathway ${pathwayId} level ${level} missing title`);
				}

				for (const key of Object.keys(levelObj)) {
					if (key === 'title') continue;

					if (!indexes.skillsById[key]) {
						errors.push(`Role ${role.id} pathway ${pathwayId} level ${level} references unknown skill ${key}`);
						continue;
					}

					const v = Number(levelObj[key]);
					if (!Number.isInteger(v) || v < 1 || v > 7) {
						errors.push(`Role ${role.id} pathway ${pathwayId} level ${level} has invalid competency for ${key}: ${levelObj[key]}`);
					}
				}
			}
		}
	}

	if (warnings.length) {
		console.warn('[dataStore] Data warnings:\n' + warnings.map((w) => `- ${w}`).join('\n'));
	}

	if (errors.length) {
		const message = '[dataStore] Data errors:\n' + errors.map((e) => `- ${e}`).join('\n');
		if (strict) throw new Error(message);
		console.error(message);
	}
}

async function readSkills(print = false) {
	const sfia = sfiaCSV && sfiaCSV.length ? sfiaCSV : await readSFIACSV();
	const rawLevels = await fs.readFile('./sfia_levels.json', 'utf8');
	const sfiaLevels = JSON.parse(rawLevels);

	const categoryNameToId = new Map();
	const categories = [];
	const sfiaSkills = [];

	function toCategoryId(name) {
		const key = String(name || '').trim();
		if (!key) return 'UNKNOWN';
		if (categoryNameToId.has(key)) return categoryNameToId.get(key);
		const id = key
			.toUpperCase()
			.replace(/[^A-Z0-9]+/g, '_')
			.replace(/^_+|_+$/g, '');
		categoryNameToId.set(key, id);
		categories.push({ id, name: key });
		return id;
	}

	for (const row of sfia || []) {
		if (!row || !row.Code) continue;

		const categoryId = toCategoryId(row.Category);
		const levels = [];
		for (let level = 1; level <= 7; level++) {
			const short = (row[`Level ${level}`] || '').trim();
			const desc = (row[`Level ${level} description`] || '').trim();
			const brief = short && !/^\d+$/.test(short) ? short : '';
			levels.push({
				level,
				brief_description: brief,
				full_description: desc,
			});
		}

		sfiaSkills.push({
			id: row.Code,
			name: row.Skill || row.Code,
			category_id: categoryId,
			subcategory: row.Subcategory || '',
			levels,
		});
	}

	categories.sort((a, b) => a.name.localeCompare(b.name));
	sfiaSkills.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

	skills = {
		categories,
		levels: sfiaLevels.levels || [],
		skills: sfiaSkills,
	};
	rebuildSkillsIndexes();

	if (print) {
		skills.skills.forEach((skill) => {
			const category = skills.categories.find((c) => c.id === skill.category_id);
			console.log(`\t${skill.id}: ${skill.name} (${category ? category.name : skill.category_id})`);

			skill.levels.forEach((level) => {
				console.log(`\t\t${level.level}: ${level.brief_description || level.level_desc || ''}`);
			});
		});
	}

	return skills;
}

async function readRoles(print = false) {
	if (getDataSource() === 'db') {
		roles = await readRolesFromDb();
	} else {
		const raw = await fs.readFile('./roles.json', 'utf8');
		roles = JSON.parse(raw);
	}
	rebuildRolesIndexes();

	if (print) {
		roles.roles.forEach((role) => {
			roles.pathways.forEach((pathway) => {
				console.log(`${role.name}: ${pathway.description}`);
				for (let level = 1; level <= 7; level++) {
					const row = role[pathway.id] && role[pathway.id][level];
					console.log(`\t${level}: ${row ? row.title : ''}`);
				}
			});
		});
	}

	return roles;
}

async function readSFIACSV(print = false) {
	if (getDataSource() === 'db') {
		sfiaCSV = await readSfiaFromDb();
	} else {
		// lazy-load so CLI usage (readSkills/readRoles) doesn't require csvtojson installed
		const csv = require('csvtojson');
		sfiaCSV = await csv().fromFile('./sfia-8_en_220221.xlsx - Skills.csv');
	}
	rebuildSfiaIndexes();

	if (print) {
		console.log(sfiaCSV);
	}

	return sfiaCSV;
}

function getSkills() {
	return skills;
}

function getRoles() {
	return roles;
}

function getSfiaCSV() {
	return sfiaCSV;
}

function getIndexes() {
	return indexes;
}

function doBoth() {
	return Promise.all([readSkills(), readRoles()]);
}

async function loadCore({ validate = true, strictValidation = true } = {}) {
	await Promise.all([readSFIACSV(), readRoles()]);
	await readSkills();
	if (validate) validateData({ strict: strictValidation });
}

async function loadAll({ validate = true, strictValidation = true } = {}) {
	await Promise.all([readSFIACSV(), readRoles()]);
	await readSkills();
	if (validate) validateData({ strict: strictValidation });
}

async function readRolesFromDb() {
	return withPgClient(async (client) => {
		const pathwaysRes = await client.query('SELECT id, description FROM careers.pathways ORDER BY id');
		const rolesRes = await client.query('SELECT id, name FROM careers.roles ORDER BY id');
		const roleLevelsRes = await client.query(
			'SELECT role_id, pathway_id, level, title FROM careers.role_levels ORDER BY role_id, pathway_id, level'
		);
		const competenciesRes = await client.query(
			'SELECT role_id, pathway_id, level, skill_id, competency_level FROM careers.role_level_competencies ORDER BY role_id, pathway_id, level, skill_id'
		);
		const selectedRes = await client.query(
			'SELECT role_id, pathway_id, skill_id FROM careers.role_pathway_selected_skills ORDER BY role_id, pathway_id, skill_id'
		);

		const roleById = Object.create(null);
		for (const r of rolesRes.rows) {
			roleById[r.id] = { id: r.id, name: r.name };
		}

		// initialize pathway containers
		for (const role of Object.values(roleById)) {
			for (const p of pathwaysRes.rows) {
				role[p.id] = Object.create(null);
			}
		}

		// selections
		for (const row of selectedRes.rows) {
			const role = roleById[row.role_id];
			if (!role) continue;
			if (!role[row.pathway_id]) role[row.pathway_id] = Object.create(null);
			if (!Array.isArray(role[row.pathway_id].selected_skills)) role[row.pathway_id].selected_skills = [];
			role[row.pathway_id].selected_skills.push(row.skill_id);
		}

		// role level titles + ensure level objects exist
		for (const rl of roleLevelsRes.rows) {
			const role = roleById[rl.role_id];
			if (!role) continue;
			if (!role[rl.pathway_id]) role[rl.pathway_id] = Object.create(null);
			role[rl.pathway_id][String(rl.level)] = { title: rl.title };
		}

		// competencies
		for (const c of competenciesRes.rows) {
			const role = roleById[c.role_id];
			if (!role) continue;
			if (!role[c.pathway_id]) role[c.pathway_id] = Object.create(null);
			const levelKey = String(c.level);
			if (!role[c.pathway_id][levelKey]) role[c.pathway_id][levelKey] = { title: '' };
			role[c.pathway_id][levelKey][c.skill_id] = Number(c.competency_level);
		}

		return {
			pathways: pathwaysRes.rows,
			roles: Object.values(roleById),
		};
	});
}

async function readSfiaFromDb() {
	return withPgClient(async (client) => {
		const res = await client.query('SELECT * FROM careers.sfia_skill ORDER BY id NULLS LAST, code');
		return res.rows.map((r) => ({
			ID: r.id,
			'Level 1': r.level_1,
			'Level 2': r.level_2,
			'Level 3': r.level_3,
			'Level 4': r.level_4,
			'Level 5': r.level_5,
			'Level 6': r.level_6,
			'Level 7': r.level_7,
			Code: r.code,
			Skill: r.skill,
			Category: r.category,
			Subcategory: r.subcategory,
			'Overall description': r.overall_description,
			'Guidance notes': r.guidance_notes,
			'Level 1 description': r.level_1_description,
			'Level 2 description': r.level_2_description,
			'Level 3 description': r.level_3_description,
			'Level 4 description': r.level_4_description,
			'Level 5 description': r.level_5_description,
			'Level 6 description': r.level_6_description,
			'Level 7 description': r.level_7_description,
		}));
	});
}

module.exports = {
	readSkills,
	readRoles,
	readSFIACSV,
	getSkills,
	getRoles,
	getSfiaCSV,
	getIndexes,
	validateData,
	doBoth,
	loadCore,
	loadAll,
	// exported for debugging / scripts
	getDataSource,
};
