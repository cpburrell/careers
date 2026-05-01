let pool = null;

function isDatabaseConfigured() {
	return !!(process.env.MARIADB_HOST || process.env.DB_HOST);
}

function getDbConfig() {
	return {
		host: process.env.MARIADB_HOST || process.env.DB_HOST || 'localhost',
		port: Number(process.env.MARIADB_PORT || process.env.DB_PORT || 3306),
		user: process.env.MARIADB_USER || process.env.DB_USER || 'careers',
		password: process.env.MARIADB_PASSWORD || process.env.DB_PASSWORD || '',
		database: process.env.MARIADB_DATABASE || process.env.DB_DATABASE || 'careers',
		ssl: (process.env.MARIADB_SSL || process.env.DB_SSL) === 'true'
			? { rejectUnauthorized: false }
			: undefined,
		waitForConnections: true,
		connectionLimit: 10,
		supportBigNumbers: true,
		bigNumberStrings: false,
	};
}

function getPool() {
	if (pool) return pool;
	const mysql = require('mysql2/promise');
	pool = mysql.createPool(getDbConfig());
	return pool;
}

async function withClient(fn) {
	const conn = await getPool().getConnection();
	try {
		return await fn(conn);
	} finally {
		conn.release();
	}
}

async function castVote({ roleId, pathwayId, level, skillId, suggestedLevel, voterToken }) {
	return withClient(async (conn) => {
		await conn.query(
			`INSERT INTO votes (role_id, pathway_id, level, skill_id, suggested_level, voter_token)
			 VALUES (?, ?, ?, ?, ?, ?)
			 ON DUPLICATE KEY UPDATE suggested_level = VALUES(suggested_level), updated_at = NOW()`,
			[roleId, pathwayId, level, skillId, suggestedLevel, voterToken]
		);
	});
}

async function getVotesForSkill({ roleId, pathwayId, level, skillId }) {
	return withClient(async (conn) => {
		const [rows] = await conn.query(
			`SELECT suggested_level, COUNT(*) AS votes
			 FROM votes
			 WHERE role_id = ? AND pathway_id = ? AND level = ? AND skill_id = ?
			 GROUP BY suggested_level
			 ORDER BY suggested_level`,
			[roleId, pathwayId, level, skillId]
		);
		return rows.map((r) => ({ ...r, votes: Number(r.votes) }));
	});
}

async function getVotesForRoleLevel({ roleId, pathwayId, level }) {
	return withClient(async (conn) => {
		const [rows] = await conn.query(
			`SELECT skill_id, suggested_level, COUNT(*) AS votes
			 FROM votes
			 WHERE role_id = ? AND pathway_id = ? AND level = ?
			 GROUP BY skill_id, suggested_level
			 ORDER BY skill_id, suggested_level`,
			[roleId, pathwayId, level]
		);
		return rows.map((r) => ({ ...r, votes: Number(r.votes) }));
	});
}

async function getMyVotesForRoleLevel({ roleId, pathwayId, level, voterToken }) {
	return withClient(async (conn) => {
		const [rows] = await conn.query(
			`SELECT skill_id, suggested_level
			 FROM votes
			 WHERE role_id = ? AND pathway_id = ? AND level = ? AND voter_token = ?`,
			[roleId, pathwayId, level, voterToken]
		);
		return Object.fromEntries(rows.map((r) => [r.skill_id, r.suggested_level]));
	});
}

module.exports = {
	isDatabaseConfigured,
	castVote,
	getVotesForSkill,
	getVotesForRoleLevel,
	getMyVotesForRoleLevel,
};
