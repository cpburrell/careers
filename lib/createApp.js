const express = require('express');

function createApp({ dataStore }) {
	const createSkillsRouter = require('../routes/skills');
	const createRolesRouter = require('../routes/roles');
	const createSfiaRouter = require('../routes/sfia');

	const app = express();

	app.set('view engine', 'ejs');

	app.get('/', (req, res) => {
		res.send('Hello World!');
	});

	app.use('/skills', createSkillsRouter(dataStore));
	app.use('/roles', createRolesRouter(dataStore));
	app.use('/sfia', createSfiaRouter(dataStore));

	return app;
}

module.exports = createApp;

