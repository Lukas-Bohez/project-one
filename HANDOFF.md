# HANDOFF — QuizTheSpire Go Backend Port (Session 2026-09-09)

> Written for the next AI agent. Read this FIRST before touching anything.

## 1. TL;DR — Where things stand

- **The Go backend is LIVE and serving quizthespire.com** as systemd unit `quizthespire.service` on a Raspberry Pi 5 (aarch64, Debian 12, hostname `project1-orange-coconut`).
- **All 6 study-page themes now exist in the DB** (seeded by `EnsureThemes()` at server startup):
  - `1` Japanese Language (30 active questions)
  - `19` World Cuisines (55 active questions)
  - `45` Space Exploration (**0 questions — NEEDS CONTENT**)
  - `46` Ancient Civilizations (**0 questions — NEEDS CONTENT**)
  - `47` World Geography (**0 questions — NEEDS CONTENT**)
  - `48` Music Through the Ages (**0 questions — NEEDS CONTENT**)
- **The single biggest remaining task: seed questions for themes 45–48** so the study page's 6 category cards are all backed by real, playable content. Everything else (build, deploy, study page HTML, game loop) is done and verified.
- `go build ./...` and `go vet ./...` both exit 0. The deployed binary at `backend-go/bin/quizthespire-server` is current (backup: `backend-go/bin/quizthespire-server.bak-20260909`).

## 2. Environment quirks (IMPORTANT — read before running anything)

- **Terminal stdout capture is UNRELIABLE.** Commands often hang for 300s with no output, or return "output could not be captured". **Workaround that always works: redirect command output to a file, then read the file with the `read_files` tool.**
  - ✅ `mysql ... -e 'SELECT ...' > /tmp/out.txt 2>&1; true` then read `/tmp/out.txt`
  - ❌ `mysql ... -e 'SELECT ...'` (stdout capture may hang)
- The shell occasionally recovers on its own; retry once before assuming a command failed.
- The venv is auto-activated: `(.venv) student@project1-orange-coconut:~/Project $` — the working dir is `/home/student/Project`, and the git repo is at `/home/student/Project/project-one`.

## 3. Live DB access (verified working)

```bash
mysql -u quiz_user -p'secure_password_not_here' -h 127.0.0.1 -P 3306 quizTheSpire -e 'SELECT ...'
```

- Credentials come from `backend-go/internal/config/config.go` fallbacks (no env file exists; `/etc/default/quizthespire` is absent and the unit's `EnvironmentFile=-` makes it optional).
- DB name: `quizTheSpire`, charset `utf8mb4`, host `127.0.0.1:3306`.

### Key schema facts (verified via SHOW CREATE TABLE)

**`themes`**: `id`, `name`, `description`, `logoUrl`, `is_active`, `created_at`, `updated_at`

**`questions`** (AUTO_INCREMENT currently at 380):
- `id`, `question_text` (text), `themeId` (FK→themes.id), `difficultyLevelId` (FK→difficultyLevels.id), `explanation` (text, nullable), `Url` (varchar 500), `time_limit` (int, default 30, CHECK > 0), `think_time` (int, default 0), `points` (int, default 10, CHECK > 0), `is_active` (tinyint, **default 0 — must set 1!**), `no_answer_correct` (tinyint), `createdBy` (FK→users.id, nullable), `LightMax/LightMin/TempMax/TempMin` (nullable, unused), `created_at`, `updated_at`

**`answers`** (AUTO_INCREMENT at 3835):
- `id`, `questionId` (FK→questions.id, ON DELETE CASCADE), `answer_text` (text), `is_correct` (tinyint), `created_at`, `updated_at`

**`difficultyLevels`**: `1` Easy, `2` Medium, `3` Hard, `4` Expert

### Sample data format (Japanese Language, theme 1)

Question: `What is the correct reading for the kanji 三浦?` (themeId=1, difficultyLevelId=2, time_limit=9, points=30, is_active=1)
Answers: `Miura`(1), `Sanura`(0), `Mitsuura`(0), `Sampo`(0)

Note: some questions have 4–6 answers; multiple correct answers are allowed (e.g. question 3 has both `patience` and `endurance` correct). `no_answer_correct=1` exists for "wait it out" questions.
## 4. Build / deploy / restart commands

```bash
# Build (official unit-documented command)
cd /home/student/Project/project-one/backend-go
GOOS=linux GOARCH=arm64 /usr/local/go/bin/go build -o bin/quizthespire-server ./cmd/server

# Deploy + restart
sudo cp bin/quizthespire-server /usr/local/bin/quizthespire-server   # (if that's the unit's ExecStart path — verify!)
sudo systemctl restart quizthespire.service
systemctl is-active quizthespire.service
journalctl -u quizthespire.service -n 30 --no-pager
```

- Go toolchain: **Go 1.23.4 for linux/arm64 at `/usr/local/go/bin/go`** (NOT the system `go` — use the full path).
- The service unit documents the official build command (see `systemctl cat quizthespire.service`).
- **`EnsureThemes()` runs at startup** (`cmd/server/main.go:136`) and is idempotent — it already inserted themes 45–48. Restarting the service will NOT re-add them (they exist), and it will NOT create questions.

## 5. What was done this session (verified)

1. **Go toolchain installed** (Go 1.23.4 arm64) — full build + vet pass.
2. **Game loop completed** in `backend-go/internal/quiz/game_loop.go` (new file): `runQuestionPhase`, `runExplanationPhase`, `cleanup`, `waitForTimer`; fixed timer-loop `break` bug (now uses `expired` flag); removed unused `math/rand` import.
3. **Session state** in `backend-go/internal/quiz/session_state.go` (new file): `SessionState` with `hub *Hub` back-reference set in `getSessionState`.
4. **DB schema fixes**: `playerAnswers` (camelCase) table/column names corrected; `SetSessionTheme` added; `GetSessionScores` now joins `users` for real usernames (the earlier "stray brace" was the missing closing `}` of `GetSessionScores` — fixed).
5. **Theme seeding**: `InsertTheme` + `EnsureThemes` in `backend-go/internal/repository/quiz_repo.go`; called at startup in `cmd/server/main.go:136`. **All 6 themes verified in live DB.**
6. **Study page cleaned**: `frontend/pages/study/index.html` — all "Ash Bloods"/"Toxic Air"/dark-fantasy references removed; 6 category cards now: Japanese Language, World Cuisines, Space Exploration, Ancient Civilizations, World Geography, Music Through the Ages.
7. **Quiz content cleanup**: 255 bad questions deleted (Story: Toxic Air, Story: Ash Bloods, Story: The Timeless Tournament, Miscellaneous, Free points). Only Japanese Language (30) + World Cuisines (55) remain active.

## 6. Remaining work (priority order)

### P1 — Seed questions for themes 45–48 (THE main gap)
- Each theme needs ~10–30 quality questions with 4–6 answers each, `is_active=1`, `difficultyLevelId` spread across 1–3, `time_limit` 10–30, `points` 10–30, and a short `explanation`.
- Insert pattern (per question): `INSERT INTO questions (question_text, themeId, difficultyLevelId, explanation, time_limit, points, is_active) VALUES (...);` then capture `LAST_INSERT_ID()` and insert 4–6 answers into `answers`.
- Write as a `.sql` file (e.g. `/tmp/seed_themes_45_48.sql`) and run with `mysql ... < file.sql`, or write a small Go/Python seeder. **Do NOT hand-insert via mysql -e one-liners for 100+ questions — use a file.**
- After seeding, verify: `SELECT t.name, COUNT(q.id) FROM themes t LEFT JOIN questions q ON q.themeId=t.id AND q.is_active=1 GROUP BY t.id;`

### P2 — Verify live API + study page end-to-end
- `curl http://127.0.0.1:8081/api/v1/themes` should return 6 themes.
- Load `https://quizthespire.com/pages/study/` in a browser; confirm all 6 cards render and answers show for each theme.
- Test a quiz WS connection to `/api/v1/quiz/ws` (plain WebSocket; the Socket.IO frontend is NOT wired to it yet — see note in `main.go`).

### P3 — Commit & push
- Current uncommitted changes (verified): `backend-go/cmd/server/main.go`, `internal/quiz/{answers,handlers,hub,models}.go`, `internal/repository/{quiz,quiz_repo}.go`, `frontend/pages/{quiz,study}/index.html`, new files `internal/quiz/{game_loop,session_state}.go`, `frontend/js/pages/quiz/socket-shim.js`.
- Suggested commit: `feat: complete Go quiz engine, seed themes, update study page`
- `git add backend-go/ frontend/ && git commit -m "..." && git push origin main`


## 7. File map (backend-go)

- `cmd/server/main.go` — entrypoint; wires repos, hub, `EnsureThemes()`, routes
- `internal/quiz/game_loop.go` — question/explanation phases, timers, cleanup (NEW)
- `internal/quiz/session_state.go` — session state + hub back-ref (NEW)
- `internal/quiz/hub.go` — WS hub, `ServeWS`, client mgmt
- `internal/quiz/handlers.go` — HTTP handlers (themes, questions, difficulty)
- `internal/quiz/answers.go` — answer validation/scoring
- `internal/quiz/models.go` — quiz models
- `internal/repository/quiz_repo.go` — DB queries incl. `InsertTheme`/`EnsureThemes`/`GetSessionScores`
- `internal/repository/quiz.go` — legacy quiz repo
- `internal/config/config.go` — env config + DB DSN (fallback creds above)
- `migrations/` — `0001_ugc_schema.{up,down}.sql`, `0002_add_timestamp_columns.up.sql`
- `bin/quizthespire-server` — deployed binary (backup `.bak-20260909`)

## 8. Frontend notes

- `frontend/pages/study/index.html` — study page (6 theme cards, cleaned)
- `frontend/pages/quiz/index.html` — quiz page (minor edits)
- `frontend/js/pages/quiz/socket-shim.js` — NEW, plain-WebSocket shim (uncommitted)
- `frontend/js/content.js` / `contentPlus.js` — STILL contain "Ash Bloods" references (old Python-era content files; only relevant if the legacy frontend loads them — check before deleting)

## 9. Gotchas / warnings

- **`is_active` defaults to 0** on questions — forgetting to set it to 1 makes questions invisible.
- **Do not delete the Python backend** (`backend/`) yet — the Socket.IO frontend still talks to it for the live quiz until the WS shim is fully wired.
- The `questions` table has CHECK constraints (`time_limit > 0`, `points > 0`) — don't insert 0s.
- `answers.questionId` has ON DELETE CASCADE — deleting a question removes its answers automatically.
- If `mysql` client is missing, use `sudo mariadb` (same creds) or the app's DSN via a tiny Go program.
