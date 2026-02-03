# Contributing

This repo follows a **git-flow** style branching model.

## Branches

- `master`: production-ready history (release tags / PR merges land here)
- `develop`: integration branch for day-to-day development
- `feature/*`: new work (branch off `develop`, PR back into `develop`)
- `release/*`: stabilization branches (branch off `develop`, PR into `master` + back-merge into `develop`)
- `hotfix/*`: urgent fixes (branch off `master`, PR into `master` + back-merge into `develop`)

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

