#!/bin/bash

# YouTube Downloader Maintenance Script
# This script helps maintain the yt-dlp installation and configuration

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "======================================"
echo "YouTube Downloader Maintenance"
echo "======================================"
echo ""

# Function to update yt-dlp
update_ytdlp() {
    echo "🔄 Updating yt-dlp..."
    pip install --upgrade yt-dlp
    echo "✅ yt-dlp updated successfully"
    yt-dlp --version
    echo ""
}

# Function to check yt-dlp status
check_ytdlp() {
    echo "🔍 Checking yt-dlp installation..."
    if command -v yt-dlp &> /dev/null; then
        echo "✅ yt-dlp is installed"
        yt-dlp --version
    else
        echo "❌ yt-dlp is not installed"
        echo "Installing yt-dlp..."
        pip install yt-dlp
    fi
    echo ""
}

# Function to check logs
check_logs() {
    echo "📋 Recent download activity (last 20 entries)..."
    if [ -f "video_debug.log" ]; then
        echo "--- Successful downloads ---"
        grep "Download completed" video_debug.log | tail -10 || echo "No successful downloads yet"
        echo ""
        echo "--- Recent errors ---"
        grep "ERROR\|403\|failed" video_debug.log | tail -10 || echo "No errors found"
    else
        echo "⚠️  Log file not found: video_debug.log"
    fi
    echo ""
}

# Function to show stats
show_stats() {
    echo "📊 Download Statistics..."
    if [ -f "video_debug.log" ]; then
        local total=$(grep -c "Starting background download" video_debug.log || echo "0")
        local success=$(grep -c "Download completed" video_debug.log || echo "0")
        local errors=$(grep -c "Download failed\|error" video_debug.log || echo "0")
        local errors_403=$(grep -c "403" video_debug.log || echo "0")
        
        echo "Total downloads attempted: $total"
        echo "Successful: $success"
        echo "Errors: $errors"
        echo "403 Forbidden errors: $errors_403"
        
        if [ "$total" -gt 0 ]; then
            local success_rate=$((success * 100 / total))
            echo "Success rate: ${success_rate}%"
        fi
    else
        echo "⚠️  Log file not found"
    fi
    echo ""
}

# Function to test download
test_download() {
    echo "🧪 Testing YouTube download..."
    local test_url="https://www.youtube.com/watch?v=jNQXAC9IVRw"  # "Me at the zoo" - first YouTube video
    echo "Test URL: $test_url"
    echo "Attempting download..."
    yt-dlp -f 'bestaudio[ext=m4a]' --extract-audio --audio-format mp3 --audio-quality 128 \
        -o "test_download.%(ext)s" "$test_url" && \
    echo "✅ Test download successful!" && \
    rm -f test_download.mp3 test_download.m4a || \
    echo "❌ Test download failed"
    echo ""
}

# Function to clean old logs
clean_logs() {
    echo "🧹 Cleaning old logs..."
    if [ -f "video_debug.log" ]; then
        local size=$(du -h video_debug.log | cut -f1)
        echo "Current log size: $size"
        read -p "Archive and rotate logs? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            mv video_debug.log "video_debug.log.$(date +%Y%m%d_%H%M%S)"
            echo "✅ Logs archived"
        fi
    else
        echo "No logs to clean"
    fi
    echo ""
}

# Function to setup environment
setup_env() {
    echo "⚙️  Setting up environment..."
    if [ ! -f ".env" ]; then
        if [ -f ".env.example" ]; then
            cp .env.example .env
            echo "✅ Created .env from .env.example"
            echo "📝 Please edit .env to configure your settings"
        else
            echo "⚠️  .env.example not found"
        fi
    else
        echo "✅ .env file exists"
    fi
    echo ""
}

# Function to check dependencies
check_deps() {
    echo "🔍 Checking dependencies..."
    
    echo "Checking Python packages..."
    python3 -c "import yt_dlp; print('✅ yt-dlp installed')" 2>/dev/null || echo "❌ yt-dlp not installed"
    python3 -c "import mutagen; print('✅ mutagen installed')" 2>/dev/null || echo "⚠️  mutagen not installed (optional for metadata)"
    python3 -c "from PIL import Image; print('✅ Pillow installed')" 2>/dev/null || echo "⚠️  Pillow not installed (optional for thumbnails)"
    
    echo ""
    echo "Checking ffmpeg..."
    if command -v ffmpeg &> /dev/null; then
        echo "✅ ffmpeg is installed"
        ffmpeg -version | head -1
    else
        echo "❌ ffmpeg is not installed (required for audio conversion)"
        echo "Install with: sudo apt-get install ffmpeg"
    fi
    echo ""
}

# Main menu
show_menu() {
    echo "Choose an option:"
    echo "1) Update yt-dlp"
    echo "2) Check yt-dlp status"
    echo "3) View recent logs"
    echo "4) Show statistics"
    echo "5) Test download"
    echo "6) Clean/archive logs"
    echo "7) Setup environment"
    echo "8) Check dependencies"
    echo "9) Run all checks"
    echo "0) Exit"
    echo ""
}

# Process menu choice
process_choice() {
    case $1 in
        1) update_ytdlp ;;
        2) check_ytdlp ;;
        3) check_logs ;;
        4) show_stats ;;
        5) test_download ;;
        6) clean_logs ;;
        7) setup_env ;;
        8) check_deps ;;
        9) 
            check_ytdlp
            check_deps
            show_stats
            check_logs
            ;;
        0) echo "Goodbye!"; exit 0 ;;
        *) echo "Invalid option" ;;
    esac
}

# If no arguments, show interactive menu
if [ $# -eq 0 ]; then
    while true; do
        show_menu
        read -p "Enter choice [0-9]: " choice
        echo ""
        process_choice "$choice"
        echo "Press Enter to continue..."
        read
        clear
    done
else
    # Process command line argument
    process_choice "$1"
fi
