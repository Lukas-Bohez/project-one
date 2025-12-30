// Popup script: loads tracks from packaged assets and plays them (cached-only)
const statusEl = document.getElementById('status');
const listEl = document.getElementById('track-list');
const playBtn = document.getElementById('play');
const prevBtn = document.getElementById('prev');
const nextBtn = document.getElementById('next');
const volumeEl = document.getElementById('volume');

let tracks = [];
let currentIndex = 0;
let audio = new Audio();
let playing = false;
let shuffle = false;
let repeat = 'off'; // 'off' | 'one' | 'all'
let persist = true;

async function loadTracks() {
  try {
    const url = chrome.runtime.getURL('assets/tracks.json');
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('Failed to load tracks.json');
    tracks = await resp.json();
    if (!Array.isArray(tracks)) tracks = [];

    if (tracks.length === 0) {
      statusEl.textContent = 'No tracks found. Add files to assets/ and update assets/tracks.json';
      return;
    }

    statusEl.textContent = `Loaded ${tracks.length} tracks (cached-only)`;
    renderList();
    loadTrack(0);
    updateNowPlaying();
  } catch (err) {
    statusEl.textContent = 'Error loading tracks: ' + err.message;
    console.error(err);
  }
}

function renderList() {
  listEl.innerHTML = '';
  tracks.forEach((t, i) => {
    const div = document.createElement('div');
    div.className = 'track';
    div.dataset.index = String(i);
    div.innerHTML = `<div class="title">${t.title || t.file}</div><div class="meta">${t.artist || ''}</div>`;
    div.addEventListener('click', () => { loadTrack(i); play(); updateListActive(); });
    listEl.appendChild(div);
  });
}

function updateListActive() {
  const children = Array.from(listEl.children || []);
  children.forEach((c) => {
    if (c.dataset && Number(c.dataset.index) === currentIndex) c.classList.add('active');
    else c.classList.remove('active');
  });
}

async function loadTrack(index) {
  if (!tracks[index]) return;
  currentIndex = index;
  const filename = tracks[index].file;
  const candidatePaths = ['assets/' + filename, 'lofi/' + filename];
  statusEl.textContent = `Loading ${filename}...`;

  let lastError = null;
  for (const assetPath of candidatePaths) {
    const resolvedUrl = chrome.runtime.getURL(assetPath);
    console.log('Attempting to load track', filename, '->', resolvedUrl);
    try {
      const resp = await fetch(resolvedUrl, { method: 'GET' });
      if (!resp.ok) {
        lastError = `Failed to fetch ${assetPath}: HTTP ${resp.status}`;
        console.warn(lastError);
        continue; // try next candidate
      }

      const contentType = resp.headers.get('content-type') || 'unknown';
      console.log('Fetched track content-type for', assetPath, ':', contentType);

      try {
        if (contentType.startsWith('audio/')) {
          audio.src = resolvedUrl;
          audio.load();
          updateNowPlaying();
          return;
        } else {
          const blob = await resp.blob();
          const blobUrl = URL.createObjectURL(blob);
          console.log('Using blob URL for playback:', blobUrl);
          audio.src = blobUrl;
          audio.load();
          updateNowPlaying();
          return;
        }
      } catch (err) {
        lastError = 'Error preparing audio for playback: ' + (err && err.message ? err.message : String(err));
        console.error(lastError, err);
        continue; // try next candidate
      }
    } catch (err) {
      lastError = 'Fetch error for ' + resolvedUrl + ': ' + (err && err.message ? err.message : String(err));
      console.warn(lastError, err);
      continue; // try next candidate
    }
  }

  // If we reach here, all candidates failed
  statusEl.textContent = lastError || 'Failed to load track';
}

function updateNowPlaying() {
  const t = tracks[currentIndex] || {};
  statusEl.textContent = `Now: ${t.title || t.file} — ${t.artist || ''}`;
  const np = document.getElementById('now-playing');
  if (np) np.textContent = `${t.title || t.file} — ${t.artist || ''}`;
  updateListActive();
}

function play() {
  if (!audio.src) return;
  // fade in
  try {
    audio.volume = 0;
    audio.play();
    const target = parseFloat(volumeEl.value || 0.8) || 0.8;
    let v = 0;
    const step = target / 10;
    const iv = setInterval(() => {
      v = Math.min(target, v + step);
      audio.volume = v;
      if (v >= target) clearInterval(iv);
    }, 40);
  } catch (e) { console.warn('Play failed', e); }
  playing = true;
  playBtn.textContent = 'Pause';
}

function pause() {
  // fade out then pause
  try {
    const start = audio.volume;
    let v = start;
    const step = Math.max(0.01, start / 10);
    const iv = setInterval(() => {
      v = Math.max(0, v - step);
      audio.volume = v;
      if (v <= 0) {
        clearInterval(iv);
        audio.pause();
      }
    }, 40);
  } catch (e) { audio.pause(); }
  playing = false;
  playBtn.textContent = 'Play';
}

playBtn.addEventListener('click', () => {
  if (playing) pause(); else play();
});

prevBtn.addEventListener('click', () => {
  let idx;
  if (shuffle) {
    idx = Math.floor(Math.random() * tracks.length);
  } else {
    idx = (currentIndex - 1 + tracks.length) % tracks.length;
  }
  loadTrack(idx);
  play();
});

nextBtn.addEventListener('click', () => {
  let idx;
  if (shuffle) {
    idx = Math.floor(Math.random() * tracks.length);
  } else {
    idx = (currentIndex + 1) % tracks.length;
  }
  loadTrack(idx);
  play();
});

volumeEl.addEventListener('input', () => {
  audio.volume = parseFloat(volumeEl.value);
});

// Auto-advance
audio.addEventListener('ended', () => {
  if (repeat === 'one') {
    audio.currentTime = 0;
    play();
    return;
  }

  if (repeat === 'off') {
    // behave normally
    nextBtn.click();
  } else if (repeat === 'all') {
    nextBtn.click();
  }
});

// Shuffle/Repeat/Persist UI
const shuffleBtn = document.getElementById('shuffle');
const repeatBtn = document.getElementById('repeat');
const persistCb = document.getElementById('persist');

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

persistCb.addEventListener('change', () => {
  persist = persistCb.checked;
  chrome.storage.sync.set({ lofi_persist: persist });
});

// Load persisted settings
chrome.storage.sync.get(['lofi_shuffle', 'lofi_repeat', 'lofi_persist', 'lofi_volume'], (res) => {
  if (typeof res.lofi_shuffle === 'boolean') {
    shuffle = res.lofi_shuffle; shuffleBtn.textContent = `Shuffle: ${shuffle ? 'On' : 'Off'}`;
  }
  if (res.lofi_repeat) {
    repeat = res.lofi_repeat; repeatBtn.textContent = `Repeat: ${repeat}`;
  }
  if (typeof res.lofi_persist === 'boolean') {
    persist = res.lofi_persist; persistCb.checked = persist;
  } else {
    persistCb.checked = persist;
  }
  if (typeof res.lofi_volume === 'number') { audio.volume = res.lofi_volume; volumeEl.value = res.lofi_volume; }
});

// Save volume if persist enabled
volumeEl.addEventListener('change', () => {
  if (persist) chrome.storage.sync.set({ lofi_volume: parseFloat(volumeEl.value) });
  audio.volume = parseFloat(volumeEl.value);
  // save current index/state
  if (persist) chrome.storage.sync.set({ lofi_currentIndex: currentIndex });
});

// Start
audio.volume = parseFloat(volumeEl.value || 0.8);

// Ensure persisted current index is applied after settings loaded
chrome.storage.sync.get(['lofi_currentIndex', 'lofi_volume'], (res2) => {
  if (typeof res2.lofi_volume === 'number') { audio.volume = res2.lofi_volume; volumeEl.value = res2.lofi_volume; }
  if (typeof res2.lofi_currentIndex === 'number') currentIndex = res2.lofi_currentIndex;
  loadTracks();
});

// expose simple debug controls
window.lofiPopup = {
  next: () => { nextBtn.click(); },
  prev: () => { prevBtn.click(); },
  play: () => { play(); },
  pause: () => { pause(); }
};
