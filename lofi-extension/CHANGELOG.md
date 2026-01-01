# Lofi Player Extension - Changelog

## Version 0.2.1 (2026-01-01) - Bug Fixes & Improvements

### Fixed Issues

#### 1. **File System Access API Error**
**Problem:** `window.showDirectoryPicker is not a function`
- The File System Access API is not available in extension popups
- Browser compatibility issues

**Solution:**
- Replaced `showDirectoryPicker()` with `<input webkitdirectory>`
- Added dedicated folder input element in HTML
- Better browser compatibility with Chrome/Edge/Opera

#### 2. **Startup Auto-Play Issue**
**Problem:** First song wouldn't play on startup, requiring manual track selection

**Solution:**
- Removed auto-play on initialization
- Set `isPlaying = false` and `currentIndex = 0` after loading tracks
- Improved UI messaging: "Click a track to play" instead of auto-playing
- Users now have full control over when playback starts

#### 3. **File/Folder Loading Issues**
**Problem:** File and folder loading was buggy and unreliable

**Solution:**
- Improved `loadFiles()` function with:
  - Better error handling and logging
  - Alphabetical sorting of loaded files
  - Clearer user feedback messages
  - Proper state cleanup on errors
- Added file input clearing when switching modes
- Fixed track list rendering after file operations

### UI/UX Improvements

1. **Better Status Messages**
   - ✓ "Loaded X audio files - Click to play"
   - "No audio files found in selection"
   - "Click a track to play" for initial state
   - Mode-aware status messages

2. **Improved File Controls**
   - Separate labeled sections for files and folders
   - Clear visual distinction between input types
   - Renamed "Unload Files" to "Clear Files" for clarity

3. **Enhanced Error Handling**
   - Try-catch blocks around async operations
   - Detailed error messages in console
   - User-friendly error feedback in UI
   - Graceful degradation on failures

4. **Better State Management**
   - Proper cleanup when clearing files
   - Input value clearing on mode switch
   - Consistent track list updates
   - Reliable playback state tracking

### Technical Changes

**popup.html**
- Replaced folder button with `<input type="file" webkitdirectory>`
- Added labels for file and folder inputs
- Improved layout and spacing

**popup.js**
- Removed `loadFolder()` async function (replaced with input handler)
- Enhanced `loadFiles()` with sorting and better error handling
- Improved `updateUI()` with better state checking and messages
- Enhanced `unloadFolder()` to clear input values
- Added `folderInput` event handler
- Better async error handling in `playTrack()`
- Removed unused `directoryHandle` references

**README.md**
- Updated installation instructions
- Added folder selection documentation
- Listed all recent fixes
- Improved feature descriptions

### Browser Compatibility

**Works In:**
- ✅ Chrome 86+
- ✅ Edge 86+
- ✅ Opera 72+
- ✅ Brave 1.17+

**Folder Selection Support:**
- Uses `webkitdirectory` attribute (widely supported)
- Fallback to individual file selection if needed

### Known Limitations

1. **Folder Selection**
   - Some browsers may show file count but not folder name
   - Security restrictions prevent automatic folder access
   - User must manually select folder each time

2. **File Persistence**
   - User-selected files are not permanently stored
   - Files must be re-selected each browser session
   - This is by design for security/privacy

3. **Audio Format Support**
   - Limited to browser-supported formats
   - MP3, WAV, OGG, M4A, AAC, FLAC
   - DRM-protected files won't play

### Testing Checklist

- [x] Bundled tracks load and play correctly
- [x] Individual file selection works
- [x] Folder selection loads all audio files
- [x] No auto-play on startup
- [x] First track plays when clicked
- [x] All playback controls functional
- [x] Mode switching works properly
- [x] Clear files button works
- [x] Status messages are accurate
- [x] Error messages display correctly
- [x] No console errors on normal use

---

## Version 0.2 (2025-12-31) - Initial Fixes

- Fixed message passing between scripts
- Fixed variable scoping in background.js
- Added promisified runtime messaging
- Updated extension icons
- Fixed data key mismatches

