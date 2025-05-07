#!/usr/bin/env node

/**
 * Module dependencies.
 */
// config variables
var dotenv = require('dotenv');
const result = dotenv.config();


var fs = require('fs');

const csv=require('csvtojson')
const json2html = require('node-json2html');


var roles = {};
var skills = {};
var sfiaCSV = {};

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

app.get('/sfia/', (req, res) => {
	let template_table_header = {
		"<>": "tr", "html": [
			{"<>": "th", "html": "ID"},
			{"<>": "th", "html": "Category"},
			{"<>": "th", "html": "Subcategory"},
			{"<>": "th", "html": "Code"},
			{"<>": "th", "html": "Skill"},
			{"<>": "th", "html": "Level 1"},
			{"<>": "th", "html": "Level 2"},
			{"<>": "th", "html": "Level 3"},
			{"<>": "th", "html": "Level 4"},
			{"<>": "th", "html": "Level 5"},
			{"<>": "th", "html": "Level 6"},
			{"<>": "th", "html": "Level 7"}
		]
	}

	let template_table_body = {
		"<>": "tr", "html": [
			{"<>": "td", "html": "${ID}"},
			{"<>": "td", "html": "${Category}"},
			{"<>": "td", "html": "${Subcategory}"},
			{"<>": "td", "html": "${Code}"},
			{"<>": "td", "html": "${Skill}"},
			{"<>": "td", "html": "<a href='sfia/${Code}/level/1'>${Level 1}</a>"},
			{"<>": "td", "html": "<a href='sfia/${Code}/level/2'>${Level 2}</a>"},
			{"<>": "td", "html": "<a href='sfia/${Code}/level/3'>${Level 3}</a>"},
			{"<>": "td", "html": "<a href='sfia/${Code}/level/4'>${Level 4}</a>"},
			{"<>": "td", "html": "<a href='sfia/${Code}/level/5'>${Level 5}</a>"},
			{"<>": "td", "html": "<a href='sfia/${Code}/level/6'>${Level 6}</a>"},
			{"<>": "td", "html": "<a href='sfia/${Code}/level/7'>${Level 7}</a>"}
		]
	}

	let table_header = json2html.render(sfiaCSV[0], template_table_header);
	let table_body = json2html.render(sfiaCSV, template_table_body);

	let header = '<!DOCTYPE html>' + '<html lang="en">\n' + '<head><title>Lighthouse Report</title></head>'
	let body = '<h1>My Report</h1><br><table id="my_table">\n<thead>' + table_header + '\n</thead>\n<tbody>\n' + table_body + '\n</tbody>\n</table>'
	body = '<body>' + body + '</body>'

	let html = header + body + '</html>';

	res.send(html);
});

app.get('/sfia/:code/level/:levelId', (req, res) => {
	const { code, levelId } = req.params;

	let template_table_header = {
		"<>": "tr", "html": [
			{"<>": "th", "html": "ID"},
			{"<>": "th", "html": "Category"},
			{"<>": "th", "html": "Subcategory"},
			{"<>": "th", "html": "Code"},
			{"<>": "th", "html": "Skill"},
			{"<>": "th", "html": "Level"},
			{"<>": "th", "html": "Description"}
		]
	}

	let template_table_body = {
		"<>": "tr", "html": [
			{"<>": "td", "html": "${ID}"},
			{"<>": "td", "html": "${Category}"},
			{"<>": "td", "html": "${Subcategory}"},
			{"<>": "td", "html": "${Code}"},
			{"<>": "td", "html": "${Skill}"},
			{"<>": "td", "html": "${Level " + levelId + "}"},
			{"<>": "td", "html": "${Level " + levelId + " description}"},
		]
	}

	let table_header = json2html.render(sfiaCSV[0], template_table_header);
	let  sfia = sfiaCSV.find(s => { return s.Code == code; });
	let table_body = json2html.render(sfia, template_table_body);

	let header = '<!DOCTYPE html>' + '<html lang="en">\n' + '<head><title>Lighthouse Report</title></head>'
	let body = '<h1>SFIA 8 Skills and Levels</h1><br><table id="skills_table">\n<thead>' + table_header + '\n</thead>\n<tbody>\n' + table_body + '\n</tbody>\n</table>'
	body = '<body>' + body + '</body>'

	let html = header + body + '</html>';

	res.send(html);
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

function readSFIACSV(print = false) {

	const sfiacsvPromise = new Promise((resolve, reject) => {

		csv()
		.fromFile('./sfia-8_en_220221.xlsx - Skills.csv')
		.then((jsonObj)=>{
			sfiaCSV = jsonObj;

			if(print) {
				console.log(sfiaCSV);
			}

			resolve(sfiaCSV);
		})
		.error((err)=>{
			console.log(err);
			reject(err);
		})

	});

	return sfiacsvPromise;
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
readSFIACSV();

module.exports = {
	readSkills,
	readRoles
};
