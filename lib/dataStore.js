const fs = require('node:fs/promises');

let roles = {};
let skills = {};
let sfiaCSV = [];
let sfiaAiDescriptions = null;

function getDataSource() {
	return (process.env.CAREERS_DATA_SOURCE || 'file').toLowerCase();
}

function stripAiLevelLabel(text) {
	if (typeof text !== 'string') return text;
	const trimmed = text.trim();
	const prefix = 'AI created:';
	if (!trimmed.toLowerCase().startsWith(prefix.toLowerCase())) return trimmed;

	const afterPrefix = trimmed.slice(prefix.length).trimStart();
	if (!afterPrefix) return prefix;

	// Remove leading "Level N (...)" if present
	let rest = afterPrefix.replace(/^Level\s+\d+\s*(?:\([^)]*\))?\s*[:\-–—]\s*/i, '');
	// Remove "Level N ..." at the start of a sentence
	rest = rest.replace(/^Level\s+\d+\s*(?:[•-]\s*[^.]+)?\.\s*/i, '');
	// Remove synthetic "— Level N ..." segment after a skill name
	rest = rest.replace(/—\s*Level\s+\d+\s*(?:[•-]\s*[^.]+)?\.\s*/i, '— ');
	rest = rest.trimStart();

	return `${prefix} ${rest}`.trim();
}

function isAiText(text) {
	return typeof text === 'string' && /^AI created:/i.test(text.trim());
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

	(roles.roles || []).forEach((role) => {
		if (role && role.id) indexes.rolesById[role.id] = role;

		// normalize selected_skills required_level values (in memory only)
		(roles.pathways || []).forEach((pathway) => {
			const pathwayId = pathway && pathway.id;
			const pathwayObj = pathwayId ? role && role[pathwayId] : null;
			if (!pathwayObj || typeof pathwayObj !== 'object') return;

			for (let level = 1; level <= 7; level++) {
				const levelObj = pathwayObj[level] || pathwayObj[String(level)];
				if (!levelObj || typeof levelObj !== 'object') continue;

				if (!Array.isArray(levelObj.selected_skills)) continue;
				levelObj.selected_skills.forEach((item) => {
					if (!item || typeof item !== 'object') return;
					if (item.required_level != null) item.required_level = Number(item.required_level);
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

			for (let level = 1; level <= 7; level++) {
				const levelObj = pathwayObj[level] || pathwayObj[String(level)];
				if (!levelObj || typeof levelObj !== 'object') {
					errors.push(`Role ${role.id} pathway ${pathwayId} missing level ${level}`);
					continue;
				}
				if (!levelObj.title) {
					warnings.push(`Role ${role.id} pathway ${pathwayId} level ${level} missing title`);
				}

				// optional: explicit selection list per role+pathway+level
				const selected = levelObj.selected_skills;
				if (selected != null) {
					if (!Array.isArray(selected)) {
						errors.push(`Role ${role.id} pathway ${pathwayId} level ${level} selected_skills must be an array`);
					} else {
						const seen = new Set();
						for (const item of selected) {
							if (!item || typeof item !== 'object') {
								errors.push(`Role ${role.id} pathway ${pathwayId} level ${level} selected_skills entries must be objects`);
								continue;
							}

							const skillId = item.skill_id;
							const requiredLevel = Number(item.required_level);

							if (typeof skillId !== 'string' || !skillId) {
								errors.push(`Role ${role.id} pathway ${pathwayId} level ${level} selected_skills contains invalid skill_id`);
								continue;
							}
							if (seen.has(skillId)) {
								warnings.push(`Role ${role.id} pathway ${pathwayId} level ${level} selected_skills contains duplicate ${skillId}`);
							}
							seen.add(skillId);
							if (!indexes.skillsById[skillId]) {
								errors.push(`Role ${role.id} pathway ${pathwayId} level ${level} selected_skills references unknown skill ${skillId}`);
							}

							if (!Number.isInteger(requiredLevel) || requiredLevel < 1 || requiredLevel > 7) {
								errors.push(
									`Role ${role.id} pathway ${pathwayId} level ${level} selected_skills has invalid required_level for ${skillId}: ${item.required_level}`
								);
							}
						}
					}
				}

				for (const key of Object.keys(levelObj)) {
					if (key === 'title' || key === 'selected_skills') continue;

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

async function loadSfiaAiDescriptions() {
	if (sfiaAiDescriptions) return sfiaAiDescriptions;
	try {
		const raw = await fs.readFile('./sfia_ai_descriptions.json', 'utf8');
		const parsed = JSON.parse(raw);
		sfiaAiDescriptions = parsed && parsed.descriptions ? parsed.descriptions : {};
		return sfiaAiDescriptions;
	} catch (err) {
		sfiaAiDescriptions = {};
		return sfiaAiDescriptions;
	}
}

async function readSkills(print = false) {
	const sfia = sfiaCSV && sfiaCSV.length ? sfiaCSV : await readSFIACSV();
	const rawLevels = await fs.readFile('./sfia_levels.json', 'utf8');
	const sfiaLevels = JSON.parse(rawLevels);
	const sfiaLevelByNumber = new Map((sfiaLevels.levels || []).map((l) => [Number(l.level), l]));
	const ai = await loadSfiaAiDescriptions();

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
		const descriptionsByLevel = new Map();
		for (let level = 1; level <= 7; level++) {
			const desc = (row[`Level ${level} description`] || '').trim();
			if (desc) descriptionsByLevel.set(level, desc);
		}

		function synthesizeDescription(level) {
			const skillName = (row.Skill || row.Code || '').trim();

			let lower = null;
			for (let l = level - 1; l >= 1; l--) {
				if (descriptionsByLevel.has(l)) {
					lower = l;
					break;
				}
			}
			let upper = null;
			for (let u = level + 1; u <= 7; u++) {
				if (descriptionsByLevel.has(u)) {
					upper = u;
					break;
				}
			}

			let context;
			if (lower && upper) context = `by extrapolating between levels ${lower} and ${upper}`;
			else if (lower) context = `by extrapolating from level ${lower}`;
			else if (upper) context = `by extrapolating towards level ${upper}`;
			else context = `using only generic SFIA level intent`;

			// Keep this meaningful but clearly marked; prefer using a persisted overlay file if present.
			return `AI created: ${skillName}. ${context}.`;
		}

		for (let level = 1; level <= 7; level++) {
			const short = (row[`Level ${level}`] || '').trim();
			let desc = (row[`Level ${level} description`] || '').trim();
			let isAi = !!(row.__ai && row.__ai[String(level)]);
			const brief = short && !/^\d+$/.test(short) ? short : '';
			if (!desc) {
				const aiDesc = ai && ai[row.Code] && ai[row.Code][String(level)];
				const chosen = typeof aiDesc === 'string' && aiDesc.trim() ? aiDesc.trim() : synthesizeDescription(level);
				desc = chosen;
				isAi = true;
			}
			if (!isAi && isAiText(desc)) isAi = true;
			if (isAi) desc = stripAiLevelLabel(desc);
			levels.push({
				level,
				brief_description: brief,
				full_description: desc,
				is_ai: isAi,
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

	// Apply AI overlay for missing level descriptions so /sfia pages can render them.
	const ai = await loadSfiaAiDescriptions();
	for (const row of sfiaCSV || []) {
		if (!row || !row.Code) continue;

		if (!row.__ai) row.__ai = Object.create(null);

		for (let level = 1; level <= 7; level++) {
			const field = `Level ${level} description`;
			const existing = typeof row[field] === 'string' ? row[field].trim() : '';
			if (existing) {
				if (isAiText(existing)) {
					row[field] = stripAiLevelLabel(existing);
					row.__ai[String(level)] = true;
				}
				continue;
			}

			const aiDesc = ai && ai[row.Code] && ai[row.Code][String(level)];
			if (typeof aiDesc === 'string' && aiDesc.trim()) {
				row[field] = stripAiLevelLabel(aiDesc.trim());
				row.__ai[String(level)] = true;
			}
		}
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
		const selectedRes = await client.query(
			'SELECT role_id, pathway_id, level, skill_id, required_level FROM careers.role_level_selected_skills ORDER BY role_id, pathway_id, level, skill_id'
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

		// role level titles + ensure level objects exist
		for (const rl of roleLevelsRes.rows) {
			const role = roleById[rl.role_id];
			if (!role) continue;
			if (!role[rl.pathway_id]) role[rl.pathway_id] = Object.create(null);
			role[rl.pathway_id][String(rl.level)] = { title: rl.title };
		}

		// selections (per role+pathway+level)
		for (const row of selectedRes.rows) {
			const role = roleById[row.role_id];
			if (!role) continue;
			if (!role[row.pathway_id]) role[row.pathway_id] = Object.create(null);
			const levelKey = String(row.level);
			if (!role[row.pathway_id][levelKey]) role[row.pathway_id][levelKey] = { title: '' };
			if (!Array.isArray(role[row.pathway_id][levelKey].selected_skills)) role[row.pathway_id][levelKey].selected_skills = [];
			role[row.pathway_id][levelKey].selected_skills.push({
				skill_id: row.skill_id,
				required_level: Number(row.required_level),
			});
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
