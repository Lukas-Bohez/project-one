# Lofi Player - Firefox Edition

A browser extension that plays lofi music and videos in a standalone popup window.

## Firefox-Specific Features

This is the Firefox-compatible version of the Lofi Player extension. It uses:
- Manifest V2 (Firefox standard)
- `browser` API namespace (with `chrome` fallback for compatibility)
- Firefox-specific permissions model

## Installation

### ⚠️ Important Note About Firefox Extensions

Firefox requires all permanently installed extensions to be **signed by Mozilla**. Since this is an unsigned extension for personal use, you have two options:

### Option 1: Temporary Installation (Recommended)

This is the easiest method and works on all Firefox versions:

1. **Download** `LofiExtension-Firefox.zip`
2. **Extract** the ZIP file to a **permanent location** on your computer (don't delete this folder!)
3. **Open Firefox** and type `about:debugging#/runtime/this-firefox` in the address bar
4. Click **"Load Temporary Add-on..."**
5. Navigate to the extracted folder and select the **`manifest.json`** file
6. The extension is now loaded and the icon will appear in your toolbar

**Important:** Temporary add-ons are automatically removed when you close Firefox. You'll need to reload the extension each time you restart Firefox using these same steps. The extracted folder must remain in place.

### Option 2: Permanent Installation (Firefox Developer Edition/Nightly Only)

**Warning:** This method is only for Firefox Developer Edition or Nightly builds and disables important security features.

1. Open Firefox Developer Edition or Nightly
2. Type `about:config` in the address bar and accept the warning
3. Search for `xpinstall.signatures.required`
4. Click the toggle to set it to `false`
5. Now you can install the extension permanently using the temporary installation method
6. The extension will remain installed after restart

**This is NOT recommended for your regular browsing profile** as it disables extension signature verification.

## Features

- 🎵 Built-in lofi music tracks
- 🎥 Video support with .mp4 files
- 📁 Load your own music files or folders
- 🔀 Shuffle mode
- 🔁 Repeat modes (off, one, all)
- ⌨️ Full keyboard controls
- 🎨 Album art display
- 📊 Progress bar and time display
- 💾 Remembers your preferences

## Keyboard Shortcuts

- `Space` - Play/Pause
- `←` - Previous track
- `→` - Next track
- `↑` - Volume up (+5%)
- `↓` - Volume down (-5%)
- `M` - Mute/Unmute
- `S` - Toggle shuffle
- `R` - Cycle repeat modes
- `?` - Show help

## Usage

1. Click the Lofi Player icon in your browser toolbar
2. A popup window will open with the player
3. Click any track to play it, or use the play button
4. Use the controls or keyboard shortcuts to navigate

## File Support

**Bundled Mode:**
- Plays pre-included lofi tracks from the extension

**Files Mode:**
- Load individual audio/video files
- Load entire folders of music
- Supported formats: MP3, WAV, OGG, M4A, AAC, FLAC, MP4, WebM

## Differences from Chrome Version

- Uses Manifest V2 instead of V3
- No service worker (uses background scripts)
- Uses `browserAction` instead of `action`
- Compatible with Firefox's security model

## Development

To build the Firefox extension:

```bash
./scripts/update_lofi_firefox_zip.sh
```

This creates `LofiExtension-Firefox.zip` in the `frontend/downloads/` folder.

## Browser Compatibility

- Firefox 91.0 or higher
- Firefox Developer Edition
- Firefox Nightly

## License

Created by Oroka Conner
© 2025 Quiz The Spire - All rights reserved

## Support

For issues or questions, visit [Quiz The Spire](https://quizthespire.com)
