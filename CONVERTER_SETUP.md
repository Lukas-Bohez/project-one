# Convert The Spire - Setup Instructions

## Backend Setup (Video Converter API)

### Prerequisites
- Python 3.8 or higher
- FFmpeg installed on system
- Node.js (for frontend)

### Installation Steps

1. **Install Python Dependencies**
   ```bash
   cd backend
   pip install -r requirements_converter.txt
   ```

2. **Install FFmpeg**
   
   **Ubuntu/Debian:**
   ```bash
   sudo apt update
   sudo apt install ffmpeg
   ```
   
   **macOS:**
   ```bash
   brew install ffmpeg
   ```
   
   **Windows:**
   Download from https://ffmpeg.org/download.html

3. **Start the Backend API**
   ```bash
   cd backend
   python video_converter_api.py
   ```
   
   The API will start on `http://localhost:5001`

4. **Configure Frontend**
   
   Update the API_BASE_URL in `/frontend/js/converter.js` if needed:
   ```javascript
   const API_BASE_URL = 'http://localhost:5001/api';
   ```

### API Endpoints

- `POST /api/validate-url` - Validate video URL
- `POST /api/get-video-info` - Get video information  
- `POST /api/convert` - Start video conversion
- `GET /api/status/<id>` - Check conversion status
- `GET /api/download/<id>` - Download converted file
- `GET /api/health` - Health check

### Supported Platforms

- ✅ YouTube (videos, shorts, live streams)
- ✅ TikTok 
- ✅ Instagram (reels, videos)
- ✅ Reddit (v.redd.it links)
- ✅ Facebook (public videos)
- ✅ Twitch (clips)
- ✅ Twitter/X (videos)

### Quality Options

**Audio (MP3):**
- 96 kbps
- 128 kbps (default)
- 256 kbps  
- 320 kbps

**Video (MP4):**
- 144p
- 360p
- 480p
- 720p (default)
- 1080p

### Production Deployment

For production deployment:

1. **Use a WSGI server:**
   ```bash
   pip install gunicorn
   gunicorn -w 4 -b 0.0.0.0:5001 video_converter_api:app
   ```

2. **Set up reverse proxy (nginx):**
   ```nginx
   location /api/ {
       proxy_pass http://localhost:5001/api/;
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
   }
   ```

3. **Environment variables:**
   ```bash
   export FLASK_ENV=production
   export DOWNLOAD_DIR=/var/tmp/convert_the_spire
   ```

### Security Notes

- The API includes CORS headers for cross-origin requests
- Downloaded files are automatically cleaned up after 2 hours
- No user data is stored or logged
- All downloads are temporary and ephemeral

### Troubleshooting

**Common Issues:**

1. **FFmpeg not found:**
   - Ensure FFmpeg is installed and in PATH
   - Try: `ffmpeg -version`

2. **yt-dlp errors:**
   - Update yt-dlp: `pip install --upgrade yt-dlp`
   - Some platforms may block requests - this is normal

3. **CORS errors:**
   - Check if backend is running on correct port
   - Verify API_BASE_URL in frontend

4. **Download fails:**
   - Check file permissions in download directory
   - Ensure sufficient disk space

### Performance Tips

- Use SSD storage for download directory
- Consider implementing Redis for caching
- Monitor disk usage for cleanup
- Use CDN for frontend assets

### Legal Notice

This tool is for educational and personal use only. Users are responsible for complying with platform terms of service and copyright laws. Always respect content creators' rights and platform policies.