# Convert the Spire - YouTube Converter Extension

A powerful Chrome extension to convert YouTube videos and playlists to MP3/MP4 with automatic batch processing and user-selectable storage locations.

## Features

### Core Functionality
- **Single Video Conversion**: Convert individual YouTube videos to MP3 or MP4
- **Playlist Support**: Automatically detect and convert entire YouTube playlists
- **Batch Processing**: Process multiple videos sequentially with progress tracking
- **Variable Quality Options**: Choose from best quality down to 360p
- **Format Selection**: Convert to MP3 (audio) or MP4 (video)

### Advanced Features
- **User-Selectable Storage**: Choose custom download directories
- **Progress Tracking**: Real-time progress bars and queue status
- **Retry Logic**: Automatic retry on failures with configurable settings
- **Settings Persistence**: Save preferences across browser sessions
- **Queue Management**: Visual queue display with status indicators

### Reliability Features
- **Error Handling**: Comprehensive error handling with user-friendly messages
- **Retry Mechanism**: Configurable retry attempts and delays
- **Status Monitoring**: Real-time status updates during conversion
- **Conflict Resolution**: Automatic filename uniquification

## Installation

1. Download the extension files
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension folder
5. The extension will appear in your browser toolbar

## Usage

### Single Video Conversion
1. Navigate to any YouTube video
2. Click the "Convert the Spire" extension icon
3. Select your desired format (MP4/MP3) and quality
4. Choose a download location (optional)
5. Click "Convert & Download"

### Playlist Conversion
1. Navigate to a YouTube playlist
2. Click the extension icon - it will automatically detect the playlist
3. Configure your settings (format, quality, download location)
4. Click "Convert & Download" to process all videos in the playlist
5. Monitor progress in the queue display

### Settings Configuration
- Click the "⚙️ Settings" button to access advanced options
- Configure maximum retry attempts (1-10)
- Set retry delay in seconds (1-60)
- Settings are automatically saved

## Technical Details

### Permissions Required
- `activeTab`: Access current YouTube tab
- `cookies`: Retrieve YouTube authentication cookies
- `tabs`: Monitor tab changes
- `storage`: Save user preferences
- `downloads`: Handle file downloads
- `downloads.shelf`: Enhanced download management

### Host Permissions
- `https://api.y2mate.com/*`: Conversion service API
- `https://www.youtube.com/*`: YouTube page access

### File Structure
```
Extension-Converter/
├── manifest.json          # Extension configuration
├── popup.html            # Main UI interface
├── popup.js              # Main logic and API calls
├── background.js         # Service worker (minimal)
├── content.js            # Content script for YouTube pages
├── icons/                # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md            # This documentation
```

## Limitations

- Maximum 50 videos per playlist (to prevent abuse)
- Requires active internet connection
- Dependent on third-party conversion service availability
- Large playlists may take significant time to process

## Privacy & Security

- **No Data Storage**: The extension does not store any personal data
- **Third-Party Service**: Uses y2mate.com API for conversion processing
- **Cookie Usage**: Sends YouTube cookies only for authentication (same as browser)
- **Network Traffic**: Only sends video URLs and necessary metadata
- **Local Processing**: All settings stored locally in browser storage

## Troubleshooting

### Common Issues
- **"Not on YouTube page"**: Ensure you're on a YouTube video or playlist URL
- **Conversion failures**: Check internet connection and retry
- **Download issues**: Verify download permissions and available disk space

### Error Recovery
- Failed conversions automatically retry based on settings
- Progress is tracked even if popup is closed
- Queue status persists across browser sessions

## Version History

### Version 2.0
- Complete UI redesign with modern interface
- Playlist support with automatic detection
- Batch processing with progress tracking
- User-selectable download locations
- Configurable retry logic and settings
- Enhanced error handling and status reporting
- Rebranded to "Convert the Spire"

### Version 1.0
- Basic single video conversion
- MP3/MP4 format support
- Variable quality options
- Simple UI interface

## Support

For issues or feature requests, please check the troubleshooting section above. The extension is designed to be reliable and user-friendly, with comprehensive error handling and recovery mechanisms.