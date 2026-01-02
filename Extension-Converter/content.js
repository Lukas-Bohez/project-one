// Content script - runs on YouTube pages
// Based on Chrome_youtube_Video_Downloader_19.1 working extension

console.log('[Content Script] YouTube Downloader loaded');

const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// Parse query string (from working extension)
const parseQueryString = (queryString) =>
  Object.assign(
    {},
    ...queryString.split("&").map((kvp) => {
      const kva = kvp.split("=").map(decodeURIComponent);
      return {
        [kva[0]]: kva[1],
      };
    })
  );

// Inject script into page context (from working extension)
function injectScript(code) {
  const script = document.createElement("script");
  script.type = "application/javascript";
  script.textContent = code;
  (document.head || document.documentElement).appendChild(script);
  script.remove();
}

// Get raw player data from page (from working extension)
async function getRawPageData() {
  console.log('[Content Script] Getting raw page data from ytplayer...');
  
  injectScript(`
    var storage = window.localStorage;
    const videoPage = window?.ytplayer?.config?.args?.raw_player_response;
    storage.setItem('videoPage', JSON.stringify(videoPage));
    const $ = (s, x = document) => x.querySelector(s);
    const basejs = (typeof ytplayer !== 'undefined' && 'config' in ytplayer && ytplayer.config.assets
      ? 'https://' + location.host + ytplayer.config.assets.js
      : 'web_player_context_config' in ytplayer
      ? 'https://' + location.host + ytplayer.web_player_context_config.jsUrl
      : null) || $('script[src$="base.js"]')?.src;
    storage.setItem('basejs', basejs);
  `);

  const videoPage = window.localStorage.getItem("videoPage");
  console.log('[Content Script] Retrieved player data from localStorage:', videoPage ? 'Found' : 'Not found');
  return videoPage;
}

// Get video data using InnerTube API (from working extension)
async function getInnerApijson(videoId, clientName, isAgeRestricted) {
  const clients = {
    "WEB": {
      clientDetails: {
        clientName: "WEB",
        clientVersion: "2.20201021.00.00",
        hl: "en",
        timeZone: "UTC",
        utcOffsetMinutes: 0
      },
      apiKey: "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8"
    },
    "IOS": {
      clientDetails: {
        clientName: "IOS",
        clientVersion: "19.09.3",
        deviceModel: "iPhone14,3",
        userAgent: "com.google.ios.youtube/19.09.3 (iPhone14,3; U; CPU iOS 15_6 like Mac OS X)",
        hl: "en",
        timeZone: "UTC",
        utcOffsetMinutes: 0
      },
      apiKey: "AIzaSyB-63vPrdThhKuerbB2N_l7Kwwcxj6yUAc"
    },
    "IOS_CREATOR": {
      clientDetails: {
        clientName: "IOS_CREATOR",
        clientVersion: "22.33.101",
        deviceModel: "iPhone14,3",
        userAgent: "com.google.ios.ytcreator/22.33.101 (iPhone14,3; U; CPU iOS 15_6 like Mac OS X)",
        hl: "en",
        timeZone: "UTC",
        utcOffsetMinutes: 0
      },
      apiKey: "AIzaSyA8eiZmM1FaDVjRy-dfKTyQ_vz_yYM39w"
    }
  };

  const { clientDetails, apiKey } = clients[clientName] || clients["WEB"];
  
  const clientInfo = { ...clientDetails };
  if (isAgeRestricted) {
    clientInfo.clientVersion = clientDetails.clientVersion + "_restricted";
    clientInfo.clientScreen = "EMBED";
  }

  const requestBody = {
    context: { client: clientInfo },
    videoId: videoId,
    playbackContext: {
      contentPlaybackContext: {
        html5Preference: "HTML5_PREF_WANTS"
      }
    },
    contentCheckOk: true,
    racyCheckOk: true
  };

  const requestOptions = {
    method: "POST",
    headers: {
      Accept: "application/json, text/plain, */*",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody)
  };

  const url = `https://youtubei.googleapis.com/youtubei/v1/player?key=${apiKey}`;

  try {
    console.log(`[Content Script] Fetching from InnerTube API (${clientName})...`);
    const response = await fetch(url, requestOptions);
    if (!response.ok) {
      console.warn(`[Content Script] API returned ${response.status}`);
      return null;
    }
    const data = await response.json();
    console.log('[Content Script] ✓ API returned data');
    return data;
  } catch (error) {
    console.error("[Content Script] API fetch failed:", error);
    return null;
  }
}

// Main function to parse video details (from working extension)
async function parseDetails(url) {
  console.log('[Content Script] parseDetails called for:', url);

  if (!url || !url.includes('watch?v=')) {
    console.log('[Content Script] Not a video page');
    return;
  }

  let videoId;
  if (window.location.href.indexOf("shorts/") > -1) {
    videoId = window.location.href.split("shorts/")[1];
    console.log('[Content Script] Shorts video detected:', videoId);
  } else {
    const query = parseQueryString(url.split("?")[1]);
    videoId = query["v"];
  }

  if (!videoId) {
    console.log('[Content Script] No video ID found');
    return;
  }

  console.log('[Content Script] Processing video ID:', videoId);

  // Step 1: Try InnerTube API with IOS_CREATOR
  let videoPage = await getInnerApijson(videoId, "IOS_CREATOR", false);

  // Step 2: If no streaming data, try age-gated
  if (!videoPage?.streamingData) {
    console.log('[Content Script] No streaming data, trying age-gated...');
    videoPage = await getInnerApijson(videoId, "IOS_CREATOR", true);
  }

  // Step 3: If still fails, try getting from page
  if (!videoPage?.streamingData) {
    console.log('[Content Script] API failed, getting data from page...');
    const rawData = await getRawPageData();
    if (rawData && rawData !== 'null') {
      videoPage = JSON.parse(rawData);
    }
  }

  // Step 4: Try WEB client as final fallback
  if (!videoPage?.streamingData) {
    console.log('[Content Script] Trying WEB client...');
    videoPage = await getInnerApijson(videoId, "WEB", false);
  }

  if (!videoPage?.streamingData) {
    console.error('[Content Script] No streaming data available from any source');
    return;
  }

  console.log('[Content Script] ✓ Got streaming data!');

  // Extract formats (matching working extension logic)
  const formats = videoPage.streamingData.formats || [];
  const adaptiveFormats = videoPage.streamingData.adaptiveFormats || [];

  console.log(`[Content Script] Found ${formats.length} progressive formats, ${adaptiveFormats.length} adaptive formats`);
  
  // Debug: Log first format to see structure
  if (formats.length > 0) {
    console.log('[Content Script] Sample progressive format:', JSON.stringify(formats[0], null, 2));
  }
  if (adaptiveFormats.length > 0) {
    console.log('[Content Script] Sample adaptive format:', JSON.stringify(adaptiveFormats[0], null, 2));
  }

  // Build streams data structure
  const streams = {
    progressive: [],
    video: [],
    audio: []
  };

  // Process progressive formats
  for (const format of formats) {
    let url = format.url;
    
    // If no direct URL but has cipher, extract URL from cipher
    const cipher = format.signatureCipher || format.cipher;
    if (!url && cipher) {
      const components = parseQueryString(cipher);
      // Use the URL from cipher - it should work with ratebypass=yes
      url = components.url;
      // If signature is needed, append it (sp is usually 'sig')
      if (components.s && components.sp) {
        url += `&${components.sp}=${encodeURIComponent(components.s)}`;
      }
    }

    if (url) {
      streams.progressive.push({
        itag: format.itag,
        quality: format.qualityLabel || format.quality || 'unknown',
        mimeType: format.mimeType,
        url: url,
        hasAudio: true,
        hasVideo: true
      });
    } else {
      console.log('[Content Script] Progressive format missing URL:', format.itag, 'hasCipher:', !!cipher);
    }
  }

  // Process adaptive formats
  for (const format of adaptiveFormats) {
    let url = format.url;
    
    const cipher = format.signatureCipher || format.cipher;
    if (cipher && !url) {
      const components = parseQueryString(cipher);
      url = components.url;
    }

    if (url) {
      const mimeType = format.mimeType || '';
      const isVideo = mimeType.startsWith('video/');
      const isAudio = mimeType.startsWith('audio/');

      const stream = {
        itag: format.itag,
        quality: format.qualityLabel || format.quality || 'unknown',
        mimeType: format.mimeType,
        url: url,
        bitrate: format.bitrate,
        hasAudio: isAudio,
        hasVideo: isVideo
      };

      if (isVideo) {
        streams.video.push(stream);
      } else if (isAudio) {
        streams.audio.push(stream);
      }
    } else {
      console.log('[Content Script] Adaptive format missing URL:', format.itag, 'mimeType:', format.mimeType, 'hasCipher:', !!cipher);
    }
  }

  console.log(`[Content Script] Extracted ${streams.progressive.length} progressive, ${streams.video.length} video, ${streams.audio.length} audio streams`);

  // Build video object
  const videoObject = {
    id: videoId,
    title: videoPage.videoDetails?.title || document.title.replace(' - YouTube', ''),
    author: videoPage.videoDetails?.author || 'Unknown',
    lengthSeconds: videoPage.videoDetails?.lengthSeconds || 0,
    thumbnail: videoPage.videoDetails?.thumbnail?.thumbnails?.[0]?.url || '',
    url: window.location.href,
    isShort: window.location.href.includes('/shorts/'),
    streams: streams
  };

  // Build final data structure (format expected by popup)
  const data = {
    type: 'single',
    videos: [videoObject]
  };

  // Send to background script
  browserAPI.runtime.sendMessage({
    type: 'YOUTUBE_DATA',
    data: data
  }).then(() => {
    console.log('[Content Script] Data sent to background script');
  }).catch(err => {
    console.error('[Content Script] Error sending to background:', err);
  });
}

// Listen for YouTube SPA navigation (from working extension)
window.addEventListener("yt-page-data-updated", (event) => {
  console.log('[Content Script] yt-page-data-updated event');
  // Wait a bit for page to stabilize
  setTimeout(() => {
    parseDetails(window.location.href);
  }, 1000);
});

// Initial load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('[Content Script] DOM loaded');
    setTimeout(() => parseDetails(window.location.href), 1500);
  });
} else {
  console.log('[Content Script] Already loaded');
  setTimeout(() => parseDetails(window.location.href), 1500);
}

// Message listener for popup
browserAPI.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Content Script] Message received:', request);
  
  if (request.action === 'extractYouTubeData') {
    // Trigger extraction and respond
    parseDetails(window.location.href).then(() => {
      sendResponse({ success: true, message: 'Extraction triggered' });
    }).catch(err => {
      sendResponse({ success: false, message: err.message });
    });
    return true; // Keep channel open for async response
  }
  
  return false;
});

console.log('[Content Script] Initialization complete');
