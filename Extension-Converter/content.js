// Content script for YouTube pages - extracts video and playlist data
let youtubeData = null;

// Browser API compatibility layer
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// Inject the page-context script to access YouTube's data
function injectPageScript() {
  const script = document.createElement('script');
  script.src = browserAPI.runtime.getURL('injected.js');
  script.onload = function() {
    this.remove();
  };
  (document.head || document.documentElement).appendChild(script);
  console.log('[Content Script] Injected page script');
}

// Request YouTube data from the injected script
function requestYouTubeData() {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.warn('[Content Script] No response from injected script after 5s');
      resolve(null);
    }, 5000);

    const handler = (event) => {
      if (event.source !== window) return;
      if (event.data && event.data.type === 'YOUTUBE_DATA_RESPONSE') {
        clearTimeout(timeout);
        window.removeEventListener('message', handler);
        console.log('[Content Script] Received YouTube data from injected script', event.data.data);
        resolve(event.data.data);
      }
    };

    window.addEventListener('message', handler);
    console.log('[Content Script] Requesting YouTube data from injected script');
    window.postMessage({ type: 'GET_YOUTUBE_DATA' }, '*');
  });
}

// Notify background that content script loaded (helps detect listener presence)
try {
  browserAPI.runtime.sendMessage({ action: 'contentScriptLoaded', url: window.location.href }, () => {});
} catch (e) {
  console.warn('[Content Script] Could not notify background of load:', e && e.message);
}

async function extractYouTubeData() {
  try {
    console.log('[Content Script] Starting YouTube data extraction');

    // First, inject the page script if not already done
    if (!window.__YouTubeScriptInjected) {
      injectPageScript();
      window.__YouTubeScriptInjected = true;
    }

    // Request data from the injected page script
    const injectedData = await requestYouTubeData();
    
    if (injectedData && injectedData.success) {
      console.log('[Content Script] Got streaming data from injected script');
      const videoDetails = injectedData.videoDetails;
      
      if (videoDetails && injectedData.streams) {
        const video = {
          id: videoDetails.videoId,
          title: videoDetails.title || 'Unknown Title',
          author: videoDetails.author || videoDetails.ownerChannelName || 'Unknown Author',
          thumbnail: videoDetails.thumbnail?.thumbnails?.[videoDetails.thumbnail.thumbnails.length - 1]?.url || '',
          duration: videoDetails.lengthSeconds ? formatDuration(videoDetails.lengthSeconds) : '',
          url: window.location.href,
          isShort: window.location.href.includes('/shorts/'),
          streams: injectedData.streams,
          playerJs: null,
          _debug: {
            source: 'injected_script',
            hasStreamingData: true,
            extractedVideoStreams: injectedData.streams.video?.length || 0,
            extractedAudioStreams: injectedData.streams.audio?.length || 0
          }
        };
        
        console.log('[Content Script] Returning video data with streams', {
          video: injectedData.streams.video?.length || 0,
          audio: injectedData.streams.audio?.length || 0
        });
        
        return await processYouTubeData({
          videos: [video],
          type: 'single',
          diagnostics: {
            hasYtInitialData: false,
            hasYtInitialPlayerResponse: true,
            urlType: 'video',
            source: 'injected_script'
          }
        });
      }
    }

    console.warn('[Content Script] Injected script did not return valid data');
    
    // Fallback: try the old method (may not work)
    let data = null;

    // Wait for ytInitialData to be available (YouTube SPA loads this asynchronously)
    const maxWaitTime = 3000; // 3 seconds max for fallback
    const checkInterval = 200; // Check every 200ms
    let waited = 0;
    
    while (!window.ytInitialData && !window.ytInitialPlayerResponse && waited < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      waited += checkInterval;
    }

    // Try to get data from ytInitialData (most common)
    if (window.ytInitialData) {
      console.log('[Content Script] Found ytInitialData');
      data = window.ytInitialData;
    }

    // Try ytInitialPlayerResponse for video data
    if (window.ytInitialPlayerResponse) {
      console.log('[Content Script] Found ytInitialPlayerResponse');
      data = { ...data, ...window.ytInitialPlayerResponse };
    }

    // Try to find data in script tags
    if (!data) {
      console.log('[Content Script] Searching script tags for data');
      const scripts = document.querySelectorAll('script');
      for (const script of scripts) {
        const content = script.textContent;
        if (content.includes('ytInitialData') || content.includes('var ytInitialData')) {
          try {
            // Extract JSON from script content
            const jsonMatch = content.match(/ytInitialData\s*=\s*({.+?});/);
            if (jsonMatch) {
              console.log('[Content Script] Found ytInitialData in script tag');
              data = JSON.parse(jsonMatch[1]);
              break;
            }
          } catch (e) {
            console.log('[Content Script] Failed to parse script data:', e.message);
            continue;
          }
        }
      }
    }

    if (data) {
      console.log('[Content Script] Data extraction successful');
      youtubeData = data;
      return await processYouTubeData(data);
    }

    console.log('[Content Script] No YouTube data found');
    return null;
  } catch (error) {
    console.error('[Content Script] Error extracting YouTube data:', error);
    return null;
  }
}

async function processYouTubeData(data) {
  const url = window.location.href;
  console.log('[Content Script] Processing YouTube data for URL:', url);

  const result = {
    type: null,
    videos: [],
    diagnostics: {
      hasYtInitialData: !!window.ytInitialData,
      hasYtInitialPlayerResponse: !!window.ytInitialPlayerResponse,
      urlType: url.includes('/playlist?') ? 'playlist' : 
               url.includes('/watch?') || url.includes('/shorts/') ? 'video' :
               url.includes('/channel/') || url.includes('/c/') || url.includes('/user/') ? 'channel' : 'unknown'
    }
  };

    try {
    if (url.includes('/playlist?')) {
      console.log('[Content Script] Detected playlist URL');
      result.type = 'playlist';
      result.videos = extractPlaylistVideos(data);
    } else if (url.includes('/watch?') || url.includes('/shorts/')) {
      console.log('[Content Script] Detected single video URL');
      result.type = 'single';
      result.videos = [await extractSingleVideo(data)];
    } else if (url.includes('/channel/') || url.includes('/c/') || url.includes('/user/')) {
      console.log('[Content Script] Detected channel URL');
      result.type = 'channel';
      result.videos = extractChannelVideos(data);
    } else {
      console.log('[Content Script] Unknown URL type');
    }

    console.log('[Content Script] Processing complete:', { type: result.type, videoCount: result.videos.length });
    return result;
  } catch (error) {
    console.error('[Content Script] Error processing YouTube data:', error);
    return null;
  }
}

function extractPlaylistVideos(data) {
  console.log('[Content Script] Extracting playlist videos');
  const videos = [];

  try {
    // Try multiple possible paths for playlist data
    let contents = null;

    // Path 1: Original path
    contents = data?.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents?.[0]?.playlistVideoListRenderer?.contents;

    // Path 2: Alternative path
    if (!contents) {
      contents = data?.contents?.twoColumnBrowseResultsRenderer?.tabs?.[1]?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents?.[0]?.playlistVideoListRenderer?.contents;
    }

    // Path 3: Another alternative
    if (!contents) {
      const tabs = data?.contents?.twoColumnBrowseResultsRenderer?.tabs;
      if (tabs) {
        for (const tab of tabs) {
          if (tab?.tabRenderer?.content?.sectionListRenderer?.contents) {
            const sectionContents = tab.tabRenderer.content.sectionListRenderer.contents;
            for (const section of sectionContents) {
              if (section?.itemSectionRenderer?.contents?.[0]?.playlistVideoListRenderer?.contents) {
                contents = section.itemSectionRenderer.contents[0].playlistVideoListRenderer.contents;
                break;
              }
            }
            if (contents) break;
          }
        }
      }
    }

    // Path 4: Try to find any playlistVideoListRenderer
    if (!contents) {
      const findPlaylistContents = (obj) => {
        if (obj && typeof obj === 'object') {
          if (obj.playlistVideoListRenderer && obj.playlistVideoListRenderer.contents) {
            return obj.playlistVideoListRenderer.contents;
          }
          for (const key in obj) {
            const result = findPlaylistContents(obj[key]);
            if (result) return result;
          }
        }
        return null;
      };
      contents = findPlaylistContents(data);
    }

    if (contents) {
      console.log('[Content Script] Found playlist contents:', contents.length, 'items');
      for (const item of contents) {
        const video = item.playlistVideoRenderer;
        if (video) {
          const videoData = {
            id: video.videoId,
            title: video.title?.runs?.[0]?.text || video.title?.simpleText || 'Unknown Title',
            author: video.shortBylineText?.runs?.[0]?.text || video.longBylineText?.runs?.[0]?.text || 'Unknown Author',
            thumbnail: extractBestThumbnail(video.thumbnail?.thumbnails),
            duration: video.lengthText?.simpleText || video.lengthSeconds ? formatDuration(video.lengthSeconds) : '',
            url: `https://www.youtube.com/watch?v=${video.videoId}`,
            isShort: false
          };
          videos.push(videoData);
          console.log('[Content Script] Extracted playlist video:', videoData.title);
        }
      }
    } else {
      console.log('[Content Script] No playlist contents found');
    }

    console.log('[Content Script] Playlist extraction complete:', videos.length, 'videos');
  } catch (error) {
    console.error('[Content Script] Error extracting playlist videos:', error);
  }

  return videos;
}

async function extractSingleVideo(data) {
  try {
    // Try multiple ways to get video details
    let videoDetails = data?.videoDetails || data?.microformat?.playerMicroformatRenderer;

    // Alternative paths for video details
    if (!videoDetails) {
      videoDetails = data?.contents?.twoColumnWatchNextResults?.results?.results?.contents?.[0]?.videoPrimaryInfoRenderer;
    }

    if (!videoDetails) {
      // Try to find videoDetails anywhere in the data
      const findVideoDetails = (obj) => {
        if (obj && typeof obj === 'object') {
          if (obj.videoId && obj.title) {
            return obj;
          }
          for (const key in obj) {
            const result = findVideoDetails(obj[key]);
            if (result) return result;
          }
        }
        return null;
      };
      videoDetails = findVideoDetails(data);
    }

    let streamingData = data?.streamingData;

    // If data has ytInitialPlayerResponse merged, try that first
    if (!streamingData && window.ytInitialPlayerResponse) {
      console.log('[Content Script] Trying ytInitialPlayerResponse.streamingData');
      streamingData = window.ytInitialPlayerResponse.streamingData;
    }

    // Attempt to discover player JS URL from known locations or script tags
    let playerJs = null;
    try {
      if (data?.assets?.js) playerJs = data.assets.js;
      else if (data?.js) playerJs = data.js;
      else if (window.ytplayer && window.ytplayer.config && window.ytplayer.config.assets && window.ytplayer.config.assets.js) playerJs = window.ytplayer.config.assets.js;
      else {
        const scripts = Array.from(document.scripts || []);
        for (const s of scripts) {
          try {
            if (!s.src) continue;
            const src = s.src;
            if (src.includes('player') && src.endsWith('.js')) {
              playerJs = src;
              break;
            }
          } catch (e) { continue; }
        }
      }
    } catch (e) { playerJs = null; }

    // If streamingData missing, try common alternate locations
    if (!streamingData) {
      streamingData = data?.playerResponse?.streamingData || data?.player_response?.streamingData || (data?.args?.player_response ? JSON.parse(data.args.player_response).streamingData : null) || null;
    }

    // If still missing, attempt to fetch get_video_info endpoint to retrieve player_response
    if (!streamingData) {
      const vid = extractVideoId(window.location.href) || (data?.videoDetails && data.videoDetails.videoId) || null;
      if (vid) {
        try {
          const gr = await getPlayerResponseFromGetInfo(vid);
          if (gr && gr.streamingData) streamingData = gr.streamingData;
        } catch (e) {
          console.warn('[Content Script] get_video_info failed', e.message);
        }
      }
    }

    // Send diagnostic message to background with playerJs and streamingData info to aid debugging
    try {
      browserAPI.runtime.sendMessage({
        action: 'contentExtractionInfo',
        url: window.location.href,
        videoId: (videoDetails && (videoDetails.videoId || videoDetails.video_id)) || null,
        playerJs: playerJs || null,
        hasStreamingData: !!streamingData,
        streamingDataKeys: streamingData ? Object.keys(streamingData) : []
      }, () => {});
    } catch (e) {
      console.warn('[Content Script] Could not send extraction diagnostics to background:', e && e.message);
    }

    console.log('[Content Script] streamingData status:', {
      found: !!streamingData,
      hasFormats: !!(streamingData && streamingData.formats),
      hasAdaptiveFormats: !!(streamingData && streamingData.adaptiveFormats),
      formatsCount: streamingData && streamingData.formats ? streamingData.formats.length : 0,
      adaptiveCount: streamingData && streamingData.adaptiveFormats ? streamingData.adaptiveFormats.length : 0
    });

    // Extract streaming URLs
    const streams = extractStreamingUrls(streamingData);
    
    console.log('[Content Script] Extracted streams:', {
      videoCount: streams.video.length,
      audioCount: streams.audio.length
    });

    if (videoDetails) {
      return {
        id: videoDetails.videoId,
        title: videoDetails.title || 'Unknown Title',
        author: videoDetails.author || videoDetails.ownerChannelName || 'Unknown Author',
        thumbnail: extractBestThumbnail(videoDetails.thumbnail?.thumbnails),
        duration: videoDetails.lengthSeconds ? formatDuration(videoDetails.lengthSeconds) : '',
        url: window.location.href,
        isShort: window.location.href.includes('/shorts/'),
        streams: streams,
        playerJs: playerJs,
        _debug: {
          hasStreamingData: !!streamingData,
          streamingDataKeys: streamingData ? Object.keys(streamingData) : [],
          formatsCount: streamingData && streamingData.formats ? streamingData.formats.length : 0,
          adaptiveCount: streamingData && streamingData.adaptiveFormats ? streamingData.adaptiveFormats.length : 0,
          extractedVideoStreams: streams.video.length,
          extractedAudioStreams: streams.audio.length
        }
      };
    }

    // Fallback: try to extract from page elements
    const titleEl = document.querySelector('h1.ytd-video-primary-info-renderer yt-formatted-string, h1.ytd-watch-metadata yt-formatted-string');
    const authorEl = document.querySelector('yt-formatted-string#text.ytd-channel-name, a.yt-simple-endpoint.ytd-video-owner-renderer');
    const thumbnailEl = document.querySelector('video');

    return {
      id: extractVideoId(window.location.href),
      title: titleEl?.textContent?.trim() || 'Unknown Title',
      author: authorEl?.textContent?.trim() || 'Unknown Author',
      thumbnail: thumbnailEl?.poster || extractThumbnailFromMeta(),
      duration: 'Unknown',
      url: window.location.href,
      isShort: window.location.href.includes('/shorts/'),
      streams: { video: [], audio: [] }
    };

  } catch (error) {
    console.error('Error extracting single video:', error);
    return null;
  }
}

function extractChannelVideos(data) {
  const videos = [];

  try {
    // Try to find recent videos on channel page
    const tabs = data?.contents?.twoColumnBrowseResultsRenderer?.tabs;

    if (tabs) {
      for (const tab of tabs) {
        if (tab.tabRenderer?.title === 'Videos' || tab.tabRenderer?.title === 'Home') {
          const contents = tab.tabRenderer?.content?.sectionListRenderer?.contents;

          if (contents) {
            for (const section of contents) {
              const items = section.itemSectionRenderer?.contents || [];

              for (const item of items) {
                const videoRenderer = item.videoRenderer || item.compactVideoRenderer;
                if (videoRenderer) {
                  videos.push({
                    id: videoRenderer.videoId,
                    title: videoRenderer.title?.runs?.[0]?.text || 'Unknown Title',
                    author: videoRenderer.ownerText?.runs?.[0]?.text || videoRenderer.shortBylineText?.runs?.[0]?.text || 'Unknown Author',
                    thumbnail: extractBestThumbnail(videoRenderer.thumbnail?.thumbnails),
                    duration: videoRenderer.lengthText?.simpleText || '',
                    url: `https://www.youtube.com/watch?v=${videoRenderer.videoId}`,
                    isShort: false
                  });
                }
              }
            }
          }
        }
      }
    }

  } catch (error) {
    console.error('Error extracting channel videos:', error);
  }

  return videos.slice(0, 20); // Limit to 20 videos
}

function extractStreamingUrls(streamingData) {
  const streams = {
    video: [],
    audio: []
  };

  if (!streamingData) {
    console.warn('[Content Script] No streamingData provided to extractStreamingUrls');
    return streams;
  }

  console.log('[Content Script] Extracting streams from streamingData', {
    hasFormats: !!streamingData.formats,
    formatsLength: streamingData.formats?.length || 0,
    hasAdaptiveFormats: !!streamingData.adaptiveFormats,
    adaptiveLength: streamingData.adaptiveFormats?.length || 0
  });

  try {
    // Extract progressive streams (combined video+audio) - these work best
    if (streamingData.formats && Array.isArray(streamingData.formats)) {
      for (const format of streamingData.formats) {
        let url = format.url;
        
        // If no direct URL, try to extract from signatureCipher
        if (!url && format.signatureCipher) {
          url = decodeSignatureCipher(format.signatureCipher);
        }
        
        if (url) {
          streams.video.push({
            url: url,
            quality: format.qualityLabel || `${format.height}p` || 'unknown',
            type: 'progressive',
            container: format.mimeType?.split(';')[0]?.split('/')[1] || 'mp4',
            bitrate: format.bitrate,
            contentLength: format.contentLength,
            hasAudio: true,
            hasVideo: true
          });
          console.log(`[Content Script] Added progressive stream: ${format.qualityLabel || format.height}p`);
        }
      }
    }

    // Extract adaptive streams (separate video/audio)
    if (streamingData.adaptiveFormats && Array.isArray(streamingData.adaptiveFormats)) {
      for (const format of streamingData.adaptiveFormats) {
        let url = format.url;
        
        // If no direct URL, try to extract from signatureCipher
        if (!url && format.signatureCipher) {
          url = decodeSignatureCipher(format.signatureCipher);
        }
        
        if (url) {
          const isAudio = format.mimeType?.includes('audio') || false;
          const streamType = isAudio ? 'audio' : 'video';

          streams[streamType].push({
            url: url,
            quality: format.qualityLabel || (isAudio ? `${Math.round(format.bitrate/1000)}kbps` : `${format.height}p`) || 'unknown',
            type: 'adaptive',
            container: format.mimeType?.split(';')[0]?.split('/')[1] || (isAudio ? 'mp4' : 'mp4'),
            bitrate: format.bitrate,
            contentLength: format.contentLength,
            hasAudio: isAudio,
            hasVideo: !isAudio,
            fps: format.fps
          });
          console.log(`[Content Script] Added ${streamType} stream: ${format.qualityLabel || format.height || format.bitrate}`);
        }
      }
    }

    // Sort by quality (best first)
    streams.video.sort((a, b) => {
      const aQuality = parseInt(a.quality) || 0;
      const bQuality = parseInt(b.quality) || 0;
      return bQuality - aQuality;
    });

    streams.audio.sort((a, b) => {
      const aBitrate = parseInt(a.bitrate) || 0;
      const bBitrate = parseInt(b.bitrate) || 0;
      return bBitrate - aBitrate;
    });

  } catch (error) {
    console.error('Error extracting streaming URLs:', error);
  }

  return streams;
}

function decodeSignatureCipher(cipher) {
  try {
    const params = new URLSearchParams(cipher);
    const url = params.get('url');
    const s = params.get('s'); // encrypted signature
    const sp = params.get('sp') || 'signature'; // signature parameter name
    
    if (!url) {
      console.warn('[Content Script] No URL in signatureCipher');
      return '';
    }
    
    // If there's no signature to decrypt, return the URL as-is
    if (!s) {
      return url;
    }
    
    // For now, return the URL without signature (may not work for all videos)
    // A full implementation would need to decrypt the signature using YouTube's player JS
    console.warn('[Content Script] Video uses encrypted signatures - direct download may not work');
    console.warn('[Content Script] Encrypted signature:', s.substring(0, 50) + '...');
    
    // Try to append the signature anyway (won't work if it needs decryption)
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}${sp}=${encodeURIComponent(s)}`;
  } catch (error) {
    console.error('[Content Script] Error decoding signature cipher:', error);
    return '';
  }
}

function extractBestThumbnail(thumbnails) {
  if (!thumbnails || thumbnails.length === 0) {
    return 'https://via.placeholder.com/480x360?text=No+Thumbnail';
  }

  // Sort by resolution (width * height), highest first
  const sorted = thumbnails.sort((a, b) => {
    const aRes = (a.width || 0) * (a.height || 0);
    const bRes = (b.width || 0) * (b.height || 0);
    return bRes - aRes;
  });

  return sorted[0].url;
}

function extractVideoId(url) {
  const patterns = [
    /[?&]v=([^#\&\?]*)/,
    /youtu\.be\/([^\/\?]+)/,
    /youtube\.com\/embed\/([^\/\?]+)/,
    /youtube\.com\/shorts\/([^\/\?]+)/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

function formatDuration(seconds) {
  if (!seconds) return 'Unknown';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  } else {
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }
}

// Attempt to fetch player_response via get_video_info for a video id
async function getPlayerResponseFromGetInfo(videoId) {
  try {
    const url = `https://www.youtube.com/get_video_info?video_id=${encodeURIComponent(videoId)}&el=detailpage&hl=en`;
    const resp = await fetch(url, { method: 'GET', credentials: 'include' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const text = await resp.text();
    const params = new URLSearchParams(text);
    const player_response = params.get('player_response') || params.get('playerResponse') || null;
    if (!player_response) throw new Error('No player_response in get_video_info');
    return JSON.parse(player_response);
  } catch (err) {
    console.warn('[Content Script] getPlayerResponseFromGetInfo error', err.message);
    throw err;
  }
}

// Listen for messages from popup
browserAPI.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    console.log('[Content Script] Received message:', request);

    if (request.action === 'extractYouTubeData') {
      const data = await extractYouTubeData();

      // Log detailed info for debugging: cookies (document), videos, thumbnails, authors
      console.log('[Content Script] document.cookie:', document.cookie);

      if (data && data.videos) {
        console.log('[Content Script] Found videos:', data.videos.length);
        data.videos.forEach((v, i) => {
          console.log(`[Content Script] Video ${i + 1}: id=${v.id} title="${v.title}" author="${v.author}" thumbnail=${v.thumbnail} url=${v.url} isShort=${v.isShort}`);
          if (v.streams) {
            console.log(`[Content Script] Video ${i + 1} streams: video=${v.streams.video.length} audio=${v.streams.audio.length}`);
            // Log top stream urls (truncated)
            v.streams.video.slice(0,3).forEach((s, si) => console.log(`[Content Script] Video ${i + 1} stream ${si+1}: ${s.url ? s.url.substring(0,120) : 'no-url'}`));
            v.streams.audio.slice(0,3).forEach((s, si) => console.log(`[Content Script] Video ${i + 1} audio ${si+1}: ${s.url ? s.url.substring(0,120) : 'no-url'}`));
          }
        });
      } else {
        console.log('[Content Script] No videos found in extracted data');
      }

      // Ask background for cookies for this URL (background has cookie permission)
      try {
        browserAPI.runtime.sendMessage({ action: 'getCookies', url: window.location.href }, (resp) => {
          if (browserAPI.runtime.lastError) {
            console.warn('[Content Script] getCookies runtime error', browserAPI.runtime.lastError.message);
            sendResponse({ success: true, data: data, cookies: null });
            return;
          }

          if (resp && resp.success) {
            console.log('[Content Script] Retrieved cookies from background:', resp.cookies);
            sendResponse({ success: true, data: data, cookies: resp.cookies });
          } else {
            console.log('[Content Script] Background returned no cookies:', resp);
            sendResponse({ success: true, data: data, cookies: null });
          }
        });
      } catch (err) {
        console.error('[Content Script] Error requesting cookies from background:', err);
        sendResponse({ success: true, data: data, cookies: null });
      }

    }
  })();

  return true; // keep channel open for async sendResponse
});

// Auto-extract data when page loads
window.addEventListener('load', () => {
  setTimeout(() => {
    extractYouTubeData();
  }, 3000); // Wait for YouTube to load its data
});