# Convert the Spire - YouTube Downloader Extension

A Chrome extension for downloading YouTube videos in various formats, branded for Convert the Spire.

## Features

- 🎥 Download YouTube videos in multiple formats (MP4, WebM)
- 🎵 Extract audio as MP3
- ⚡ One-click downloads
- 🎨 Convert the Spire themed UI
- 📱 Support for regular videos and Shorts

## Installation

### Chrome/Chromium/Edge

1. Download `ConvertTheSpire-Chrome.zip` from `/frontend/downloads/`
2. Unzip the file
3. Open Chrome and navigate to `chrome://extensions/`
4. Enable "Developer mode" (toggle in top right)
5. Click "Load unpacked"
6. Select the unzipped `Extension-Converter` folder
7. The extension icon should appear in your toolbar

## Usage

1. Navigate to any YouTube video page
2. Click the Convert the Spire extension icon
3. Choose your desired format
4. The download will start automatically

**Note:** If you see "Extension not ready" message, refresh the YouTube page and try again.

## Tech Stack

- Manifest V2 (Chrome Extension)
- JavaScript ES6+
- Bootstrap 4 (UI framework)
- jQuery (DOM manipulation)

## Files Structure

```
Extension-Converter/
├── manifest.json          # Extension configuration
├── icons/                 # Convert the Spire branded icons
├── includes/              # Core functionality
│   ├── background.js      # Download handler
│   ├── youtube-video-downloader.js  # Stream extraction
│   ├── common.js          # Utilities
│   └── ui.js             # UI components
├── popup/                 # Extension popup
│   ├── popup.html        # Styled UI
│   ├── popup.js          # Popup logic
│   └── message.js        # Content script messaging
└── options/              # Settings page
    └── options.html
```

## Build

To rebuild the distributable zip:

```bash
./scripts/update_convert_zip_chrome.sh
```

Output: `/frontend/downloads/ConvertTheSpire-Chrome.zip`

## Version

19.1 - Based on proven YouTube downloader with Convert the Spire branding

## Notes

- This is a **Chrome extension** (not Firefox)
- Requires Developer mode for installation
- Content scripts inject on YouTube pages only
- Downloads handled through Chrome's native download API
