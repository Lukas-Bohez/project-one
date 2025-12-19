#!/bin/bash
# Extract YouTube cookies from browser
# Run this script to get fresh cookies

echo "=== YouTube Cookie Extractor ==="
echo ""
echo "This will extract cookies from your browser."
echo "Make sure you're logged into YouTube in Chrome or Firefox."
echo ""

# Check if yt-dlp is available
if ! command -v yt-dlp &> /dev/null; then
    echo "❌ yt-dlp not found. Installing..."
    /home/student/Project/.venv/bin/pip install -U yt-dlp
fi

# Extract cookies from Chrome
echo "🔍 Trying to extract cookies from Chrome..."
/home/student/Project/.venv/bin/yt-dlp --cookies-from-browser chrome --cookies cookies_new.txt --skip-download "https://www.youtube.com/watch?v=dQw4w9WgXcQ" 2>/dev/null

if [ -f "cookies_new.txt" ] && [ -s "cookies_new.txt" ]; then
    echo "✅ Cookies extracted successfully!"
    mv cookies_new.txt cookies.txt
    echo "✅ Saved to cookies.txt"
    echo ""
    echo "Cookie file info:"
    wc -l cookies.txt
    exit 0
fi

# Try Firefox if Chrome failed
echo "🔍 Trying to extract cookies from Firefox..."
/home/student/Project/.venv/bin/yt-dlp --cookies-from-browser firefox --cookies cookies_new.txt --skip-download "https://www.youtube.com/watch?v=dQw4w9WgXcQ" 2>/dev/null

if [ -f "cookies_new.txt" ] && [ -s "cookies_new.txt" ]; then
    echo "✅ Cookies extracted successfully!"
    mv cookies_new.txt cookies.txt
    echo "✅ Saved to cookies.txt"
    echo ""
    echo "Cookie file info:"
    wc -l cookies.txt
    exit 0
fi

echo "❌ Failed to extract cookies from browser."
echo ""
echo "Manual steps:"
echo "1. Install a browser extension like 'Get cookies.txt LOCALLY'"
echo "2. Go to youtube.com and log in"
echo "3. Click the extension and export cookies"
echo "4. Save the file as cookies.txt in this directory"
