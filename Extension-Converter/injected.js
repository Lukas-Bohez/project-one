// This script runs in the PAGE context (not extension context)
// It extracts YouTube data and sends it to the content script via postMessage

(function() {
  'use strict';
  
  function extractStreamingData() {
    try {
      // Direct access to YouTube's data (page context)
      if (!window.ytInitialPlayerResponse) {
        console.log('[Injected] No ytInitialPlayerResponse yet');
        return null;
      }

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
        for (const format of streamingData.formats) {
          if (format.url) {
            streams.video.push({
              url: format.url,
              quality: format.qualityLabel || `${format.height}p`,
              type: 'progressive',
              container: format.mimeType?.split('/')[1]?.split(';')[0] || 'mp4',
              bitrate: format.bitrate,
              contentLength: format.contentLength,
              hasAudio: true,
              hasVideo: true
            });
          }
        }
      }

      // Extract adaptiveFormats (separate video/audio)
      if (streamingData.adaptiveFormats && Array.isArray(streamingData.adaptiveFormats)) {
        for (const format of streamingData.adaptiveFormats) {
          if (format.url) {
            const isAudio = format.mimeType?.includes('audio');
            const streamType = isAudio ? 'audio' : 'video';
            
            streams[streamType].push({
              url: format.url,
              quality: format.qualityLabel || (isAudio ? `${Math.round(format.bitrate/1000)}kbps` : `${format.height}p`),
              type: 'adaptive',
              container: format.mimeType?.split('/')[1]?.split(';')[0] || 'mp4',
              bitrate: format.bitrate,
              contentLength: format.contentLength,
              hasAudio: isAudio,
              hasVideo: !isAudio,
              fps: format.fps
            });
          }
        }
      }

      console.log('[Injected] Extracted streams:', { videoCount: streams.video.length, audioCount: streams.audio.length });
      
      return {
        success: true,
        streams: streams,
        videoDetails: playerResponse?.videoDetails || null
      };
    } catch (error) {
      console.error('[Injected] Error extracting streaming data:', error);
      return { success: false, error: error.message };
    }
  }

  // Wait for YouTube data to load
  function waitForYouTubeData(callback, maxWait = 10000) {
    let waited = 0;
    const interval = setInterval(() => {
      if (window.ytInitialPlayerResponse) {
        clearInterval(interval);
        const data = extractStreamingData();
        callback(data);
      } else if (waited >= maxWait) {
        clearInterval(interval);
        console.warn('[Injected] Timeout waiting for ytInitialPlayerResponse');
        callback({ success: false, error: 'Timeout waiting for YouTube data' });
      }
      waited += 100;
    }, 100);
  }

  // Listen for requests from content script
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    
    if (event.data && event.data.type === 'GET_YOUTUBE_DATA') {
      console.log('[Injected] Received request for YouTube data');
      waitForYouTubeData((data) => {
        window.postMessage({
          type: 'YOUTUBE_DATA_RESPONSE',
          data: data
        }, '*');
      });
    }
  });

  // Signal that injected script is ready
  console.log('[Injected] Script loaded and listening for requests');
})();
