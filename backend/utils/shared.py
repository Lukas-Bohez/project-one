"""
Shared utilities and global variables
Used across multiple route modules
"""

import os
import logging
import threading
import time
from datetime import datetime
from typing import Dict, Any
from threading import Event
from fastapi import Request

# ----------------------------------------------------
# Directory Configuration
# ----------------------------------------------------

PROJECT_TMP_DIR = os.environ.get('PROJECT_TMP_DIR', '/tmp/project-one')
UPLOAD_DIR = os.path.join(PROJECT_TMP_DIR, "temp_uploads")
CONVERTED_DIR = os.path.join(PROJECT_TMP_DIR, "temp_converted")
VIDEO_DOWNLOAD_DIR = os.path.join(PROJECT_TMP_DIR, "temp_video_downloads")

# Create directories if they don't exist
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(CONVERTED_DIR, exist_ok=True)
os.makedirs(VIDEO_DOWNLOAD_DIR, exist_ok=True)

# ----------------------------------------------------
# Video Converter Global State
# ----------------------------------------------------

# Active downloads tracking
active_video_downloads: Dict[str, Dict[str, Any]] = {}
download_lock = threading.Lock()

# Queue system for managing concurrent downloads
video_conversion_queue = []  # List of {download_id, url, timestamp, client_ip}
queue_lock = threading.Lock()
dispatcher_event = Event()
dispatcher_thread = None

# Conversion limits
MAX_CONCURRENT_CONVERSIONS = 3
MAX_CONCURRENT_LONG_CONVERSIONS = int(os.environ.get('MAX_CONCURRENT_LONG_CONVERSIONS', '2'))
active_conversions_count = 0
active_long_conversions_count = 0
conversions_lock = threading.Lock()

# Rate limiting
video_download_rate_limit = {}
MAX_CONCURRENT_DOWNLOADS_PER_IP = 25
RATE_LIMIT_WINDOW = 60  # seconds

# Timeouts and limits
DOWNLOAD_TIMEOUT_SECONDS = 1200  # 20 minutes
DOWNLOAD_STALL_TIMEOUT = 600  # 10 minutes
MAX_VIDEO_FILESIZE = 1_073_741_824  # 1GB
MAX_VIDEO_DURATION = 900  # 15 minutes (900 seconds)

# File retention times (seconds)
UPLOAD_RETENTION = 300  # 5 minutes
CONVERTED_RETENTION = 300  # 5 minutes
VIDEO_RETENTION = 180  # 3 minutes

# URL patterns for platform validation - DISABLED: All converters shutdown
URL_PATTERNS = {}

# ----------------------------------------------------
# Logging Configuration
# ----------------------------------------------------

# Video debug logger
video_logger = logging.getLogger('video_debug')
video_logger.setLevel(logging.DEBUG)

# Create log file handler if not already exists
video_log_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'logs', 'video_debug.log')
video_file_handler = logging.FileHandler(video_log_path)
video_file_handler.setLevel(logging.DEBUG)
video_formatter = logging.Formatter('%(asctime)s [%(levelname)s] %(message)s')
video_file_handler.setFormatter(video_formatter)

if not any(isinstance(h, logging.FileHandler) and getattr(h, 'baseFilename', None) == video_file_handler.baseFilename for h in video_logger.handlers):
    video_logger.addHandler(video_file_handler)

video_logger.propagate = False

# ----------------------------------------------------
# Helper Functions
# ----------------------------------------------------

def get_client_ip(request: Request) -> str:
    """Extract client IP address from request headers."""
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip
    
    return request.client.host if request.client else "unknown"


def delete_file_safe(path: str):
    """Safely delete a file if it exists."""
    try:
        if os.path.exists(path):
            os.remove(path)
            print(f"Deleted temp file: {path}")
    except Exception:
        pass


def cleanup_temp_files():
    """Clean up old temporary files using per-directory retention times"""
    try:
        now_ts = datetime.now().timestamp()
        checks = [
            (UPLOAD_DIR, UPLOAD_RETENTION),
            (CONVERTED_DIR, CONVERTED_RETENTION),
            (VIDEO_DOWNLOAD_DIR, VIDEO_RETENTION)
        ]

        for directory, retention in checks:
            for filename in os.listdir(directory):
                file_path = os.path.join(directory, filename)
                if os.path.isfile(file_path):
                    try:
                        if os.path.getmtime(file_path) < (now_ts - retention):
                            os.remove(file_path)
                            print(f"Cleaned up old temp file: {file_path}")
                    except Exception:
                        pass
    except Exception as e:
        print(f"Error cleaning up temp files: {e}")


def start_temp_cleanup(interval: int = 60):
    """Start a background thread that cleans up temp files periodically."""
    def worker():
        while True:
            try:
                cleanup_temp_files()
            except Exception as e:
                print(f"Temp cleanup worker error: {e}")
            time.sleep(interval)

    thread = threading.Thread(target=worker, daemon=True)
    thread.start()


# Start the periodic cleanup thread
start_temp_cleanup(interval=30)
