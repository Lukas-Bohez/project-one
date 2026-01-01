Lofi Player Extension

A lightweight Chrome/Chromium extension that plays lofi music and videos in a standalone, always-available window.

## ✨ Features

### Core Functionality
- **Standalone Window** - Opens in its own window, keeps playing when you switch tabs
- **Bundled Tracks** - 29 pre-loaded lofi tracks ready to play
- **User Files** - Load your own audio/video files or entire folders
- **Video Support** - Play MP4 and WebM videos with inline player
- **Album Art** - Automatically extracts and displays album art from audio files
- **Smart Thumbnails** - Shows artwork in track list and main view (only when present)

### Supported Formats
- **Audio**: MP3, WAV, OGG, M4A, AAC, FLAC
- **Video**: MP4, WebM
- **Metadata**: Automatic extraction from MP3, M4A, AAC files

### Playback Features
- Play/Pause, Next, Previous controls
- Progress bar with seek functionality
- Volume control with visual indicator
- Shuffle mode
- Repeat modes (off/one/all)
- Click-to-play track list
- Auto-advance when track ends
- Persistent settings (survives browser restart)

## 📥 Installation (Developer Mode)

1. Download or clone this repository
2. In Chrome/Chromium navigate to `chrome://extensions`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the `lofi-extension` folder
6. Click the extension icon to open the player window

## 🎵 Usage

### Opening the Player
- Click the extension icon in your browser toolbar
- A window opens (400x650px)
- If already open, clicking the icon focuses the window

### Bundled Mode (Default)
- 29 lofi tracks pre-loaded and ready
- Click any track to start playback
- Tracks load automatically on startup

### Files Mode
1. Switch to "Upload Music Files" in mode selector
2. **Select Files**: Choose multiple audio/video files
3. **Select Folder**: Load entire music folder
4. Files are sorted alphabetically
5. Metadata and thumbnails extracted automatically
6. Click "Clear Files" to remove loaded files

### Video Playback
- Load MP4 or WebM files
- Video player appears at top when playing video
- Native video controls + custom progress bar
- Video icon (🎬) shows in track list

### Album Art
- Automatically extracted from MP3, M4A, AAC files
- Shows 40x40px thumbnail in track list
- Large 200x200px display when playing
- Only visible when art is present (clean UI)

## 🔧 Recent Updates

### Version 0.3 (2026-01-01) - Major Upgrade
- **Standalone Window Mode** - No more popup, persistent player window
- **MP4/Video Support** - Play videos alongside audio
- **Album Art Extraction** - Automatic thumbnail display
- **Simplified Architecture** - Removed offscreen document complexity
- **Better Performance** - Direct media playback, less memory usage
- **Improved File Support** - MP4, WebM, better metadata extraction

### Version 0.2.1 (2026-01-01)
- Fixed folder selection using webkitdirectory
- Removed startup auto-play
- Improved file loading with better error handling
- Enhanced status messages and UI feedback

### Version 0.2 (2025-12-31)
- Fixed message passing between scripts
- Resolved variable scoping issues
- Added promisified runtime messaging
- Updated extension icons

## 💡 Tips & Tricks

**Window Management:**
- Minimize window to system tray (keeps playing)
- Resize window if needed (not recommended < 400px wide)
- Close window to stop playback completely

**File Organization:**
- Files are automatically sorted alphabetically
- Use descriptive filenames for better organization
- Metadata titles override filenames when available

**Performance:**
- Large folders (100+ files) may take a moment to load
- Metadata extraction adds ~100-200ms per file
- Videos use more resources than audio

**Privacy:**
- No network requests made
- No data collection or tracking
- Files stay local, not uploaded anywhere
- User files must be re-selected each session (security)

## 🛠️ Technical Details

**Architecture:**
- Extension icon → Opens standalone window
- Direct HTML5 audio/video playback
- jsmediatags library for metadata extraction
- Chrome Storage API for settings persistence
- No offscreen documents or complex message passing

**Browser Compatibility:**
- Chrome 86+
- Edge 86+
- Opera 72+
- Brave 1.17+
- Any Chromium-based browser with Manifest V3 support

**File Limitations:**
- Folder selection requires `webkitdirectory` support
- Thumbnail extraction: MP3, M4A, AAC only
- Video codecs: browser-dependent (H.264/WebM recommended)
- User files not persisted across sessions (by design)

## 📝 Adding Bundled Tracks

To add more bundled tracks:

1. Place audio/video files in `lofi/` folder
2. Edit `assets/tracks.json`:
```json
{
  "file": "yourtrack.mp3",
  "title": "Your Track Title",
  "artist": "Artist Name"
}
```
3. Reload extension

## 🐛 Troubleshooting

**Window won't open:**
- Reload extension on chrome://extensions
- Check for console errors
- Try removing and re-adding extension

**Files won't play:**
- Verify format is supported (MP3, WAV, OGG, MP4, etc.)
- Check browser console for errors
- Ensure files aren't DRM-protected

**No thumbnails:**
- Only MP3, M4A, AAC support embedded art
- File must have album art tag embedded
- WAV, OGG, FLAC don't support embedded images

**Folder selection doesn't work:**
- Use individual file selection instead
- Browser may not fully support `webkitdirectory`
- Check browser version compatibility

## 📄 License & Credits

Bundled lofi tracks sourced from Freesound.org under Creative Commons licenses.
See individual track metadata for artist attribution.

Extension developed as an open-source project.

## 🔗 Files Structure

```
lofi-extension/
├── manifest.json          # Extension configuration
├── background.js          # Window management
├── player.html           # Player window HTML
├── player.js             # Player logic & controls
├── popup.css             # Styles
├── assets/
│   └── tracks.json       # Bundled tracks metadata
├── lofi/                 # Bundled audio/video files
├── icons/                # Extension icons
└── js/
    └── jsmediatags.js    # Metadata extraction library
```
