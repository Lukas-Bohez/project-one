Lofi Cached Player (extension)

This lightweight Chrome/Chromium extension plays local/cached lofi tracks that are bundled with the extension.

## Features
- Play bundled lofi tracks from `assets/tracks.json`
- Upload and cache user audio files (MP3/WAV)
- Offscreen audio playback for background playing
- Keyboard shortcuts: Alt+P (play/pause), Alt+N (next), Alt+B (previous), Alt+S (stop)
- Shuffle and repeat modes

## Installation (developer mode):

1. Place audio files (MP3/OGG) into `lofi-extension/assets/`.
2. Edit `lofi-extension/assets/tracks.json` to list the filenames and optional metadata.
3. In Chrome/Chromium navigate to `chrome://extensions` and enable "Developer mode".
4. Click "Load unpacked" and select the `lofi-extension` folder.

## Recent Fixes (2025-12-31)
- Fixed message passing between popup, background, and offscreen scripts
- Resolved variable scoping issues in background.js switch cases
- Promisified runtime messaging in popup.js for better async handling
- Corrected data key mismatch in storeFiles action
- Replaced extension icons with `icons/image.png` and generated `16x16`, `48x48`, and `128x128` icons; original icons backed up as `.bak` files

## Usage
- Click the extension icon to open the player
- Switch between "Bundled Tracks" and "User Files" modes
- Upload files in cached mode to persist them
5. Click the extension icon and use the popup player.

Notes:
- This extension deliberately avoids any network requests — it only plays files packaged in `assets/` (cached-only mode).
- To add more tracks, update `assets/tracks.json` with objects: `{ "file": "name.mp3", "title": "Title", "artist": "Name" }`.
