#!/usr/bin/env bash
set -euo pipefail

if ! command -v git >/dev/null 2>&1; then
  echo "git is not installed"
  exit 1
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Not inside a git repository"
  exit 1
fi

if ! git flow version >/dev/null 2>&1; then
  echo "git-flow is not installed. See CONTRIBUTING.md for install options."
  exit 1
fi

echo "Initializing git-flow (local repo config only)..."
echo "Main branch: master"
echo "Develop branch: develop"

# -d uses git-flow defaults (master/develop + feature/release/hotfix/support prefixes)
git flow init -d

echo "Done."

