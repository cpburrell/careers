require('dotenv').config();

/**
 * Tests for db/queries.js (MariaDB votes).
 *
 * Unit tests always run.
 * Integration tests run only when MARIADB_HOST (or DB_HOST) is set; otherwise skipped.
 */

const queries = require('../db/queries');

afterAll(() => queries.closePool());

// ─── Unit: isDatabaseConfigured ──────────────────────────────────────────────

describe('isDatabaseConfigured()', () => {
	const VARS = ['MARIADB_HOST', 'DB_HOST'];
	let saved = {};

	beforeEach(() => {
		VARS.forEach((k) => {
			saved[k] = process.env[k];
			delete process.env[k];
		});
	});

	afterEach(() => {
		VARS.forEach((k) => {
			if (saved[k] === undefined) delete process.env[k];
			else process.env[k] = saved[k];
		});
	});

	test('returns false when no MariaDB env vars are set', () => {
		expect(queries.isDatabaseConfigured()).toBe(false);
	});

	test('returns true when MARIADB_HOST is set', () => {
		process.env.MARIADB_HOST = '192.168.2.21';
		expect(queries.isDatabaseConfigured()).toBe(true);
	});

	test('returns true when DB_HOST is set', () => {
		process.env.DB_HOST = 'localhost';
		expect(queries.isDatabaseConfigured()).toBe(true);
	});

	test('returns false when only PostgreSQL vars are set', () => {
		process.env.PGHOST = 'localhost';
		expect(queries.isDatabaseConfigured()).toBe(false);
		delete process.env.PGHOST;
	});
});

// ─── Integration: live MariaDB ────────────────────────────────────────────────

const MARIADB_CONFIGURED = !!(process.env.MARIADB_HOST || process.env.DB_HOST);
const describeIfDb = MARIADB_CONFIGURED ? describe : describe.skip;

describeIfDb('MariaDB integration (requires MARIADB_HOST)', () => {
	jest.setTimeout(15_000);

	// Synthetic context — no FK constraints on the votes table so any values work.
	const ctx = {
		roleId: 'test-role',
		pathwayId: 'ic',
		level: 1,
		skillId: 'TEST',
		voterToken: 'jest-token-' + Date.now(),
	};

	test('castVote() does not throw', async () => {
		await expect(
			queries.castVote({ ...ctx, suggestedLevel: 3 })
		).resolves.toBeUndefined();
	});

	test('getVotesForRoleLevel() returns array with numeric vote counts', async () => {
		const rows = await queries.getVotesForRoleLevel({
			roleId: ctx.roleId,
			pathwayId: ctx.pathwayId,
			level: ctx.level,
		});
		expect(Array.isArray(rows)).toBe(true);
		for (const r of rows) {
			expect(typeof r.skill_id).toBe('string');
			expect(typeof r.suggested_level).toBe('number');
			expect(typeof r.votes).toBe('number');
		}
	});

	test('getMyVotesForRoleLevel() returns object keyed by skill_id', async () => {
		const result = await queries.getMyVotesForRoleLevel({
			roleId: ctx.roleId,
			pathwayId: ctx.pathwayId,
			level: ctx.level,
			voterToken: ctx.voterToken,
		});
		expect(typeof result).toBe('object');
		expect(result[ctx.skillId]).toBe(3);
	});

	test('castVote() upserts an existing vote', async () => {
		await queries.castVote({ ...ctx, suggestedLevel: 5 });
		const result = await queries.getMyVotesForRoleLevel({
			roleId: ctx.roleId,
			pathwayId: ctx.pathwayId,
			level: ctx.level,
			voterToken: ctx.voterToken,
		});
		expect(result[ctx.skillId]).toBe(5);
	});

	test('getVotesForSkill() returns array with numeric vote counts', async () => {
		const rows = await queries.getVotesForSkill({
			roleId: ctx.roleId,
			pathwayId: ctx.pathwayId,
			level: ctx.level,
			skillId: ctx.skillId,
		});
		expect(Array.isArray(rows)).toBe(true);
		expect(rows.length).toBeGreaterThan(0);
		for (const r of rows) {
			expect(typeof r.suggested_level).toBe('number');
			expect(typeof r.votes).toBe('number');
		}
	});
});
