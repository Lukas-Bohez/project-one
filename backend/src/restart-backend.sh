#!/bin/bash
# Quick restart script for the backend with cookie configuration

echo "🔄 Restarting backend with cookie authentication..."

# Kill any existing backend process
pkill -f "uvicorn.*app:app" || pkill -f "python.*app.py"

# Wait a moment for cleanup
sleep 2

# Activate virtual environment and start backend
cd /home/student/Project/project-one/backend
source /home/student/Project/.venv/bin/activate

echo "✅ Starting backend (check output for cookie confirmation)..."
python app.py
