document.addEventListener('DOMContentLoaded', function() {
  // DOM elements
  const urlDisplay = document.getElementById('url-display');
  const formatSelect = document.getElementById('format');
  const qualitySelect = document.getElementById('quality');
  const downloadDirInput = document.getElementById('download-dir');
  const convertBtn = document.getElementById('convert-btn');
  const selectAllBtn = document.getElementById('select-all-btn');
  const statusDiv = document.getElementById('status');
  const progressContainer = document.getElementById('progress-container');
  const progressFill = document.getElementById('progress-fill');
  const progressText = document.getElementById('progress-text');
  const queueList = document.getElementById('queue-list');
  const maxRetriesInput = document.getElementById('max-retries');
  const retryDelayInput = document.getElementById('retry-delay');
  const saveSettingsBtn = document.getElementById('save-settings');
  const clearLogsBtn = document.getElementById('clear-logs');
  const exportLogsBtn = document.getElementById('export-logs');
  const logCount = document.getElementById('log-count');
  const logsEntries = document.getElementById('logs-entries');
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');

  // Logging system
  let logEntries = [];

  function addLog(level, message, data = null) {
    const timestamp = new Date().toLocaleTimeString();
    const entry = {
      timestamp,
      level,
      message,
      data
    };

    logEntries.push(entry);

    // Keep only last 100 entries
    if (logEntries.length > 100) {
      logEntries = logEntries.slice(-100);
    }

    updateLogDisplay();

    // Also log to console
    const consoleMessage = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    if (data) {
      console[level === 'error' ? 'error' : 'log'](consoleMessage, data);
    } else {
      console[level === 'error' ? 'error' : 'log'](consoleMessage);
    }
  }

  function updateLogDisplay() {
    logsEntries.innerHTML = '';
    logCount.textContent = `${logEntries.length} entries`;

    logEntries.forEach(entry => {
      const div = document.createElement('div');
      div.className = `log-entry ${entry.level}`;

      let content = `<span class="log-timestamp">${entry.timestamp}</span>${entry.message}`;
      if (entry.data) {
        content += ` <details><summary>Data</summary><pre>${JSON.stringify(entry.data, null, 2)}</pre></details>`;
      }

      div.innerHTML = content;
      logsEntries.appendChild(div);
    });

    // Auto-scroll to bottom
    logsEntries.scrollTop = logsEntries.scrollHeight;
  }

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

  // Tab switching functionality
  tabButtons.forEach(button => {
    button.addEventListener('click', function() {
      const tabName = this.getAttribute('data-tab');

      // Remove active class from all buttons and contents
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));

      // Add active class to clicked button and corresponding content
      this.classList.add('active');
      document.getElementById(`${tabName}-tab`).classList.add('active');

      addLog('debug', `Switched to ${tabName} tab`);
    });
  });

  // Export logs functionality
  exportLogsBtn.addEventListener('click', function() {
    const logText = logEntries.map(entry => {
      let line = `[${entry.timestamp}] ${entry.level.toUpperCase()}: ${entry.message}`;
      if (entry.data) {
        line += ` | Data: ${JSON.stringify(entry.data)}`;
      }
      return line;
    }).join('\n');

    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `extension-logs-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    addLog('info', 'Logs exported to file');
  });

  // Select all button
  selectAllBtn.addEventListener('click', function() {
    const allSelected = conversionQueue.every(item => item.selected);
    conversionQueue.forEach(item => {
      item.selected = !allSelected;
    });
    updateQueueDisplay();
    selectAllBtn.textContent = allSelected ? 'Select All' : 'Deselect All';
    addLog('info', `Toggled selection: ${allSelected ? 'deselected all' : 'selected all'} videos`);
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

  // Clear logs
  clearLogsBtn.addEventListener('click', function() {
    logEntries = [];
    updateLogDisplay();
    addLog('info', 'Logs cleared by user');
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
        urlDisplay.textContent = 'Loading YouTube data...';
        convertBtn.disabled = true;

        // Extract data from the YouTube page
        const response = await chrome.tabs.sendMessage(currentTab.id, { action: 'extractYouTubeData' });

        if (response && response.success && response.data) {
          const youtubeData = response.data;

          if (youtubeData.type === 'playlist') {
            urlDisplay.textContent = `Playlist detected with ${youtubeData.videos.length} videos`;
            conversionQueue = youtubeData.videos.map(video => ({
              ...video,
              status: 'pending',
              selected: true
            }));
          } else if (youtubeData.type === 'single') {
            urlDisplay.textContent = `Single video: ${youtubeData.videos[0].title}`;
            conversionQueue = youtubeData.videos.map(video => ({
              ...video,
              status: 'pending',
              selected: true
            }));
          } else if (youtubeData.type === 'channel') {
            urlDisplay.textContent = `Channel page with ${youtubeData.videos.length} recent videos`;
            conversionQueue = youtubeData.videos.map(video => ({
              ...video,
              status: 'pending',
              selected: true
            }));
          } else {
            urlDisplay.textContent = 'Unable to extract YouTube data';
            showStatus('Could not extract video information from this page', 'error');
            return;
          }

          updateQueueDisplay();
          convertBtn.disabled = false;
          showStatus('Ready to convert', 'info');
        } else {
          urlDisplay.textContent = 'Failed to extract YouTube data';
          showStatus('Could not load YouTube data. Try refreshing the page.', 'error');
        }
      } else {
        urlDisplay.textContent = 'Not on a YouTube page';
        convertBtn.disabled = true;
        showStatus('Please navigate to YouTube', 'error');
      }
    } catch (error) {
      console.error('Initialization error:', error);
      urlDisplay.textContent = 'Error loading page data';
      showStatus('Error initializing extension', 'error');
    }
  }

  async function loadPlaylistVideos(playlistId) {
    // This function is now handled by the content script
    // Keeping for backward compatibility but it should not be called
    console.warn('loadPlaylistVideos called - this should use content script instead');
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
      /youtube\.com\/embed\/([^\/\?]+)/,  // Embed format
      /youtube\.com\/shorts\/([^\/\?]+)/  // Shorts format
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
    // This is now handled by the content script
    console.warn('extractVideoIdsFromPlaylist called - this should use content script instead');
    return [];
  }

  function updateQueueDisplay() {
    queueList.innerHTML = '';

    if (conversionQueue.length === 0) {
      queueList.innerHTML = '<div class="no-videos">No videos found</div>';
      return;
    }

    conversionQueue.forEach((item, index) => {
      const div = document.createElement('div');
      div.className = `queue-item ${item.status}`;

      const thumbnail = item.thumbnail || 'https://via.placeholder.com/120x90?text=No+Image';
      const title = (item.title || 'Unknown Title').length > 40 ?
        (item.title || 'Unknown Title').substring(0, 37) + '...' :
        (item.title || 'Unknown Title');
      const author = item.author || 'Unknown Author';
      const duration = item.duration || '';
      const isShort = item.isShort ? ' (Short)' : '';

      div.innerHTML = `
        <div class="video-thumbnail">
          <img src="${thumbnail}" alt="Thumbnail" onerror="this.src='https://via.placeholder.com/120x90?text=No+Image'">
          ${duration ? `<span class="duration">${duration}</span>` : ''}
        </div>
        <div class="video-info">
          <div class="video-title">${title}${isShort}</div>
          <div class="video-author">${author}</div>
          <div class="video-status">${item.status}</div>
        </div>
      `;

      // Add click handler for selection
      div.addEventListener('click', () => {
        item.selected = !item.selected;
        div.classList.toggle('selected');
      });

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
    if (isProcessing) {
      addLog('warning', 'Convert clicked while already processing');
      return;
    }

    if (conversionQueue.length === 0) {
      showStatus('No videos to convert', 'error');
      addLog('warning', 'Convert clicked with empty queue');
      return;
    }

    const selectedCount = conversionQueue.filter(item => item.selected).length;
    if (selectedCount === 0) {
      showStatus('No videos selected for conversion', 'warning');
      addLog('warning', 'Convert clicked with no videos selected');
      return;
    }

    addLog('info', `Starting conversion of ${selectedCount} selected videos`);
    isProcessing = true;
    convertBtn.disabled = true;
    progressContainer.style.display = 'block';
    showStatus('Starting conversion...', 'info');

    try {
      await processQueue();
    } catch (error) {
      addLog('error', 'Conversion process failed', { message: error.message, stack: error.stack });
      console.error('Conversion error:', error);
      showStatus(`Conversion failed: ${error.message}`, 'error');
    } finally {
      isProcessing = false;
      convertBtn.disabled = false;
      addLog('info', 'Conversion process finished');
    }
  });

  async function processQueue() {
    const selectedVideos = conversionQueue.filter(item => item.selected);
    addLog('info', `Processing ${selectedVideos.length} selected videos`);

    if (selectedVideos.length === 0) {
      addLog('warning', 'No videos selected for processing');
      showStatus('No videos selected for conversion', 'warning');
      return;
    }

    const total = selectedVideos.length;
    let completed = 0;
    let failed = 0;

    updateProgress(0, total, 'Starting batch conversion...');
    addLog('debug', 'Progress initialized', { total });

    for (let i = 0; i < selectedVideos.length; i++) {
      const item = selectedVideos[i];
      addLog('info', `Processing video ${i + 1}/${total}: ${item.title || item.id}`);
      item.status = 'processing';
      updateQueueDisplay();

      try {
        updateProgress(completed + failed, total, `Converting: ${item.title || item.id}`);
        await convertVideo(item, i + 1);
        item.status = 'completed';
        completed++;
        addLog('success', `Video completed: ${item.title || item.id}`);
      } catch (error) {
        addLog('error', `Video failed: ${item.title || item.id}`, { message: error.message });
        console.error(`Failed to convert ${item.id}:`, error);
        item.status = 'failed';
        failed++;
      }

      updateQueueDisplay();
    }

    updateProgress(total, total, `Batch complete: ${completed} successful, ${failed} failed`);
    showStatus(`Batch complete: ${completed} successful, ${failed} failed`, failed > 0 ? 'warning' : 'success');
    addLog('info', `Batch conversion complete`, { completed, failed, total });
  }

  async function convertVideo(item, index) {
    const format = formatSelect.value;
    const quality = qualitySelect.value;
    const downloadDir = downloadDirInput.value || 'Downloads/ConvertTheSpire';

    addLog('debug', `Converting video: ${item.title || item.id}`, { format, quality, downloadDir });

    let retries = 0;
    const maxRetries = settings.maxRetries;

    while (retries <= maxRetries) {
      try {
        addLog('debug', `Attempt ${retries + 1}/${maxRetries + 1} for video: ${item.title || item.id}`);
        const downloadUrl = await findDownloadUrl(item.url, format, quality);

        if (!downloadUrl) {
          throw new Error('Could not find download URL');
        }

        addLog('debug', 'Download URL obtained, starting download', { url: downloadUrl.substring(0, 50) + '...' });

        // Download with custom directory
        const sanitizedTitle = item.title.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, ' ').trim();
        const filename = `${downloadDir}/${sanitizedTitle}.${format}`;

        addLog('debug', 'Starting download', { filename });
        await chrome.downloads.download({
          url: downloadUrl,
          filename: filename,
          conflictAction: 'uniquify'
        });

        addLog('success', `Download started for: ${item.title || item.id}`);
        return; // Success

      } catch (error) {
        retries++;
        addLog('warning', `Attempt ${retries} failed for ${item.title || item.id}: ${error.message}`);
        if (retries <= maxRetries) {
          const delay = settings.retryDelay;
          addLog('info', `Retrying in ${delay} seconds...`);
          await new Promise(resolve => setTimeout(resolve, delay * 1000));
        } else {
          addLog('error', `All retry attempts failed for ${item.title || item.id}`);
          throw error;
        }
      }
    }
  }

  async function findDownloadUrl(videoUrl, format, quality) {
    addLog('debug', 'Finding download URL', { videoUrl: videoUrl.substring(0, 50) + '...', format, quality });

    // Try multiple services in order of preference
    const services = [
      { name: 'y2mate', url: 'https://api.y2mate.com/v2' },
      // Add more services here as fallbacks
    ];

    for (const service of services) {
      try {
        addLog('debug', `Trying service: ${service.name}`);
        if (service.name === 'y2mate') {
          const url = await tryY2Mate(service.url, videoUrl, format, quality);
          addLog('success', `Service ${service.name} succeeded`);
          return url;
        }
      } catch (error) {
        addLog('warning', `Service ${service.name} failed: ${error.message}`);
        continue;
      }
    }

    addLog('error', 'All download services failed');
    throw new Error('All download services failed');
  }

  async function tryY2Mate(baseUrl, videoUrl, format, quality) {
    addLog('debug', 'Analyzing video with y2mate');

    // Get cookies for the video URL
    const cookies = await chrome.cookies.getAll({ url: videoUrl });
    const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    addLog('debug', `Retrieved ${cookies.length} cookies`);

    // Analyze video
    const analyzeResponse = await fetch(`${baseUrl}/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieString
      },
      body: JSON.stringify({ url: videoUrl })
    });

    const analyzeData = await analyzeResponse.json();
    addLog('debug', 'Analyze response received', { status: analyzeData.status, vid: analyzeData.vid });

    if (analyzeData.status !== 'ok') {
      throw new Error('Failed to analyze video');
    }

    // Choose format
    const isAudio = format === 'mp3';
    const formats = isAudio ? analyzeData.a : analyzeData.v;
    addLog('debug', `Available ${isAudio ? 'audio' : 'video'} formats: ${formats?.length || 0}`);

    if (!formats || formats.length === 0) {
      throw new Error('No formats available');
    }

    // Choose quality
    let selectedFormat = formats[0];
    if (quality !== 'best') {
      selectedFormat = formats.find(f => f.q && f.q.includes(quality)) || formats[0];
    }
    addLog('debug', 'Selected format', { quality: selectedFormat.q, size: selectedFormat.size });

    // Convert
    const convertResponse = await fetch(`${baseUrl}/convert`, {
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
    addLog('debug', 'Convert response received', { status: convertData.status });

    if (convertData.status !== 'ok') {
      throw new Error('Conversion failed');
    }

    addLog('debug', 'Download URL obtained');
    return convertData.dlink;
  }
});