# Lofi Player Extension - Testing Guide

## How to Test the Fixed Extension

### 1. Reload the Extension

After the fixes, you need to reload:

1. Go to `chrome://extensions/`
2. Find "Lofi Player"
3. Click the **Reload** button (circular arrow icon)
4. Or remove and re-add using "Load unpacked"

### 2. Test Bundled Mode (Default)

**Expected Behavior:**
- Extension opens with bundled mode selected
- Shows "Loading bundled tracks..." briefly
- Displays 29 tracks in the list
- Status shows "29 tracks loaded - Click to play"
- First track is NOT auto-playing

**Test Steps:**
1. Click the extension icon
2. Verify 29 tracks are listed
3. Click on any track (not just the first one)
4. Track should start playing immediately
5. Progress bar should move
6. Time should update (0:00 / X:XX)
7. Click pause - should pause
8. Click play - should resume
9. Try next/previous buttons
10. Try shuffle and repeat toggles

**✓ Success Criteria:**
- All tracks visible and clickable
- Clicking any track starts playback
- No console errors
- Playback controls work smoothly

### 3. Test File Selection

**Test Steps:**
1. Switch mode to "Upload Music Files"
2. Click "Browse..." under "Select Files"
3. Select 2-3 audio files (MP3/WAV/OGG)
4. Verify files appear in track list (sorted alphabetically)
5. Status shows "✓ Loaded X audio files - Click to play"
6. Click a track to play
7. Verify playback works

**✓ Success Criteria:**
- Files load without errors
- Track list updates correctly
- Files are sorted alphabetically
- Playback works for user files
- No console errors

### 4. Test Folder Selection

**Test Steps:**
1. Stay in "Upload Music Files" mode
2. Click "Choose Files" under "Select Folder"
3. Select a folder containing audio files
4. Browser will show file count
5. Verify all audio files appear in list
6. Status shows correct count
7. Click a track to play

**✓ Success Criteria:**
- All audio files from folder are loaded
- Non-audio files are filtered out
- Files are sorted alphabetically
- Track list updates correctly
- Playback works

**Common Issues:**
- If no "Choose Files" button appears under Select Folder, your browser may not fully support `webkitdirectory`
- Use individual file selection as fallback

### 5. Test Mode Switching

**Test Steps:**
1. Load some user files in Files mode
2. Play one of them
3. Switch back to "Bundled Lofi Tracks"
4. Verify bundled tracks reload
5. Playback should stop
6. Switch back to Files mode
7. Should show empty list with "Select files or folder"

**✓ Success Criteria:**
- Switching stops current playback
- Bundled tracks reload properly in bundled mode
- Files mode clears tracks when switching
- No console errors during switch

### 6. Test Clear Files

**Test Steps:**
1. Load files or folder in Files mode
2. Click "Clear Files" button
3. Track list should empty
4. Both file inputs should reset
5. Status shows "Files cleared - Select files or folder"

**✓ Success Criteria:**
- All tracks cleared
- Playback stops if playing
- File inputs reset (can re-select same files)
- UI updates correctly

### 7. Test Startup Behavior

**Test Steps:**
1. Close the extension popup
2. Reopen the extension
3. Bundled tracks should load
4. Nothing should auto-play
5. Status should show track count
6. Click first track manually
7. Should start playing immediately

**✓ Success Criteria:**
- No auto-play on startup
- Tracks load successfully
- First click starts playback
- No "stuck" state requiring track switching

### 8. Test Edge Cases

**Empty Folder:**
1. Select a folder with no audio files
2. Should show "No audio files found in selection"
3. Track list should be empty

**Mixed File Types:**
1. Select folder with audio + other files (txt, jpg, etc.)
2. Only audio files should appear
3. Count should match audio files only

**Large Folder:**
1. Select folder with 50+ audio files
2. All should load (may take a moment)
3. Scroll should work in track list
4. Performance should be acceptable

### 9. Browser Console Check

**Throughout testing:**
1. Keep browser console open (F12)
2. Check for errors (red text)
3. Acceptable logs:
   - "Offscreen document ready"
   - "Playing track: X filename.mp3"
   - "Loading X files..."
   - "Found X audio files"

**Unacceptable errors:**
- ReferenceError (function not defined)
- TypeError (cannot read property of undefined)
- "showDirectoryPicker is not a function" (should be fixed)

### 10. Persistence Test

**Test Steps:**
1. Set volume to 50%
2. Enable shuffle
3. Set repeat to "one"
4. Close popup
5. Reopen popup
6. Settings should persist (volume, shuffle, repeat)

**Note:** User-selected files do NOT persist (security/privacy)

---

## Quick Troubleshooting

**Problem:** Folder selection doesn't work
- **Solution:** Use individual file selection instead, or try a different browser

**Problem:** Tracks load but won't play
- **Solution:** Check volume isn't at 0, verify browser audio permissions

**Problem:** First track seems stuck
- **Solution:** This should be fixed - try reloading extension

**Problem:** Console shows errors
- **Solution:** Report specific error message for further debugging

---

## Reporting Issues

If you find bugs, please note:
1. Exact steps to reproduce
2. Browser version (chrome://version)
3. Console error messages (if any)
4. Expected vs actual behavior
5. Screenshots if UI issue
