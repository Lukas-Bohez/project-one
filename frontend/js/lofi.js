// Simple Random Lofi Player - Folder Scanner Version with Audio Normalization and Persistence
// Configuration
const config = {
    folder: '../lofi/', // Path from js/ to lofi/
    volume: 0.2,
    fadeDuration: 1000,
    normalization: {
        enabled: true,
        targetLoudness: -23, // LUFS (Loudness Units relative to Full Scale)
        analysisTime: 3000, // How long to analyze each track (ms)
        cache: true // Cache normalization data
    },
    persistence: { // New persistence configuration
        enabled: true,
        localStorageKey: 'lofiPlayerState',
        normalizationCacheKey: 'lofiNormalizationCache'
    }
};

// ADD YOUR AUDIO FILENAMES HERE (only if folder scanning doesn't work)
const manualSongList = [
    // Example: 'my-song.mp3', 'another-track.wav', 'chill-beat.mp3'
    // Leave empty to try folder scanning first
];

// Player elements
const audioPlayer = new Audio();
let audioContext = null;
let analyser = null;
let source = null;
let gainNode = null;
let songList = [];
let isPlaying = false; // Tracks if the player *should* be playing (can be paused)
let lastPlayedSongs = []; // Track recently played songs
let currentSongIndex = -1; // Not strictly used for individual song tracking anymore, but kept.
let normalizationCache = new Map(); // Cache for normalization data

// --- Persistence Variables ---
let savedPlaybackState = null; // To hold state loaded from localStorage

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('Lofi player ready - click anywhere to start or resume');

    // Load persisted state if persistence is enabled
    if (config.persistence.enabled) {
        loadPlayerState();
        loadNormalizationCache();
    }

    // Initialize UI elements
    createFloatingIcon();
    createLofiModal();

    // Check if there's a saved state to resume
    if (savedPlaybackState && savedPlaybackState.isPlaying) {
        console.log('Attempting to resume playback from saved state...');
        // We'll call startPlayback which will then handle loading the saved song
        // However, we need a user gesture to start playing, so attach it for now.
        // The modal's play/pause button handler will take care of immediate play.
        document.addEventListener('click', initialResumeAttempt, { once: true });
        document.addEventListener('keydown', initialResumeAttempt, { once: true });
    } else {
        document.addEventListener('click', startPlayback, { once: true });
        document.addEventListener('keydown', startPlayback, { once: true });
    }

    // Save state before leaving the page
    window.addEventListener('beforeunload', savePlayerState);
});

// Initial resume attempt, triggered by first user gesture
function initialResumeAttempt() {
    if (savedPlaybackState && savedPlaybackState.isPlaying) {
        // This will trigger the full resume flow
        startPlayback();
    } else {
        // If no active saved state, proceed with normal start
        startPlayback();
    }
}


// Initialize Web Audio API
function initializeAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();

        // Create audio nodes
        source = audioContext.createMediaElementSource(audioPlayer);
        gainNode = audioContext.createGain();
        analyser = audioContext.createAnalyser();

        // Connect the audio graph
        source.connect(gainNode);
        gainNode.connect(analyser);
        analyser.connect(audioContext.destination);

        // Configure analyser
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.8;

        console.log('🎛️ Audio normalization initialized');
    }
}

// Calculate RMS (Root Mean Square) for loudness estimation
function calculateRMS(audioBuffer) {
    const channelData = audioBuffer.getChannelData(0);
    let sum = 0;

    for (let i = 0; i < channelData.length; i++) {
        sum += channelData[i] * channelData[i];
    }

    return Math.sqrt(sum / channelData.length);
}

// Analyze audio loudness using Web Audio API
function analyzeAudioLoudness(audioElement, duration = config.normalization.analysisTime) {
    return new Promise((resolve) => {
        if (!config.normalization.enabled) {
            resolve(1.0); // No normalization
            return;
        }

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const samples = [];
        let sampleCount = 0;
        const maxSamples = Math.floor(duration / 50); // Sample every 50ms

        const analyzeSample = () => {
            if (audioElement.paused || audioElement.ended || sampleCount >= maxSamples) {
                // Calculate average RMS
                if (samples.length === 0) {
                    resolve(1.0);
                    return;
                }

                const avgRMS = samples.reduce((a, b) => a + b, 0) / samples.length;

                // Convert to approximate LUFS and calculate gain
                // This is a rough approximation. For precise LUFS, a dedicated library is better.
                const estimatedLUFS = 20 * Math.log10(avgRMS) - 23;
                const targetGain = Math.pow(10, (config.normalization.targetLoudness - estimatedLUFS) / 20);

                // Clamp gain to reasonable limits (0.1x to 3x)
                const clampedGain = Math.max(0.1, Math.min(3.0, targetGain));

                console.log(`📊 Audio analysis: RMS=${avgRMS.toFixed(4)}, Est.LUFS=${estimatedLUFS.toFixed(1)}, Gain=${clampedGain.toFixed(2)}x`);
                resolve(clampedGain);
                return;
            }

            analyser.getByteFrequencyData(dataArray);

            // Convert to RMS
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
                const normalized = dataArray[i] / 255.0; // Normalize byte to 0-1 range
                sum += normalized * normalized;
            }
            const rms = Math.sqrt(sum / dataArray.length);

            if (rms > 0.001) { // Only include non-silent samples
                samples.push(rms);
            }

            sampleCount++;
            setTimeout(analyzeSample, 50);
        };

        // Start analysis after a short delay to let audio start playing
        setTimeout(analyzeSample, 100);
    });
}

// Main playback starter
function startPlayback() {
    if (isPlaying && !savedPlaybackState) return; // Prevent multiple starts if already playing and not resuming

    console.log('Starting playback...');

    // Initialize audio context on user interaction
    initializeAudioContext();

    // Try folder scanning first
    scanFolderForMP3s()
        .then((files) => {
            if (files && files.length > 0) {
                songList = files;
                console.log('📁 Scanned folder, found', songList.length, 'songs:', songList);
                handleInitialSongLoad();
                isPlaying = true;
            } else {
                // Fallback to manual list
                if (manualSongList.length > 0) {
                    console.log('📝 Using manual song list:', manualSongList);
                    songList = [...manualSongList];
                    handleInitialSongLoad();
                    isPlaying = true;
                } else {
                    console.log('❌ No songs found! Either:');
                    console.log('1. Add MP3 or WAV files to the lofi/ folder, OR');
                    console.log('2. Add filenames to the manualSongList array in the code');
                    console.log('Current folder path:', config.folder);
                }
            }
        })
        .catch((error) => {
            console.error('Folder scan failed:', error);

            // Try manual list as fallback
            if (manualSongList.length > 0) {
                console.log('📝 Folder scan failed, using manual list');
                songList = [...manualSongList];
                handleInitialSongLoad();
                isPlaying = true;
            } else {
                console.error('❌ No fallback available. Add songs to manualSongList array.');
            }
        });
}

// Handles loading the first song, either from persistence or randomly
function handleInitialSongLoad() {
    if (config.persistence.enabled && savedPlaybackState && savedPlaybackState.currentSong) {
        const savedSongName = savedPlaybackState.currentSong.split('/').pop().split('?')[0];
        const fullSavedPath = config.folder + savedSongName; // Reconstruct full path
        console.log(`Attempting to load saved song: ${savedSongName} at ${savedPlaybackState.currentTime.toFixed(1)}s`);
        loadAndPlay(fullSavedPath, savedSongName, savedPlaybackState.currentTime, savedPlaybackState.volume, savedPlaybackState.isPlaying);
        // Clear saved state after attempting to load it to avoid re-loading on subsequent new page loads within the same session
        savedPlaybackState = null;
    } else {
        playRandomSong(); // No saved state or persistence disabled
    }
}

// Scan folder for audio files (MP3 and WAV)
async function scanFolderForMP3s() {
    try {
        console.log('🔍 Scanning folder for audio files:', config.folder);

        const response = await fetch(config.folder);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: Cannot access folder`);
        }

        const html = await response.text();

        // Parse the directory listing HTML
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Look for audio file links in different formats
        let audioLinks = [];

        // Try common directory listing formats for both MP3 and WAV
        const linkSelectors = [
            'a[href$=".mp3"], a[href$=".wav"]', // Direct audio links
            'a[href*=".mp3"], a[href*=".wav"]', // Contains audio extensions
            'a[href$=".MP3"], a[href$=".WAV"]', // Uppercase
            'a[href*=".MP3"], a[href*=".WAV"]' // Uppercase contains
        ];

        for (const selector of linkSelectors) {
            const links = doc.querySelectorAll(selector);
            if (links.length > 0) {
                audioLinks = Array.from(links);
                break;
            }
        }

        // Extract filenames
        const files = audioLinks.map((link) => {
            let href = link.getAttribute('href');

            // Clean up the href
            if (href.startsWith('/')) {
                href = href.substring(1);
            }

            // Get just the filename
            const filename = href.split('/').pop().split('?')[0];

            return filename;
        }).filter(filename => {
            const lower = filename.toLowerCase();
            return (lower.endsWith('.mp3') || lower.endsWith('.wav')) &&
                filename !== '' &&
                !filename.includes('..'); // Security: no parent directory access
        });

        console.log('🎵 Found audio files:', files);
        return files;

    } catch (error) {
        console.warn('Folder scanning failed:', error.message);

        // Try alternative method: attempt to load common index files
        try {
            const indexResponse = await fetch(config.folder + 'index.json');
            if (indexResponse.ok) {
                const indexData = await indexResponse.json();
                if (Array.isArray(indexData)) {
                    console.log('📋 Using index.json file list');
                    return indexData.filter(f => {
                        const lower = f.toLowerCase();
                        return lower.endsWith('.mp3') || lower.endsWith('.wav');
                    });
                }
            }
        } catch (e) {
            // Index.json doesn't exist, that's fine
        }

        throw error;
    }
}

// Play random song with crossfade (avoiding recent repeats)
function playRandomSong() {
    if (songList.length === 0) {
        console.log('No songs available');
        return;
    }

    let randomSong;
    let attempts = 0;
    const maxAttempts = 20;

    // For small playlists, avoid immediate repeats
    // For larger playlists, avoid recently played songs
    const avoidanceCount = Math.min(songList.length - 1, Math.max(1, Math.floor(songList.length / 4)));

    do {
        const randomIndex = Math.floor(Math.random() * songList.length);
        randomSong = songList[randomIndex];
        attempts++;

        // If we've tried too many times, just play whatever we got
        if (attempts >= maxAttempts) {
            console.log('⚠️ Max selection attempts reached, playing:', randomSong);
            break;
        }

    } while (lastPlayedSongs.includes(randomSong) && songList.length > 1);

    // Update recently played list
    lastPlayedSongs.push(randomSong);

    // Keep the recent list at reasonable size
    if (lastPlayedSongs.length > avoidanceCount) {
        lastPlayedSongs.shift(); // Remove oldest
    }

    const songPath = config.folder + randomSong;

    console.log('▶ Playing:', randomSong, `(avoiding last ${lastPlayedSongs.length - 1} songs)`);

    // Fade out current song if playing
    if (!audioPlayer.paused) {
        fadeOut(audioPlayer, () => {
            loadAndPlay(songPath, randomSong);
        });
    } else {
        loadAndPlay(songPath, randomSong);
    }
}

// Load and play new song with fade in and normalization
function loadAndPlay(songPath, songName, startTime = 0, initialVolume = 0, shouldPlay = true) {
    audioPlayer.src = songPath;
    audioPlayer.volume = initialVolume; // Start at 0 or the saved initialVolume for fade in

    // Check cache for normalization data
    const cacheKey = songName;
    let cachedGain = null;

    if (config.normalization.cache && normalizationCache.has(cacheKey)) {
        cachedGain = normalizationCache.get(cacheKey);
        console.log('📦 Using cached normalization for:', songName, `(${cachedGain.toFixed(2)}x)`);
    }

    // Set a flag to indicate if we're resuming or just starting normally
    let isResuming = startTime > 0 && shouldPlay;

    audioPlayer.currentTime = startTime; // Set playback position
    isPlaying = shouldPlay; // Update global state

    // If starting from scratch (or resuming a paused state), try to play
    if (shouldPlay) {
        audioPlayer.play()
            .then(() => {
                console.log('🎵 Now playing:', songName);

                // Update UI immediately (moved here from event listener for quicker response)
                const nowPlayingDiv = document.getElementById('now-playing');
                if (nowPlayingDiv) {
                    nowPlayingDiv.textContent = `Now Playing: ${decodeURIComponent(songName)}`;
                }
                const playPauseBtn = document.getElementById('play-pause-btn');
                if (playPauseBtn) {
                    playPauseBtn.textContent = '⏸ Pause';
                    playPauseBtn.style.backgroundColor = 'var(--tertiary-color, #0d9edb)';
                    playPauseBtn.onmouseover = () => playPauseBtn.style.backgroundColor = 'var(--info-color, #0d61aa)';
                    playPauseBtn.onmouseout = () => playPauseBtn.style.backgroundColor = 'var(--tertiary-color, #0d9edb)';
                }


                if (cachedGain !== null) {
                    // Use cached gain immediately
                    gainNode.gain.setValueAtTime(cachedGain, audioContext.currentTime);
                    fadeIn(audioPlayer);
                } else {
                    // Start with default gain and analyze
                    gainNode.gain.setValueAtTime(1.0, audioContext.currentTime);
                    fadeIn(audioPlayer);

                    // Analyze and adjust gain
                    if (config.normalization.enabled) {
                        analyzeAudioLoudness(audioPlayer)
                            .then((normalizedGain) => {
                                // Cache the result
                                if (config.normalization.cache) {
                                    normalizationCache.set(cacheKey, normalizedGain);
                                    saveNormalizationCache(); // Save cache after update
                                }

                                // Apply the gain gradually to avoid sudden volume changes
                                gainNode.gain.exponentialRampToValueAtTime(
                                    normalizedGain,
                                    audioContext.currentTime + 0.5
                                );
                            })
                            .catch(error => {
                                console.warn('Normalization analysis failed:', error);
                            });
                    }
                }

                // Setup next song when current ends
                audioPlayer.removeEventListener('ended', handleSongEnded); // Remove previous listener
                audioPlayer.addEventListener('ended', handleSongEnded, { once: true });

            })
            .catch((error) => {
                console.error('❌ Playback failed for:', songName, error);

                // Update UI to reflect error
                const nowPlayingDiv = document.getElementById('now-playing');
                if (nowPlayingDiv) nowPlayingDiv.textContent = `Error playing: ${songName}`;

                // Remove failed song and try another
                songList = songList.filter(song => song !== songName);
                // Also remove from recently played list
                lastPlayedSongs = lastPlayedSongs.filter(song => song !== songName);
                // Remove from normalization cache
                normalizationCache.delete(cacheKey);
                console.log('Removed failed song, remaining:', songList.length);

                if (songList.length > 0) {
                    setTimeout(playRandomSong, 1000);
                } else {
                    console.error('No more songs to play!');
                    isPlaying = false;
                    // Update UI
                    const playPauseBtn = document.getElementById('play-pause-btn');
                    if (playPauseBtn) {
                        playPauseBtn.textContent = '▶ Play';
                        playPauseBtn.style.backgroundColor = 'var(--primary-color, #2c4c7c)';
                        playPauseBtn.onmouseover = () => playPauseBtn.style.backgroundColor = 'var(--secondary-color, #0c4061)';
                        playPauseBtn.onmouseout = () => playPauseBtn.style.backgroundColor = 'var(--primary-color, #2c4c7c)';
                    }
                }
            });
    } else {
        // If not supposed to play (e.g., loaded a paused state)
        audioPlayer.pause();
        const nowPlayingDiv = document.getElementById('now-playing');
        if (nowPlayingDiv) nowPlayingDiv.textContent = `Paused: ${decodeURIComponent(songName)}`;
        const playPauseBtn = document.getElementById('play-pause-btn');
        if (playPauseBtn) {
            playPauseBtn.textContent = '▶ Play';
            playPauseBtn.style.backgroundColor = 'var(--primary-color, #2c4c7c)';
            playPauseBtn.onmouseover = () => playPauseBtn.style.backgroundColor = 'var(--secondary-color, #0c4061)';
            playPauseBtn.onmouseout = () => playPauseBtn.style.backgroundColor = 'var(--primary-color, #2c4c7c)';
        }
    }
}

// Helper function for 'ended' event listener
function handleSongEnded() {
    console.log('Song ended, playing next...');
    // Ensure the current song path is removed from lastPlayedSongs if it was the only one.
    // This is generally handled by push/shift in playRandomSong, but good to be explicit.
    setTimeout(playRandomSong, 500);
}


// Fade effects
function fadeOut(audio, callback) {
    const fadeSteps = 20;
    const stepTime = config.fadeDuration / fadeSteps;
    const initialVolume = audio.volume;
    const stepVolume = initialVolume / fadeSteps; // Calculate step volume based on current volume

    let currentStep = 0;
    const fadeInterval = setInterval(() => {
        currentStep++;
        const newVolume = initialVolume - (stepVolume * currentStep);
        if (newVolume > 0) {
            audio.volume = newVolume;
        } else {
            audio.volume = 0;
            audio.pause();
            clearInterval(fadeInterval);
            if (callback) callback();
        }
    }, stepTime);
}

function fadeIn(audio) {
    const fadeSteps = 20;
    const stepTime = config.fadeDuration / fadeSteps;
    const targetVolume = config.volume; // Use the configured volume as the target
    const stepVolume = targetVolume / fadeSteps;
    audio.volume = 0;

    let currentStep = 0;
    const fadeInterval = setInterval(() => {
        currentStep++;
        const newVolume = stepVolume * currentStep;
        if (newVolume < targetVolume) {
            audio.volume = newVolume;
        } else {
            audio.volume = targetVolume;
            clearInterval(fadeInterval);
        }
    }, stepTime);
}

// --- Persistence Functions ---
function savePlayerState() {
    if (!config.persistence.enabled) return;

    const state = {
        currentSong: audioPlayer.src,
        currentTime: audioPlayer.currentTime,
        volume: audioPlayer.volume,
        isPlaying: !audioPlayer.paused,
        configVolume: config.volume, // Save the user's preferred max volume
        normalizationEnabled: config.normalization.enabled,
        targetLoudness: config.normalization.targetLoudness
    };
    try {
        localStorage.setItem(config.persistence.localStorageKey, JSON.stringify(state));
        console.log('💾 Player state saved:', state);
    } catch (e) {
        console.error('Error saving player state to localStorage:', e);
    }
}

function loadPlayerState() {
    if (!config.persistence.enabled) return;

    try {
        const savedStateString = localStorage.getItem(config.persistence.localStorageKey);
        if (savedStateString) {
            savedPlaybackState = JSON.parse(savedStateString);
            config.volume = savedPlaybackState.configVolume || config.volume;
            config.normalization.enabled = savedPlaybackState.normalizationEnabled !== undefined ? savedPlaybackState.normalizationEnabled : config.normalization.enabled;
            config.normalization.targetLoudness = savedPlaybackState.targetLoudness || config.normalization.targetLoudness;

            audioPlayer.volume = savedPlaybackState.volume; // Apply initial volume

            // Update UI elements from loaded config
            const volumeSlider = document.getElementById('volume-slider');
            const volumeDisplay = document.getElementById('volume-display');
            if (volumeSlider) volumeSlider.value = config.volume;
            if (volumeDisplay) volumeDisplay.textContent = `${Math.round(config.volume * 100)}%`;

            const normToggle = document.getElementById('normalization-toggle');
            const normStatus = document.getElementById('norm-status');
            if (normToggle) normToggle.checked = config.normalization.enabled;
            if (normStatus) {
                normStatus.textContent = `(${config.normalization.enabled ? 'On' : 'Off'})`;
                normStatus.style.color = config.normalization.enabled ? 'var(--success-color, #2e8b34)' : 'var(--warning-color, #e65100)';
            }

            const targetLufsInput = document.getElementById('target-lufs');
            if (targetLufsInput) targetLufsInput.value = config.normalization.targetLoudness;


            console.log('✅ Player state loaded:', savedPlaybackState);
        }
    } catch (e) {
        console.error('Error loading player state from localStorage:', e);
        savedPlaybackState = null; // Clear corrupted state
    }
}

function saveNormalizationCache() {
    if (!config.persistence.enabled || !config.normalization.cache) return;
    try {
        // Convert Map to array of [key, value] pairs for JSON stringification
        const cacheArray = Array.from(normalizationCache.entries());
        localStorage.setItem(config.persistence.normalizationCacheKey, JSON.stringify(cacheArray));
        console.log('💾 Normalization cache saved.');
    } catch (e) {
        console.error('Error saving normalization cache to localStorage:', e);
    }
}

function loadNormalizationCache() {
    if (!config.persistence.enabled || !config.normalization.cache) return;
    try {
        const cachedData = localStorage.getItem(config.persistence.normalizationCacheKey);
        if (cachedData) {
            const cacheArray = JSON.parse(cachedData);
            normalizationCache = new Map(cacheArray); // Reconstruct Map
            console.log('✅ Normalization cache loaded with', normalizationCache.size, 'entries.');
        }
    } catch (e) {
        console.error('Error loading normalization cache from localStorage:', e);
        normalizationCache = new Map(); // Clear corrupted cache
    }
}


// Manual controls
window.lofi = {
    skip: playRandomSong,
    stop: () => {
        audioPlayer.pause();
        isPlaying = false; // Player is intentionally paused
        console.log('⏹ Stopped');
        // Update UI
        const nowPlayingDiv = document.getElementById('now-playing');
        if (nowPlayingDiv) nowPlayingDiv.textContent = 'Paused.';
        const playPauseBtn = document.getElementById('play-pause-btn');
        if (playPauseBtn) {
            playPauseBtn.textContent = '▶ Play';
            playPauseBtn.style.backgroundColor = 'var(--primary-color, #2c4c7c)';
            playPauseBtn.onmouseover = () => playPauseBtn.style.backgroundColor = 'var(--secondary-color, #0c4061)';
            playPauseBtn.onmouseout = () => playPauseBtn.style.backgroundColor = 'var(--primary-color, #2c4c7c)';
        }
    },
    start: () => {
        // This will attempt to play/resume based on current audioPlayer state or saved state
        startPlayback();
    },
    volume: (v) => {
        config.volume = Math.max(0, Math.min(1, v));
        audioPlayer.volume = config.volume;
        console.log('🔊 Volume set to:', Math.round(config.volume * 100) + '%');
        // Update UI
        const volumeSlider = document.getElementById('volume-slider');
        const volumeDisplay = document.getElementById('volume-display');
        if (volumeSlider) volumeSlider.value = config.volume;
        if (volumeDisplay) volumeDisplay.textContent = `${Math.round(config.volume * 100)}%`;
    },
    list: () => {
        console.log('Current playlist:', songList);
        console.log('Recently played:', lastPlayedSongs);
    },
    clearHistory: () => {
        lastPlayedSongs = [];
        console.log('🔄 Cleared play history');
    },
    // New normalization controls
    toggleNormalization: () => {
        config.normalization.enabled = !config.normalization.enabled;
        console.log('🎚️ Normalization:', config.normalization.enabled ? 'enabled' : 'disabled');
        // Update UI
        const normToggle = document.getElementById('normalization-toggle');
        const normStatus = document.getElementById('norm-status');
        if (normToggle) normToggle.checked = config.normalization.enabled;
        if (normStatus) {
            normStatus.textContent = `(${config.normalization.enabled ? 'On' : 'Off'})`;
            normStatus.style.color = config.normalization.enabled ? 'var(--success-color, #2e8b34)' : 'var(--warning-color, #e65100)';
        }
    },
    clearNormalizationCache: () => {
        normalizationCache.clear();
        saveNormalizationCache(); // Also save empty cache
        console.log('🗑️ Normalization cache cleared');
    },
    setTargetLoudness: (lufs) => {
        config.normalization.targetLoudness = Math.max(-40, Math.min(-10, lufs));
        console.log('🎯 Target loudness set to:', config.normalization.targetLoudness, 'LUFS');
        // Update UI
        const targetLufsInput = document.getElementById('target-lufs');
        if (targetLufsInput) targetLufsInput.value = config.normalization.targetLoudness;
    },
    showNormalizationCache: () => {
        console.log('📊 Normalization cache:');
        if (normalizationCache.size === 0) {
            console.log('   (Cache is empty)');
        } else {
            normalizationCache.forEach((gain, song) => {
                console.log(`  ${song}: ${gain.toFixed(2)}x`);
            });
        }
    },
    // New persistence control
    togglePersistence: () => {
        config.persistence.enabled = !config.persistence.enabled;
        console.log('💾 Persistence:', config.persistence.enabled ? 'enabled' : 'disabled');
        if (!config.persistence.enabled) {
            localStorage.removeItem(config.persistence.localStorageKey);
            localStorage.removeItem(config.persistence.normalizationCacheKey);
            console.log('🗑️ All player persistence data cleared from localStorage.');
        }
        // Update UI if a toggle button is added for persistence
    }
};

console.log('🎧 Lofi Player with Normalization and Persistence loaded');
console.log('Manual controls: lofi.skip(), lofi.stop(), lofi.volume(0.5), lofi.list(), lofi.clearHistory()');
console.log('Normalization: lofi.toggleNormalization(), lofi.clearNormalizationCache(), lofi.setTargetLoudness(-23)');
console.log('Persistence: lofi.togglePersistence()');
console.log('📊 Current normalization target:', config.normalization.targetLoudness, 'LUFS');


// --- Modal Creation and Control ---

// Create the floating icon
function createFloatingIcon() {
    const icon = document.createElement('div');
    icon.id = 'lofi-player-icon';
    icon.style.position = 'fixed';
    icon.style.bottom = '20px';
    icon.style.left = '20px';
    icon.style.backgroundColor = 'var(--primary-color, #2c4c7c)';
    icon.style.color = 'var(--light-color, #f4f8fc)';
    icon.style.borderRadius = '50%';
    icon.style.width = '50px';
    icon.style.height = '50px';
    icon.style.display = 'flex';
    icon.style.justifyContent = 'center';
    icon.style.alignItems = 'center';
    icon.style.cursor = 'pointer';
    icon.style.zIndex = '1000';
    icon.style.fontFamily = 'monospace';
    icon.style.fontSize = '24px';
    icon.textContent = '🎧'; // Headphones emoji
    icon.title = 'Open Lofi Player Controls';

    document.body.appendChild(icon);

    icon.addEventListener('click', toggleModal);
}

// Create the modal
function createLofiModal() {
    const modal = document.createElement('div');
    modal.id = 'lofi-player-modal';
    modal.style.position = 'fixed';
    modal.style.bottom = '90px'; // Above the icon
    modal.style.left = '20px';

    modal.style.width = 'auto';
    modal.style.height = 'auto';
    modal.style.minWidth = '280px';
    modal.style.maxWidth = '90vw';
    modal.style.maxHeight = '80vh';
    modal.style.overflowY = 'auto';
    modal.style.overflowX = 'hidden';
    modal.style.boxSizing = 'border-box';

    modal.style.backgroundColor = 'var(--dark-color, #0e1827)';
    modal.style.color = 'var(--light-color, #f4f8fc)';
    modal.style.borderRadius = '10px';
    modal.style.boxShadow = '0 5px 15px rgba(0, 0, 0, 0.5)';
    modal.style.zIndex = '1001';
    modal.style.padding = '15px';
    modal.style.fontFamily = 'Arial, sans-serif';
    modal.style.display = 'none'; // Hidden by default
    modal.style.flexDirection = 'column';
    modal.style.gap = '10px';


    // Make modal draggable
    let isDragging = false;
    let offsetX, offsetY;

    modal.addEventListener('mousedown', (e) => {
        // Only drag from modal header or direct modal background (not children)
        if (e.target === modal || e.target.closest('#modal-header') === e.target) {
            isDragging = true;
            offsetX = e.clientX - modal.getBoundingClientRect().left;
            offsetY = e.clientY - modal.getBoundingClientRect().top;
            modal.style.cursor = 'grabbing';
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        // Ensure modal stays within viewport bounds
        let newLeft = e.clientX - offsetX;
        let newTop = e.clientY - offsetY;

        // Clamp to window edges
        newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - modal.offsetWidth));
        newTop = Math.max(0, Math.min(newTop, window.innerHeight - modal.offsetHeight));

        modal.style.left = `${newLeft}px`;
        modal.style.top = `${newTop}px`;
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
        modal.style.cursor = 'grab';
    });


    // Modal Header
    const modalHeader = document.createElement('div');
    modalHeader.id = 'modal-header';
    modalHeader.style.display = 'flex';
    modalHeader.style.justifyContent = 'space-between';
    modalHeader.style.alignItems = 'center';
    modalHeader.style.paddingBottom = '10px';
    modalHeader.style.borderBottom = '1px solid var(--primary-color, #2c4c7c)';
    modalHeader.style.marginBottom = '10px';
    modalHeader.style.cursor = 'grab'; // Indicate draggable
    modalHeader.innerHTML = `
        <h3 style="margin: 0; color: var(--tertiary-color, #0d9edb);">Lofi Player</h3>
        <span id="close-modal" style="cursor: pointer; font-size: 20px; color: var(--light-color, #f4f8fc);">&times;</span>
    `;
    modal.appendChild(modalHeader);

    modalHeader.querySelector('#close-modal').addEventListener('click', toggleModal);


    // Now Playing display
    const nowPlayingDiv = document.createElement('div');
    nowPlayingDiv.id = 'now-playing';
    nowPlayingDiv.style.fontWeight = 'bold';
    nowPlayingDiv.style.marginBottom = '10px';
    nowPlayingDiv.style.color = 'rgba(var(--light-color-r, 244), var(--light-color-g, 248), var(--light-color-b, 252), 0.8)';
    nowPlayingDiv.style.wordBreak = 'break-word'; // Ensures long song names wrap to prevent overflow
    nowPlayingDiv.textContent = 'Not playing...';
    modal.appendChild(nowPlayingDiv);

    // Controls Container
    const controlsContainer = document.createElement('div');
    controlsContainer.style.display = 'grid';
    controlsContainer.style.gridTemplateColumns = '1fr 1fr';
    controlsContainer.style.gap = '8px';
    modal.appendChild(controlsContainer);

    // Play/Pause Button
    const playPauseBtn = createButton('▶ Play', () => {
        if (audioPlayer.paused) { // Check actual audio player state
            lofi.start(); // This will handle resuming if there's a saved state
        } else {
            lofi.stop();
        }
    }, 'var(--primary-color, #2c4c7c)'); // Default button color
    playPauseBtn.id = 'play-pause-btn';
    controlsContainer.appendChild(playPauseBtn);

    // Skip Button
    const skipBtn = createButton('⏭ Skip', lofi.skip, 'var(--primary-color, #2c4c7c)'); // Default button color
    controlsContainer.appendChild(skipBtn);

    // Volume Slider
    const volumeDiv = document.createElement('div');
    volumeDiv.style.gridColumn = '1 / -1'; // Span two columns
    volumeDiv.style.display = 'flex';
    volumeDiv.style.alignItems = 'center';
    volumeDiv.style.gap = '10px';
    volumeDiv.innerHTML = `
        <label for="volume-slider" style="white-space: nowrap;">Volume:</label>
        <input type="range" id="volume-slider" min="0" max="1" step="0.01" value="${config.volume}" style="width: 100%;">
        <span id="volume-display">${Math.round(config.volume * 100)}%</span>
    `;
    modal.appendChild(volumeDiv);

    const volumeSlider = volumeDiv.querySelector('#volume-slider');
    const volumeDisplay = volumeDiv.querySelector('#volume-display');
    volumeSlider.style.accentColor = 'var(--tertiary-color, #0d9edb)';
    volumeSlider.style.backgroundColor = 'var(--secondary-color, #0c4061)';
    volumeDisplay.style.color = 'var(--light-color, #f4f8fc)';

    volumeSlider.addEventListener('input', (e) => {
        lofi.volume(parseFloat(e.target.value));
        volumeDisplay.textContent = `${Math.round(e.target.value * 100)}%`;
    });

    // Normalization Section
    const normalizationSection = document.createElement('div');
    normalizationSection.style.borderTop = '1px solid var(--primary-color, #2c4c7c)';
    normalizationSection.style.paddingTop = '10px';
    normalizationSection.style.marginTop = '10px';
    normalizationSection.style.display = 'flex';
    normalizationSection.style.flexDirection = 'column';
    normalizationSection.style.gap = '8px';
    modal.appendChild(normalizationSection);

    // Normalization Toggle
    const normToggleDiv = document.createElement('div');
    normToggleDiv.style.display = 'flex';
    normToggleDiv.style.alignItems = 'center';
    normToggleDiv.style.gap = '5px';
    normToggleDiv.innerHTML = `
        <input type="checkbox" id="normalization-toggle" ${config.normalization.enabled ? 'checked' : ''}>
        <label for="normalization-toggle">Normalize Audio</label>
        <span id="norm-status" style="font-size: 0.8em; color: ${config.normalization.enabled ? 'var(--success-color, #2e8b34)' : 'var(--warning-color, #e65100)'};">(${config.normalization.enabled ? 'On' : 'Off'})</span>
    `;
    normalizationSection.appendChild(normToggleDiv);

    const normToggle = normToggleDiv.querySelector('#normalization-toggle');
    const normStatus = normToggleDiv.querySelector('#norm-status');
    normToggle.style.accentColor = 'var(--tertiary-color, #0d9edb)';
    normToggle.style.color = 'var(--light-color, #f4f8fc)';
    normToggleDiv.querySelector('label').style.color = 'var(--light-color, #f4f8fc)';

    normToggle.addEventListener('change', () => {
        lofi.toggleNormalization();
        normStatus.textContent = `(${config.normalization.enabled ? 'On' : 'Off'})`;
        normStatus.style.color = config.normalization.enabled ? 'var(--success-color, #2e8b34)' : 'var(--warning-color, #e65100)';
    });

    // Target Loudness Input
    const targetLoudnessDiv = document.createElement('div');
    targetLoudnessDiv.style.display = 'flex';
    targetLoudnessDiv.style.alignItems = 'center';
    targetLoudnessDiv.style.gap = '5px';
    targetLoudnessDiv.innerHTML = `
        <label for="target-lufs">Target LUFS:</label>
        <input type="number" id="target-lufs" value="${config.normalization.targetLoudness}" min="-40" max="-10" step="1" style="width: 70px; padding: 5px; border-radius: 4px; border: 1px solid var(--primary-color, #2c4c7c); background-color: var(--secondary-color, #0c4061); color: var(--light-color, #f4f8fc);">
    `;
    normalizationSection.appendChild(targetLoudnessDiv);

    targetLoudnessDiv.querySelector('label').style.color = 'var(--light-color, #f4f8fc)';
    const targetLufsInput = targetLoudnessDiv.querySelector('#target-lufs');
    targetLufsInput.addEventListener('change', (e) => {
        lofi.setTargetLoudness(parseInt(e.target.value));
    });

    // Logout and Clear Local Cache Button
    const logoutClearCacheBtn = createButton('Log out of quiz user account', () => {
        if (confirm('Are you sure you want to log out? This will log you out.')) {
            localStorage.clear();
            alert('Local cache cleared. Please refresh the page.');
            // Optionally, reload the page to apply a clean state
            window.location.reload();
        }
    }, 'var(--danger-color, #d32f2f)');
    normalizationSection.appendChild(logoutClearCacheBtn);


    document.body.appendChild(modal);

    // Update now playing song display
    audioPlayer.addEventListener('playing', () => {
        const currentSong = audioPlayer.src.split('/').pop().split('?')[0];
        nowPlayingDiv.textContent = `Now Playing: ${decodeURIComponent(currentSong)}`;
        playPauseBtn.textContent = '⏸ Pause';
        playPauseBtn.style.backgroundColor = 'var(--tertiary-color, #0d9edb)';
        playPauseBtn.onmouseover = () => playPauseBtn.style.backgroundColor = 'var(--info-color, #0d61aa)';
        playPauseBtn.onmouseout = () => playPauseBtn.style.backgroundColor = 'var(--tertiary-color, #0d9edb)';
    });

    audioPlayer.addEventListener('pause', () => {
        nowPlayingDiv.textContent = 'Paused.';
        playPauseBtn.textContent = '▶ Play';
        playPauseBtn.style.backgroundColor = 'var(--primary-color, #2c4c7c)';
        playPauseBtn.onmouseover = () => playPauseBtn.style.backgroundColor = 'var(--secondary-color, #0c4061)';
        playPauseBtn.onmouseout = () => playPauseBtn.style.backgroundColor = 'var(--primary-color, #2c4c7c)';
    });

    audioPlayer.addEventListener('ended', () => {
        nowPlayingDiv.textContent = 'Loading next...';
    });

    // Initial UI update based on loaded state (if any)
    if (savedPlaybackState) {
        if (savedPlaybackState.currentSong) {
            const savedSongName = savedPlaybackState.currentSong.split('/').pop().split('?')[0];
            nowPlayingDiv.textContent = savedPlaybackState.isPlaying ? `Now Playing: ${decodeURIComponent(savedSongName)}` : `Paused: ${decodeURIComponent(savedSongName)}`;
        }
        if (savedPlaybackState.isPlaying) {
            playPauseBtn.textContent = '⏸ Pause';
            playPauseBtn.style.backgroundColor = 'var(--tertiary-color, #0d9edb)';
            playPauseBtn.onmouseover = () => playPauseBtn.style.backgroundColor = 'var(--info-color, #0d61aa)';
            playPauseBtn.onmouseout = () => playPauseBtn.style.backgroundColor = 'var(--tertiary-color, #0d9edb)';
        } else {
            playPauseBtn.textContent = '▶ Play';
            playPauseBtn.style.backgroundColor = 'var(--primary-color, #2c4c7c)';
            playPauseBtn.onmouseover = () => playPauseBtn.style.backgroundColor = 'var(--secondary-color, #0c4061)';
            playPauseBtn.onmouseout = () => playPauseBtn.style.backgroundColor = 'var(--primary-color, #2c4c7c)';
        }
    }
}

// Helper to create buttons
function createButton(text, onClickHandler, bgColor) {
    const button = document.createElement('button');
    button.textContent = text;
    button.style.backgroundColor = bgColor;
    button.style.color = 'var(--light-color, #f4f8fc)';
    button.style.border = 'none';
    button.style.padding = '8px 12px';
    button.style.borderRadius = '5px';
    button.style.cursor = 'pointer';
    button.style.fontSize = '14px';
    button.style.transition = 'background-color 0.2s';

    let baseColorValue = getComputedStyle(document.documentElement).getPropertyValue(bgColor.replace('var(', '').replace(')', '').split(',')[0].trim());
    if (!baseColorValue || baseColorValue.trim() === '') {
        baseColorValue = bgColor.replace('var(', '').replace(')', '').split(',')[1].trim();
    }

    button.addEventListener('mouseover', () => {
        let hoverColor = darkenColor(baseColorValue, 10);
        button.style.backgroundColor = hoverColor;
    });
    button.addEventListener('mouseout', () => button.style.backgroundColor = bgColor);
    button.addEventListener('click', onClickHandler);
    return button;
}

// Helper function to darken a hex or rgb color
function darkenColor(color, percent) {
    if (color.startsWith('rgb')) {
        const rgb = color.match(/\d+/g).map(Number);
        const r = Math.max(0, rgb[0] - percent);
        const g = Math.max(0, rgb[1] - percent);
        const b = Math.max(0, rgb[2] - percent);
        return `rgb(${r}, ${g}, ${b})`;
    } else {
        let f = parseInt(color.slice(1), 16),
            t = percent < 0 ? 0 : 255,
            p = percent < 0 ? percent * -1 : percent / 100, // Corrected percentage calculation for hex
            R = f >> 16,
            G = (f >> 8) & 0x00ff,
            B = f & 0x0000ff;
        return "#" + (
            0x1000000 +
            (Math.round((t - R) * p) + R) * 0x10000 +
            (Math.round((t - G) * p) + G) * 0x100 +
            (Math.round((t - B) * p) + B)
        ).toString(16).slice(1);
    }
}


// Toggle modal visibility
function toggleModal() {
    const modal = document.getElementById('lofi-player-modal');
    const icon = document.getElementById('lofi-player-icon');
    if (modal.style.display === 'none' || modal.style.display === '') {
        modal.style.display = 'flex';
        icon.style.display = 'none'; // Hide icon when modal is open
    } else {
        modal.style.display = 'none';
        icon.style.display = 'flex'; // Show icon when modal is closed
    }
}

// Dynamically add the CSS variables if they are not already present in your main CSS
const style = document.createElement('style');
style.innerHTML = `
    :root {
        --primary-color: #2c4c7c;
        --secondary-color: #0c4061;
        --tertiary-color: #0d9edb;
        --dark-color: #0e1827;
        --light-color: #f4f8fc;
        --success-color: #2e8b34;
        --danger-color: #d32f2f;
        --warning-color: #e65100;
        --info-color: #0d61aa;
    }

    /* Basic slider styling for better appearance (hard to do with inline JS) */
    #lofi-player-modal input[type="range"] {
        -webkit-appearance: none; /* Override default */
        appearance: none;
        height: 8px;
        background: var(--secondary-color, #0c4061);
        outline: none;
        border-radius: 5px;
        cursor: pointer;
        box-shadow: inset 0 0 5px rgba(0,0,0,0.3);
    }

    #lofi-player-modal input[type="range"]::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: var(--tertiary-color, #0d9edb);
        cursor: grab;
        margin-top: -6px; /* Center thumb vertically */
        box-shadow: 0 0 5px rgba(0,0,0,0.5);
    }

    #lofi-player-modal input[type="range"]::-moz-range-thumb {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: var(--tertiary-color, #0d9edb);
        cursor: grab;
        box-shadow: 0 0 5px rgba(0,0,0,0.5);
    }

    #lofi-player-modal input[type="range"]::-webkit-slider-runnable-track {
            background: var(--secondary-color, #0c4061);
            border-radius: 5px;
    }

    #lofi-player-modal input[type="range"]::-moz-range-track {
        background: var(--secondary-color, #0c4061);
        border-radius: 5px;
    }
`;
document.head.appendChild(style);