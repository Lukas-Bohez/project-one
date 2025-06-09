// Simple Random Lofi Player - Enhanced with Shuffle and Repeat Modes
// Configuration
const config = {
    folder: '../lofi/', // Path from js/ to lofi/
    volume: 0.2,
    fadeDuration: 500, // Reduced from 1000ms to 500ms for faster transitions
    shuffle: true, // Default shuffle mode (true = random, false = sequential)
    repeat: false, // Repeat mode: false, 'one', or 'all'
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
let shuffledPlaylist = []; // For shuffle mode
let isPlaying = false; // Tracks if the player *should* be playing (can be paused)
let lastPlayedSongs = []; // Track recently played songs
let currentSongIndex = -1; // Current position in playlist
let currentPlaylistIndex = -1; // Current position in shuffled playlist (for shuffle mode)
let normalizationCache = new Map(); // Cache for normalization data

// --- Persistence Variables ---
let savedPlaybackState = null; // To hold state loaded from localStorage

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('Lofi player ready - starting automatically...');

    // Load persisted state if persistence is enabled
    if (config.persistence.enabled) {
        loadPlayerState();
        loadNormalizationCache();
    }

    // Initialize UI elements
    createFloatingIcon();
    createLofiModal();

    // Try to start immediately without waiting for user interaction
    tryAutoStart();

    // Save state before leaving the page
    window.addEventListener('beforeunload', savePlayerState);
});

// Try to auto-start playback
const tryAutoStart = () => {
    // Try to start playback immediately
    startPlayback();
    
    // If that fails due to autoplay restrictions, set up click listener
    audioPlayer.addEventListener('error', () => {
        console.log('Auto-start failed, click anywhere to start');
        document.addEventListener('click', startPlayback, { once: true });
        document.addEventListener('keydown', startPlayback, { once: true });
    });
};

// Initial resume attempt, triggered by first user gesture
const initialResumeAttempt = () => {
    if (savedPlaybackState && savedPlaybackState.isPlaying) {
        // This will trigger the full resume flow
        startPlayback();
    } else {
        // If no active saved state, proceed with normal start
        startPlayback();
    }
};

// Initialize Web Audio API
const initializeAudioContext = () => {
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
};

// Calculate RMS (Root Mean Square) for loudness estimation
const calculateRMS = (audioBuffer) => {
    const channelData = audioBuffer.getChannelData(0);
    let sum = 0;

    for (let i = 0; i < channelData.length; i++) {
        sum += channelData[i] * channelData[i];
    }

    return Math.sqrt(sum / channelData.length);
};

// Analyze audio loudness using Web Audio API
const analyzeAudioLoudness = (audioElement, duration = config.normalization.analysisTime) => {
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
};

// Create shuffled playlist
const createShuffledPlaylist = () => {
    shuffledPlaylist = [...songList];
    
    // Fisher-Yates shuffle algorithm
    for (let i = shuffledPlaylist.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledPlaylist[i], shuffledPlaylist[j]] = [shuffledPlaylist[j], shuffledPlaylist[i]];
    }
    
    currentPlaylistIndex = 0;
    console.log('🔀 Created shuffled playlist:', shuffledPlaylist);
};

// Get next song based on current mode
const getNextSong = () => {
    if (songList.length === 0) return null;

    if (config.shuffle) {
        // Shuffle mode - use shuffled playlist
        if (shuffledPlaylist.length === 0 || currentPlaylistIndex >= shuffledPlaylist.length) {
            // Create new shuffled playlist or restart
            if (config.repeat === 'all' || shuffledPlaylist.length === 0) {
                createShuffledPlaylist();
            } else if (config.repeat === false) {
                // End of playlist, no repeat
                return null;
            }
        }
        
        if (currentPlaylistIndex < shuffledPlaylist.length) {
            const song = shuffledPlaylist[currentPlaylistIndex];
            currentPlaylistIndex++;
            return song;
        }
    } else {
        // Sequential mode
        if (currentSongIndex === -1) {
            // First song
            currentSongIndex = 0;
        } else {
            currentSongIndex++;
            
            if (currentSongIndex >= songList.length) {
                if (config.repeat === 'all') {
                    currentSongIndex = 0; // Restart playlist
                } else if (config.repeat === false) {
                    // End of playlist
                    return null;
                } else {
                    currentSongIndex = songList.length - 1; // Stay on last song for 'one' mode
                }
            }
        }
        
        return songList[currentSongIndex];
    }
    
    return null;
};

// Get previous song based on current mode
const getPreviousSong = () => {
    if (songList.length === 0) return null;

    if (config.shuffle) {
        // In shuffle mode, go back in shuffled playlist
        if (currentPlaylistIndex > 1) {
            currentPlaylistIndex -= 2; // Go back 2 because getNextSong will increment
            return getNextSong();
        } else {
            // At beginning of shuffled playlist
            if (config.repeat === 'all') {
                currentPlaylistIndex = shuffledPlaylist.length - 1;
                return shuffledPlaylist[currentPlaylistIndex - 1] || shuffledPlaylist[shuffledPlaylist.length - 1];
            }
            return shuffledPlaylist[0];
        }
    } else {
        // Sequential mode
        if (currentSongIndex > 0) {
            currentSongIndex--;
        } else if (config.repeat === 'all') {
            currentSongIndex = songList.length - 1; // Go to last song
        } else {
            currentSongIndex = 0; // Stay at first song
        }
        
        return songList[currentSongIndex];
    }
};

// Main playback starter
const startPlayback = () => {
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
                
                // Initialize playlist based on shuffle mode
                if (config.shuffle) {
                    createShuffledPlaylist();
                }
                
                handleInitialSongLoad();
                isPlaying = true;
            } else {
                // Fallback to manual list
                if (manualSongList.length > 0) {
                    console.log('📝 Using manual song list:', manualSongList);
                    songList = [...manualSongList];
                    
                    // Initialize playlist based on shuffle mode
                    if (config.shuffle) {
                        createShuffledPlaylist();
                    }
                    
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
                
                // Initialize playlist based on shuffle mode
                if (config.shuffle) {
                    createShuffledPlaylist();
                }
                
                handleInitialSongLoad();
                isPlaying = true;
            } else {
                console.error('❌ No fallback available. Add songs to manualSongList array.');
            }
        });
};

// Handles loading the first song, either from persistence or based on mode
const handleInitialSongLoad = () => {
    if (config.persistence.enabled && savedPlaybackState && savedPlaybackState.currentSong) {
        const savedSongName = savedPlaybackState.currentSong.split('/').pop().split('?')[0];
        const fullSavedPath = config.folder + savedSongName; // Reconstruct full path
        console.log(`Attempting to load saved song: ${savedSongName} at ${savedPlaybackState.currentTime.toFixed(1)}s`);
        
        // Set current indices based on saved song
        const savedIndex = songList.indexOf(savedSongName);
        if (savedIndex !== -1) {
            currentSongIndex = savedIndex;
            if (config.shuffle && shuffledPlaylist.length > 0) {
                const shuffledIndex = shuffledPlaylist.indexOf(savedSongName);
                if (shuffledIndex !== -1) {
                    currentPlaylistIndex = shuffledIndex + 1; // +1 because it will be used for next song
                }
            }
        }
        
        loadAndPlay(fullSavedPath, savedSongName, savedPlaybackState.currentTime, savedPlaybackState.volume, savedPlaybackState.isPlaying);
        // Clear saved state after attempting to load it
        savedPlaybackState = null;
    } else {
        playNextSong(); // Use the new mode-aware function
    }
};

// Scan folder for audio files (MP3 and WAV)
const scanFolderForMP3s = async () => {
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
};

// Play next song with mode awareness
const playNextSong = () => {
    if (songList.length === 0) {
        console.log('No songs available');
        return;
    }

    // Handle repeat one mode
    if (config.repeat === 'one' && !audioPlayer.paused && audioPlayer.src) {
        // Repeat current song
        audioPlayer.currentTime = 0;
        console.log('🔂 Repeating current song');
        return;
    }

    const nextSong = getNextSong();
    
    if (!nextSong) {
        console.log('📻 End of playlist reached');
        isPlaying = false;
        // Update UI
        const nowPlayingDiv = document.getElementById('now-playing');
        if (nowPlayingDiv) nowPlayingDiv.textContent = 'Playlist ended.';
        const playPauseBtn = document.getElementById('play-pause-btn');
        if (playPauseBtn) {
            playPauseBtn.textContent = '▶ Play';
            playPauseBtn.style.backgroundColor = 'var(--primary-color, #2c4c7c)';
        }
        return;
    }

    const songPath = config.folder + nextSong;

    console.log('▶ Playing:', nextSong, `(${config.shuffle ? 'shuffle' : 'sequential'} mode)`);

    // Fade out current song if playing
    if (!audioPlayer.paused) {
        fadeOut(audioPlayer, () => {
            loadAndPlay(songPath, nextSong);
        });
    } else {
        loadAndPlay(songPath, nextSong);
    }
};

// Play previous song
const playPreviousSong = () => {
    if (songList.length === 0) {
        console.log('No songs available');
        return;
    }

    const previousSong = getPreviousSong();
    
    if (!previousSong) {
        console.log('📻 At beginning of playlist');
        return;
    }

    const songPath = config.folder + previousSong;

    console.log('⏮ Previous:', previousSong, `(${config.shuffle ? 'shuffle' : 'sequential'} mode)`);

    // Fade out current song if playing
    if (!audioPlayer.paused) {
        fadeOut(audioPlayer, () => {
            loadAndPlay(songPath, previousSong);
        });
    } else {
        loadAndPlay(songPath, previousSong);
    }
};

// Legacy function for compatibility - now uses mode-aware playback
const playRandomSong = () => {
    playNextSong();
};

// Load and play new song with fade in and normalization
const loadAndPlay = (songPath, songName, startTime = 0, initialVolume = 0, shouldPlay = true) => {
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
                
                // Also remove from shuffled playlist
                if (config.shuffle) {
                    shuffledPlaylist = shuffledPlaylist.filter(song => song !== songName);
                    // Adjust current index if needed
                    if (currentPlaylistIndex > 0) currentPlaylistIndex--;
                }
                
                // Remove from normalization cache
                normalizationCache.delete(cacheKey);
                console.log('Removed failed song, remaining:', songList.length);

                if (songList.length > 0) {
                    setTimeout(playNextSong, 200); // Use mode-aware function
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
};

// Helper function for 'ended' event listener
const handleSongEnded = () => {
    console.log('Song ended, playing next...');
    // Reduced delay from 500ms to 100ms for much faster transitions
    setTimeout(playNextSong, 100);
};

// Fade effects
const fadeOut = (audio, callback) => {
    const fadeSteps = 10; // Reduced from 20 to 10 for faster fade
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
};

const fadeIn = (audio) => {
    const fadeSteps = 10; // Reduced from 20 to 10 for faster fade
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
};

const savePlayerState = () => {
    if (!config.persistence.enabled) return;

    const state = {
        currentSong: audioPlayer.src,
        currentTime: audioPlayer.currentTime,
        volume: audioPlayer.volume,
        isPlaying: isPlaying,
        configVolume: config.volume,
        shuffle: config.shuffle,
        repeat: config.repeat,
        currentSongIndex: currentSongIndex,
        currentPlaylistIndex: currentPlaylistIndex,
        normalizationEnabled: config.normalization.enabled,
        targetLoudness: config.normalization.targetLoudness,
        lastUpdated: new Date().toISOString() // Add timestamp for debugging
    };
    
    try {
        localStorage.setItem(config.persistence.localStorageKey, JSON.stringify(state));
        console.log('💾 Player state saved:', state);
    } catch (e) {
        console.error('Error saving player state to localStorage:', e);
    }
};

const loadPlayerState = () => {
    if (!config.persistence.enabled) return;

    try {
        const savedStateString = localStorage.getItem(config.persistence.localStorageKey);
        if (savedStateString) {
            savedPlaybackState = JSON.parse(savedStateString);
            config.volume = savedPlaybackState.configVolume || config.volume;
            config.shuffle = savedPlaybackState.shuffle !== undefined ? savedPlaybackState.shuffle : config.shuffle;
            config.repeat = savedPlaybackState.repeat !== undefined ? savedPlaybackState.repeat : config.repeat;
            currentSongIndex = savedPlaybackState.currentSongIndex || -1;
            currentPlaylistIndex = savedPlaybackState.currentPlaylistIndex || -1;
            config.normalization.enabled = savedPlaybackState.normalizationEnabled !== undefined ? savedPlaybackState.normalizationEnabled : config.normalization.enabled;
            config.normalization.targetLoudness = savedPlaybackState.targetLoudness || config.normalization.targetLoudness;

            audioPlayer.volume = savedPlaybackState.volume; // Apply initial volume

            // Update UI elements from loaded config will be handled by modal script
            console.log('✅ Player state loaded:', savedPlaybackState);
        }
    } catch (e) {
        console.error('Error loading player state from localStorage:', e);
        savedPlaybackState = null; // Clear corrupted state
    }
};

const saveNormalizationCache = () => {
    if (!config.persistence.enabled || !config.normalization.cache) return;
    try {
        // Convert Map to array of [key, value] pairs for JSON stringification
        const cacheArray = Array.from(normalizationCache.entries());
        localStorage.setItem(config.persistence.normalizationCacheKey, JSON.stringify(cacheArray));
        console.log('💾 Normalization cache saved.');
    } catch (e) {
        console.error('Error saving normalization cache to localStorage:', e);
    }
};

const loadNormalizationCache = () => {
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
};

// Manual controls
window.lofi = {
    skip: playNextSong,
    next: playNextSong,
    previous: playPreviousSong,
    stop: () => {
        audioPlayer.pause();
        isPlaying = false; // Player is intentionally pa
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
        // If there's a current song and we're paused, resume it
        if (audioPlayer.src && audioPlayer.paused) {
            audioPlayer.play()
                .then(() => {
                    isPlaying = true;
                    console.log('▶ Resumed playback');
                    // Update UI
                    const nowPlayingDiv = document.getElementById('now-playing');
                    if (nowPlayingDiv) {
                        const currentSong = audioPlayer.src.split('/').pop();
                        nowPlayingDiv.textContent = `Now Playing: ${decodeURIComponent(currentSong)}`;
                    }
                    const playPauseBtn = document.getElementById('play-pause-btn');
                    if (playPauseBtn) {
                        playPauseBtn.textContent = '⏸ Pause';
                        playPauseBtn.style.backgroundColor = 'var(--tertiary-color, #0d9edb)';
                        playPauseBtn.onmouseover = () => playPauseBtn.style.backgroundColor = 'var(--info-color, #0d61aa)';
                        playPauseBtn.onmouseout = () => playPauseBtn.style.backgroundColor = 'var(--tertiary-color, #0d9edb)';
                    }
                })
                .catch(error => {
                    console.error('Error resuming playback:', error);
                    // If resume fails, fall back to playing a new song
                    playRandomSong();
                });
        } else if (!audioPlayer.src || audioPlayer.ended) {
            // If no song is loaded or song has ended, start a new one
            playRandomSong();
        }
        // If already playing, do nothing
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
                console.log(`  ${song}: ${gain.toFixed(2)}x`);
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
    },
};

console.log('🎧 Lofi Player with Normalization and Persistence loaded');
console.log('Manual controls: lofi.skip(), lofi.stop(), lofi.volume(0.5), lofi.list(), lofi.clearHistory()');
console.log('Normalization: lofi.toggleNormalization(), lofi.clearNormalizationCache(), lofi.setTargetLoudness(-23)');
console.log('Persistence: lofi.togglePersistence()');
console.log('📊 Current normalization target:', config.normalization.targetLoudness, 'LUFS');








// --- Modal Creation and Control ---

// Create the floating icon
const createFloatingIcon = () => {
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
};

// Update progress bar
const updateProgressBar = () => {
    const progressBar = document.getElementById('progress-bar');
    const currentTimeSpan = document.getElementById('current-time');
    const durationSpan = document.getElementById('duration');
    
    if (progressBar && currentTimeSpan && durationSpan && audioPlayer) {
        const currentTime = audioPlayer.currentTime || 0;
        const duration = audioPlayer.duration || 0;
        
        if (duration > 0) {
            const progress = (currentTime / duration) * 100;
            progressBar.value = progress;
            currentTimeSpan.textContent = formatTime(currentTime);
            durationSpan.textContent = formatTime(duration);
        }
    }
};

// Format time in MM:SS format
const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Handle progress bar click
const handleProgressBarClick = (e) => {
    const progressBar = e.target;
    const rect = progressBar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = (clickX / rect.width) * 100;
    
    if (audioPlayer && audioPlayer.duration) {
        const newTime = (percentage / 100) * audioPlayer.duration;
        audioPlayer.currentTime = newTime;
        progressBar.value = percentage;
    }
};

// Populate song selector dropdown
const populateSongSelector = () => {
    const songSelector = document.getElementById('song-selector');
    if (songSelector && songList) {
        songSelector.innerHTML = '<option value="">Select a song...</option>';
        
        songList.forEach((song, index) => {
            const option = document.createElement('option');
            option.value = song;
            option.textContent = decodeURIComponent(song);
            songSelector.appendChild(option);
        });
    }
};

// Handle song selection from dropdown
const handleSongSelection = (selectedSong) => {
    if (selectedSong && songList.includes(selectedSong)) {
        const songPath = `${config.folder}${selectedSong}`;
        loadAndPlay(songPath, selectedSong, 0, 0, true);
    }
};

// Toggle shuffle mode
const toggleShuffle = () => {
    config.shuffle = !config.shuffle;
    const shuffleBtn = document.getElementById('shuffle-btn');
    if (shuffleBtn) {
        shuffleBtn.textContent = config.shuffle ? '🔀 Shuffle: On' : '🔀 Shuffle: Off';
        shuffleBtn.style.backgroundColor = config.shuffle ? 'var(--success-color, #2e8b34)' : 'var(--primary-color, #2c4c7c)';
    }
};

// Toggle repeat mode
const toggleRepeat = () => {
    if (!config.repeat) {
        config.repeat = 'one';
    } else if (config.repeat === 'one') {
        config.repeat = 'all';
    } else {
        config.repeat = false;
    }
    
    const repeatBtn = document.getElementById('repeat-btn');
    if (repeatBtn) {
        if (config.repeat === 'one') {
            repeatBtn.textContent = '🔂 Repeat: One';
            repeatBtn.style.backgroundColor = 'var(--info-color, #0d61aa)';
        } else if (config.repeat === 'all') {
            repeatBtn.textContent = '🔁 Repeat: All';
            repeatBtn.style.backgroundColor = 'var(--success-color, #2e8b34)';
        } else {
            repeatBtn.textContent = '🔁 Repeat: Off';
            repeatBtn.style.backgroundColor = 'var(--primary-color, #2c4c7c)';
        }
    }
};

// Create the modal
const createLofiModal = () => {
    const modal = document.createElement('div');
    modal.id = 'lofi-player-modal';
    modal.style.position = 'fixed';
    modal.style.bottom = '90px'; // Above the icon
    modal.style.left = '20px';
    modal.style.width = 'auto';
    modal.style.height = 'auto';
    modal.style.minWidth = '320px';
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
        if (e.target === modal || e.target.closest('#modal-header') === e.target) {
            isDragging = true;
            offsetX = e.clientX - modal.getBoundingClientRect().left;
            offsetY = e.clientY - modal.getBoundingClientRect().top;
            modal.style.cursor = 'grabbing';
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        let newLeft = e.clientX - offsetX;
        let newTop = e.clientY - offsetY;

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
    modalHeader.style.cursor = 'grab';
    modalHeader.innerHTML = `
        <h3 style="margin: 0; color: var(--tertiary-color, #0d9edb);">Lofi Player</h3>
        <span id="close-modal" style="cursor: pointer; font-size: 20px; color: var(--light-color, #f4f8fc);">&times;</span>
    `;
    modal.appendChild(modalHeader);

    modalHeader.querySelector('#close-modal').addEventListener('click', toggleModal);

    // Song Selector
    const songSelectorDiv = document.createElement('div');
    songSelectorDiv.style.marginBottom = '10px';
    songSelectorDiv.innerHTML = `
        <label for="song-selector" style="display: block; margin-bottom: 5px; color: var(--light-color, #f4f8fc);">Select Song:</label>
        <select id="song-selector" style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid var(--primary-color, #2c4c7c); background-color: var(--secondary-color, #0c4061); color: var(--light-color, #f4f8fc);">
            <option value="">Select a song...</option>
        </select>
    `;
    modal.appendChild(songSelectorDiv);

    const songSelector = songSelectorDiv.querySelector('#song-selector');
    songSelector.addEventListener('change', (e) => handleSongSelection(e.target.value));

    // Now Playing display
    const nowPlayingDiv = document.createElement('div');
    nowPlayingDiv.id = 'now-playing';
    nowPlayingDiv.style.fontWeight = 'bold';
    nowPlayingDiv.style.marginBottom = '10px';
    nowPlayingDiv.style.color = 'rgba(var(--light-color-r, 244), var(--light-color-g, 248), var(--light-color-b, 252), 0.8)';
    nowPlayingDiv.style.wordBreak = 'break-word';
    nowPlayingDiv.textContent = 'Not playing...';
    modal.appendChild(nowPlayingDiv);

    // Progress Bar Section
    const progressSection = document.createElement('div');
    progressSection.style.marginBottom = '10px';
    progressSection.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
            <span id="current-time" style="font-size: 0.8em; color: var(--light-color, #f4f8fc);">0:00</span>
            <span id="duration" style="font-size: 0.8em; color: var(--light-color, #f4f8fc);">0:00</span>
        </div>
        <input type="range" id="progress-bar" min="0" max="100" value="0" style="width: 100%; height: 6px; background: var(--secondary-color, #0c4061); outline: none; border-radius: 3px; cursor: pointer;">
    `;
    modal.appendChild(progressSection);

    const progressBar = progressSection.querySelector('#progress-bar');
    progressBar.style.accentColor = 'var(--tertiary-color, #0d9edb)';
    progressBar.addEventListener('click', handleProgressBarClick);

    // Main Controls Container
    const controlsContainer = document.createElement('div');
    controlsContainer.style.display = 'grid';
    controlsContainer.style.gridTemplateColumns = '1fr 1fr 1fr';
    controlsContainer.style.gap = '8px';
    controlsContainer.style.marginBottom = '10px';
    modal.appendChild(controlsContainer);

    // Previous Button
// Previous Button
    const prevBtn = createButton('⏮ Prev', () => {
        window.lofi.previous(); // Use the standardized previous function
    }, 'var(--primary-color, #2c4c7c)');
    controlsContainer.appendChild(prevBtn);

    // Play/Pause Button
    const playPauseBtn = createButton('▶ Play', () => {
        if (audioPlayer.paused) {
            lofi.start();
        } else {
            lofi.stop();
        }
    }, 'var(--primary-color, #2c4c7c)');
    playPauseBtn.id = 'play-pause-btn';
    controlsContainer.appendChild(playPauseBtn);

    // Skip Button
    const skipBtn = createButton('⏭ Skip', lofi.skip, 'var(--primary-color, #2c4c7c)');
    controlsContainer.appendChild(skipBtn);

    // Additional Controls
    const additionalControls = document.createElement('div');
    additionalControls.style.display = 'grid';
    additionalControls.style.gridTemplateColumns = '1fr 1fr';
    additionalControls.style.gap = '8px';
    additionalControls.style.marginBottom = '10px';
    modal.appendChild(additionalControls);

    // Shuffle Button
    const shuffleBtn = createButton('🔀 Shuffle: Off', toggleShuffle, 'var(--primary-color, #2c4c7c)');
    shuffleBtn.id = 'shuffle-btn';
    additionalControls.appendChild(shuffleBtn);

    // Repeat Button
    const repeatBtn = createButton('🔁 Repeat: Off', toggleRepeat, 'var(--primary-color, #2c4c7c)');
    repeatBtn.id = 'repeat-btn';
    additionalControls.appendChild(repeatBtn);

    // Volume Slider
    const volumeDiv = document.createElement('div');
    volumeDiv.style.display = 'flex';
    volumeDiv.style.alignItems = 'center';
    volumeDiv.style.gap = '10px';
    volumeDiv.style.marginBottom = '10px';
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
            window.location.reload();
        }
    }, 'var(--danger-color, #d32f2f)');
    normalizationSection.appendChild(logoutClearCacheBtn);

    document.body.appendChild(modal);

    // Set up event listeners for audio player
    audioPlayer.addEventListener('timeupdate', updateProgressBar);
    audioPlayer.addEventListener('loadedmetadata', () => {
        updateProgressBar();
        populateSongSelector();
    });

    // Update UI based on audio player events
    audioPlayer.addEventListener('playing', () => {
        const currentSong = audioPlayer.src.split('/').pop().split('?')[0];
        nowPlayingDiv.textContent = `Now Playing: ${decodeURIComponent(currentSong)}`;
        playPauseBtn.textContent = '⏸ Pause';
        playPauseBtn.style.backgroundColor = 'var(--tertiary-color, #0d9edb)';
        playPauseBtn.onmouseover = () => playPauseBtn.style.backgroundColor = 'var(--info-color, #0d61aa)';
        playPauseBtn.onmouseout = () => playPauseBtn.style.backgroundColor = 'var(--tertiary-color, #0d9edb)';
        
        // Update song selector
        const songSelector = document.getElementById('song-selector');
        if (songSelector) {
            songSelector.value = decodeURIComponent(currentSong);
        }
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

    // Initialize UI based on saved state
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

    // Populate song selector initially
    populateSongSelector();
};

// Helper to create buttons
const createButton = (text, onClickHandler, bgColor) => {
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
};

// Helper function to darken a hex or rgb color
const darkenColor = (color, percent) => {
    if (color.startsWith('rgb')) {
        const rgb = color.match(/\d+/g).map(Number);
        const r = Math.max(0, rgb[0] - percent);
        const g = Math.max(0, rgb[1] - percent);
        const b = Math.max(0, rgb[2] - percent);
        return `rgb(${r}, ${g}, ${b})`;
    } else {
        let f = parseInt(color.slice(1), 16),
            t = percent < 0 ? 0 : 255,
            p = percent < 0 ? percent * -1 : percent / 100,
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
};

// Toggle modal visibility
const toggleModal = () => {
    const modal = document.getElementById('lofi-player-modal');
    const icon = document.getElementById('lofi-player-icon');
    if (modal.style.display === 'none' || modal.style.display === '') {
        modal.style.display = 'flex';
        icon.style.display = 'none';
    } else {
        modal.style.display = 'none';
        icon.style.display = 'flex';
    }
};

// Enhanced CSS styles
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

    #lofi-player-modal input[type="range"] {
        -webkit-appearance: none;
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
        margin-top: -6px;
        box-shadow: 0 0 5px rgba(0,0,0,0.5);
    }

    #lofi-player-modal input[type="range"]::-moz-range-thumb {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: var(--tertiary-color, #0d9edb);
        cursor: grab;
        box-shadow: 0 0 5px rgba(0,0,0,0.5);
        border: none;
    }

    #lofi-player-modal input[type="range"]::-webkit-slider-runnable-track {
        background: var(--secondary-color, #0c4061);
        border-radius: 5px;
    }

    #lofi-player-modal input[type="range"]::-moz-range-track {
        background: var(--secondary-color, #0c4061);
        border-radius: 5px;
    }

    #progress-bar {
        -webkit-appearance: none;
        appearance: none;
        height: 6px !important;
        background: var(--secondary-color, #0c4061);
        outline: none;
        border-radius: 3px;
        cursor: pointer;
        box-shadow: inset 0 0 3px rgba(0,0,0,0.3);
    }

    #progress-bar::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: var(--tertiary-color, #0d9edb);
        cursor: pointer;
        box-shadow: 0 0 3px rgba(0,0,0,0.5);
    }

    #progress-bar::-moz-range-thumb {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: var(--tertiary-color, #0d9edb);
        cursor: pointer;
        box-shadow: 0 0 3px rgba(0,0,0,0.5);
        border: none;
    }

    #song-selector {
        font-size: 14px;
    }

    #song-selector option {
        background-color: var(--secondary-color, #0c4061);
        color: var(--light-color, #f4f8fc);
    }
`;
document.head.appendChild(style);