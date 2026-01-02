// This script runs in the PAGE context (not extension context)
// It extracts YouTube data and stores it on window object for content script to read

(function() {
  'use strict';
  
  console.log('[Injected] Script started');
  
  // Use a unique property name to store data
  const DATA_KEY = '__YouTubeExtractedData_' + Math.random().toString(36).substr(2, 9);
  console.log('[Injected] Using data key:', DATA_KEY);
  
  // Try to find and use YouTube's decipher function
  function decryptSignatureIfNeeded(format, playerResponse) {
    // If URL exists, no need to decrypt
    if (format.url) {
      return format.url;
    }

    // If no signatureCipher, return null
    if (!format.signatureCipher) {
      return null;
    }

    try {
      // Try to access YouTube's internal decipher function
      // This varies by YouTube version, so we try multiple approaches
      
      // Approach 1: Look for the decipher function in ytplayer
      if (window.ytplayer && window.ytplayer.config && window.ytplayer.config.args) {
        const decipher = window.ytplayer.config.args.get_signature_method || window.ytplayer.decipher;
        if (typeof decipher === 'function') {
          const params = new URLSearchParams(format.signatureCipher);
          const sig = params.get('s');
          const url = decodeURIComponent(params.get('url'));
          const sp = params.get('sp') || 'signature';
          
          if (sig && url) {
            const decryptedSig = decipher(sig);
            return `${url}&${sp}=${encodeURIComponent(decryptedSig)}`;
          }
        }
      }

      // Approach 2: Try to find decipher in window's function registry
      // YouTube often exposes a decipher-like function we can call
      // But exclude built-in functions like btoa, atob, etc.
      const builtins = new Set(['btoa', 'atob', 'encodeURIComponent', 'decodeURIComponent', 'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'escape', 'unescape', 'eval']);
      
      for (const key in window) {
        const fn = window[key];
        if (typeof fn === 'function' && key.length < 5 && !builtins.has(key)) {
          try {
            // Test if this looks like a decipher function by checking behavior
            // YouTube's decipher typically rearranges characters in a string
            const testInput = 'abcdefghij';
            const testOutput = fn(testInput);
            
            // A good decipher will:
            // 1. Return a string
            // 2. Have the same length as input
            // 3. Be different from input
            // 4. Contain all the input characters (rearranged)
            if (typeof testOutput === 'string' && 
                testOutput.length === testInput.length && 
                testOutput !== testInput &&
                testInput.split('').every(c => testOutput.includes(c))) {
              
              // This looks like a decipher! Try the actual signature
              const params = new URLSearchParams(format.signatureCipher);
              const sig = params.get('s');
              const url = decodeURIComponent(params.get('url'));
              const sp = params.get('sp') || 'signature';
              
              if (sig && url) {
                const decryptedSig = fn(sig);
                if (decryptedSig && decryptedSig.length > 0 && decryptedSig.length < sig.length * 2) {
                  console.log('[Injected] Found decipher function:', key);
                  return `${url}&${sp}=${encodeURIComponent(decryptedSig)}`;
                }
              }
            }
          } catch (e) {
            // Not a decipher function, skip
          }
        }
      }

      console.warn('[Injected] Could not find YouTube decipher function');
      return null;
    } catch (e) {
      console.warn('[Injected] Error decrypting signature:', e.message);
      return null;
    }
  }

  function extractStreamingData() {
    try {
      console.log('[Injected] Checking for ytInitialPlayerResponse...');
      console.log('[Injected] window.ytInitialPlayerResponse exists?', !!window.ytInitialPlayerResponse);
      
      if (!window.ytInitialPlayerResponse) {
        console.log('[Injected] ytInitialPlayerResponse not found yet');
        return null;
      }

      console.log('[Injected] Found playerResponse, extracting streamingData...');
      const playerResponse = window.ytInitialPlayerResponse;
      const streamingData = playerResponse?.streamingData;
      
      if (!streamingData) {
        console.log('[Injected] No streamingData in playerResponse');
        return null;
      }

      const streams = {
        video: [],
        audio: []
      };

      // Extract formats (progressive - video+audio combined)
      if (streamingData.formats && Array.isArray(streamingData.formats)) {
        console.log('[Injected] Found', streamingData.formats.length, 'progressive formats');
        for (const format of streamingData.formats) {
          // Try to get URL - either directly or by decrypting
          const url = format.url || decryptSignatureIfNeeded(format, playerResponse);
          if (url) {
            streams.video.push({
              url: url,
              quality: format.qualityLabel || `${format.height}p`,
              type: 'progressive',
              container: format.mimeType?.split('/')[1]?.split(';')[0] || 'mp4',
              bitrate: format.bitrate,
              contentLength: format.contentLength,
              hasAudio: true,
              hasVideo: true,
              height: format.height,
              width: format.width,
              itag: format.itag
            });
          }
        }
      }

      // Extract adaptiveFormats (separate video/audio)
      if (streamingData.adaptiveFormats && Array.isArray(streamingData.adaptiveFormats)) {
        console.log('[Injected] Found', streamingData.adaptiveFormats.length, 'adaptive formats');
        for (const format of streamingData.adaptiveFormats) {
          // Try to get URL - either directly or by decrypting
          const url = format.url || decryptSignatureIfNeeded(format, playerResponse);
          if (url) {
            const isAudio = format.mimeType?.includes('audio');
            const streamType = isAudio ? 'audio' : 'video';
            
            streams[streamType].push({
              url: url,
              quality: format.qualityLabel || (isAudio ? `${Math.round(format.bitrate/1000)}kbps` : `${format.height}p`),
              type: 'adaptive',
              container: format.mimeType?.split('/')[1]?.split(';')[0] || 'mp4',
              bitrate: format.bitrate,
              contentLength: format.contentLength,
              hasAudio: isAudio,
              hasVideo: !isAudio,
              fps: format.fps,
              height: format.height,
              width: format.width,
              itag: format.itag
            });
          }
        }
      }

      console.log('[Injected] Extraction complete:', { 
        videoFormats: streams.video.length, 
        audioFormats: streams.audio.length,
        progressiveStreams: streamingData.formats?.length || 0,
        adaptiveStreams: streamingData.adaptiveFormats?.length || 0
      });
      
      return {
        success: true,
        streams: streams,
        videoDetails: playerResponse?.videoDetails || null,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('[Injected] Error extracting streaming data:', error);
      return { success: false, error: error.message };
    }
  }

  // Continuously poll and update data when available
  function startDataPolling() {
    // Try to extract immediately
    let data = extractStreamingData();
    if (data?.streams?.video?.length > 0 || data?.streams?.audio?.length > 0) {
      window[DATA_KEY] = data;
      console.log('[Injected] Initial extraction successful, stored in window.' + DATA_KEY);
      return;
    }
    
    // If no data, poll for it
    let attempts = 0;
    const maxAttempts = 100; // 10 seconds with 100ms interval
    
    const pollInterval = setInterval(() => {
      attempts++;
      data = extractStreamingData();
      
      if (data?.success && (data.streams?.video?.length > 0 || data.streams?.audio?.length > 0)) {
        clearInterval(pollInterval);
        window[DATA_KEY] = data;
        console.log('[Injected] Data extracted after', attempts * 100, 'ms, stored in window.' + DATA_KEY);
      } else if (attempts >= maxAttempts) {
        clearInterval(pollInterval);
        console.warn('[Injected] Timeout after', attempts * 100, 'ms - no streaming data found');
        // Store failure state so content script knows to give up
        window[DATA_KEY] = { success: false, error: 'Timeout - no streaming data found', timestamp: Date.now() };
      }
    }, 100);
  }

  // Start polling for YouTube data
  console.log('[Injected] Starting data extraction polling...');
  startDataPolling();
  
  // Listen for content script requests and dispatch events with data
  window.addEventListener('__YouTubeExtractRequest', () => {
    const data = window[DATA_KEY];
    if (data) {
      console.log('[Injected] Received extraction request, dispatching event');
      const event = new CustomEvent('__YouTubeExtractResponse', {
        detail: data
      });
      document.dispatchEvent(event);
    }
  });
  
  // Also dispatch automatically when data becomes available
  const autoDispatchInterval = setInterval(() => {
    const data = window[DATA_KEY];
    if (data && data.success) {
      console.log('[Injected] Auto-dispatching extraction complete event');
      const event = new CustomEvent('__YouTubeExtractResponse', {
        detail: data
      });
      document.dispatchEvent(event);
      clearInterval(autoDispatchInterval);
    }
  }, 500);
})();
