#!/usr/bin/env bash
set -euo pipefail

# Helper script to purge sensitive files from git history using git-filter-repo.
# This script does NOT run automatically destructive pushes. It creates a backup
# branch and shows the commands to run to replace history; you must review and
# run the final push commands yourself.

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

FILES_TO_REMOVE=(
  "frontend/cert/key.pem"
  "frontend/cert/cert.pem"
)

echo "Repository root: $REPO_ROOT"
echo "Files targeted for removal:"
for f in "${FILES_TO_REMOVE[@]}"; do echo "  - $f"; done

echo
echo "STEP 1: Create a backup branch of current main"
echo "  git checkout -b backup-main-$(date +%Y%m%d%H%M%S)"

echo
echo "STEP 2: Remove files from history using git-filter-repo (recommended)"
if command -v git-filter-repo >/dev/null 2>&1; then
  echo
  echo "Run the following command to remove the listed paths from history (dry-run not available with filter-repo):"
  CMD=(git filter-repo --force)
  for p in "${FILES_TO_REMOVE[@]}"; do
    CMD+=(--path "$p")
  done
  CMD+=(--invert-paths)
  echo
  echo "  ${CMD[*]}"
  echo
  echo "If you want to run it now, copy/paste the command above into your shell."
else
  echo "git-filter-repo not installed. Install it (pip install git-filter-repo) or use the BFG tool." 
  echo "BFG example: java -jar bfg.jar --delete-files 'key.pem' --delete-files 'cert.pem'"
fi

cat <<'EOF'

STEP 3: After rewriting history locally, run these commands to finalize and push:

#  git reflog expire --expire=now --all
#  git gc --prune=now --aggressive
#  git remote set-url origin <your-remote-url-if-needed>
#  git push origin --force --all
#  git push origin --force --tags

IMPORTANT: Force-pushing rewritten history will rewrite the remote repository for
all collaborators. Coordinate with team members before performing the force-push.

STEP 4: Immediately rotate any exposed certificates / private keys that were
compromised. Do NOT reuse the same private key. If you used Let's Encrypt,
run certbot to reissue and replace the cert/key on your servers.

EOF

echo "Helper script created at scripts/purge_gitrepo_secrets.sh — review before running."
