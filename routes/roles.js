const express = require('express');
const { castVote, getVotesForRoleLevel, getMyVotesForRoleLevel, isDatabaseConfigured } = require('../db/queries');

function createRolesRouter(dataStore) {
	const router = express.Router();

	router.get('/', (req, res) => {
		res.render('roles', { roles: dataStore.getRoles(), skills: dataStore.getSkills() });
	});

	router.get('/:roleId/pathway/:pathwayId/level/:levelId', async (req, res) => {
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

		// Fetch vote data — gracefully degrade if DB is unavailable or unconfigured
		let votesBySkill = {};
		let myVotes = {};
		let votingAvailable = false;
		try {
			if (!isDatabaseConfigured()) throw new Error('No DB config');
			const voterToken = req.cookies.voter_token;
			const levelNum = Number(levelId);
			const [allVotes, mine] = await Promise.all([
				getVotesForRoleLevel({ roleId, pathwayId, level: levelNum }),
				getMyVotesForRoleLevel({ roleId, pathwayId, level: levelNum, voterToken }),
			]);
			for (const row of allVotes) {
				if (!votesBySkill[row.skill_id]) votesBySkill[row.skill_id] = {};
				votesBySkill[row.skill_id][row.suggested_level] = row.votes;
			}
			myVotes = mine;
			votingAvailable = true;
		} catch (_err) {
			// DB not available — voting UI hidden
		}

		res.render('roleDetail', {
			skills: dataStore.getSkills(),
			role,
			pathway,
			levelId,
			votesBySkill,
			myVotes,
			votingAvailable,
		});
	});

	router.post('/:roleId/pathway/:pathwayId/level/:levelId/vote', async (req, res) => {
		const { roleId, pathwayId, levelId } = req.params;
		const { skill_id, suggested_level } = req.body;
		const voterToken = req.cookies.voter_token;

		const suggestedLevelNum = Number(suggested_level);
		if (!skill_id || !Number.isInteger(suggestedLevelNum) || suggestedLevelNum < 1 || suggestedLevelNum > 7) {
			return res.status(400).send('Invalid vote');
		}

		try {
			await castVote({
				roleId,
				pathwayId,
				level: Number(levelId),
				skillId: skill_id,
				suggestedLevel: suggestedLevelNum,
				voterToken,
			});
		} catch (err) {
			return res.status(500).send('Vote could not be saved');
		}

		res.redirect(`/roles/${roleId}/pathway/${pathwayId}/level/${levelId}`);
	});

	return router;
}

module.exports = createRolesRouter;
