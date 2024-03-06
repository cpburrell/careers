#!/usr/bin/env node

/**
 * Module dependencies.
 */
// config variables
var dotenv = require('dotenv');
var fs = require('fs');

const result = dotenv.config();

var roles = {};
var skills = {};


///////////////////////////////////////////////////////////////////////////////////////////////////

console.log('Running...');

function readSkills(print = false) {

	const skillsPromise = new Promise((resolve, reject) => {
		fs.readFile('./skills.json', (err, data) => {

			if(err) {
				console.log("err: " + err);
	
				reject(err);
	
			} else {
		//		console.log("data: " + data);
	
				skills = JSON.parse(data);
	
				if(print){
	
					skills.skills.forEach(skill => {
						console.log("\t" + skill.id + ": " + skill.name + " (" + skills.categories.find(category => category.id === skill.category_id ).name + ")");
	
						skill.levels.forEach(level => {
							console.log("\t\t" + level.level + ": " + level.level_desc);
						});
					});
		
				}

				resolve(skills);
			}
	
		});

	});

	return skillsPromise;
}

function readRoles(skills, print = false) {

	const rolesPromise = new Promise((resolve, reject) => {
		fs.readFile('./roles.json', (err, data) => {

			if(err) {
				console.log("err: " + err);
	
				reject(err);
			} else {
	
				roles = JSON.parse(data);
				
				if(print) {
					roles.roles.forEach(role => {
						console.log(role.name + ": Indivdual Contributor");
		
						role.individual_contributor.levels.forEach(level => {
							console.log("\t" + level.level + ": " + level.title);
						});
		
						console.log(role.name + ": Line Manager");
		
						role.line_manager.levels.forEach(level => {
							console.log("\t" + level.level + ": " + level.title);
						});
			
		//					skill.levels.forEach(level => {
		//						console.log("\t\t" + level.level + ": " + level.level_desc);
		//					});
					});
				}

				resolve({"skills": skills, "roles": roles});
			}
	
		});
	
	});

	return rolesPromise;

}

function doBoth() {

	
	readSkills()
	.then(skills => {

		console.log("Skill Categories:")
		skills.categories.forEach(category => {
			console.log(category.id + ": " + category.name);

		});

		readRoles(skills).then(({skills, roles}) => {

			roles.roles.forEach(role => {
				console.log(role.name + ": Indivdual Contributor");
		
				role.individual_contributor.levels.forEach(level => {
					console.log("\t" + level.level + ": " + level.title + ":");

					level.competencies.forEach((competency) => {
						Object.keys(competency).forEach((key) => {
						
							var tempSkill = skills.skills.find(sub1 => sub1.id === key)
							var tempLevel = skills.levels.find(sub2 => sub2.level === competency[key])

							console.log("\t\t" + tempSkill.name + " (" + key + "): " + competency[key] + " (" + tempLevel.level_desc + ")");

						});
					});

				});
		
				console.log(role.name + ": Line Manager");
		
				role.line_manager.levels.forEach(level => {
					console.log("\t" + level.level + ": " + level.title + ":");

					level.competencies.forEach((competency) => {
						Object.keys(competency).forEach((key) => {
						
							var tempSkill = skills.skills.find(sub1 => sub1.id === key)
							var tempLevel = skills.levels.find(sub2 => sub2.level === competency[key])

							console.log("\t\t" + tempSkill.name + " (" + key + "): " + competency[key] + " (" + tempLevel.level_desc + ")");

						});
					});
				});
			});
		});

	
	})
	.catch(err => {

	});


}

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


//do something when app is closing
process.on('exit', exitHandler.bind(null,{cleanup:true}));

//catches ctrl+c event
process.on('SIGINT', exitHandler.bind(null, {exit:true}));

// catches "kill pid" (for example: nodemon restart)
process.on('SIGUSR1', exitHandler.bind(null, {exit:true}));
process.on('SIGUSR2', exitHandler.bind(null, {exit:true}));

//catches uncaught exceptions
process.on('uncaughtException', exitHandler.bind(null, {exit:true}));


module.exports = {
	readSkills
,
	readRoles,
	doBoth
};


