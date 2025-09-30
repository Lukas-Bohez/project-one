# Copilot Instructions for Quiz The Spire

These rules help AI a## Gotchas and edge c## Local development checklist
1. **Database**: MySQL running, `backend/config.py` configured (database: `quizTheSpire`)
2. **Dependencies**: 
   - Main: `pip install -r requirements.txt`
   - Converter: `pip install -r backend/requirements_converter.txt`
   - Optional: `pip install PyJWT` for Kingdom Quarry game auth
3. **Services**:
   - FastAPI: `uvicorn backend.app:app --host 0.0.0.0 --port 8000`
   - Video converter: `python backend/video_converter_api.py`
4. **Validation**: Visit `/docs` (Swagger), test Socket.IO connection, check admin interface at `frontend/html/admin.html`

## Key file locations
- **Backend**: `backend/app.py` (main), `database/datarepository.py` (data layer), `models/models.py` (validation)
- **Frontend**: `html/admin.html` + `js/admin.js` + `css/admin.css` (admin), `js/converter.js` (video features)
- **Docs**: `MIGRATION_SYSTEM.md` (admin workflows), `CONVERTER_SETUP.md`, `KINGDOM_QUARRY_SPEC.md`
- **Config**: `config.py` (database), `requirements*.txt` (dependencies) **Database return types**: `Database.execute_sql` returns list (SELECT), `lastrowid` (INSERT), or `rowcount` (UPDATE/DELETE) - handle all three types
- **Tuple vs dict cursors**: `get_all_rows` returns tuples by design, `get_rows/get_one_row` return dicts - don't mix them up with pydantic models
- **Duplicate methods**: `datarepository.py` has duplicate method names (e.g., `is_ip_banned`) - use the later/lower version with explicit column selection
- **Admin role IDs**: Both 1 and 3 are admin roles in `verify_user()` - maintain this logic consistently
- **Hardware dependencies**: Pi components fail gracefully when not available - `RPI_COMPONENTS_AVAILABLE` flag controls background threads
- **JWT dependency**: Kingdom Quarry game features require PyJWT - service degrades gracefully without it
- **Frontend caching**: Admin interface caches API responses - clear localStorage cache when debugging stale data work productively in this quiz/IoT platform project. Follow the concrete conventions and examples below.

## Big picture
- **Multi-service architecture**:
  - **Main FastAPI app** (`backend/app.py`): Quiz platform with Socket.IO realtime events, REST API under `/api/v1`, JWT-based Kingdom Quarry game auth, IoT sensor integration (Raspberry Pi components)
  - **Video converter service** (`backend/video_converter_api.py`): Independent Flask microservice on port 5001 for social media video downloads using yt-dlp + FFmpeg
- **Frontend**: Static HTML/CSS/JS site in `frontend/` with admin interface (`html/admin.html`) for content management
- **Database**: MySQL via repository pattern - all DB access goes through `backend/database/datarepository.py` classes, never direct SQL in endpoints
- **IoT Integration**: Optional Raspberry Pi components (RFID, sensors, LCD, servo) with graceful fallback when hardware unavailable

## How things talk to each other
- **FastAPI + Socket.IO**: Single ASGI app instance mounts Socket.IO at `/socket.io` and REST routes at `/api/v1/*` - never separate these
- **Database layer**: MySQL access ONLY through repository classes in `datarepository.py`. Repositories use `Database` helper methods (`get_rows`, `get_one_row`, `execute_sql`) which handle connections/cursors per call
- **Authentication patterns**:
  - **Quiz/Admin**: Custom headers `X-User-ID` + `X-RFID` with `get_current_user_info()` + `verify_user()` - admin roles are 1 and 3
  - **Kingdom Quarry game**: JWT Bearer tokens with `get_current_game_user()` dependency (requires PyJWT)
- **Realtime communication**: Socket.IO events for quiz state changes - use module-level `sio` server, thread-safe with `asyncio.run_coroutine_threadsafe()`

## Project-specific patterns
- **Repository returns**: Dict cursors via `Database.get_rows/get_one_row` (preferred), but `get_all_rows` returns tuples by design - check return type before feeding to pydantic models
- **Dynamic SQL updates**: Build partial UPDATEs by collecting field fragments, then `WHERE id = %s` - see `ArticlesRepository.update_article()` pattern for all entity updates
- **Frontend admin caching**: JS uses localStorage caching (1min TTL) for question/theme lists - see `fetchQuestions()` in `admin.js`
- **Video converter integration**: Frontend calls Flask service via `converter.js`, handles platform-specific URL validation patterns in `video_converter_api.py`
- **Migration system**: Theme question migrations via `POST /api/v1/themes/{source_id}/migrate-to/{target_id}` with full UI workflow documented in `MIGRATION_SYSTEM.md`
- **IoT sensor data**: Background thread reads Raspberry Pi sensors, stores in `SensorDataRepository`, triggers Socket.IO events for realtime dashboard updates
- **Pydantic models**: All request/response validation in `backend/models/models.py` - use these in FastAPI `response_model` and body parameters

## Running things
- **FastAPI main service**:
  - Dependencies: `requirements.txt` (root) + optional Pi hardware libs (auto-handled)
  - Start: `uvicorn backend.app:app --host 0.0.0.0 --port 8000`
  - Check: `/docs` for Swagger UI, `/socket.io` for realtime connection
- **Video converter service**:
  - Dependencies: `backend/requirements_converter.txt` (Flask + yt-dlp + ffmpeg-python)
  - Start: `python backend/video_converter_api.py` (Flask on 0.0.0.0:5001)
  - Integration: Frontend calls via `converter.js` for social media video downloads
- **Database setup**:
  - Config: Update `backend/config.py` db_config (MySQL, database: `quizTheSpire`)
  - Schema: Apply SQL files manually (`create_articles_table.sql`, `create_stories_migration.sql`)
  - Test: Use `backend/databasetester.py` for connection validation

## Tests and scripts
- **API integration tests**: `backend/test_articles_api.py` (requires running server, auth headers `X-User-ID`/`X-RFID`)
- **Data validation**: `backend/test_migration.py` (repository health checks), `backend/test_parsing.py` (frontend content validation)
- **Database utilities**: `backend/sqlfixer.py`, `backend/sqladder.py` for schema maintenance
- **Admin interface**: Complete workflow in `frontend/html/admin.html` + `frontend/js/admin.js` + `frontend/css/admin.css`
- **Content management**: Article import via `backend/import_articles.py`, admin user creation with `backend/create_articles_admin.py`

## Conventions to follow
- Endpoint base path is always `ENDPOINT` constant from `backend/app.py` (currently `/api/v1`). Keep route strings consistent with trailing slashes used in existing routes.
- For DB: build dynamic UPDATEs by collecting field fragments, then append `WHERE id = %s`; see `ArticlesRepository.update_article`. Always use parameterized SQL.
- When returning lists of entities, sort deterministically (e.g., `ORDER BY id ASC` or `created_at DESC` as in repositories).
- Use `AuditLogRepository.create_audit_log(...)` for admin-sensitive changes (articles, themes, migrations, bans).
- Handle IP and auth headers consistently on protected routes; see `get_current_user_info` and `verify_user`.

## Integration points
- **Socket.IO events**: Quiz state management via events (`connect`, `message`, `waiting_for_answers`, `explanation`) - new events need `sio.emit()` + consider `connect` handler sync
- **IoT hardware** (optional): Raspberry Pi modules in `backend/raspberryPi5/` (RFID, sensors, LCD, servo) with graceful import error handling - keep hardware-dependent code feature-flagged
- **Video platforms**: Converter supports YouTube, TikTok, Instagram, Reddit, Facebook, Twitter, Twitch via platform-specific URL regex patterns
- **Game system**: Kingdom Quarry idle game with separate JWT auth, save/load system, leaderboards - completely independent from quiz auth
- **Content management**: Articles/Stories with full CRUD, search, stats via dedicated repositories - see "FastAPI Endpoints - Articles" section in `app.py`

## Gotchas and edge cases
- `Database.execute_sql` returns either list (for SELECT), `lastrowid`, or `rowcount`. Callers must handle all three. Some repo methods already do type checks; follow existing patterns.
- `Database.get_all_rows` returns tuples (non-dict) by design for certain queries; don’t feed those rows into pydantic models expecting dicts.
- Duplicate method names exist in `datarepository.py` (e.g., repeated `is_ip_banned`, `get_ip_address_by_string`). Prefer the lower version that selects explicit columns.
- Auth roles: role id 1 and 3 are treated as admin in `verify_user`; use same logic when authorizing.

## Example: add a protected CRUD endpoint
- Define request/response models in `backend/models/models.py`.
- Implement repo methods in `backend/database/datarepository.py` using `Database.get_rows/get_one_row/execute_sql`.
- In `backend/app.py`:
  - Add `@app.post(ENDPOINT + "/widgets/")`, depend on `get_current_user_info` and check `role`.
  - Use repo, wrap errors, return pydantic model instance.
  - If background thread needs to emit, use `asyncio.run_coroutine_threadsafe(..., asyncio.get_event_loop())`.

## Local run checklist
- MySQL running and `backend/config.py` points to it (db name: `quizTheSpire`).
- Install deps: `pip install -r requirements.txt` (FastAPI) and `pip install -r backend/requirements_converter.txt` (Flask converter).
- Start servers: uvicorn for FastAPI, python for Flask converter. Open `/docs` for FastAPI Swagger.

If anything above is unclear or missing (e.g., exact frontend admin file paths or additional scripts), say so and we’ll refine this doc together.