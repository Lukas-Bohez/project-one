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
            <div class="playlist-actions">
                <button id="download-all-btn" class="download-all-btn">
                    <i class="fas fa-download"></i> Download All (${playlistData.video_count} videos)
                </button>
                <button id="select-videos-btn" class="select-videos-btn">
                    <i class="fas fa-list"></i> Select Individual Videos
                </button>
            </div>
        </div>
        <div id="playlist-videos" class="playlist-videos" style="display: none;">
            <div class="playlist-controls">
                <button id="select-all-btn" class="select-all-btn">Select All</button>
                <button id="deselect-all-btn" class="deselect-all-btn">Deselect All</button>
                <button id="download-selected-btn" class="download-selected-btn" disabled>
                    <i class="fas fa-download"></i> Download Selected
                </button>
            </div>
            <div class="videos-list">
                ${playlistData.videos.map(video => `
                    <div class="video-item">
                        <input type="checkbox" class="video-checkbox" value="${video.id}" data-title="${video.title}">
                        <div class="video-info">
                            <div class="video-title">${video.title}</div>
                            <div class="video-duration">${video.duration ? formatDuration(video.duration) : ''}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    playlistContainer.style.display = 'block';
    
    // Add event listeners
    setupPlaylistEventListeners();
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

async function downloadAllVideos() {
    if (!currentPlaylistData) return;
    
    const videoIds = currentPlaylistData.videos.map(v => v.id);
    await startBulkDownload(videoIds, `Bulk: ${currentPlaylistData.title}`);
}

async function downloadSelectedVideos() {
    const selectedCheckboxes = document.querySelectorAll('.video-checkbox:checked');
    const videoIds = Array.from(selectedCheckboxes).map(cb => cb.value);
    
    if (videoIds.length === 0) return;
    
    const selectedTitles = Array.from(selectedCheckboxes).map(cb => cb.dataset.title);
    await startBulkDownload(videoIds, `Selected videos (${videoIds.length})`);
}

async function startBulkDownload(videoIds, description) {
    try {
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
    
    if (isProcessing) {
        console.log('⚠️ Already processing, ignoring click');
        return;
    }
    
    const url = videoUrlInput.value.trim();
    console.log('🔗 URL from input:', url);
    
    if (!url) {
        console.log('❌ No URL provided');
        showValidationError('Please enter a video URL');
        return;
    }
    
    console.log('✅ Validating URL...');
    const isValid = await validateUrl();
    console.log('🔍 URL validation result:', isValid);
    
    if (!isValid) {
        console.log('❌ URL validation failed');
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
    }
}

// Show loading spinner
function showSpinner() {
    formContainer.style.display = 'none';
    videoInfo.style.display = 'none';
    spinner.style.display = 'flex';
    convertButton.disabled = true;
    
    // Update spinner text based on process stage
    updateSpinnerText();
}

// Hide spinner
function hideSpinner() {
    spinner.style.display = 'none';
    formContainer.style.display = 'block';
    convertButton.disabled = false;
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
                clearInterval(statusCheckInterval);
                showSuccess(status);
                isProcessing = false;
            } else if (status.status === 'error') {
                console.error('❌ Conversion failed:', status.error);
                clearInterval(statusCheckInterval);
                showError(status.error || 'Conversion failed');
                isProcessing = false;
                hideSpinner();
            }
            
        } catch (error) {
            console.error('💥 Status check error:', error);
            clearInterval(statusCheckInterval);
            showError('Failed to check conversion status');
            isProcessing = false;
            hideSpinner();
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
        
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        
        // Create temporary link and trigger download
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up the object URL
        URL.revokeObjectURL(url);
        
        // Show completion message
        showDownloadComplete();
        
    } catch (error) {
        console.error('Download error:', error);
        showError('Download failed. Please try again.');
        
        // Reset download button
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