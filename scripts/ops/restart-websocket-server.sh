#!/bin/bash

# WebSocket Server Restart Script
# This script safely restarts the Python backend with the new WebSocket configuration

echo "🔄 Restarting WebSocket server with enhanced configuration..."

# Find and kill existing Python processes (be careful with this in production!)
echo "📋 Looking for existing server processes..."
pkill -f "app.py" || echo "No existing app.py processes found"
pkill -f "uvicorn" || echo "No existing uvicorn processes found"

# Wait a moment for processes to fully terminate
sleep 2

echo "🚀 Starting server with enhanced WebSocket support..."

# Navigate to backend directory
cd "$(dirname "$0")/../../backend" || exit 1

# Start the server with enhanced logging
python3 app.py > server.log 2>&1 &
SERVER_PID=$!

echo "📊 Server started with PID: $SERVER_PID"
echo "📝 Logs are being written to backend/server.log"
echo "🌐 Server should be available at your configured URL"
echo ""
echo "📋 To check server logs in real-time:"
echo "   tail -f backend/server.log"
echo ""
echo "📋 To stop the server:"
echo "   kill $SERVER_PID"
echo ""
echo "✅ Enhanced WebSocket configuration is now active!"
echo "🔧 Test your connections using /diagnostic.html"