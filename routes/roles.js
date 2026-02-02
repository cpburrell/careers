const express = require('express');

function createRolesRouter(dataStore) {
	const router = express.Router();

	router.get('/', (req, res) => {
		res.render('roles', { roles: dataStore.getRoles(), skills: dataStore.getSkills() });
	});

	router.get('/:roleId/pathway/:pathwayId/level/:levelId', (req, res) => {
		const { roleId, pathwayId, levelId } = req.params;

		const roles = dataStore.getRoles();
		const role = roles.roles && roles.roles.find((r) => r.id === roleId);
		if (!role) {
			return res.status(404).send('Role not found');
		}

		const pathway = roles.pathways && roles.pathways.find((p) => p.id === pathwayId);
		if (!pathway) {
			return res.status(404).send('Pathway not found');
		}

		const level = role[pathwayId] && role[pathwayId][levelId];
		if (!level) {
			return res.status(404).send('Level not found');
		}

		res.render('roleDetail', {
			skills: dataStore.getSkills(),
			role,
			pathway,
			levelId,
		});
	});

	return router;
}

module.exports = createRolesRouter;

