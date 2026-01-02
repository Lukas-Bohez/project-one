# Convert the Spire - YouTube Downloader Extension

## Quick Reference

### Extension Location
- **Source Code**: `/home/student/Project/project-one/Extension-Converter/`
- **Download**: `/home/student/Project/project-one/frontend/downloads/ConvertTheSpire-Chrome.zip`
- **Web Page**: `/home/student/Project/project-one/frontend/html/converter.html`

### Key Details
- **Type**: Chrome Extension (Manifest V2)
- **Version**: 19.1
- **Purpose**: YouTube video downloader with Convert the Spire branding
- **Platform**: Chrome, Edge, Chromium browsers
- **Installation**: Side-loaded (Developer mode required)

### Features
- Download YouTube videos in multiple formats (MP4, WebM, MP3)
- Quality options: 144p to 1080p
- Support for regular videos and Shorts
- One-click downloads
- Beautiful Convert the Spire themed UI (gradient blue header, smooth animations)
- Proper error handling with user-friendly messages

### Build Commands
```bash
# Rebuild the distributable zip
./scripts/update_convert_zip_chrome.sh

# Output: frontend/downloads/ConvertTheSpire-Chrome.zip
```

### Installation for Users
1. Download `ConvertTheSpire-Chrome.zip` from the website
2. Unzip to a permanent location
3. Open `chrome://extensions/`
4. Enable "Developer mode"
5. Click "Load unpacked"
6. Select the `Extension-Converter` folder
7. Pin extension and visit YouTube!

### Technical Stack
- **Manifest Version**: 2 (MV2 for download API compatibility)
- **Core Libraries**: 
  - jQuery (DOM manipulation)
  - Bootstrap 4 (UI framework)
  - DOMPurify (XSS protection)
- **Key Files**:
  - `includes/youtube-video-downloader.js` - Stream extraction & signature decipher
  - `includes/background.js` - Download handler
  - `popup/popup.js` - UI logic
  - `popup/popup.html` - Styled interface

### Branding
- **Colors**: Gradient blue (#1e3a8a → #0c4061)
- **Icons**: Derived from Convert the Spire favicon (16px, 32px, 48px, 64px, 128px)
- **UI**: Matches main site styling with smooth hover effects

### Important Notes
- This is a **Chrome extension**, NOT Firefox
- Requires Developer mode (not published to Chrome Web Store)
- MV2 required because MV3 restricts download capabilities
- If "Receiving end does not exist" error appears, user needs to refresh the YouTube page
- Content scripts inject at `document_start` on YouTube pages

### Version History
- **19.1** (Current): Complete rebuild as Chrome extension with Convert the Spire branding
  - Based on proven YouTube downloader core
  - Custom UI with gradient header and animations
  - Proper error handling
  - All icon sizes generated
  - Clean, minimal codebase

### Related Files
- Website page: `frontend/html/converter.html`
- Version manifest: `frontend/downloads/version.json`
- Build script: `scripts/update_convert_zip_chrome.sh`
- Extension README: `Extension-Converter/README.md`

---

*Last Updated: January 2, 2026*
