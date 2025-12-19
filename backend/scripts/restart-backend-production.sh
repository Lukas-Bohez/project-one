#!/bin/bash
# Complete backend restart with performance improvements

echo "🔧 QuizTheSpire Backend - Complete Restart"
echo "=========================================="
echo ""

# Navigate to backend directory
cd /home/student/Project/project-one/backend

# Activate virtual environment
echo "✅ Activating virtual environment..."
source /home/student/Project/.venv/bin/activate

# Kill ALL existing backend processes
echo "🛑 Stopping all existing backend processes..."
pkill -9 -f 'gunicorn.*app:app' 2>/dev/null || true
pkill -9 -f 'uvicorn.*app:app' 2>/dev/null || true
pkill -9 -f 'python.*app.py' 2>/dev/null || true

# Wait for cleanup
echo "⏳ Waiting for cleanup..."
sleep 3

# Create logs directory
mkdir -p logs

echo ""
echo "🚀 Starting backend in PRODUCTION mode with high-concurrency support"
echo "   This will handle thousands of concurrent users without timing out!"
echo ""

# Start the production backend
./start-backend-production.sh

echo ""
echo "✅ Backend restart complete!"
echo ""
echo "📊 Monitor with:"
echo "   tail -f logs/gunicorn_access.log  # Access logs"
echo "   tail -f logs/gunicorn_error.log   # Error logs"
echo "   ps aux | grep gunicorn            # Running processes"
echo ""
echo "🛑 Stop with:"
echo "   pkill -f 'gunicorn.*app:app'"
echo ""
