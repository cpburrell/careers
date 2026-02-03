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

