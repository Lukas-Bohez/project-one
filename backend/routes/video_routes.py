"""
Video Conversion Routes
Handles YouTube video downloads, playlist info, and file conversions
"""

from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Form, Body, Header
from fastapi.responses import FileResponse, StreamingResponse
from starlette.background import BackgroundTask
from typing import Dict, Any, Optional, List
from pydantic import BaseModel
import os
import uuid
import threading
import time
import re
import tempfile
import shutil
import subprocess
import zipfile
from urllib.parse import urlparse
from PIL import Image
import io
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor
from datetime import datetime
from threading import Event
import random

# Import shared utilities and globals
from utils.shared import (
    PROJECT_TMP_DIR,
    VIDEO_DOWNLOAD_DIR,
    UPLOAD_DIR,
    CONVERTED_DIR,
    active_video_downloads,
    download_lock,
    video_conversion_queue,
    queue_lock,
    dispatcher_event,
    MAX_CONCURRENT_CONVERSIONS,
    MAX_CONCURRENT_LONG_CONVERSIONS,
    conversions_lock,
    video_download_rate_limit,
    MAX_CONCURRENT_DOWNLOADS_PER_IP,
    RATE_LIMIT_WINDOW,
    DOWNLOAD_TIMEOUT_SECONDS,
    DOWNLOAD_STALL_TIMEOUT,
    MAX_VIDEO_FILESIZE,
    MAX_VIDEO_DURATION,
    URL_PATTERNS,
    video_logger,
    get_client_ip,
    delete_file_safe
)

# Import video converter functions
from video_converter import (
    get_ydl_opts,
    try_invidious_download,
    apply_metadata,
    get_valid_downloaded_files,
    is_valid_media_file,
    get_random_user_agent,
    get_healthy_invidious_instances,
    update_invidious_health
)

try:
    import yt_dlp
    VIDEO_CONVERTER_AVAILABLE = True
except ImportError:
    VIDEO_CONVERTER_AVAILABLE = False
    print("Warning: yt-dlp not installed. Video converter endpoints will be disabled.")

router = APIRouter(prefix="/api/v1/video", tags=["Video Converter"])
from fastapi import UploadFile, File, Form
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask
import subprocess
from PIL import Image
import io
import zipfile

# Create uploads directory if it doesn't exist
# Use a project-scoped tmp directory outside the repository to avoid
# triggering file watchers and to avoid cluttering the repo.
PROJECT_TMP_DIR = os.environ.get('PROJECT_TMP_DIR', '/tmp/project-one')
UPLOAD_DIR = os.path.join(PROJECT_TMP_DIR, "temp_uploads")
CONVERTED_DIR = os.path.join(PROJECT_TMP_DIR, "temp_converted")
VIDEO_DOWNLOAD_DIR = os.path.join(PROJECT_TMP_DIR, "temp_video_downloads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(CONVERTED_DIR, exist_ok=True)
os.makedirs(VIDEO_DOWNLOAD_DIR, exist_ok=True)

# Note: Cleanup functions and retention settings are now in utils/shared.py

# ----------------------------------------------------
# Video Converter Setup (YouTube, TikTok, etc.)
#  PERFORMANCE OPTIMIZATIONS APPLIED:
# 1. Cookie file path caching - avoid repeated filesystem lookups
# 2. Reduced retry limits (10 instead of 30) - faster failure handling
# 3. Optimized backoff delays (5s max instead of 30s) - quicker retries
# 4. Early failure detection for sign-in/auth errors - no wasted retries
# 5. Invidious proxy prioritized when no cookies - faster success rate
# 6. HTTP connection pooling & concurrent fragments - better throughput
# 7. Reduced sleep intervals (1s instead of 3s) - faster processing
# 8. Lower socket timeouts (20s instead of 30s) - quicker error detection
# 9. Optimized retry configuration (8 max instead of 10) - balanced speed
# 10. Reduced fragment retries (3 instead of 5) - faster failure recovery
# ----------------------------------------------------
try:
    import yt_dlp
    VIDEO_CONVERTER_AVAILABLE = True
    print("Video converter enabled with yt-dlp")
except ImportError as e:
    VIDEO_CONVERTER_AVAILABLE = False
    print(f"Warning: yt-dlp not installed ({e}). Video converter endpoints will be disabled.")

import uuid
import threading
import time
import re
from urllib.parse import urlparse
from typing import Dict, Any, Optional
from pydantic import BaseModel

# Import video converter module
from video_converter import (
    get_ydl_opts,
    try_invidious_download,
    apply_metadata,
    get_valid_downloaded_files,
    is_valid_media_file,
    get_random_user_agent,
    get_healthy_invidious_instances,
    update_invidious_health
)

# Pydantic models for video converter
class VideoUrlValidation(BaseModel):
    url: str
    quality: int = 128
    format: int = 1  # 1 = MP3, 0 = MP4

class VideoConversionRequest(BaseModel):
    url: str
    format: int = 1  # 1 = MP3, 0 = MP4
    quality: int = 128
    chunk_index: Optional[int] = None  # For chunked downloads: which part (1-indexed)
    chunk_start: Optional[int] = None  # Start time in seconds
    chunk_end: Optional[int] = None    # End time in seconds

class VideoConversionResponse(BaseModel):
    success: bool
    download_id: str
    message: str

class ConversionStatus(BaseModel):
    status: str
    progress: float
    platform: str
    format: str
    quality: int
    title: Optional[str] = None
    error: Optional[str] = None
    completed_count: Optional[int] = None
    parts_remaining: Optional[int] = None
    total_videos: Optional[int] = None
    chunk_count: Optional[int] = None
    chunk_duration: Optional[int] = None
    total_duration: Optional[int] = None

class PlaylistInfoRequest(BaseModel):
    url: str
    page: int = 1  # Page number (1-indexed), each page = 100 videos

class PlaylistVideoInfo(BaseModel):
    id: str
    title: str
    duration: Optional[int] = None
    url: str

class PlaylistInfoResponse(BaseModel):
    success: bool
    playlist_id: str
    title: str
    video_count: int
    videos: List[PlaylistVideoInfo]
    is_private: bool = False
    error: Optional[str] = None
    page: int = 1
    page_size: int = 100
    has_more: bool = False  # True if there might be more videos on next page

class BulkDownloadRequest(BaseModel):
    playlist_url: str
    video_ids: List[str]  # List of video IDs to download
    format: int = 1  # 1 = MP3, 0 = MP4
    quality: int = 128

class FullPlaylistDownloadRequest(BaseModel):
    playlist_url: str  # Full playlist URL
    format: int = 1  # 1 = MP3, 0 = MP4
    quality: int = 128
    start_index: int = 1  # Optional: start from video N (1-indexed)
    end_index: Optional[int] = None  # Optional: end at video N (inclusive)

# Global mutable counters (need to be declared here to be modified with `global` keyword)
active_conversions_count = 0
active_long_conversions_count = 0
dispatcher_thread = None

# All other globals are imported from utils.shared
MAX_VIDEO_FILESIZE = 1_073_741_824  # 1GB max (increased for adaptive quality)
MAX_VIDEO_DURATION = 900  # 15 minutes max (900 seconds)
try:
    MAX_ALLOWED_VIDEO_DURATION = int(os.environ.get('MAX_ALLOWED_VIDEO_DURATION', str(60 * 60 * 2)))
except Exception:
    MAX_ALLOWED_VIDEO_DURATION = 60 * 60 * 2  # 2 hours absolute cap
WARN_VIDEO_FILESIZE = 314_572_800  # Warn at 300MB

# Adaptive quality removed: automatic quality reductions are no longer used.
# Quality reduction configuration has been removed to keep downloads at the
# user-requested quality. If you need dynamic adjustments later, reintroduce
# a controlled implementation.

#  WATCHDOG: Monitor stuck downloads
watchdog_thread = None
watchdog_running = False

# Global request throttling to avoid overwhelming YouTube
last_youtube_request_time = 0
youtube_request_lock = threading.Lock()
MIN_REQUEST_INTERVAL = 0.8  #  ANTI-BOT: Increased to 0.8s to appear more human-like

# Session state tracking for more realistic request patterns
request_session_state = {
    'consecutive_requests': 0,
    'last_reset': time.time(),
    'error_count': 0,
    'success_count': 0,
}
session_state_lock = threading.Lock()

#  OPTIMIZATION: Cache cookie file path to avoid repeated lookups
_cached_cookie_file = None
_cookie_cache_checked = False

def get_cached_cookie_file():
    """Get cookie file path with caching to avoid repeated file system checks"""
    global _cached_cookie_file, _cookie_cache_checked
    if not _cookie_cache_checked:
        cookie_file = os.environ.get('YTDL_COOKIE_FILE')
        if not cookie_file:
            backend_cookie_path = os.path.join(os.path.dirname(__file__), 'cookies.txt')
            if os.path.exists(backend_cookie_path):
                cookie_file = backend_cookie_path
        _cached_cookie_file = cookie_file if cookie_file and os.path.exists(cookie_file) else None
        _cookie_cache_checked = True
        if _cached_cookie_file:
            video_logger.info(f"Cookie file cached: {_cached_cookie_file}")
    return _cached_cookie_file

# Invidious instances for fallback (when YouTube blocks us)
INVIDIOUS_INSTANCES = [
    'https://invidious.private.coffee',
    'https://inv.nadeko.net',
    'https://invidious.protokolla.fi',
    'https://yt.artemislena.eu',
    'https://invidious.flokinet.to',
    'https://invidious.privacydev.net',
]
current_invidious_index = 0
invidious_lock = threading.Lock()

#  OPTIMIZATION: Track Invidious instance health for smarter fallback
invidious_health = {}  # {instance_url: {'success_count': int, 'fail_count': int, 'last_success': float, 'last_fail': float}}
invidious_health_lock = threading.Lock()

# update_invidious_health and get_healthy_invidious_instances are now imported from video_converter

def throttle_youtube_request():
    """Ensure minimum time between YouTube requests with sophisticated human-like patterns"""
    global last_youtube_request_time, request_session_state

    with youtube_request_lock:
        current_time = time.time()
        time_since_last = current_time - last_youtube_request_time

        # Update session state
        with session_state_lock:
            # Reset counters every 5 minutes for fresh pattern
            if current_time - request_session_state['last_reset'] > 300:
                request_session_state['consecutive_requests'] = 0
                request_session_state['last_reset'] = current_time

            request_session_state['consecutive_requests'] += 1
            consecutive = request_session_state['consecutive_requests']

        # Base interval with random variance (±30%)
        variance = random.uniform(-0.3, 0.3)
        varied_interval = MIN_REQUEST_INTERVAL * (1 + variance)

        # Exponential backoff after many consecutive requests (looks more human)
        if consecutive > 10:
            # Add progressive delay: more requests = longer pauses
            backoff_factor = min((consecutive - 10) / 10.0, 2.0)  # Cap at 2x
            varied_interval *= (1 + backoff_factor)
            video_logger.debug(f"Applied backoff factor {backoff_factor:.2f} after {consecutive} requests")

        # Apply minimum delay
        if time_since_last < varied_interval:
            sleep_time = varied_interval - time_since_last
            time.sleep(sleep_time)

        # Smart pausing: increase probability with consecutive requests
        pause_probability = min(0.05 + (consecutive * 0.01), 0.20)  # 5%-20% chance
        if random.random() < pause_probability:
            # Longer pauses for burst behavior
            pause_duration = random.uniform(1.0, 4.0)
            video_logger.debug(f"Human-like pause: {pause_duration:.1f}s")
            time.sleep(pause_duration)

        # Occasionally add micro-jitter (very human-like)
        if random.random() < 0.3:
            time.sleep(random.uniform(0.05, 0.15))

        last_youtube_request_time = time.time()

def check_video_rate_limit(client_ip: str) -> bool:
    """Check if IP has exceeded video download rate limit"""
    current_time = time.time()

    if client_ip not in video_download_rate_limit:
        video_download_rate_limit[client_ip] = {'count': 0, 'reset_time': current_time + RATE_LIMIT_WINDOW}
        return True

    # Reset counter if window expired
    if current_time > video_download_rate_limit[client_ip]['reset_time']:
        video_download_rate_limit[client_ip] = {'count': 0, 'reset_time': current_time + RATE_LIMIT_WINDOW}
        return True

    # Check if under limit
    if video_download_rate_limit[client_ip]['count'] < MAX_CONCURRENT_DOWNLOADS_PER_IP:
        return True

    return False

def increment_video_rate_limit(client_ip: str):
    """Increment video download counter for IP"""
    if client_ip in video_download_rate_limit:
        video_download_rate_limit[client_ip]['count'] += 1

def decrement_video_rate_limit(client_ip: str):
    """Decrement video download counter when download completes"""
    if client_ip in video_download_rate_limit and video_download_rate_limit[client_ip]['count'] > 0:
        video_download_rate_limit[client_ip]['count'] -= 1

def get_queue_position(download_id: str) -> dict:
    """Get the position of a download in the queue and estimated wait time"""
    global active_conversions_count, active_long_conversions_count
    with queue_lock:
        # Find position in queue
        for idx, item in enumerate(video_conversion_queue):
            if item['download_id'] == download_id:
                position = idx + 1
                # Estimate wait time: assume 30 seconds per video ahead in queue
                # Plus time for active conversions to complete
                active_slots_used = active_conversions_count
                videos_ahead = idx
                estimated_wait = videos_ahead * 30  # 30 seconds per video
                if active_slots_used >= MAX_CONCURRENT_CONVERSIONS:
                    estimated_wait += 30  # Add buffer for currently processing videos

                return {
                    'in_queue': True,
                    'position': position,
                    'queue_length': len(video_conversion_queue),
                    'estimated_wait_seconds': estimated_wait,
                    'active_conversions_short': active_conversions_count,
                    'active_conversions_long': active_long_conversions_count,
                    'max_concurrent_short': MAX_CONCURRENT_CONVERSIONS,
                    'max_concurrent_long': MAX_CONCURRENT_LONG_CONVERSIONS
                }

        # Not in queue, might be processing or completed
        return {
            'in_queue': False,
            'position': 0,
            'queue_length': len(video_conversion_queue),
            'estimated_wait_seconds': 0,
            'active_conversions_short': active_conversions_count,
            'active_conversions_long': active_long_conversions_count,
            'max_concurrent_short': MAX_CONCURRENT_CONVERSIONS,
            'max_concurrent_long': MAX_CONCURRENT_LONG_CONVERSIONS
        }

def add_to_queue(download_id: str, url: str, client_ip: str, is_long: bool = False):
    """Add a download to the queue"""
    with queue_lock:
        video_conversion_queue.append({
            'download_id': download_id,
            'url': url,
            'client_ip': client_ip,
            'timestamp': time.time(),
            'is_long': bool(is_long)
        })
        video_logger.info(f"Added download {download_id} to queue. Queue length: {len(video_conversion_queue)}")
    # Notify dispatcher to wake up and process queued items
    try:
        dispatcher_event.set()
        video_logger.debug(f"Dispatcher event set after enqueueing {download_id}")
    except Exception as e:
        video_logger.warning(f"Failed to set dispatcher event for {download_id}: {e}")

def remove_from_queue(download_id: str):
    """Remove a download from the queue"""
    global video_conversion_queue
    with queue_lock:
        video_conversion_queue = [item for item in video_conversion_queue if item['download_id'] != download_id]
        video_logger.info(f"Removed download {download_id} from queue. Queue length: {len(video_conversion_queue)}")

def can_start_conversion(is_long: bool = False) -> bool:
    """Check if we can start a new conversion based on concurrent limit.

    Use `is_long=True` for long-video capacity checks.
    """
    global active_conversions_count, active_long_conversions_count
    if is_long:
        return active_long_conversions_count < MAX_CONCURRENT_LONG_CONVERSIONS
    return active_conversions_count < MAX_CONCURRENT_CONVERSIONS

def increment_active_conversions(is_long: bool = False):
    """Increment the count of active conversions. Pass `is_long=True` for long videos."""
    global active_conversions_count, active_long_conversions_count
    with conversions_lock:
        if is_long:
            active_long_conversions_count += 1
            video_logger.info(f"Active long conversions: {active_long_conversions_count}/{MAX_CONCURRENT_LONG_CONVERSIONS}")
        else:
            active_conversions_count += 1
            video_logger.info(f"Active short conversions: {active_conversions_count}/{MAX_CONCURRENT_CONVERSIONS}")

def decrement_active_conversions(is_long: bool = False):
    """Decrement the count of active conversions. Pass `is_long=True` for long videos."""
    global active_conversions_count, active_long_conversions_count
    with conversions_lock:
        if is_long:
            if active_long_conversions_count > 0:
                active_long_conversions_count -= 1
            video_logger.info(f"Active long conversions: {active_long_conversions_count}/{MAX_CONCURRENT_LONG_CONVERSIONS}")
        else:
            if active_conversions_count > 0:
                active_conversions_count -= 1
            video_logger.info(f"Active short conversions: {active_conversions_count}/{MAX_CONCURRENT_CONVERSIONS}")

def process_next_in_queue():
    """Process the next item in the queue if there's capacity"""
    try:
        # Ensure we can modify module-level counters
        global active_conversions_count, active_long_conversions_count
        video_logger.debug("process_next_in_queue invoked")
        # If no capacity for either short or long downloads, don't start anything
        if not (can_start_conversion(False) or can_start_conversion(True)):
            video_logger.info("Cannot start new conversion - at max capacity for both pools")
            return

        with queue_lock:
            if not video_conversion_queue:
                video_logger.info("Queue is empty - no more conversions to process")
                return

            # Prefer to start short videos when short capacity is available.
            selected_index = None
            if can_start_conversion(False):
                for idx, item in enumerate(video_conversion_queue):
                    if not item.get('is_long', False):
                        selected_index = idx
                        break

            # If no short job found or short capacity exhausted, try long jobs
            if selected_index is None and can_start_conversion(True):
                for idx, item in enumerate(video_conversion_queue):
                    if item.get('is_long', False):
                        selected_index = idx
                        break

            if selected_index is None:
                video_logger.info("No suitable queued job fits current capacity")
                return

            next_item = video_conversion_queue[selected_index]
            download_id = next_item['download_id']
            url = next_item['url']
            client_ip = next_item['client_ip']
            is_long_job = bool(next_item.get('is_long', False))

        # Check if this download still exists
        with download_lock:
            if download_id not in active_video_downloads:
                video_logger.warning(f"Download {download_id} no longer exists, skipping")
                remove_from_queue(download_id)
                # Try next item
                process_next_in_queue()
                return

            download_info = active_video_downloads[download_id]
            format_type = 'audio' if download_info['format'] == 'MP3' else 'video'
            quality = download_info['quality']
            output_path = download_info['output_path']

            # Update status to starting
            download_info['status'] = 'starting'

        # Reserve a slot atomically under conversions_lock. If we cannot reserve,
        # leave the item in the queue and return (will be retried later).
        reserved = False
        with conversions_lock:
            if is_long_job:
                if active_long_conversions_count < MAX_CONCURRENT_LONG_CONVERSIONS:
                    active_long_conversions_count += 1
                    video_logger.info(f"Active long conversions: {active_long_conversions_count}/{MAX_CONCURRENT_LONG_CONVERSIONS}")
                    reserved = True
            else:
                if active_conversions_count < MAX_CONCURRENT_CONVERSIONS:
                    active_conversions_count += 1
                    video_logger.info(f"Active short conversions: {active_conversions_count}/{MAX_CONCURRENT_CONVERSIONS}")
                    reserved = True

        if not reserved:
            video_logger.info(f"No capacity to start queued download {download_id} (long={is_long_job}); will retry later")
            return

        # Remove from queue BEFORE starting (so position updates immediately)
        remove_from_queue(download_id)

        # Start the download using the appropriate pool
        video_logger.info(f"Starting queued download {download_id} (long={is_long_job})")
        try:
            pool = long_video_process_pool if is_long_job else video_process_pool
            future = pool.submit(
                download_video_background,
                download_id, url, format_type, quality, output_path, client_ip
            )

            # Add completion callback
            def done_callback(fut):
                try:
                    fut.result()  # Raises exception if download failed
                except Exception as e:
                    video_logger.error(f"Download {download_id} error: {e}")
                finally:
                    decrement_active_conversions(is_long=is_long_job)
                    decrement_video_rate_limit(client_ip)
                    process_next_in_queue()

            future.add_done_callback(done_callback)

        except Exception as e:
            video_logger.error(f"Failed to submit {download_id} to process pool: {e}")
            decrement_active_conversions(is_long=is_long_job)
            # Re-add to queue since submission failed (it was removed before trying)
            with queue_lock:
                # Add back to front of queue since it should be processed next
                video_conversion_queue.insert(0, {
                    'download_id': download_id,
                    'url': url,
                    'client_ip': client_ip,
                    'timestamp': time.time(),
                    'is_long': is_long_job
                })
            with download_lock:
                if download_id in active_video_downloads:
                    active_video_downloads[download_id]['status'] = 'queued'
    except Exception as e:
        video_logger.error(f"Error processing next in queue: {str(e)}")

def detect_platform(url: str) -> Optional[str]:
    """Detect platform from URL"""
    for platform, pattern in URL_PATTERNS.items():
        if re.search(pattern, url, re.IGNORECASE):
            return platform
    return None

def is_playlist_url(url: str) -> bool:
    """Check if URL is a playlist"""
    return 'list=' in url and ('youtube.com' in url or 'youtu.be' in url)

def extract_playlist_id(url: str) -> Optional[str]:
    """Extract playlist ID from YouTube playlist URL"""
    if not is_playlist_url(url):
        return None

    # Extract list parameter
    list_match = re.search(r'[?&]list=([a-zA-Z0-9_-]+)', url)
    playlist_id = list_match.group(1) if list_match else None
    return playlist_id

# ===================================
# PLAYLIST CACHING
# ===================================
# Cache playlist info to avoid redundant API calls (TTL: 5 minutes)
playlist_info_cache: Dict[str, Dict[str, Any]] = {}
PLAYLIST_CACHE_TTL = 300  # 5 minutes

def get_cached_playlist_info(playlist_id: str) -> Optional[Dict[str, Any]]:
    """Get cached playlist info if available and not expired"""
    if playlist_id in playlist_info_cache:
        cache_entry = playlist_info_cache[playlist_id]
        if time.time() - cache_entry['timestamp'] < PLAYLIST_CACHE_TTL:
            video_logger.info(f"Using cached playlist info for {playlist_id}")
            return cache_entry['data']
        else:
            # Expired - remove from cache
            del playlist_info_cache[playlist_id]
    return None

def cache_playlist_info(playlist_id: str, data: Dict[str, Any]):
    """Cache playlist info with timestamp"""
    playlist_info_cache[playlist_id] = {
        'data': data,
        'timestamp': time.time()
    }
    video_logger.info(f"Cached playlist info for {playlist_id}")

# Quality reduction helpers removed. Downloads will use the requested quality
# without automatic reduction. If size estimation is needed in future, add
# a targeted implementation.

# Video converter functions (get_ydl_opts, try_invidious_download, apply_metadata, etc.)
# have been moved to video_converter.py and are imported at the top of this file.

def cleanup_old_video_files():
    """Remove old downloaded video files"""
    try:
        now_ts = datetime.now().timestamp()
        for filename in os.listdir(VIDEO_DOWNLOAD_DIR):
            filepath = os.path.join(VIDEO_DOWNLOAD_DIR, filename)
            if os.path.isfile(filepath):
                try:
                    # Remove files older than VIDEO_RETENTION seconds
                    if os.path.getmtime(filepath) < (now_ts - VIDEO_RETENTION):
                        os.remove(filepath)
                        print(f"Cleaned up old video file: {filename}")
                except Exception:
                    pass
    except Exception as e:
        print(f"Error during video cleanup: {e}")

# Start cleanup thread for video files
def start_video_cleanup():
    def cleanup_worker():
        while True:
            cleanup_old_video_files()
            # Run frequently so video files are removed within the retention window
            time.sleep(30)

    cleanup_thread = threading.Thread(target=cleanup_worker, daemon=True)
    cleanup_thread.start()

# Start the cleanup when the module loads
start_video_cleanup()

print("Registering conversion endpoint...")
@router.post("/convert/upload")
async def upload_and_convert_file(
    file: UploadFile,
    target_format: str = Form(...)
):
    """
    Upload a file and convert it to the target format
    Max file size: 1GB
    """
    print(f"Starting conversion request: {file.filename} -> {target_format}")
    try:
        # Validate file size
        if hasattr(file, 'size') and file.size > 1_000_000_000:
            raise HTTPException(status_code=413, detail="File too large. Maximum size is 1GB.")

        # Clean up old files first
        cleanup_temp_files()

        # Sanitize filename to prevent path traversal
        safe_filename = os.path.basename(file.filename)
        # Remove any remaining dangerous characters
        safe_filename = "".join(c for c in safe_filename if c.isalnum() or c in "._- ")

        # Save uploaded file temporarily
        file_extension = os.path.splitext(safe_filename)[1].lower()
        temp_filename = f"{datetime.now().timestamp()}_{safe_filename}"
        temp_filepath = os.path.join(UPLOAD_DIR, temp_filename)
        print(f"Saving file to: {temp_filepath}")

        # Save the uploaded file
        with open(temp_filepath, "wb") as buffer:
            content = await file.read()
            buffer.write(content)

        print(f"File saved successfully. Size: {len(content)} bytes")

        # Determine conversion type and convert
        print(f"Calling convert_file_backend with {temp_filepath} -> {target_format}")
        converted_filepath = await convert_file_backend(temp_filepath, target_format, file.filename)

        if not converted_filepath or not os.path.exists(converted_filepath):
            raise HTTPException(status_code=500, detail="Conversion failed")

        # Ensure converted file exists and log details before returning
        converted_filename = os.path.basename(converted_filepath)
        if not os.path.exists(converted_filepath):
            print(f"Converted file missing after conversion: {converted_filepath}")
            raise HTTPException(status_code=500, detail="Converted file not found after conversion")

        file_size = os.path.getsize(converted_filepath)
        print(f"Prepared converted file for response: {converted_filepath} ({file_size} bytes)")

        # Schedule deletion after response
        bg = BackgroundTask(delete_file_safe, converted_filepath)
        return FileResponse(
            converted_filepath,
            filename=converted_filename,
            media_type='application/octet-stream',
            background=bg
        )

    except Exception as e:
        print(f"Conversion error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Conversion failed: {str(e)}")
    finally:
        # Clean up the original uploaded file
        if 'temp_filepath' in locals() and os.path.exists(temp_filepath):
            try:
                os.remove(temp_filepath)
            except:
                pass

@router.post("/api/v1/test")
async def test_endpoint():
    return {"status": "test endpoint works"}

async def convert_file_backend(input_path: str, target_format: str, original_filename: str) -> str:
    """
    Convert file using appropriate backend tools
    """
    import time
    start_time = time.time()
    print(f"convert_file_backend called with: {input_path}, {target_format}, {original_filename}")
    file_extension = os.path.splitext(input_path)[1].lower()
    base_name = os.path.splitext(original_filename)[0]
    output_filename = f"{base_name}.{target_format}"
    output_path = os.path.join(CONVERTED_DIR, f"{datetime.now().timestamp()}_{output_filename}")
    print(f"Output path will be: {output_path}")

    try:
        if target_format.lower() in ['mp3', 'wav', 'ogg'] and file_extension in ['.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a']:
            # Audio format conversion
            print(f"Calling convert_audio_format for audio conversion")
            return await convert_audio_format(input_path, output_path, target_format)

        elif target_format.lower() in ['mp3', 'wav', 'ogg'] and file_extension in ['.mp4', '.avi', '.mov', '.mkv', '.wmv', '.webm']:
            # Video to Audio conversion
            return await convert_video_to_audio(input_path, output_path, target_format)

        elif target_format.lower() in ['jpg', 'jpeg', 'png', 'webp', 'bmp'] and file_extension in ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff']:
            # Image format conversion
            return await convert_image_format(input_path, output_path, target_format)

        elif target_format.lower() == 'pdf':
            # Convert to PDF
            return await convert_to_pdf(input_path, output_path, original_filename)

        elif target_format.lower() == 'txt':
            # Convert to text
            return await convert_to_text(input_path, output_path, original_filename)

        elif target_format.lower() == 'zip':
            # Create ZIP archive
            return await convert_to_zip(input_path, output_path, original_filename)

        else:
            raise Exception(f"Conversion from {file_extension} to {target_format} not supported")

    except Exception as e:
        print(f"Conversion error in convert_file_backend: {e}")
        raise
    finally:
        end_time = time.time()
        print(f"convert_file_backend completed in {end_time - start_time:.2f} seconds")

async def convert_video_to_audio(input_path: str, output_path: str, format: str) -> str:
    """Convert video to audio using ffmpeg"""
    try:
        # Check if input file exists
        if not os.path.exists(input_path):
            quiz_logger.error(f"Input video file does not exist: {input_path}")
            raise Exception(f"Input video file does not exist: {input_path}")

        # Check file size
        file_size = os.path.getsize(input_path)
        if file_size == 0:
            quiz_logger.error(f"Input video file is empty: {input_path}")
            raise Exception(f"Input video file is empty: {input_path}")

        quiz_logger.info(f"Converting video file: {input_path} ({file_size} bytes) to {format}")

        # Validate that this is actually a video file by checking with ffmpeg
        probe_cmd = ['ffmpeg', '-i', input_path, '-f', 'null', '-']
        probe_result = subprocess.run(probe_cmd, capture_output=True, text=True, timeout=30)
        if probe_result.returncode != 0:
            stderr_lower = probe_result.stderr.lower()
            if 'video' not in stderr_lower and 'audio' not in stderr_lower:
                quiz_logger.error(f"Input file does not appear to be a valid video file: {input_path}")
                raise Exception(f"Input file does not appear to be a valid video file: {input_path}")

        # Check if the video file actually has audio streams
        if 'audio' not in probe_result.stderr.lower():
            quiz_logger.error(f"Video file has no audio streams: {input_path}")
            raise Exception(f"Video file contains no audio tracks. Cannot convert to audio format.")

        # Audio codec mapping
        codec_map = {
            'mp3': 'libmp3lame',
            'wav': 'pcm_s16le',
            'ogg': 'libvorbis'
        }

        codec = codec_map.get(format.lower(), 'libmp3lame')

        cmd = [
            'ffmpeg', '-i', input_path,
            '-vn',  # No video
            '-acodec', codec,
            '-y',  # Overwrite output
        ]

        # Add quality settings for MP3
        if format.lower() == 'mp3':
            cmd.extend(['-b:a', '192k'])

        cmd.append(output_path)

        quiz_logger.info(f"FFmpeg command: {' '.join(cmd)}")
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)

        if result.returncode == 0 and os.path.exists(output_path):
            output_size = os.path.getsize(output_path)
            quiz_logger.info(f"Video to audio conversion successful: {output_path} ({output_size} bytes)")
            return output_path
        else:
            quiz_logger.error(f"FFmpeg failed with return code: {result.returncode}")
            quiz_logger.error(f"FFmpeg stdout: {result.stdout}")
            quiz_logger.error(f"FFmpeg stderr: {result.stderr}")
            raise Exception(f"Video to audio conversion failed: ffmpeg returned {result.returncode}")

    except subprocess.TimeoutExpired:
        quiz_logger.error("Video to audio conversion timeout (5 minutes)")
        raise Exception("Video to audio conversion timeout (5 minutes)")
    except FileNotFoundError:
        quiz_logger.error("FFmpeg not found - video conversion not available")
        raise Exception("FFmpeg not found - video conversion not available")
    except Exception as e:
        quiz_logger.error(f"Video to audio conversion error: {e}")
        raise

async def convert_audio_format(input_path: str, output_path: str, format: str) -> str:
    """Convert audio formats using ffmpeg"""
    try:
        print(f"Starting audio conversion: {input_path} -> {output_path} (format: {format})")

        # Check if input file exists
        if not os.path.exists(input_path):
            raise Exception(f"Input file does not exist: {input_path}")

        # Ensure output directory exists
        output_dir = os.path.dirname(output_path)
        os.makedirs(output_dir, exist_ok=True)
        print(f"Ensured output directory exists: {output_dir}")

        # Audio codec mapping for audio-to-audio conversion
        codec_map = {
            'mp3': 'libmp3lame',
            'wav': 'pcm_s16le',
            'ogg': 'libvorbis',
            'flac': 'flac',
            'aac': 'aac'
        }

        codec = codec_map.get(format.lower(), 'libmp3lame')
        print(f"Using codec: {codec}")

        # If input and output formats are the same (e.g., wav -> wav), just copy the file.
        input_ext = os.path.splitext(input_path)[1].lower().lstrip('.')
        if input_ext == format.lower():
            try:
                shutil.copy2(input_path, output_path)
                print(f"Input and output formats identical ({format}) - copied file to {output_path}")
                return output_path
            except Exception as e:
                print(f"Failed to copy identical-format file: {e}")
                # fallthrough to attempt conversion as a fallback

        # Build ffmpeg command for audio conversion
        cmd = [
            'ffmpeg', '-i', input_path,
            '-acodec', codec,
            '-y',  # Overwrite output
            output_path
        ]

        # Add format-specific options
        if format.lower() == 'mp3':
            cmd.insert(-1, '-b:a')  # Audio bitrate
            cmd.insert(-1, '192k')
        elif format.lower() == 'wav':
            cmd.insert(-1, '-f')  # Force format
            cmd.insert(-1, 'wav')
        elif format.lower() == 'ogg':
            cmd.insert(-1, '-f')  # Force format
            cmd.insert(-1, 'ogg')
            cmd.insert(-1, '-b:a')  # Audio bitrate
            cmd.insert(-1, '128k')

        print(f"FFmpeg command: {' '.join(cmd)}")

        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        except subprocess.TimeoutExpired:
            print("FFmpeg timed out for file:", input_path)
            raise Exception("Audio conversion timed out")
        except Exception as e:
            print(f"FFmpeg invocation error: {e}")
            raise

        print(f"FFmpeg return code: {result.returncode}")
        if result.stdout:
            print(f"FFmpeg stdout: {result.stdout}")
        if result.stderr:
            print(f"FFmpeg stderr: {result.stderr}")

        if result.returncode == 0 and os.path.exists(output_path):
            print(f"Audio conversion successful: {output_path}")
            return output_path
        else:
            error_msg = f"FFmpeg failed with return code {result.returncode}"
            if result.stderr:
                error_msg += f": {result.stderr.strip()}"
            print(f"FFmpeg audio conversion error: {error_msg}")
            raise Exception(f"Audio conversion failed: {error_msg}")

    except subprocess.TimeoutExpired:
        print("Audio conversion timeout")
        raise Exception("Audio conversion timeout - file may be too large or complex")
    except FileNotFoundError:
        print("FFmpeg not found")
        raise Exception("FFmpeg not available for audio conversion - please install ffmpeg")
    except Exception as e:
        print(f"Audio conversion error: {e}")
        raise

async def convert_image_format(input_path: str, output_path: str, format: str) -> str:
    """Convert image formats using Pillow"""
    try:
        with Image.open(input_path) as img:
            # Convert RGBA to RGB for formats that don't support transparency
            if format.lower() in ['jpg', 'jpeg'] and img.mode in ['RGBA', 'LA']:
                # Create a white background
                background = Image.new('RGB', img.size, (255, 255, 255))
                if img.mode == 'RGBA':
                    background.paste(img, mask=img.split()[-1])  # Use alpha channel as mask
                else:
                    background.paste(img)
                img = background

            # Save in the new format
            save_format = 'JPEG' if format.lower() in ['jpg', 'jpeg'] else format.upper()
            img.save(output_path, format=save_format, quality=95 if format.lower() in ['jpg', 'jpeg'] else None)

        return output_path

    except Exception as e:
        print(f"Image conversion error: {e}")
        raise Exception(f"Image conversion failed: {str(e)}")

async def convert_to_pdf(input_path: str, output_path: str, original_filename: str) -> str:
    """Convert various formats to PDF"""
    try:
        from reportlab.pdfgen import canvas
        from reportlab.lib.pagesizes import letter

        c = canvas.Canvas(output_path, pagesize=letter)
        width, height = letter

        file_extension = os.path.splitext(input_path)[1].lower()

        if file_extension in ['.jpg', '.jpeg', '.png', '.gif', '.bmp']:
            # Image to PDF
            try:
                with Image.open(input_path) as img:
                    # Convert to RGB if necessary
                    if img.mode != 'RGB':
                        img = img.convert('RGB')

                    # Calculate dimensions to fit page
                    img_width, img_height = img.size
                    aspect = img_height / img_width

                    # Fit image to page with margins
                    max_width = width - 100
                    max_height = height - 100

                    if img_width > max_width:
                        new_width = max_width
                        new_height = new_width * aspect
                    else:
                        new_width = img_width
                        new_height = img_height

                    if new_height > max_height:
                        new_height = max_height
                        new_width = new_height / aspect

                    # Save image temporarily for reportlab
                    temp_img_path = input_path + "_temp.jpg"
                    img.save(temp_img_path, "JPEG", quality=95)

                    # Add image to PDF
                    x = (width - new_width) / 2
                    y = (height - new_height) / 2
                    c.drawImage(temp_img_path, x, y, width=new_width, height=new_height)

                    # Clean up temp image
                    if os.path.exists(temp_img_path):
                        os.remove(temp_img_path)

            except Exception as img_error:
                print(f"Image to PDF error: {img_error}")
                raise

        elif file_extension in ['.txt', '.md', '.csv']:
            # Text to PDF
            try:
                with open(input_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()

                # Add text to PDF
                textobject = c.beginText(50, height - 50)
                textobject.setFont("Helvetica", 12)

                # Split content into lines and add to PDF
                lines = content.split('\n')
                for line in lines[:100]:  # Limit to first 100 lines
                    textobject.textLine(line[:80])  # Limit line length

                c.drawText(textobject)

            except Exception as text_error:
                print(f"Text to PDF error: {text_error}")
                raise

        else:
            # Generic file info PDF
            c.drawString(50, height - 50, f"File: {original_filename}")
            c.drawString(50, height - 80, f"Size: {os.path.getsize(input_path)} bytes")
            c.drawString(50, height - 110, f"Type: {file_extension}")
            c.drawString(50, height - 140, f"Converted: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

        c.save()
        return output_path

    except ImportError:
        # Fallback without reportlab
        with open(output_path, 'w') as f:
            f.write(f"PDF Conversion Info\n\nOriginal File: {original_filename}\n")
            f.write(f"Size: {os.path.getsize(input_path)} bytes\n")
            f.write(f"Converted: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        return output_path
    except Exception as e:
        print(f"PDF conversion error: {e}")
        raise

async def convert_to_text(input_path: str, output_path: str, original_filename: str) -> str:
    """Convert various formats to text"""
    try:
        file_extension = os.path.splitext(input_path)[1].lower()

        if file_extension in ['.txt', '.md', '.csv', '.json', '.html', '.css', '.js']:
            # Text-based files
            with open(input_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
        else:
            # Binary or other files - create info text
            stat_info = os.stat(input_path)
            content = f"""File Conversion Report
=====================

Original File: {original_filename}
File Size: {stat_info.st_size} bytes
File Type: {file_extension}
Created: {datetime.fromtimestamp(stat_info.st_ctime).strftime('%Y-%m-%d %H:%M:%S')}
Modified: {datetime.fromtimestamp(stat_info.st_mtime).strftime('%Y-%m-%d %H:%M:%S')}
Converted: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

Note: This file was converted from a binary format to text.
The original content cannot be represented as readable text.
"""

        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(content)

        return output_path

    except Exception as e:
        print(f"Text conversion error: {e}")
        raise

async def convert_to_zip(input_path: str, output_path: str, original_filename: str) -> str:
    """Create a ZIP archive containing the file"""
    try:
        with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            zipf.write(input_path, original_filename)

        return output_path

    except Exception as e:
        print(f"ZIP conversion error: {e}")
        raise

# Clean up endpoint
@router.post("/convert/cleanup")
async def cleanup_conversion_files():
    """Manually trigger cleanup of temporary files"""
    try:
        cleanup_temp_files()
        return {"message": "Cleanup completed"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cleanup failed: {str(e)}")

# ----------------------------------------------------
# Video Converter Endpoints (only if yt-dlp is available)
# ----------------------------------------------------

if VIDEO_CONVERTER_AVAILABLE:
    # Map normalized URL -> download_id for coalescing concurrent requests
    # Each mapping's value will be a dict: {'download_id': str, 'refcount': int}
    active_url_map = {}

    #  OPTIMIZED: Retry configuration from environment (faster defaults)
    try:
        YTDL_MAX_RETRIES = int(os.environ.get('YTDL_MAX_RETRIES', '8'))
    except Exception:
        YTDL_MAX_RETRIES = 8  # Reduced from 10 to 8 for faster failures
    # By default, don't retry forever - use reasonable max attempts
    if 'YTDL_RETRY_FOREVER' in os.environ:
        YTDL_RETRY_FOREVER = os.environ.get('YTDL_RETRY_FOREVER', 'false').lower() in ('1', 'true', 'yes')
    else:
        YTDL_RETRY_FOREVER = False
    try:
        YTDL_BACKOFF_BASE = float(os.environ.get('YTDL_BACKOFF_BASE', '1.5'))
    except Exception:
        YTDL_BACKOFF_BASE = 1.5  # Reduced from 2.0 for faster retries
    try:
        YTDL_BACKOFF_MAX = float(os.environ.get('YTDL_BACKOFF_MAX', '5.0'))
    except Exception:
        YTDL_BACKOFF_MAX = 5.0  # Reduced from 30.0 to 5.0 for faster processing
    #  CRITICAL FIX: Use ThreadPoolExecutor to allow shared memory for status updates
    # ProcessPoolExecutor doesn't share memory, so status updates are lost!
    try:
        WORKER_POOL_SIZE = int(os.environ.get('YTDL_WORKER_POOL_SIZE', '12'))  # Threads can handle more concurrent downloads
    except Exception:
        WORKER_POOL_SIZE = 12

    # Create thread pool for video downloads (threads share memory with main process)
    # This ensures status updates in active_video_downloads are visible to the main process
    video_process_pool = ThreadPoolExecutor(
        max_workers=WORKER_POOL_SIZE,
        thread_name_prefix="video_download"
    )
    video_logger.info(f"[OK] Video conversion thread pool initialized with {WORKER_POOL_SIZE} workers")

    #  WATCHDOG: Monitor and kill stuck downloads
    def watchdog_monitor():
        """Background thread that monitors downloads for timeouts and stalls"""
        global watchdog_running
        watchdog_running = True
        video_logger.info("Watchdog monitor started")

        while watchdog_running:
            try:
                time.sleep(30)  # Check every 30 seconds
                current_time = time.time()

                with download_lock:
                    stuck_downloads = []
                    for download_id, entry in list(active_video_downloads.items()):
                        # Skip completed/errored downloads
                        if entry.get('finished') or entry.get('status') in ['completed', 'error']:
                            continue

                        start_time = entry.get('start_time', 0)
                        last_update = entry.get('last_progress_update', start_time)

                        # Check if download exceeded max time
                        if start_time > 0 and (current_time - start_time) > DOWNLOAD_TIMEOUT_SECONDS:
                            stuck_downloads.append((download_id, 'timeout', current_time - start_time))
                        # Check if download stalled (no progress updates)
                        elif last_update > 0 and (current_time - last_update) > DOWNLOAD_STALL_TIMEOUT:
                            stuck_downloads.append((download_id, 'stalled', current_time - last_update))

                    # Kill stuck downloads
                    for download_id, reason, duration in stuck_downloads:
                        video_logger.warning(f" Watchdog killing stuck download {download_id}: {reason} ({duration:.0f}s)")
                        entry = active_video_downloads.get(download_id)
                        if entry:
                            entry['status'] = 'error'
                            entry['error'] = f'Download {reason} - exceeded time limit'
                            entry['finished'] = True

            except Exception as e:
                video_logger.error(f"Watchdog error: {e}")

        video_logger.info(" Watchdog monitor stopped")

    # Start watchdog thread
    watchdog_thread = threading.Thread(target=watchdog_monitor, daemon=True, name='watchdog')
    watchdog_thread.start()

    # Thread pool dedicated to long video conversions (separate capacity)
    try:
        LONG_WORKER_POOL_SIZE = int(os.environ.get('LONG_VIDEO_WORKER_POOL_SIZE', '2'))
    except Exception:
        LONG_WORKER_POOL_SIZE = 2

    long_video_process_pool = ThreadPoolExecutor(
        max_workers=LONG_WORKER_POOL_SIZE,
        thread_name_prefix="video_long"
    )
    video_logger.info(f"[OK] Long-video conversion thread pool initialized with {LONG_WORKER_POOL_SIZE} workers")
    # Queue dispatcher: waits for an event and calls process_next_in_queue while capacity exists
    def queue_dispatcher():
        video_logger.info("Queue dispatcher thread running")
        while True:
            try:
                # Wait until there's work to do
                dispatcher_event.wait()
                video_logger.debug("Dispatcher event received; scanning queue")
                # Attempt to process queued items while capacity and items exist
                while True:
                    with queue_lock:
                        if not video_conversion_queue:
                            break
                    if not (can_start_conversion(False) or can_start_conversion(True)):
                        break
                    try:
                        process_next_in_queue()
                    except Exception as e:
                        video_logger.error(f"queue_dispatcher error calling process_next_in_queue: {e}")
                        break
                    # small pause to yield
                    time.sleep(0.05)
            except Exception as e:
                video_logger.error(f"Queue dispatcher encountered error: {e}")
            finally:
                try:
                    dispatcher_event.clear()
                except Exception:
                    pass
            # prevent tight loop
            time.sleep(0.1)

    # Start dispatcher thread once
    try:
        dispatcher_thread = threading.Thread(target=queue_dispatcher, daemon=True, name='queue_dispatcher')
        dispatcher_thread.start()
        video_logger.info("Queue dispatcher thread initialized")
        # Trigger initial scan in case there are pre-existing queued items
        dispatcher_event.set()
    except Exception as e:
        video_logger.warning(f"Failed to start queue dispatcher: {e}")

    # Async wrapper to submit downloads to thread pool
    async def submit_video_download_async(download_id: str, url: str, format_type: str, quality: int, output_path: str, client_ip: str = None, chunk_index: int = None, chunk_start: int = None, chunk_end: int = None):
        """Submit video download to process pool and handle completion asynchronously

        Note: accepts long/short job routing via `is_long` in kwargs when used.
        """
        loop = asyncio.get_event_loop()
        def completion_callback(future, is_long=False):
            """Handle download completion in background thread"""
            try:
                result = future.result()
                video_logger.info(f"Download {download_id} completed: {result}")
                decrement_active_conversions(is_long=is_long)
                decrement_video_rate_limit(client_ip)
                # Process next in queue
                process_next_in_queue()
            except Exception as e:
                video_logger.error(f"Download {download_id} failed: {e}")
                decrement_active_conversions(is_long=is_long)
                decrement_video_rate_limit(client_ip)
                with download_lock:
                    if download_id in active_video_downloads:
                        active_video_downloads[download_id]['status'] = 'error'
                        active_video_downloads[download_id]['error'] = str(e)
                # Process next in queue even on error
                process_next_in_queue()

        # Submit to process pool (non-blocking) - default to short pool
        fut = video_process_pool.submit(
            download_video_background,
            download_id, url, format_type, quality, output_path, client_ip, chunk_index, chunk_start, chunk_end
        )
        # Attach wrapper to call our completion with is_long=False
        fut.add_done_callback(lambda f: completion_callback(f, is_long=False))
        return fut

    # Helper function for background video download
    def download_video_background(download_id: str, url: str, format_type: str, quality: int, output_path: str, client_ip: str = None, chunk_index: int = None, chunk_start: int = None, chunk_end: int = None):
        """Background function to download and convert video - includes rate limit cleanup and timeout protection"""
        video_logger.info(f"IP: {client_ip or 'Unknown'} | Starting: {url}")

        # Apply throttling and random delay to mimic human behavior (anti-bot measure)
        throttle_youtube_request()

        start_time = time.time()

        def progress_hook(d):
            if d['status'] == 'downloading':
                try:
                    progress = 0.0
                    if d.get('total_bytes'):
                        progress = (d['downloaded_bytes'] / d['total_bytes']) * 100
                    elif d.get('total_bytes_estimate'):
                        progress = (d['downloaded_bytes'] / d['total_bytes_estimate']) * 100

                    with download_lock:
                        if download_id in active_video_downloads:
                            active_video_downloads[download_id]['progress'] = min(progress, 90.0)
                            active_video_downloads[download_id]['status'] = 'downloading'
                            active_video_downloads[download_id]['last_progress_update'] = time.time()
                except Exception as progress_error:
                    pass  # Silent progress errors
            elif d['status'] == 'finished':
                with download_lock:
                    if download_id in active_video_downloads:
                        active_video_downloads[download_id]['progress'] = 95.0
                        active_video_downloads[download_id]['status'] = 'processing'
                        active_video_downloads[download_id]['last_progress_update'] = time.time()

        # Initialize cookiefile variable at function scope
        cookiefile = None
        temp_cookie_file = None
        skip_normal_download = False  # Initialize flag to avoid UnboundLocalError

        try:
            # Update status with timeout tracking
            with download_lock:
                if download_id in active_video_downloads:
                    active_video_downloads[download_id]['status'] = 'downloading'
                    active_video_downloads[download_id]['start_time'] = start_time
                    active_video_downloads[download_id]['last_progress_update'] = start_time

            # ️ TIMEOUT CHECK: Abort if download takes too long
            def check_timeout():
                elapsed = time.time() - start_time
                if elapsed > DOWNLOAD_TIMEOUT_SECONDS:
                    raise TimeoutError(f"Download exceeded maximum time limit of {DOWNLOAD_TIMEOUT_SECONDS}s")

            # Get yt-dlp options with full metadata support
            cookie_file = get_cached_cookie_file()
            ydl_opts = get_ydl_opts(format_type, quality, output_path, cookie_file=cookie_file, use_invidious=False, invidious_instance=None)
            ydl_opts['progress_hooks'] = [progress_hook]

            # Safer extract_info + download flow with persistent retry loop on transient 403s
            # ️ Check timeout before starting
            check_timeout()

            # Apply human-like timing before extraction (additional anti-bot measure)
            throttle_youtube_request()

            # Extract info without downloading first to get metadata
            info = {}
            title = 'Unknown'
            try:
                # Try to extract info with minimal options to avoid bot detection
                info_opts = ydl_opts.copy()
                info_opts['writethumbnail'] = False  # Don't download thumbnail during info extraction
                info_opts['skip_download'] = True
                with yt_dlp.YoutubeDL(info_opts) as ydl:
                    info = ydl.extract_info(url, download=False)
                    title = info.get('title', 'Unknown') if info else 'Unknown'
            except Exception as info_err:
                video_logger.warning(f"Could not extract info before download: {info_err}")
                # Continue anyway - we'll get info during download
                info = {}  # Ensure info is a dict, not None

            # ️ Check timeout after extraction
            check_timeout()

            #  SIZE/DURATION CHECKS: Prevent massive downloads
            filesize = info.get('filesize') or info.get('filesize_approx', 0) if info else 0
            duration = info.get('duration', 0) if info else 0

            #  CHUNKING: Check if this is a chunk request (legacy support)
            is_chunk_request = chunk_start is not None and chunk_end is not None

            if is_chunk_request:
                # Processing a specific time range chunk (legacy)
                video_logger.info(
                    f" Processing chunk {chunk_index or '?'}: "
                    f"{chunk_start}s - {chunk_end}s ({(chunk_end - chunk_start)/60:.1f} minutes)"
                )
                needs_adaptive_quality = False
            else:
                # Adaptive quality removed: always keep the requested quality
                needs_adaptive_quality = False
                original_quality = quality

            # Hard limits - reject if too large even after quality reduction
            if filesize > MAX_VIDEO_FILESIZE:
                size_mb = filesize / (1024 * 1024)
                size_gb = filesize / (1024 * 1024 * 1024)
                raise ValueError(
                    f"Video file size ({size_gb:.2f}GB / {size_mb:.0f}MB) exceeds maximum allowed size "
                    f"({MAX_VIDEO_FILESIZE / (1024 * 1024):.0f}MB). "
                    f"Try a lower quality setting or shorter video."
                )

            # Allow long videos to be routed to the long-video pool.
            # Only reject videos that exceed an absolute cap (MAX_ALLOWED_VIDEO_DURATION).
            if duration > MAX_ALLOWED_VIDEO_DURATION:
                minutes = duration / 60
                raise ValueError(
                    f"Video duration ({minutes:.1f} minutes) exceeds absolute maximum allowed "
                    f"({MAX_ALLOWED_VIDEO_DURATION / 60:.0f} minutes). Please try a shorter video."
                )

            # Warnings - log if approaching limits
            if filesize > WARN_VIDEO_FILESIZE:
                size_mb = filesize / (1024 * 1024)
                video_logger.warning(
                    f"Large video detected: {size_mb:.1f}MB (duration: {duration/60:.1f}min). "
                    f"Download may be slow or fail."
                )

            # Check if video is age-restricted and reconfigure if needed
            if info.get('age_limit', 0) > 0:
                is_age_restricted = True
                ydl_opts = get_ydl_opts(format_type, quality, output_path, is_age_restricted)
                ydl_opts['progress_hooks'] = [progress_hook]

            with download_lock:
                if download_id in active_video_downloads:
                    active_video_downloads[download_id]['title'] = title

            # Prepare proxies list
            proxy_env = os.environ.get('YTDL_PROXY')
            proxy_list_env = os.environ.get('YTDL_PROXY_LIST')
            proxies_to_try = []
            if proxy_list_env:
                proxies_to_try = [p.strip() for p in proxy_list_env.split(',') if p.strip()]
            elif proxy_env:
                proxies_to_try = [proxy_env.strip()]

            # Per-download override for proxy and cookiefile
            per_download_proxy = None
            per_download_cookie = None
            with download_lock:
                entry = active_video_downloads.get(download_id, {})
                per_download_proxy = entry.get('proxy')
                per_download_cookie = entry.get('cookiefile') or entry.get('cookie_file')
            if per_download_proxy:
                # prefer per-download proxy first
                proxies_to_try.insert(0, per_download_proxy)
            if per_download_cookie and os.path.exists(per_download_cookie):
                cookiefile = per_download_cookie

            # Cookiefile if provided (check cached file first, then per-download)
            cookiefile = get_cached_cookie_file()  # Use the cached cookie file function
            if per_download_cookie and os.path.exists(per_download_cookie):
                cookiefile = per_download_cookie  # Per-download cookie takes priority

            #  OPTIMIZATION: Try direct download first, use Invidious as fallback
            # This avoids issues with Invidious returning error pages
            invidious_success = False
            if not cookiefile:
                video_logger.info(" No cookies found - will try direct download first, Invidious as fallback")
            else:
                video_logger.info(" Cookies available - trying direct download")

            #  ADAPTIVE QUALITY: If quality was reduced, log it
            if needs_adaptive_quality:
                video_logger.info(
                    f" Adaptive quality applied: reduced to {quality} "
                    f"from original {original_quality}"
                )

            #  CHUNK REQUEST: Process specific time range (legacy support)
            if is_chunk_request:
                video_logger.info(f" Processing chunk request: {chunk_start}s to {chunk_end}s")

                # Modify output path to include chunk index
                if chunk_index:
                    output_path = output_path.replace('.%(ext)s', f'_part{chunk_index:02d}.%(ext)s')

                # Configure yt-dlp with time range postprocessor
                chunk_opts = get_ydl_opts(format_type, quality, output_path)
                chunk_opts['postprocessor_args'] = [
                    '-ss', str(chunk_start),
                    '-to', str(chunk_end),
                    '-c', 'copy'  # Copy codec (fast, no re-encoding)
                ]
                if cookiefile and os.path.exists(cookiefile):
                    chunk_opts['cookiefile'] = cookiefile

                # Download the chunk
                try:
                    with yt_dlp.YoutubeDL(chunk_opts) as ydl:
                        ydl.download([url])

                    video_logger.info(f" Chunk {chunk_index} downloaded successfully")
                    last_exception = None

                except Exception as chunk_error:
                    video_logger.error(f" Chunk {chunk_index} failed: {chunk_error}")
                    raise

                # Skip normal download logic
                skip_normal_download = True
            # No else needed - skip_normal_download is already False

            attempt = 0
            last_exception = None
            consecutive_403s = 0
            unavailable_attempts = 0
            VIDEO_UNAVAILABLE_RETRIES = int(os.environ.get('VIDEO_UNAVAILABLE_RETRIES', '3'))
            # Determine effective max attempts - up to 10 retries for transient errors
            #  OPTIMIZED: Reduced from 30 to 10 for faster failure detection
            # Previously unavailable/deleted videos quit immediately; now we retry a
            # few times because yt-dlp can sometimes report false 'video unavailable' errors.
            effective_max = min(10, max(1, YTDL_MAX_RETRIES)) if not YTDL_RETRY_FOREVER else 10

            # Skip retry loop if Invidious already succeeded OR chunking metadata OR chunk completed
            def get_valid_downloaded_files(output_path: str, format_type: str) -> list[str]:
                """Get list of valid downloaded media files, filtering out HTML error pages and temp files"""
                base_pattern = os.path.basename(output_path.replace('.%(ext)s', ''))
                temp_dir = os.path.dirname(output_path)

                # Skip these extensions (temporary/metadata files)
                skip_extensions = ('.ytdl', '.part', '.temp', '.tmp', '.download', '.aria2', '.f')
                # Skip HTML/MHTML files (error pages from YouTube)
                html_extensions = ('.html', '.mhtml', '.htm')

                valid_files = []
                try:
                    all_files = os.listdir(temp_dir)
                except:
                    return []

                for filename in all_files:
                    if not filename.startswith(base_pattern):
                        continue

                    # Skip temporary and metadata files
                    if any(filename.endswith(ext) for ext in skip_extensions):
                        continue

                    # Skip HTML files
                    if any(filename.endswith(ext) for ext in html_extensions):
                        continue

                    # Skip files smaller than 1KB
                    file_path = os.path.join(temp_dir, filename)
                    try:
                        if os.path.getsize(file_path) < 1024:
                            continue
                    except:
                        continue

                    # Validate content
                    if not is_valid_media_file(file_path):
                        continue

                    valid_files.append(file_path)

                return valid_files

            if not (not cookiefile and invidious_success) and not skip_normal_download:
                while True:
                    attempt += 1

                    # Check if we've exceeded max attempts
                    if effective_max and attempt > effective_max:
                        break

                    try:
                        # ️ Check timeout before each retry attempt
                        check_timeout()

                        # Throttle requests to avoid overwhelming YouTube
                        throttle_youtube_request()

                        # Refresh yt-dlp options with new user agent for each attempt
                        ydl_opts = get_ydl_opts(format_type, quality, output_path)
                        ydl_opts['progress_hooks'] = [progress_hook]

                        #  OPTIMIZATION: Skip browser cookie extraction entirely
                        # It's slow, unreliable, and Invidious works better
                        # Only use if explicitly provided via cookiefile

                        # Use cookie file if available
                        if cookiefile and os.path.exists(cookiefile):
                            ydl_opts['cookiefile'] = cookiefile

                        video_logger.info(f"Attempt {attempt}/{effective_max} for {url}")

                        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                            result = ydl.download([url])
                            video_logger.info(f"yt-dlp download result: {result}")

                            # Try to get info after successful download if we don't have it
                            if not info:
                                try:
                                    info = ydl.extract_info(url, download=False)
                                except:
                                    pass  # Info not critical if download succeeded

                        # Validate that actual media files were downloaded (not HTML error pages)
                        valid_files = get_valid_downloaded_files(output_path, format_type)
                        if not valid_files:
                            video_logger.error(f"Download attempt {attempt} failed: yt-dlp reported success but no valid media files found (likely HTML error page)")
                            # Continue to next retry attempt
                            continue

                        # Success - valid media files found
                        video_logger.info(f"Download attempt {attempt} succeeded")
                        last_exception = None
                        break
                    except Exception as de:
                        derr = str(de)
                        last_exception = de
                        video_logger.error(f"Download attempt {attempt} failed: {derr}")

                        #  CRITICAL: Check for UNRECOVERABLE errors - quit immediately
                        is_unavailable = any(keyword in derr.lower() for keyword in [
                            'video unavailable',
                            'this video is unavailable',
                            'video has been removed',
                            'video is not available',
                            'this video has been deleted',
                            'this video does not exist',
                            'video is private',
                            'members-only content',
                            'join this channel',
                            'premium content',
                            'video not found',
                            'account has been terminated',
                            'account associated with this video has been terminated'
                        ])

                        # Check if we need cookies (403/age-restricted)
                        needs_cookies = any(keyword in derr.lower() for keyword in [
                            '403', 'forbidden', 'age-restricted', 'sign in'
                        ])
                        if needs_cookies and not cookiefile:
                            video_logger.warning(
                                "🍪 Download blocked - browser cookies recommended! "
                                "Export cookies.txt from your browser while logged into YouTube."
                            )

                        #  OPTIMIZATION: Check for sign-in required errors (try fallbacks before giving up)
                        is_sign_in_required = any(keyword in derr.lower() for keyword in [
                            'sign in to confirm',
                            'sign in to confirm your age',
                            'this video may be inappropriate',
                            'use --cookies-from-browser',
                            'use --cookies for the authentication'
                        ])

                        # Detect 403-like errors early in the exception handler
                        is_403_like = ('403' in derr or 'forbidden' in derr.lower() or 'http error 403' in derr.lower() or 'unable to download video data' in derr.lower())

                        # Don't fail immediately - try Invidious fallback first
                        if is_sign_in_required:
                            is_403_like = True  # Treat as 403-like error (set FIRST)
                            video_logger.warning(f"Sign-in required error detected, setting is_403_like=True")

                        # Check for YouTube rate limiting
                        is_rate_limited = any(keyword in derr.lower() for keyword in [
                            'rate-limited',
                            'rate limited',
                            'too many requests',
                            '429',
                            'try again later'
                        ])

                        if is_rate_limited:
                            error_msg = 'YouTube rate limit exceeded. Try: 1) Adding YouTube cookies (logged-in account), 2) Waiting 10-60 minutes, 3) Using a different IP/VPN'
                            with download_lock:
                                if download_id in active_video_downloads:
                                    active_video_downloads[download_id].update({
                                        'status': 'error',
                                        'error': error_msg,
                                        'error_type': 'rate_limit',
                                        'finished': True
                                    })
                            raise Exception(error_msg)

                        if is_unavailable:
                            # Sometimes yt-dlp returns transient 'video unavailable' errors.
                            # Retry a few times before giving up to avoid false negatives.
                            unavailable_attempts += 1
                            if unavailable_attempts < VIDEO_UNAVAILABLE_RETRIES:
                                video_logger.warning(
                                    f"Transient 'video unavailable' detected for {download_id} (attempt {unavailable_attempts}/{VIDEO_UNAVAILABLE_RETRIES}). Retrying..."
                                )
                                try:
                                    time.sleep(min(1 * attempt, 5))
                                except Exception:
                                    pass
                                # Continue to next while iteration (retry)
                                continue
                            # Exhausted retries: mark as unavailable and exit
                            with download_lock:
                                if download_id in active_video_downloads:
                                    active_video_downloads[download_id].update({
                                        'status': 'error',
                                        'error': 'Video is unavailable, private, or has been removed',
                                        'error_type': 'unavailable',
                                        'finished': True
                                    })
                            raise Exception('Video is unavailable, private, or has been removed')

                        # Detect browser cookie errors - stop trying browser extraction
                        is_browser_error = ('could not find' in derr.lower() and 'cookies database' in derr.lower())
                        if is_browser_error and attempt == 1:
                            # Try immediately with Invidious on next attempt
                            is_403_like = True  # Treat as 403-like

                        # Update 403 counter AFTER all checks
                        if is_403_like:
                            consecutive_403s += 1
                            video_logger.info(f"403-like error detected, consecutive_403s now: {consecutive_403s}")
                            # If we get too many consecutive 403s, it's likely not a transient issue
                        else:
                            consecutive_403s = 0  # Reset counter for non-403 errors

                    # CRITICAL: Always use cookies on first 403, not just attempt <= 2
                    tried_cookie = False
                    if is_403_like and cookiefile and os.path.exists(cookiefile) and attempt <= 5:
                        try:
                            retry_opts = get_ydl_opts(format_type, quality, output_path)
                            retry_opts['cookiefile'] = cookiefile
                            retry_opts['progress_hooks'] = [progress_hook]
                            with yt_dlp.YoutubeDL(retry_opts) as ydl:
                                ydl.download([url])
                            last_exception = None
                            break
                        except Exception as cookie_err:
                            tried_cookie = True

                    # Try rotating proxies FIRST (higher priority than just cookies)
                    proxy_succeeded = False
                    if is_403_like and proxies_to_try and attempt <= 7:
                        for proxy in proxies_to_try:
                            try:
                                retry_opts2 = get_ydl_opts(format_type, quality, output_path)
                                retry_opts2['proxy'] = proxy
                                # Use cookies WITH proxy for best results
                                if cookiefile and os.path.exists(cookiefile):
                                    retry_opts2['cookiefile'] = cookiefile
                                retry_opts2['progress_hooks'] = [progress_hook]
                                with yt_dlp.YoutubeDL(retry_opts2) as ydl:
                                    ydl.download([url])
                                proxy_succeeded = True
                                last_exception = None
                                break
                            except Exception as proxy_err:
                                # small backoff between proxy attempts
                                time.sleep(min(1.0, YTDL_BACKOFF_BASE))
                        if proxy_succeeded:
                            break

                    # LAYER 3: Try Invidious fallback if browser cookies failed or persistent 403s
                    # Trigger immediately on browser error (consecutive_403s set to 3) or after 3 real 403s
                    video_logger.info(f"🔍 Fallback check: is_browser_error={is_browser_error if 'is_browser_error' in locals() else False}, is_403_like={is_403_like if 'is_403_like' in locals() else False}, consecutive_403s={consecutive_403s}, attempt={attempt}")
                    if (is_browser_error or is_403_like or is_sign_in_required) and consecutive_403s >= 3 and attempt <= 8:
                        video_logger.info(f"🌐 Attempting Invidious fallback for {url}")
                        invidious_success, invidious_info, invidious_error = try_invidious_download(
                            url, format_type, quality, output_path, VIDEO_DOWNLOAD_DIR, INVIDIOUS_INSTANCES, cookiefile
                        )
                        video_logger.info(f"🌐 Invidious result: success={invidious_success}, error={invidious_error}")
                        if invidious_success:
                            video_logger.info("✅ Invidious download succeeded!")
                            last_exception = None
                            # Get info from Invidious if we don't have it
                            if not info and invidious_info:
                                info = invidious_info
                            break
                        else:
                            video_logger.warning(f"❌ Invidious fallback failed: {invidious_error}")

                    # Check retry limits
                    if effective_max is not None and attempt >= effective_max:
                        break

                    #  OPTIMIZED: Faster backoff for quicker processing
                    # Smart backoff: if we're getting repeated errors, increase backoff
                    # BUT: Skip long backoff if browser cookies just failed (jump to Invidious immediately)
                    if is_browser_error and attempt == 1:
                        sleep_for = 0.2  # Minimal delay before trying Invidious
                    elif consecutive_403s >= 3:
                        backoff = min(5.0, YTDL_BACKOFF_BASE * (2 ** (attempt - 1)))  # Cap at 5s instead of 30s
                        jitter = random.uniform(0, backoff * 0.2)
                        sleep_for = backoff + jitter
                    else:
                        backoff = min(5.0, YTDL_BACKOFF_BASE * (2 ** max(0, attempt - 2)))  # Start smaller, cap at 5s
                        jitter = random.uniform(0, backoff * 0.2)
                        sleep_for = backoff + jitter

                    time.sleep(sleep_for)

                    # If retry-forever is enabled, continue looping; otherwise loop until attempts exhausted
                    if not YTDL_RETRY_FOREVER and effective_max is not None and attempt >= effective_max:
                        # Max attempts reached
                        break

            # Find the downloaded file
            downloaded_file = None
            base_pattern = output_path.replace('.%(ext)s', '')

            # Collect candidates that start with the base pattern
            candidates = []
            video_logger.info(f"Looking for downloaded file in {VIDEO_DOWNLOAD_DIR}")
            video_logger.info(f"Base pattern: {os.path.basename(base_pattern)}")

            try:
                all_files = os.listdir(VIDEO_DOWNLOAD_DIR)
                video_logger.info(f"Files in directory: {all_files}")
            except Exception as list_err:
                video_logger.error(f"Error listing directory: {list_err}")
                all_files = []

            # Skip these extensions (temporary/metadata files)
            skip_extensions = ('.ytdl', '.part', '.temp', '.tmp', '.download', '.aria2', '.f')
            # Skip HTML/MHTML files (error pages from YouTube)
            html_extensions = ('.html', '.mhtml', '.htm')

            for filename in all_files:
                if filename.startswith(os.path.basename(base_pattern)):
                    # Skip temporary and metadata files
                    if any(filename.endswith(ext) for ext in skip_extensions):
                        video_logger.debug(f"Skipping temporary/metadata file: {filename}")
                        continue
                    # Skip HTML files (these are error pages, not media)
                    if any(filename.endswith(ext) for ext in html_extensions):
                        video_logger.warning(f"Skipping HTML error page: {filename}")
                        continue
                    # Skip files smaller than 1KB (likely corrupted)
                    file_path = os.path.join(VIDEO_DOWNLOAD_DIR, filename)
                    try:
                        file_size = os.path.getsize(file_path)
                        if file_size < 1024:
                            video_logger.warning(f"Skipping tiny file {filename} ({file_size} bytes)")
                            continue
                    except:
                        continue

                    # Validate file content - check if it's actually a media file, not HTML
                    if not is_valid_media_file(file_path):
                        video_logger.warning(f"Skipping invalid media file (likely HTML error page): {filename}")
                    else:
                        candidates.append(file_path)
                        video_logger.info(f"Found candidate: {filename}")

            # Prefer actual audio/video files over thumbnails (e.g., .webp)
            if candidates:
                # Define priority extensions depending on format requested
                if format_type == 'audio':
                    priority_exts = ['.mp3', '.m4a', '.opus', '.webm', '.mka', '.aac']
                else:
                    priority_exts = ['.mp4', '.mkv', '.webm', '.mov', '.flv']

                chosen = None
                for ext in priority_exts:
                    for path in candidates:
                        if path.lower().endswith(ext):
                            chosen = path
                            break
                    if chosen:
                        break

                # Fallback to any candidate if no prioritized ext matched
                if not chosen:
                    # If we only have image files, this is a failed download
                    image_files = [p for p in candidates if p.lower().endswith(('.jpg', '.jpeg', '.png', '.webp', '.gif'))]
                    if len(image_files) == len(candidates):
                        # All candidates are images - this means the download failed
                        video_logger.error(f"Download failed - only image/thumbnail files found: {candidates}")
                        raise ValueError(
                            "Download failed - YouTube blocked the download and only thumbnails were retrieved. "
                            "This usually means your IP is rate-limited or requires authentication. "
                            "Try: 1) Adding browser cookies from YouTube, 2) Waiting 10-15 minutes, 3) Using a VPN"
                        )
                    chosen = candidates[0]

                downloaded_file = chosen
                video_logger.info(f"Selected file: {downloaded_file}")
            else:
                # Check if HTML files exist (error case)
                html_files = [f for f in all_files if f.startswith(os.path.basename(base_pattern)) and any(f.endswith(ext) for ext in ('.html', '.mhtml', '.htm'))]
                if html_files:
                    video_logger.error(f"Download failed - received HTML error page: {html_files[0]}")
                    raise ValueError(
                        "YouTube blocked the download (received HTML error page). "
                        "This means your IP may be rate-limited. "
                        "Solutions: 1) Wait 10-15 minutes, 2) Add browser cookies, 3) Use VPN/proxy"
                    )
                video_logger.error(f"No valid candidates found! Expected pattern: {os.path.basename(base_pattern)}")

            if downloaded_file and os.path.exists(downloaded_file):
                # Try to apply metadata (cover art, artist, lyrics) if possible
                try:
                    # Make sure we have info dict
                    metadata_info = info if info else {}
                    apply_metadata(downloaded_file, metadata_info, base_pattern, VIDEO_DOWNLOAD_DIR, format_type)
                except Exception as meta_err:
                    video_logger.warning(f"Metadata application failed: {meta_err}")  # Log but don't fail
                # Check file size - if it's too small, it's probably corrupted
                file_size = os.path.getsize(downloaded_file)
                if file_size < 1024:  # Less than 1KB is probably corrupted
                    os.remove(downloaded_file)  # Delete the corrupted file
                    raise Exception(f"Downloaded file appears to be corrupted (only {file_size} bytes)")

                # Success - Log simplified entry
                video_logger.info(f"IP: {client_ip or 'Unknown'} | {title} | SUCCESS ({file_size} bytes)")
                with download_lock:
                    if download_id in active_video_downloads:
                        active_video_downloads[download_id].update({
                            'status': 'completed',
                            'progress': 100.0,
                            'file_path': downloaded_file,
                            'finished': True
                        })

                # Success - caller's done_callback will decrement the appropriate counter
                # Process next item in queue if any
                process_next_in_queue()

            else:
                error_details = f"Downloaded file not found. Candidates: {len(candidates)}, Base pattern: {os.path.basename(base_pattern)}"
                video_logger.error(error_details)

                # Check if this might be a YouTube block
                if last_exception:
                    error_details += f" | Last exception: {str(last_exception)}"

                raise Exception(error_details)

        except Exception as e:
            # Error occurred - Log detailed error for debugging
            error_msg = str(e)
            video_logger.error(f"IP: {client_ip or 'Unknown'} | {locals().get('title', url)} | FAILED: {error_msg}")

            # Log additional context if available
            if 'last_exception' in locals() and last_exception:
                video_logger.error(f"Root cause: {str(last_exception)}")

            with download_lock:
                if download_id in active_video_downloads:
                    active_video_downloads[download_id].update({
                        'status': 'error',
                        'error': error_msg,
                        'finished': True
                    })

            # Errors are handled by the caller's done_callback which will decrement
            # the active conversion counter for the appropriate pool.
            # Process next item in queue if any
            process_next_in_queue()
        finally:
            # Clean up temp cookie file if we created one
            if temp_cookie_file:
                try:
                    if os.path.exists(temp_cookie_file):
                        os.remove(temp_cookie_file)
                except Exception as cleanup_err:
                    pass

            # Decrement rate limit counter when download finishes (success or error)
            if client_ip:
                decrement_video_rate_limit(client_ip)
            # Clean up any coalescing mapping for this URL - decrease refcount and remove when zero
            try:
                normalized = url.strip()
                with download_lock:
                    mapping = active_url_map.get(normalized)
                    if mapping:
                        # mapping is a dict {'download_id': id, 'refcount': n}
                        if mapping.get('download_id') == download_id:
                            mapping['refcount'] = max(0, mapping.get('refcount', 1) - 1)
                            if mapping['refcount'] <= 0:
                                try:
                                    del active_url_map[normalized]
                                except KeyError:
                                    pass
                    # Also decrement waiter count on the active download entry if present
                    if download_id in active_video_downloads:
                        entry = active_video_downloads[download_id]
                        if 'waiters' in entry and entry['waiters'] > 0:
                            entry['waiters'] = max(0, entry['waiters'] - 1)
            except Exception:
                pass

    def full_playlist_download_background(download_id: str, playlist_url: str, format_type: str, quality: int, start_index: int, end_index: Optional[int], zip_path: str, client_ip: str = None):
        """Download ALL videos from a playlist directly using yt-dlp's playlist support"""
        video_logger.info(f"Starting full playlist download for {download_id}")
        video_logger.info(f"Playlist URL: {playlist_url}, Range: {start_index}-{end_index or 'end'}")

        try:
            with download_lock:
                if download_id in active_video_downloads:
                    active_video_downloads[download_id]['status'] = 'downloading'

            # Create temporary directory for downloads
            bulk_dir = os.path.join(VIDEO_DOWNLOAD_DIR, f"fullplaylist_{download_id}")
            os.makedirs(bulk_dir, exist_ok=True)

            extension = 'mp3' if format_type == 'audio' else 'mp4'
            output_template = os.path.join(bulk_dir, f"%(playlist_index)s_%(title)s_%(id)s.%(ext)s")

            # Configure yt-dlp to download the FULL playlist
            ydl_opts = get_ydl_opts(format_type, quality, output_template)
            ydl_opts['ignoreerrors'] = True  # Continue if some videos fail
            ydl_opts['playliststart'] = start_index
            if end_index:
                ydl_opts['playlistend'] = end_index
            # Disable thumbnail downloads for bulk operations to avoid clutter
            ydl_opts['writethumbnail'] = True
            ydl_opts['embedthumbnail'] = True
            ydl_opts['writelyrics'] = True
            ydl_opts['embedlyrics'] = True

            # Add cookies if available
            cookie_file = os.environ.get('YTDL_COOKIE_FILE')
            if not cookie_file:
                backend_cookie_path = os.path.join(os.path.dirname(__file__), 'cookies.txt')
                if os.path.exists(backend_cookie_path):
                    cookie_file = backend_cookie_path
            if cookie_file and os.path.exists(cookie_file):
                ydl_opts['cookiefile'] = cookie_file

            completed_files = []
            total_videos = 0

            def progress_hook(d):
                if d['status'] == 'finished':
                    completed_files.append(d.get('filename'))
                    if total_videos > 0:
                        progress = (len(completed_files) / total_videos) * 90  # Reserve 10% for zipping
                        with download_lock:
                            if download_id in active_video_downloads:
                                active_video_downloads[download_id]['progress'] = min(progress, 90.0)
                                active_video_downloads[download_id]['completed_count'] = len(completed_files)
                                active_video_downloads[download_id]['total_videos'] = total_videos

            ydl_opts['progress_hooks'] = [progress_hook]

            video_logger.info(f"Starting yt-dlp playlist download with playliststart={start_index}")

            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                # Extract playlist info first to get total count
                try:
                    info = ydl.extract_info(playlist_url, download=False)
                    if info and 'entries' in info:
                        # Count actual entries (excluding None/unavailable)
                        valid_entries = [e for e in info['entries'] if e]
                        total_videos = len(valid_entries)
                        video_logger.info(f"Playlist contains {total_videos} downloadable videos")

                        with download_lock:
                            if download_id in active_video_downloads:
                                active_video_downloads[download_id]['total_videos'] = total_videos
                                active_video_downloads[download_id]['title'] = info.get('title', 'Full Playlist Download')
                except Exception as e:
                    video_logger.warning(f"Could not extract playlist info: {e}, proceeding with download anyway")

                # Now download all videos
                ydl.download([playlist_url])

            # Get all downloaded files
            downloaded_files = [os.path.join(bulk_dir, f) for f in os.listdir(bulk_dir) if os.path.isfile(os.path.join(bulk_dir, f))]
            video_logger.info(f"Downloaded {len(downloaded_files)} files, creating ZIP...")

            with download_lock:
                if download_id in active_video_downloads:
                    active_video_downloads[download_id]['status'] = 'zipping'
                    active_video_downloads[download_id]['progress'] = 90.0

            # Create ZIP file
            with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                for file_path in downloaded_files:
                    arcname = os.path.basename(file_path)
                    zipf.write(file_path, arcname=arcname)
                    video_logger.debug(f"Added to ZIP: {arcname}")

            zip_size = os.path.getsize(zip_path)
            video_logger.info(f"Created ZIP file: {zip_path} ({zip_size / 1024 / 1024:.1f} MB)")

            # Cleanup individual files
            try:
                shutil.rmtree(bulk_dir)
                video_logger.info(f"Cleaned up temp directory: {bulk_dir}")
            except Exception as e:
                video_logger.warning(f"Failed to cleanup temp directory: {e}")

            # Mark as completed
            with download_lock:
                if download_id in active_video_downloads:
                    active_video_downloads[download_id].update({
                        'status': 'completed',
                        'progress': 100.0,
                        'finished': True,
                        'file_path': zip_path,
                        'completed_count': len(downloaded_files)
                    })

            video_logger.info(f"Full playlist download completed: {download_id}")

        except Exception as e:
            error_msg = str(e)
            video_logger.error(f"Full playlist download failed for {download_id}: {error_msg}")

            with download_lock:
                if download_id in active_video_downloads:
                    active_video_downloads[download_id].update({
                        'status': 'error',
                        'error': error_msg,
                        'finished': True
                    })
        finally:
            if client_ip:
                decrement_video_rate_limit(client_ip)

    def bulk_download_background(download_id: str, video_ids: List[str], format_type: str, quality: int, bulk_dir: str, zip_path: str, client_ip: str = None):
        """Background function to download multiple videos and create ZIP file"""
        video_logger.info(f"Starting bulk download background process for {download_id}")
        video_logger.info(f"Downloading {len(video_ids)} videos in {format_type} format")
        try:
            completed_videos = []
            total_videos = len(video_ids)
            # Files that are ready to be flushed into the next ZIP part
            pending_part_files = []
            pending_part_size = 0
            last_flush_time = time.time()
            FLUSH_INTERVAL = 60  # seconds, flush a ZIP part at least every 60s
            MAX_PART_SIZE = 1_000_000_000  # 1 GB per part

            with download_lock:
                if download_id in active_video_downloads:
                    active_video_downloads[download_id]['status'] = 'downloading'
                    video_logger.info(f"Set status to downloading for {download_id}")

            for i, video_id in enumerate(video_ids):
                try:
                    video_url = f"https://www.youtube.com/watch?v={video_id}"
                    video_logger.info(f"Downloading video {i+1}/{total_videos}: {video_id}")

                    # Create output path for this video
                    timestamp = int(time.time())
                    extension = 'mp3' if format_type == 'audio' else 'mp4'
                    output_filename = f"{video_id}_{timestamp}.%(ext)s"
                    output_path = os.path.join(bulk_dir, output_filename)

                    # Download this video
                    ydl_opts = get_ydl_opts(format_type, quality, output_path)
                    # Disable thumbnail downloads for bulk operations
                    ydl_opts['writethumbnail'] = False
                    ydl_opts['embedthumbnail'] = True
                    ydl_opts['writelyrics'] = True
                    ydl_opts['embedlyrics'] = True

                    def progress_hook(d):
                        if d['status'] == 'finished':
                            # Update overall progress
                            current_progress = ((len(completed_videos) + 1) / total_videos) * 100
                            with download_lock:
                                if download_id in active_video_downloads:
                                    active_video_downloads[download_id]['progress'] = min(current_progress, 95.0)

                    ydl_opts['progress_hooks'] = [progress_hook]

                    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                        info = ydl.extract_info(video_url, download=True)
                        title = info.get('title', f'Video {video_id}')
                        video_logger.info(f"Successfully downloaded: {title}")

                        # Find the downloaded file by collecting candidates and prioritizing media extensions
                        downloaded_file = None
                        candidates = []
                        for filename in os.listdir(bulk_dir):
                            if filename.startswith(video_id):
                                candidates.append(os.path.join(bulk_dir, filename))

                        if candidates:
                            priority_exts = ['.mp3', '.m4a', '.mp4', '.webm', '.mkv', '.aac']
                            chosen = None
                            for ext in priority_exts:
                                for path in candidates:
                                    if path.lower().endswith(ext):
                                        chosen = path
                                        break
                                if chosen:
                                    break
                            downloaded_file = chosen or candidates[0]

                        if downloaded_file:
                            video_logger.info(f"Found downloaded file: {downloaded_file}")
                            # Rename file to include title for ZIP
                            # Apply metadata (attempt embedding cover/lyrics) for each item
                            try:
                                apply_metadata(downloaded_file, info if 'info' in locals() else {}, output_path.replace('.%(ext)s',''), format_type)
                            except Exception as meta_err:
                                video_logger.warning(f"Failed to apply metadata for bulk item: {meta_err}")
                            # Ensure the filename is unique to avoid collisions when many videos have
                            # similar/sanitized titles. Append the video_id to guarantee uniqueness.
                            safe_title = re.sub(r'[^\w\s-]', '', title).strip()[:50]
                            new_filename = f"{safe_title}_{video_id}.{extension}"
                            new_path = os.path.join(bulk_dir, new_filename)

                            try:
                                os.rename(downloaded_file, new_path)
                                completed_videos.append(new_path)
                                pending_part_files.append(new_path)
                                try:
                                    pending_part_size += os.path.getsize(new_path)
                                except Exception:
                                    pass
                                video_logger.info(f"Renamed file to: {new_filename}")
                            except Exception as rename_error:
                                video_logger.warning(f"Failed to rename file, using original: {rename_error}")
                                completed_videos.append(downloaded_file)
                                pending_part_files.append(downloaded_file)
                                try:
                                    pending_part_size += os.path.getsize(downloaded_file)
                                except Exception:
                                    pass

                        # Update completed count in active download entry
                        with download_lock:
                            if download_id in active_video_downloads:
                                active_video_downloads[download_id]['completed_videos'] = completed_videos.copy()
                                active_video_downloads[download_id]['completed_count'] = len(completed_videos)
                                active_video_downloads[download_id]['progress'] = min(((len(completed_videos)) / total_videos) * 100, 95.0)

                        # Decide if we should flush a part now (time-based or size-based)
                        now = time.time()
                        if (now - last_flush_time >= FLUSH_INTERVAL and pending_part_files) or pending_part_size >= MAX_PART_SIZE:
                            # Flush pending files into a new ZIP part
                            try:
                                part_index = len(active_video_downloads[download_id].get('parts', [])) + 1
                                part_name = f"{os.path.splitext(zip_path)[0]}_part{part_index}.zip"
                                with zipfile.ZipFile(part_name, 'w', zipfile.ZIP_DEFLATED) as zipf:
                                    for f in pending_part_files:
                                        if os.path.exists(f):
                                            zipf.write(f, os.path.basename(f))
                                video_logger.info(f"Flushed ZIP part {part_index}: {part_name} (size ~{pending_part_size} bytes)")

                                # Register the new part
                                with download_lock:
                                    entry = active_video_downloads.get(download_id)
                                    if entry is not None:
                                        parts = entry.get('parts') or []
                                        parts.append(part_name)
                                        entry['parts'] = parts
                                        # If no file_path yet set, set to this first part
                                        if not entry.get('file_path'):
                                            entry['file_path'] = part_name
                                            entry['status'] = 'completed'
                                        entry['completed_count'] = len(completed_videos)
                                        # We're still in the middle of producing parts; mark as not finished
                                        entry['finished'] = False

                                # After flushing, remove those files from disk (they've been archived)
                                for f in pending_part_files:
                                    try:
                                        delete_file_safe(f)
                                        video_logger.debug(f"Cleaned up file after flush: {f}")
                                    except Exception as cleanup_error:
                                        video_logger.warning(f"Failed to clean up file {f} after flush: {cleanup_error}")

                                # Reset pending part buffers
                                pending_part_files = []
                                pending_part_size = 0
                                last_flush_time = time.time()
                            except Exception as flush_err:
                                video_logger.error(f"Failed to flush ZIP part for {download_id}: {flush_err}")

                    # Update progress
                    current_progress = ((i + 1) / total_videos) * 100
                    with download_lock:
                        if download_id in active_video_downloads:
                            active_video_downloads[download_id]['completed_videos'] = completed_videos.copy()
                            active_video_downloads[download_id]['completed_count'] = len(completed_videos)
                            active_video_downloads[download_id]['progress'] = min(current_progress, 95.0)

                except Exception as e:
                    video_logger.error(f"Error downloading video {video_id}: {e}")
                    # Continue with next video

                # After loop completes, flush any remaining pending files into parts
            parts = active_video_downloads[download_id].get('parts', []) if download_id in active_video_downloads else []
            if pending_part_files:
                try:
                    part_index = len(parts) + 1
                    part_name = f"{os.path.splitext(zip_path)[0]}_part{part_index}.zip"
                    with zipfile.ZipFile(part_name, 'w', zipfile.ZIP_DEFLATED) as zipf:
                        for f in pending_part_files:
                            if os.path.exists(f):
                                zipf.write(f, os.path.basename(f))
                    video_logger.info(f"Flushed final ZIP part {part_index}: {part_name} (size ~{pending_part_size} bytes)")

                    with download_lock:
                        entry = active_video_downloads.get(download_id)
                        if entry is not None:
                            parts = entry.get('parts') or []
                            parts.append(part_name)
                            entry['parts'] = parts
                            if not entry.get('file_path'):
                                entry['file_path'] = part_name
                            entry['completed_count'] = len(completed_videos)

                    for f in pending_part_files:
                        try:
                            delete_file_safe(f)
                        except Exception:
                            pass
                except Exception as flush_err:
                    video_logger.error(f"Failed to flush final ZIP part for {download_id}: {flush_err}")

            # Mark download as finished only when all parts have been created; files are served and removed later
            with download_lock:
                if download_id in active_video_downloads:
                    entry = active_video_downloads[download_id]
                    entry['status'] = 'completed' if entry.get('parts') else 'error'
                    entry['progress'] = 100.0 if entry.get('parts') else entry.get('progress', 0.0)
                    entry['file_path'] = entry.get('parts')[0] if entry.get('parts') else entry.get('file_path')
                    # We are at the end of the worker: mark finished True so cleanup can remove
                    # the entry only after all parts have been served.
                    entry['finished'] = True if entry.get('parts') else True

        except Exception as e:
            # Error occurred
            error_msg = str(e)
            video_logger.error(f"Bulk download error for {download_id}: {error_msg}")

            with download_lock:
                if download_id in active_video_downloads:
                    active_video_downloads[download_id].update({
                        'status': 'error',
                        'error': error_msg,
                        'finished': True
                    })
        finally:
            # Decrement rate limit counter when download finishes (success or error)
            if client_ip:
                decrement_video_rate_limit(client_ip)

    @router.post("/playlist-info", response_model=PlaylistInfoResponse)
    async def get_playlist_info(request: PlaylistInfoRequest):
        """Get information about a YouTube playlist with caching and pagination"""
        video_logger.info(f"Getting playlist info for URL: {request.url} (page {request.page})")
        try:
            if not is_playlist_url(request.url):
                video_logger.warning(f"Invalid playlist URL provided: {request.url}")
                raise HTTPException(status_code=400, detail="URL is not a valid YouTube playlist")

            playlist_id = extract_playlist_id(request.url)
            if not playlist_id:
                video_logger.warning(f"Could not extract playlist ID from URL: {request.url}")
                raise HTTPException(status_code=400, detail="Could not extract playlist ID from URL")

            video_logger.info(f"Extracted playlist ID: {playlist_id}")

            # Cache the full playlist data (all videos extracted)
            cache_key_full = f"{playlist_id}_full"

            #  CHECK CACHE FIRST - avoid redundant API calls
            cached_full_data = get_cached_playlist_info(cache_key_full)

            page_size = 100

            if cached_full_data:
                video_logger.info(f"Using cached full playlist data for {playlist_id}, serving page {request.page}")
                # Serve paginated results from cached full data
                all_videos = cached_full_data.get('videos', [])
                total_count = cached_full_data.get('total_count', len(all_videos))
                extracted_count = cached_full_data.get('extracted_count', len(all_videos))
                playlist_title = cached_full_data.get('title', f'Playlist {playlist_id}')

                start_index = (request.page - 1) * page_size
                end_index = start_index + page_size
                paginated_videos = all_videos[start_index:end_index]
                # has_more based on extracted videos (not total, since we can only extract ~100)
                has_more = end_index < extracted_count

                return PlaylistInfoResponse(
                    success=True,
                    playlist_id=playlist_id,
                    title=playlist_title,
                    video_count=total_count,
                    videos=paginated_videos,
                    is_private=False,
                    page=request.page,
                    page_size=page_size,
                    has_more=has_more
                )
            ydl_opts = {
                'quiet': True,
                'no_warnings': True,
                'extract_flat': 'in_playlist',  # Extract basic info only (faster)
                'ignoreerrors': True,  # Continue even if some videos fail
                'skip_unavailable_fragments': True,
            }

            #  ADD COOKIES for age-restricted playlists
            cookie_file = os.environ.get('YTDL_COOKIE_FILE')
            if not cookie_file:
                backend_cookie_path = os.path.join(os.path.dirname(__file__), 'cookies.txt')
                if os.path.exists(backend_cookie_path):
                    cookie_file = backend_cookie_path

            if cookie_file and os.path.exists(cookie_file):
                ydl_opts['cookiefile'] = cookie_file
                video_logger.info(f"Using cookies for playlist extraction: {cookie_file}")

            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                try:
                    video_logger.info(f"Extracting playlist info with yt-dlp for ID: {playlist_id}")
                    info = ydl.extract_info(request.url, download=False)

                    if not info:
                        video_logger.error(f"Playlist not found or unavailable: {playlist_id}")
                        raise HTTPException(status_code=404, detail="Playlist not found or unavailable")

                    # Check if playlist is private/unavailable
                    if info.get('availability') == 'private':
                        video_logger.warning(f"Playlist {playlist_id} is private")
                        response = PlaylistInfoResponse(
                            success=False,
                            playlist_id=playlist_id,
                            title="Private Playlist",
                            video_count=0,
                            videos=[],
                            is_private=True,
                            error="This playlist is private. Please make it unlisted or public to access it."
                        )
                        # Don't cache error responses
                        return response

                    playlist_title = info.get('title', f'Playlist {playlist_id}')
                    playlist_count = info.get('playlist_count', 0)  # Total videos in playlist
                    entries = info.get('entries', [])

                    videos = []
                    skipped_count = 0
                    for entry in entries:
                        if entry:
                            # Handle different entry formats
                            video_id = entry.get('id') or entry.get('url', '').split('v=')[-1].split('&')[0] if entry.get('url') else None
                            if video_id:
                                videos.append(PlaylistVideoInfo(
                                    id=video_id,
                                    title=entry.get('title', 'Unknown Title'),
                                    duration=entry.get('duration'),
                                    url=f"https://www.youtube.com/watch?v={video_id}"
                                ))
                            else:
                                skipped_count += 1
                                video_logger.debug(f"Skipped entry without ID: {entry.get('title', 'Unknown')}")

                    if skipped_count > 0:
                        video_logger.info(f"Skipped {skipped_count} unavailable/private videos in playlist {playlist_id}")

                    # Paginate the extracted videos in memory
                    start_index = (request.page - 1) * page_size
                    end_index = start_index + page_size
                    paginated_videos = videos[start_index:end_index]

                    # Use the actual playlist_count from YouTube metadata (shows real total)
                    # Note: extract_flat can only extract ~100 videos, but playlist_count shows the true total
                    total_videos = playlist_count if playlist_count > 0 else len(videos)
                    extracted_count = len(videos)  # How many we actually got
                    # has_more: true if there are more videos in the actual playlist
                    has_more = end_index < extracted_count

                    video_logger.info(f"Successfully extracted playlist info: {playlist_title} with {len(paginated_videos)} videos on page {request.page} (extracted: {extracted_count}, total in playlist: {total_videos})")

                    #  CACHE THE FULL DATA (all videos) to avoid redundant API calls
                    full_data = {
                        'videos': videos,  # All extracted videos (~100 max)
                        'total_count': total_videos,  # Actual playlist total from metadata
                        'extracted_count': extracted_count,  # How many we actually got
                        'title': playlist_title
                    }
                    cache_playlist_info(cache_key_full, full_data)

                    response = PlaylistInfoResponse(
                        success=True,
                        playlist_id=playlist_id,
                        title=playlist_title,
                        video_count=total_videos,  # Total count, not just this page
                        videos=paginated_videos,  # Only videos for this page
                        is_private=False,
                        page=request.page,
                        page_size=page_size,
                        has_more=has_more
                    )

                    return response

                except Exception as e:
                    error_msg = str(e)
                    video_logger.error(f"Error extracting playlist info for {playlist_id}: {error_msg}")
                    if "Sign in to confirm your age" in error_msg:
                        video_logger.warning(f"Age-restricted playlist: {playlist_id}")
                        return PlaylistInfoResponse(
                            success=False,
                            playlist_id=playlist_id,
                            title="Age-Restricted Playlist",
                            video_count=0,
                            videos=[],
                            error="This playlist contains age-restricted content. Some videos may not be downloadable."
                        )
                    elif "private" in error_msg.lower():
                        video_logger.warning(f"Private playlist: {playlist_id}")
                        return PlaylistInfoResponse(
                            success=False,
                            playlist_id=playlist_id,
                            title="Private Playlist",
                            video_count=0,
                            videos=[],
                            is_private=True,
                            error="This playlist is private. Please make it unlisted or public to access it."
                        )
                    else:
                        video_logger.error(f"Failed to extract playlist info for {playlist_id}: {error_msg}")
                        raise HTTPException(status_code=500, detail=f"Failed to extract playlist info: {error_msg}")

        except HTTPException:
            raise
        except Exception as e:
            video_logger.error(f"Unexpected error in get_playlist_info: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))

    @router.get("/queue/{download_id}")
    async def get_queue_status(download_id: str):
        """Get the queue status for a specific download ID"""
        try:
            queue_info = get_queue_position(download_id)

            # Also check if download is active
            download_info = None
            with download_lock:
                if download_id in active_video_downloads:
                    download_info = {
                        'status': active_video_downloads[download_id].get('status'),
                        'progress': active_video_downloads[download_id].get('progress', 0),
                        'title': active_video_downloads[download_id].get('title'),
                        'error': active_video_downloads[download_id].get('error')
                    }

            return {
                'success': True,
                'download_id': download_id,
                'queue': queue_info,
                'download': download_info
            }
        except Exception as e:
            video_logger.error(f"Error getting queue status: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))

    @router.post("/validate", response_model=Dict[str, Any])
    async def validate_video_url(request: VideoUrlValidation):
        """Validate if URL is supported and return platform info"""
        try:
            platform = detect_platform(request.url)
            if not platform:
                return {"valid": False, "error": "Unsupported platform or invalid URL"}

            # Check if it's a playlist
            if is_playlist_url(request.url):
                return {
                    "valid": True,
                    "platform": platform,
                    "is_playlist": True,
                    "playlist_id": extract_playlist_id(request.url),
                    "message": "YouTube playlist detected. Use /api/v1/video/playlist-info to get playlist details."
                }

            # Test if yt-dlp can extract info
            ydl_opts = {'quiet': True, 'no_warnings': True}
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                try:
                    info = ydl.extract_info(request.url, download=False)
                    title = info.get('title', 'Unknown')
                    duration = info.get('duration', 0)
                    filesize = info.get('filesize') or info.get('filesize_approx', 0)

                    #  Check size/duration limits
                    warnings = []

                    # Adaptive quality removed: reject videos larger than the configured max
                    if filesize > MAX_VIDEO_FILESIZE:
                        size_gb = filesize / (1024 * 1024 * 1024)
                        return {
                            "valid": False,
                            "error": f"Video is too large ({size_gb:.2f}GB). Maximum allowed: {MAX_VIDEO_FILESIZE / (1024**3):.1f}GB.",
                            "size_limit_exceeded": True,
                            "filesize": filesize,
                            "duration": duration
                        }

                    if duration > MAX_VIDEO_DURATION:
                        minutes = duration / 60
                        return {
                            "valid": False,
                            "error": f"Video is too long ({minutes:.1f} minutes). Maximum allowed: {MAX_VIDEO_DURATION / 60:.0f} minutes.",
                            "duration_limit_exceeded": True,
                            "filesize": filesize,
                            "duration": duration
                        }

                    # Warnings for large but acceptable files
                    if filesize > WARN_VIDEO_FILESIZE:
                        size_mb = filesize / (1024 * 1024)
                        warnings.append(f"Large file: {size_mb:.0f}MB - download may be slow")

                    response = {
                        "valid": True,
                        "platform": platform,
                        "is_playlist": False,
                        "title": title,
                        "duration": duration,
                        "formats_available": True
                    }

                    if filesize:
                        response["filesize"] = filesize

                    if warnings:
                        response["warnings"] = warnings

                    return response
                except Exception as e:
                    error_msg = str(e)
                    if "Sign in to confirm your age" in error_msg:
                        return {
                            "valid": True,
                            "platform": platform,
                            "is_playlist": False,
                            "title": "Age-Restricted Video",
                            "duration": 0,
                            "age_restricted": True,
                            "warning": "This video is age-restricted. Download may require authentication."
                        }
                    else:
                        return {"valid": False, "error": f"Cannot extract video info: {error_msg}"}

        except Exception as e:
            return {"valid": False, "error": str(e)}

    @router.post("/convert", response_model=VideoConversionResponse)
    async def convert_video(request: VideoConversionRequest, req: Request):
        """Start video conversion process with rate limiting"""
        # Ensure we can modify the module-level counters when reserving slots
        global active_conversions_count, active_long_conversions_count

        try:
            # Get client IP for rate limiting
            client_ip = get_client_ip(req)

            # Check rate limit
            if not check_video_rate_limit(client_ip):
                video_logger.warning(f"Rate limit exceeded for IP {client_ip}")
                raise HTTPException(
                    status_code=429,
                    detail=f"Rate limit exceeded. Maximum {MAX_CONCURRENT_DOWNLOADS_PER_IP} concurrent downloads per IP. Please wait."
                )

            # Validate URL first
            platform = detect_platform(request.url)
            if not platform:
                raise HTTPException(status_code=400, detail="Unsupported platform or invalid URL")

            # Block internal/localhost URLs (SSRF protection)
            from urllib.parse import urlparse
            parsed = urlparse(request.url)
            if parsed.hostname in ['localhost', '127.0.0.1', '0.0.0.0', '::1']:
                raise HTTPException(status_code=400, detail="Invalid URL: localhost not allowed")

            # Normalize URL for coalescing (simple normalization)
            normalized_url = request.url.strip()

            # If another worker is already downloading this URL, coalesce requests
            with download_lock:
                existing = active_url_map.get(normalized_url)
                if existing:
                    # Increment refcount so we know multiple clients are waiting
                    existing['refcount'] = existing.get('refcount', 1) + 1
                    # Also increment the waiter count on the active_video_downloads entry
                    try:
                        did = existing.get('download_id')
                        if did and did in active_video_downloads:
                            active_video_downloads[did]['waiters'] = active_video_downloads[did].get('waiters', 1) + 1
                    except Exception:
                        pass
                    video_logger.info(f"Coalescing request: returning existing download ID {existing['download_id']} for URL {normalized_url} (refcount={existing['refcount']})")
                    return VideoConversionResponse(
                        success=True,
                        download_id=existing['download_id'],
                        message=f"Download already in progress. Using existing download ID {existing['download_id']}"
                    )

            # Increment rate limit counter (only for new downloads)
            increment_video_rate_limit(client_ip)

            # Probe the URL for metadata (duration, filesize) so we can decide
            # whether this is a long-video job and route it to the dedicated pool.
            duration = 0
            filesize = 0
            try:
                # Offload blocking yt-dlp probe to a thread to avoid blocking
                # the main asyncio event loop. This prevents the health check
                # and other endpoints from being starved when many probes run.
                loop = asyncio.get_running_loop()

                def blocking_probe(url):
                    probe_opts = {'quiet': True, 'no_warnings': True}
                    with yt_dlp.YoutubeDL(probe_opts) as ydl:
                        return ydl.extract_info(url, download=False)

                info = await loop.run_in_executor(None, blocking_probe, request.url)
                duration = info.get('duration', 0) or 0
                filesize = info.get('filesize') or info.get('filesize_approx', 0) or 0
            except Exception as probe_err:
                video_logger.debug(f"Could not probe URL metadata for {request.url}: {probe_err}")

            # Decide whether this is a long video (separate pool)
            is_long = bool(duration and duration > MAX_VIDEO_DURATION)

            # Generate unique download ID
            download_id = str(uuid.uuid4())

            # Determine format and quality
            format_type = 'audio' if request.format == 1 else 'video'

            # Set up output filename
            timestamp = int(time.time())
            output_filename = f"{download_id}_{timestamp}.%(ext)s"
            output_path = os.path.join(VIDEO_DOWNLOAD_DIR, output_filename)

            # Register normalized URL -> download_id for coalescing (with refcount)
            with download_lock:
                active_url_map[normalized_url] = {'download_id': download_id, 'refcount': 1}

            # Store download info (include duration + is_long flag)
            with download_lock:
                active_video_downloads[download_id] = {
                    'status': 'queued',
                    'progress': 0.0,
                    'platform': platform,
                    'format': 'MP3' if format_type == 'audio' else 'MP4',
                    'quality': request.quality,
                    'url': request.url,
                    'output_path': output_path,
                    'duration': duration,
                    'is_long': is_long,
                    'created_at': time.time(),
                    'title': None,
                    'error': None,
                    'finished': False,
                    'waiters': 1,
                    'file_path': None,
                    'client_ip': client_ip
                }
                # If client provided a proxy parameter in the JSON body, accept it
                try:
                    body_json = await req.json()
                    proxy_param = body_json.get('proxy')
                    if proxy_param:
                        with download_lock:
                            if download_id in active_video_downloads:
                                active_video_downloads[download_id]['proxy'] = proxy_param
                                video_logger.info(f"Registered per-download proxy for {download_id}: {proxy_param}")
                except Exception:
                    pass

            # Add to queue (include is_long flag so dispatcher can prefer short jobs)
            add_to_queue(download_id, request.url, client_ip, is_long=is_long)

            # Get queue position for response
            queue_info = get_queue_position(download_id)

            # Check if we can start immediately (use is_long-aware check)
            started_immediately = False
            if can_start_conversion(is_long=is_long):
                # Reserve a slot atomically and start (perform increment inline to avoid re-acquiring the lock)
                with conversions_lock:
                    if can_start_conversion(is_long=is_long):
                        # Inline increment under lock to avoid deadlock (increment_active_conversions also locks)
                        if is_long:
                            active_long_conversions_count += 1
                            video_logger.info(f"Active long conversions: {active_long_conversions_count}/{MAX_CONCURRENT_LONG_CONVERSIONS}")
                        else:
                            active_conversions_count += 1
                            video_logger.info(f"Active short conversions: {active_conversions_count}/{MAX_CONCURRENT_CONVERSIONS}")
                        started_immediately = True

            if started_immediately:
                # Remove from queue BEFORE starting (so it doesn't stay in queue forever)
                remove_from_queue(download_id)

                # Set status to 'starting' BEFORE submitting to avoid race condition
                with download_lock:
                    if download_id in active_video_downloads:
                        active_video_downloads[download_id]['status'] = 'starting'

                # Submit to appropriate process pool
                try:
                    pool = long_video_process_pool if is_long else video_process_pool
                    future = pool.submit(
                        download_video_background,
                        download_id, request.url, format_type, request.quality, output_path, client_ip,
                        request.chunk_index, request.chunk_start, request.chunk_end
                    )

                    # Add completion callback that honors is_long
                    def done_callback(fut, is_long_flag=is_long):
                        try:
                            fut.result()
                        except Exception as e:
                            video_logger.error(f"Download {download_id} error: {e}")
                        finally:
                            decrement_active_conversions(is_long=is_long_flag)
                            decrement_video_rate_limit(client_ip)
                            process_next_in_queue()

                    future.add_done_callback(done_callback)

                except Exception as e:
                    video_logger.error(f"Failed to submit {download_id}: {e}")
                    # Clean up reservation and bookkeeping since we couldn't start
                    decrement_active_conversions(is_long=is_long)
                    with download_lock:
                        if active_url_map.get(normalized_url, {}).get('download_id') == download_id:
                            del active_url_map[normalized_url]
                        if download_id in active_video_downloads:
                            del active_video_downloads[download_id]
                    remove_from_queue(download_id)
                    decrement_video_rate_limit(client_ip)
                    video_logger.warning(f"Process pool error; rejected download {download_id}")
                    raise HTTPException(status_code=429, detail="Server busy processing other downloads. Try again shortly.")

            response_message = f"Started {format_type} conversion from {platform}"
            if queue_info['in_queue'] and queue_info['position'] > 1:
                response_message += f" (queued at position {queue_info['position']}, estimated wait: {queue_info['estimated_wait_seconds']}s)"

            return VideoConversionResponse(
                success=True,
                download_id=download_id,
                message=response_message
            )

        except HTTPException:
            raise
        except Exception as e:
            video_logger.error(f"Unexpected error in convert_video: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))

    @router.post("/bulk-download", response_model=VideoConversionResponse)
    async def bulk_download_playlist(request: BulkDownloadRequest, req: Request):
        """Start bulk download of multiple videos from a playlist"""
        video_logger.info(f"Starting bulk download for playlist: {request.playlist_url}")
        video_logger.info(f"Video IDs to download: {len(request.video_ids)} videos")
        try:
            # Get client IP for rate limiting
            client_ip = get_client_ip(req)

            # Check rate limit (more strict for bulk downloads)
            if not check_video_rate_limit(client_ip):
                video_logger.warning(f"Rate limit exceeded for IP {client_ip}")
                raise HTTPException(
                    status_code=429,
                    detail=f"Rate limit exceeded. Maximum {MAX_CONCURRENT_DOWNLOADS_PER_IP} concurrent downloads per IP. Please wait."
                )

            if not request.video_ids:
                video_logger.warning("No video IDs provided for bulk download")
                raise HTTPException(status_code=400, detail="No video IDs provided")

            if len(request.video_ids) > 2000:  # Limit bulk downloads to a high ceiling
                video_logger.warning(f"Too many videos requested: {len(request.video_ids)} (max 2000)")
                raise HTTPException(status_code=400, detail="Maximum 2000 videos per bulk download")

            # Generate unique download ID
            download_id = str(uuid.uuid4())
            video_logger.info(f"Generated download ID: {download_id}")

            # Determine format and quality
            format_type = 'audio' if request.format == 1 else 'video'
            extension = 'mp3' if format_type == 'audio' else 'mp4'

            # Create temporary directory for individual downloads
            bulk_dir = os.path.join(VIDEO_DOWNLOAD_DIR, f"bulk_{download_id}")
            os.makedirs(bulk_dir, exist_ok=True)
            video_logger.info(f"Created bulk download directory: {bulk_dir}")

            # Create ZIP file path
            zip_filename = f"playlist_download_{int(time.time())}.zip"
            zip_path = os.path.join(VIDEO_DOWNLOAD_DIR, zip_filename)

            # Store download info
            with download_lock:
                active_video_downloads[download_id] = {
                    'status': 'starting',
                    'progress': 0.0,
                    'platform': 'youtube',
                    'format': f'Bulk {format_type.title()}',
                    'quality': request.quality,
                    'url': request.playlist_url,
                    'output_path': zip_path,
                    'bulk_dir': bulk_dir,
                    'video_ids': request.video_ids,
                    'completed_videos': [],
                    'total_videos': len(request.video_ids),
                    'created_at': time.time(),
                    'title': f'Playlist Bulk Download ({len(request.video_ids)} videos)',
                    'error': None,
                    'finished': False,
                    'file_path': None
                }

            # Increment rate limit counter
            increment_video_rate_limit(client_ip)

            # Submit bulk download to process pool
            video_logger.info(f"Submitting background bulk download task for {download_id}")
            try:
                future = video_process_pool.submit(
                    bulk_download_background,
                    download_id, request.video_ids, format_type, request.quality, bulk_dir, zip_path, client_ip
                )

                # Add completion callback
                def done_callback(fut):
                    try:
                        fut.result()
                    except Exception as e:
                        video_logger.error(f"Bulk download {download_id} error: {e}")
                    finally:
                        decrement_video_rate_limit(client_ip)

                future.add_done_callback(done_callback)

            except Exception as e:
                video_logger.error(f"Failed to submit bulk download {download_id}: {e}")
                with download_lock:
                    if download_id in active_video_downloads:
                        del active_video_downloads[download_id]
                decrement_video_rate_limit(client_ip)
                video_logger.warning(f"Worker queue full; rejected bulk download {download_id}")
                raise HTTPException(status_code=429, detail="Server busy processing other downloads. Try again shortly.")

            video_logger.info(f"Bulk download started successfully: {download_id}")
            return VideoConversionResponse(
                success=True,
                download_id=download_id,
                message=f"Started bulk download of {len(request.video_ids)} videos"
            )

        except HTTPException:
            raise
        except Exception as e:
            video_logger.error(f"Unexpected error in bulk_download_playlist: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))

    @router.post("/full-playlist-download", response_model=VideoConversionResponse)
    async def full_playlist_download(request: FullPlaylistDownloadRequest, req: Request):
        """Download ALL videos from a playlist (bypasses 100-video UI limit)"""
        video_logger.info(f"Starting full playlist download: {request.playlist_url}")
        video_logger.info(f"Range: {request.start_index} to {request.end_index or 'end'}")
        try:
            # Get client IP for rate limiting
            client_ip = get_client_ip(req)

            # Check rate limit
            if not check_video_rate_limit(client_ip):
                video_logger.warning(f"Rate limit exceeded for IP {client_ip}")
                raise HTTPException(
                    status_code=429,
                    detail=f"Rate limit exceeded. Maximum {MAX_CONCURRENT_DOWNLOADS_PER_IP} concurrent downloads per IP. Please wait."
                )

            if not is_playlist_url(request.playlist_url):
                raise HTTPException(status_code=400, detail="URL is not a valid playlist")

            # Generate unique download ID
            download_id = str(uuid.uuid4())
            video_logger.info(f"Generated download ID for full playlist: {download_id}")

            # Determine format
            format_type = 'audio' if request.format == 1 else 'video'
            extension = 'mp3' if format_type == 'audio' else 'mp4'

            # Create output path
            zip_filename = f"full_playlist_{int(time.time())}.zip"
            zip_path = os.path.join(VIDEO_DOWNLOAD_DIR, zip_filename)

            # Store download info
            with download_lock:
                active_video_downloads[download_id] = {
                    'status': 'starting',
                    'progress': 0.0,
                    'platform': 'youtube',
                    'format': f'Full Playlist {format_type.title()}',
                    'quality': request.quality,
                    'url': request.playlist_url,
                    'output_path': zip_path,
                    'created_at': time.time(),
                    'title': f'Full Playlist Download',
                    'error': None,
                    'finished': False,
                    'file_path': None
                }

            # Increment rate limit counter
            increment_video_rate_limit(client_ip)

            # Submit to process pool
            video_logger.info(f"Submitting full playlist download task for {download_id}")
            try:
                future = video_process_pool.submit(
                    full_playlist_download_background,
                    download_id, request.playlist_url, format_type, request.quality,
                    request.start_index, request.end_index, zip_path, client_ip
                )

                def done_callback(fut):
                    try:
                        fut.result()
                    except Exception as e:
                        video_logger.error(f"Full playlist download {download_id} error: {e}")

                future.add_done_callback(done_callback)
            except Exception as e:
                video_logger.error(f"Failed to submit full playlist download: {e}")
                with download_lock:
                    if download_id in active_video_downloads:
                        del active_video_downloads[download_id]
                decrement_video_rate_limit(client_ip)
                raise HTTPException(status_code=429, detail="Server busy. Try again shortly.")

            video_logger.info(f"Full playlist download started: {download_id}")
            return VideoConversionResponse(
                success=True,
                download_id=download_id,
                message=f"Started downloading full playlist (this may take a while for large playlists)"
            )

        except HTTPException:
            raise
        except Exception as e:
            video_logger.error(f"Unexpected error in full_playlist_download: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))

    @router.post('/api/v1/video/upload-cookies/{download_id}')
    async def upload_cookies(download_id: str, file: UploadFile = File(...)):
        """Upload a cookies.txt file to be used for a specific download (useful for age-restricted videos)."""
        try:
            with download_lock:
                if download_id not in active_video_downloads:
                    raise HTTPException(status_code=404, detail='Download ID not found')
            dest_dir = VIDEO_DOWNLOAD_DIR
            os.makedirs(dest_dir, exist_ok=True)
            dest_path = os.path.join(dest_dir, f"cookies_{download_id}.txt")
            contents = await file.read()
            with open(dest_path, 'wb') as f:
                f.write(contents)
            with download_lock:
                entry = active_video_downloads.get(download_id)
                if entry is not None:
                    entry['cookiefile'] = dest_path
            video_logger.info(f"Uploaded cookiefile for {download_id}: {dest_path}")
            return JSONResponse({'success': True, 'path': dest_path})
        except HTTPException:
            raise
        except Exception as e:
            video_logger.error(f"Failed to upload cookiefile for {download_id}: {e}")
            raise HTTPException(status_code=500, detail=str(e))

@router.get("/status/{download_id}", response_model=ConversionStatus)
async def get_conversion_status(download_id: str):
    """Get status of video conversion"""
    with download_lock:
        if download_id not in active_video_downloads:
            raise HTTPException(status_code=404, detail="Download ID not found")

        download_info = active_video_downloads[download_id].copy()

    # Build response
    status_response = ConversionStatus(
        status=download_info['status'],
        progress=download_info['progress'],
        platform=download_info['platform'],
        format=download_info['format'],
        quality=download_info['quality'],
        title=download_info.get('title'),
        error=download_info.get('error'),
        completed_count=download_info.get('completed_count', 0),
        parts_remaining=(len(download_info.get('parts') or []) if download_info.get('parts') else 0),
        total_videos=download_info.get('total_videos')
    )

    # Add chunking metadata if needed
    if download_info['status'] == 'needs_chunking':
        status_response.chunk_count = download_info.get('chunk_count', 0)
        status_response.chunk_duration = download_info.get('chunk_duration', 0)
        status_response.total_duration = download_info.get('total_duration', 0)

    return status_response

@router.get("/health")
async def health_check():
    """Health check endpoint for frontend to verify backend is running"""
    try:
        response = {
            "status": "healthy",
            "timestamp": time.time(),
            "video_converter_available": VIDEO_CONVERTER_AVAILABLE
        }

        # Only include video converter stats if it's available
        if VIDEO_CONVERTER_AVAILABLE:
            with download_lock:
                active_count = len([d for d in active_video_downloads.values() if not d.get('finished')])
                total_downloads = len(active_video_downloads)

            response.update({
                "active_downloads": active_count,
                "total_tracked": total_downloads,
                "watchdog_running": watchdog_running if 'watchdog_running' in globals() else False,
                "worker_pool_size": WORKER_POOL_SIZE if 'WORKER_POOL_SIZE' in globals() else 0
            })

        return response
    except Exception as e:
        return {
            "status": "degraded",
            "error": str(e),
            "timestamp": time.time()
        }


@router.post("/create_upload_session")
async def create_upload_session(request: Request, total_videos: int = Body(0), title: str = Body(None)):
    """Create a server-side upload session: frontend will upload converted files which the server will bundle into ZIP parts."""
    try:
        download_id = str(uuid4())
        client_ip = get_client_ip(request) if request else None

        bulk_dir = os.path.join(VIDEO_DOWNLOAD_DIR, f"bulk_{download_id}")
        os.makedirs(bulk_dir, exist_ok=True)

        zip_path = os.path.join(VIDEO_DOWNLOAD_DIR, f"playlist_upload_{int(time.time())}_{download_id}.zip")

        with download_lock:
            active_video_downloads[download_id] = {
                'status': 'downloading',
                'progress': 0.0,
                'platform': 'YouTube',
                'format': 'Bulk (uploaded)',
                'quality': None,
                'title': title or f'Upload session {download_id}',
                'output_path': zip_path,
                'bulk_dir': bulk_dir,
                'video_ids': [],
                'completed_videos': [],
                'total_videos': total_videos,
                'created_at': time.time(),
                'parts': [],
                'error': None,
                'finished': False,
                'file_path': None
            }

        video_logger.info(f"Created upload session {download_id} (total_videos={total_videos}) from IP {client_ip}")
        return JSONResponse({'success': True, 'download_id': download_id})
    except Exception as e:
        video_logger.error(f"Failed to create upload session: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/upload_part/{download_id}")
async def upload_part(download_id: str, files: List[UploadFile] = File(...), request: Request = None):
    """Accept uploaded files from frontend, create a ZIP part on the server, and register it for download."""
    with download_lock:
        if download_id not in active_video_downloads:
            raise HTTPException(status_code=404, detail="Upload session not found")
        entry = active_video_downloads[download_id]

    try:
        bulk_dir = entry.get('bulk_dir')
        if not bulk_dir:
            raise HTTPException(status_code=500, detail='Bulk directory not configured')

        saved_files = []
        for up in files:
            filename = up.filename or f'file_{int(time.time())}'
            safe = re.sub(r'[^\w\s\-\.()]', '_', filename)
            dest = os.path.join(bulk_dir, safe)
            with open(dest, 'wb') as out_f:
                content = await up.read()
                out_f.write(content)
            saved_files.append(dest)
            video_logger.info(f"Received uploaded file for {download_id}: {dest}")

        # Create ZIP part
        with download_lock:
            part_index = len(entry.get('parts') or []) + 1
            zip_base = entry.get('output_path') or os.path.join(VIDEO_DOWNLOAD_DIR, f"playlist_upload_{int(time.time())}_{download_id}.zip")
            part_name = f"{os.path.splitext(zip_base)[0]}_part{part_index}.zip"

        with zipfile.ZipFile(part_name, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for fpath in saved_files:
                if os.path.exists(fpath):
                    zipf.write(fpath, os.path.basename(fpath))

        video_logger.info(f"Created uploaded ZIP part for {download_id}: {part_name}")

        # Register part and set ready for download if needed
        with download_lock:
            parts = entry.get('parts') or []
            parts.append(part_name)
            entry['parts'] = parts
            entry['completed_videos'] = entry.get('completed_videos', []) + saved_files
            entry['completed_count'] = len(entry.get('completed_videos', []))
            # If no current file_path set, set this part as ready
            if not entry.get('file_path'):
                entry['file_path'] = part_name
                entry['status'] = 'completed'
                entry['finished'] = False

        # Clean up uploaded raw files  they've been archived
        for fpath in saved_files:
            try:
                delete_file_safe(fpath)
            except Exception:
                pass

        return JSONResponse({'success': True, 'part': part_name})
    except HTTPException:
        raise
    except Exception as e:
        video_logger.error(f"Error handling upload_part for {download_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/download/{download_id}")
async def download_converted_file(request: Request, download_id: str):
    """Download the converted file"""
    with download_lock:
        if download_id not in active_video_downloads:
            raise HTTPException(status_code=404, detail="Download ID not found")

        download_info = active_video_downloads[download_id]

        if download_info['status'] != 'completed':
            raise HTTPException(status_code=400, detail="Conversion not completed yet")

        if not download_info.get('file_path') or not os.path.exists(download_info['file_path']):
            raise HTTPException(status_code=404, detail="Converted file not found")

    file_path = download_info['file_path']
    filename = os.path.basename(file_path)

    # Clean filename for download
    if download_info.get('title'):
        safe_title = re.sub(r'[^\w\s-]', '', download_info['title']).strip()[:50]
        ext = os.path.splitext(filename)[1]
        filename = f"{safe_title}{ext}"

    # Capture client IP synchronously for bookkeeping (avoid using request inside BG task)
    client_ip = None
    try:
        client_ip = get_client_ip(request) if request else None
    except Exception:
        client_ip = None

    def bg_cleanup():
        # When serving a bulk with multiple parts, remove the served part and
        # advance the download entry to the next available part. If no parts
        # remain, remove the entry entirely.
        try:
            delete_file_safe(file_path)
        except Exception as e:
            video_logger.warning(f"Failed to delete file {file_path}: {e}")

        try:
            with download_lock:
                entry = active_video_downloads.get(download_id)
                if not entry:
                    return

                parts = entry.get('parts') or []
                # If multiple parts were created, remove the first (served) part
                if parts and file_path in parts:
                    try:
                        parts.remove(file_path)
                    except ValueError:
                        pass

                if parts:
                    # Set next part as ready for download
                    entry['file_path'] = parts[0]
                    entry['parts'] = parts
                    # Keep status as completed (ready to download). Do not mark finished here;
                    # the bulk worker controls when it is truly finished producing parts.
                    entry['status'] = 'completed'
                    video_logger.info(f"Advanced bulk download {download_id} to next part: {entry['file_path']}")
                else:
                    # No more parts currently available. Only remove the active entry if
                    # the background bulk worker has finished producing parts. If the
                    # worker is still running (finished == False or missing), keep the
                    # entry so it can register future parts and the client can poll status.
                    finished_flag = entry.get('finished', False)
                    if finished_flag:
                        try:
                            del active_video_downloads[download_id]
                        except KeyError:
                            pass
                    else:
                        # Worker still running  keep the entry but clear file_path so
                        # clients know there's no ready part yet; status should reflect
                        # ongoing processing.
                        entry['file_path'] = None
                        entry['parts'] = []
                        entry['status'] = 'downloading'
        except Exception as e:
            video_logger.warning(f"Error updating active video download record: {e}")

    def bg_cleanup_wrapper():
        try:
            bg_cleanup()
        finally:
            if client_ip:
                try:
                    decrement_video_rate_limit(client_ip)
                except Exception:
                    pass

    bg = BackgroundTask(bg_cleanup_wrapper)

    return FileResponse(
        file_path,
        filename=filename,
        media_type='application/octet-stream',
        background=bg
    )

# Video converter placeholder endpoints (if yt-dlp not available)
if not VIDEO_CONVERTER_AVAILABLE:
    @router.post("/validate", response_model=Dict[str, Any])
    async def validate_video_url_unavailable(request: VideoUrlValidation):
        raise HTTPException(status_code=503, detail="Video converter not available. Please install yt-dlp.")

    @router.post("/convert", response_model=Dict[str, Any])
    async def convert_video_unavailable(request: VideoConversionRequest):
        raise HTTPException(status_code=503, detail="Video converter not available. Please install yt-dlp.")

# ----------------------------------------------------
# Run the app
# ----------------------------------------------------
# Right before starting your main application