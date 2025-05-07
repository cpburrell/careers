const fs = require('fs');

let data = fs.readFileSync('./skills.json');
skills = JSON.parse(data);

// Read the temp.json file
data = fs.readFileSync('./temp.json');

// Parse the JSON data
const roles = JSON.parse(data);

// Iterate over the roles
roles.roles.forEach(role => {
	console.log(`Pathway: ${role.pathway}`);

	for(var index = 1	; index <= 7; index++) {
		console.log("\tTitle: " + role["ic"][index].title);

		skills.skills.forEach(skill => {
			console.log("\t\t" + skill["id"] + " ("+ skill["name"]+"): " + role["ic"][index][skill["id"]]);
		});

	}

});


