const request = require('supertest');

const createApp = require('../lib/createApp');
const dataStore = require('../lib/dataStore');

describe('app routes', () => {
	let app;

	beforeAll(async () => {
		// Ensure local .env (which may point at Postgres) doesn't affect test runs.
		process.env.CAREERS_DATA_SOURCE = 'file';

		// CSV parsing + index building can take a moment.
		jest.setTimeout(30_000);

		await dataStore.loadAll({ validate: true, strictValidation: true });
		app = createApp({ dataStore });
	});

	test('GET /', async () => {
		const res = await request(app).get('/');
		expect(res.status).toBe(200);
		expect(res.text).toContain('Hello World!');
	});

	test('GET /roles', async () => {
		const res = await request(app).get('/roles');
		expect(res.status).toBe(200);
		expect(res.text).toContain('<h1>Roles</h1>');
	});

	test('GET /skills', async () => {
		const res = await request(app).get('/skills');
		expect(res.status).toBe(200);
		expect(res.text).toContain('<h1>Skills</h1>');
	});

	test('GET /sfia', async () => {
		const res = await request(app).get('/sfia');
		expect(res.status).toBe(200);
		expect(res.text).toContain('<h1>SFIA Skills (CSV)</h1>');
	});

	test('SFIA pages use AI overlay when source descriptions are missing', async () => {
		const rows = dataStore.getSfiaCSV();
		const rowWithAi = (rows || []).find((r) => r && r.Code && r.__ai && Object.keys(r.__ai).length > 0);
		expect(rowWithAi).toBeTruthy();

		const aiLevels = Object.keys(rowWithAi.__ai);
		const levelId = aiLevels.find((l) => rowWithAi.__ai[l]) || aiLevels[0];
		expect(levelId).toBeTruthy();

		const desc = rowWithAi[`Level ${levelId} description`];
		expect(typeof desc).toBe('string');
		expect(desc).toMatch(/^AI created:/);

		const res = await request(app).get(`/sfia/${rowWithAi.Code}/level/${levelId}`);
		expect(res.status).toBe(200);
		expect(res.text).toContain('badge--ai');
	});

	test('Skill level page shows AI descriptions with red badge and no level label inside AI text', async () => {
		const skills = dataStore.getSkills();
		const skillWithAi = (skills.skills || []).find((s) => (s.levels || []).some((l) => l && l.is_ai));
		expect(skillWithAi).toBeTruthy();

		const aiLevel = (skillWithAi.levels || []).find((l) => l && l.is_ai);
		expect(aiLevel).toBeTruthy();

		expect(aiLevel.full_description).toMatch(/^AI created:/);
		expect(aiLevel.full_description).not.toMatch(/^AI created:.*Level\\s+\\d+/);

		const res = await request(app).get(`/skills/${skillWithAi.id}/level/${aiLevel.level}`);
		expect(res.status).toBe(200);
		expect(res.text).toContain('badge--ai');
		expect(res.text).not.toMatch(/AI created:.*Level\\s+\\d+/);
	});

	test('GET /roles/:roleId/pathway/:pathwayId/level/:levelId renders', async () => {
		const roles = dataStore.getRoles();
		const role = (roles.roles || [])[0];
		const pathway = (roles.pathways || [])[0];

		expect(role).toBeTruthy();
		expect(pathway).toBeTruthy();

		const levelId = 1;
		const expectedTitle = role[pathway.id][String(levelId)].title;

		const res = await request(app).get(`/roles/${role.id}/pathway/${pathway.id}/level/${levelId}`);
		expect(res.status).toBe(200);
		expect(res.text).toContain(`<h1>${expectedTitle}</h1>`);
	});

	test('GET /roles/:roleId/pathway/:pathwayId/level/:levelId returns 404 for unknown role', async () => {
		const res = await request(app).get('/roles/does-not-exist/pathway/ic/level/1');
		expect(res.status).toBe(404);
		expect(res.text).toContain('Role not found');
	});

	test('GET /sfia/:code/level/:levelId returns 400 for invalid level', async () => {
		const res = await request(app).get('/sfia/ARCH/level/0');
		expect(res.status).toBe(400);
		expect(res.text).toContain('Invalid level');
	});
});
