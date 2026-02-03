const dataStore = require('./lib/dataStore');

(async () => {
	await dataStore.loadCore({ validate: false });

	const roles = dataStore.getRoles();
	const skills = dataStore.getSkills();

	(roles.roles || []).forEach((role) => {
		(roles.pathways || []).forEach((pathway) => {
			console.log(`${role.name} (${role.id}) - ${pathway.description} (${pathway.id})`);
			const selected = role[pathway.id] && role[pathway.id].selected_skills;
			console.log(`\tselected_skills: ${(selected || []).length}`);

			for (let level = 1; level <= 7; level++) {
				const lvl = role[pathway.id] && role[pathway.id][String(level)];
				console.log(`\t${level}: ${lvl ? lvl.title : ''}`);
			}
		});
	});

	console.log(`SFIA skills loaded: ${(skills.skills || []).length}`);
})().catch((err) => {
	console.error(err);
	process.exit(1);
});

