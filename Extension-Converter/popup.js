document.addEventListener('DOMContentLoaded', function() {
  // DOM elements
  const urlDisplay = document.getElementById('url-display');
  const formatSelect = document.getElementById('format');
  const qualitySelect = document.getElementById('quality');
  const downloadDirInput = document.getElementById('download-dir');
  const convertBtn = document.getElementById('convert-btn');
  const statusDiv = document.getElementById('status');
  const progressContainer = document.getElementById('progress-container');
  const progressFill = document.getElementById('progress-fill');
  const progressText = document.getElementById('progress-text');
  const queueList = document.getElementById('queue-list');
  const settingsToggle = document.getElementById('settings-toggle');
  const settingsContent = document.getElementById('settings-content');
  const maxRetriesInput = document.getElementById('max-retries');
  const retryDelayInput = document.getElementById('retry-delay');
  const saveSettingsBtn = document.getElementById('save-settings');

  // State management
  let currentTab = null;
  let conversionQueue = [];
  let isProcessing = false;
  let settings = {
    maxRetries: 3,
    retryDelay: 5
  };

  // Load settings from storage
  let settingsLoaded = false;
  chrome.storage.sync.get(['maxRetries', 'retryDelay', 'downloadDir'], function(result) {
    settings.maxRetries = result.maxRetries || 3;
    settings.retryDelay = result.retryDelay || 5;
    maxRetriesInput.value = settings.maxRetries;
    retryDelayInput.value = settings.retryDelay;
    if (result.downloadDir) {
      downloadDirInput.value = result.downloadDir;
    }
    settingsLoaded = true;
  });

  // Settings toggle
  settingsToggle.addEventListener('click', function() {
    settingsContent.classList.toggle('show');
  });

  // Save settings
  saveSettingsBtn.addEventListener('click', function() {
    settings.maxRetries = parseInt(maxRetriesInput.value);
    settings.retryDelay = parseInt(retryDelayInput.value);

    chrome.storage.sync.set({
      maxRetries: settings.maxRetries,
      retryDelay: settings.retryDelay,
      downloadDir: downloadDirInput.value
    }, function() {
      showStatus('Settings saved!', 'success');
    });
  });

  // Initialize after settings are loaded
  const initInterval = setInterval(() => {
    if (settingsLoaded) {
      clearInterval(initInterval);
      initializePopup();
    }
  }, 50);

  async function initializePopup() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      currentTab = tabs[0];

      if (currentTab.url && currentTab.url.includes('youtube.com')) {
        if (currentTab.url.includes('list=')) {
          // Playlist detected
          const playlistId = extractPlaylistId(currentTab.url);
          urlDisplay.textContent = `Playlist detected: ${playlistId}`;
          await loadPlaylistVideos(playlistId);
        } else if (currentTab.url.includes('watch?v=')) {
          // Single video
          const videoId = extractVideoId(currentTab.url);
          urlDisplay.textContent = `Single video: ${videoId}`;
          conversionQueue = [{
            id: videoId,
            url: currentTab.url,
            title: 'Loading...',
            status: 'pending'
          }];
          updateQueueDisplay();
        } else {
          urlDisplay.textContent = 'Not on a YouTube video or playlist page';
          convertBtn.disabled = true;
          showStatus('Please navigate to a YouTube video or playlist', 'error');
          return;
        }

        convertBtn.disabled = false;
        showStatus('Ready to convert', 'info');
      } else {
        urlDisplay.textContent = 'Not on a YouTube page';
        convertBtn.disabled = true;
        showStatus('Please navigate to YouTube', 'error');
      }
    } catch (error) {
      console.error('Initialization error:', error);
      showStatus('Error initializing extension', 'error');
    }
  }

  async function loadPlaylistVideos(playlistId) {
    try {
      showStatus('Loading playlist videos...', 'info');

      // Use YouTube's API or scrape playlist data
      // For now, we'll use a simplified approach
      const response = await fetch(`https://www.youtube.com/playlist?list=${playlistId}`);
      const html = await response.text();

      // Extract video IDs from playlist HTML (simplified)
      const videoIds = extractVideoIdsFromPlaylist(html);

      if (videoIds.length === 0) {
        throw new Error('No videos found in playlist. Playlist might be private or empty.');
      }

      conversionQueue = videoIds.map(id => ({
        id: id,
        url: `https://www.youtube.com/watch?v=${id}`,
        title: `Video ${id}`,
        status: 'pending'
      }));

      updateQueueDisplay();
      showStatus(`Found ${conversionQueue.length} videos in playlist`, 'success');
    } catch (error) {
      console.error('Error loading playlist:', error);
      showStatus('Failed to load playlist videos: ' + error.message, 'error');
      conversionQueue = [];
      updateQueueDisplay();
    }
  }

  function extractPlaylistId(url) {
    const match = url.match(/[?&]list=([^#\&\?]*)/);
    return match ? match[1] : null;
  }

  function extractVideoId(url) {
    // Handle various YouTube URL formats
    const patterns = [
      /[?&]v=([^#\&\?]*)/,  // Standard format
      /youtu\.be\/([^\/\?]+)/,  // Shortened format
      /youtube\.com\/embed\/([^\/\?]+)/  // Embed format
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  }

  function extractVideoIdsFromPlaylist(html) {
    // Simplified extraction - in a real implementation, you'd parse the JSON data
    // or use YouTube's official API
    const videoIdRegex = /"videoId":"([^"]+)"/g;
    const ids = [];
    let match;
    // Reset regex lastIndex to ensure consistent results
    videoIdRegex.lastIndex = 0;
    while ((match = videoIdRegex.exec(html)) !== null) {
      if (!ids.includes(match[1])) {
        ids.push(match[1]);
      }
    }
    return ids.slice(0, 50); // Limit to 50 videos
  }

  function updateQueueDisplay() {
    queueList.innerHTML = '';
    conversionQueue.forEach((item, index) => {
      const div = document.createElement('div');
      div.className = `queue-item ${item.status}`;
      const title = (item.title || item.id).length > 30 ?
        (item.title || item.id).substring(0, 27) + '...' :
        (item.title || item.id);
      div.innerHTML = `
        <span>${index + 1}. ${title}</span>
        <span>${item.status}</span>
      `;
      queueList.appendChild(div);
    });
  }

  function showStatus(message, type = 'info') {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
  }

  function updateProgress(current, total, text = '') {
    const percentage = total > 0 ? (current / total) * 100 : 0;
    progressFill.style.width = `${percentage}%`;
    progressText.textContent = text || `Processing ${current}/${total} (${Math.round(percentage)}%)`;
  }

  // Convert button handler
  convertBtn.addEventListener('click', async function() {
    if (isProcessing) return;

    if (conversionQueue.length === 0) {
      showStatus('No videos to convert', 'error');
      return;
    }

    isProcessing = true;
    convertBtn.disabled = true;
    progressContainer.style.display = 'block';
    showStatus('Starting conversion...', 'info');

    try {
      await processQueue();
    } catch (error) {
      console.error('Conversion error:', error);
      showStatus(`Conversion failed: ${error.message}`, 'error');
    } finally {
      isProcessing = false;
      convertBtn.disabled = false;
    }
  });

  async function processQueue() {
    const total = conversionQueue.length;
    let completed = 0;
    let failed = 0;

    updateProgress(0, total, 'Starting batch conversion...');

    for (let i = 0; i < conversionQueue.length; i++) {
      const item = conversionQueue[i];
      item.status = 'processing';
      updateQueueDisplay();

      try {
        updateProgress(completed + failed, total, `Converting: ${item.title || item.id}`);
        await convertVideo(item, i + 1);
        item.status = 'completed';
        completed++;
      } catch (error) {
        console.error(`Failed to convert ${item.id}:`, error);
        item.status = 'failed';
        failed++;
      }

      updateQueueDisplay();
    }

    updateProgress(total, total, `Batch complete: ${completed} successful, ${failed} failed`);
    showStatus(`Batch complete: ${completed} successful, ${failed} failed`, failed > 0 ? 'warning' : 'success');
  }

  async function convertVideo(item, index) {
    const format = formatSelect.value;
    const quality = qualitySelect.value;
    const downloadDir = downloadDirInput.value || 'Downloads/ConvertTheSpire';

    let retries = 0;
    const maxRetries = settings.maxRetries;

    while (retries <= maxRetries) {
      try {
        // Get cookies for the video URL
        const cookies = await chrome.cookies.getAll({ url: item.url });
        const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');

        // Analyze video
        const analyzeResponse = await fetch('https://api.y2mate.com/v2/analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': cookieString
          },
          body: JSON.stringify({ url: item.url })
        });

        const analyzeData = await analyzeResponse.json();
        if (analyzeData.status !== 'ok') {
          throw new Error('Failed to analyze video');
        }

        // Update title if not set
        if (item.title === 'Loading...' || !item.title) {
          item.title = analyzeData.title;
          updateQueueDisplay();
        }

        // Choose format
        const isAudio = format === 'mp3';
        const formats = isAudio ? analyzeData.a : analyzeData.v;
        if (!formats || formats.length === 0) {
          throw new Error('No formats available');
        }

        // Choose quality
        let selectedFormat = formats[0];
        if (quality !== 'best') {
          selectedFormat = formats.find(f => f.q.includes(quality)) || formats[0];
        }

        // Convert
        const convertResponse = await fetch('https://api.y2mate.com/v2/convert', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': cookieString
          },
          body: JSON.stringify({
            vid: analyzeData.vid,
            k: selectedFormat.k
          })
        });

        const convertData = await convertResponse.json();
        if (convertData.status !== 'ok') {
          throw new Error('Conversion failed');
        }

        // Download with custom directory
        const sanitizedTitle = item.title.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, ' ').trim();
        const filename = `${downloadDir}/${sanitizedTitle}.${isAudio ? 'mp3' : 'mp4'}`;

        await chrome.downloads.download({
          url: convertData.dlink,
          filename: filename,
          conflictAction: 'uniquify'
        });

        return; // Success

      } catch (error) {
        retries++;
        if (retries <= maxRetries) {
          console.log(`Retry ${retries}/${maxRetries} for ${item.id}: ${error.message}`);
          await new Promise(resolve => setTimeout(resolve, settings.retryDelay * 1000));
        } else {
          throw error;
        }
      }
    }
  }
});