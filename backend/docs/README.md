# Backend Structure

Clean, organized backend structure for the Quiz The Spire application.

## Directory Structure

```
backend/
├── app.py                      # Main FastAPI application (7,247 lines)
├── config.py                   # Configuration settings
├── video_converter.py          # Video download/conversion utilities
├── articles_repository.py      # Articles data access layer
├── appConverter.py            # File format converter utilities
├── gunicorn.conf.py           # Gunicorn configuration for production
│
├── routes/                     # API route modules
│   ├── __init__.py
│   └── video_routes.py        # Video converter endpoints (3,382 lines)
│
├── utils/                      # Shared utilities
│   ├── __init__.py
│   └── shared.py              # Global state, helpers, constants
│
├── models/                     # Pydantic models and schemas
│   └── models.py
│
├── database/                   # Database access layer
│   └── datarepository.py      # All database repositories
│
├── scripts/                    # Utility and maintenance scripts
│   ├── check_db.py            # Database health checker
│   ├── databasetester.py      # Database testing utilities
│   ├── debug_permissions.py   # Permission debugging
│   ├── articles_setup.py      # Article database setup
│   ├── create_articles_admin.py
│   ├── import_articles.py
│   ├── sql_story_questions.py
│   ├── sqladder.py
│   ├── sqlfixer.py
│   ├── sqlthemejector.py
│   ├── simplify_logging.py
│   ├── extract_cookies.sh     # Cookie extraction for yt-dlp
│   ├── maintain_ytdlp.sh      # Keep yt-dlp updated
│   ├── restart-backend.sh     # Development restart
│   ├── restart-backend-production.sh
│   ├── start-backend-dev.sh
│   └── start-backend-production.sh
│
├── tests/                      # Test files
│   ├── test_articles_api.py
│   ├── test_migration.py
│   ├── test_parsing.py
│   └── test_video_blocking_fix.py
│
├── logs/                       # All log files (gitignored)
│   ├── app.log
│   ├── backend.log
│   ├── server.log
│   ├── socket.log
│   ├── quiz_debug.log
│   ├── video_debug.log
│   └── cookie_refresh.log
│
├── temp_uploads/              # Temporary file upload directory (gitignored)
├── temp_converted/            # Temporary converted files (gitignored)
├── temp_video_downloads/      # Temporary video downloads (gitignored)
│
├── raspberryPi5/              # Raspberry Pi sensor integration
└── log_backups/               # Archived log files

```

## Key Improvements

### 1. **Modular Routes** (NEW)
- Video converter routes extracted to `routes/video_routes.py` (3,382 lines)
- Reduced main `app.py` from 10,704 → 7,247 lines (32% reduction)
- Easier to maintain and extend

### 2. **Organized Logs**
- All logs now in `logs/` directory
- Updated log paths in code
- Properly gitignored

### 3. **Clean Root Directory**
- Scripts moved to `scripts/` (11 Python scripts, 6 shell scripts)
- Tests moved to `tests/` (4 test files)
- Removed 9 temporary test files (test.mp3, test.ogg, etc.)

### 4. **Shared Utilities** (NEW)
- Common globals and helpers in `utils/shared.py`
- Directory configurations centralized
- Global state management for video downloads

## Running the Backend

### Development
```bash
cd backend
uvicorn app:app --host 0.0.0.0 --port 8001 --reload
```

Or use the convenience script:
```bash
./scripts/start-backend-dev.sh
```

### Production
```bash
./scripts/start-backend-production.sh
```

## Environment Variables

Required in `.env`:
- `DATABASE_URL` - Database connection string
- `PROJECT_TMP_DIR` - Temporary files location (default: `/tmp/project-one`)
- `MAX_CONCURRENT_LONG_CONVERSIONS` - Long video conversion limit (default: 2)

## API Documentation

Once running, visit:
- Swagger UI: http://localhost:8001/docs
- ReDoc: http://localhost:8001/redoc

## Health Check

```bash
curl http://localhost:8001/api/v1/health
```

## Maintenance

### Update yt-dlp
```bash
./scripts/maintain_ytdlp.sh
```

### Check Database
```bash
python3 scripts/check_db.py
```

### Extract YouTube Cookies
```bash
./scripts/extract_cookies.sh
```

## Module Dependencies

- **app.py** → imports from:
  - `routes.video_routes` (video API endpoints)
  - `video_converter` (download/conversion logic)
  - `models.models` (Pydantic schemas)
  - `database.datarepository` (database access)
  - `config` (settings)

- **routes/video_routes.py** → imports from:
  - `utils.shared` (globals, helpers)
  - `video_converter` (conversion functions)

- **video_converter.py** → standalone module
  - Core yt-dlp wrapper
  - Invidious fallback system
  - Metadata embedding

## Notes

- Temporary directories (`temp_*`) are auto-cleaned every 30 seconds
- Video downloads limited to 1GB, 15 minutes max duration
- Rate limiting: 25 concurrent downloads per IP
- Background worker pools for long/short video conversions
