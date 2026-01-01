# Convert the Spire - YouTube Converter Extension

**⚠️ Browser Compatibility** - This extension requires a browser with Manifest V2 support due to Manifest V3 restrictions on downloading YouTube content.

A powerful Firefox extension to convert YouTube videos and playlists to MP3/MP4 with automatic batch processing and user-selectable storage locations.

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
- **Tabbed Interface**: Organized Main, Debug Logs, and Settings tabs
- **Comprehensive Logging**: Detailed debug logging with export functionality
- **Shorts Support**: Full support for YouTube Shorts with metadata extraction
- **Enhanced Reliability**: Local YouTube data extraction instead of external APIs

### Reliability Features
- **Error Handling**: Comprehensive error handling with user-friendly messages
- **Retry Mechanism**: Configurable retry attempts and delays
- **Status Monitoring**: Real-time status updates during conversion
- **Conflict Resolution**: Automatic filename uniquification
- **Debug Logging**: Extensive logging for troubleshooting and development

## Installation

### For Firefox

1. Download the extension files
2. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`
3. Click "Load Temporary Add-on..."
4. Select the `manifest.json` file from the extension folder
5. The extension will appear in your browser toolbar

**Note:** This extension must be loaded as a temporary add-on in Firefox. It will need to be reloaded after each Firefox restart.

### Why Firefox Only?

Chrome's Manifest V3 severely restricts the ability to download content from YouTube and other platforms. This extension uses Firefox's Manifest V2, which still allows the necessary permissions to download and convert YouTube content.

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

### Version 2.2
- **Complete UI Redesign**: Tabbed interface with Main, Debug Logs, and Settings tabs
- **Comprehensive Debug Logging**: Extensive logging throughout the extension with export functionality
- **Enhanced YouTube Support**: Full Shorts support with proper metadata extraction
- **Improved Reliability**: Local YouTube data extraction instead of external APIs
- **Better Error Handling**: Enhanced retry logic and error recovery
- **Thumbnail Display**: Visual video selection with thumbnail previews
- **Export Logs**: Ability to export debug logs for troubleshooting

### Version 2.1
- Added comprehensive debug logging system
- Enhanced YouTube data extraction
- Improved error handling
- Added Shorts support

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