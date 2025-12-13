/*---------------------------------------/*
 # CONVERTER JAVASCRIPT
/*---------------------------------------*/

// API Configuration
const API_BASE_URL = `https://${window.location.hostname}`;

// Global variables
let currentPlatform = 'youtube';
let formatValue = 1; // 1 = MP3, 0 = MP4
let audioQuality = 128;
let videoQuality = 720;
let isProcessing = false;
let currentDownloadId = null;
let statusCheckInterval = null;
// If user inputs a playlist URL, temporarily disable convert/download UI until playlist info loads
let playlistUrlDetected = false;
// Frontend playlist/queue storage for chunked downloads
let playlistModeActive = false;
let playlistQueue = []; // array of {id,title}
let frontendStorage = []; // array of {filename, blob, size}
let frontendStorageSize = 0; // bytes
const FRONTEND_STORAGE_THRESHOLD = 1000000000; // 1GB
let frontendPartIndex = 1;
let processingQueue = false;
let waitingForContinue = false;

// 🛡️ HEALTH CHECK: Monitor backend availability
let backendHealthy = true;
let healthCheckInterval = null;
let statusCheckFailures = 0;
const MAX_STATUS_FAILURES = 3;  // Number of failed status checks before showing warning

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
const progressDisplay = document.getElementById('progress-display');
const progressText = document.getElementById('progress-text');
const videoInfo = document.getElementById('video-info');
const formContainer = document.getElementById('form-container');
const downloadBtn = document.getElementById('download-btn');

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
    updateUIForPlatform('youtube');
    loadCacheManager();
    
    // Migrate old caches on startup
    migrateOldCachesToUnified().catch(e => console.error('Migration error:', e));
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
        lastValidatedUrl = ''; // Reset when user types to allow re-validation

        // Immediate playlist detection: if the user typed a playlist URL (contains list= and youtube host),
        // disable convert/download buttons so they don't click while the app fetches playlist info.
        const val = (videoUrlInput.value || '').trim();
        if (isPlaylistUrl(val)) {
            if (!playlistUrlDetected) {
                playlistUrlDetected = true;
                tempDisableConvertAndDownload('Playlist URL detected  fetching playlist info');
            }
            // still schedule validation (optional) but keep buttons disabled until API responds
            validationTimeout = setTimeout(validateUrl, 800);
            return;
        }

        // If we previously thought it was a playlist but now changed, re-enable UI
        if (playlistUrlDetected) {
            playlistUrlDetected = false;
            clearValidationErrors();
            tempEnableConvertAndDownload();
        }

        validationTimeout = setTimeout(validateUrl, 500);
    });
    videoUrlInput.addEventListener('paste', (e) => {
        lastValidatedUrl = ''; // Reset on paste to allow validation
        // handleUrlPaste uses a small timeout to allow pasted content to appear; hook into that
        setTimeout(() => {
            handleUrlPaste(e);
            // also run immediate playlist detection after paste
            const val = (videoUrlInput.value || '').trim();
            if (isPlaylistUrl(val)) {
                playlistUrlDetected = true;
                tempDisableConvertAndDownload('Playlist URL detected  fetching playlist info');
            }
        }, 60);
    });
    
    // Download button
    if (downloadBtn) {
        downloadBtn.addEventListener('click', handleDownload);
    }
    
    // Cache manager buttons
    const refreshCacheBtn = document.getElementById('refresh-cache-btn');
    const clearAllCacheBtn = document.getElementById('clear-all-cache-btn');
    const downloadAllCacheBtn = document.getElementById('download-all-cache-btn');
    if (refreshCacheBtn) {
        refreshCacheBtn.addEventListener('click', loadCacheManager);
    }
    if (clearAllCacheBtn) {
        clearAllCacheBtn.addEventListener('click', clearAllCache);
    }
    if (downloadAllCacheBtn) {
        downloadAllCacheBtn.addEventListener('click', downloadAllFromCache);
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

// Track validation state to prevent concurrent requests
let isValidating = false;
let lastValidatedUrl = '';

// Validate URL input with backend
async function validateUrl() {
    const url = videoUrlInput.value.trim();
    const errorContainer = getOrCreateErrorContainer();
    
    // Prevent concurrent validation requests for the same URL
    if (isValidating || url === lastValidatedUrl) {
        return true;
    }
    
    // Clear previous errors
    clearValidationErrors();
    
    if (!url) {
        lastValidatedUrl = '';
        return true; // Empty is okay
    }
    
    isValidating = true;
    
    try {
        console.log('🔍 Validating URL:', url);
        console.log('📡 API endpoint:', `${API_BASE_URL}/api/v1/video/validate`);
        
        const response = await fetch(`${API_BASE_URL}/api/v1/video/validate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                url,
                quality: formatValue === 1 ? audioQuality : videoQuality,
                format: formatValue
            })
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
            
            // 🎯 Show warnings for large/long videos
            if (result.warnings && result.warnings.length > 0) {
                const warningMsg = result.warnings.join('. ');
                
                // Add quality reduction info if quality will be reduced
                let fullWarning = warningMsg;
                if (result.will_reduce_quality && result.quality_reductions) {
                    fullWarning = `${warningMsg}
                    
                    <div style="margin-top: 10px; padding: 12px; background: rgba(103, 126, 234, 0.1); border-left: 3px solid #667eea; border-radius: 4px;">
                        <strong>📈 Adaptive Quality:</strong> Quality will be reduced by ${result.quality_reductions} levels to keep file size manageable.
                        This ensures faster downloads and better compatibility.
                    </div>`;
                }
                
                showValidationWarning(fullWarning, result.title);
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
            lastValidatedUrl = url;
            return true;
        } else {
            // Hide playlist UI on error
            hidePlaylistUI();
            
            // 🎯 Check for size/duration limit errors
            if (result.size_limit_exceeded || result.duration_limit_exceeded) {
                showSizeLimitError(result.error, result.filesize, result.duration);
            } else {
                showValidationError(result.error || 'Invalid URL');
            }
            lastValidatedUrl = url;
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
    } finally {
        isValidating = false;
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

// Simple heuristic: treat URLs that contain a `list=` param and youtube domain as playlist URLs
function isPlaylistUrl(url) {
    if (!url || typeof url !== 'string') return false;
    const u = url.toLowerCase();
    return (u.includes('list=') && (u.includes('youtube.com') || u.includes('youtu.be')));
}

// Temporarily disable convert and download buttons (visual grey-out)
function tempDisableConvertAndDownload(title) {
    try {
        if (convertButton) {
            convertButton.disabled = true;
            convertButton.setAttribute('aria-disabled', 'true');
            convertButton.style.opacity = '0.6';
            convertButton.style.pointerEvents = 'none';
            if (title) convertButton.title = title;
        }
        if (downloadBtn) {
            downloadBtn.disabled = true;
            downloadBtn.setAttribute('aria-disabled', 'true');
            downloadBtn.style.opacity = '0.6';
            downloadBtn.style.pointerEvents = 'none';
            if (title) downloadBtn.title = title;
        }
    } catch (e) { console.warn('tempDisableConvertAndDownload failed', e); }
}

// Re-enable convert/download buttons (if not currently processing)
function tempEnableConvertAndDownload() {
    try {
        if (isProcessing) return; // keep disabled while an actual conversion is running
        if (convertButton) {
            convertButton.disabled = false;
            convertButton.removeAttribute('aria-disabled');
            convertButton.style.opacity = '';
            convertButton.style.pointerEvents = '';
            convertButton.title = '';
        }
        if (downloadBtn) {
            downloadBtn.disabled = false;
            downloadBtn.removeAttribute('aria-disabled');
            downloadBtn.style.opacity = '';
            downloadBtn.style.pointerEvents = '';
            downloadBtn.title = '';
        }
    } catch (e) { console.warn('tempEnableConvertAndDownload failed', e); }
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
    errorContainer.classList.remove('error-message', 'warning-message');
    
    // Hide success message after 3 seconds
    setTimeout(() => {
        errorContainer.textContent = '';
        errorContainer.classList.remove('success-message');
    }, 3000);
}

// 🎯 Show validation warning for large/long videos
function showValidationWarning(message, title = '') {
    videoUrlInput.classList.remove('input-error');
    const errorContainer = getOrCreateErrorContainer();
    errorContainer.innerHTML = `
        <div style="display: flex; align-items: start; gap: 8px;">
            <span style="font-size: 1.2em;">⚠️</span>
            <div>
                ${title ? `<div style="font-weight: 600; margin-bottom: 4px;">${title}</div>` : ''}
                <div>${message}</div>
                <div style="margin-top: 6px; font-size: 0.9em; opacity: 0.9;">You can still try downloading, but it may fail or be very slow.</div>
            </div>
        </div>
    `;
    errorContainer.classList.add('warning-message');
    errorContainer.classList.remove('error-message', 'success-message');
}

// 🎯 Show size limit error
function showSizeLimitError(message, filesize, duration) {
    videoUrlInput.classList.add('input-error');
    const errorContainer = getOrCreateErrorContainer();
    
    let details = '';
    if (filesize) {
        const sizeMB = (filesize / (1024 * 1024)).toFixed(0);
        const sizeGB = (filesize / (1024 * 1024 * 1024)).toFixed(2);
        details += `File size: ${sizeMB}MB (${sizeGB}GB)`;
    }
    if (duration) {
        const minutes = (duration / 60).toFixed(0);
        if (details) details += ' • ';
        details += `Duration: ${minutes} minutes`;
    }
    
    errorContainer.innerHTML = `
        <div style="display: flex; align-items: start; gap: 8px;">
            <span style="font-size: 1.2em;">🚫</span>
            <div>
                <div style="font-weight: 600; margin-bottom: 4px;">${message}</div>
                ${details ? `<div style="font-size: 0.9em; opacity: 0.8; margin-bottom: 8px;">${details}</div>` : ''}
                <div style="margin-top: 6px; font-size: 0.9em;">
                    <strong>💡 Why this limit?</strong>
                    <p style="margin: 4px 0 8px 0;">Videos over 15 minutes are not supported to ensure fast conversions and prevent server overload.</p>
                    
                    <strong>Suggestions:</strong>
                    <ul style="margin: 4px 0 0 0; padding-left: 20px;">
                        <li>Try downloading a shorter clip or segment under 15 minutes</li>
                        <li>Use a lower quality setting (e.g., 128kb/s audio or 360p video)</li>
                        <li>Download audio only (MP3) instead of video</li>
                    </ul>
                </div>
            </div>
        </div>
    `;
    errorContainer.classList.add('error-message');
    errorContainer.classList.remove('success-message', 'warning-message');
}

// Clear validation errors
function clearValidationErrors() {
    videoUrlInput.classList.remove('input-error');
    const errorContainer = getOrCreateErrorContainer();
    errorContainer.textContent = '';
    errorContainer.classList.remove('error-message', 'success-message', 'warning-message');
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
let isFetchingPlaylist = false;
let lastFetchedPlaylistId = '';

async function showPlaylistUI(playlistId, playlistUrl) {
    // Prevent concurrent playlist fetches for the same playlist
    if (isFetchingPlaylist || playlistId === lastFetchedPlaylistId) {
        console.log('⏭️ Skipping duplicate playlist fetch for:', playlistId);
        return;
    }
    
    isFetchingPlaylist = true;
    
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

            // Check if playlist has 0 videos - show error instead of falling back
            if (result.video_count === 0) {
                console.log('📋 Playlist has 0 videos');
                
                // Check if it's a private playlist or has an error message
                if (result.is_private) {
                    showValidationError('This playlist is private. Please make it unlisted or public to download.');
                } else if (result.error) {
                    showValidationError(result.error);
                } else {
                    showValidationError('This playlist is empty or all videos are unavailable. Please check the playlist and try again.');
                }
                
                hidePlaylistUI();
                return false;
            }

            renderPlaylistUI(result);
            showValidationSuccess(`Playlist loaded: ${result.video_count} videos`);
            lastFetchedPlaylistId = playlistId;
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
    } finally {
        isFetchingPlaylist = false;
    }
}

function hidePlaylistUI() {
    const playlistContainer = document.getElementById('playlist-container');
    if (playlistContainer) {
        playlistContainer.style.display = 'none';
    }
    currentPlaylistData = null;
    lastFetchedPlaylistId = ''; // Reset to allow re-fetching if needed
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
                                <span class="cache-indicator" data-video-id="${video.id}" data-title="${video.title}">Not cached</span>
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
    // Cancel handler
    const canc = document.getElementById('cancel-btn');
    if (canc) canc.addEventListener('click', cancelProcessing);
}

function showContinueControls(show) {
    const canc = document.getElementById('cancel-btn');
    const clearCache = document.getElementById('clear-cache-btn');
    
    if (canc) canc.style.display = show ? 'inline-flex' : 'none';
    
    // Update Clear Cache button text to indicate it will resume processing
    if (clearCache && show) {
        clearCache.innerHTML = '<i class="fas fa-trash-alt"></i> Clear Cache & Continue';
        clearCache.style.backgroundColor = 'var(--success-color)';
        clearCache.style.fontWeight = 'bold';
    } else if (clearCache) {
        clearCache.innerHTML = '<i class="fas fa-trash-alt"></i> Clear Cache';
        clearCache.style.backgroundColor = '';
        clearCache.style.fontWeight = '';
    }
}

function cancelProcessing() {
    // User cancelled  clear all and reset
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
        
        // Show detailed progress if available
        if (opts.currentTitle) {
            statusEl.textContent = opts.currentTitle;
        } else if (opts.processedCount && opts.totalItems) {
            const progressPercent = Math.round((opts.processedCount / opts.totalItems) * 100);
            statusEl.textContent = `Progress: ${opts.processedCount}/${opts.totalItems} (${progressPercent}%) · Queued: ${queued} · Cached: ${storedFiles} · Size: ${(storedBytes/1024/1024).toFixed(1)} MB · Part: ${part}`;
        } else {
            statusEl.textContent = `Queued: ${queued} · Stored files: ${storedFiles} · Stored size: ${(storedBytes/1024/1024).toFixed(1)} MB · Part: ${part}`;
        }
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
    
    const videoCount = currentPlaylistData.videos.length;
    const estimatedMinutes = Math.ceil((videoCount * 7.5) / 60); // Average 7.5s per video
    
    // Warn user about time for large playlists
    if (videoCount > 20) {
        const proceed = confirm(
                `⏱️ Rate Limit Protection Active\n\n` +
                `Downloading ${videoCount} videos with 5-10 second delays between each to avoid YouTube rate limiting.\n\n` +
                `Estimated time: ~${estimatedMinutes} minutes\n\n` +
                `Continue?`
        );
        if (!proceed) return;
    }
    
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
        if (spinnerText) spinnerText.textContent = 'Preparing bulk download...';
        
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
        // Check cache limit before starting
        const limitCheck = await checkCacheLimit();
        if (!limitCheck.ok) {
            alert(limitCheck.message);
            hideSpinner();
            playlistModeActive = false;
            processingQueue = false;
            isProcessing = false;
            updatePlaylistStatusUI();
            return;
        }
        
        if (limitCheck.warning) {
            console.warn('⚠️', limitCheck.message);
        }
        
        let totalItems = playlistQueue.length + frontendStorage.length;
        let processedCount = frontendStorage.length;
        
        while (playlistQueue.length > 0) {
            const next = playlistQueue.shift();
            processedCount++;
            const videoUrl = `https://www.youtube.com/watch?v=${next.id}`;
            const progressPercent = Math.round((processedCount / totalItems) * 100);

            try {
                isProcessing = true;
                // Use a subtle spinner during long-running playlist processing
                showSpinner('subtle');
                if (spinnerText) spinnerText.textContent = `Processing playlist... ${processedCount}/${totalItems} (${progressPercent}%)`;
                updatePlaylistStatusUI({ 
                    currentTitle: `🎵 ${processedCount}/${totalItems} (${progressPercent}%) - ${next.title}`,
                    processedCount: processedCount,
                    totalItems: totalItems
                });

                // Check if this video is already cached
                const cachedItems = await getAllCachedDownloads();
                const alreadyCached = cachedItems.find(item => item.videoId === next.id);
                
                if (alreadyCached) {
                    console.log('⏭️ Skipping already cached video:', next.title);
                    
                    // Update all UI elements to show skip
                    if (spinnerText) {
                        spinnerText.textContent = `⏭️ Skipped (cached) ${processedCount}/${totalItems} (${progressPercent}%)`;
                    }
                    
                    const progressDisplay = document.getElementById('progress-display');
                    const progressText = document.getElementById('progress-text');
                    if (progressDisplay && progressText) {
                        progressDisplay.style.display = 'block';
                        progressText.textContent = `⏭️ ${processedCount}/${totalItems} (${progressPercent}%) - ${next.title} (already cached)`;
                    }
                    
                    updatePlaylistStatusUI({
                        currentTitle: `✅ ${processedCount}/${totalItems} (${progressPercent}%) - Already cached: ${next.title}`,
                        processedCount: processedCount,
                        totalItems: totalItems
                    });
                    
                    // Brief delay so user can see the skip message
                    await new Promise(r => setTimeout(r, 1500));
                    continue; // Skip to next video
                }

                // Start server conversion
                const convertResp = await fetch(`${API_BASE_URL}/api/v1/video/convert`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: videoUrl, format: formatValue, quality: formatValue === 1 ? audioQuality : videoQuality, proxy: (document.getElementById('perDownloadProxy') && document.getElementById('perDownloadProxy').value.trim()) || undefined })
                });

                if (!convertResp.ok) {
                    const errorText = await convertResp.text();
                    console.warn('Failed to start conversion for', next.id, errorText);
                    throw new Error(`Conversion failed: ${errorText || 'Unknown error'}`);
                }

                convertResult = await convertResp.json();
                // Upload cookies if backend provided a download_id and user selected cookie file
                try {
                    if (convertResult && convertResult.download_id) {
                        const cookieInput = document.getElementById('cookieUpload');
                        if (cookieInput && cookieInput.files && cookieInput.files.length > 0) {
                            const cookieFile = cookieInput.files[0];
                            const cookieForm = new FormData();
                            cookieForm.append('file', cookieFile, cookieFile.name);
                            const uploadUrl = `${API_BASE_URL}/api/v1/video/upload-cookies/${convertResult.download_id}`;
                            console.log('📤 Uploading cookies to', uploadUrl);
                            await fetch(uploadUrl, { method: 'POST', body: cookieForm });
                            console.log('✅ Uploaded cookies for download', convertResult.download_id);
                        }
                    }
                } catch (cookieErr) {
                    console.warn('Failed to upload cookie file for playlist item:', cookieErr);
                }
                const downloadId = convertResult.download_id;
                
                // Update all UI to show download progress
                if (spinnerText) {
                    spinnerText.textContent = `⏬ Downloading ${processedCount}/${totalItems} (${progressPercent}%)`;
                }
                
                const progressDisplay = document.getElementById('progress-display');
                const progressText = document.getElementById('progress-text');
                if (progressDisplay && progressText) {
                    progressDisplay.style.display = 'block';
                    progressText.textContent = `⏬ ${processedCount}/${totalItems} (${progressPercent}%) - ${next.title}`;
                }
                
                updatePlaylistStatusUI({
                    currentTitle: `⏬ ${processedCount}/${totalItems} (${progressPercent}%) - Downloading: ${next.title}`,
                    processedCount: processedCount,
                    totalItems: totalItems
                });
                
                const status = await pollStatusUntilReady(downloadId);
                if (!status || status.status === 'error') {
                    const errorMsg = status && status.error ? status.error : 'Unknown conversion error';
                    console.warn('Conversion failed for', next.id, errorMsg);
                    throw new Error(`Video conversion failed: ${errorMsg}`);
                }

                const downloadResp = await fetch(`${API_BASE_URL}/api/v1/video/download/${downloadId}`);
                if (!downloadResp.ok) {
                    const errorText = await downloadResp.text();
                    console.warn('Failed to download converted file for', next.id, errorText);
                    throw new Error(`Download failed: ${errorText || 'Unknown error'}`);
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

                // Add to frontend storage (this will save to IDB via addBlobToIDB)
                addToFrontendStorage(filename, blob, {
                    title: next.title || next.id,
                    format: formatValue === 1 ? 'MP3' : 'MP4',
                    platform: 'youtube',
                    videoId: next.id  // Store the YouTube video ID for lofi.js lookup
                });
                
                console.log('💾 Playlist item downloaded and cached:', filename);
                
                // Update cache indicators (don't reload entire cache manager during bulk download)
                try {
                    await updateCachedIndicators();
                } catch (cacheErr) {
                    console.warn('Failed to update cache UI:', cacheErr);
                }

                if (frontendStorageSize >= FRONTEND_STORAGE_THRESHOLD) {
                    updatePlaylistStatusUI();
                    await flushFrontendStorageAsZip();
                    // After a zip part is created we intentionally pause, keep subtle spinner
                    // and wait for user Continue before clearing storage  do not hide UI.
                    // The flush function handles showing the Continue controls.
                    
                    // IMPORTANT: Stop processing here and return - user must click Continue
                    // to resume processing the queue
                    hideSpinner('subtle');
                    isProcessing = false;
                    processingQueue = false;
                    updatePlaylistStatusUI({ currentTitle: `⏸️ Paused - Please download the ZIP and click "Continue"` });
                    return; // Exit the loop, wait for user to continue
                }

                // Add delay between downloads to avoid YouTube rate limiting
                // Use 5-10 second random delay to mimic human behavior
                const delayMs = 5000 + Math.random() * 5000; // 5-10 seconds
                const delaySec = (delayMs / 1000).toFixed(1);
                
                // Update UI with completion status including file size
                const fileSizeMB = (blob.size / 1024 / 1024).toFixed(2);
                updatePlaylistStatusUI({
                    currentTitle: `✅ ${processedCount}/${totalItems} (${progressPercent}%) - Downloaded: ${next.title} (${fileSizeMB} MB) - Waiting ${delaySec}s...`,
                    processedCount: processedCount,
                    totalItems: totalItems
                });
                
                await new Promise(r => setTimeout(r, delayMs));
                
                updatePlaylistStatusUI({
                    currentTitle: `🎵 ${processedCount}/${totalItems} (${progressPercent}%) - Ready for next video`,
                    processedCount: processedCount,
                    totalItems: totalItems
                });

            } catch (errItem) {
                console.error('❌ Error processing queue item', next, errItem);
                
                // Mark video as failed/uncachable in UI
                const cacheIndicator = document.querySelector(`.cache-indicator[data-video-id="${next.id}"]`);
                if (cacheIndicator) {
                    cacheIndicator.textContent = '❌ Failed';
                    cacheIndicator.style.color = '#ff6b6b';
                    cacheIndicator.title = `Conversion failed: ${errItem.message || 'Unknown error'}`;
                }
                
                // Show error and continue with next item (no retries, no stopping)
                const errorMsg = errItem.message || 'Unknown error';
                const shortError = errorMsg.length > 80 ? errorMsg.substring(0, 80) + '...' : errorMsg;
                
                updatePlaylistStatusUI({
                    currentTitle: `⚠️ ${processedCount}/${totalItems} (${progressPercent}%) - Failed: ${next.title} - ${shortError}`,
                    processedCount: processedCount,
                    totalItems: totalItems
                });
                
                // Wait 2 seconds to show the error message
                await new Promise(r => setTimeout(r, 2000));
                
                // Continue to next item without retrying
                continue;
            }
        }

        // queue drained  flush remaining
        if (frontendStorageSize > 0) {
            updatePlaylistStatusUI({ currentTitle: `📦 All ${totalItems} songs processed! Creating final ZIP...` });
            await flushFrontendStorageAsZip();
        } else {
            updatePlaylistStatusUI({ currentTitle: `✅ All ${totalItems} songs downloaded and cached!` });
        }
        
        // Refresh cache display once to show all downloaded files
        console.log('📊 Refreshing cache manager after playlist download...');
        loadCacheManager();
        await updateCachedIndicators(true); // Force immediate update after completion

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

function addToFrontendStorage(filename, blob, metadata = {}) {
    const size = blob.size || 0;
    frontendStorage.push({ filename, blob, size });
    frontendStorageSize += size;
    console.log(`📦 Added to storage: ${filename} (${(size / 1024 / 1024).toFixed(2)} MB). Total: ${(frontendStorageSize / 1024 / 1024).toFixed(2)} MB`);

    // Persist to IndexedDB for resiliency across reloads
    try {
        addBlobToIDB(filename, blob, size, metadata).catch(e => console.warn('IDB store failed', e));
    } catch (e) {
        console.warn('IDB not available:', e);
    }
}

// Mark which playlist items are cached based on persisted IDB filenames
// Throttle updates during bulk operations to reduce spam
let updateCacheIndicatorsTimeout = null;
async function updateCachedIndicators(immediate = false) {
    // If immediate update requested (e.g., after full download complete), clear throttle
    if (immediate) {
        clearTimeout(updateCacheIndicatorsTimeout);
        return await _doUpdateCachedIndicators();
    }
    
    // Otherwise, throttle to once per 2 seconds during bulk operations
    return new Promise((resolve) => {
        clearTimeout(updateCacheIndicatorsTimeout);
        updateCacheIndicatorsTimeout = setTimeout(async () => {
            await _doUpdateCachedIndicators();
            resolve();
        }, 2000);
    });
}

async function _doUpdateCachedIndicators() {
    try {
        // Check both temporary playlist storage and permanent download cache
        const tempItems = await readAllBlobsFromIDB();
        const cachedItems = await getAllCachedDownloads();
        
        // Build set of cached video IDs from both sources
        const cachedVideoIds = new Set();
        
        // Add video IDs from temporary playlist storage
        (tempItems || []).forEach(item => {
            if (item.videoId) cachedVideoIds.add(item.videoId);
        });
        
        // Add video IDs from permanent cache
        (cachedItems || []).forEach(item => {
            if (item.videoId) cachedVideoIds.add(item.videoId);
        });
        
        // Update each indicator based on video ID match
        document.querySelectorAll('.cache-indicator').forEach(el => {
            const videoId = el.getAttribute('data-video-id');
            const matched = videoId && cachedVideoIds.has(videoId);
            el.textContent = matched ? '✅ Cached' : 'Not cached';
            el.style.color = matched ? '#6ee7b7' : '#d0d0d0';
            el.style.fontWeight = matched ? '700' : '400';
            el.style.fontSize = '0.85em';
        });
        
        console.log(`🔍 Cache check: Found ${cachedVideoIds.size} cached videos`);
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

// Migration function: Move data from old caches to unified cache
async function migrateOldCachesToUnified() {
    try {
        console.log('🔄 Checking for old cache data to migrate...');
        let migratedCount = 0;
        
        // Migrate old converter_frontend_store_v1 (playlist storage)
        try {
            const oldDB = await new Promise((resolve, reject) => {
                const req = indexedDB.open('converter_frontend_store_v1');
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
            
            if (oldDB.objectStoreNames.contains('files')) {
                const tx = oldDB.transaction('files', 'readonly');
                const store = tx.objectStore('files');
                const allOldItems = await new Promise((resolve, reject) => {
                    const req = store.getAll();
                    req.onsuccess = () => resolve(req.result || []);
                    req.onerror = () => reject(req.error);
                });
                
                console.log(`📦 Found ${allOldItems.length} items in old playlist storage`);
                
                for (const item of allOldItems) {
                    const id = `migrated_playlist_${item.id || Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    await saveDownloadedFile(id, item.filename, item.blob, {
                        type: 'playlist',
                        title: item.filename
                    });
                    migratedCount++;
                }
                
                oldDB.close();
                // Delete old database
                await new Promise(resolve => {
                    const delReq = indexedDB.deleteDatabase('converter_frontend_store_v1');
                    delReq.onsuccess = () => resolve();
                    delReq.onerror = () => resolve(); // Continue even if delete fails
                });
                console.log(`✅ Migrated ${migratedCount} playlist items from old storage`);
            } else {
                oldDB.close();
            }
        } catch (e) {
            console.log('ℹ️ No old playlist storage found or already migrated');
        }
        
        // Migrate old lofi-cache
        try {
            const lofiDB = await new Promise((resolve, reject) => {
                const req = indexedDB.open('lofi-cache');
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
            
            if (lofiDB.objectStoreNames.contains('audioBlobs')) {
                const tx = lofiDB.transaction('audioBlobs', 'readonly');
                const store = tx.objectStore('audioBlobs');
                const allLofiItems = await new Promise((resolve, reject) => {
                    const req = store.getAll();
                    req.onsuccess = () => resolve(req.result || []);
                    req.onerror = () => reject(req.error);
                });
                
                console.log(`🎵 Found ${allLofiItems.length} items in old lofi cache`);
                
                let lofiMigrated = 0;
                for (const item of allLofiItems) {
                    if (item.blob && (item.videoId || item.id)) {
                        const id = item.videoId || item.id;
                        await saveDownloadedFile(id, item.title || item.filename || id, item.blob, {
                            type: 'lofi',
                            title: item.title,
                            videoId: id,
                            format: 'MP3',
                            platform: 'youtube'
                        });
                        lofiMigrated++;
                        migratedCount++;
                    }
                }
                
                lofiDB.close();
                // Delete old database
                await new Promise(resolve => {
                    const delReq = indexedDB.deleteDatabase('lofi-cache');
                    delReq.onsuccess = () => resolve();
                    delReq.onerror = () => resolve();
                });
                console.log(`✅ Migrated ${lofiMigrated} lofi items from old cache`);
            } else {
                lofiDB.close();
            }
        } catch (e) {
            console.log('ℹ️ No old lofi cache found or already migrated:', e.message);
        }
        
        if (migratedCount > 0) {
            console.log(`✅ Total migrated: ${migratedCount} items`);
            loadCacheManager(); // Refresh UI
        } else {
            console.log('✅ No old cache data to migrate');
        }
    } catch (error) {
        console.error('❌ Error during cache migration:', error);
    }
}

// Expose migration function for manual triggering
window.migrateOldCachesToUnified = migrateOldCachesToUnified;

// Playlist storage now uses unified cache
async function addBlobToIDB(filename, blob, size, metadata = {}) {
    // Check if this videoId already exists in cache to prevent duplicates
    if (metadata.videoId) {
        try {
            const allCached = await getAllCachedDownloads();
            const existing = allCached.find(item => item.videoId === metadata.videoId && item.type === 'playlist');
            if (existing) {
                console.log('⏭️ Skipping duplicate cache save for videoId:', metadata.videoId, filename);
                return true; // Already cached, no need to save again
            }
        } catch (e) {
            console.warn('Could not check for existing cache entry:', e);
        }
    }
    
    // Use unified cache with playlist type
    const id = `playlist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return await saveDownloadedFile(id, filename, blob, {
        ...metadata,
        type: 'playlist',
        title: metadata.title || filename
    });
}

// ------------------ UNIFIED CACHE SYSTEM (IndexedDB) ------------------
// All media files (converter, playlist, lofi) use one central cache
const UNIFIED_CACHE_DB = 'unified_media_cache_v1';
const CACHE_STORE_MEDIA = 'media_files'; // Unified store for all audio/video
const CACHE_STORE_COOKIES = 'cookies';
const CACHE_SIZE_LIMIT = 1 * 1024 * 1024 * 1024; // 1GB hard limit
const CACHE_SIZE_WARNING = 0.9 * 1024 * 1024 * 1024; // 900MB warning threshold

// Export constants for use by lofi.js
window.UNIFIED_CACHE_DB = UNIFIED_CACHE_DB;
window.CACHE_STORE_MEDIA = CACHE_STORE_MEDIA;
window.CACHE_STORE_COOKIES = CACHE_STORE_COOKIES;

// Backwards compatibility aliases
const IDB_DB_NAME = UNIFIED_CACHE_DB;
const IDB_COOKIES_STORE = CACHE_STORE_COOKIES;
const IDB_DOWNLOADS_STORE = CACHE_STORE_MEDIA;

function openUnifiedCacheDB() {
    return new Promise((resolve, reject) => {
        if (!window.indexedDB) return reject(new Error('IndexedDB not supported'));

        const openReq = indexedDB.open(UNIFIED_CACHE_DB);
        openReq.onsuccess = function(e) {
            const db = e.target.result;
            const hasAllStores = db.objectStoreNames.contains(CACHE_STORE_MEDIA) &&
                                db.objectStoreNames.contains(CACHE_STORE_COOKIES);
            
            if (hasAllStores) {
                return resolve(db);
            }

            const newVersion = db.version + 1;
            db.close();
            const upgradeReq = indexedDB.open(UNIFIED_CACHE_DB, newVersion);
            upgradeReq.onupgradeneeded = function(ev) {
                const d = ev.target.result;
                if (!d.objectStoreNames.contains(CACHE_STORE_MEDIA)) {
                    const mediaStore = d.createObjectStore(CACHE_STORE_MEDIA, { keyPath: 'id' });
                    mediaStore.createIndex('type', 'type', { unique: false }); // 'converter', 'playlist', 'lofi'
                    mediaStore.createIndex('videoId', 'videoId', { unique: false });
                    mediaStore.createIndex('created', 'created', { unique: false });
                }
                if (!d.objectStoreNames.contains(CACHE_STORE_COOKIES)) {
                    d.createObjectStore(CACHE_STORE_COOKIES, { keyPath: 'name' });
                }
            };
            upgradeReq.onsuccess = function(ev) { resolve(ev.target.result); };
            upgradeReq.onerror = function(ev) { reject(ev.target.error || new Error('IDB upgrade failed')); };
        };
        openReq.onerror = function(e) { reject(e.target ? e.target.error : new Error('IDB open error')); };
    });
}

// Export for use by lofi.js
window.openUnifiedCacheDB = openUnifiedCacheDB;

// Backwards compatibility
const openCookiesIDB = openUnifiedCacheDB;

// Get total cache size across all media
async function getTotalCacheSize() {
    try {
        const db = await openUnifiedCacheDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(CACHE_STORE_MEDIA, 'readonly');
            const store = tx.objectStore(CACHE_STORE_MEDIA);
            const req = store.getAll();
            req.onsuccess = () => {
                const items = req.result || [];
                const totalSize = items.reduce((sum, item) => sum + (item.size || 0), 0);
                resolve(totalSize);
            };
            req.onerror = () => reject(req.error);
        });
    } catch (error) {
        console.error('❌ Error getting cache size:', error);
        return 0;
    }
}

// Check if cache is near or over limit
async function checkCacheLimit() {
    const size = await getTotalCacheSize();
    const sizeMB = (size / (1024 * 1024)).toFixed(2);
    const limitMB = (CACHE_SIZE_LIMIT / (1024 * 1024)).toFixed(0);
    
    if (size >= CACHE_SIZE_LIMIT) {
        return {
            ok: false,
            size: size,
            message: `Cache is full (${sizeMB}MB / ${limitMB}MB)! Please download files from cache and clear some space before continuing.`
        };
    } else if (size >= CACHE_SIZE_WARNING) {
        return {
            ok: true,
            warning: true,
            size: size,
            message: `Cache is ${((size / CACHE_SIZE_LIMIT) * 100).toFixed(0)}% full (${sizeMB}MB / ${limitMB}MB). Consider downloading and clearing old files.`
        };
    }
    
    return { ok: true, size: size };
}

async function saveCookiesText(name, text) {
    const db = await openCookiesIDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_COOKIES_STORE, 'readwrite');
        const store = tx.objectStore(IDB_COOKIES_STORE);
        const entry = { name: name, content: text, created: Date.now() };
        const r = store.put(entry);
        r.onsuccess = () => resolve(true);
        r.onerror = (e) => reject(e.target ? e.target.error : e);
    });
}

async function getSavedCookies(name = 'cookies.txt') {
    const db = await openCookiesIDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_COOKIES_STORE, 'readonly');
        const store = tx.objectStore(IDB_COOKIES_STORE);
        const req = store.get(name);
        req.onsuccess = function(e) {
            const v = e.target.result;
            resolve(v ? v.content : null);
        };
        req.onerror = function(e) { reject(e.target ? e.target.error : e); };
    });
}

async function clearSavedCookies(name = 'cookies.txt') {
    const db = await openCookiesIDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_COOKIES_STORE, 'readwrite');
        const store = tx.objectStore(IDB_COOKIES_STORE);
        const req = store.delete(name);
        req.onsuccess = () => resolve(true);
        req.onerror = (e) => reject(e.target ? e.target.error : e);
    });
}

// ------------------ Downloaded files cache (IndexedDB) ------------------
// Save to unified cache with type classification
async function saveDownloadedFile(downloadId, filename, blob, metadata = {}) {
    try {
        // Check cache limit before saving
        const limitCheck = await checkCacheLimit();
        if (!limitCheck.ok) {
            console.warn('⚠️ Cache limit reached:', limitCheck.message);
            alert(limitCheck.message);
            return false;
        }
        
        if (limitCheck.warning) {
            console.warn('⚠️ Cache warning:', limitCheck.message);
        }
        
        const db = await openUnifiedCacheDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(CACHE_STORE_MEDIA, 'readwrite');
            const store = tx.objectStore(CACHE_STORE_MEDIA);
            const entry = {
                id: downloadId,
                download_id: downloadId, // backwards compat
                filename: filename,
                blob: blob,
                size: blob.size,
                created: Date.now(),
                title: metadata.title || '',
                format: metadata.format || '',
                platform: metadata.platform || '',
                type: metadata.type || 'converter', // 'converter', 'playlist', 'lofi'
                videoId: metadata.videoId || null
            };
            const req = store.put(entry);
            req.onsuccess = () => {
                console.log('💾 Saved download to cache:', filename);
                resolve(true);
            };
            req.onerror = (e) => {
                console.error('❌ Failed to save download to cache:', e);
                reject(e.target ? e.target.error : e);
            };
        });
    } catch (error) {
        console.error('❌ Error saving to download cache:', error);
    }
}

async function getCachedDownload(downloadId) {
    try {
        const db = await openUnifiedCacheDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(CACHE_STORE_MEDIA, 'readonly');
            const store = tx.objectStore(CACHE_STORE_MEDIA);
            const req = store.get(downloadId);
            req.onsuccess = function(e) {
                const entry = e.target.result;
                if (entry) {
                    console.log('✅ Found cached download:', entry.filename);
                }
                resolve(entry || null);
            };
            req.onerror = function(e) {
                console.error('❌ Error reading download cache:', e);
                reject(e.target ? e.target.error : e);
            };
        });
    } catch (error) {
        console.error('❌ Error accessing download cache:', error);
        return null;
    }
}

async function getAllCachedDownloads() {
    try {
        const db = await openUnifiedCacheDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(CACHE_STORE_MEDIA, 'readonly');
            const store = tx.objectStore(CACHE_STORE_MEDIA);
            const req = store.getAll();
            req.onsuccess = function(e) {
                resolve(e.target.result || []);
            };
            req.onerror = function(e) {
                console.error('❌ Error reading all cached downloads:', e);
                reject(e.target ? e.target.error : e);
            };
        });
    } catch (error) {
        console.error('❌ Error accessing download cache:', error);
        return [];
    }
}

async function deleteCachedDownload(downloadId) {
    try {
        const db = await openUnifiedCacheDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(CACHE_STORE_MEDIA, 'readwrite');
            const store = tx.objectStore(CACHE_STORE_MEDIA);
            const req = store.delete(downloadId);
            req.onsuccess = () => {
                console.log('🗑️ Deleted cached download:', downloadId);
                resolve(true);
            };
            req.onerror = (e) => {
                console.error('❌ Error deleting cached download:', e);
                reject(e.target ? e.target.error : e);
            };
        });
    } catch (error) {
        console.error('❌ Error deleting from cache:', error);
        return false;
    }
}

async function downloadAllFromCache() {
    try {
        const cachedFiles = await getAllCachedDownloads();
        
        if (cachedFiles.length === 0) {
            alert('No files in cache to download');
            return;
        }
        
        if (!confirm(`Download all ${cachedFiles.length} file${cachedFiles.length !== 1 ? 's' : ''} from cache as a ZIP file?`)) {
            return;
        }
        
        console.log(`📦 Creating ZIP archive with ${cachedFiles.length} files...`);
        
        // Import JSZip dynamically if not already loaded
        if (typeof JSZip === 'undefined') {
            alert('Loading ZIP library, please try again in a moment...');
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
            script.onload = () => console.log('✅ JSZip loaded');
            document.head.appendChild(script);
            return;
        }
        
        const zip = new JSZip();
        
        // Add each file to the ZIP
        for (let i = 0; i < cachedFiles.length; i++) {
            const file = cachedFiles[i];
            try {
                zip.file(file.filename, file.blob);
                console.log(`✅ Added to ZIP ${i + 1}/${cachedFiles.length}: ${file.filename}`);
            } catch (error) {
                console.error(`❌ Error adding ${file.filename} to ZIP:`, error);
            }
        }
        
        // Generate ZIP file
        console.log('🔄 Generating ZIP file...');
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        
        // Download the ZIP
        const url = URL.createObjectURL(zipBlob);
        const link = document.createElement('a');
        link.href = url;
        const timestamp = new Date().toISOString().slice(0, 10);
        link.download = `cached-downloads-${timestamp}.zip`;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        console.log('✅ ZIP download started');
        alert(`✅ Successfully created ZIP with ${cachedFiles.length} file${cachedFiles.length !== 1 ? 's' : ''}!`);
    } catch (error) {
        console.error('❌ Error creating ZIP from cache:', error);
        alert('Error creating ZIP file from cache');
    }
}

async function clearAllCache() {
    if (!confirm('Are you sure you want to clear all cached downloads? This cannot be undone.')) {
        return;
    }
    
    try {
        const db = await openUnifiedCacheDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(CACHE_STORE_MEDIA, 'readwrite');
            const store = tx.objectStore(CACHE_STORE_MEDIA);
            const req = store.clear();
            req.onsuccess = () => {
                console.log('🗑️ Cleared all cached downloads');
                loadCacheManager();
                resolve(true);
            };
            req.onerror = (e) => {
                console.error('❌ Error clearing cache:', e);
                reject(e.target ? e.target.error : e);
            };
        });
    } catch (error) {
        console.error('❌ Error clearing cache:', error);
    }
}

// Helper function to safely decode URL-encoded strings
const safeDecodeConverter = (s) => { 
    try { 
        return decodeURIComponent(s); 
    } catch { 
        return s; 
    } 
};

// Clean up titles that may contain percent-encoding or odd prefixes
const prettyTitleConverter = (s) => {
    if (!s || typeof s !== 'string') return s;
    let t = s.trim();
    // Remove common stray charset prefixes
    t = t.replace(/^utf[-_]?8/i, '');
    // Replace plus (form-encoding) with spaces, then percent-decode safely
    t = t.replace(/\+/g, ' ');
    t = safeDecodeConverter(t);
    // Collapse repeated whitespace
    t = t.replace(/\s{2,}/g, ' ').trim();
    return t;
};

async function loadCacheManager() {
    const container = document.getElementById('cache-items-container');
    const sizeDisplay = document.getElementById('cache-size-display');
    
    if (!container || !sizeDisplay) return;
    
    try {
        const cachedFiles = await getAllCachedDownloads();
        
        // Calculate total size and check limits
        const totalSize = cachedFiles.reduce((sum, file) => sum + (file.size || 0), 0);
        const sizeMB = (totalSize / (1024 * 1024)).toFixed(2);
        const limitMB = (CACHE_SIZE_LIMIT / (1024 * 1024)).toFixed(0);
        const percentFull = ((totalSize / CACHE_SIZE_LIMIT) * 100).toFixed(0);
        
        // Update size display with warning colors
        let sizeColor = 'var(--text-secondary, #666)';
        let sizeText = `${sizeMB} MB used (${cachedFiles.length} file${cachedFiles.length !== 1 ? 's' : ''})`;
        
        if (totalSize >= CACHE_SIZE_LIMIT) {
            sizeColor = '#dc3545';
            sizeText = `⚠️ ${sizeMB} / ${limitMB} MB (FULL!)`;
        } else if (totalSize >= CACHE_SIZE_WARNING) {
            sizeColor = '#ff9800';
            sizeText = `⚠️ ${sizeMB} / ${limitMB} MB (${percentFull}% full)`;
        }
        
        sizeDisplay.textContent = sizeText;
        sizeDisplay.style.color = sizeColor;
        sizeDisplay.style.fontWeight = totalSize >= CACHE_SIZE_WARNING ? '700' : '400';
        
        // Display cached files
        if (cachedFiles.length === 0) {
            container.innerHTML = '<p style="color: var(--text-secondary, #666); font-size: 0.9em; text-align: center; margin: 20px 0;">No cached downloads yet</p>';
            return;
        }
        
        // Deduplicate files by videoId (prefer items with clean titles)
        const uniqueFiles = [];
        const seenVideoIds = new Set();
        const seenFilenames = new Set();
        
        // Sort by creation date (newest first) and prefer clean titles (no file extensions)
        cachedFiles.sort((a, b) => {
            // Prefer items with clean titles (no .mp3/.mp4/.webm extensions)
            const aHasExt = /\.(mp3|mp4|webm)$/i.test(a.title || '');
            const bHasExt = /\.(mp3|mp4|webm)$/i.test(b.title || '');
            if (aHasExt && !bHasExt) return 1;
            if (!aHasExt && bHasExt) return -1;
            // Then sort by date (newest first)
            return (b.created || 0) - (a.created || 0);
        });
        
        for (const file of cachedFiles) {
            const videoId = file.videoId;
            const filename = file.filename;
            
            // Skip if we've seen this videoId or exact filename
            if (videoId && seenVideoIds.has(videoId)) {
                console.log('⏭️ Skipping duplicate videoId:', videoId, file.title);
                continue;
            }
            if (filename && seenFilenames.has(filename)) {
                console.log('⏭️ Skipping duplicate filename:', filename);
                continue;
            }
            
            // Add to unique list and tracking sets
            uniqueFiles.push(file);
            if (videoId) seenVideoIds.add(videoId);
            if (filename) seenFilenames.add(filename);
        }
        
        console.log(`📊 Cache: ${cachedFiles.length} total files, ${uniqueFiles.length} unique after deduplication`);
        
        let html = '<div style="display: flex; flex-direction: column; gap: 8px;">';
        for (const file of uniqueFiles) {
            const fileSize = ((file.size || 0) / (1024 * 1024)).toFixed(2);
            const createdDate = file.created ? new Date(file.created).toLocaleDateString() : 'Unknown';
            // Prefer title field (clean) over filename (may have extensions)
            const rawTitle = file.title || file.filename || 'Unknown';
            const title = prettyTitleConverter(rawTitle); // Decode URL-encoded titles
            const format = file.format || 'Unknown';
            const platform = file.platform || '';
            const type = file.type || 'converter';
            const platformEmoji = platform === 'youtube' ? '📺' : platform === 'tiktok' ? '🎵' : '🎬';
            
            // Type badge
            const typeBadges = {
                'converter': '<span style="background: rgba(44, 111, 184, 0.3); padding: 2px 6px; border-radius: 3px; font-size: 0.75em; margin-right: 4px;">Converter</span>',
                'playlist': '<span style="background: rgba(156, 39, 176, 0.3); padding: 2px 6px; border-radius: 3px; font-size: 0.75em; margin-right: 4px;">Playlist</span>',
                'lofi': '<span style="background: rgba(255, 152, 0, 0.3); padding: 2px 6px; border-radius: 3px; font-size: 0.75em; margin-right: 4px;">Lofi</span>'
            };
            const typeBadge = typeBadges[type] || '';
            
            html += `
                <div style="display: flex; flex-direction: column; gap: 10px; padding: 10px 12px; background: rgba(44, 111, 184, 0.15); border-radius: 6px; border: 1px solid rgba(44, 111, 184, 0.3);">
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-weight: 600; color: var(--text-primary, #fff); font-size: 0.9em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${title}">
                            ${platformEmoji} ${title}
                        </div>
                        <div style="font-size: 0.8em; color: rgba(255, 255, 255, 0.8); margin-top: 3px;">
                            ${typeBadge}${format} • ${fileSize} MB • ${createdDate}
                        </div>
                    </div>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        <button onclick="downloadCachedFile('${file.id || file.download_id}')" style="flex: 1 1 120px; padding: 8px 12px; background: rgba(40, 167, 69, 0.2); color: #5adb6e; border: 1px solid rgba(40, 167, 69, 0.4); border-radius: 4px; cursor: pointer; font-size: 0.85em; font-weight: 600; white-space: nowrap;">
                            ⬇️ Download
                        </button>
                        <button onclick="deleteCachedFile('${file.id || file.download_id}')" style="flex: 0 0 auto; padding: 8px 12px; background: rgba(220, 53, 69, 0.2); color: #ff6b7a; border: 1px solid rgba(220, 53, 69, 0.4); border-radius: 4px; cursor: pointer; font-size: 0.85em; font-weight: 600;">
                            🗑️
                        </button>
                    </div>
                </div>
            `;
        }
        html += '</div>';
        
        container.innerHTML = html;
    } catch (error) {
        console.error('❌ Error loading cache manager:', error);
        container.innerHTML = '<p style="color: var(--text-secondary, #666); font-size: 0.9em; text-align: center; margin: 20px 0;">Cache empty</p>';
        sizeDisplay.textContent = '0 MB used';
    }
}

// 📦 Start progressive chunked download - request one chunk at a time
async function startChunkedDownload(status) {
    const totalParts = status.chunk_count || 0;
    const chunkDuration = status.chunk_duration || 600; // 10 minutes default
    const totalDuration = status.total_duration || 0;
    const title = status.title || 'video';
    const format = status.format || 'mp4';
    const url = videoUrlInput.value.trim();
    
    if (totalParts === 0) {
        console.error('❌ No chunk count in status');
        showError('Unable to determine chunk count');
        return;
    }
    
    console.log(`📦 Starting progressive chunked download: ${totalParts} parts`);
    console.log(`   Duration: ${totalDuration}s, Chunk size: ${chunkDuration}s`);
    
    // Start with the first chunk
    await requestNextChunk(url, title, format, 1, totalParts, chunkDuration, totalDuration);
}

// Request a specific chunk from the backend
async function requestNextChunk(url, title, format, chunkIndex, totalParts, chunkDuration, totalDuration) {
    try {
        console.log(`📥 Requesting chunk ${chunkIndex}/${totalParts}...`);
        
        // Calculate time range for this chunk
        const chunkStart = (chunkIndex - 1) * chunkDuration;
        const chunkEnd = Math.min(chunkIndex * chunkDuration, totalDuration);
        
        showSpinner(`Downloading part ${chunkIndex} of ${totalParts}... (${Math.floor(chunkStart/60)}m-${Math.floor(chunkEnd/60)}m)`);
        
        // Request this specific chunk from backend
        const requestData = {
            url: url,
            format: format === 'mp3' ? 1 : 0,
            quality: qualityValue || 128,
            chunk_index: chunkIndex,
            chunk_start: chunkStart,
            chunk_end: chunkEnd
        };
        
        console.log(`📤 Requesting chunk with params:`, requestData);
        
        const response = await fetch(`${API_BASE_URL}/api/v1/video/convert`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `Failed to request chunk ${chunkIndex}`);
        }
        
        const result = await response.json();
        const chunkDownloadId = result.download_id;
        
        console.log(`✅ Chunk ${chunkIndex} request submitted: ${chunkDownloadId}`);
        
        // Poll for this chunk's completion
        await pollChunkStatus(chunkDownloadId, url, title, format, chunkIndex, totalParts, chunkDuration, totalDuration);
        
    } catch (error) {
        console.error(`❌ Error requesting chunk ${chunkIndex}:`, error);
        hideSpinner();
        showError(`Failed to download part ${chunkIndex}: ${error.message}`);
    }
}

// Poll status for a single chunk
async function pollChunkStatus(chunkDownloadId, url, title, format, chunkIndex, totalParts, chunkDuration, totalDuration) {
    let attempts = 0;
    const maxAttempts = 600; // 10 minutes max (1 check per second)
    
    return new Promise((resolve, reject) => {
        const pollInterval = setInterval(async () => {
            try {
                attempts++;
                
                if (attempts > maxAttempts) {
                    clearInterval(pollInterval);
                    reject(new Error('Chunk download timeout'));
                    return;
                }
                
                const response = await fetch(`${API_BASE_URL}/api/v1/video/status/${chunkDownloadId}`);
                const status = await response.json();
                
                if (!response.ok) {
                    clearInterval(pollInterval);
                    reject(new Error(status.error || 'Status check failed'));
                    return;
                }
                
                // Update progress message
                const progress = Math.round(status.progress || 0);
                if (progress > 0) {
                    updateSpinnerText(`Downloading part ${chunkIndex}/${totalParts}... ${progress}%`);
                }
                
                if (status.status === 'completed') {
                    clearInterval(pollInterval);
                    console.log(`✅ Chunk ${chunkIndex} completed`);
                    
                    // Download and cache this chunk
                    await downloadAndCacheChunk(chunkDownloadId, title, format, chunkIndex, totalParts);
                    
                    // Show message and prompt for next chunk
                    if (chunkIndex < totalParts) {
                        showChunkReadyMessage(title, chunkIndex, totalParts, url, format, chunkDuration, totalDuration);
                    } else {
                        showChunkCompleteMessage(title, chunkIndex, totalParts);
                    }
                    
                    resolve();
                } else if (status.status === 'error') {
                    clearInterval(pollInterval);
                    reject(new Error(status.error || 'Chunk conversion failed'));
                }
                
            } catch (error) {
                clearInterval(pollInterval);
                reject(error);
            }
        }, 1000); // Check every second
    });
}

// Download and cache a single chunk
async function downloadAndCacheChunk(downloadId, title, format, chunkIndex, totalParts) {
    try {
        console.log(`💾 Downloading chunk ${chunkIndex} to cache...`);
        
        updateSpinnerText(`Saving part ${chunkIndex}/${totalParts} to cache...`);
        
        const downloadUrl = `${API_BASE_URL}/api/v1/video/download/${downloadId}`;
        const response = await fetch(downloadUrl);
        
        if (!response.ok) {
            throw new Error(`Failed to download chunk ${chunkIndex}`);
        }
        
        const blob = await response.blob();
        const filename = `${title}_part${String(chunkIndex).padStart(2, '0')}.${format}`;
        const fileSize = (blob.size / 1024 / 1024).toFixed(2);
        
        console.log(`✅ Downloaded chunk ${chunkIndex}: ${fileSize}MB`);
        
        // Save to IndexedDB
        const cacheId = `${downloadId}_chunk${chunkIndex}`;
        await saveDownloadedFile(
            cacheId,
            filename,
            blob,
            {
                title: `${title} (Part ${chunkIndex}/${totalParts})`,
                format: format.toUpperCase(),
                platform: currentPlatform,
                type: 'converter',
                chunked: true,
                chunk_index: chunkIndex,
                chunk_total: totalParts
            }
        );
        
        // Update cache manager
        loadCacheManager();
        
        console.log(`✅ Chunk ${chunkIndex} saved to cache`);
        
    } catch (error) {
        console.error(`❌ Error caching chunk ${chunkIndex}:`, error);
        throw error;
    }
}

// 📦 Download chunked video parts one at a time (DEPRECATED - kept for backwards compatibility)
async function downloadAndPackageChunks(status) {
    // This function is deprecated - chunking now happens via separate requests
    console.warn('⚠️ downloadAndPackageChunks called but chunking should use startChunkedDownload');
}

// Download a single chunk, cache it, and prompt user to download before continuing (DEPRECATED)
async function downloadNextChunk(downloadId, title, format, chunkIndex, totalParts) {
    // Deprecated - chunking now handled by requestNextChunk
    console.warn('⚠️ downloadNextChunk called but should use requestNextChunk');
}

// Show message when chunk is ready with button to continue
function showChunkReadyMessage(title, chunkIndex, totalParts, url, format, chunkDuration, totalDuration) {
    // Hide spinner and show video info container
    hideSpinner();
    
    if (videoInfo) {
        videoInfo.classList.remove('hidden');
        videoInfo.style.display = 'block';
    }
    
    // Get or create chunk message container
    let chunkContainer = document.getElementById('chunk-message-container');
    if (!chunkContainer) {
        chunkContainer = document.createElement('div');
        chunkContainer.id = 'chunk-message-container';
        chunkContainer.style.cssText = 'padding: 20px; margin: 20px 0;';
        
        // Insert after videoInfo or in formContainer
        if (videoInfo && videoInfo.parentElement) {
            videoInfo.parentElement.insertBefore(chunkContainer, videoInfo.nextSibling);
        } else if (formContainer) {
            formContainer.appendChild(chunkContainer);
        }
    }
    
    chunkContainer.innerHTML = `
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 25px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <h3 style="margin: 0 0 15px 0; font-size: 24px;">✅ Part ${chunkIndex}/${totalParts} Ready!</h3>
            <p style="margin: 0 0 10px 0; font-size: 18px; font-weight: 600;">${title}_part${String(chunkIndex).padStart(2, '0')}.${format}</p>
            <p style="margin: 0 0 20px 0; opacity: 0.95;">This file is now in your cache and ready to download.</p>
            
            <div style="background: rgba(255, 255, 255, 0.15); padding: 20px; border-radius: 8px; margin: 20px 0; backdrop-filter: blur(10px);">
                <p style="margin: 0 0 15px 0; font-weight: 600; font-size: 16px;">📋 Next Steps:</p>
                <ol style="margin: 0; padding-left: 20px; line-height: 1.8;">
                    <li><strong>Download</strong> this part from the cache manager below</li>
                    <li><strong>Clear the cache</strong> to free up space for the next part</li>
                    <li><strong>Click "Continue"</strong> to download part ${chunkIndex + 1}</li>
                </ol>
            </div>
            
            <button id="continue-chunk-btn" style="background: white; color: #667eea; border: none; padding: 15px 30px; font-size: 16px; font-weight: 600; border-radius: 8px; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.2); transition: transform 0.2s, box-shadow 0.2s;">
                Continue to Part ${chunkIndex + 1}/${totalParts} →
            </button>
        </div>
    `;
    
    chunkContainer.style.display = 'block';
    
    // Add event listener for continue button
    const continueBtn = document.getElementById('continue-chunk-btn');
    if (continueBtn) {
        continueBtn.addEventListener('mouseenter', () => {
            continueBtn.style.transform = 'translateY(-2px)';
            continueBtn.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)';
        });
        continueBtn.addEventListener('mouseleave', () => {
            continueBtn.style.transform = 'translateY(0)';
            continueBtn.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
        });
        continueBtn.addEventListener('click', async () => {
            chunkContainer.style.display = 'none';
            await requestNextChunk(url, title, format, chunkIndex + 1, totalParts, chunkDuration, totalDuration);
        });
    }
}

// Show final completion message
function showChunkCompleteMessage(title, chunkIndex, totalParts, isFinal) {
    // Hide spinner and show video info container
    hideSpinner();
    
    if (videoInfo) {
        videoInfo.classList.remove('hidden');
        videoInfo.style.display = 'block';
    }
    
    // Get or create chunk message container
    let chunkContainer = document.getElementById('chunk-message-container');
    if (!chunkContainer) {
        chunkContainer = document.createElement('div');
        chunkContainer.id = 'chunk-message-container';
        chunkContainer.style.cssText = 'padding: 20px; margin: 20px 0;';
        
        // Insert after videoInfo or in formContainer
        if (videoInfo && videoInfo.parentElement) {
            videoInfo.parentElement.insertBefore(chunkContainer, videoInfo.nextSibling);
        } else if (formContainer) {
            formContainer.appendChild(chunkContainer);
        }
    }
    
    chunkContainer.innerHTML = `
        <div style="background: linear-gradient(135deg, #4caf50 0%, #45a049 100%); color: white; padding: 25px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <h3 style="margin: 0 0 15px 0; font-size: 24px;">🎉 All Parts Complete!</h3>
            <p style="margin: 0 0 10px 0; font-size: 18px; font-weight: 600;">${title}_part${String(chunkIndex).padStart(2, '0')}</p>
            <p style="margin: 0 0 20px 0; opacity: 0.95;">This is the final part (${chunkIndex}/${totalParts}).</p>
            
            <div style="background: rgba(255, 255, 255, 0.15); padding: 20px; border-radius: 8px; margin: 20px 0; backdrop-filter: blur(10px);">
                <p style="margin: 0 0 8px 0; font-weight: 600; font-size: 16px;">✅ Download Complete</p>
                <p style="margin: 0; line-height: 1.6;">All ${totalParts} parts have been processed successfully. Download the final part from the cache manager below, and you'll have the complete video!</p>
            </div>
            
            <p style="margin: 0; font-size: 14px; opacity: 0.9;">
                <strong>Tip:</strong> You can use video editing software to combine all parts into a single file, or watch them individually.
            </p>
        </div>
    `;
    
    chunkContainer.style.display = 'block';
}

// Automatically download file from server and save to cache (background operation)
async function autoDownloadAndCache(status) {
    if (!currentDownloadId) {
        console.error('❌ No download ID for auto-caching');
        return;
    }
    
    // Skip for bulk downloads
    if (status.format && status.format.includes('Bulk')) {
        console.log('📦 Skipping auto-cache for bulk download');
        return;
    }
    
    try {
        console.log('💾 Auto-downloading and caching file...');
        
        // Get the file from the server
        const downloadUrl = `${API_BASE_URL}/api/v1/video/download/${currentDownloadId}`;
        const response = await fetch(downloadUrl);
        
        if (!response.ok) {
            console.error('❌ Auto-download failed:', response.status);
            return;
        }
        
        // Determine filename
        let filename = 'download.mp3';
        const disposition = response.headers.get('content-disposition');
        const contentType = response.headers.get('content-type') || '';
        
        const extractedFilename = getFilenameFromContentDisposition(disposition);
        if (extractedFilename) {
            filename = extractedFilename;
        } else if (status.title) {
            const cleanTitle = status.title.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').trim();
            const baseName = cleanTitle.substring(0, 50).trim();
            const extension = contentType.includes('video') ? '.mp4' : '.mp3';
            filename = baseName + extension;
        }
        
        // Get the blob
        const blob = await response.blob();
        
        // Extract video ID from URL for cache lookup
        let videoId = null;
        const urlInput = document.getElementById('videoUrl');
        if (urlInput && urlInput.value) {
            const url = urlInput.value.trim();
            // Extract YouTube video ID
            if (url.includes('youtube.com') || url.includes('youtu.be')) {
                if (url.includes('youtu.be/')) {
                    videoId = url.split('youtu.be/')[1].split('?')[0].split('&')[0];
                } else if (url.includes('watch?v=')) {
                    videoId = url.split('watch?v=')[1].split('&')[0];
                } else if (url.includes('v=')) {
                    videoId = url.split('v=')[1].split('&')[0];
                }
            }
        }
        
        // Save to IndexedDB cache
        await saveDownloadedFile(currentDownloadId, filename, blob, {
            title: status.title,
            format: status.format,
            platform: currentPlatform,
            type: 'converter',
            videoId: videoId
        });
        
        console.log('✅ File automatically cached:', filename);
        
        // Update cache manager display
        loadCacheManager();
        
    } catch (error) {
        console.error('❌ Error in auto-download and cache:', error);
        // Don't throw - this is a background operation
    }
}

// Global functions for cache manager buttons
window.downloadCachedFile = async function(downloadId) {
    try {
        const cachedFile = await getCachedDownload(downloadId);
        if (!cachedFile) {
            alert('File not found in cache');
            return;
        }
        
        const url = URL.createObjectURL(cachedFile.blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = cachedFile.filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error('❌ Error downloading cached file:', error);
        alert('Error downloading file from cache');
    }
};

window.deleteCachedFile = async function(downloadId) {
    if (!confirm('Delete this file from cache?')) {
        return;
    }
    
    try {
        await deleteCachedDownload(downloadId);
        loadCacheManager();
    } catch (error) {
        console.error('❌ Error deleting cached file:', error);
        alert('Error deleting file from cache');
    }
};


// Wire up the cookies editor UI
document.addEventListener('DOMContentLoaded', function() {
    try {
        const createBtn = document.getElementById('createCookiesBtn');
        const editor = document.getElementById('cookiesEditor');
        const textarea = document.getElementById('cookiesTextareaInput');
        const saveBtn = document.getElementById('saveCookiesBtn');
        const clearBtn = document.getElementById('clearCookiesBtn');
        const statusSpan = document.getElementById('cookiesStatus');

        if (createBtn && editor && textarea && saveBtn && clearBtn && statusSpan) {
            createBtn.addEventListener('click', async () => {
                editor.style.display = editor.style.display === 'none' ? 'block' : 'none';
                // load saved cookies if any
                try {
                    const saved = await getSavedCookies();
                    if (saved) {
                        textarea.value = saved;
                        statusSpan.textContent = 'Saved cookies loaded';
                    } else {
                        textarea.value = '';
                        statusSpan.textContent = 'No saved cookies';
                    }
                } catch (e) {
                    console.warn('Failed to read saved cookies', e);
                }
            });

            saveBtn.addEventListener('click', async () => {
                try {
                    await saveCookiesText('cookies.txt', textarea.value || '');
                    statusSpan.textContent = 'Cookies saved in browser';
                    // small flash
                    setTimeout(() => statusSpan.textContent = 'Saved', 1200);
                } catch (e) {
                    console.error('saveCookies failed', e);
                    statusSpan.textContent = 'Save failed';
                }
            });

            clearBtn.addEventListener('click', async () => {
                try {
                    await clearSavedCookies();
                    textarea.value = '';
                    statusSpan.textContent = 'No saved cookies';
                } catch (e) {
                    console.error('clearSavedCookies failed', e);
                    statusSpan.textContent = 'Clear failed';
                }
            });

            // reflect existing saved cookies on load
            (async () => {
                try {
                    const s = await getSavedCookies();
                    if (s) statusSpan.textContent = 'Saved cookies present';
                } catch (e) {
                    // ignore
                }
            })();
        }
    } catch (e) {
        console.warn('cookies editor wiring failed', e);
    }
});

// Modal-based cookies UI wiring (moved from inline HTML)
document.addEventListener('DOMContentLoaded', function() {
    try {
        const btn = document.getElementById('createCookiesBtn');
        const modal = document.getElementById('cookiesModal');
        const close = document.getElementById('cookiesModalClose');
        const cancel = document.getElementById('cookiesModalCancel');
        const clearBtn = document.getElementById('cookiesModalClear');
        const saveBtn = document.getElementById('cookiesModalSave');
    // optional textarea element (removed in manual-only mode, keep safe ref)
    const textarea = document.getElementById('cookiesTextarea');
    const domainDiv = document.getElementById('domainDiv');
    const nameDiv = document.getElementById('nameDiv');
    const manualFields = document.getElementById('manualFields');
    const manualGrid = document.getElementById('manualGrid');
    const statusSpan = document.getElementById('cookiesStatus');
    // elements used elsewhere in handlers
    const domainSel = document.getElementById('cookiesDomain');
    const domainOther = document.getElementById('cookiesDomainOther');
    const nameSel = document.getElementById('cookiesNameSelect');
    const nameCustom = document.getElementById('cookiesNameCustom');
    const valueInp = document.getElementById('cookiesValue');
    const expirySel = document.getElementById('cookiesExpirySelect');
    const expiryCustom = document.getElementById('cookiesExpiryCustom');

        if (!modal || !btn) return;

        // Ensure sensible defaults for modal controls so methods reliably show their UI
        function setModalDefaults() {
            try {
                if (methodSel && !methodSel.value) methodSel.value = 'paste';
                if (domainSel && !domainSel.value) domainSel.value = '.youtube.com';
                if (nameSel && !nameSel.value) nameSel.value = 'SID';
                if (expirySel && !expirySel.value) expirySel.value = 'session';
            } catch (e) { /* ignore */ }
        }

        function openModal(){
            modal.style.display = 'block';
            setModalDefaults();
            updateModalVisibility();
            // If paste is the active method, ensure textarea is visible and focused
            try {
                const m = methodSel && methodSel.value ? methodSel.value.toString().trim().toLowerCase() : 'paste';
                if (m === 'paste' && textarea) {
                    textarea.style.display = 'block';
                    textarea.focus();
                    try { textarea.scrollIntoView({ behavior: 'auto', block: 'nearest' }); } catch (e) {}
                }
            } catch (e) { /* ignore */ }
        }
        function closeModal(){ modal.style.display = 'none'; }

        btn.addEventListener('click', async () => {
            try {
                // Manual-only flow: load saved cookies and if a netscape line is present, parse it
                const saved = await getSavedCookies();
                if (saved) {
                    const lines = saved.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
                    for (const line of lines) {
                        if (line.startsWith('#')) continue;
                        const parts = line.split('\t');
                        if (parts.length >= 7) {
                            const domain = parts[0];
                            const name = parts[5];
                            const value = parts[6];
                            if (domainSel) {
                                if ([...domainSel.options].some(o => o.value === domain)) domainSel.value = domain;
                                else if (domainOther) { domainSel.value = 'other'; domainOther.value = domain; }
                            }
                            if (nameSel) {
                                if ([...nameSel.options].some(o => o.value === name)) nameSel.value = name;
                                else if (nameCustom) { nameSel.value = 'custom'; nameCustom.value = name; }
                            }
                            if (valueInp) valueInp.value = value;
                            break;
                        }
                    }
                    const cookieCount = lines.filter(l => !l.startsWith('#')).length;
                    if (statusSpan) statusSpan.textContent = `✅ ${cookieCount} cookie${cookieCount !== 1 ? 's' : ''} configured`;
                } else {
                    if (statusSpan) statusSpan.textContent = 'No cookies configured';
                }
            } catch (e) {
                console.warn('Failed to prefill cookies modal', e);
            }
            // Always ensure manual fields are visible
            if (manualFields) manualFields.style.display = 'block';
            if (manualGrid) manualGrid.style.display = 'grid';
            if (domainDiv) domainDiv.style.display = 'block';
            if (nameDiv) nameDiv.style.display = 'block';
            openModal();
        });

        function updateModalVisibility() {
            // Manual-only: always show manual groups and dependent controls
            if (textarea) textarea.style.display = 'none';
            if (manualFields) manualFields.style.display = 'block';
            if (manualGrid) manualGrid.style.display = 'grid';
            // guidedFields removed in manual-only mode
            if (domainDiv) domainDiv.style.display = 'block';
            if (nameDiv) nameDiv.style.display = 'block';
            if (domainSel && domainOther) domainOther.style.display = domainSel.value === 'other' ? 'block' : 'none';
            if (nameSel && nameCustom) nameCustom.style.display = nameSel.value === 'custom' ? 'block' : 'none';
            if (expirySel && expiryCustom) expiryCustom.style.display = expirySel.value === 'custom' ? 'block' : 'none';
        }

    // No method selector in manual-only mode, but keep change handlers for dependent selects
    if (domainSel && domainOther) domainSel.addEventListener('change', updateModalVisibility);
    if (nameSel && nameCustom) nameSel.addEventListener('change', updateModalVisibility);
    if (expirySel && expiryCustom) expirySel.addEventListener('change', updateModalVisibility);
        if (domainSel && domainOther) domainSel.addEventListener('change', updateModalVisibility);
        if (nameSel && nameCustom) nameSel.addEventListener('change', updateModalVisibility);
        if (expirySel && expiryCustom) expirySel.addEventListener('change', updateModalVisibility);

        if (close) close.addEventListener('click', closeModal);
        if (cancel) cancel.addEventListener('click', closeModal);
        window.addEventListener('click', function(e){ if (e.target === modal) closeModal(); });

        if (clearBtn) clearBtn.addEventListener('click', async () => {
            if (textarea) textarea.value = '';
            if (domainSel) domainSel.value = '.youtube.com';
            if (domainOther) domainOther.value = '';
            if (nameSel) nameSel.value = 'SID';
            if (nameCustom) nameCustom.value = '';
            if (valueInp) valueInp.value = '';
            if (expirySel) expirySel.value = 'session';
            if (expiryCustom) expiryCustom.value = '';
            // guided fields removed in manual-only mode
            try {
                await clearSavedCookies();
                if (statusSpan) statusSpan.textContent = 'No cookies configured';
            } catch (e) { console.warn('clearSavedCookies failed', e); }
            updateModalVisibility();
        });

        if (saveBtn) saveBtn.addEventListener('click', async () => {
            // Manual-only save: construct netscape-format cookie line from inputs
            let domain = domainSel ? domainSel.value : '';
            if (domain === 'other') domain = domainOther && domainOther.value ? domainOther.value.trim() : '';
            let name = nameSel ? nameSel.value : '';
            if (name === 'custom') name = nameCustom && nameCustom.value ? nameCustom.value.trim() : '';
            const value = valueInp && valueInp.value ? valueInp.value.trim() : '';
            if (!domain || !name || !value) {
                if (statusSpan) statusSpan.textContent = 'Please provide domain, cookie name, and cookie value';
                return;
            }
            if (value.length < 4) {
                if (statusSpan) statusSpan.textContent = 'Cookie value looks too short  check you pasted the right token';
                return;
            }
            let expiry = '2147483647';
            const now = Math.floor(Date.now() / 1000);
            if (expirySel) {
                const v = expirySel.value;
                if (v === 'session') expiry = '0';
                else if (v === '1h') expiry = (now + 3600).toString();
                else if (v === '1d') expiry = (now + 86400).toString();
                else if (v === '1w') expiry = (now + 7*86400).toString();
                else if (v === '1m') expiry = (now + 30*86400).toString();
                else if (v === '1y') expiry = (now + 365*86400).toString();
                else if (v === 'custom') {
                    if (expiryCustom && expiryCustom.value) expiry = expiryCustom.value.trim();
                }
            }
            let outText = `${domain}\tTRUE\t/\tFALSE\t${expiry}\t${name}\t${value}\n`;
            try {
                await saveCookiesText('cookies.txt', outText);
                if (statusSpan) statusSpan.textContent = '✅ Cookies configured and active';
            } catch (e) { console.warn('saveCookiesText failed', e); if (statusSpan) statusSpan.textContent = '❌ Save failed'; }
            closeModal();
        });

        // update status on load
        (async () => {
            try {
                const s = await getSavedCookies();
                if (s && statusSpan) {
                    const lines = s.split(/\r?\n/).filter(l => l.trim() && !l.startsWith('#')).length;
                    statusSpan.textContent = `✅ ${lines} cookie${lines !== 1 ? 's' : ''} configured`;
                } else if (statusSpan) {
                    statusSpan.textContent = 'No cookies configured';
                }
            } catch(e){
                if (statusSpan) statusSpan.textContent = 'No cookies configured';
            }
        })();

        updateModalVisibility();

    } catch (e) {
        console.warn('cookies modal wiring failed', e);
    }
});

// Helper: auto-attach saved cookies when starting a conversion if no file chosen
async function uploadSavedCookiesIfNeeded(download_id) {
    try {
        const cookieInput = document.getElementById('cookieUpload');
        if (cookieInput && cookieInput.files && cookieInput.files.length > 0) return false; // user provided file
        const saved = await getSavedCookies();
        if (!saved) return false;
        // create a Blob and FormData to upload to backend endpoint
        const blob = new Blob([saved], { type: 'text/plain' });
        const fd = new FormData();
        fd.append('file', blob, 'cookies.txt');
        const uploadUrl = `${API_BASE_URL}/api/v1/video/upload-cookies/${download_id}`;
        await fetch(uploadUrl, { method: 'POST', body: fd });
        return true;
    } catch (e) {
        console.warn('uploadSavedCookiesIfNeeded failed', e);
        return false;
    }
}

// Read all playlist blobs from unified cache
async function readAllBlobsFromIDB() {
    try {
        const allItems = await getAllCachedDownloads();
        // Filter only playlist type items
        const playlistItems = allItems.filter(item => item.type === 'playlist');
        return playlistItems.map(item => ({
            filename: item.filename,
            blob: item.blob,
            size: item.size,
            title: item.title
        }));
    } catch (error) {
        console.error('❌ Error reading playlist items from cache:', error);
        return [];
    }
}

// Clear all playlist items from unified cache
async function clearAllBlobsFromIDB() {
    try {
        const db = await openUnifiedCacheDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(CACHE_STORE_MEDIA, 'readwrite');
            const store = tx.objectStore(CACHE_STORE_MEDIA);
            const typeIndex = store.index('type');
            const req = typeIndex.openCursor(IDBKeyRange.only('playlist'));
            
            req.onsuccess = (e) => {
                const cursor = e.target.result;
                if (cursor) {
                    cursor.delete();
                    cursor.continue();
                } else {
                    resolve(true);
                }
            };
            req.onerror = (e) => reject(e.target ? e.target.error : e);
        });
    } catch (error) {
        console.error('❌ Error clearing playlist items:', error);
        return false;
    }
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
        updatePlaylistStatusUI({ currentTitle: `📦 Creating ZIP part ${frontendPartIndex}...` });
        
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

        // Pause processing and require user to clear cache before continuing
        waitingForContinue = true;
        showContinueControls(true);
        updatePlaylistStatusUI({ 
            currentTitle: `⏸️ PAUSED - ZIP downloaded! Click "Clear Cache & Continue" to resume processing remaining videos.` 
        });
        // Cache MUST be cleared by user clicking "Clear Cache & Continue" before resuming

    } catch (e) {
        console.error('Failed to create ZIP part in frontend', e);
        updatePlaylistStatusUI({ currentTitle: `❌ Error creating ZIP - please try again` });
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
        const wasWaitingForContinue = waitingForContinue;
        
        if (!confirm('This will clear the locally cached downloaded files (frontend cache). Continue?')) return;
        // Clear in-memory
        frontendStorage = [];
        frontendStorageSize = 0;
        waitingForContinue = false;
        showContinueControls(false);
        
        // Clear persisted
        try { await clearAllBlobsFromIDB(); } catch (e) { console.warn('Failed to clear IDB', e); }
        // Uncheck any checkboxes and update UI
        document.querySelectorAll('.video-checkbox').forEach(cb => cb.checked = false);
        updateDownloadSelectedButton();
        updatePlaylistStatusUI({ currentTitle: '✅ Cache cleared' });
        alert('Local cache cleared.');
        
        // If we were paused waiting for continue, resume the queue now
        if (wasWaitingForContinue && playlistQueue.length > 0) {
            updatePlaylistStatusUI({ currentTitle: '✅ Cache cleared - Resuming...' });
            await processQueue();
        }
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

    // Reset failure counter when starting new conversion
    statusCheckFailures = 0;

    // Hide video-info section when starting new conversion
    if (videoInfo) {
        videoInfo.classList.add('hidden');
        videoInfo.style.display = 'none';
    }

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

    // If playlist UI is active, do not allow normal convert flow  playlists use frontend queue
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

// Enhanced showSpinner with mode: 'modal' (hide UI) or 'subtle' (keep UI visible)
function showSpinner(mode = 'modal') {
    if (!spinner) return;
    
    // If mode is a string message, show it and default to modal mode
    let actualMode = 'modal';
    let message = null;
    
    if (typeof mode === 'string' && (mode === 'modal' || mode === 'subtle')) {
        actualMode = mode;
    } else if (typeof mode === 'string') {
        message = mode;
        actualMode = 'modal';
    }
    
    if (actualMode === 'modal') {
        if (formContainer) formContainer.style.display = 'none';
        if (videoInfo) {
            videoInfo.classList.add('hidden');
            videoInfo.style.display = 'none';
        }
        spinner.classList.remove('hidden');
        spinner.style.display = 'flex';
        if (convertButton) convertButton.disabled = true;
    } else if (actualMode === 'subtle') {
        // subtle spinner: keep UI visible, show small spinner indicator
        spinner.classList.remove('hidden');
        spinner.style.display = 'flex';
        // don't hide form or video info, don't disable buttons
        // apply a 'subtle' class so CSS can make it less intrusive if available
        spinner.classList.add('spinner-subtle');
    }

    // Set custom message if provided, otherwise use default
    if (spinnerText) {
        if (message) {
            spinnerText.textContent = message;
        } else if (!spinnerText.textContent) {
            spinnerText.textContent = 'Processing...';
        }
    }
}

function updateSpinnerText(message) {
    if (spinnerText) {
        spinnerText.textContent = message;
    }
}

function hideSpinner(mode = 'modal') {
    if (!spinner) return;
    spinner.classList.add('hidden');
    spinner.style.display = 'none';
    spinner.classList.remove('spinner-subtle');
    if (mode === 'modal') {
        if (formContainer) formContainer.style.display = 'block';
        if (convertButton) convertButton.disabled = false;
    }
    
    // Note: We don't hide progress/queue displays here anymore
    // They should be hidden explicitly when conversion completes
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
        warn.textContent = "Please wait  conversion in progress. Repeated requests may be rate-limited.";
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

// Best-effort in-browser audio extraction from a video File using MediaRecorder.
// This is a lightweight fallback that works on many browsers for simple audio extraction.
async function extractAudioInBrowser(file) {
    return new Promise(async (resolve, reject) => {
        if (!window.MediaRecorder) return reject(new Error('MediaRecorder not supported'));

        try {
            const url = URL.createObjectURL(file);
            const video = document.createElement('video');
            video.src = url;
            video.muted = true;
            video.playsInline = true;

            await new Promise((res, rej) => {
                const t = setTimeout(() => rej(new Error('Video load timeout')), 5000);
                video.onloadedmetadata = () => { clearTimeout(t); res(); };
                video.onerror = () => { clearTimeout(t); rej(new Error('Failed to load video metadata')); };
            });

            // Create an audio context and connect the video's audio to a destination
            const stream = video.captureStream ? video.captureStream() : video.mozCaptureStream && video.mozCaptureStream();
            if (!stream) {
                URL.revokeObjectURL(url);
                return reject(new Error('captureStream not available'));
            }

            const options = { mimeType: 'audio/webm' };
            const recorder = new MediaRecorder(stream, options);
            const chunks = [];
            recorder.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
            recorder.onerror = ev => { console.warn('MediaRecorder error', ev); };

            recorder.onstop = () => {
                try {
                    const blob = new Blob(chunks, { type: 'audio/webm' });
                    URL.revokeObjectURL(url);
                    resolve(blob);
                } catch (err) {
                    URL.revokeObjectURL(url);
                    reject(err);
                }
            };

            // Start playback and recording for a short duration to capture audio
            video.play().then(() => {
                recorder.start();
                // Record up to 30 seconds or duration, whichever is smaller
                const maxMs = Math.min(30_000, Math.max(5_000, (video.duration || 30) * 1000));
                setTimeout(() => {
                    try { recorder.stop(); } catch (e) { /* ignore */ }
                    try { video.pause(); } catch (e) { }
                }, maxMs);
            }).catch(playErr => {
                URL.revokeObjectURL(url);
                reject(playErr);
            });

            // Safety timeout
            setTimeout(() => {
                if (recorder && recorder.state === 'recording') {
                    try { recorder.stop(); } catch (e) { }
                }
            }, 35_000);

        } catch (e) {
            reject(e);
        }
    });
}


// Start actual conversion process
async function startConversion(url) {
    try {
        // Check if this video is already cached (YouTube only for now)
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            const videoId = getYouTubeVideoId(url);
            if (videoId) {
                const cachedItems = await getAllCachedDownloads();
                const alreadyCached = cachedItems.find(item => item.videoId === videoId);
                
                if (alreadyCached) {
                    console.log('✅ Video already cached:', alreadyCached.filename);
                    
                    // Show success state with cached file
                    hideSpinner();
                    showSuccess({
                        title: alreadyCached.title || 'Cached Video',
                        status: 'completed',
                        format: alreadyCached.format || (formatValue === 1 ? 'MP3' : 'MP4')
                    });
                    
                    // Set up download button to download from cache
                    currentDownloadId = alreadyCached.id;
                    const downloadBtn = document.getElementById('download-btn');
                    if (downloadBtn) {
                        downloadBtn.onclick = async () => {
                            const blob = alreadyCached.blob;
                            const filename = alreadyCached.filename;
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = filename;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                        };
                    }
                    
                    return; // Don't start server conversion
                }
            }
        }
        
        // Start conversion with retry logic and jitter
        console.log('🚀 Starting conversion...');
        console.log('📡 Convert endpoint:', `${API_BASE_URL}/api/v1/video/convert`);
        
        const payload = {
            url: url,
            format: formatValue,
            quality: formatValue === 1 ? audioQuality : videoQuality,
            proxy: (document.getElementById('perDownloadProxy') && document.getElementById('perDownloadProxy').value.trim()) || undefined
        };
        console.log('📦 Payload:', payload);
        
        // Add small random delay before request (50-200ms) to mimic human interaction
        await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 150));
        
        // Retry logic with exponential backoff
        let response, result;
        let retryCount = 0;
        const maxRetries = 3;
        
        while (retryCount <= maxRetries) {
            try {
                // All conversions now go through the server for reliability
                response = await fetch(`${API_BASE_URL}/api/v1/video/convert`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        // Add subtle variation to requests
                        'X-Request-ID': `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
                    },
                    body: JSON.stringify(payload)
                });
                
                console.log('📨 Convert response status:', response.status);
                result = await response.json();
                console.log('📋 Convert result:', result);
                
                if (response.ok) {
                    break; // Success
                }
                
                // Check if error is retryable
                if (response.status === 429 || response.status >= 500) {
                    throw new Error('RETRYABLE: ' + (result.error || 'Server error'));
                }
                
                // Non-retryable error
                throw new Error(result.error || 'Conversion failed');
                
            } catch (error) {
                if (retryCount >= maxRetries || !error.message.includes('RETRYABLE')) {
                    throw error;
                }
                
                // Calculate exponential backoff with jitter
                const backoffMs = Math.min(1000 * Math.pow(2, retryCount), 8000); // Max 8s
                const jitter = backoffMs * (Math.random() * 0.5); // Add 0-50% jitter
                const delayMs = backoffMs + jitter;
                
                console.log(`🔄 Retry ${retryCount + 1}/${maxRetries} after ${Math.round(delayMs)}ms...`);
                await new Promise(resolve => setTimeout(resolve, delayMs));
                retryCount++;
            }
        }
        
        if (!response.ok) {
            throw new Error(result.error || 'Conversion failed');
        }
        
        currentDownloadId = result.download_id;

        // If user uploaded a cookies.txt file, send it to the per-download cookie endpoint
        try {
            if (result && result.download_id) {
                const cookieInput = document.getElementById('cookieUpload');
                if (cookieInput && cookieInput.files && cookieInput.files.length > 0) {
                    const cookieFile = cookieInput.files[0];
                    const cookieForm = new FormData();
                    cookieForm.append('file', cookieFile, cookieFile.name);
                    const uploadUrl = `${API_BASE_URL}/api/v1/video/upload-cookies/${result.download_id}`;
                    console.log('📤 Uploading cookies to', uploadUrl);
                    await fetch(uploadUrl, { method: 'POST', body: cookieForm });
                    console.log('✅ Uploaded cookies for download', result.download_id);
                } else {
                    await uploadSavedCookiesIfNeeded(result.download_id);
                }
            }
        } catch (cookieErr) {
            console.warn('Failed to upload cookie file for conversion start:', cookieErr);
        }

        // Start polling for status
        startStatusPolling();
        // Visual disable so user can't re-click convert while background work is happening
        disableConvertButtonVisuals();

    } catch (error) {
        console.error('Conversion start error:', error);
        throw error;
    }

    // startStatusPolling() will handle polling  see implementation below
}

// Update progress display
function updateProgress(status) {
    if (progressDisplay && progressText) {
        const progress = Math.round(status.progress || 0);
        let message = 'Processing...';
        
        // Show retry attempts if available
        const retryInfo = status.retry_attempt ? ` (Attempt ${status.retry_attempt}/10)` : '';
        
        if (status.format && status.format.includes('Bulk')) {
            // Bulk download progress
            const completedCount = status.completed_count || 0;
            const totalVideos = status.total_videos || 0;
            
            if (progress > 0 && progress < 100) {
                message = `Downloading ${completedCount}/${totalVideos} videos... ${progress}%${retryInfo}`;
            } else if (progress >= 100) {
                message = 'Creating ZIP archive...';
            } else {
                message = `Preparing bulk download...${retryInfo}`;
            }
        } else {
            // Single video progress - show detailed status with better context
            const statusMsg = status.status || 'processing';
            const currentStep = status.current_step || status.message || '';
            
            // Use current_step or message for more detailed info
            if (currentStep) {
                if (currentStep.includes('download')) {
                    if (progress > 0 && progress < 100) {
                        message = `Downloading video... ${progress}%${retryInfo}`;
                    } else {
                        message = `Downloading video from YouTube...${retryInfo}`;
                    }
                } else if (currentStep.includes('convert') || currentStep.includes('encoding')) {
                    const format = status.format || 'MP3';
                    if (progress > 0 && progress < 100) {
                        message = `Converting to ${format}... ${progress}%${retryInfo}`;
                    } else {
                        message = `Converting to ${format}...${retryInfo}`;
                    }
                } else if (currentStep.includes('metadata') || currentStep.includes('thumbnail')) {
                    message = `Adding metadata and artwork...${retryInfo}`;
                } else if (currentStep.includes('extract')) {
                    if (progress > 0 && progress < 100) {
                        message = `Extracting audio... ${progress}%${retryInfo}`;
                    } else {
                        message = `Extracting audio...${retryInfo}`;
                    }
                } else {
                    message = `${currentStep}${retryInfo}`;
                }
            } else if (statusMsg === 'downloading') {
                if (progress > 0 && progress < 100) {
                    message = `Downloading video... ${progress}%${retryInfo}`;
                } else {
                    message = `Fetching video from YouTube...${retryInfo}`;
                }
            } else if (statusMsg === 'converting' || statusMsg === 'encoding') {
                const format = status.format || 'MP3';
                if (progress > 0 && progress < 100) {
                    message = `Converting to ${format}... ${progress}%${retryInfo}`;
                } else {
                    message = `Converting to ${format}...${retryInfo}`;
                }
            } else if (statusMsg === 'processing') {
                if (progress > 0 && progress < 100) {
                    message = `Processing video... ${progress}%${retryInfo}`;
                } else {
                    message = `Processing your video...${retryInfo}`;
                }
            } else if (statusMsg === 'queued') {
                message = `Waiting in queue...${retryInfo}`;
            } else if (progress > 0 && progress < 100) {
                message = `Converting... ${progress}%${retryInfo}`;
            } else if (progress >= 100) {
                message = 'Finalizing download...';
            } else if (retryInfo) {
                message = `Processing${retryInfo}...`;
            }
        }
        
        // Add specific status indicators
        if (status.message) {
            if (status.message.includes('rotating user agent')) {
                message += ' 🔄';
            } else if (status.message.includes('throttling')) {
                message += ' ⏱️';
            } else if (status.message.includes('extended backoff')) {
                message += ' ⏸️';
            }
        }
        
        progressText.textContent = message;
        progressDisplay.classList.remove('hidden');
        progressDisplay.style.display = 'block';
    }
}

// Start polling the status endpoint for the currentDownloadId
function startStatusPolling() {
    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
    }
    
    // Reset failure counter when starting new polling
    statusCheckFailures = 0;
    let pollAttempt = 0;
    let lastPollTime = Date.now();

    const pollWithJitter = async () => {
        pollAttempt++;
        const timeSinceLastPoll = Date.now() - lastPollTime;
        lastPollTime = Date.now();
        try {
            console.log('📊 Checking status for download ID:', currentDownloadId);
            
            // Check queue status first
            const queueResponse = await fetch(`${API_BASE_URL}/api/v1/video/queue/${currentDownloadId}`);
            const queueStatus = await queueResponse.json();
            console.log('🎯 Queue status:', queueStatus);
            
            // Get the dedicated queue status element
            const queueStatusDisplay = document.getElementById('queue-status-display');
            const queueStatusText = document.getElementById('queue-status-text');
            
            // Always show queue status when available (even if position is 1)
            if (queueStatus.success && queueStatus.queue) {
                const queueInfo = queueStatus.queue;
                const position = queueInfo.position || 1;
                const queueLength = queueInfo.queue_length || 1;
                // Backend now reports separate short/long active counts.
                // Prefer the explicit fields if present, otherwise fall back to legacy `active_conversions`.
                const activeShort = (typeof queueInfo.active_conversions_short !== 'undefined') ? queueInfo.active_conversions_short : (queueInfo.active_conversions || 0);
                const activeLong = (typeof queueInfo.active_conversions_long !== 'undefined') ? queueInfo.active_conversions_long : 0;
                const activeConversions = (Number(activeShort) || 0) + (Number(activeLong) || 0);
                const waitTime = Math.ceil(queueInfo.estimated_wait_seconds || 0);
                
                // Show queue status in dedicated visible element
                if (queueStatusDisplay && queueStatusText) {
                    queueStatusDisplay.classList.remove('hidden');
                    queueStatusDisplay.style.display = 'block';
                    
                    if (position === 1 && activeConversions > 0) {
                        queueStatusText.textContent = `🎬 Processing your video... (${activeConversions} active conversion${activeConversions > 1 ? 's' : ''})`;
                    } else if (position > 1) {
                        const minutes = Math.floor(waitTime / 60);
                        const seconds = waitTime % 60;
                        const waitStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
                        queueStatusText.textContent = `⏳ Position ${position}/${queueLength} in queue - Estimated wait: ${waitStr} (${activeConversions} active)`;
                    } else {
                        queueStatusText.textContent = `🎬 Processing... (Queue: ${queueLength}, Active: ${activeConversions})`;
                    }
                }
            } else {
                // Hide queue status when not available
                if (queueStatusDisplay) {
                    queueStatusDisplay.classList.add('hidden');
                    queueStatusDisplay.style.display = 'none';
                }
            }
            
            const response = await fetch(`${API_BASE_URL}/api/v1/video/status/${currentDownloadId}`);
            const status = await response.json();
            console.log('📈 Status response:', status);
            
            // Log detailed status for debugging
            if (status.current_step) {
                console.log('🔄 Current step:', status.current_step);
            }
            if (status.progress) {
                console.log('📊 Progress:', status.progress + '%');
            }

            if (!response.ok) {
                throw new Error(status.error || 'Status check failed');
            }
            
            // Reset failure counter on successful status check
            statusCheckFailures = 0;

            // Only update progress if not in queue or if processing
            if (!queueStatus.queue || !queueStatus.queue.in_queue || status.status !== 'queued') {
                updateProgress(status);
                
                // Also update spinner text if visible
                if (spinner && !spinner.classList.contains('hidden') && spinner.style.display !== 'none') {
                    const progress = Math.round(status.progress || 0);
                    if (status.current_step) {
                        updateSpinnerText(status.current_step);
                    } else if (status.status === 'downloading' && progress > 0) {
                        updateSpinnerText(`Downloading... ${progress}%`);
                    } else if (status.status === 'converting' && progress > 0) {
                        updateSpinnerText(`Converting... ${progress}%`);
                    }
                }
            }

            if (status.status === 'completed') {
                // Reset failure counter on successful completion
                statusCheckFailures = 0;
                
                if (status.format && status.format.includes('Bulk')) {
                    const completed = status.completed_count || 0;
                    const total = status.total_videos || 0;
                    const partsRemaining = status.parts_remaining || 0;

                    showSuccess(status);
                    enableBulkControls();
                    enableConvertButtonVisuals();

                    if (!(completed >= total && partsRemaining === 0)) {
                        // keep polling
                    } else {
                        clearInterval(statusCheckInterval);
                        isProcessing = false;
                    }
                } else if (status.parts && status.parts.length > 1) {
                    // 📦 CHUNKED DOWNLOAD: Multiple parts detected
                    console.log(`📦 Chunked download completed: ${status.parts.length} parts`);
                    
                    clearInterval(statusCheckInterval);
                    isProcessing = false;
                    enableBulkControls();
                    enableConvertButtonVisuals();
                    
                    // Start progressive chunk download (one at a time)
                    await downloadAndPackageChunks(status);
                    
                    // Hide queue/progress displays
                    const queueStatusDisplay = document.getElementById('queue-status-display');
                    if (queueStatusDisplay) {
                        queueStatusDisplay.style.display = 'none';
                    }
                    if (progressDisplay) {
                        progressDisplay.style.display = 'none';
                    }
                } else {
                    clearInterval(statusCheckInterval);
                    isProcessing = false;
                    enableBulkControls();
                    enableConvertButtonVisuals();
                    
                    // Automatically download and cache the file immediately
                    await autoDownloadAndCache(status);
                    
                    showSuccess(status);
                    
                    // Hide queue status display
                    const queueStatusDisplay = document.getElementById('queue-status-display');
                    if (queueStatusDisplay) {
                        queueStatusDisplay.style.display = 'none';
                    }
                    
                    // Hide progress display
                    if (progressDisplay) {
                        progressDisplay.style.display = 'none';
                    }
                }
            } else if (status.status === 'needs_chunking') {
                // 📦 VIDEO NEEDS CHUNKING: Backend determined video is too long
                console.log(`📦 Video needs chunking: ${status.chunk_count} parts`);
                
                clearInterval(statusCheckInterval);
                isProcessing = false;
                enableBulkControls();
                enableConvertButtonVisuals();
                
                // Hide queue/progress displays
                const queueStatusDisplay = document.getElementById('queue-status-display');
                if (queueStatusDisplay) {
                    queueStatusDisplay.style.display = 'none';
                }
                if (progressDisplay) {
                    progressDisplay.style.display = 'none';
                }
                
                // Start progressive chunked download (one chunk at a time)
                await startChunkedDownload(status);
            } else if (status.status === 'error') {
                console.error('❌ Conversion failed:', status.error);
                clearInterval(statusCheckInterval);
                showError(status.error || 'Conversion failed');
                isProcessing = false;
                hideSpinner();
                enableBulkControls();
                enableConvertButtonVisuals();
                
                // Hide queue status display
                const queueStatusDisplay = document.getElementById('queue-status-display');
                if (queueStatusDisplay) {
                    queueStatusDisplay.style.display = 'none';
                }
            }
        } catch (error) {
            console.error('💥 Status check error:', error);
            
            // Only count as failure if it's a network/fetch error (backend actually down)
            // Not if it's just an application error from the backend
            if (error.name === 'TypeError' || error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                statusCheckFailures++;
            }
            
            // 🛡️ Check if backend is down
            if (statusCheckFailures >= MAX_STATUS_FAILURES) {
                console.error('🚨 Multiple status check failures - backend may be down');
                clearInterval(statusCheckInterval);
                showError(
                    'Server connection lost. The backend may have stopped or crashed. ' +
                    'Please refresh the page and try again. If the problem persists, contact support.'
                );
                isProcessing = false;
                hideSpinner();
                enableBulkControls();
                enableConvertButtonVisuals();
                
                // Show backend down warning
                showBackendDownWarning();
            }
        }
        
        // Schedule next poll with jitter to avoid pattern detection
        scheduleNextPoll();
    };
    
    // Function to schedule next poll with exponential backoff and jitter
    const scheduleNextPoll = () => {
        let baseInterval = 2000; // Base 2 seconds
        
        // Add jitter (±20%) to prevent request patterns
        const jitter = baseInterval * (Math.random() * 0.4 - 0.2); // -20% to +20%
        const jitteredInterval = Math.max(1500, baseInterval + jitter); // Minimum 1.5s
        
        // Apply exponential backoff for long-running conversions (more human-like)
        if (pollAttempt > 20) {
            const backoffFactor = Math.min(1 + (pollAttempt - 20) / 30, 1.5); // Max 1.5x slower
            const finalInterval = jitteredInterval * backoffFactor;
            statusCheckInterval = setTimeout(pollWithJitter, finalInterval);
        } else {
            statusCheckInterval = setTimeout(pollWithJitter, jitteredInterval);
        }
    };
    
    // Start first poll immediately
    pollWithJitter();
}

// 🛡️ Show backend down warning
function showBackendDownWarning() {
    const warningDiv = document.createElement('div');
    warningDiv.id = 'backend-down-warning';
    warningDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #ff4444;
        color: white;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        max-width: 400px;
        font-size: 14px;
    `;
    warningDiv.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 10px; font-size: 16px;">⚠️ Server Connection Lost</div>
        <div style="margin-bottom: 10px;">
            The backend server appears to be down or not responding. Your download may have been interrupted.
        </div>
        <div style="margin-bottom: 10px;">
            <strong>What to do:</strong>
            <ul style="margin: 5px 0; padding-left: 20px;">
                <li>Refresh this page</li>
                <li>Wait a few minutes and try again</li>
                <li>Check if the server is running</li>
            </ul>
        </div>
        <button onclick="location.reload()" style="
            background: white;
            color: #ff4444;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
            margin-right: 10px;
        ">Refresh Page</button>
        <button onclick="this.parentElement.remove()" style="
            background: transparent;
            color: white;
            border: 1px solid white;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
        ">Dismiss</button>
    `;
    
    // Remove existing warning if any
    const existing = document.getElementById('backend-down-warning');
    if (existing) existing.remove();
    
    document.body.appendChild(warningDiv);
}

// 🛡️ Health check function
async function checkBackendHealth() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);  // 5 second timeout
        
        const response = await fetch(`${API_BASE_URL}/api/v1/health`, {
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (response.ok) {
            const health = await response.json();
            backendHealthy = true;
            statusCheckFailures = 0;  // Reset failure counter
            return true;
        } else {
            backendHealthy = false;
            return false;
        }
    } catch (error) {
        backendHealthy = false;
        return false;
    }
}

// 🛡️ Start periodic health checks
function startHealthChecks() {
    if (healthCheckInterval) return;
    
    // Check every 30 seconds
    healthCheckInterval = setInterval(async () => {
        const healthy = await checkBackendHealth();
        
        if (!healthy && !document.getElementById('backend-down-warning')) {
            console.warn('⚠️ Backend health check failed');
            
            // Only show warning if user has an active download AND multiple failures
            if (isProcessing && statusCheckFailures >= MAX_STATUS_FAILURES) {
                showBackendDownWarning();
            }
        }
    }, 30000);
}

// Start health checks when page loads
document.addEventListener('DOMContentLoaded', () => {
    checkBackendHealth();  // Initial check
    startHealthChecks();   // Start periodic checks
});

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
    spinner.classList.add('hidden');
    spinner.style.display = 'none';
    videoInfo.classList.remove('hidden');
    videoInfo.style.display = 'block';
    convertButton.disabled = false;
    
    // Hide progress and queue displays since conversion is complete
    const queueStatusDisplay = document.getElementById('queue-status-display');
    if (queueStatusDisplay) {
        queueStatusDisplay.classList.add('hidden');
        queueStatusDisplay.style.display = 'none';
    }
    if (progressDisplay) {
        progressDisplay.classList.add('hidden');
        progressDisplay.style.display = 'none';
    }
    
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
    spinner.classList.add('hidden');
    spinner.style.display = 'none';
    formContainer.style.display = 'block';
    convertButton.disabled = false;
    
    // Hide progress and queue displays on error
    const queueStatusDisplay = document.getElementById('queue-status-display');
    if (queueStatusDisplay) {
        queueStatusDisplay.classList.add('hidden');
        queueStatusDisplay.style.display = 'none';
    }
    if (progressDisplay) {
        progressDisplay.classList.add('hidden');
        progressDisplay.style.display = 'none';
    }
    
    // 🛡️ Enhanced error messages with helpful suggestions
    let suggestions = [];
    
    // Detect specific error types and add helpful suggestions
    if (message.includes('timeout') || message.includes('exceeded time limit')) {
        suggestions.push('This video may be too large or the connection is slow');
        suggestions.push('Try a lower quality setting');
    } else if (message.includes('rate limit') || message.includes('too many requests')) {
        suggestions.push('YouTube is temporarily limiting downloads');
        suggestions.push('Wait 10-60 minutes before trying again');
    } else if (message.includes('unavailable') || message.includes('private') || message.includes('removed')) {
        suggestions.push('This video may be deleted, private, or region-restricted');
    } else if (message.includes('stalled')) {
        suggestions.push('Download got stuck with no progress');
        suggestions.push('Try again in a few minutes');
    } else if (message.includes('Server connection lost') || message.includes('backend')) {
        suggestions.push('The server may have crashed or restarted');
        suggestions.push('Refresh the page and try again');
    }
    
    // Show error message
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.style.cssText = 'padding: 20px; margin: 15px 0; background: #ff4444; color: white; border-radius: 8px;';
    
    let html = `<div style="font-weight: bold; margin-bottom: 10px;">${message}</div>`;
    
    if (suggestions.length > 0) {
        html += `
            <div style="margin-top: 10px; font-size: 14px; opacity: 0.9;">
                <div style="font-weight: bold; margin-bottom: 5px;">💡 Suggestions:</div>
                <ul style="margin: 5px 0; padding-left: 20px;">
                    ${suggestions.map(s => `<li>${s}</li>`).join('')}
                </ul>
            </div>
        `;
    }
    
    errorDiv.innerHTML = html;
    formContainer.appendChild(errorDiv);
    
    // Remove error message after 8 seconds (increased from 5)
    setTimeout(() => {
        errorDiv.remove();
    }, 8000);
}

// Handle download
async function handleDownload() {
    if (!currentDownloadId) {
        showError('No download available');
        return;
    }
    
    try {
        showDownloadProgress();
        
        // Always try to download from cache first
        const cachedFile = await getCachedDownload(currentDownloadId);
        if (cachedFile) {
            console.log('📦 Downloading from cache:', cachedFile.filename);
            const url = URL.createObjectURL(cachedFile.blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = cachedFile.filename;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            showDownloadComplete();
            return;
        }
        
        // If not in cache, show error (file may have been deleted from backend)
        showError('File not available. It may have expired from the server.');
        return;
        
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
    
    // Refresh cache manager to show newly cached file
    loadCacheManager();
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

    // Fallback: no active bulk to continue  reset UI for a fresh conversion
    // Keep this client-side so we don't hard reload unless necessary
    isProcessing = false;
    hideSpinner();
    enableBulkControls();
    enableConvertButtonVisuals();
    
    // Hide video-info section for fresh conversion
    if (videoInfo) {
        videoInfo.classList.add('hidden');
        videoInfo.style.display = 'none';
    }
    
    // Hide progress and queue displays
    const queueStatusDisplay = document.getElementById('queue-status-display');
    if (queueStatusDisplay) {
        queueStatusDisplay.classList.add('hidden');
        queueStatusDisplay.style.display = 'none';
    }
    if (progressDisplay) {
        progressDisplay.classList.add('hidden');
        progressDisplay.style.display = 'none';
    }
    
    // Optionally clear currentDownloadId so UI starts fresh
    currentDownloadId = null;
}

window.handleConvertAgain = handleConvertAgain;