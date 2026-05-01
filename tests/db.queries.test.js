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
		process.env.MARIADB_HOST = 'mariadb.cburrell.com';
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

describeIfDb('MariaDB presence votes integration (requires MARIADB_HOST)', () => {
	jest.setTimeout(15_000);

	const ctx = {
		roleId: 'test-role',
		pathwayId: 'ic',
		level: 1,
		skillId: 'TEST-PRESENCE',
		voterToken: 'jest-presence-' + Date.now(),
	};

	// Clean up any leftover presence votes from previous runs before starting
	beforeAll(async () => {
		await queries.deletePresenceVote({ roleId: ctx.roleId, pathwayId: ctx.pathwayId, level: ctx.level, skillId: ctx.skillId, voterToken: ctx.voterToken });
	});

	test('castPresenceVote() inserts a remove vote', async () => {
		await expect(
			queries.castPresenceVote({ ...ctx, voteType: 'remove', suggestedLevel: null })
		).resolves.toBeUndefined();
	});

	test('getPresenceVotesForRoleLevel() includes the remove vote', async () => {
		const rows = await queries.getPresenceVotesForRoleLevel({ roleId: ctx.roleId, pathwayId: ctx.pathwayId, level: ctx.level });
		expect(Array.isArray(rows)).toBe(true);
		const mine = rows.find(r => r.skill_id === ctx.skillId && r.vote_type === 'remove');
		expect(mine).toBeDefined();
		expect(typeof mine.votes).toBe('number');
		expect(mine.votes).toBeGreaterThan(0);
	});

	test('getMyPresenceVotesForRoleLevel() returns remove vote keyed by skill_id', async () => {
		const result = await queries.getMyPresenceVotesForRoleLevel({ ...ctx });
		expect(result[ctx.skillId]).toBeDefined();
		expect(result[ctx.skillId].voteType).toBe('remove');
	});

	test('deletePresenceVote() removes the vote', async () => {
		await queries.deletePresenceVote({ roleId: ctx.roleId, pathwayId: ctx.pathwayId, level: ctx.level, skillId: ctx.skillId, voterToken: ctx.voterToken });
		const result = await queries.getMyPresenceVotesForRoleLevel({ ...ctx });
		expect(result[ctx.skillId]).toBeUndefined();
	});

	test('castPresenceVote() inserts an add vote with suggested level', async () => {
		await expect(
			queries.castPresenceVote({ ...ctx, voteType: 'add', suggestedLevel: 3 })
		).resolves.toBeUndefined();
	});

	test('getPresenceVotesForRoleLevel() includes the add vote with suggested_level', async () => {
		const rows = await queries.getPresenceVotesForRoleLevel({ roleId: ctx.roleId, pathwayId: ctx.pathwayId, level: ctx.level });
		const mine = rows.find(r => r.skill_id === ctx.skillId && r.vote_type === 'add');
		expect(mine).toBeDefined();
		expect(mine.suggested_level).toBe(3);
		expect(typeof mine.votes).toBe('number');
	});

	test('castPresenceVote() upserts an add vote (changes suggested level)', async () => {
		await queries.castPresenceVote({ ...ctx, voteType: 'add', suggestedLevel: 5 });
		const result = await queries.getMyPresenceVotesForRoleLevel({ ...ctx });
		expect(result[ctx.skillId].voteType).toBe('add');
		expect(result[ctx.skillId].suggestedLevel).toBe(5);
	});
});
