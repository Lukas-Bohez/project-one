/*---------------------------------------/*
 # CONVERTER JAVASCRIPT
/*---------------------------------------*/

// Global variables
let currentPlatform = 'youtube';
let formatValue = 1; // 1 = MP3, 0 = MP4
let audioQuality = 128;
let videoQuality = 720;
let isProcessing = false;
let currentDownloadId = null;
let statusCheckInterval = null;
// Frontend playlist/queue storage for chunked downloads
let playlistModeActive = false;
let playlistQueue = []; // array of {id,title}
let frontendStorage = []; // array of {filename, blob, size}
let frontendStorageSize = 0; // bytes
const FRONTEND_STORAGE_THRESHOLD = 1000000000; // 1GB
let frontendPartIndex = 1;
let processingQueue = false;
let waitingForContinue = false;

// URL patterns for different platforms
const urlPatterns = {
    youtube: /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|embed|watch|shorts)\/|.*[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    tiktok: /(?:tiktok\.com\/@[\w.-]+\/video\/|vm\.tiktok\.com\/|vt\.tiktok\.com\/)[\w.-]+/,
    instagram: /(?:instagram\.com\/(?:p|reel|tv)\/[\w-]+)/,
    reddit: /(?:reddit\.com\/r\/[\w]+\/comments\/[\w]+\/|v\.redd\.it\/[\w]+)/,
    facebook: /(?:facebook\.com\/(?:[\w.-]+\/videos\/|watch\/?\?v=)|fb\.watch\/)[\w.-]+/,
    twitch: /(?:twitch\.tv\/[\w]+\/clip\/[\w-]+|clips\.twitch\.tv\/[\w-]+)/,
    twitter: /(?:twitter\.com\/[\w]+\/status\/\d+|x\.com\/[\w]+\/status\/\d+)/
};

// Platform display names
const platformNames = {
    youtube: 'YouTube',
    tiktok: 'TikTok',
    instagram: 'Instagram',
    reddit: 'Reddit',
    facebook: 'Facebook',
    twitch: 'Twitch',
    twitter: 'Twitter/X'
};

// DOM Elements
const videoUrlInput = document.getElementById('video-url');
const convertButton = document.getElementById('convert-button');
const spinner = document.getElementById('spinner');
const spinnerText = document.getElementById('spinner-text');
const videoInfo = document.getElementById('video-info');
const formContainer = document.getElementById('form-container');
const downloadBtn = document.getElementById('download-btn');

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
    updateUIForPlatform('youtube');
});

// Initialize all event listeners
function initializeEventListeners() {
    // Convert button
    convertButton.addEventListener('click', handleConversion);
    
    // Social platform buttons
    document.querySelectorAll('.social-button-container').forEach(button => {
        button.addEventListener('click', handlePlatformSwitch);
    });
    
    // Format selection
    setupDropdown('format-select');
    setupDropdown('quality-audio-select');
    setupDropdown('quality-video-select');
    
    // URL input validation with debouncing
    let validationTimeout;
    videoUrlInput.addEventListener('input', () => {
        clearTimeout(validationTimeout);
        validationTimeout = setTimeout(validateUrl, 500);
    });
    videoUrlInput.addEventListener('paste', handleUrlPaste);
    
    // Download button
    if (downloadBtn) {
        downloadBtn.addEventListener('click', handleDownload);
    }
    
    // Modal controls
    setupModalControls();
}

// Setup dropdown functionality
function setupDropdown(selectType) {
    const display = document.getElementById(`${selectType}-display`);
    const list = document.getElementById(`${selectType}-list`);
    const options = document.querySelectorAll(`#${selectType}-list .${selectType}-options`);
    
    if (!display || !list) return;
    
    // Toggle dropdown
    display.addEventListener('click', function(e) {
        e.stopPropagation();
        closeAllDropdowns();
        list.style.display = list.style.display === 'block' ? 'none' : 'block';
        display.classList.toggle('active');
    });
    
    // Handle option selection
    options.forEach(option => {
        option.addEventListener('click', function() {
            // Remove active class from all options
            options.forEach(opt => opt.classList.remove('active'));
            // Add active class to selected option
            this.classList.add('active');
            
            // Update display text
            const displayValue = display.querySelector('span');
            if (displayValue) {
                displayValue.textContent = this.textContent;
            }
            
            // Update global variables based on selection type
            if (selectType === 'format-select') {
                formatValue = parseInt(this.getAttribute('data-format'));
                updateQualityOptions();
            } else if (selectType === 'quality-audio-select') {
                audioQuality = parseInt(this.getAttribute('data-quality'));
            } else if (selectType === 'quality-video-select') {
                videoQuality = parseInt(this.getAttribute('data-quality'));
            }
            
            // Close dropdown
            list.style.display = 'none';
            display.classList.remove('active');
        });
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', function() {
        list.style.display = 'none';
        display.classList.remove('active');
    });
}

// Close all open dropdowns
function closeAllDropdowns() {
    document.querySelectorAll('.select-list').forEach(list => {
        list.style.display = 'none';
    });
    document.querySelectorAll('.select-display').forEach(display => {
        display.classList.remove('active');
    });
}

// Handle platform switching
function handlePlatformSwitch() {
    // Remove active class from all buttons
    document.querySelectorAll('.social-button-container').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Add active class to clicked button
    this.classList.add('active');
    
    // Get platform from data attribute or class
    const platform = this.getAttribute('data-platform') || 
                    Array.from(this.classList).find(cls => cls !== 'social-button-container');
    
    if (platform) {
        currentPlatform = platform;
        updateUIForPlatform(platform);
    }
}

// Update UI elements based on selected platform
function updateUIForPlatform(platform) {
    // Hide all platform-specific input texts
    document.querySelectorAll('[class^="social-input-"]').forEach(input => {
        input.style.display = 'none';
    });
    
    // Show current platform input text
    const currentInput = document.querySelector(`.social-input-${platform}`);
    if (currentInput) {
        currentInput.style.display = 'block';
    }
    
    // Hide all content sections
    document.querySelectorAll('[class^="content-second-"]').forEach(section => {
        section.style.display = 'none';
    });
    
    // Show current platform content section
    const currentSection = document.querySelector(`.content-second-${platform}`);
    if (currentSection) {
        currentSection.style.display = 'block';
    }
    
    // Update placeholder text
    updatePlaceholder(platform);
    
    // Update format options based on platform
    updateFormatOptionsForPlatform(platform);
}

// Update input placeholder based on platform
function updatePlaceholder(platform) {
    const placeholders = {
        youtube: 'https://www.youtube.com/watch?v=example',
        tiktok: 'https://www.tiktok.com/@user/video/example',
        instagram: 'https://www.instagram.com/reel/example',
        reddit: 'https://www.reddit.com/r/example/comments/example',
        facebook: 'https://www.facebook.com/watch?v=example',
        twitch: 'https://www.twitch.tv/user/clip/example',
        twitter: 'https://twitter.com/user/status/example'
    };
    
    if (videoUrlInput && placeholders[platform]) {
        videoUrlInput.placeholder = placeholders[platform];
    }
}

// Update format options based on platform capabilities
function updateFormatOptionsForPlatform(platform) {
    const audioBox = document.querySelector('.quality-audio-select-box');
    const videoBox = document.querySelector('.quality-video-select-box');
    
    if (platform === 'youtube') {
        // YouTube supports both formats with quality options
        if (formatValue === 1) { // MP3
            audioBox.style.display = 'block';
            videoBox.style.display = 'none';
        } else { // MP4
            audioBox.style.display = 'none';
            videoBox.style.display = 'block';
        }
    } else {
        // Other platforms typically only support MP4 download
        audioBox.style.display = 'none';
        videoBox.style.display = 'none';
        
        // Set format to MP4 for non-YouTube platforms
        if (platform !== 'youtube') {
            formatValue = 0;
            const formatDisplay = document.getElementById('format-select-display-value');
            if (formatDisplay) {
                formatDisplay.textContent = 'MP4 (Video)';
            }
            
            // Update active format option
            document.querySelectorAll('.format-select-options').forEach(opt => {
                opt.classList.remove('active');
            });
            const mp4Option = document.querySelector('.format-select-options[data-format="0"]');
            if (mp4Option) {
                mp4Option.classList.add('active');
            }
        }
    }
}

// Update quality options when format changes
function updateQualityOptions() {
    const audioBox = document.querySelector('.quality-audio-select-box');
    const videoBox = document.querySelector('.quality-video-select-box');
    
    if (currentPlatform === 'youtube') {
        if (formatValue === 1) { // MP3
            audioBox.style.display = 'block';
            videoBox.style.display = 'none';
        } else { // MP4
            audioBox.style.display = 'none';
            videoBox.style.display = 'block';
        }
    }
}

// Validate URL input with backend
async function validateUrl() {
    const url = videoUrlInput.value.trim();
    const errorContainer = getOrCreateErrorContainer();
    
    // Clear previous errors
    clearValidationErrors();
    
    if (!url) {
        return true; // Empty is okay
    }
    
    try {
        console.log('🔍 Validating URL:', url);
        console.log('📡 API endpoint:', `${API_BASE_URL}/api/v1/video/validate`);
        
        const response = await fetch(`${API_BASE_URL}/api/v1/video/validate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url })
        });
        
        console.log('📨 Validation response status:', response.status);
        const result = await response.json();
        console.log('📋 Validation result:', result);
        
        if (response.ok && result.valid) {
            // Check if it's a playlist
            if (result.is_playlist) {
                showPlaylistUI(result.playlist_id, url);
                return true;
            }
            
            // Auto-switch platform if detected
            if (result.platform !== currentPlatform) {
                const platformButton = document.querySelector(`.social-button-container[data-platform="${result.platform}"]`);
                if (platformButton) {
                    platformButton.click();
                }
            }
            
            // Hide playlist UI if it was shown
            hidePlaylistUI();
            
            showValidationSuccess(result.message);
            return true;
        } else {
            // Hide playlist UI on error
            hidePlaylistUI();
            showValidationError(result.error || 'Invalid URL');
            return false;
        }
    } catch (error) {
        console.error('URL validation error:', error);
        // Fallback to client-side validation
        const pattern = urlPatterns[currentPlatform];
        const isValid = pattern && pattern.test(url);
        
        if (!isValid && url.length > 0) {
            showValidationError(`Please enter a valid ${platformNames[currentPlatform]} URL`);
            return false;
        }
        
        return true;
    }
}

// Handle URL paste event
function handleUrlPaste(e) {
    setTimeout(() => {
        validateUrl();
        // Try to detect platform from URL
        detectPlatformFromUrl(e.target.value);
    }, 100);
}

// Detect platform from pasted URL
function detectPlatformFromUrl(url) {
    for (const [platform, pattern] of Object.entries(urlPatterns)) {
        if (pattern.test(url)) {
            // Switch to detected platform
            const platformButton = document.querySelector(`.social-button-container.${platform}`);
            if (platformButton && !platformButton.classList.contains('active')) {
                platformButton.click();
            }
            break;
        }
    }
}

// Show validation error
function showValidationError(message) {
    videoUrlInput.classList.add('input-error');
    const errorContainer = getOrCreateErrorContainer();
    errorContainer.textContent = message;
    errorContainer.classList.add('error-message');
    errorContainer.classList.remove('success-message');
}

// Show validation success
function showValidationSuccess(message = 'URL looks good!') {
    videoUrlInput.classList.remove('input-error');
    const errorContainer = getOrCreateErrorContainer();
    errorContainer.textContent = message;
    errorContainer.classList.add('success-message');
    errorContainer.classList.remove('error-message');
    
    // Hide success message after 3 seconds
    setTimeout(() => {
        errorContainer.textContent = '';
        errorContainer.classList.remove('success-message');
    }, 3000);
}

// Clear validation errors
function clearValidationErrors() {
    videoUrlInput.classList.remove('input-error');
    const errorContainer = getOrCreateErrorContainer();
    errorContainer.textContent = '';
    errorContainer.classList.remove('error-message', 'success-message');
}

// Get or create error container
function getOrCreateErrorContainer() {
    let container = document.querySelector('.url-validation-message');
    if (!container) {
        container = document.createElement('div');
        container.className = 'url-validation-message';
        videoUrlInput.parentNode.appendChild(container);
    }
    return container;
}

// Playlist UI functions
let currentPlaylistData = null;

async function showPlaylistUI(playlistId, playlistUrl) {
    try {
        console.log('📋 Fetching playlist info for:', playlistId);

        const response = await fetch(`${API_BASE_URL}/api/v1/video/playlist-info`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url: playlistUrl })
        });

        const result = await response.json();
        console.log('📋 Playlist info result:', result);

        if (response.ok && result.success) {
            currentPlaylistData = result;

            // Enable playlist mode and disable main convert button to avoid normal flow
            playlistModeActive = true;
            if (convertButton) {
                convertButton.disabled = true;
                convertButton.classList.add('c-btn--disabled');
                convertButton.setAttribute('title', 'Convert disabled while playlist is loaded. Use playlist controls.');
            }

            // Check if playlist has 0 videos - fall back to individual video conversion
            if (result.video_count === 0) {
                console.log('📋 Playlist has 0 videos, falling back to individual video conversion');
                showValidationSuccess('Playlist is empty, converting individual video instead');

                // Extract individual video URL from playlist URL
                const individualVideoUrl = extractIndividualVideoUrl(playlistUrl);
                if (individualVideoUrl) {
                    console.log('✅ Extracted individual video URL:', individualVideoUrl);
                    // Update the input field with the individual video URL for consistency
                    videoUrlInput.value = individualVideoUrl;
                    // Hide playlist UI
                    hidePlaylistUI();
                    // Return true to indicate validation passed - we'll use the individual URL
                    return true;
                } else {
                    showValidationError('Could not extract individual video URL from playlist');
                    hidePlaylistUI();
                    return false;
                }
            }

            renderPlaylistUI(result);
            showValidationSuccess(`Playlist loaded: ${result.video_count} videos`);
            return true;
        } else {
            showValidationError(result.error || 'Failed to load playlist');
            hidePlaylistUI();
            return false;
        }
    } catch (error) {
        console.error('Playlist info error:', error);
        showValidationError('Failed to load playlist information');
        hidePlaylistUI();
        return false;
    }
}

function hidePlaylistUI() {
    const playlistContainer = document.getElementById('playlist-container');
    if (playlistContainer) {
        playlistContainer.style.display = 'none';
    }
    currentPlaylistData = null;
}

function renderPlaylistUI(playlistData) {
    let playlistContainer = document.getElementById('playlist-container');
    
    if (!playlistContainer) {
        playlistContainer = document.createElement('div');
        playlistContainer.id = 'playlist-container';
        playlistContainer.className = 'playlist-container';
        
        // Insert after the converter form
        const formContainer = document.getElementById('form-container');
        formContainer.parentNode.insertBefore(playlistContainer, formContainer.nextSibling);
    }
    
    playlistContainer.innerHTML = `
        <div class="playlist-header">
            <h3>${playlistData.title}</h3>
            <p>${playlistData.video_count} videos in playlist</p>
            <div id="playlist-status" class="playlist-status" style="margin-top:8px;font-size:0.95em;color:#bcd;">
                <span id="playlist-status-text">Idle</span>
            </div>
            <div class="playlist-actions c-cta-buttons">
                <button id="download-all-btn" class="c-btn c-btn--primary download-all-btn">
                    <i class="fas fa-download"></i> Download All (${playlistData.video_count} videos)
                </button>
                <button id="download-up-to-now-btn" class="c-btn c-btn--tertiary download-up-to-now-btn" style="margin-left:8px;">
                    <i class="fas fa-save"></i> Download Up To Now
                </button>
                <button id="clear-cache-btn" class="c-btn c-btn--tertiary" style="margin-left:8px;">
                    <i class="fas fa-trash-alt"></i> Clear Cache
                </button>
                <button id="select-videos-btn" class="c-btn c-btn--tertiary select-videos-btn">
                    <i class="fas fa-list"></i> Select Individual Videos
                </button>
                <button id="continue-btn" class="c-btn c-btn--primary" style="display:none;margin-left:12px;">
                    <i class="fas fa-arrow-right"></i> Continue
                </button>
                <button id="cancel-btn" class="c-btn c-btn--tertiary" style="display:none;margin-left:8px;">
                    <i class="fas fa-times"></i> Cancel
                </button>
            </div>
        </div>
        <div id="playlist-videos" class="playlist-videos" style="display: none;">
            <div class="playlist-controls">
                <button id="select-all-btn" class="c-btn c-btn--tertiary select-all-btn">Select All</button>
                <button id="deselect-all-btn" class="c-btn c-btn--tertiary deselect-all-btn">Deselect All</button>
                <button id="download-selected-btn" class="c-btn c-btn--primary download-selected-btn" disabled>
                    <i class="fas fa-download"></i> Download Selected
                </button>
                
            </div>
            <div class="videos-list">
                ${playlistData.videos.map((video, idx) => `
                    <div class="video-item" data-index="${idx+1}">
                        <input type="checkbox" class="video-checkbox" value="${video.id}" data-title="${video.title}">
                        <div class="video-info">
                            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
                                <div class="video-title" style="flex:1;">${video.title}</div>
                                <span class="cache-indicator" data-title="${video.title}">Not cached</span>
                            </div>
                            <div class="video-duration">${video.duration ? formatDuration(video.duration) : ''}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
            <div class="playlist-range-inputs" style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
                <label for="download-from-index-input" style="font-size:0.95em;color:#bcd;">From cache (start):</label>
                <input id="download-from-index-input" type="number" min="1" value="1" class="playlist-range-input" />
                <label for="download-from-index-end" style="font-size:0.95em;color:#bcd;">to (optional):</label>
                <input id="download-from-index-end" type="number" min="1" placeholder="end" class="playlist-range-input" />
            </div>
            <div class="playlist-range-actions" style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
                <button id="select-range-btn" class="c-btn c-btn--sm c-btn--tertiary" style="white-space:nowrap;">Select Range</button>
                <button id="download-from-index-btn" class="c-btn c-btn--sm c-btn--tertiary download-from-index-btn" style="white-space:nowrap;">
                    <i class="fas fa-download"></i> Download From Cache
                </button>
            </div>
        </div>
    `;
    
    playlistContainer.style.display = 'block';
    
    // Add event listeners
    setupPlaylistEventListeners();
    // Update cached indicators based on persisted IDB entries
    try { updateCachedIndicators(); } catch (e) { console.warn('updateCachedIndicators failed', e); }
    // Continue/Cancel handlers
    const cont = document.getElementById('continue-btn');
    const canc = document.getElementById('cancel-btn');
    if (cont) cont.addEventListener('click', continueAfterPart);
    if (canc) canc.addEventListener('click', cancelProcessing);
}

function showContinueControls(show) {
    const cont = document.getElementById('continue-btn');
    const canc = document.getElementById('cancel-btn');
    if (cont) cont.style.display = show ? 'inline-flex' : 'none';
    if (canc) canc.style.display = show ? 'inline-flex' : 'none';
}

async function continueAfterPart() {
    // User confirms they've downloaded the part; clear persisted storage and resume
    try {
        // Clear in-memory and IDB persisted blobs for the flushed part
        frontendStorage = [];
        frontendStorageSize = 0;
        waitingForContinue = false;
        showContinueControls(false);
        try { await clearAllBlobsFromIDB(); } catch (e) { console.warn('clearAllBlobsFromIDB failed', e); }
        updatePlaylistStatusUI();
        // Resume processing if queue not empty
        if (playlistQueue.length > 0) {
            processQueue();
        }
    } catch (e) {
        console.error('continueAfterPart error', e);
    }
}

function cancelProcessing() {
    // User cancelled — clear all and reset
    playlistQueue = [];
    frontendStorage = [];
    frontendStorageSize = 0;
    waitingForContinue = false;
    processingQueue = false;
    showContinueControls(false);
    try { clearAllBlobsFromIDB(); } catch (e) { console.warn('clearAllBlobsFromIDB failed', e); }
    updatePlaylistStatusUI();
    enableBulkControls();
    if (convertButton) {
        convertButton.disabled = false;
        convertButton.classList.remove('c-btn--disabled');
        convertButton.removeAttribute('title');
    }
}

// Update the playlist status UI (safe if element missing)
function updatePlaylistStatusUI(opts = {}) {
    try {
        const statusEl = document.getElementById('playlist-status-text');
        if (!statusEl) return;
        const queued = playlistQueue.length;
        const storedFiles = frontendStorage.length;
        const storedBytes = frontendStorageSize || 0;
        const part = frontendPartIndex;
        const current = opts.currentTitle ? `Current: ${opts.currentTitle}` : '';
        statusEl.textContent = `Queued: ${queued} · Stored files: ${storedFiles} · Stored size: ${(storedBytes/1024/1024).toFixed(1)} MB · Part: ${part} ${current}`;
    } catch (e) { console.warn('updatePlaylistStatusUI failed', e); }
}

function setupPlaylistEventListeners() {
    const downloadAllBtn = document.getElementById('download-all-btn');
    const selectVideosBtn = document.getElementById('select-videos-btn');
    const selectAllBtn = document.getElementById('select-all-btn');
    const deselectAllBtn = document.getElementById('deselect-all-btn');
    const downloadSelectedBtn = document.getElementById('download-selected-btn');
    const playlistVideos = document.getElementById('playlist-videos');
    
    if (downloadAllBtn) {
        downloadAllBtn.addEventListener('click', () => downloadAllVideos());
    }
    
    if (selectVideosBtn) {
        selectVideosBtn.addEventListener('click', () => {
            playlistVideos.style.display = playlistVideos.style.display === 'none' ? 'block' : 'none';
        });
    }
    
    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', () => {
            document.querySelectorAll('.video-checkbox').forEach(cb => cb.checked = true);
            updateDownloadSelectedButton();
        });
    }
    
    if (deselectAllBtn) {
        deselectAllBtn.addEventListener('click', () => {
            document.querySelectorAll('.video-checkbox').forEach(cb => cb.checked = false);
            updateDownloadSelectedButton();
        });
    }
    
    if (downloadSelectedBtn) {
        downloadSelectedBtn.addEventListener('click', () => downloadSelectedVideos());
    }
    const downloadUpToNowBtn = document.getElementById('download-up-to-now-btn');
    const downloadFromIndexBtn = document.getElementById('download-from-index-btn');
    const downloadFromIndexInput = document.getElementById('download-from-index-input');
    const downloadFromIndexEnd = document.getElementById('download-from-index-end');
    const selectRangeBtn = document.getElementById('select-range-btn');
    const clearCacheBtn = document.getElementById('clear-cache-btn');
    if (downloadUpToNowBtn) {
        downloadUpToNowBtn.addEventListener('click', () => downloadUpToNow());
    }
    if (downloadFromIndexBtn) {
        downloadFromIndexBtn.addEventListener('click', () => {
            const raw = parseInt(downloadFromIndexInput.value, 10);
            if (!raw || raw < 1) {
                alert('Please enter a valid start index (1-based)');
                return;
            }
            const rawEnd = parseInt(downloadFromIndexEnd.value, 10);
            if (rawEnd && rawEnd >= raw) {
                downloadFromIndexRange(raw, rawEnd);
            } else {
                downloadFromIndex(raw);
            }
        });
    }
    if (selectRangeBtn) {
        selectRangeBtn.addEventListener('click', () => selectRange());
    }
    if (clearCacheBtn) {
        clearCacheBtn.addEventListener('click', () => clearCachedSongs());
    }
    
    // Update download button when checkboxes change
    document.querySelectorAll('.video-checkbox').forEach(cb => {
        cb.addEventListener('change', updateDownloadSelectedButton);
    });
}

function updateDownloadSelectedButton() {
    const downloadSelectedBtn = document.getElementById('download-selected-btn');
    const checkedBoxes = document.querySelectorAll('.video-checkbox:checked');
    
    if (downloadSelectedBtn) {
        downloadSelectedBtn.disabled = checkedBoxes.length === 0;
        downloadSelectedBtn.innerHTML = `<i class="fas fa-download"></i> Download Selected (${checkedBoxes.length})`;
    }
}

// Disable bulk playlist buttons to prevent duplicate bulk requests
function disableBulkControls() {
    const ids = ['download-all-btn','download-selected-btn','select-videos-btn','select-all-btn','deselect-all-btn'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.disabled = true;
            el.classList && el.classList.add('c-btn--disabled');
            el.style.opacity = '0.6';
            el.style.pointerEvents = 'none';
        }
    });
}

function enableBulkControls() {
    const ids = ['download-all-btn','download-selected-btn','select-videos-btn','select-all-btn','deselect-all-btn'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.disabled = false;
            el.classList && el.classList.remove('c-btn--disabled');
            el.style.opacity = '';
            el.style.pointerEvents = '';
        }
    });
}

async function downloadAllVideos() {
    if (!currentPlaylistData) return;
    const videoIds = currentPlaylistData.videos.map(v => v.id);
    const titles = currentPlaylistData.videos.map(v => v.title);
    enqueueVideos(videoIds, titles);
    disableBulkControls();
    processQueue();
}

async function downloadSelectedVideos() {
    const selectedCheckboxes = document.querySelectorAll('.video-checkbox:checked');
    const videoIds = Array.from(selectedCheckboxes).map(cb => cb.value);
    
    if (videoIds.length === 0) return;
    const selectedTitles = Array.from(selectedCheckboxes).map(cb => cb.dataset.title);
    enqueueVideos(videoIds, selectedTitles);
    disableBulkControls();
    processQueue();
}

async function startBulkDownload(videoIds, description) {
    try {
        // Prevent duplicate bulk or single conversions while processing
        if (isProcessing) {
            console.log('⚠️ Already processing a conversion, ignoring bulk download request');
            return;
        }
        isProcessing = true;
        // Disable bulk controls and the main convert button to avoid extra requests
        disableBulkControls();
        disableConvertButtonVisuals();

        showSpinner();
        updateSpinnerText('Preparing bulk download...');
        
        const response = await fetch(`${API_BASE_URL}/api/v1/video/bulk-download`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                playlist_url: videoUrlInput.value.trim(),
                video_ids: videoIds,
                format: formatValue,
                quality: formatValue === 1 ? audioQuality : videoQuality
            })
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            currentDownloadId = result.download_id;
            startStatusPolling();
        } else {
            throw new Error(result.detail || 'Bulk download failed');
        }
    } catch (error) {
        console.error('Bulk download error:', error);
        showError(error.message || 'Bulk download failed');
        hideSpinner();
        // Re-enable UI so the user can try again
        isProcessing = false;
        enableBulkControls();
        enableConvertButtonVisuals();
    }
}

// Enqueue video ids/titles for frontend sequential processing
function enqueueVideos(ids, titles) {
    if (!Array.isArray(ids)) return;
    for (let i = 0; i < ids.length; i++) {
        playlistQueue.push({ id: ids[i], title: (titles && titles[i]) ? titles[i] : ids[i] });
    }
}

// Process the frontend queue one-by-one, converting each video via backend and storing blob
async function processQueue() {
    if (processingQueue) return;
    processingQueue = true;

    try {
        while (playlistQueue.length > 0) {
            const next = playlistQueue.shift();
            const videoUrl = `https://www.youtube.com/watch?v=${next.id}`;

            try {
                updateSpinnerText();
                isProcessing = true;
                // Use a subtle spinner during long-running playlist processing
                showSpinner('subtle');
                updatePlaylistStatusUI({ currentTitle: next.title });

                const convertResp = await fetch(`${API_BASE_URL}/api/v1/video/convert`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: videoUrl, format: formatValue, quality: formatValue === 1 ? audioQuality : videoQuality })
                });

                if (!convertResp.ok) {
                    console.warn('Failed to start conversion for', next.id, await convertResp.text());
                    continue; // proceed to next
                }

                const convertResult = await convertResp.json();
                const downloadId = convertResult.download_id;
                const status = await pollStatusUntilReady(downloadId);
                if (!status || status.status === 'error') {
                    console.warn('Conversion failed for', next.id, status && status.error);
                    continue;
                }

                const downloadResp = await fetch(`${API_BASE_URL}/api/v1/video/download/${downloadId}`);
                if (!downloadResp.ok) {
                    console.warn('Failed to download converted file for', next.id, await downloadResp.text());
                    continue;
                }

                const blob = await downloadResp.blob();
                let disposition = downloadResp.headers.get('content-disposition');
                let filename = null;
                if (disposition) filename = getFilenameFromContentDisposition(disposition);
                if (!filename) {
                    const ext = (formatValue === 1) ? '.mp3' : '.mp4';
                    const safe = (next.title || next.id).replace(/[<>:"/\\|?*\x00-\x1f]/g, '').substring(0,50).trim();
                    filename = `${safe}${ext}`;
                }

                addToFrontendStorage(filename, blob);

                if (frontendStorageSize >= FRONTEND_STORAGE_THRESHOLD) {
                    updatePlaylistStatusUI();
                    await flushFrontendStorageAsZip();
                    // After a zip part is created we intentionally pause, keep subtle spinner
                    // and wait for user Continue before clearing storage — do not hide UI.
                    // The flush function handles showing the Continue controls.
                }

                // short pause to keep UI responsive
                await new Promise(r => setTimeout(r, 200));
                updatePlaylistStatusUI();

            } catch (errItem) {
                console.error('Error processing queue item', next, errItem);
                // continue to next
                updatePlaylistStatusUI();
                continue;
            }
        }

        // queue drained — flush remaining
        if (frontendStorageSize > 0) {
            await flushFrontendStorageAsZip();
        }

    } finally {
        // Re-enable controls and reset state
        playlistModeActive = false;
        enableBulkControls();
        if (convertButton) {
            convertButton.disabled = false;
            convertButton.classList.remove('c-btn--disabled');
            convertButton.removeAttribute('title');
        }
        processingQueue = false;
        isProcessing = false;
        updatePlaylistStatusUI();
    }
}

// Poll status endpoint until conversion is ready or error/timeout
async function pollStatusUntilReady(downloadId, timeoutMs = 5 * 60 * 1000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        try {
            const resp = await fetch(`${API_BASE_URL}/api/v1/video/status/${downloadId}`);
            if (!resp.ok) {
                await new Promise(r => setTimeout(r, 1000));
                continue;
            }
            const s = await resp.json();
            if (s.status === 'completed') return s;
            if (s.status === 'error') return s;
        } catch (e) {
            // ignore and retry
        }
        await new Promise(r => setTimeout(r, 1500));
    }
    return null;
}

function addToFrontendStorage(filename, blob) {
    const size = blob.size || 0;
    frontendStorage.push({ filename, blob, size });
    frontendStorageSize += size;
    console.log(`Frontend storage: added ${filename} (${size} bytes). Total: ${frontendStorageSize} bytes.`);

    // Persist to IndexedDB for resiliency across reloads
    try {
        addBlobToIDB(filename, blob, size).catch(e => console.warn('IDB store failed', e));
    } catch (e) {
        console.warn('IDB not available:', e);
    }
    // Update UI
    updatePlaylistStatusUI();
    try { updateCachedIndicators(); } catch (e) { console.warn('updateCachedIndicators failed', e); }
}

// Mark which playlist items are cached based on persisted IDB filenames
async function updateCachedIndicators() {
    try {
        const items = await readAllBlobsFromIDB();
        const titles = (items || []).map(i => i.filename || i.title || '').filter(Boolean);
        document.querySelectorAll('.cache-indicator').forEach(el => {
            const t = el.getAttribute('data-title') || '';
            // Simple substring match: filename may include title; for better accuracy you can normalize strings
            const matched = titles.some(fn => fn.indexOf(t) !== -1 || t.indexOf(fn) !== -1);
            el.textContent = matched ? 'Cached' : 'Not cached';
            el.style.color = matched ? '#6ee7b7' : '#d0d0d0';
            el.style.fontWeight = matched ? '700' : '400';
            el.style.fontSize = '0.85em';
        });
    } catch (e) {
        console.warn('updateCachedIndicators error', e);
    }
}

// Ensure JSZip is loaded (via CDN) when needed
function ensureJSZip() {
    return new Promise((resolve, reject) => {
        if (window.JSZip) return resolve(window.JSZip);
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
        script.onload = () => resolve(window.JSZip);
        script.onerror = () => reject(new Error('Failed to load JSZip'));
        document.head.appendChild(script);
    });
}

// IndexedDB helpers (store persisted blobs for frontend packaging)
const IDB_DB_NAME = 'converter_frontend_store_v1';
const IDB_STORE_NAME = 'files';
function openIDB() {
    return new Promise((resolve, reject) => {
        if (!window.indexedDB) return reject(new Error('IndexedDB not supported'));
        const req = indexedDB.open(IDB_DB_NAME, 1);
        req.onupgradeneeded = function(e) {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
                db.createObjectStore(IDB_STORE_NAME, { keyPath: 'id', autoIncrement: true });
            }
        };
        req.onsuccess = function(e) {
            resolve(e.target.result);
        };
        req.onerror = function(e) {
            reject(e.target.error || new Error('IDB open error'));
        };
    });
}

async function addBlobToIDB(filename, blob, size) {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
        const store = tx.objectStore(IDB_STORE_NAME);
        const entry = { filename, blob, size, created: Date.now() };
        const r = store.add(entry);
        r.onsuccess = () => resolve(true);
        r.onerror = (e) => reject(e.target ? e.target.error : e);
    });
}

async function readAllBlobsFromIDB() {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE_NAME, 'readonly');
        const store = tx.objectStore(IDB_STORE_NAME);
        const req = store.getAll();
        req.onsuccess = function(e) {
            const results = e.target.result || [];
            // Map to {filename, blob, size}
            resolve(results.map(r => ({ filename: r.filename, blob: r.blob, size: r.size })));
        };
        req.onerror = function(e) { reject(e.target ? e.target.error : e); };
    });
}

async function clearAllBlobsFromIDB() {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
        const store = tx.objectStore(IDB_STORE_NAME);
        const req = store.clear();
        req.onsuccess = () => resolve(true);
        req.onerror = (e) => reject(e.target ? e.target.error : e);
    });
}

async function flushFrontendStorageAsZip() {
    // If nothing in in-memory storage, try to load persisted entries from IDB
    if (frontendStorage.length === 0) {
        try {
            const persisted = await readAllBlobsFromIDB();
            if (persisted && persisted.length > 0) {
                frontendStorage = persisted.map(p => ({ filename: p.filename, blob: p.blob, size: p.size }));
                frontendStorageSize = frontendStorage.reduce((s, it) => s + (it.size || 0), 0);
            }
        } catch (e) {
            console.warn('Failed to read persisted frontend storage', e);
        }
    }
    if (frontendStorage.length === 0) return;
    try {
        showSpinner('subtle');
        const JSZipLib = await ensureJSZip();
        const zip = new JSZipLib();
        for (const item of frontendStorage) {
            // add as arrayBuffer for better performance
            const data = await item.blob.arrayBuffer();
            zip.file(item.filename, data);
        }

        // Generate zip as blob (compression default)
        const zipBlob = await zip.generateAsync({ type: 'blob' }, metadata => {
            // optionally, update UI with progress
            // console.log('zip progress', metadata.percent);
        });

        const partNameSafe = `playlist_part_${frontendPartIndex}.zip`;
        triggerBlobDownload(zipBlob, partNameSafe);
        frontendPartIndex += 1;

        // Pause processing and ask user to Continue when they're ready.
        waitingForContinue = true;
        showContinueControls(true);
        // Do NOT clear persisted storage until user confirms (continueAfterPart)

    } catch (e) {
        console.error('Failed to create ZIP part in frontend', e);
    } finally {
        hideSpinner('subtle');
    }
}

function triggerBlobDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// Create ZIP from persisted IndexedDB blobs and trigger download
async function downloadUpToNow() {
    try {
        // Read all persisted blobs
        const items = await readAllBlobsFromIDB();
        if (!items || items.length === 0) {
            alert('No stored files available to download yet.');
            return;
        }
        // Use all items
        await createZipFromItems(items, `playlist_up_to_now_part_${frontendPartIndex}.zip`);
        // Do not clear persisted storage; this is a copy for user convenience
    } catch (e) {
        console.error('downloadUpToNow failed', e);
        alert('Failed to create ZIP: ' + (e && e.message ? e.message : e));
    }
}

// Download from a given 1-based index (inclusive)
async function downloadFromIndex(startIndexOneBased) {
    try {
        const items = await readAllBlobsFromIDB();
        if (!items || items.length === 0) {
            alert('No stored files available to download yet.');
            return;
        }
        const start = Math.max(1, startIndexOneBased) - 1;
        if (start >= items.length) {
            alert(`Start index is greater than the number of stored files (${items.length}).`);
            return;
        }
        const slice = items.slice(start);
        await createZipFromItems(slice, `playlist_from_${startIndexOneBased}_part_${frontendPartIndex}.zip`);
    } catch (e) {
        console.error('downloadFromIndex failed', e);
        alert('Failed to create ZIP: ' + (e && e.message ? e.message : e));
    }
}

// Helper: create ZIP from array of {filename, blob, size} and trigger download
async function createZipFromItems(items, outputFilename) {
    if (!items || items.length === 0) return;
    try {
        showSpinner('subtle');
        const JSZipLib = await ensureJSZip();
        const zip = new JSZipLib();
        for (const item of items) {
            try {
                const data = await item.blob.arrayBuffer();
                zip.file(item.filename, data);
            } catch (e) {
                console.warn('Skipping item during ZIP creation', item && item.filename, e);
            }
        }
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        triggerBlobDownload(zipBlob, outputFilename);
        // Advance part index so manual downloads don't collide with auto-flush part names
        try { frontendPartIndex += 1; } catch (e) { /* ignore */ }
    } finally {
        hideSpinner('subtle');
    }
}

// Select a range of videos in the playlist UI based on the from/to inputs
function selectRange() {
    try {
        const startInput = document.getElementById('download-from-index-input');
        const endInput = document.getElementById('download-from-index-end');
        const start = Math.max(1, parseInt(startInput.value || '1', 10)) - 1;
        const endRaw = parseInt(endInput.value || '', 10);
        const checkboxes = Array.from(document.querySelectorAll('.video-checkbox'));
        if (checkboxes.length === 0) {
            alert('No videos available in the selection list.');
            return;
        }
        let end = endRaw && endRaw > 0 ? Math.min(endRaw, checkboxes.length) - 1 : checkboxes.length - 1;
        if (start < 0 || start >= checkboxes.length) {
            alert('Start index out of range');
            return;
        }
        if (end < start) {
            alert('End index must be greater than or equal to start');
            return;
        }
        // Deselect all first
        checkboxes.forEach(cb => cb.checked = false);
        // Select range
        for (let i = start; i <= end; i++) {
            checkboxes[i].checked = true;
        }
        updateDownloadSelectedButton();
        // Ensure the videos list is visible
        const playlistVideos = document.getElementById('playlist-videos');
        if (playlistVideos) playlistVideos.style.display = 'block';
    } catch (e) {
        console.error('selectRange failed', e);
        alert('Failed to select range');
    }
}

// ZIP an inclusive range from start..end (1-based indices)
async function downloadFromIndexRange(startOneBased, endOneBased) {
    try {
        const items = await readAllBlobsFromIDB();
        if (!items || items.length === 0) {
            alert('No stored files available to download yet.');
            return;
        }
        const start = Math.max(1, startOneBased) - 1;
        const end = Math.min(items.length, Math.max(startOneBased, endOneBased)) - 1;
        if (start >= items.length) {
            alert(`Start index is greater than the number of stored files (${items.length}).`);
            return;
        }
        const slice = items.slice(start, end + 1);
        await createZipFromItems(slice, `playlist_from_${startOneBased}_to_${endOneBased}_part_${frontendPartIndex}.zip`);
    } catch (e) {
        console.error('downloadFromIndexRange failed', e);
        alert('Failed to create ZIP: ' + (e && e.message ? e.message : e));
    }
}

// Clear in-memory and persisted cached songs (IndexedDB)
async function clearCachedSongs() {
    try {
        if (!confirm('This will clear the locally cached downloaded files (frontend cache). Continue?')) return;
        // Clear in-memory
        frontendStorage = [];
        frontendStorageSize = 0;
        waitingForContinue = false;
        // Clear persisted
        try { await clearAllBlobsFromIDB(); } catch (e) { console.warn('Failed to clear IDB', e); }
        // Uncheck any checkboxes and update UI
        document.querySelectorAll('.video-checkbox').forEach(cb => cb.checked = false);
        updateDownloadSelectedButton();
        updatePlaylistStatusUI();
        alert('Local cache cleared.');
    } catch (e) {
        console.error('clearCachedSongs failed', e);
        alert('Failed to clear cache: ' + (e && e.message ? e.message : e));
    }
}

function formatDuration(seconds) {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Handle conversion process
async function handleConversion(e) {
    e.preventDefault();
    console.log('🎯 Convert button clicked!');
    console.log('🔄 isProcessing:', isProcessing);

    // Prevent duplicate clicks immediately: if we're already processing, ignore.
    if (isProcessing) {
        console.log('⚠️ Already processing, ignoring click');
        return;
    }

    // If there is an active bulk download in progress, make Convert act as "Continue"
    // so users can press it to fetch the next available part instead of restarting.
    if (currentDownloadId) {
        try {
            const cont = await tryContinueBulkDownload();
            if (cont) {
                // We triggered a continue/download flow; no further action needed.
                return;
            }
        } catch (err) {
            console.warn('Continue bulk check failed, proceeding with normal conversion', err);
        }
    }

    // If playlist UI is active, do not allow normal convert flow — playlists use frontend queue
    if (playlistModeActive) {
        console.log('Playlist mode active: normal Convert is disabled. Use playlist controls.');
        // Visual hint already applied in showPlaylistUI; reset processing flag
        isProcessing = false;
        return;
    }

    // Mark processing and adjust visuals for a normal conversion start
    isProcessing = true;
    disableConvertButtonVisuals();
    
    const url = videoUrlInput.value.trim();
    console.log('🔗 URL from input:', url);
    
    if (!url) {
        console.log('❌ No URL provided');
        showValidationError('Please enter a video URL');
        // Reset processing state so the user can try again
        isProcessing = false;
        enableConvertButtonVisuals();
        return;
    }
    
    console.log('✅ Validating URL...');
    const isValid = await validateUrl();
    console.log('🔍 URL validation result:', isValid);
    
    if (!isValid) {
        console.log('❌ URL validation failed');
        // Reset processing state so the user can try again
        isProcessing = false;
        enableConvertButtonVisuals();
        return;
    }
    
    // Check if URL is a playlist with potential 0 videos - extract individual URL if needed
    let finalUrl = url;
    if (url.includes('list=') && url.includes('v=')) {
        console.log('🔗 URL appears to be a playlist, checking if we need to extract individual video URL');
        const extractedUrl = extractIndividualVideoUrl(url);
        if (extractedUrl) {
            finalUrl = extractedUrl;
            console.log('✅ Using extracted individual video URL for conversion:', finalUrl);
        }
    }
    
    isProcessing = true;
    console.log('🚀 Starting conversion process...');
    showSpinner();
    
    try {
        // Start conversion process
        await startConversion(finalUrl);
    } catch (error) {
        console.error('💥 Conversion error:', error);
        showError(error.message || 'Conversion failed');
        isProcessing = false;
        hideSpinner();
        enableConvertButtonVisuals();
    }
}

// Helper: check currentDownloadId status and if it's a bulk in-progress, trigger download flow
async function tryContinueBulkDownload() {
    if (!currentDownloadId) return false;

    try {
        const statusResp = await fetch(`${API_BASE_URL}/api/v1/video/status/${currentDownloadId}`);
        if (!statusResp.ok) return false;
        const status = await statusResp.json();

        // If it's a bulk download and either a ready file_path exists or parts_remaining > 0,
        // call the download handler (which will fetch the current part). Return true to indicate
        // we performed a continue action.
        if (status.format && status.format.includes('Bulk')) {
            const hasReadyPart = !!status.parts_remaining && status.parts_remaining > 0;
            const hasFilePath = !!status.file_path || hasReadyPart;

            if (hasFilePath) {
                console.log('🔁 Continuing bulk download via Convert button');
                // Visuals: show spinner and call handleDownload
                showSpinner();
                await handleDownload();
                return true;
            }
        }

        return false;
    } catch (e) {
        console.warn('Error while checking for bulk continuation:', e);
        return false;
    }
}

// Show loading spinner
function showSpinner() {
    // Backwards compatible: default to modal behavior
    showSpinner('modal');
}

// Hide spinner
function hideSpinner() {
    spinner.style.display = 'none';
    formContainer.style.display = 'block';
    convertButton.disabled = false;
}

// Enhanced showSpinner with mode: 'modal' (hide UI) or 'subtle' (keep UI visible)
function showSpinner(mode = 'modal') {
    if (!spinner) return;
    if (mode === 'modal') {
        if (formContainer) formContainer.style.display = 'none';
        if (videoInfo) videoInfo.style.display = 'none';
        spinner.style.display = 'flex';
        if (convertButton) convertButton.disabled = true;
    } else if (mode === 'subtle') {
        // subtle spinner: keep UI visible, show small spinner indicator
        spinner.style.display = 'flex';
        // don't hide form or video info, don't disable buttons
        // apply a 'subtle' class so CSS can make it less intrusive if available
        spinner.classList.add('spinner-subtle');
    }

    // Update spinner text based on process stage
    updateSpinnerText();
}

function hideSpinner(mode = 'modal') {
    if (!spinner) return;
    spinner.style.display = 'none';
    spinner.classList.remove('spinner-subtle');
    if (mode === 'modal') {
        if (formContainer) formContainer.style.display = 'block';
        if (convertButton) convertButton.disabled = false;
    }
}

// Visual disable (and warning) when a conversion is initiated to prevent duplicate requests
function disableConvertButtonVisuals() {
    if (!convertButton) return;
    convertButton.disabled = true;
    convertButton.setAttribute('aria-disabled', 'true');
    convertButton.classList.add('c-btn--disabled');
    // Make it visually muted
    convertButton.style.opacity = '0.6';
    convertButton.style.pointerEvents = 'none';
    // Show a patience / rate limit warning so user knows to wait
    let warn = document.getElementById('convert-warn');
    if (!warn) {
        warn = document.createElement('div');
        warn.id = 'convert-warn';
        warn.className = 'error-message';
        warn.style.marginTop = '8px';
        warn.style.fontWeight = '600';
        warn.textContent = "Please wait — conversion in progress. Repeated requests may be rate-limited.";
        if (formContainer) formContainer.appendChild(warn);
    }
}

function enableConvertButtonVisuals() {
    if (!convertButton) return;
    convertButton.disabled = false;
    convertButton.removeAttribute('aria-disabled');
    convertButton.classList.remove('c-btn--disabled');
    convertButton.style.opacity = '';
    convertButton.style.pointerEvents = '';
    // Remove patience warning
    const warn = document.getElementById('convert-warn');
    if (warn && warn.parentNode) warn.parentNode.removeChild(warn);
}

// Update spinner text during process
function updateSpinnerText() {
    const stages = [
        'Analyzing URL...',
        'Fetching video data...',
        'Processing conversion...',
        'Preparing download...'
    ];
    
    let stageIndex = 0;
    spinnerText.textContent = stages[stageIndex];
    
    const interval = setInterval(() => {
        stageIndex = (stageIndex + 1) % stages.length;
        if (spinnerText) {
            spinnerText.textContent = stages[stageIndex];
        }
        
        if (!isProcessing) {
            clearInterval(interval);
        }
    }, 1500);
}

// Helper to extract filename from Content-Disposition header
function getFilenameFromContentDisposition(header) {
    if (!header) return null;
    // content-disposition: attachment; filename="example.zip"; filename*=UTF-8''example.zip
    const filenameMatch = header.match(/filename\*=UTF-8''([^;\n\r]+)/i);
    if (filenameMatch && filenameMatch[1]) {
        try {
            return decodeURIComponent(filenameMatch[1].replace(/"/g, ''));
        } catch (e) {
            return filenameMatch[1].replace(/"/g, '');
        }
    }
    const simpleMatch = header.match(/filename="?([^";]+)"?/i);
    if (simpleMatch && simpleMatch[1]) return simpleMatch[1];
    return null;
}

// Start actual conversion process
async function startConversion(url) {
    try {
        // Start conversion
        console.log('🚀 Starting conversion...');
        console.log('📡 Convert endpoint:', `${API_BASE_URL}/api/v1/video/convert`);
        console.log('📦 Payload:', {
            url: url,
            format: formatValue,
            quality: formatValue === 1 ? audioQuality : videoQuality
        });
        
        const response = await fetch(`${API_BASE_URL}/api/v1/video/convert`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                url: url,
                format: formatValue,
                quality: formatValue === 1 ? audioQuality : videoQuality
            })
        });
        
        console.log('📨 Convert response status:', response.status);
    const result = await response.json();
        console.log('📋 Convert result:', result);
        
        if (!response.ok) {
            throw new Error(result.error || 'Conversion failed');
        }
        
        currentDownloadId = result.download_id;
        
    // Start polling for status
        startStatusPolling();
    // Visual disable so user can't re-click convert while background work is happening
    disableConvertButtonVisuals();
        
    } catch (error) {
        console.error('Conversion start error:', error);
        throw error;
    }
}

// Poll conversion status
function startStatusPolling() {
    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
    }
    
    statusCheckInterval = setInterval(async () => {
        try {
            console.log('📊 Checking status for download ID:', currentDownloadId);
            const response = await fetch(`${API_BASE_URL}/api/v1/video/status/${currentDownloadId}`);
            const status = await response.json();
            console.log('📈 Status response:', status);
            
            if (!response.ok) {
                throw new Error(status.error || 'Status check failed');
            }
            
            updateProgress(status);
            
            if (status.status === 'completed') {
                // For bulk downloads we may get "completed" as the status when
                // a ZIP part is ready. Do not stop polling for bulk downloads
                // until the entire playlist is finished. Instead show a partial
                // success (so the user can download the ready part) and keep
                // polling until completed_count == total_videos and no parts
                // remain.
                if (status.format && status.format.includes('Bulk')) {
                    const completed = status.completed_count || 0;
                    const total = status.total_videos || 0;
                    const partsRemaining = status.parts_remaining || 0;

                    // Show availability for download but keep polling if more
                    // videos remain or parts are still being produced.
                    showSuccess(status);
                    enableBulkControls();
                    enableConvertButtonVisuals();

                    if (!(completed >= total && partsRemaining === 0)) {
                        // Keep polling — don't clear the interval yet
                    } else {
                        // Final completion: stop polling and mark processing done
                        clearInterval(statusCheckInterval);
                        isProcessing = false;
                    }
                } else {
                    // Non-bulk downloads: behave as before
                    clearInterval(statusCheckInterval);
                    showSuccess(status);
                    isProcessing = false;
                    // Re-enable controls after successful completion
                    enableBulkControls();
                    enableConvertButtonVisuals();
                }
            } else if (status.status === 'error') {
                console.error('❌ Conversion failed:', status.error);
                clearInterval(statusCheckInterval);
                showError(status.error || 'Conversion failed');
                isProcessing = false;
                hideSpinner();
                // Re-enable UI so user can retry
                enableBulkControls();
                enableConvertButtonVisuals();
            }
            
        } catch (error) {
            console.error('💥 Status check error:', error);
            clearInterval(statusCheckInterval);
            showError('Failed to check conversion status');
            isProcessing = false;
            hideSpinner();
            // Re-enable UI so user can retry
            enableBulkControls();
            enableConvertButtonVisuals();
        }
    }, 2000); // Check every 2 seconds
}

// Update progress display
function updateProgress(status) {
    if (spinnerText) {
        const progress = Math.round(status.progress || 0);
        let message = 'Processing...';
        
        if (status.format && status.format.includes('Bulk')) {
            // Bulk download progress
            const completedCount = status.completed_count || 0;
            const totalVideos = status.total_videos || 0;
            
            if (progress > 0 && progress < 100) {
                message = `Downloading ${completedCount}/${totalVideos} videos... ${progress}%`;
            } else if (progress >= 100) {
                message = 'Creating ZIP archive...';
            } else {
                message = `Preparing bulk download...`;
            }
        } else {
            // Single video progress
            if (progress > 0 && progress < 100) {
                message = `Converting... ${progress}%`;
            } else if (progress >= 100) {
                message = 'Finalizing...';
            }
        }
        
        spinnerText.textContent = message;
    }
}

// Generate mock download URL
function generateMockDownloadUrl(originalUrl) {
    const format = formatValue === 1 ? 'mp3' : 'mp4';
    const quality = formatValue === 1 ? audioQuality : videoQuality;
    return `#download-${Date.now()}.${format}?quality=${quality}&platform=${currentPlatform}`;
}

// Generate mock title
function generateMockTitle(url) {
    const titles = [
        'Amazing Video Content',
        'Awesome Music Track',
        'Funny Moments Compilation',
        'Educational Content',
        'Entertainment Video'
    ];
    return titles[Math.floor(Math.random() * titles.length)];
}

// Show success state
function showSuccess(status = {}) {
    spinner.style.display = 'none';
    videoInfo.style.display = 'block';
    convertButton.disabled = false;
    
    // Update success message with actual video title
    const title = document.getElementById('video-title');
    if (title) {
        const format = status.format || (formatValue === 1 ? 'MP3' : 'MP4');
        const videoTitle = status.title || 'Your content';
        
        // Check if this is a bulk download
        if (status.format && status.format.includes('Bulk')) {
            const completedCount = status.completed_count || 0;
            title.textContent = `Bulk download complete! ${completedCount} files in ZIP archive.`;
        } else {
            title.textContent = `"${videoTitle}" is ready for download as ${format}!`;
        }
    }
    
    // Show download button
    if (downloadBtn) {
        downloadBtn.style.display = 'inline-flex';
        
        // Update button text for bulk downloads
        if (status.format && status.format.includes('Bulk')) {
            downloadBtn.innerHTML = '<i class="fas fa-download"></i> Download ZIP';
        } else {
            downloadBtn.innerHTML = '<i class="fas fa-download"></i> Download File';
        }
    }
}

// Show error state
function showError(message) {
    spinner.style.display = 'none';
    formContainer.style.display = 'block';
    convertButton.disabled = false;
    
    // Show error message
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    formContainer.appendChild(errorDiv);
    
    // Remove error message after 5 seconds
    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}

// Handle download
async function handleDownload() {
    if (!currentDownloadId) {
        showError('No download available');
        return;
    }
    
    try {
        showDownloadProgress();
        
        // First, get the status to get the title for filename
        const statusUrl = `${API_BASE_URL}/api/v1/video/status/${currentDownloadId}`;
        const statusResponse = await fetch(statusUrl);
        if (!statusResponse.ok) {
            throw new Error(`Failed to get status: ${statusResponse.status}`);
        }
        const statusData = await statusResponse.json();
        
        // Create filename from title
        let filename = 'download.mp3';
        if (statusData.title) {
            // Clean the title for filename - allow Unicode letters, numbers, spaces, hyphens, underscores, and common punctuation
            const cleanTitle = statusData.title.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').trim();
            // Limit length and ensure it ends with .mp3
            const baseName = cleanTitle.substring(0, 50).trim();
            filename = baseName + '.mp3';
        }
        
        // Create download URL
        const downloadUrl = `${API_BASE_URL}/api/v1/video/download/${currentDownloadId}`;
        
        // Fetch the file and trigger download
        const response = await fetch(downloadUrl);
        if (!response.ok) {
            throw new Error(`Download failed: ${response.status}`);
        }

        // Determine filename from headers when possible
        let disposition = response.headers.get('content-disposition');
        let contentType = response.headers.get('content-type') || '';
        let finalFilename = null;

        finalFilename = getFilenameFromContentDisposition(disposition);
        if (!finalFilename) {
            // If server returned a bulk ZIP, try to detect from content-type
            if (contentType.includes('zip') || (statusData.format && statusData.format.includes('Bulk'))) {
                finalFilename = (statusData.title ? statusData.title.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').substring(0,50) : 'download') + '.zip';
            } else if (contentType.includes('audio')) {
                // prefer mp3 extension for audio
                finalFilename = (statusData.title ? statusData.title.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').substring(0,50) : 'download') + '.mp3';
            } else if (contentType.includes('video')) {
                finalFilename = (statusData.title ? statusData.title.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').substring(0,50) : 'download') + '.mp4';
            } else {
                // Fallback to .bin
                finalFilename = filename || ((statusData.title ? statusData.title.substring(0,50) : 'download') + '.bin');
            }
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);

        // Create temporary link and trigger download
        const link = document.createElement('a');
        link.href = url;
        link.download = finalFilename;
        link.style.display = 'none';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Clean up the object URL
        URL.revokeObjectURL(url);
        
        // Show completion message
        showDownloadComplete();

        // If this was a multi-part bulk download, automatically fetch remaining parts
        try {
            // Poll status once to get parts_remaining
            const statusResp = await fetch(statusUrl);
            const statusObj = await statusResp.json();
            let partsRemaining = statusObj.parts_remaining || 0;
            let safetyCounter = 0;

            while (partsRemaining > 0 && safetyCounter < 50) { // safety cap
                console.log('🔁 Detected remaining parts, downloading next part...', partsRemaining);
                // Start next download for the same download ID
                const nextResp = await fetch(downloadUrl);
                if (!nextResp.ok) break;
                const nextDisposition = nextResp.headers.get('content-disposition');
                const nextContentType = nextResp.headers.get('content-type') || '';
                let nextFilename = getFilenameFromContentDisposition(nextDisposition);
                if (!nextFilename) {
                    if (nextContentType.includes('zip') || (statusObj.format && statusObj.format.includes('Bulk'))) {
                        nextFilename = (statusObj.title ? statusObj.title.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').substring(0,50) : 'download') + `.part${safetyCounter+2}.zip`;
                    } else {
                        nextFilename = `part_${safetyCounter+2}.bin`;
                    }
                }

                const nextBlob = await nextResp.blob();
                const nextUrl = URL.createObjectURL(nextBlob);
                const nextLink = document.createElement('a');
                nextLink.href = nextUrl;
                nextLink.download = nextFilename;
                nextLink.style.display = 'none';
                document.body.appendChild(nextLink);
                nextLink.click();
                document.body.removeChild(nextLink);
                URL.revokeObjectURL(nextUrl);

                // Poll status again to update partsRemaining
                const s = await (await fetch(statusUrl)).json();
                partsRemaining = s.parts_remaining || 0;
                safetyCounter += 1;
            }
        } catch (e) {
            console.warn('Error while attempting to download subsequent parts:', e);
        }
        
    } catch (error) {
        console.error('Download error:', error);
        showError('Download failed. Please try again.');
        
        // Reset download button state
        if (downloadBtn) {
            downloadBtn.innerHTML = '<i class="fas fa-download"></i> Download File';
            downloadBtn.disabled = false;
        }
    }
}

// Show download progress
function showDownloadProgress() {
    if (downloadBtn) {
        downloadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Downloading...';
        downloadBtn.disabled = true;
    }
}

// Show download complete
function showDownloadComplete() {
    if (downloadBtn) {
        downloadBtn.innerHTML = '<i class="fas fa-check"></i> Downloaded!';
        downloadBtn.classList.add('c-btn--tertiary');
        
        setTimeout(() => {
            downloadBtn.innerHTML = '<i class="fas fa-download"></i> Download File';
            downloadBtn.disabled = false;
            downloadBtn.classList.remove('c-btn--tertiary');
        }, 2000);
    }
}

// Setup modal controls
function setupModalControls() {
    const modal = document.getElementById('infoModal');
    
    // Close modal when clicking outside
    window.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeModal();
        }
    });
    
    // Close modal with Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && modal && modal.style.display === 'block') {
            closeModal();
        }
    });
}

// Open modal
function openModal() {
    const modal = document.getElementById('infoModal');
    if (modal) {
        modal.style.display = 'block';
    }
}

// Close modal
function closeModal() {
    const modal = document.getElementById('infoModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Utility function to extract video ID from YouTube URL
function getYouTubeVideoId(url) {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|embed|watch|shorts)\/|.*[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

// Extract individual video URL from playlist URL
function extractIndividualVideoUrl(playlistUrl) {
    console.log('🔗 Extracting individual video URL from playlist URL:', playlistUrl);

    try {
        // Parse the URL
        const url = new URL(playlistUrl);
        const params = new URLSearchParams(url.search);

        // Get the video ID (v parameter)
        const videoId = params.get('v');
        if (!videoId) {
            console.log('❌ No video ID found in playlist URL');
            return null;
        }

        // Construct individual video URL
        const individualUrl = `https://www.youtube.com/watch?v=${videoId}`;
        console.log('✅ Extracted individual video URL:', individualUrl);
        return individualUrl;

    } catch (error) {
        console.error('❌ Error extracting individual video URL:', error);
        return null;
    }
}

// Handle keyboard shortcuts
document.addEventListener('keydown', function(e) {
    // Enter key to convert
    if (e.key === 'Enter' && document.activeElement === videoUrlInput) {
        e.preventDefault();
        convertButton.click();
    }
    
    // Ctrl/Cmd + K to focus on URL input
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        videoUrlInput.focus();
    }
});

// Auto-resize textarea if URL is very long
videoUrlInput.addEventListener('input', function() {
    if (this.value.length > 100) {
        this.style.height = 'auto';
        this.style.height = this.scrollHeight + 'px';
    } else {
        this.style.height = '';
    }
});

// Expose functions to global scope for HTML onclick handlers
window.openModal = openModal;
window.closeModal = closeModal;

// Handler for the "Convert Another" button in the UI.
// If a bulk download is active, attempt to continue it (download next part).
// Otherwise, reset the UI to allow a new conversion.
async function handleConvertAgain() {
    // If there's an active download ID, try to continue
    if (currentDownloadId) {
        const continued = await tryContinueBulkDownload();
        if (continued) return;
    }

    // Fallback: no active bulk to continue — reset UI for a fresh conversion
    // Keep this client-side so we don't hard reload unless necessary
    isProcessing = false;
    hideSpinner();
    enableBulkControls();
    enableConvertButtonVisuals();
    // Optionally clear currentDownloadId so UI starts fresh
    currentDownloadId = null;
}

window.handleConvertAgain = handleConvertAgain;