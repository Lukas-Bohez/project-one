// Content script for YouTube pages - extracts video and playlist data
let youtubeData = null;

function extractYouTubeData() {
  try {
    console.log('[Content Script] Starting YouTube data extraction');

    // YouTube stores data in various places, let's check them all
    let data = null;

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
      return processYouTubeData(data);
    }

    console.log('[Content Script] No YouTube data found');
    return null;
  } catch (error) {
    console.error('[Content Script] Error extracting YouTube data:', error);
    return null;
  }
}

function processYouTubeData(data) {
  const url = window.location.href;
  console.log('[Content Script] Processing YouTube data for URL:', url);

  const result = {
    type: null,
    videos: []
  };

  try {
    if (url.includes('/playlist?')) {
      console.log('[Content Script] Detected playlist URL');
      result.type = 'playlist';
      result.videos = extractPlaylistVideos(data);
    } else if (url.includes('/watch?') || url.includes('/shorts/')) {
      console.log('[Content Script] Detected single video URL');
      result.type = 'single';
      result.videos = [extractSingleVideo(data)];
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
    // Navigate YouTube's data structure for playlists
    const contents = data?.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents?.[0]?.playlistVideoListRenderer?.contents;

    if (contents) {
      console.log('[Content Script] Found playlist contents:', contents.length, 'items');
      for (const item of contents) {
        const video = item.playlistVideoRenderer;
        if (video) {
          const videoData = {
            id: video.videoId,
            title: video.title?.runs?.[0]?.text || 'Unknown Title',
            author: video.shortBylineText?.runs?.[0]?.text || video.longBylineText?.runs?.[0]?.text || 'Unknown Author',
            thumbnail: extractBestThumbnail(video.thumbnail?.thumbnails),
            duration: video.lengthText?.simpleText || '',
            url: `https://www.youtube.com/watch?v=${video.videoId}`,
            isShort: false
          };
          videos.push(videoData);
          console.log('[Content Script] Extracted playlist video:', videoData.title);
        }
      }
    } else {
      console.log('[Content Script] No playlist contents found, trying alternative structure');
      // If no videos found, try alternative structure
      const sidebar = data?.sidebar?.playlistSidebarRenderer?.items?.[0]?.playlistSidebarPrimaryInfoRenderer;
      if (sidebar) {
        console.log('[Content Script] Found alternative playlist structure');
      }
    }

    console.log('[Content Script] Playlist extraction complete:', videos.length, 'videos');
  } catch (error) {
    console.error('[Content Script] Error extracting playlist videos:', error);
  }

  return videos;
}

function extractSingleVideo(data) {
  try {
    const videoDetails = data?.videoDetails || data?.microformat?.playerMicroformatRenderer;

    if (videoDetails) {
      return {
        id: videoDetails.videoId,
        title: videoDetails.title || 'Unknown Title',
        author: videoDetails.author || 'Unknown Author',
        thumbnail: extractBestThumbnail(videoDetails.thumbnail?.thumbnails),
        duration: formatDuration(videoDetails.lengthSeconds),
        url: window.location.href,
        isShort: window.location.href.includes('/shorts/')
      };
    }

    // Fallback: try to extract from page elements
    const titleEl = document.querySelector('h1.ytd-video-primary-info-renderer yt-formatted-string');
    const authorEl = document.querySelector('yt-formatted-string#text.ytd-channel-name');
    const thumbnailEl = document.querySelector('video');

    return {
      id: extractVideoId(window.location.href),
      title: titleEl?.textContent?.trim() || 'Unknown Title',
      author: authorEl?.textContent?.trim() || 'Unknown Author',
      thumbnail: thumbnailEl?.poster || extractThumbnailFromMeta(),
      duration: 'Unknown',
      url: window.location.href,
      isShort: window.location.href.includes('/shorts/')
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

function extractBestThumbnail(thumbnails) {
  if (!thumbnails || !Array.isArray(thumbnails)) {
    return extractThumbnailFromMeta();
  }

  // Sort by quality and return the best one
  const sorted = thumbnails.sort((a, b) => (b.width * b.height) - (a.width * a.height));
  return sorted[0]?.url || extractThumbnailFromMeta();
}

function extractThumbnailFromMeta() {
  // Fallback to meta tags
  const metaThumbnail = document.querySelector('meta[property="og:image"]');
  return metaThumbnail?.content || 'https://via.placeholder.com/480x360?text=No+Thumbnail';
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

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Content Script] Received message:', request);

  if (request.action === 'extractYouTubeData') {
    const data = extractYouTubeData();
    console.log('[Content Script] Sending response:', { success: !!data, type: data?.type, videoCount: data?.videos?.length });
    sendResponse({ success: true, data: data });
  }

  return true; // Keep message channel open for async response
});

// Auto-extract data when page loads
window.addEventListener('load', () => {
  setTimeout(() => {
    extractYouTubeData();
  }, 2000); // Wait for YouTube to load its data
});