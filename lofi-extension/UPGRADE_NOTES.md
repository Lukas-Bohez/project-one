# Lofi Player - Version 0.3 Upgrade Notes

## Major Changes (2026-01-01)

### ✨ New Features

1. **Standalone Window Mode**
   - Extension now opens in a separate, persistent window
   - No longer requires focus to keep playing
   - Simpler architecture without offscreen documents
   - Window persists even when you switch tabs/apps

2. **MP4/Video Support**
   - Play MP4 and WebM video files
   - Video player appears at top when playing video
   - Video icon (🎬) in track list for video files

3. **Album Art / Thumbnails**
   - Automatically extracts album art from MP3/M4A/AAC files
   - Shows thumbnail in track list (40x40px)
   - Large thumbnail display (200x200px) when playing audio
   - Only visible when present (no empty containers)

4. **Improved File Support**
   - Added: MP4, WebM video formats
   - Audio: MP3, WAV, OGG, M4A, AAC, FLAC
   - Metadata extraction from audio files (title, artist, album art)

### 🔧 Architecture Changes

**Before:**
- Popup window → Background Service Worker → Offscreen Document → Audio
- Complex message passing between 3 contexts
- Audio stopped when popup closed

**After:**
- Extension icon click → Opens standalone window
- Direct audio/video playback in window
- No offscreen document needed
- Playback continues as long as window is open

### 📁 File Changes

**Removed:**
- `offscreen.html` - No longer needed
- `offscreen.js` - No longer needed

**Modified:**
- `manifest.json` - Removed offscreen permission, changed action
- `background.js` - Simplified to window management only

**New:**
- `player.html` - Standalone window HTML (renamed from popup.html)
- `player.js` - Standalone player script with video support

**Dependencies Used:**
- `js/jsmediatags.js` - For metadata extraction (already included)

### 🎯 How It Works Now

1. Click extension icon
2. Window opens (400x650px)
3. Player loads bundled tracks OR you load your own files/folders
4. Click track to play
5. For videos: Video player shows at top
6. For audio with art: Thumbnail shows at top
7. Window stays open, music keeps playing
8. Close window when done (or minimize it)

### 💡 Usage Tips

**Opening the Player:**
- Click extension icon in toolbar
- If already open, clicking icon focuses the window

**Video Playback:**
- Load MP4/WebM files
- Video player appears automatically
- Uses native video controls + custom progress bar

**Album Art:**
- Works with MP3, M4A, AAC files
- Automatically extracted when loading files
- Shows in track list and main view
- If no art, no thumbnail displayed (clean UI)

**File Loading:**
- Individual files: Select multiple audio/video files
- Folder: Loads all media files from folder
- Files are sorted alphabetically
- Metadata extracted automatically

### ⚙️ Technical Details

**Direct Media Playback:**
- Uses HTML5 `<audio>` and `<video>` elements
- No Web Audio API needed for basic playback
- Simpler, more reliable
- Better browser compatibility

**Window Management:**
- Background script tracks window ID
- Reuses existing window if open
- Creates new window if closed
- Cleans up on window close

**Metadata Extraction:**
- Uses jsmediatags library
- Extracts: title, artist, album art
- Fallback to filename if no metadata
- Non-blocking async extraction

### 🐛 What Was Removed

- Offscreen audio complexity
- Complex message passing
- Background track management
- Auto-play on startup (intentional)
- Persistent file storage (security)

### ✅ What's Better

- Simpler codebase (~50% less code)
- Direct media control
- Video support
- Thumbnail support
- No focus-loss issues
- Easier to debug
- Better user experience

### 📝 Known Limitations

1. **Window Always-On-Top**
   - Not available in Manifest V3
   - Window can be minimized/moved but not forced on top
   - User can manually keep window visible

2. **File Persistence**
   - User files must be re-selected each session
   - Security/privacy feature, not a bug
   - Bundled tracks always available

3. **Thumbnail Extraction**
   - Only works for MP3, M4A, AAC
   - Requires embedded album art in file
   - WAV/OGG don't support embedded images

4. **Video Formats**
   - Limited to browser-supported formats
   - MP4 (H.264) and WebM work best
   - Codec support varies by browser

### 🔄 Migration Guide

**For Users:**
1. Remove old extension (if installed)
2. Reload extension page (chrome://extensions/)
3. Or: Click reload button on extension
4. Click extension icon to open new window
5. Enjoy the improved player!

**No Data Loss:**
- Settings persist (volume, shuffle, repeat)
- Bundled tracks unchanged
- User must re-select their files (normal)

### 📊 Performance

- Faster startup (no offscreen creation)
- Lower memory usage (no extra context)
- Direct media API (better performance)
- Metadata extraction adds ~100-200ms per file

### 🎨 UI Improvements

- Larger thumbnails (200x200 vs 120x120)
- Video player integration
- Cleaner track list with thumbnails
- Icons for videos (🎬) and audio (🎵)
- No empty containers (conditional display)

---

**Enjoy the upgraded Lofi Player!** 🎵🎬
