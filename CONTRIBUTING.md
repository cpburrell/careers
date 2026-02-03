# Contributing

This repo follows a **git-flow** style branching model.

## Branches

- `master`: production-ready history (**only updated by releases/hotfixes**, not day-to-day dev)
- `develop`: integration branch for day-to-day development
- `feature/*`: new work (branch off `develop`, PR back into `develop`)
- `release/*`: stabilization branches (branch off `develop`, PR into `master` + back-merge into `develop`)
- `hotfix/*`: urgent fixes (branch off `master`, PR into `master` + back-merge into `develop`)

## Local development

Do local development first (VS Code), and only push when a change is ready for review.

Recommended loop:
- Run/debug locally via VS Code (no Docker required for the app)
- Run tests locally: `npm test`
- Push feature branches and open PRs into `develop`

## Setup (git-flow tooling)

Install git-flow:
- macOS (Homebrew): `brew install git-flow-avh`
- Ubuntu/Debian: `sudo apt-get install git-flow`

Initialize git-flow in this repo (local config only):
- `bin/git-flow-init.sh`

## Day-to-day workflow

### Start a feature

- `git checkout develop`
- `git pull`
- `git flow feature start my-feature`

Work, commit, then:
- `git flow feature finish my-feature`

Or if you prefer PRs and keeping branches:
- `git push -u origin feature/my-feature`
- Open a PR into `develop`

### Cut a release

- `git checkout develop && git pull`
- `git flow release start R0.0.2`
- Stabilize (bump versions, docs, etc.)
- `git flow release finish R0.0.2`
- Push `master` + tags + `develop`

### Hotfix

- `git checkout master && git pull`
- `git flow hotfix start hotfix-<short-desc>`
- Fix + commit
- `git flow hotfix finish hotfix-<short-desc>`
- Push `master` + tags + `develop`
