# Copilot Instructions for Quiz The Spire

These instructions help AI agents work productively## Integration Points

**Socket.IO events**: Quiz state management via events (`connect`, `message`, `waiting_for_answers`, `explanation`) - new events need `sio.emit()` + consider `connect` handler sync.

**IoT hardware** (optional): Raspberry Pi modules in `backend/raspberryPi5/` (RFID, sensors, LCD, servo) with graceful import error handling - keep hardware-dependent code feature-flagged.

**Video platforms**: Converter supports YouTube, TikTok, Instagram, Reddit, Facebook, Twitter, Twitch via platform-specific URL regex patterns.

**Game system**: Kingdom Quarry idle game with separate JWT auth, save/load system, leaderboards - completely independent from quiz auth.

**Content management**: Articles/Stories with full CRUD, search, stats via dedicated repositories - see "FastAPI Endpoints - Articles" section in `app.py`.his multi-service quiz/IoT platform project. Follow the concrete conventions and examples below.

## Architecture Overview

**Multi-service quiz/IoT platform** with three main components:
- **Main FastAPI app** (`backend/app.py`): Quiz platform with Socket.IO realtime events, REST API under `/api/v1`, JWT-based Kingdom Quarry idle game, IoT sensor integration (Raspberry Pi components)
- **Video converter service** (`backend/video_converter_api.py`): Independent Flask microservice on port 5001 for social media video downloads using yt-dlp + FFmpeg  
- **Frontend**: Static HTML/CSS/JS site in `frontend/` with comprehensive admin interface (`html/admin.html`) for content management

**Database architecture**: MySQL via strict repository pattern - ALL database access goes through `backend/database/datarepository.py` classes, never direct SQL in endpoints. Uses thread-safe connection pooling in `database/database.py`.

**IoT Integration**: Optional Raspberry Pi components (RFID, sensors, LCD, servo) with graceful import error handling - `RPI_COMPONENTS_AVAILABLE` flag controls background threads.

## Critical Integration Patterns

**FastAPI + Socket.IO**: Single ASGI app mounts Socket.IO at `/socket.io` and REST at `/api/v1/*` - never separate these services.

**Database layer**: MySQL access ONLY through repository classes in `datarepository.py`. Each repo method uses `Database` helper methods (`get_rows`, `get_one_row`, `execute_sql`) which handle connections/cursors per call. Thread-local storage prevents connection conflicts.

**Authentication patterns**:
- **Quiz/Admin**: Custom headers `X-User-ID` + `X-RFID` with `get_current_user_info()` + `verify_user()` - admin roles are 1 and 3
- **Kingdom Quarry game**: JWT Bearer tokens with `get_current_game_user()` dependency (requires PyJWT)

**Realtime communication**: Socket.IO events for quiz state changes - use module-level `sio` server, thread-safe with `asyncio.run_coroutine_threadsafe()` from background threads.

## Project-Specific Conventions

**Database return types**: `Database.execute_sql` returns list (SELECT), `lastrowid` (INSERT), or `rowcount` (UPDATE/DELETE) - handle all three types. `get_all_rows` returns tuples by design, `get_rows/get_one_row` return dicts - don't mix with pydantic models.

**Dynamic SQL updates**: Build partial UPDATEs by collecting field fragments, then append `WHERE id = %s` - see `ArticlesRepository.update_article()` pattern for all entity updates.

**Endpoint patterns**: All routes use `ENDPOINT` constant from `backend/app.py` (currently `/api/v1`). Keep route strings consistent with trailing slashes used in existing routes.

**Frontend admin caching**: JS uses localStorage caching (1min TTL) for question/theme lists - see `fetchQuestions()` in `admin.js`. Clear cache when debugging stale data.

**Video converter integration**: Frontend calls Flask service via `converter.js`, handles platform-specific URL validation patterns for YouTube, TikTok, Instagram, Reddit, Facebook, Twitter, Twitch.

**Pydantic models**: All request/response validation in `backend/models/models.py` - use these in FastAPI `response_model` and body parameters.

## Local Development Setup

**Database**: MySQL running, `backend/config.py` configured (database: `quizTheSpire`)

**Dependencies**:
- Main: `pip install -r requirements.txt`
- Converter: `pip install -r backend/requirements_converter.txt`  
- Optional: `pip install PyJWT` for Kingdom Quarry game auth

**Services**:
- FastAPI: `uvicorn backend.app:app --host 0.0.0.0 --port 8000`
- Video converter: `python backend/video_converter_api.py`

**Validation**: Visit `/docs` (Swagger), test Socket.IO connection, check admin interface at `frontend/html/admin.html`

## Key File Locations

**Backend**: `backend/app.py` (main), `database/datarepository.py` (data layer), `models/models.py` (validation)
**Frontend**: `html/admin.html` + `js/admin.js` + `css/admin.css` (admin), `js/converter.js` (video features)
**Docs**: `MIGRATION_SYSTEM.md` (admin workflows), `CONVERTER_SETUP.md`, `KINGDOM_QUARRY_SPEC.md`
**Config**: `config.py` (database), `requirements*.txt` (dependencies)

## Testing & Utilities

**API integration tests**: `backend/test_articles_api.py` (requires running server, auth headers `X-User-ID`/`X-RFID`)
**Data validation**: `backend/test_migration.py` (repository health), `backend/test_parsing.py` (content validation)
**Database utilities**: `backend/sqlfixer.py`, `backend/sqladder.py` for schema maintenance
**Content management**: Article import via `backend/import_articles.py`, admin user creation with `backend/create_articles_admin.py`

## Development Patterns

**Endpoint structure**: Always use `ENDPOINT` constant from `backend/app.py` (currently `/api/v1`). Keep route strings consistent with trailing slashes.

**Database operations**: Build dynamic UPDATEs by collecting field fragments, then append `WHERE id = %s` - see `ArticlesRepository.update_article()`. Always use parameterized SQL. Return lists sorted deterministically (`ORDER BY id ASC` or `created_at DESC`).

**Audit logging**: Use `AuditLogRepository.create_audit_log(...)` for admin-sensitive changes (articles, themes, migrations, bans).

**Authentication**: Handle IP and auth headers consistently on protected routes - see `get_current_user_info()` and `verify_user()` patterns.

## Critical Gotchas

**Database return types**: `Database.execute_sql` returns either list (SELECT), `lastrowid`, or `rowcount`. Handle all three types.

**Tuple vs dict cursors**: `get_all_rows` returns tuples by design, `get_rows/get_one_row` return dicts - don't feed tuples to pydantic models.

**Duplicate methods**: `datarepository.py` has duplicate method names (e.g., `is_ip_banned`) - use the later/lower version with explicit column selection.

**Admin role IDs**: Both 1 and 3 are admin roles in `verify_user()` - maintain this logic consistently.

**Hardware dependencies**: Pi components fail gracefully when not available - `RPI_COMPONENTS_AVAILABLE` flag controls background threads.

**JWT dependency**: Kingdom Quarry game features require PyJWT - service degrades gracefully without it.

## Gotchas and edge cases
- `Database.execute_sql` returns either list (for SELECT), `lastrowid`, or `rowcount`. Callers must handle all three. Some repo methods already do type checks; follow existing patterns.
- `Database.get_all_rows` returns tuples (non-dict) by design for certain queries; don’t feed those rows into pydantic models expecting dicts.
- Duplicate method names exist in `datarepository.py` (e.g., repeated `is_ip_banned`, `get_ip_address_by_string`). Prefer the lower version that selects explicit columns.
- Auth roles: role id 1 and 3 are treated as admin in `verify_user`; use same logic when authorizing.

## Example: Adding a Protected CRUD Endpoint

1. **Define models** in `backend/models/models.py`:
   ```python
   class WidgetCreate(BaseModel):
       name: str
       description: Optional[str] = None
   ```

2. **Add repository methods** in `backend/database/datarepository.py`:
   ```python
   @staticmethod
   def create_widget(name, description=None):
       sql = "INSERT INTO widgets (name, description) VALUES (%s, %s)"
       return Database.execute_sql(sql, [name, description])
   ```

3. **Create endpoint** in `backend/app.py`:
   ```python
   @app.post(ENDPOINT + "/widgets/")
   async def create_widget(
       widget: WidgetCreate,
       user_info: dict = Depends(get_current_user_info)
   ):
       verify_user(user_info["role"])  # Admin check
       result = WidgetRepository.create_widget(widget.name, widget.description)
       return {"id": result, "message": "Widget created"}
   ```

4. **Background events** (if needed):
   ```python
   asyncio.run_coroutine_threadsafe(
       sio.emit("widget_created", {"id": result}),
       asyncio.get_event_loop()
   )
   ```
- MySQL running and `backend/config.py` points to it (db name: `quizTheSpire`).
- Install deps: `pip install -r requirements.txt` (FastAPI) and `pip install -r backend/requirements_converter.txt` (Flask converter).
- Start servers: uvicorn for FastAPI, python for Flask converter. Open `/docs` for FastAPI Swagger.

If anything above is unclear or missing (e.g., exact frontend admin file paths or additional scripts), say so and we’ll refine this doc together.