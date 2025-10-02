# Copilot Instructions for Quiz The Spire

This is a multi-service educational quiz platform with IoT integration, idle game features, and content management. Follow these concrete conventions and architectural patterns.

## Architecture Overview

**Three-service architecture**:
1. **Main FastAPI app** (`backend/app.py`, port 8000): Quiz platform with Socket.IO realtime events, REST API under `/api/v1`, JWT-based "Industrial Empire" idle game
2. **Video converter service** (`backend/video_converter_api.py`, port 5001): **ACTIVELY MAINTAINED** Flask microservice for social media video downloads. Supports YouTube, TikTok, Instagram, Reddit, Facebook, Twitter, Twitch via platform-specific URL regex patterns. Uses yt-dlp + FFmpeg. All platform compatibility issues are high priority.
3. **Frontend**: Static HTML/CSS/JS in `frontend/` with comprehensive admin interface (`html/admin.html`), idle game (`idleGame/`), and articles system

**Database architecture**: MySQL (`quizTheSpire`) accessed ONLY through repository pattern in `backend/database/datarepository.py` - never write SQL directly in endpoints. Connection pooling uses thread-local storage (`Database._local`) to prevent connection conflicts across Socket.IO events and FastAPI requests.

**Legacy IoT code**: Raspberry Pi components in `backend/raspberryPi5/` are legacy (hardware stolen). Code remains with `RPI_COMPONENTS_AVAILABLE` flag for graceful degradation. Do not prioritize IoT features.

## Critical Integration Patterns

**FastAPI + Socket.IO fusion**: Single ASGI app mounts Socket.IO at `/socket.io` and REST at `/api/v1/*` using `socketio.ASGIApp(sio, app)`. Module-level `sio` server is thread-safe - use `asyncio.run_coroutine_threadsafe(sio.emit(...), loop)` from background threads.

**Database layer contract**:
- `Database.get_rows(sql, params)` → list of dicts (or None on error)
- `Database.get_one_row(sql, params)` → dict or None
- `Database.get_all_rows(sql, params)` → list of **tuples** (not dicts - legacy method for sessions)
- `Database.execute_sql(sql, params)` → list (SELECT), `lastrowid` (INSERT), or `rowcount` (UPDATE/DELETE)

**Authentication schemes**:
- **Quiz/Admin**: Custom headers `X-User-ID` + `X-RFID`. Use `get_current_user_info()` dependency. Admin roles: 1 and 3 (check both in `verify_user()`)
- **Mine Empire game**: JWT Bearer tokens with `get_current_game_user()` dependency (requires `pip install PyJWT`, gracefully disabled if missing)

**Realtime quiz flow**: Socket.IO events drive quiz state (`connect`, `waiting_for_answers`, `explanation`, `quiz_ended`). Background threads emit events using `asyncio.run_coroutine_threadsafe()`.

## Project-Specific Conventions

**Dynamic SQL updates**: Build partial UPDATEs by collecting SET clauses in a list, then `", ".join(fields)` + `WHERE id = %s`. Example from `ArticlesRepository.update_article()`:
```python
fields = []
params = []
if title is not None:
    fields.append("title = %s")
    params.append(title)
# ... collect all fields
if fields:
    sql = f"UPDATE articles SET {', '.join(fields)} WHERE id = %s"
    params.append(article_id)
    return Database.execute_sql(sql, params)
```

**Endpoint constants**: All routes use `ENDPOINT = "/api/v1"` constant. Keep trailing slashes consistent with existing routes.

**Frontend admin caching**: `admin.js` caches questions/themes in localStorage with 1min TTL (see `fetchQuestions()`). Clear cache when debugging stale data or after migrations.

**Video converter URLs**: Platform-specific regex patterns in `video_converter_api.py`. Frontend in `converter.js` validates URLs client-side before API calls.

**Pydantic validation**: All models in `backend/models/models.py` - use for `response_model` and request bodies. Tuple results from `get_all_rows()` must be converted to dicts before pydantic validation.

**Audit logging**: Call `AuditLogRepository.create_audit_log(user_id, action_type, details, ip_address)` for admin-sensitive operations (theme migrations, question activation, IP bans, article modifications).

**Industrial Empire game architecture**: `frontend/idleGame/` uses modular JS classes (`GameEngine.js`, `ResourceManager.js`, `UpgradeSystem.js`, `MarketSystem.js`, `SaveManager.js`). SaveManager handles localStorage auto-save (30s) + optional cloud sync to FastAPI game endpoints with conflict resolution strategies.

**Mobile-first CSS**: All CSS files MUST include overflow prevention at the top:
```css
/* Prevent horizontal overflow on mobile */
* {
  box-sizing: border-box;
}

html, body {
  max-width: 100%;
  overflow-x: hidden;
}
```
This fixes mobile overflow issues. Apply to all new/modified CSS files.

## Development Workflows

**Start services**:
```bash
# Main app (from project root)
uvicorn backend.app:app --host 0.0.0.0 --port 8000

# Video converter (separate terminal)
python backend/video_converter_api.py  # Runs on port 5001

# Or use restart script
./restart-websocket-server.sh
```

**Database setup**: MySQL with `backend/config.py` credentials. Schema in `data/quizTheSpire.sql`. Initial data with `backend/create_articles_admin.py`.

**Dependencies**:
- Main: `pip install -r requirements.txt`
- **Converter (HIGH PRIORITY)**: `pip install -r backend/requirements_converter.txt` - ensure yt-dlp and FFmpeg compatibility across all supported platforms
- Game auth: `pip install PyJWT` (optional, gracefully degraded if missing)

**Testing**:
- API integration: `python backend/test_articles_api.py` (requires running server + auth headers)
- Repository validation: `python backend/test_migration.py`
- Frontend: Open `frontend/html/admin.html` (requires auth), `frontend/idleGame/index.html` (standalone)

## Key File Locations

**Backend core**: `app.py` (6800+ lines, all endpoints), `database/datarepository.py` (3100+ lines, all repos), `models/models.py` (pydantic models)
**Frontend admin**: `html/admin.html`, `js/admin.js` (2400+ lines), `css/admin.css`
**Industrial Empire game**: `idleGame/index.html`, `idleGame/js/game/*.js`, `idleGame/js/api/*.js`
**Process docs**: `MIGRATION_SYSTEM.md` (theme migration workflow), `QUICK_REFERENCE.md` (game backend integration), `DECAY_SYSTEM_REDESIGN.md` (game balance mechanics). Note: Some docs may be outdated - verify context before relying on them.

## Critical Gotchas

**Tuple vs dict cursors**: `get_all_rows()` returns **tuples** (access via `session[0]`), but `get_rows()`/`get_one_row()` return **dicts** (access via `result['column']`). Don't pass tuples to pydantic models - convert first.

**Duplicate repository methods**: `datarepository.py` has evolved with duplicate method names (e.g., `is_ip_banned` appears twice). Use the **later/lower** version with explicit column selection for correctness.

**Admin role IDs**: Both `1` and `3` are admin roles in `verify_user()`. Maintain this logic consistently - single-role checks will break admin access.

**JWT optional dependency**: `app.py` wraps JWT imports in try/except. Game endpoints raise `HTTPException(500)` with helpful message if PyJWT not installed. Don't assume JWT is always available.

**Socket.IO threading**: Background threads (IoT sensors, quiz timers) must use `asyncio.run_coroutine_threadsafe(sio.emit(...), loop)` to emit events. Direct `await sio.emit()` from threads will fail.

**localStorage cache invalidation**: Admin UI caches heavily. After backend data changes (especially migrations), frontend may show stale data until TTL expires or cache is cleared.

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