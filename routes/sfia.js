const express = require('express');

function createSfiaRouter(dataStore) {
	const router = express.Router();

	router.get('/', (req, res) => {
		res.render('sfiaIndex', { sfiaCSV: dataStore.getSfiaCSV() });
	});

	router.get('/:code/level/:levelId', (req, res) => {
		const { code, levelId } = req.params;

		const levelNum = Number(levelId);
		if (!Number.isInteger(levelNum) || levelNum < 1 || levelNum > 7) {
			return res.status(400).send('Invalid level');
		}

		const indexes = dataStore.getIndexes ? dataStore.getIndexes() : null;
		const row = (indexes && indexes.sfiaByCode && indexes.sfiaByCode[code]) || dataStore.getSfiaCSV().find((s) => s.Code == code);
		if (!row) {
			return res.status(404).send('SFIA skill not found');
		}
		res.render('sfiaDetail', { row, levelId: levelNum });
	});

	return router;
}

module.exports = createSfiaRouter;
