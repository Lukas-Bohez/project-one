# Notification: Imminent Git History Rewrite (Action Required)

Short one-line message to send (copy/paste):

"Heads-up: I'm about to rewrite git history to remove exposed TLS keys from the repo — please stop pushing to `main` and re-clone after I announce completion."

Suggested email/Slack message (expand as needed):

Hello team,

I'm preparing to rewrite the repository history on `main` to permanently remove accidentally committed TLS private key and certificate files. This operation will require a force-push and will rewrite commits across the repository.

Action required from you:
- Do not push to `main` or merge branches into `main` until I confirm the work is complete.
- After I finish and announce completion, please re-clone the repository (do NOT pull) to avoid local history conflicts.

What I'll do:
- Create a backup branch locally.
- Use `git-filter-repo` (or BFG if needed) to remove the sensitive files from all commits.
- Run garbage collection and then force-push the cleaned history to `origin`.
- Rotate any compromised TLS certs/keys and update production servers.

If you have any unmerged work in `main`, please create a branch from your current `main` and push it to a safe feature branch now.

Thanks — I will announce when the purge and rotation are complete.
