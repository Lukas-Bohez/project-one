"""
Video Converter Module
Handles YouTube video downloads with yt-dlp, metadata embedding, and Invidious fallback
"""

import os
import time
import random
import re
import threading
import logging
from typing import Dict, Any, Optional
from io import BytesIO

# Import yt-dlp
try:
    import yt_dlp
except ImportError:
    yt_dlp = None

# Import metadata libraries
try:
    from mutagen.easyid3 import EasyID3
    from mutagen.id3 import ID3, APIC, USLT, TIT2, TPE1, TALB, ID3NoHeaderError
    from mutagen.mp4 import MP4, MP4Cover
    from PIL import Image
    MUTAGEN_AVAILABLE = True
except Exception:
    MUTAGEN_AVAILABLE = False

# Setup logger
video_logger = logging.getLogger('video_converter')

# User agent rotation for anti-bot
USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
]

def get_random_user_agent() -> str:
    """Get a random user agent to avoid detection"""
    return random.choice(USER_AGENTS)


# Invidious health tracking
invidious_health = {}
invidious_health_lock = threading.Lock()

def update_invidious_health(instance: str, success: bool):
    """Track instance health to prioritize working instances"""
    with invidious_health_lock:
        if instance not in invidious_health:
            invidious_health[instance] = {
                'success_count': 0,
                'fail_count': 0,
                'last_success': 0,
                'last_fail': 0
            }
        
        if success:
            invidious_health[instance]['success_count'] += 1
            invidious_health[instance]['last_success'] = time.time()
        else:
            invidious_health[instance]['fail_count'] += 1
            invidious_health[instance]['last_fail'] = time.time()


def get_healthy_invidious_instances(invidious_instances: list) -> list:
    """Get Invidious instances sorted by health (best first)"""
    with invidious_health_lock:
        scored_instances = []
        current_time = time.time()
        
        for instance in invidious_instances:
            health = invidious_health.get(instance, {
                'success_count': 0,
                'fail_count': 0,
                'last_success': 0,
                'last_fail': 0
            })
            
            success_count = health['success_count']
            fail_count = health['fail_count']
            last_success = health['last_success']
            last_fail = health['last_fail']
            
            recency_bonus = 100 if (current_time - last_success) < 300 else 0
            recent_fail_penalty = -50 if (current_time - last_fail) < 60 else 0
            
            total = success_count + fail_count
            success_rate = (success_count / total * 100) if total > 0 else 50
            
            score = success_rate + recency_bonus + recent_fail_penalty
            scored_instances.append((instance, score))
        
        scored_instances.sort(key=lambda x: x[1], reverse=True)
        return [inst for inst, score in scored_instances]


def get_ydl_opts(format_type: str, quality: int, output_path: str, 
                 cookie_file: Optional[str] = None,
                 is_age_restricted: bool = False, 
                 use_invidious: bool = False, 
                 invidious_instance: str = None) -> Dict[str, Any]:
    """Get yt-dlp options with metadata embedding enabled
    
    Args:
        format_type: 'audio' or 'video'
        quality: Quality setting
        output_path: Where to save the file
        cookie_file: Path to cookies.txt file
        is_age_restricted: Whether content is age-restricted
        use_invidious: Whether to use Invidious proxy
        invidious_instance: Specific Invidious instance URL
    """
    base_opts = {
        'outtmpl': output_path,
        'no_warnings': False,
        'extractaudio': format_type == 'audio',
        'ignoreerrors': False,
        'nocheckcertificate': True,
        'quiet': False,
        'no_color': True,
        'extractor_retries': 5,
        'fragment_retries': 5,
        'skip_unavailable_fragments': True,
        'keepvideo': False,
        'retries': 8,
        'file_access_retries': 3,
        'sleep_interval': 2,
        'max_sleep_interval': 8,
        'socket_timeout': 30,
        'sleep_interval_requests': 1.0,
        'sleep_interval_subtitles': 1.0,
        'http_chunk_size': 10485760,
        'concurrent_fragment_downloads': 2,
        'source_address': '0.0.0.0',
        # Enable thumbnail download and embedding
        'writethumbnail': True,
        'embedthumbnail': True,
        'postprocessors': [{
            'key': 'FFmpegMetadata',
        }],
    }
    
    # Use Invidious proxy if requested
    if use_invidious and invidious_instance:
        base_opts['extractor_args'] = {
            'youtube': {
                'player_client': ['android', 'web'],
            }
        }
    
    # Add cookies if available
    if cookie_file and os.path.exists(cookie_file):
        base_opts['cookiefile'] = cookie_file
    
    # Age-restricted content
    if is_age_restricted:
        base_opts['age_limit'] = 18
    
    # Browser-like headers
    user_agent = get_random_user_agent()
    is_chrome = 'Chrome' in user_agent and 'Edg' not in user_agent
    
    headers = {
        'User-Agent': user_agent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
    }
    
    if is_chrome:
        headers.update({
            'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
        })
    
    base_opts['http_headers'] = headers
    
    # Format-specific options
    if format_type == 'audio':
        base_opts['format'] = 'bestaudio/best'
        base_opts['postprocessors'].append({
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': str(quality),
        })
    else:
        height = quality
        base_opts['format'] = f'bestvideo[height<={height}]+bestaudio/best[height<={height}]'
    
    return base_opts


def is_valid_media_file(file_path: str) -> bool:
    """Check if file is actually a media file (not HTML error page)"""
    try:
        with open(file_path, 'rb') as f:
            header = f.read(64)
        
        header_str = header.decode('utf-8', errors='ignore').lower()
        if '<!doctype' in header_str or '<html' in header_str or '<head' in header_str:
            return False
        
        # Check for media file signatures
        if header.startswith(b'ftyp'):  # MP4, M4A
            return True
        if header.startswith(b'ID3'):  # MP3 with ID3
            return True
        if header.startswith(b'\xff\xfb') or header.startswith(b'\xff\xf3') or header.startswith(b'\xff\xf2'):  # MP3
            return True
        if header.startswith(b'\x1a\x45\xdf\xa3'):  # WebM/MKV
            return True
        
        return False
    except Exception:
        return False


def get_valid_downloaded_files(output_path: str, format_type: str, temp_dir: str) -> list[str]:
    """Get list of valid downloaded media files"""
    base_pattern = os.path.basename(output_path.replace('.%(ext)s', ''))
    
    skip_extensions = ('.ytdl', '.part', '.temp', '.tmp', '.download', '.aria2', '.f')
    html_extensions = ('.html', '.mhtml', '.htm')
    
    valid_files = []
    try:
        all_files = os.listdir(temp_dir)
    except:
        return []
    
    for filename in all_files:
        if not filename.startswith(base_pattern):
            continue
        
        if any(filename.endswith(ext) for ext in skip_extensions):
            continue
        
        if any(filename.endswith(ext) for ext in html_extensions):
            continue
        
        file_path = os.path.join(temp_dir, filename)
        try:
            if os.path.getsize(file_path) < 1024:
                continue
        except:
            continue
        
        if not is_valid_media_file(file_path):
            continue
        
        valid_files.append(file_path)
    
    return valid_files


def try_invidious_download(url: str, format_type: str, quality: int, output_path: str,
                           temp_dir: str, invidious_instances: list,
                           cookie_file: Optional[str] = None) -> tuple[bool, Optional[Dict], Optional[str]]:
    """Try downloading via Invidious instances as fallback
    
    Returns:
        (success: bool, info: Dict, error: str)
    """
    video_logger.info(f"🌐 Starting Invidious fallback for {url}")
    sorted_instances = get_healthy_invidious_instances(invidious_instances)
    video_logger.info(f"🌐 Found {len(sorted_instances)} Invidious instances to try")
    
    for i, instance in enumerate(sorted_instances):
        try:
            video_logger.info(f"🌐 Trying Invidious instance {i+1}/{len(sorted_instances)}: {instance}")
            
            # Extract video ID
            video_id = None
            if 'youtu.be/' in url:
                video_id = url.split('youtu.be/')[-1].split('?')[0]
            elif 'watch?v=' in url:
                video_id = url.split('watch?v=')[-1].split('&')[0]
            
            if not video_id:
                video_logger.warning(f"🌐 Could not extract video ID from {url}")
                continue
            
            invidious_url = f"{instance}/watch?v={video_id}"
            video_logger.info(f"🌐 Invidious URL: {invidious_url}")
            
            # Try download with Invidious
            ydl_opts = get_ydl_opts(format_type, quality, output_path, cookie_file=cookie_file,
                                   use_invidious=True, invidious_instance=instance)
            # Disable thumbnail for Invidious (not supported well)
            ydl_opts['writethumbnail'] = False
            ydl_opts['embedthumbnail'] = False
            ydl_opts.pop('postprocessors', None)  # Remove post processors for Invidious
            
            video_logger.info(f"🌐 Starting download from {instance}...")
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(invidious_url, download=True)
                
                # Validate downloaded files
                video_logger.info(f"🌐 Validating downloaded files...")
                valid_files = get_valid_downloaded_files(output_path, format_type, temp_dir)
                if not valid_files:
                    video_logger.warning(f"🌐 No valid files from {instance}")
                    update_invidious_health(instance, success=False)
                    continue
                
                video_logger.info(f"✅ Invidious download succeeded from {instance}")
                update_invidious_health(instance, success=True)
                return True, info, None
                
        except Exception as e:
            video_logger.warning(f"❌ Invidious instance {instance} failed: {str(e)}")
            update_invidious_health(instance, success=False)
            continue
    
    video_logger.error(f"💀 All {len(sorted_instances)} Invidious instances failed")
    return False, None, "All Invidious fallback instances failed"


def apply_metadata(file_path: str, info: Dict[str, Any], base_pattern: str, 
                   temp_dir: str, format_type: str = 'audio'):
    """Apply metadata (title, artist/uploader, album), embed cover art and lyrics
    
    Args:
        file_path: Path to the media file
        info: Video metadata dict from yt-dlp
        base_pattern: Base filename pattern for finding thumbnails
        temp_dir: Directory containing the file and thumbnails
        format_type: 'audio' or 'video'
    """
    try:
        if not MUTAGEN_AVAILABLE:
            video_logger.debug("Mutagen or Pillow not available; skipping metadata embedding")
            return

        ext = os.path.splitext(file_path)[1].lower()
        
        # Get metadata - prioritize uploader/channel as artist
        title = info.get('title') or None
        artist = info.get('uploader') or info.get('channel') or info.get('artist') or None
        album = info.get('album') or None

        # Find thumbnail
        thumbnail_path = None
        for filename in os.listdir(temp_dir):
            if filename.startswith(os.path.basename(base_pattern)):
                low = filename.lower()
                if low.endswith(('.jpg', '.jpeg', '.png', '.webp')):
                    thumbnail_path = os.path.join(temp_dir, filename)
                    break

        # Find subtitle file for lyrics
        subtitle_path = None
        for filename in os.listdir(temp_dir):
            if filename.startswith(os.path.basename(base_pattern)) and filename.lower().endswith(('.srt', '.vtt', '.txt')):
                subtitle_path = os.path.join(temp_dir, filename)
                break

        # Apply tags for MP3
        if ext in ('.mp3',):
            try:
                try:
                    id3 = ID3(file_path)
                except ID3NoHeaderError:
                    id3 = ID3()

                if title:
                    id3.add(TIT2(encoding=3, text=title))
                if artist:
                    id3.add(TPE1(encoding=3, text=artist))
                if album:
                    id3.add(TALB(encoding=3, text=album))

                # Embed cover art
                if thumbnail_path and os.path.exists(thumbnail_path):
                    try:
                        with Image.open(thumbnail_path) as im:
                            bio = BytesIO()
                            if im.format == 'WEBP':
                                im = im.convert('RGB')
                                im.save(bio, format='JPEG')
                                mime = 'image/jpeg'
                            else:
                                im.save(bio, format=im.format)
                                mime = Image.MIME.get(im.format, 'image/jpeg')
                            bio.seek(0)
                            id3.add(APIC(encoding=3, mime=mime, type=3, desc='Cover', data=bio.read()))
                    except Exception as e:
                        video_logger.warning(f"Failed to embed cover art: {e}")

                # Embed lyrics from subtitle
                if subtitle_path and os.path.exists(subtitle_path):
                    try:
                        with open(subtitle_path, 'r', encoding='utf-8', errors='ignore') as sf:
                            srt = sf.read()
                        lyrics = re.sub(r"\r\n|\r|\n", "\n", srt)
                        lyrics = re.sub(r"\d+\n", "", lyrics)
                        lyrics = re.sub(r"\d{2}:\d{2}:\d{2},\d{3} --> .*\n", "", lyrics)
                        lyrics_text = lyrics.strip()
                        if lyrics_text:
                            id3.add(USLT(encoding=3, lang='eng', desc='lyrics', text=lyrics_text))
                    except Exception as e:
                        video_logger.warning(f"Failed to embed lyrics: {e}")

                try:
                    id3.save(file_path)
                except Exception as e:
                    video_logger.warning(f"Failed to save ID3 tags: {e}")
            except Exception as e:
                video_logger.warning(f"MP3 metadata embedding error: {e}")

        # Apply tags for MP4/M4A
        elif ext in ('.m4a', '.mp4'):
            try:
                mp4 = MP4(file_path)
                if title:
                    mp4['\xa9nam'] = title
                if artist:
                    mp4['\xa9ART'] = artist
                if album:
                    mp4['\xa9alb'] = album

                # Embed cover art
                if thumbnail_path and os.path.exists(thumbnail_path):
                    try:
                        with open(thumbnail_path, 'rb') as tf:
                            img = tf.read()
                        fmt = MP4Cover.FORMAT_JPEG
                        if thumbnail_path.lower().endswith('.png'):
                            fmt = MP4Cover.FORMAT_PNG
                        mp4['covr'] = [MP4Cover(img, imageformat=fmt)]
                    except Exception as e:
                        video_logger.warning(f"Failed to embed MP4 cover art: {e}")

                # Embed lyrics
                if subtitle_path and os.path.exists(subtitle_path):
                    try:
                        with open(subtitle_path, 'r', encoding='utf-8', errors='ignore') as sf:
                            srt = sf.read()
                        lyrics = re.sub(r"\r\n|\r|\n", "\n", srt)
                        lyrics = re.sub(r"\d+\n", "", lyrics)
                        lyrics = re.sub(r"\d{2}:\d{2}:\d{2},\d{3} --> .*\n", "", lyrics)
                        lyrics_text = lyrics.strip()
                        if lyrics_text:
                            mp4['\xa9lyr'] = lyrics_text
                    except Exception as e:
                        video_logger.warning(f"Failed to embed MP4 lyrics: {e}")

                try:
                    mp4.save()
                except Exception as e:
                    video_logger.warning(f"Failed to save MP4 tags: {e}")
            except Exception as e:
                video_logger.warning(f"MP4 metadata embedding error: {e}")

    except Exception as e:
        video_logger.warning(f"apply_metadata encountered an error: {e}")
