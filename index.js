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

const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.set('view engine', 'ejs');

app.get('/', (req, res) => {
	res.send('Hello World!');
});

app.get('/skills', (req, res) => {
		res.render('skills', { skills: skills, roles: roles });
});

app.get('/roles', (req, res) => {
	res.render('roles', { roles: roles, skills: skills });
});

// New endpoint for role details
app.get('/roles/:roleId/pathway/:pathwayId/level/:levelId', (req, res) => {
	const { roleId, pathwayId, levelId } = req.params;

	const role = roles.roles.find(r => r.id === roleId);
	if (!role) {
		return res.status(404).send('Role not found');
	}

	const pathway = roles.pathways.find(p => p.id === pathwayId);
	if (!pathway) {
		return res.status(404).send('Pathway not found');
	}

	const level = role[pathwayId][levelId];
	if (!level) {
		return res.status(404).send('Level not found');
	}

	res.render('roleDetail', { skills: skills, role: role, pathway: pathway, levelId: levelId });

	readSkills();
	readRoles();
});

// New endpoint for skill details
app.get('/skills/:skillId/', (req, res) => {
	const { skillId } = req.params;

	const skill = skills.skills.find(s => s.id == skillId);
	if (!skill) {
		return res.status(404).send('Skill not found');
	}

	res.render('skillDetail', { skills: skills, skillId: skillId });

	readSkills();
	readRoles();
});



// New endpoint for skill level details
app.get('/skills/:skillId/level/:levelId', (req, res) => {
	const { skillId, levelId } = req.params;

	const skill = skills.skills.find(s => s.id == skillId);
	if (!skill) {
		return res.status(404).send('Skill not found');
	}

	const level = skill.levels.find(l => l.level == levelId);
	if (!level) {
		return res.status(404).send('Level not found');
	}

	res.render('skillLevelDetail', { skills: skills, skillId: skillId, levelId: levelId });

	readSkills();
	readRoles();
});


app.listen(port, () => {
	console.log(`Server is running on http://localhost:${port}`);
});

///////////////////////////////////////////////////////////////////////////////////////////////////


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

function readRoles(print = false) {

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

					});
				}

				resolve(roles);
			}
	
		});
	
	});

	return rolesPromise;

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

readSkills();
readRoles();

module.exports = {
	readSkills,
	readRoles
};
