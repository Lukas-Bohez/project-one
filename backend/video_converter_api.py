"""
Convert The Spire - Video Converter Backend API
Handles video downloading and conversion from multiple social media platforms
"""

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import yt_dlp
import os
import tempfile
import uuid
import threading
import time
from datetime import datetime, timedelta
import re
from urllib.parse import urlparse
import logging
from concurrent.futures import ProcessPoolExecutor
import json
import pickle
from pathlib import Path

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Simple API key protection for sensitive operations
VIDEO_API_KEY = os.getenv('VIDEO_API_KEY') or None

def require_video_api_key(req):
    """Check for API key in header 'X-API-KEY' or 'api_key' in JSON body."""
    if VIDEO_API_KEY is None:
        # No key configured; deny by default to avoid accidental public exposure
        return False
    header_key = req.headers.get('X-API-KEY')
    if header_key and header_key == VIDEO_API_KEY:
        return True
    try:
        data = req.get_json(silent=True) or {}
        if data.get('api_key') == VIDEO_API_KEY:
            return True
    except Exception:
        pass
    return False

# Configuration
DOWNLOAD_DIR = os.path.join(tempfile.gettempdir(), 'convert_the_spire')
JOBS_DB_FILE = os.path.join(DOWNLOAD_DIR, 'jobs.json')
CLEANUP_INTERVAL = 3600  # 1 hour
FILE_EXPIRY = 7200  # 2 hours
MAX_WORKERS = 2  # Limit concurrent video conversions to prevent CPU overload

# Ensure download directory exists
os.makedirs(DOWNLOAD_DIR, exist_ok=True)

# Create process pool for video conversions (isolated from main Flask thread)
executor = ProcessPoolExecutor(max_workers=MAX_WORKERS)

# URL patterns for platform validation
URL_PATTERNS = {
    'youtube': r'(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|embed|watch|shorts)\/|.*[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})',
    'tiktok': r'(?:tiktok\.com\/@[\w.-]+\/video\/|vm\.tiktok\.com\/|vt\.tiktok\.com\/)[\w.-]+',
    'instagram': r'(?:instagram\.com\/(?:p|reel|tv)\/[\w-]+)',
    'reddit': r'(?:reddit\.com\/r\/[\w]+\/comments\/[\w]+\/|v\.redd\.it\/[\w]+)',
    'facebook': r'(?:facebook\.com\/(?:[\w.-]+\/videos\/|watch\/?\?v=)|fb\.watch\/)[\w.-]+',
    'twitch': r'(?:twitch\.tv\/[\w]+\/clip\/[\w-]+|clips\.twitch\.tv\/[\w-]+)',
    'twitter': r'(?:twitter\.com\/[\w]+\/status\/\d+|x\.com\/[\w]+\/status\/\d+)'
}

# Active downloads tracking (with persistence)
active_downloads = {}
jobs_lock = threading.Lock()

def save_jobs():
    """Persist jobs to disk"""
    try:
        with jobs_lock:
            serializable_jobs = {}
            for job_id, job_data in active_downloads.items():
                serializable_jobs[job_id] = {
                    k: str(v) if isinstance(v, datetime) else v
                    for k, v in job_data.items()
                    if k != 'future'  # Don't serialize Future objects
                }
            with open(JOBS_DB_FILE, 'w') as f:
                json.dump(serializable_jobs, f)
    except Exception as e:
        logger.error(f"Error saving jobs: {e}")

def load_jobs():
    """Load jobs from disk"""
    try:
        if os.path.exists(JOBS_DB_FILE):
            with open(JOBS_DB_FILE, 'r') as f:
                return json.load(f)
    except Exception as e:
        logger.error(f"Error loading jobs: {e}")
    return {}

# Load existing jobs on startup
active_downloads = load_jobs()

def cleanup_old_files():
    """Remove old downloaded files"""
    while True:
        try:
            now = datetime.now()
            for filename in os.listdir(DOWNLOAD_DIR):
                filepath = os.path.join(DOWNLOAD_DIR, filename)
                if os.path.isfile(filepath):
                    file_age = now - datetime.fromtimestamp(os.path.getctime(filepath))
                    if file_age > timedelta(seconds=FILE_EXPIRY):
                        os.remove(filepath)
                        logger.info(f"Cleaned up old file: {filename}")
        except Exception as e:
            logger.error(f"Error during cleanup: {e}")
        
        time.sleep(CLEANUP_INTERVAL)

# Start cleanup thread
cleanup_thread = threading.Thread(target=cleanup_old_files, daemon=True)
cleanup_thread.start()

def detect_platform(url):
    """Detect platform from URL"""
    for platform, pattern in URL_PATTERNS.items():
        if re.search(pattern, url, re.IGNORECASE):
            return platform
    return None

def get_ydl_opts(format_type, quality, output_path):
    """Get yt-dlp options based on format and quality"""
    base_opts = {
        'outtmpl': output_path,
        'no_warnings': False,
        'extractaudio': format_type == 'audio',
        'ignoreerrors': True,
        'quiet': False,
        'no_color': True,
    }
    
    if format_type == 'audio':
        base_opts.update({
            'format': 'bestaudio/best',
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': str(quality),
            }]
        })
    else:  # video
        quality_map = {
            144: 'worst[height<=144]',
            360: 'best[height<=360]',
            480: 'best[height<=480]',
            720: 'best[height<=720]', 
            1080: 'best[height<=1080]'
        }
        base_opts['format'] = quality_map.get(quality, 'best[height<=720]')
    
    return base_opts

def download_video_worker(url, format_type, quality, output_path, download_id):
    """Worker function that runs in separate process for video conversion"""
    try:
        logger.info(f"Worker process started for {download_id}")
        
        ydl_opts = get_ydl_opts(format_type, quality, output_path)
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            
            result = {
                'status': 'completed',
                'title': info.get('title', 'Downloaded Video'),
                'duration': info.get('duration', 0),
                'file_path': ydl.prepare_filename(info)
            }
            
            logger.info(f"Worker process completed for {download_id}")
            return result
            
    except Exception as e:
        logger.error(f"Worker process error for {download_id}: {e}")
        return {
            'status': 'error',
            'error': str(e)
        }

@app.route('/api/validate-url', methods=['POST'])
def validate_url():
    """Validate URL and detect platform"""
    try:
        data = request.get_json()
        url = data.get('url', '').strip()
        
        if not url:
            return jsonify({'error': 'URL is required'}), 400
        
        platform = detect_platform(url)
        if not platform:
            return jsonify({'error': 'Unsupported URL format'}), 400
        
        return jsonify({
            'valid': True,
            'platform': platform,
            'message': f'Valid {platform.title()} URL detected'
        })
    
    except Exception as e:
        logger.error(f"URL validation error: {e}")
        return jsonify({'error': 'Validation failed'}), 500

@app.route('/api/get-video-info', methods=['POST'])
def get_video_info():
    """Get video information without downloading"""
    try:
        data = request.get_json()
        url = data.get('url', '').strip()
        
        if not url:
            return jsonify({'error': 'URL is required'}), 400
        
        platform = detect_platform(url)
        if not platform:
            return jsonify({'error': 'Unsupported URL format'}), 400
        
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            
            return jsonify({
                'title': info.get('title', 'Unknown Title'),
                'duration': info.get('duration', 0),
                'thumbnail': info.get('thumbnail'),
                'uploader': info.get('uploader', 'Unknown'),
                'platform': platform,
                'formats_available': len(info.get('formats', []))
            })
    
    except Exception as e:
        logger.error(f"Video info extraction error: {e}")
        return jsonify({'error': 'Failed to extract video information'}), 500

@app.route('/api/convert', methods=['POST'])
def convert_video():
    """Convert and download video (non-blocking using process pool)"""
    try:
        data = request.get_json()
        url = data.get('url', '').strip()
        format_type = 'audio' if data.get('format', 1) == 1 else 'video'
        quality = data.get('quality', 128 if format_type == 'audio' else 720)
        
        if not url:
            return jsonify({'error': 'URL is required'}), 400
        
        platform = detect_platform(url)
        if not platform:
            return jsonify({'error': 'Unsupported URL format'}), 400
        
        # Require API key for conversion
        if not require_video_api_key(request):
            return jsonify({'error': 'Unauthorized'}), 401
        
        # Generate unique filename
        download_id = str(uuid.uuid4())
        extension = 'mp3' if format_type == 'audio' else 'mp4'
        output_path = os.path.join(DOWNLOAD_DIR, f"{download_id}.%(ext)s")
        
        # Track download with initial state
        with jobs_lock:
            active_downloads[download_id] = {
                'status': 'queued',
                'progress': 0,
                'url': url,
                'format': format_type,
                'quality': quality,
                'platform': platform,
                'started_at': str(datetime.now()),
                'title': None,
                'duration': None,
                'file_path': None,
                'error': None
            }
            save_jobs()
        
        # Submit to process pool (runs in separate process, won't block Flask)
        future = executor.submit(
            download_video_worker,
            url, format_type, quality, output_path, download_id
        )
        
        # Add callback to update job status when done
        def job_done_callback(future):
            try:
                result = future.result()
                with jobs_lock:
                    if download_id in active_downloads:
                        active_downloads[download_id].update(result)
                        active_downloads[download_id]['progress'] = 100
                        save_jobs()
                logger.info(f"Job {download_id} completed with status: {result.get('status')}")
            except Exception as e:
                logger.error(f"Callback error for {download_id}: {e}")
                with jobs_lock:
                    if download_id in active_downloads:
                        active_downloads[download_id].update({
                            'status': 'error',
                            'error': str(e)
                        })
                        save_jobs()
        
        future.add_done_callback(job_done_callback)
        
        # Update status to processing
        with jobs_lock:
            active_downloads[download_id]['status'] = 'processing'
            save_jobs()
        
        logger.info(f"Video conversion job {download_id} queued for {platform}")
        
        return jsonify({
            'success': True,
            'download_id': download_id,
            'message': 'Download started in background process'
        })
        
    except Exception as e:
        logger.error(f"Conversion error: {e}")
        return jsonify({'error': 'Conversion failed'}), 500

@app.route('/api/status/<download_id>', methods=['GET'])
def get_download_status(download_id):
    """Get download status"""
    with jobs_lock:
        if download_id not in active_downloads:
            return jsonify({'error': 'Download not found'}), 404
        
        download_info = active_downloads[download_id].copy()
    
    # Remove sensitive internal information
    download_info.pop('file_path', None)
    download_info.pop('future', None)
    
    return jsonify(download_info)

@app.route('/api/download/<download_id>', methods=['GET'])
def download_file(download_id):
    """Download the converted file"""
    # Require API key for downloading files
    if not require_video_api_key(request):
        return jsonify({'error': 'Unauthorized'}), 401

    with jobs_lock:
        if download_id not in active_downloads:
            return jsonify({'error': 'Download not found'}), 404
        
        download_info = active_downloads[download_id].copy()
    
    if download_info['status'] != 'completed':
        return jsonify({'error': 'Download not ready', 'status': download_info['status']}), 400
    
    if not download_info.get('file_path'):
        return jsonify({'error': 'File not available'}), 404
    
    file_path = download_info['file_path']
    
    if not os.path.exists(file_path):
        return jsonify({'error': 'File no longer available'}), 404
    
    # Determine filename for download
    title = download_info.get('title', 'converted_file')
    # Clean title for filename
    clean_title = re.sub(r'[^\w\s-]', '', title)[:50]
    extension = 'mp3' if download_info['format'] == 'audio' else 'mp4'
    download_filename = f"{clean_title}.{extension}"
    
    try:
        return send_file(
            file_path,
            as_attachment=True,
            download_name=download_filename,
            mimetype='audio/mpeg' if extension == 'mp3' else 'video/mp4'
        )
    except Exception as e:
        logger.error(f"File send error: {e}")
        return jsonify({'error': 'File send failed'}), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    with jobs_lock:
        active_count = len([j for j in active_downloads.values() if j['status'] in ['queued', 'processing']])
        completed_count = len([j for j in active_downloads.values() if j['status'] == 'completed'])
        error_count = len([j for j in active_downloads.values() if j['status'] == 'error'])
    
    return jsonify({
        'status': 'healthy',
        'total_jobs': len(active_downloads),
        'active_jobs': active_count,
        'completed_jobs': completed_count,
        'failed_jobs': error_count,
        'max_workers': MAX_WORKERS
    })

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500

@app.before_request
def check_executor():
    """Ensure executor is available"""
    global executor
    if executor._shutdown:
        logger.warning("Executor was shutdown, recreating...")
        executor = ProcessPoolExecutor(max_workers=MAX_WORKERS)

def shutdown_executor():
    """Gracefully shutdown the process pool"""
    logger.info("Shutting down video conversion process pool...")
    executor.shutdown(wait=True, cancel_futures=True)
    logger.info("Process pool shutdown complete")

import atexit
atexit.register(shutdown_executor)

if __name__ == '__main__':
    print("Starting Convert The Spire Backend API...")
    print(f"Download directory: {DOWNLOAD_DIR}")
    print(f"Max concurrent conversions: {MAX_WORKERS}")
    print(f"Job persistence: {JOBS_DB_FILE}")
    
    try:
        app.run(debug=True, host='0.0.0.0', port=5001)
    finally:
        shutdown_executor()