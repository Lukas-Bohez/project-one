# Chrome Web Store Release Checklist

## ✅ UX Improvements Completed

### Responsive Design
- ✓ Window size adjusts from 350px to 800px width
- ✓ Remembers user's preferred window size
- ✓ Responsive layout for small screens (min 300px)
- ✓ Video player adapts to window size (250px-350px)
- ✓ Track list height adjusts based on window size

### Keyboard Shortcuts
- ✓ **Space/K** - Play/Pause
- ✓ **Shift + Left/Right** - Previous/Next track
- ✓ **Left/Right (J/L)** - Seek ±5 seconds
- ✓ **Up/Down Arrows** - Volume ±10%
- ✓ **M** - Mute/Unmute toggle
- ✓ **S** - Toggle Shuffle
- ✓ **R** - Toggle Repeat
- ✓ Help button (⌨️) shows all shortcuts

### Accessibility
- ✓ ARIA labels on all interactive elements
- ✓ Keyboard focus indicators (visible outlines)
- ✓ Screen reader friendly
- ✓ Semantic HTML structure
- ✓ Keyboard navigation throughout
- ✓ Tooltips on buttons

### User Experience
- ✓ Loading indicators with progress for large libraries
- ✓ Better error messages with emoji icons
- ✓ Auto-scroll to playing track
- ✓ Smooth animations and transitions
- ✓ Hover effects with subtle transforms
- ✓ Visual feedback on all interactions
- ✓ Video thumbnails extracted automatically
- ✓ Album art displayed from audio metadata

### Performance
- ✓ Progressive metadata extraction for 20+ files
- ✓ Shows progress during loading
- ✓ No blocking operations
- ✓ Efficient memory management
- ✓ Window state persistence

## 📋 Pre-Submission Checklist

### Extension Files
- [ ] Test extension in Chrome (load unpacked)
- [ ] Test all keyboard shortcuts
- [ ] Test video playback (MP4, WebM)
- [ ] Test audio playback (MP3, WAV, OGG, M4A, AAC, FLAC)
- [ ] Test folder loading (20+ files)
- [ ] Test window resize behavior
- [ ] Test window close/reopen (state persistence)
- [ ] Test shuffle and repeat modes
- [ ] Test volume controls
- [ ] Test help overlay

### Required for Chrome Web Store
- [ ] Create 128x128 icon (already exists in icons/)
- [ ] Create promotional images:
  - [ ] 440x280 small tile
  - [ ] 920x680 marquee (optional but recommended)
  - [ ] 1400x560 screenshot (at least 1, max 5)
- [ ] Write store description (see below)
- [ ] Set category (Productivity or Entertainment)
- [ ] Add privacy policy (if collecting data - we're not)
- [ ] Test on different Chrome versions
- [ ] Update version in manifest.json if needed
- [ ] Create ZIP file for upload

### Store Listing Details

**Name:** Lofi Player

**Summary (132 chars max):**
Play lofi music and videos in a standalone window with video support, album art, and full keyboard controls.

**Description:**
A lightweight music and video player for Chrome that opens in its own window, keeping your music playing while you work.

**Features:**
• Standalone window - plays in background, won't stop when you switch tabs
• 29 bundled lofi tracks ready to play
• Upload your own music/video files or entire folders
• Video support - MP4 and WebM playback with inline player
• Album art extraction - automatic thumbnails from MP3, M4A, AAC files
• Full keyboard controls - Space to play/pause, arrows to seek, and more
• Shuffle and repeat modes
• Volume control with mute
• Remembers your settings and window size
• No tracking, no ads, no network requests - completely private

**Supported Formats:**
Audio: MP3, WAV, OGG, M4A, AAC, FLAC
Video: MP4, WebM

**Keyboard Shortcuts:**
Space/K - Play/Pause
Shift+Arrows - Previous/Next track
Arrows - Seek ±5s or adjust volume
M - Mute/Unmute
S - Shuffle
R - Repeat

Perfect for studying, working, or just relaxing with lofi beats!

**Category:** Productivity (or Entertainment)

**Language:** English

**Privacy:** This extension does not collect, store, or transmit any user data.

## 🔧 Testing Commands

```bash
# Load in Chrome
1. Open chrome://extensions
2. Enable Developer Mode
3. Click "Load unpacked"
4. Select: /home/student/Project/project-one/lofi-extension

# Create ZIP for upload
cd /home/student/Project/project-one
zip -r lofi-extension.zip lofi-extension/ -x "*.git*" "*.md" "*NOTES*" "*TEST*"
```

## 📸 Screenshot Suggestions

1. **Main player view** - Show bundled tracks playing with album art
2. **Video playback** - Show MP4 video playing inline
3. **Keyboard shortcuts** - Show the help overlay
4. **File loading** - Show user files loaded with thumbnails
5. **Responsive design** - Show different window sizes

## 🚀 Upload Process

1. Go to https://chrome.google.com/webstore/devconsole
2. Create new item
3. Upload ZIP file
4. Fill in store listing details
5. Upload promotional images
6. Set pricing (Free)
7. Submit for review

## ⚠️ Important Notes

- Chrome Web Store review typically takes 1-3 days
- Extension will be reviewed for policy compliance
- No network requests = faster approval
- No data collection = no privacy policy needed
- Make sure manifest version is incremented for updates
- Keep CHANGELOG.md updated for future releases

## 📝 Version History

- v0.3 - Major update: Standalone window, video support, thumbnails, keyboard shortcuts
- v0.2.1 - Fixed folder loading, better error handling
- v0.2 - Initial working version
