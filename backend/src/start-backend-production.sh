#!/bin/bash
# Production startup script with high-concurrency support via Gunicorn

set -e  # Exit on error

echo "🚀 Starting QuizTheSpire Backend (Production Mode)"
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

# Check if gunicorn is installed
if ! command -v gunicorn &> /dev/null; then
    echo "⚠️  Gunicorn not found. Installing..."
    pip install gunicorn
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

# Start with Gunicorn for production
echo "🚀 Starting backend with Gunicorn (4 workers, high concurrency)..."
echo "   Listening on: 0.0.0.0:8001"
echo "   Workers: 4 (handles ~4000 concurrent connections)"
echo "   Access log: logs/gunicorn_access.log"
echo "   Error log: logs/gunicorn_error.log"
echo ""

# Start Gunicorn with configuration file
gunicorn app:app \
    --config gunicorn.conf.py \
    --daemon

# Wait a moment for startup
sleep 2

# Check if the process started successfully
if pgrep -f "gunicorn.*app:app" > /dev/null; then
    echo ""
    echo "✅ Backend started successfully!"
    echo "   PID: $(pgrep -f 'gunicorn.*app:app' | head -1)"
    echo "   API: http://localhost:8001"
    echo "   Socket.IO: http://localhost:8001/socket.io"
    echo ""
    echo "📊 Monitor logs with:"
    echo "   tail -f logs/gunicorn_access.log"
    echo "   tail -f logs/gunicorn_error.log"
    echo ""
    echo "🛑 Stop with:"
    echo "   pkill -f 'gunicorn.*app:app'"
else
    echo ""
    echo "❌ Failed to start backend!"
    echo "   Check logs/gunicorn_error.log for details"
    exit 1
fi
