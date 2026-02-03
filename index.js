#!/usr/bin/env node

/**
 * Module dependencies.
 */
const dataStore = require('./lib/dataStore');

function exitHandler(options, exitCode) {

	console.log('Stopping...');

	if (options.cleanup) {
		console.log('clean');
	}

	if (exitCode || exitCode === 0) {
		console.log(exitCode);
	}

	if (options.exit) {
		console.log('Exiting...');

		process.exit();
	}
}

///////////////////////////////////////////////////////////////////////////////////////////////////

if (require.main === module) {
	// config variables (optional for CLI usage)
	try {
		require('dotenv').config();
	} catch (err) {
		// ignore if dotenv isn't installed
	}

	const createSkillsRouter = require('./routes/skills');
	const createRolesRouter = require('./routes/roles');
	const createSfiaRouter = require('./routes/sfia');

	const express = require('express');
	const app = express();
	const port = process.env.PORT || 3000;

	app.set('view engine', 'ejs');

	app.get('/', (req, res) => {
		res.send('Hello World!');
	});

	app.use('/skills', createSkillsRouter(dataStore));
	app.use('/roles', createRolesRouter(dataStore));
	app.use('/sfia', createSfiaRouter(dataStore));

	//do something when app is closing
	process.on('exit', exitHandler.bind(null,{cleanup:true}));

	//catches ctrl+c event
	process.on('SIGINT', exitHandler.bind(null, {exit:true}));

	// catches "kill pid" (for example: nodemon restart)
	process.on('SIGUSR1', exitHandler.bind(null, {exit:true}));
	process.on('SIGUSR2', exitHandler.bind(null, {exit:true}));

	//catches uncaught exceptions
	process.on('uncaughtException', exitHandler.bind(null, {exit:true}));

	(async () => {
		try {
			await dataStore.loadAll();
			app.listen(port, () => {
				console.log(`Server is running on http://localhost:${port}`);
			});
		} catch (err) {
			console.error('Failed to load initial data:', err);
			process.exitCode = 1;
		}
	})();
}

module.exports = {
	readSkills: dataStore.readSkills,
	readRoles: dataStore.readRoles,
	doBoth: dataStore.doBoth,
};
