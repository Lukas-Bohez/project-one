Lofi Cached Player (extension)

This lightweight Chrome/Chromium extension plays local/cached lofi tracks that are bundled with the extension.

Installation (developer mode):

1. Place audio files (MP3/OGG) into `lofi-extension/assets/`.
2. Edit `lofi-extension/assets/tracks.json` to list the filenames and optional metadata.
3. In Chrome/Chromium navigate to `chrome://extensions` and enable "Developer mode".
4. Click "Load unpacked" and select the `lofi-extension` folder.
5. Click the extension icon and use the popup player.

Notes:
- This extension deliberately avoids any network requests — it only plays files packaged in `assets/` (cached-only mode).
- To add more tracks, update `assets/tracks.json` with objects: `{ "file": "name.mp3", "title": "Title", "artist": "Name" }`.
