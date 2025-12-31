// Popup script: loads tracks from packaged assets and plays them (cached-only)
const statusEl = document.getElementById('lofi-status');
const listEl = document.getElementById('song-selector');
const playBtn = document.getElementById('play-pause-btn');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const volumeEl = document.getElementById('volume-slider');
const progressEl = document.getElementById('progress-container');
const progressBarEl = document.getElementById('progress-bar');
const currentTimeEl = document.getElementById('current-time');
const durationEl = document.getElementById('duration');
const nowPlayingEl = document.getElementById('now-playing');
const shuffleBtn = document.getElementById('shuffle-btn');
const repeatBtn = document.getElementById('repeat-btn');
const modeSelector = document.getElementById('mode-selector');
const fileInput = document.getElementById('file-input');
const folderButton = document.getElementById('folder-button');
const unloadButton = document.getElementById('unload-button');

let tracks = [];
let currentIndex = 0;
let playing = false;
let shuffle = false;
let repeat = 'off'; // 'off' | 'one' | 'all'
let persist = true;
let isLoadingTrack = false; // Prevent multiple simultaneous track loads
let isPlaying = false; // Prevent multiple simultaneous play calls
// Initialize displayed volume from the slider
const volDisplayInit = document.getElementById('volume-display');
if (volDisplayInit) volDisplayInit.textContent = Math.round(parseFloat(volumeEl.value) * 100) + '%';

// Ensure offscreen document is created
chrome.runtime.sendMessage({action: 'createOffscreen'}, (response) => {
  if (response && response.success) {
    console.log('Offscreen document created successfully');
  } else {
    console.error('Failed to create offscreen document');
  }
});

// Mode selector
modeSelector.addEventListener('change', () => {
  const mode = modeSelector.value;
  if (mode === 'cached') {
    document.getElementById('file-input-container').style.display = 'block';
    // Stop current playback when switching to cached mode
    chrome.runtime.sendMessage({action: 'pause'});
    playing = false;
    playBtn.textContent = 'Play';
    loadTracks();
  } else {
    document.getElementById('file-input-container').style.display = 'none';
    // Stop current playback when switching to folder mode
    chrome.runtime.sendMessage({action: 'pause'});
    playing = false;
    playBtn.textContent = 'Play';
    loadTracks();
  }
});

// Close behavior (use background-managed persistent window)
const closeBtn = document.getElementById('lofi-close-btn');
if (closeBtn) {
  closeBtn.addEventListener('click', () => {
    try { chrome.runtime.sendMessage({ action: 'closeWindow' }); } catch (e) {}
    window.close();
  });
}

// Legacy mini-mode support removed to simplify window behavior (always-open separate window)


// Folder button
folderButton.addEventListener('click', async () => {
  try {
    if (window.showDirectoryPicker) {
      // Use File System Access API
      const dirHandle = await window.showDirectoryPicker();
      const folderTracks = await loadDirectoryTracks(dirHandle);
      chrome.runtime.sendMessage({action: 'saveDirectoryHandle', handle: dirHandle});
      
      // Prepare metadata; include downsized thumbnails only if safely small (< ~50KB)
      function base64SizeBytes(dataUrl) {
        try {
          const parts = dataUrl.split(',');
          const base64 = parts[1] || '';
          return Math.ceil(base64.length * 3 / 4);
        } catch (e) { return Infinity; }
      }

      const metadataToSave = folderTracks.map(track => ({
        file: track.file,
        title: track.title,
        artist: track.artist,
        url: track.url,
        id: track.id,
        thumbnailData: (track.thumbnailData && base64SizeBytes(track.thumbnailData) <= 50000) ? track.thumbnailData : null
      }));

      chrome.runtime.sendMessage({action: 'saveSongMetadata', metadata: metadataToSave});
      tracks = folderTracks; // Keep full tracks with thumbnails locally
      chrome.runtime.sendMessage({action: 'loadSongs', songs: metadataToSave});
      // Persist UI mode as folder so popup reopens to the same mode
      try { chrome.runtime.sendMessage({ action: 'setUIState', uiState: { currentMode: 'folder' } }); } catch (e) {}
      // Update UI to show folder mode
      if (modeSelector) modeSelector.value = 'folder';
      // Do not persist files by default (too many files). Offscreen will keep the directory handle active instead.
      renderList();
      loadTrack(0);
      updateNowPlaying();
      statusEl.textContent = `Loaded ${tracks.length} folder tracks`;
    } else {
      // Fallback: use file input with webkitdirectory
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.webkitdirectory = true;
      fileInput.multiple = true;
      fileInput.style.display = 'none';
      document.body.appendChild(fileInput);
      
      fileInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        const folderTracks = await loadFilesFromInput(files);
        
        // Prepare metadata; include downsized thumbnails only if safely small (< ~50KB)
        function base64SizeBytes(dataUrl) {
          try {
            const parts = dataUrl.split(',');
            const base64 = parts[1] || '';
            return Math.ceil(base64.length * 3 / 4);
          } catch (e) { return Infinity; }
        }

        const metadataToSave = folderTracks.map(track => ({
          file: track.file,
          title: track.title,
          artist: track.artist,
          url: track.url,
          id: track.id,
          thumbnailData: (track.thumbnailData && base64SizeBytes(track.thumbnailData) <= 50000) ? track.thumbnailData : null
        }));

        chrome.runtime.sendMessage({action: 'saveSongMetadata', metadata: metadataToSave});
        tracks = folderTracks; // Keep full tracks with thumbnails locally
        chrome.runtime.sendMessage({action: 'loadSongs', songs: metadataToSave});
        // Persist UI mode as folder so popup reopens to the same mode
        try { chrome.runtime.sendMessage({ action: 'setUIState', uiState: { currentMode: 'folder' } }); } catch (e) {}
        if (modeSelector) modeSelector.value = 'folder';
        // Do not persist files by default from input (too many files). Offscreen will keep directory handle active instead.
        renderList();
        loadTrack(0);
        updateNowPlaying();
        statusEl.textContent = `Loaded ${tracks.length} folder tracks`;
        document.body.removeChild(fileInput);
      });
      
      fileInput.click();
    }
  } catch (e) {
    console.error('Folder selection failed', e);
    statusEl.textContent = 'Folder selection cancelled or failed';
  }
});

// Unload button
unloadButton.addEventListener('click', async () => {
  chrome.runtime.sendMessage({ action: 'clearDirectoryHandle' }, async (response) => {
    if (response && response.success) {
      // Reset UI mode to cached/bundled view
      try { chrome.runtime.sendMessage({ action: 'setUIState', uiState: { currentMode: 'cached' } }); } catch (e) {}
      if (modeSelector) modeSelector.value = 'cached';
      await loadTracks();
      saveUIState();
    }
  });
});

// Save UI state to background
function saveUIState() {
  chrome.runtime.sendMessage({
    action: 'setUIState',
    uiState: {
      currentSongIndex: currentIndex,
      isPlaying: playing,
      volume: parseFloat(volumeEl.value)
    }
  });
}

async function loadBundledTracks() {
  try {
    const url = chrome.runtime.getURL('assets/tracks.json');
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('Failed to load tracks.json');
    tracks = await resp.json();
    if (!Array.isArray(tracks)) tracks = [];

    // Set URLs for bundled tracks
    tracks.forEach(track => {
      if (!track.url) {
        // Try lofi/ first, then assets/
        const lofiUrl = chrome.runtime.getURL('lofi/' + track.file);
        const assetsUrl = chrome.runtime.getURL('assets/' + track.file);
        track.url = lofiUrl; // Assume it's in lofi/ directory
        track.id = track.url;
      }
    });

    if (tracks.length === 0) {
      statusEl.textContent = 'No tracks found. Add files to assets/ and update assets/tracks.json';
      return;
    }

    statusEl.textContent = `Loaded ${tracks.length} tracks (cached-only)`;
  } catch (err) {
    statusEl.textContent = 'Error loading tracks: ' + err.message;
    console.error(err);
  }
}

async function extractMetadata(file) {
  return new Promise((resolve) => {
    jsmediatags.read(file, {
      onSuccess: async (tag) => {
        let thumbnailData = null;
        let thumbnailType = null;

        // Extract thumbnail/picture data if available
        if (tag.tags && tag.tags.picture) {
          try {
            const picture = tag.tags.picture;
            // Convert binary data to base64 safely
            const uint8Array = new Uint8Array(picture.data);
            let binary = '';
            for (let i = 0; i < uint8Array.length; i++) {
              binary += String.fromCharCode(uint8Array[i]);
            }
            const base64String = btoa(binary);
            const dataUrl = `data:${picture.format};base64,${base64String}`;
            
            // Downsize large thumbnails to prevent memory issues
            if (picture.data && picture.data.length > 50000) { // ~50KB limit
              console.log('Thumbnail too large, attempting to downsize');
              thumbnailData = await downsizeImage(dataUrl, 120, 120); // Max 120x120px
            } else {
              thumbnailData = dataUrl;
            }
            thumbnailType = picture.format;
          } catch (error) {
            console.warn('Failed to extract thumbnail:', error);
            // Continue without thumbnail
          }
        }

        resolve({
          title: tag.tags ? tag.tags.title : null,
          artist: tag.tags ? tag.tags.artist : null,
          thumbnailData: thumbnailData,
          thumbnailType: thumbnailType
        });
      },
      onError: (error) => {
        console.warn('Metadata extraction failed:', error);
        resolve({});
      }
    });
  });
}

// Downsize image to reduce memory usage
async function downsizeImage(dataUrl, maxWidth, maxHeight) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Calculate new dimensions maintaining aspect ratio
      let { width, height } = img;
      if (width > height) {
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }
      }
      
      canvas.width = width;
      canvas.height = height;
      
      // Draw and compress
      ctx.drawImage(img, 0, 0, width, height);
      const downsizedDataUrl = canvas.toDataURL('image/jpeg', 0.8); // 80% quality
      
      resolve(downsizedDataUrl);
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

// Downsize image to reduce memory usage
async function downsizeImage(dataUrl, maxWidth, maxHeight) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      // Calculate new dimensions maintaining aspect ratio
      let { width, height } = img;
      if (width > height) {
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;

      // Draw and iteratively compress until under ~50KB or quality too low
      ctx.drawImage(img, 0, 0, width, height);
      function dataUrlSize(dataUrl) { const base64 = (dataUrl.split(',')[1]||''); return Math.ceil(base64.length * 3 / 4); }
      let quality = 0.8;
      let downsizedDataUrl = canvas.toDataURL('image/jpeg', quality);
      while (dataUrlSize(downsizedDataUrl) > 50000 && quality > 0.3) {
        quality -= 0.1;
        downsizedDataUrl = canvas.toDataURL('image/jpeg', quality);
      }
      if (dataUrlSize(downsizedDataUrl) > 50000) {
        // Can't compress enough — skip thumbnail to avoid message size issues
        resolve(null);
      } else {
        resolve(downsizedDataUrl);
      }
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

async function loadDirectoryTracks(dirHandle) {
  const tracks = [];
  for await (const [name, handle] of dirHandle.entries()) {
    if (handle.kind === 'file' && (name.endsWith('.mp3') || name.endsWith('.wav') || name.endsWith('.ogg'))) {
      const file = await handle.getFile();
      const metadata = await extractMetadata(file);
      tracks.push({
        file: name,
        title: metadata.title || name.replace(/\.[^/.]+$/, ""),
        artist: metadata.artist || '',
        thumbnailData: metadata.thumbnailData,
        thumbnailType: metadata.thumbnailType,
        url: URL.createObjectURL(file),
        id: URL.createObjectURL(file)
      });
    }
  }
  return tracks;
}

async function loadFilesFromInput(files) {
  const tracks = [];
  for (const file of files) {
    if (file.type.startsWith('audio/')) {
      const metadata = await extractMetadata(file);
      tracks.push({
        file: file.name,
        title: metadata.title || file.name.replace(/\.[^/.]+$/, ""),
        artist: metadata.artist || '',
        thumbnailData: metadata.thumbnailData,
        thumbnailType: metadata.thumbnailType,
        url: URL.createObjectURL(file),
        id: URL.createObjectURL(file)
      });
    }
  }
  return tracks;
}

// Rebuild blob URLs from a stored directory handle so tracks persist across popup reloads
async function rebuildTracksFromHandle(dirHandle, metadata) {
  const map = new Map();

  async function walk(handle) {
    for await (const [name, entry] of handle.entries()) {
      if (entry.kind === 'file') {
        map.set(name, entry);
      } else if (entry.kind === 'directory') {
        try { await walk(entry); } catch (e) { /* ignore */ }
      }
    }
  }

  try {
    await walk(dirHandle);
  } catch (e) {
    console.warn('Failed scanning directory handle', e);
  }

  const rebuilt = [];
  for (const meta of metadata) {
    const name = meta.file;
    const entry = map.get(name);
    if (entry) {
      try {
        const f = await entry.getFile();
        const url = URL.createObjectURL(f);
        rebuilt.push({ file: name, title: meta.title || name.replace(/\.[^/.]+$/, ""), artist: meta.artist || '', thumbnailData: meta.thumbnailData || null, thumbnailType: meta.thumbnailType || null, url: url, id: url });
        continue;
      } catch (e) {
        console.warn('Failed to create file URL for', name, e);
      }
    }
    // fallback: use metadata-only entry (e.g., saved thumbnail but no file URL)
    rebuilt.push({ file: name, title: meta.title || name.replace(/\.[^/.]+$/, ""), artist: meta.artist || '', thumbnailData: meta.thumbnailData || null, thumbnailType: meta.thumbnailType || null, url: meta.url || null, id: meta.id || meta.url || name });
  }

  return rebuilt;
}



// Ensure the popup has permission to read from a persisted directory handle. Returns true if access is granted.
async function ensureDirectoryAccess(handle) {
  try {
    if (!handle) return false;
    // Use queryPermission/requestPermission if available
    if (typeof handle.queryPermission === 'function') {
      const q = await handle.queryPermission({ mode: 'read' });
      if (q === 'granted') return true;
      if (q === 'prompt' && typeof handle.requestPermission === 'function') {
        const r = await handle.requestPermission({ mode: 'read' });
        return r === 'granted';
      }
    }
    // Fallback: attempt to iterate entries to confirm access
    try {
      for await (const [name, entry] of handle.entries()) {
        return true; // can iterate, so we have access
      }
    } catch (e) {
      return false;
    }
    return false;
  } catch (e) {
    console.warn('Permission check failed for handle:', e);
    return false;
  }
}

async function loadTracks() {
  // Check if folder is loaded
  const response = await new Promise(resolve => {
    chrome.runtime.sendMessage({ action: 'getSongMetadata' }, resolve);
  });

  if (response && response.metadata && response.metadata.length > 0) {
    // Attempt to rebuild blob URLs from a saved directory handle so files remain playable across popup reloads
    const handleResp = await new Promise(resolve => chrome.runtime.sendMessage({ action: 'getDirectoryHandle' }, resolve));
    if (handleResp && handleResp.handle) {
      try {
        // Ensure we still have permission to read the directory. If not, try requesting it.
        const hasAccess = await ensureDirectoryAccess(handleResp.handle);
        if (hasAccess) {
          const rebuilt = await rebuildTracksFromHandle(handleResp.handle, response.metadata);
          if (rebuilt && rebuilt.length > 0) {
            tracks = rebuilt;
            statusEl.textContent = `Loaded ${tracks.length} folder tracks (from saved folder)`;
          } else {
            tracks = response.metadata;
            statusEl.textContent = `Loaded ${tracks.length} folder tracks`;
          }
        } else {
          // No access to directory handle; fall back to metadata-only list (no stored-file fallback)
          console.warn('No directory access for saved handle; falling back to metadata-only list (no stored files)');
          tracks = response.metadata;
          statusEl.textContent = `Loaded ${tracks.length} folder tracks (permission required to access files)`;
        }
      } catch (e) {
        console.warn('Failed to rebuild tracks from handle:', e);
        tracks = response.metadata;
        statusEl.textContent = `Loaded ${tracks.length} folder tracks`;
      }
    } else {
      tracks = response.metadata;
      statusEl.textContent = `Loaded ${tracks.length} folder tracks`;
    }
  } else {
    await loadBundledTracks();
  }

  renderList();
  loadTrack(currentIndex);
  updateNowPlaying();
  // Update the volume display to reflect current slider
  const volumeDisplay = document.getElementById('volume-display');
  if (volumeDisplay) volumeDisplay.textContent = Math.round(parseFloat(volumeEl.value) * 100) + '%'
  chrome.runtime.sendMessage({action: 'loadSongs', songs: tracks});
  // Also inform offscreen/background to load/persist files for offline access if needed


  // Add progress click-to-seek handler (safe: uses last known duration/currentTime)
  progressEl.addEventListener('click', (e) => {
    const dur = window.__lofi_duration || 0;
    if (!dur || dur <= 0) return;
    const rect = progressEl.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.min(1, Math.max(0, x / rect.width));
    const newTime = pct * dur;
    // Optimistically update UI
    const progressBar = document.getElementById('progress-bar');
    const currentTimeEl = document.getElementById('current-time');
    if (progressBar) progressBar.style.width = (pct * 100) + '%';
    if (currentTimeEl) currentTimeEl.textContent = formatTime(newTime);

    if (progressBar) progressBar.style.width = (pct * 100) + '%';
    if (currentTimeEl) currentTimeEl.textContent = formatTime(newTime);
    chrome.runtime.sendMessage({ action: 'seek', time: newTime }, (resp) => {
      if (!resp || !resp.success) {
        // revert UI on failure by requesting a status update
        chrome.runtime.sendMessage({ action: 'getStatus' }, (s) => {
          if (s && typeof s.currentTime === 'number' && typeof s.duration === 'number') {
            const p = (s.duration > 0) ? (s.currentTime / s.duration * 100) : 0;
            if (progressBar) progressBar.style.width = p + '%';
            if (currentTimeEl) currentTimeEl.textContent = formatTime(s.currentTime);
          }
        });
      }
    });
  }, { once: false });
}

function renderList() {
  listEl.innerHTML = '';
  tracks.forEach((t, i) => {
    const div = document.createElement('div');
    div.className = 'song-item';
    div.dataset.index = String(i);

    const img = document.createElement('img');
    img.className = 'song-thumbnail';
    if (t.thumbnailData) {
      img.src = t.thumbnailData;
      img.style.display = 'block';
    } else {
      img.src = '';
      img.style.display = 'none';
    }

    const info = document.createElement('div');
    info.className = 'song-info';
    info.innerHTML = `<div class="song-title">${t.title || t.file}</div><div class="song-artist">${t.artist || ''}</div>`;

    div.appendChild(img);
    div.appendChild(info);

    div.addEventListener('click', () => {
      currentIndex = i;
      startTrack(i);
      updateListActive();
    });

    listEl.appendChild(div);
  });
}

function updateListActive() {
  const children = Array.from(listEl.children || []);
  children.forEach((c) => {
    if (c.dataset && Number(c.dataset.index) === currentIndex) {
      c.classList.add('selected');
      c.classList.remove('active');
    } else {
      c.classList.remove('selected');
      c.classList.remove('active');
    }
  });
}

async function loadTrack(index) {
  if (!tracks[index]) {
    return;
  }
  if (isLoadingTrack && index === currentIndex) {
    console.log('Already loading current track, skipping:', tracks[index].file);
    return;
  }
  isLoadingTrack = true;
  console.log('Starting to load track:', tracks[index].file);

  try {
    currentIndex = index;
    const track = tracks[index];
    statusEl.textContent = `Loading ${track.file}...`;

    const song = {
      url: track.url,
      file: track.file,
      id: track.id,
      title: track.title || track.file,
      artist: track.artist || ''
    };

    // Request background to play (background will forward to offscreen and attach persistent handle if available)
    chrome.runtime.sendMessage({action: 'requestPlaySong', song: song});
    updateNowPlaying();
  } finally {
    isLoadingTrack = false;
  }
}

function updateNowPlaying() {
  const t = tracks[currentIndex] || {};
  statusEl.textContent = `Now: ${t.title || t.file} — ${t.artist || ''}`;
  const np = document.getElementById('now-playing');
  if (np) np.textContent = `${t.title || t.file} — ${t.artist || ''}`;

  // Update thumbnail (big one)
  const thumbnailEl = document.getElementById('track-thumbnail');
  const thumbnailContainer = document.getElementById('thumbnail-container');
  if (thumbnailEl && t.thumbnailData) {
    thumbnailEl.src = t.thumbnailData;
    thumbnailEl.style.display = 'block';
    if (thumbnailContainer) thumbnailContainer.style.display = 'block';
  } else if (thumbnailEl) {
    thumbnailEl.style.display = 'none';
    if (thumbnailContainer) thumbnailContainer.style.display = 'none';
  }

  // Also update the list thumbnails (in case metadata changed)
  const children = Array.from(listEl.children || []);
  children.forEach((c) => {
    const idx = Number(c.dataset.index);
    const img = c.querySelector('.song-thumbnail');
    if (img && tracks[idx]) {
      if (tracks[idx].thumbnailData) img.src = tracks[idx].thumbnailData;
      else img.src = '';
    }
  });

  // Ensure selected item is highlighted and moved into view
  updateListActive();
  const selected = listEl.querySelector('.song-item.selected');
  if (selected) {
    try { selected.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (e) {}
  }
}

let _lastStartTime = 0;
function startTrack(index) {
  // Debounce quick repeated starts
  const now = Date.now();
  if (now - _lastStartTime < 250) { console.log('startTrack debounced'); return; }
  _lastStartTime = now;

  // Send pause first and then request the offscreen to play the requested track to avoid races
  try {
    chrome.runtime.sendMessage({ action: 'pause' }, (resp) => {
      // Regardless of pause result, load the requested track
      loadTrack(index);
      playing = true;
      isPlaying = true;
      playBtn.textContent = 'Pause';
      saveUIState();
    });
  } catch (e) {
    // Fallback: if messaging fails, still attempt to load
    loadTrack(index);
    playing = true;
    isPlaying = true;
    playBtn.textContent = 'Pause';
    saveUIState();
  }
}

function play() {
  console.log('play() called, currentIndex:', currentIndex);
  if (playing) {
    pause();
  } else {
    startTrack(currentIndex);
  }
}

function pause() {
  chrome.runtime.sendMessage({action: 'pause'});
  playing = false;
  playBtn.textContent = 'Play';
  isPlaying = false;
  saveUIState();
}

function next() {
  if (isLoadingTrack) return; // Prevent action while loading the same track
  let idx;
  if (shuffle) {
    idx = Math.floor(Math.random() * tracks.length);
  } else {
    idx = (currentIndex + 1) % tracks.length;
  }
  currentIndex = idx;
  startTrack(idx);
}

function prev() {
  if (isLoadingTrack) return; // Prevent action while loading the same track
  let idx;
  if (shuffle) {
    idx = Math.floor(Math.random() * tracks.length);
  } else {
    idx = (currentIndex - 1 + tracks.length) % tracks.length;
  }
  currentIndex = idx;
  startTrack(idx);
}

playBtn.addEventListener('click', () => {
  if (playing) pause(); else play();
});

prevBtn.addEventListener('click', () => {
  prev();
});

nextBtn.addEventListener('click', () => {
  next();
});

volumeEl.addEventListener('input', () => {
  const vol = parseFloat(volumeEl.value);
  chrome.runtime.sendMessage({action: 'setVolume', volume: vol});
  const volumeDisplay = document.getElementById('volume-display');
  if (volumeDisplay) volumeDisplay.textContent = Math.round(vol * 100) + '%';
  saveUIState();
});

// Shuffle/Repeat UI
shuffleBtn.addEventListener('click', () => {
  shuffle = !shuffle;
  shuffleBtn.textContent = `Shuffle: ${shuffle ? 'On' : 'Off'}`;
  chrome.storage.sync.set({ lofi_shuffle: shuffle });
});

repeatBtn.addEventListener('click', () => {
  if (repeat === 'off') repeat = 'one';
  else if (repeat === 'one') repeat = 'all';
  else repeat = 'off';
  repeatBtn.textContent = `Repeat: ${repeat}`;
  chrome.storage.sync.set({ lofi_repeat: repeat });
});

// Load persisted settings
chrome.storage.sync.get(['lofi_shuffle', 'lofi_repeat', 'lofi_volume'], (res) => {
  if (typeof res.lofi_shuffle === 'boolean') {
    shuffle = res.lofi_shuffle; shuffleBtn.textContent = `Shuffle: ${shuffle ? 'On' : 'Off'}`;
  }
  if (res.lofi_repeat) {
    repeat = res.lofi_repeat; repeatBtn.textContent = `Repeat: ${repeat}`;
  }
  if (typeof res.lofi_volume === 'number') {
    volumeEl.value = res.lofi_volume;
    const volumeDisplay = document.getElementById('volume-display');
    if (volumeDisplay) volumeDisplay.textContent = Math.round(res.lofi_volume * 100) + '%';
    chrome.runtime.sendMessage({ action: 'setVolume', volume: res.lofi_volume });
  }
});

// Load tracks and UI state
loadTracks();
chrome.runtime.sendMessage({ action: 'getUIState' }, (response) => {
  if (response && response.uiState) {
    if (response.uiState.currentSongIndex >= 0 && response.uiState.currentSongIndex < tracks.length) {
      currentIndex = response.uiState.currentSongIndex;
      updateNowPlaying();
      updateListActive();
    }
    if (response.uiState.isPlaying) {
      play();
    }
    if (response.uiState.volume != null) {
      const vol = response.uiState.volume;
      volumeEl.value = vol;
      const volumeDisplay = document.getElementById('volume-display');
      if (volumeDisplay) volumeDisplay.textContent = Math.round(vol * 100) + '%';
      chrome.runtime.sendMessage({ action: 'setVolume', volume: vol });
    }
    // Restore mode (cached/folder) so popup UI remains on the same folder when reopened
    if (response.uiState.currentMode) {
      try { modeSelector.value = response.uiState.currentMode; } catch (e) {}
      if (response.uiState.currentMode === 'cached') {
        document.getElementById('file-input-container').style.display = 'block';
      } else {
        document.getElementById('file-input-container').style.display = 'none';
      }
    }
  }
});

// Message listener for updates from background/offscreen
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'timeUpdate') {
    const progressBar = document.getElementById('progress-bar');
    const currentTimeEl = document.getElementById('current-time');
    const durationEl = document.getElementById('duration');
    const dur = (typeof message.duration === 'number' && isFinite(message.duration)) ? message.duration : 0;
    const cur = (typeof message.currentTime === 'number' && isFinite(message.currentTime)) ? message.currentTime : 0;

    // Save values for seeking
    window.__lofi_currentTime = cur;
    window.__lofi_duration = dur;

    if (progressBar && dur > 0) {
      const pct = Math.min(100, Math.max(0, (cur / dur) * 100));
      progressBar.style.width = pct + '%';
    } else if (progressBar && dur === 0) {
      progressBar.style.width = '0%';
    }
    if (currentTimeEl) currentTimeEl.textContent = formatTime(cur);
    if (durationEl) durationEl.textContent = formatTime(dur);

  } else if (message.action === 'metadataLoaded') {
    const durationEl = document.getElementById('duration');
    const dur = (typeof message.duration === 'number' && isFinite(message.duration)) ? message.duration : 0;
    window.__lofi_duration = dur;
    if (durationEl) durationEl.textContent = formatTime(dur);

  } else if (message.action === 'songEnded') {
    isPlaying = false;
  } else if (message.action === 'nowPlaying') {
    // Sync UI when background/offscreen auto-advances or when play is requested elsewhere
    const song = message.song || {};
    const idx = tracks.findIndex(t => t.id === song.id || t.url === song.url || t.file === song.file);
    if (idx !== -1) {
      currentIndex = idx;
      isPlaying = true;
      playing = true;
      playBtn.textContent = 'Pause';
      updateNowPlaying();
      updateListActive();
    } else {
      // If we don't have the track locally, request metadata reload
      chrome.runtime.sendMessage({ action: 'getSongMetadata' }, (resp) => {
        if (resp && resp.metadata) {
          loadTracks();
        }
      });
    }
  } else if (message.action === 'playFailed') {
    statusEl.textContent = 'Failed to play: ' + message.error;
    playing = false;
    playBtn.textContent = 'Play';
    isPlaying = false;
  } else if (message.action === 'audioError') {
    statusEl.textContent = 'Audio error: ' + message.error;
    playing = false;
    playBtn.textContent = 'Play';
    isPlaying = false;
  }
});

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
