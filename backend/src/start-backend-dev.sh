#!/bin/bash
# Development startup script with auto-reload (single worker)

set -e

echo "🔧 Starting QuizTheSpire Backend (Development Mode)"
echo "=================================================="

# Navigate to backend directory
cd "$(dirname "$0")"
BACKEND_DIR="/home/student/Project/project-one/backend"
cd "$BACKEND_DIR"

# Create logs directory if it doesn't exist
mkdir -p logs

# Activate virtual environment
if [ -f "/home/student/Project/.venv/bin/activate" ]; then
    echo "✅ Activating virtual environment..."
    source /home/student/Project/.venv/bin/activate
else
    echo "❌ Virtual environment not found at /home/student/Project/.venv"
    exit 1
fi

# Kill any existing backend processes
echo "🔄 Stopping existing backend processes..."
pkill -f "gunicorn.*app:app" || true
pkill -f "uvicorn.*app:app" || true
pkill -f "python.*app.py" || true

# Wait for cleanup
sleep 2

# Load environment variables if .env exists
if [ -f ".env" ]; then
    echo "✅ Loading environment variables from .env"
    export $(grep -v '^#' .env | xargs)
fi

# Start with Uvicorn for development (with reload)
echo "🔧 Starting backend with Uvicorn (development mode with auto-reload)..."
echo "   Listening on: 0.0.0.0:8001"
echo "   Auto-reload: ENABLED (not for production!)"
echo "   ⚠️  For production with high concurrency, use start-backend-production.sh"
echo ""

# Start Uvicorn directly for development
uvicorn app:app \
    --host 0.0.0.0 \
    --port 8001 \
    --reload \
    --reload-dir "$BACKEND_DIR" \
    --log-level info

# Note: Uvicorn will run in foreground in dev mode
# Press Ctrl+C to stop
