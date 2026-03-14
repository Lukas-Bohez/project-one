#!/bin/bash
set -euo pipefail

# Script: remove_committed_certs.sh
# Purpose: create a backup and run git-filter-repo to remove committed cert files from history.
# IMPORTANT: This is destructive (rewrites history). Coordinate with collaborators before pushing.

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

CERT_PATHS=("frontend/cert/key.pem" "frontend/cert/cert.pem")

echo "Repository: $REPO_ROOT"

command -v git >/dev/null 2>&1 || { echo "git not found in PATH"; exit 1; }
command -v git-filter-repo >/dev/null 2>&1 || {
  echo "git-filter-repo not found. Install with: pip install git-filter-repo";
  exit 1;
}

echo "Checking history for target paths..."
found=false
for p in "${CERT_PATHS[@]}"; do
  if git rev-list --all -- "$p" | grep -q .; then
    echo "  -> history contains: $p"
    found=true
  else
    echo "  -> not found in history: $p"
  fi
done

if [ "$found" = false ]; then
  echo "No matching paths found in history. Nothing to remove.";
  exit 0;
fi

BACKUP_BUNDLE="repo-backup-$(date +%Y%m%d%H%M%S).bundle"
echo "Creating repository bundle backup: $BACKUP_BUNDLE"
git bundle create "$BACKUP_BUNDLE" --all
echo "Bundle created. Store it safely before proceeding."

BACKUP_BRANCH="backup-before-filter-repo-$(date +%Y%m%d%H%M%S)"
echo "Creating local backup branch: $BACKUP_BRANCH"
git branch "$BACKUP_BRANCH"
echo "Local backup branch created: $BACKUP_BRANCH"

echo "About to run git-filter-repo to remove the files. This will rewrite history locally."
read -p "Proceed? (type 'YES' to continue): " ans
if [ "$ans" != "YES" ]; then
  echo "Aborted by user. No changes made."; exit 0;
fi

echo "Running git-filter-repo..."
git filter-repo --path frontend/cert/key.pem --path frontend/cert/cert.pem --invert-paths

echo "git-filter-repo finished. Verify the repo locally."
echo "When ready, to update the remote you must force-push everything (coordinate with collaborators):"
echo "  git push --force --all"
echo "  git push --force --tags"

echo "If you need to restore the pre-filter repo state locally, you can fetch the backup bundle or switch to branch: $BACKUP_BRANCH"

echo "Done."
