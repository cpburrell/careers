#!/usr/bin/env node
// Applies db/schema_mariadb.sql to the MariaDB server.
// Reads connection config from MARIADB_* env vars (same as db/queries.js).
// Safe to re-run — all statements use IF NOT EXISTS.

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function main() {
	const sql = fs.readFileSync(path.join(__dirname, '../db/schema_mariadb.sql'), 'utf8');

	// Split into individual statements, skipping blanks and comments
	const statements = sql
		.split(';')
		.map((s) => s.trim())
		.filter((s) => s.length > 0 && !s.startsWith('--'));

	const conn = await mysql.createConnection({
		host: process.env.MARIADB_HOST || process.env.DB_HOST || 'localhost',
		port: Number(process.env.MARIADB_PORT || process.env.DB_PORT || 3306),
		user: process.env.MARIADB_USER || process.env.DB_USER || 'careers',
		password: process.env.MARIADB_PASSWORD || process.env.DB_PASSWORD || '',
		ssl: (process.env.MARIADB_SSL || process.env.DB_SSL) === 'true'
			? { rejectUnauthorized: false }
			: undefined,
		multipleStatements: false,
	});

	try {
		for (const stmt of statements) {
			process.stdout.write(`  ${stmt.slice(0, 60).replace(/\n/g, ' ')}… `);
			await conn.query(stmt);
			console.log('OK');
		}
		console.log('\nSchema applied successfully.');
	} finally {
		await conn.end();
	}
}

main().catch((err) => {
	console.error('Error:', err.message);
	process.exit(1);
});
