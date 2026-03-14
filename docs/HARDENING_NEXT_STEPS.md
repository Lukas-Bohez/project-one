# Next automated hardening tasks added to the repo

This file describes the small, safe automation I added and recommended manual steps.

- Added `.githooks/pre-commit` to block accidental commits of `*.pem`, `*.key`,
  `.env`, `.bak`, and `.DS_Store` files. Install with:

```bash
./scripts/install_git_hooks.sh
```

- I added `scripts/purge_gitrepo_secrets.sh` and `docs/PURGE_SECRETS.md` earlier
  to guide history rewriting and rotation steps.

Recommended next actions (manual):

1. Run `./scripts/install_git_hooks.sh` locally to protect commits.
2. Rotate any TLS certificates that may have been exposed.
3. Follow `docs/PURGE_SECRETS.md` when ready to rewrite git history.
