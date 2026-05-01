const crypto = require('node:crypto');
const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');

function createApp({ dataStore }) {
	const createSkillsRouter = require('../routes/skills');
	const createRolesRouter = require('../routes/roles');
	const createSfiaRouter = require('../routes/sfia');

	const app = express();

	app.set('trust proxy', 1);
	app.set('view engine', 'ejs');
	app.use(helmet());
	app.use(cookieParser());
	app.use(express.urlencoded({ extended: false }));

	// Issue a persistent anonymous voter identity on first visit
	app.use((req, res, next) => {
		if (!req.cookies.voter_token) {
			const token = crypto.randomUUID();
			res.cookie('voter_token', token, {
				maxAge: 365 * 24 * 60 * 60 * 1000,
				httpOnly: true,
				sameSite: 'lax',
			});
			req.cookies.voter_token = token;
		}
		next();
	});

	app.get('/health', (req, res) => {
		res.json({ status: 'ok', version: require('../package.json').version });
	});

	app.get('/', (req, res) => {
		res.render('home');
	});

	app.use('/skills', createSkillsRouter(dataStore));
	app.use('/roles', createRolesRouter(dataStore));
	app.use('/sfia', createSfiaRouter(dataStore));

	return app;
}

module.exports = createApp;

