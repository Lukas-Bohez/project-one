// Lofi Player - Standalone Window
// DOM Elements
const statusEl = document.getElementById('lofi-status');
const listEl = document.getElementById('song-selector');
const playBtn = document.getElementById('play-pause-btn');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const volumeEl = document.getElementById('volume-slider');
const volumeDisplay = document.getElementById('volume-display');
const progressContainer = document.getElementById('progress-container');
const progressBar = document.getElementById('progress-bar');
const currentTimeEl = document.getElementById('current-time');
const durationEl = document.getElementById('duration');
const nowPlayingEl = document.getElementById('now-playing');
const shuffleBtn = document.getElementById('shuffle-btn');
const repeatBtn = document.getElementById('repeat-btn');
const modeSelector = document.getElementById('mode-selector');
const fileInput = document.getElementById('file-input');
const folderInput = document.getElementById('folder-input');
const unloadButton = document.getElementById('unload-button');
const fileControls = document.getElementById('file-controls');
const closeBtn = document.getElementById('lofi-close-btn');
const thumbnailEl = document.getElementById('track-thumbnail');
const thumbnailContainer = document.getElementById('thumbnail-container');
const videoPlayer = document.getElementById('video-player');
const audioPlayer = document.getElementById('audio-player');
const mediaContainer = document.getElementById('media-container');
const helpBtn = document.getElementById('help-btn');
const helpOverlay = document.getElementById('help-overlay');
const helpCloseBtn = document.getElementById('help-close-btn');
const fullscreenBtn = document.getElementById('fullscreen-btn');
const popupRoot = document.getElementById('lofi-popup-root');
const filterAllBtn = document.getElementById('filter-all');
const filterSongsBtn = document.getElementById('filter-songs');
const filterVideosBtn = document.getElementById('filter-videos');
const trackCountLabel = document.getElementById('track-count-label');

// Current media element (audio or video)
let currentMedia = audioPlayer;

// State
let tracks = [];
let currentIndex = 0;
let isPlaying = false;
let shuffle = false;
let repeat = 'off'; // 'off', 'one', 'all'
let currentMode = 'bundled'; // 'bundled', 'files'
let currentFilter = 'all'; // 'all', 'songs', 'videos'
let isFullscreen = false;

// Initialize
async function init() {
    console.log('Lofi Player window initialized');
    
    // Set initial volume
    if (volumeEl) {
        audioPlayer.volume = parseFloat(volumeEl.value);
        videoPlayer.volume = parseFloat(volumeEl.value);
        if (volumeDisplay) {
            volumeDisplay.textContent = Math.round(volumeEl.value * 100) + '%';
        }
    }
    
    // Load saved state
    loadState();
    
    // Set default mode to bundled
    if (modeSelector) modeSelector.value = 'bundled';
    if (fileControls) fileControls.style.display = 'none';
    
    // Setup media event listeners
    setupMediaListeners(audioPlayer);
    setupMediaListeners(videoPlayer);
    
    // Setup keyboard shortcuts
    setupKeyboardShortcuts();
    
    // Load bundled tracks by default (but don't auto-play)
    await loadBundledTracks();
    
    // Reset playback state
    isPlaying = false;
    currentIndex = 0;
    
    updateUI();
}

// Setup event listeners for media element
function setupMediaListeners(media) {
    media.addEventListener('timeupdate', () => {
        if (currentTimeEl) currentTimeEl.textContent = formatTime(media.currentTime);
        if (progressBar && media.duration > 0) {
            const percent = (media.currentTime / media.duration) * 100;
            progressBar.style.width = percent + '%';
        }
    });
    
    media.addEventListener('loadedmetadata', () => {
        if (durationEl) durationEl.textContent = formatTime(media.duration);
    });
    
    media.addEventListener('ended', () => {
        nextTrack();
    });
    
    media.addEventListener('play', () => {
        isPlaying = true;
        updateUI();
    });
    
    media.addEventListener('pause', () => {
        isPlaying = false;
        updateUI();
    });
}

// Save/Load state
function saveState() {
    chrome.storage.local.set({
        lofi_shuffle: shuffle,
        lofi_repeat: repeat,
        lofi_volume: volumeEl ? parseFloat(volumeEl.value) : 0.1
    });
}

function loadState() {
    chrome.storage.local.get(['lofi_shuffle', 'lofi_repeat', 'lofi_volume'], (data) => {
        if (data.lofi_shuffle !== undefined) {
            shuffle = data.lofi_shuffle;
            if (shuffleBtn) shuffleBtn.textContent = `Shuffle: ${shuffle ? 'On' : 'Off'}`;
        }
        if (data.lofi_repeat !== undefined) {
            repeat = data.lofi_repeat;
            if (repeatBtn) repeatBtn.textContent = `Repeat: ${repeat}`;
        }
        if (data.lofi_volume !== undefined && volumeEl) {
            volumeEl.value = data.lofi_volume;
            audioPlayer.volume = data.lofi_volume;
            videoPlayer.volume = data.lofi_volume;
            if (volumeDisplay) volumeDisplay.textContent = Math.round(data.lofi_volume * 100) + '%';
        }
    });
}

// Load bundled tracks
async function loadBundledTracks() {
    try {
        const response = await fetch(chrome.runtime.getURL('assets/tracks.json'));
        const trackData = await response.json();
        
        tracks = trackData.map(track => ({
            file: track.file,
            title: track.title || track.file.replace(/\.[^/.]+$/, ''),
            artist: track.artist || '',
            url: chrome.runtime.getURL(`lofi/${track.file}`),
            id: track.file,
            isVideo: track.file.toLowerCase().endsWith('.mp4')
        }));
        
        currentIndex = 0;
        renderTrackList();
        updateUI();
        statusEl.textContent = `Loaded ${tracks.length} bundled tracks`;
        
    } catch (err) {
        console.error('Failed to load bundled tracks:', err);
        statusEl.textContent = 'Failed to load bundled tracks';
    }
}

// Load user-selected files
async function loadFiles(files) {
    try {
        console.log('Loading', files.length, 'files...');
        statusEl.textContent = `📂 Loading ${files.length} files...`;
        
        // Filter for audio/video files
        const mediaFiles = files.filter(file => {
            const ext = file.name.toLowerCase().split('.').pop();
            return ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'mp4', 'webm'].includes(ext);
        });
        
        console.log('Found', mediaFiles.length, 'media files');
        
        if (mediaFiles.length === 0) {
            statusEl.textContent = '⚠️ No audio/video files found in selection';
            tracks = [];
            renderTrackList();
            updateUI();
            return;
        }
        
        statusEl.textContent = `🎵 Processing ${mediaFiles.length} files...`;
        
        // Sort files alphabetically
        mediaFiles.sort((a, b) => a.name.localeCompare(b.name));
        
        // Create track objects from files
        const trackPromises = mediaFiles.map(async (file, index) => {
            const track = {
                file: file.name,
                title: file.name.replace(/\.[^/.]+$/, ''),
                artist: '',
                url: URL.createObjectURL(file),
                id: `user_${index}_${file.name}`,
                fileObject: file,
                isVideo: file.name.toLowerCase().endsWith('.mp4') || file.name.toLowerCase().endsWith('.webm')
            };
            
            // Try to extract thumbnail for audio files
            if (!track.isVideo && file.name.match(/\.(mp3|m4a|aac)$/i)) {
                try {
                    const tags = await extractMetadata(file);
                    if (tags && tags.picture) {
                        track.thumbnail = tags.picture;
                    }
                    if (tags && tags.title) track.title = tags.title;
                    if (tags && tags.artist) track.artist = tags.artist;
                } catch (e) {
                    console.log('Could not extract metadata from', file.name);
                }
            }
            
            // Try to extract thumbnail for video files
            if (track.isVideo) {
                try {
                    const videoThumb = await extractVideoThumbnail(file);
                    if (videoThumb) {
                        track.thumbnail = videoThumb;
                    }
                } catch (e) {
                    console.log('Could not extract thumbnail from', file.name);
                }
            }
            
            return track;
        });
        
        // Show progress for large libraries
        if (trackPromises.length > 20) {
            statusEl.textContent = `🎵 Extracting metadata (0/${trackPromises.length})...`;
            let completed = 0;
            tracks = [];
            for (const promise of trackPromises) {
                const track = await promise;
                tracks.push(track);
                completed++;
                if (completed % 5 === 0 || completed === trackPromises.length) {
                    statusEl.textContent = `🎵 Extracting metadata (${completed}/${trackPromises.length})...`;
                }
            }
        } else {
            tracks = await Promise.all(trackPromises);
        }
        
        currentIndex = 0;
        isPlaying = false;
        renderTrackList();
        updateUI();
        statusEl.textContent = `✓ Loaded ${tracks.length} file${tracks.length !== 1 ? 's' : ''} - Press Space to play`;
        
    } catch (err) {
        console.error('Failed to load files:', err);
        statusEl.textContent = '❌ Error loading files: ' + (err.message || 'Unknown error');
        tracks = [];
        renderTrackList();
        updateUI();
    }
}

// Extract metadata and thumbnail from audio file
function extractMetadata(file) {
    return new Promise((resolve) => {
        if (typeof jsmediatags === 'undefined') {
            resolve(null);
            return;
        }
        
        jsmediatags.read(file, {
            onSuccess: (tag) => {
                const result = {
                    title: tag.tags.title,
                    artist: tag.tags.artist
                };
                
                if (tag.tags.picture) {
                    const picture = tag.tags.picture;
                    const base64String = picture.data.reduce((acc, byte) => acc + String.fromCharCode(byte), '');
                    result.picture = `data:${picture.format};base64,${btoa(base64String)}`;
                }
                
                resolve(result);
            },
            onError: () => {
                resolve(null);
            }
        });
    });
}

// Extract thumbnail from video file
function extractVideoThumbnail(file) {
    return new Promise((resolve) => {
        const video = document.createElement('video');
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        video.preload = 'metadata';
        video.muted = true;
        
        video.onloadeddata = () => {
            // Seek to 1 second or 10% of duration, whichever is smaller
            const seekTime = Math.min(1, video.duration * 0.1);
            video.currentTime = seekTime;
        };
        
        video.onseeked = () => {
            // Set canvas size to video dimensions
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            
            // Draw video frame to canvas
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            // Convert canvas to data URL
            const thumbnail = canvas.toDataURL('image/jpeg', 0.8);
            
            // Clean up
            URL.revokeObjectURL(video.src);
            
            resolve(thumbnail);
        };
        
        video.src = URL.createObjectURL(file);
    });
}

// Unload folder/files
function unloadFolder() {
    stopPlayback();
    tracks = [];
    currentIndex = 0;
    
    // Clear file inputs
    if (fileInput) fileInput.value = '';
    if (folderInput) folderInput.value = '';
    
    renderTrackList();
    updateUI();
    statusEl.textContent = currentMode === 'bundled' ? 'Switched to bundled mode' : 'Files cleared - Select files or folder';
}

// Render track list
function renderTrackList() {
    listEl.innerHTML = '';
    
    // Filter tracks based on current filter
    let filteredTracks = tracks;
    if (currentFilter === 'songs') {
        filteredTracks = tracks.filter(t => !t.isVideo);
    } else if (currentFilter === 'videos') {
        filteredTracks = tracks.filter(t => t.isVideo);
    }
    
    // Update track count label
    if (trackCountLabel) {
        const songCount = tracks.filter(t => !t.isVideo).length;
        const videoCount = tracks.filter(t => t.isVideo).length;
        if (currentFilter === 'all') {
            trackCountLabel.textContent = `${tracks.length} Tracks (${songCount} songs, ${videoCount} videos)`;
        } else if (currentFilter === 'songs') {
            trackCountLabel.textContent = `${songCount} Songs`;
        } else {
            trackCountLabel.textContent = `${videoCount} Videos`;
        }
    }
    
    filteredTracks.forEach((track, displayIndex) => {
        const actualIndex = tracks.indexOf(track);
        const div = document.createElement('div');
        
        // Apply different styling for songs vs videos
        if (track.isVideo) {
            // YouTube-like video item
            div.className = 'song-item video-item' + (actualIndex === currentIndex ? ' selected' : '');
            div.dataset.index = actualIndex;
            
            // Video thumbnail wrapper
            const thumbWrapper = document.createElement('div');
            thumbWrapper.className = 'video-thumbnail-wrapper';
            
            if (track.thumbnail) {
                const thumb = document.createElement('img');
                thumb.src = track.thumbnail;
                thumbWrapper.appendChild(thumb);
            }
            
            div.appendChild(thumbWrapper);
            
            // Video info
            const info = document.createElement('div');
            info.className = 'video-info';
            
            const titleDiv = document.createElement('div');
            titleDiv.className = 'video-title';
            titleDiv.textContent = track.title || track.file;
            
            const metaDiv = document.createElement('div');
            metaDiv.className = 'video-meta';
            metaDiv.textContent = track.artist || 'Video';
            
            info.appendChild(titleDiv);
            info.appendChild(metaDiv);
            div.appendChild(info);
        } else {
            // Spotify-like audio item
            div.className = 'song-item audio-item' + (actualIndex === currentIndex ? ' selected' : '');
            div.dataset.index = actualIndex;
            div.style.display = 'flex';
            div.style.alignItems = 'center';
            div.style.paddingLeft = '28px'; // Space for play icon
            
            // Add thumbnail if available
            if (track.thumbnail) {
                const thumb = document.createElement('img');
                thumb.src = track.thumbnail;
                thumb.className = 'song-thumbnail';
                thumb.style.cssText = 'width: 48px; height: 48px; border-radius: 4px; margin-right: 12px; object-fit: cover; flex-shrink: 0;';
                div.appendChild(thumb);
            } else {
                const musicIcon = document.createElement('span');
                musicIcon.textContent = '🎵';
                musicIcon.style.cssText = 'font-size: 32px; margin-right: 12px; flex-shrink: 0; width: 48px; text-align: center;';
                div.appendChild(musicIcon);
            }
            
            const info = document.createElement('div');
            info.className = 'song-info';
            info.style.flex = '1';
            info.style.minWidth = '0';
            
            const titleDiv = document.createElement('div');
            titleDiv.className = 'song-title';
            titleDiv.textContent = track.title || track.file;
            
            const artistDiv = document.createElement('div');
            artistDiv.className = 'song-artist';
            artistDiv.textContent = track.artist || 'Unknown Artist';
            
            info.appendChild(titleDiv);
            info.appendChild(artistDiv);
            div.appendChild(info);
        }
        
        div.addEventListener('click', (e) => {
            e.preventDefault();
            playTrack(actualIndex);
        });
        
        listEl.appendChild(div);
    });
    
    // Show message if no tracks match filter
    if (filteredTracks.length === 0 && tracks.length > 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.style.cssText = 'text-align: center; padding: 40px 20px; color: var(--text-muted);';
        emptyMsg.textContent = currentFilter === 'songs' ? '📭 No songs in library' : '📭 No videos in library';
        listEl.appendChild(emptyMsg);
    }
}

// Update track list selection
function updateTrackSelection() {
    const items = listEl.querySelectorAll('.song-item');
    items.forEach((item, i) => {
        item.classList.toggle('selected', i === currentIndex);
    });
}

// Update song selector with new tracks
function updateSongSelector(trackList) {
    tracks = trackList;
    currentIndex = 0;
    isPlaying = false;
    renderTrackList();
    updateUI();
}

// Play a specific track
async function playTrack(index) {
    if (index < 0 || index >= tracks.length) return;
    
    console.log('Playing track:', index, tracks[index].file);
    
    currentIndex = index;
    const track = tracks[currentIndex];
    
    try {
        // Stop current playback
        stopPlayback();
        
        // Determine if video or audio
        if (track.isVideo) {
            // Use video player
            currentMedia = videoPlayer;
            audioPlayer.style.display = 'none';
            videoPlayer.style.display = 'block';
            mediaContainer.style.display = 'block';
            thumbnailContainer.style.display = 'none';
        } else {
            // Use audio player
            currentMedia = audioPlayer;
            videoPlayer.style.display = 'none';
            audioPlayer.style.display = 'none';
            
            // Show thumbnail if available
            if (track.thumbnail) {
                thumbnailEl.src = track.thumbnail;
                thumbnailContainer.style.display = 'block';
                mediaContainer.style.display = 'none';
            } else {
                thumbnailContainer.style.display = 'none';
                mediaContainer.style.display = 'none';
            }
        }
        
        // Load and play
        currentMedia.src = track.url;
        currentMedia.load();
        
        try {
            await currentMedia.play();
            isPlaying = true;
            updateUI();
            updateTrackSelection();
        } catch (playErr) {
            console.error('Play failed:', playErr);
            statusEl.textContent = '❌ Playback failed: ' + (playErr.message || 'Media format not supported');
            isPlaying = false;
            updateUI();
        }
        
    } catch (err) {
        console.error('Error playing track:', err);
        statusEl.textContent = '❌ Error: ' + (err.message || 'Could not load track');
        isPlaying = false;
        updateUI();
    }
}

// Play/Pause toggle
function togglePlay() {
    if (tracks.length === 0) return;
    
    if (!currentMedia.src) {
        // No track loaded, play first track
        playTrack(0);
        return;
    }
    
    if (isPlaying) {
        currentMedia.pause();
    } else {
        currentMedia.play();
    }
}

// Stop playback
function stopPlayback() {
    audioPlayer.pause();
    videoPlayer.pause();
    audioPlayer.src = '';
    videoPlayer.src = '';
    isPlaying = false;
}

// Next track
function nextTrack() {
    if (tracks.length === 0) return;
    
    let nextIndex;
    
    if (repeat === 'one') {
        nextIndex = currentIndex;
    } else if (shuffle) {
        nextIndex = Math.floor(Math.random() * tracks.length);
    } else {
        nextIndex = currentIndex + 1;
        if (nextIndex >= tracks.length) {
            if (repeat === 'all') {
                nextIndex = 0;
            } else {
                stopPlayback();
                updateUI();
                return;
            }
        }
    }
    
    playTrack(nextIndex);
}

// Previous track
function prevTrack() {
    if (tracks.length === 0) return;
    
    let prevIndex;
    
    if (shuffle) {
        prevIndex = Math.floor(Math.random() * tracks.length);
    } else {
        prevIndex = currentIndex - 1;
        if (prevIndex < 0) {
            prevIndex = tracks.length - 1;
        }
    }
    
    playTrack(prevIndex);
}

// Seek
function seek(e) {
    if (!currentMedia.duration) return;
    
    const rect = progressContainer.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const time = percent * currentMedia.duration;
    
    currentMedia.currentTime = Math.max(0, Math.min(time, currentMedia.duration));
}

// Set volume
function setVolume() {
    const vol = parseFloat(volumeEl.value);
    audioPlayer.volume = vol;
    videoPlayer.volume = vol;
    if (volumeDisplay) volumeDisplay.textContent = Math.round(vol * 100) + '%';
    saveState();
}

// Toggle shuffle
function toggleShuffle() {
    shuffle = !shuffle;
    if (shuffleBtn) shuffleBtn.textContent = `Shuffle: ${shuffle ? 'On' : 'Off'}`;
    saveState();
}

// Toggle repeat
function toggleRepeat() {
    if (repeat === 'off') repeat = 'one';
    else if (repeat === 'one') repeat = 'all';
    else repeat = 'off';
    
    if (repeatBtn) repeatBtn.textContent = `Repeat: ${repeat}`;
    saveState();
}

// Update UI
function updateUI() {
    // Play button
    if (playBtn) {
        playBtn.textContent = isPlaying ? '⏸' : '▶';
    }
    
    // Now playing
    if (nowPlayingEl) {
        if (tracks.length > 0 && currentIndex >= 0 && currentIndex < tracks.length) {
            const track = tracks[currentIndex];
            const mediaType = track.isVideo ? ' 🎬' : (track.thumbnail ? ' 🎵' : '');
            nowPlayingEl.textContent = (track.title || track.file) + mediaType;
        } else if (tracks.length > 0) {
            nowPlayingEl.textContent = 'Click a track to play';
        } else {
            nowPlayingEl.textContent = currentMode === 'bundled' ? 'Loading tracks...' : 'Select files or folder';
        }
    }
    
    // Status
    if (statusEl) {
        if (tracks.length > 0 && currentIndex >= 0 && currentIndex < tracks.length) {
            const track = tracks[currentIndex];
            if (track) {
                statusEl.textContent = `${isPlaying ? 'Playing' : 'Ready'}: ${track.title || track.file}`;
            }
        } else if (tracks.length > 0) {
            statusEl.textContent = `${tracks.length} tracks loaded - Click to play`;
        } else {
            statusEl.textContent = currentMode === 'bundled' ? 'Loading bundled tracks...' : 'Select files or folder';
        }
    }
}

// Format time
function formatTime(seconds) {
    if (!isFinite(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Event listeners
if (playBtn) playBtn.addEventListener('click', togglePlay);
if (prevBtn) prevBtn.addEventListener('click', prevTrack);
if (nextBtn) nextBtn.addEventListener('click', nextTrack);
if (volumeEl) volumeEl.addEventListener('input', setVolume);
if (progressContainer) progressContainer.addEventListener('click', seek);
if (shuffleBtn) shuffleBtn.addEventListener('click', toggleShuffle);
if (repeatBtn) repeatBtn.addEventListener('click', toggleRepeat);
if (unloadButton) unloadButton.addEventListener('click', unloadFolder);
if (fullscreenBtn) fullscreenBtn.addEventListener('click', toggleFullscreen);

// Filter buttons
if (filterAllBtn) filterAllBtn.addEventListener('click', () => setFilter('all'));
if (filterSongsBtn) filterSongsBtn.addEventListener('click', () => setFilter('songs'));
if (filterVideosBtn) filterVideosBtn.addEventListener('click', () => setFilter('videos'));

// Folder input handler
if (folderInput) folderInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
        loadFiles(files);
    }
});

// Mode selector
if (modeSelector) modeSelector.addEventListener('change', async (e) => {
    const mode = e.target.value;
    currentMode = mode;
    if (mode === 'bundled') {
        fileControls.style.display = 'none';
        await loadBundledTracks();
    } else if (mode === 'files') {
        fileControls.style.display = 'block';
        stopPlayback();
        updateSongSelector([]);
        statusEl.textContent = 'Select files or folder to load tracks';
    }
});

// File input
if (fileInput) fileInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
        loadFiles(files);
    }
});

// Close button - closes the window
if (closeBtn) {
    closeBtn.addEventListener('click', () => {
        window.close();
    });
}

// Help button - shows keyboard shortcuts
if (helpBtn && helpOverlay) {
    helpBtn.addEventListener('click', () => {
        helpOverlay.style.display = 'block';
    });
}

if (helpCloseBtn && helpOverlay) {
    helpCloseBtn.addEventListener('click', () => {
        helpOverlay.style.display = 'none';
    });
}

if (helpOverlay) {
    helpOverlay.addEventListener('click', (e) => {
        if (e.target === helpOverlay) {
            helpOverlay.style.display = 'none';
        }
    });
}

// Setup keyboard shortcuts
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Ignore if typing in input/select
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
        
        switch(e.key) {
            case ' ':
            case 'k':
                e.preventDefault();
                togglePlay();
                break;
            case 'ArrowLeft':
            case 'j':
                e.preventDefault();
                if (e.shiftKey) {
                    prevTrack();
                } else {
                    // Seek backward 5 seconds
                    if (currentMedia.currentTime > 0) {
                        currentMedia.currentTime = Math.max(0, currentMedia.currentTime - 5);
                    }
                }
                break;
            case 'ArrowRight':
            case 'l':
                e.preventDefault();
                if (e.shiftKey) {
                    nextTrack();
                } else {
                    // Seek forward 5 seconds
                    if (currentMedia.duration) {
                        currentMedia.currentTime = Math.min(currentMedia.duration, currentMedia.currentTime + 5);
                    }
                }
                break;
            case 'ArrowUp':
                e.preventDefault();
                // Increase volume
                if (volumeEl) {
                    volumeEl.value = Math.min(1, parseFloat(volumeEl.value) + 0.1);
                    setVolume();
                }
                break;
            case 'ArrowDown':
                e.preventDefault();
                // Decrease volume
                if (volumeEl) {
                    volumeEl.value = Math.max(0, parseFloat(volumeEl.value) - 0.1);
                    setVolume();
                }
                break;
            case 'm':
                e.preventDefault();
                // Toggle mute
                if (volumeEl) {
                    const currentVol = parseFloat(volumeEl.value);
                    if (currentVol > 0) {
                        volumeEl.dataset.prevVolume = currentVol;
                        volumeEl.value = 0;
                    } else {
                        volumeEl.value = volumeEl.dataset.prevVolume || 0.5;
                    }
                    setVolume();
                }
                break;
            case 's':
                e.preventDefault();
                toggleShuffle();
                break;
            case 'r':
                e.preventDefault();
                toggleRepeat();
                break;
            case 'f':
            case 'F':
                e.preventDefault();
                toggleFullscreen();
                break;
        }
    });
}

// Toggle fullscreen
function toggleFullscreen() {
    isFullscreen = !isFullscreen;
    if (popupRoot) {
        popupRoot.classList.toggle('fullscreen', isFullscreen);
    }
    if (fullscreenBtn) {
        fullscreenBtn.textContent = isFullscreen ? '⛶' : '⛶';
        fullscreenBtn.title = isFullscreen ? 'Exit Fullscreen (F)' : 'Fullscreen (F)';
    }
}

// Set filter
function setFilter(filter) {
    currentFilter = filter;
    
    // Update filter button states
    document.querySelectorAll('.filter-tab').forEach(btn => {
        btn.classList.remove('active');
    });
    
    if (filter === 'all' && filterAllBtn) {
        filterAllBtn.classList.add('active');
    } else if (filter === 'songs' && filterSongsBtn) {
        filterSongsBtn.classList.add('active');
    } else if (filter === 'videos' && filterVideosBtn) {
        filterVideosBtn.classList.add('active');
    }
    
    renderTrackList();
}

// Initialize
init();
