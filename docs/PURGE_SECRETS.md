# Purging Exposed Secrets from Git History

This document explains the recommended, safe steps to remove the exposed TLS
private key and certificate that were present under `frontend/cert/` and to
rotate credentials. Follow these steps carefully and coordinate with any
collaborators before force-pushing rewritten history.

High-level plan
- Create a local backup branch.
- Use `git-filter-repo` (recommended) or `BFG` to remove files from all commits.
- Run garbage collection and expire reflogs locally.
- Force-push cleaned branches and tags to remote.
- Rotate compromised certificates/keys and update production servers.

Commands (example)

1) Create a safety backup branch:

```bash
git checkout -b backup-main-YYYYMMDDHHMMSS
```

2) Install git-filter-repo (if not installed):

```bash
python3 -m pip install --user git-filter-repo
# or use your system package manager
```

3) Remove the specific paths from history (recommended):

```bash
git filter-repo --force --path frontend/cert/key.pem --path frontend/cert/cert.pem --invert-paths
```

If `git-filter-repo` is not available, you can use the BFG Repo-Cleaner:

```bash
# Download bfg jar and run:
java -jar bfg.jar --delete-files 'key.pem' --delete-files 'cert.pem' --no-blob-protection
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

4) Finalize and push cleaned history (coordinate first):

```bash
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push origin --force --all
git push origin --force --tags
```

5) Rotate certificates and private keys immediately
- If these keys were used on any server, consider them compromised.
- Revoke and re-issue certificates with your CA (or run `certbot` for Let's Encrypt).
- Replace keys on all hosts, reload services (e.g., nginx/apache), and verify TLS.

6) Notify collaborators and users
- Tell other devs to re-clone the repository after the force-push to avoid confusion.

Notes & Warnings
- Rewriting git history is destructive for shared repos — coordinate with team members.
- Do NOT reuse private keys. Rotate keys and certs wherever they were used.
- After force-push, CI tokens, deploy keys, or other secrets that may have been exposed
  should be considered for rotation as well.

If you want, I can:
- provide a ready-to-run sequence customized to your remote (`origin`) and branch, or
- run additional repo scans for other sensitive files before you rewrite history.
