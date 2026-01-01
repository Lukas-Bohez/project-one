# Lofi Player Extension - Installation Guide

## Quick Install (Chrome/Chromium/Edge)

1. **Open Extensions Page**
   - Chrome: Navigate to `chrome://extensions/`
   - Edge: Navigate to `edge://extensions/`
   - Or click the Extensions icon (puzzle piece) → "Manage Extensions"

2. **Enable Developer Mode**
   - Toggle the "Developer mode" switch in the top right corner

3. **Load the Extension**
   - Click "Load unpacked"
   - Navigate to and select the `lofi-extension` folder:
     ```
     /home/student/Project/project-one/lofi-extension
     ```
   - Click "Select Folder"

4. **Verify Installation**
   - You should see "Lofi Player" in your extensions list
   - The extension icon should appear in your browser toolbar
   - Version: 0.2

## Using the Extension

### Bundled Mode (Default)
- Click the extension icon to open the player
- 29 lofi tracks are pre-loaded and ready to play
- Click any track to start playback
- Use playback controls: play/pause, next, previous
- Adjust volume with the slider
- Enable shuffle or repeat modes

### Files Mode
1. Click the extension icon
2. Change mode from "Bundled Lofi Tracks" to "Upload Music Files"
3. Choose one of:
   - **File Input**: Click "Choose Files" to select multiple audio files
   - **Folder Selection**: Click "Select Folder" to load all audio files from a directory

### Supported Audio Formats
- MP3 (.mp3)
- WAV (.wav)
- OGG (.ogg)
- M4A (.m4a)
- AAC (.aac)
- FLAC (.flac)

## Features

- ✅ 29 bundled lofi tracks
- ✅ Load your own music files
- ✅ Folder selection support
- ✅ Playback controls (play/pause/next/previous)
- ✅ Volume control with visual indicator
- ✅ Progress bar with seek functionality
- ✅ Shuffle mode
- ✅ Repeat modes (off/one/all)
- ✅ Click-to-play track list
- ✅ Persistent settings (survives browser restart)
- ✅ Background audio playback
- ✅ Now playing indicator
- ✅ Time display (current/duration)

## Troubleshooting

### Extension won't load
- Make sure Developer Mode is enabled
- Verify you selected the correct folder containing `manifest.json`
- Check browser console for errors

### Audio won't play
- Ensure audio files are in supported formats
- Check browser's audio permissions
- Verify volume is not at 0
- Try refreshing the extension

### Folder selection not working
- File System Access API requires Chrome 86+ or Edge 86+
- May not work in some browser configurations
- Use file input as alternative

### Settings not persisting
- Extension requires `storage` permission (already enabled)
- Check if browser storage is enabled

## Uninstalling

1. Go to `chrome://extensions/` (or `edge://extensions/`)
2. Find "Lofi Player"
3. Click "Remove"
4. Confirm removal

## Privacy

This extension:
- ✅ Does NOT make any network requests
- ✅ Does NOT collect any data
- ✅ Does NOT track your activity
- ✅ Only accesses files you explicitly select
- ✅ Stores settings locally in your browser

## Credits

Bundled lofi tracks sourced from Freesound.org under Creative Commons licenses.
See individual track metadata for artist attribution.
