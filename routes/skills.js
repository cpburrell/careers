const express = require('express');

function createSkillsRouter(dataStore) {
	const router = express.Router();

	router.get('/', (req, res) => {
		res.render('skills', { skills: dataStore.getSkills(), roles: dataStore.getRoles() });
	});

	router.get('/:skillId/', (req, res) => {
		const { skillId } = req.params;

		const skills = dataStore.getSkills();
		const skill = skills.skills && skills.skills.find((s) => s.id == skillId);
		if (!skill) {
			return res.status(404).send('Skill not found');
		}

		res.render('skillDetail', { skills, skillId });
	});

	router.get('/:skillId/level/:levelId', (req, res) => {
		const { skillId, levelId } = req.params;

		const skills = dataStore.getSkills();
		const skill = skills.skills && skills.skills.find((s) => s.id == skillId);
		if (!skill) {
			return res.status(404).send('Skill not found');
		}

		const level = skill.levels && skill.levels.find((l) => l.level == levelId);
		if (!level) {
			return res.status(404).send('Level not found');
		}

		res.render('skillLevelDetail', { skills, skillId, levelId });
	});

	return router;
}

module.exports = createSkillsRouter;

