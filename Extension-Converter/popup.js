document.addEventListener('DOMContentLoaded', function() {
  const urlDisplay = document.getElementById('url-display');
  const formatSelect = document.getElementById('format');
  const qualitySelect = document.getElementById('quality');
  const convertBtn = document.getElementById('convert-btn');
  const statusDiv = document.getElementById('status');

  // Get current tab
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    const tab = tabs[0];
    const url = tab.url;
    
    if (url && url.includes('youtube.com')) {
      if (url.includes('list=')) {
        urlDisplay.textContent = 'Playlists not supported yet. Please use individual videos.';
        convertBtn.disabled = true;
        statusDiv.textContent = '';
        statusDiv.className = 'status error';
      } else {
        urlDisplay.textContent = `Current: ${url}`;
        convertBtn.disabled = false;
      }
    } else {
      urlDisplay.textContent = 'Not on a YouTube page';
      convertBtn.disabled = true;
      statusDiv.textContent = 'Please navigate to a YouTube video';
      statusDiv.className = 'status error';
    }
  });

  convertBtn.addEventListener('click', async function() {
    const format = formatSelect.value;
    const quality = qualitySelect.value;
    
    statusDiv.textContent = 'Starting conversion...';
    statusDiv.className = 'status';
    convertBtn.disabled = true;
    
    try {
      // Get current tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];
      
      if (tab.url.includes('list=')) {
        throw new Error('Playlists not supported yet');
      }
      
      // Get cookies
      const cookies = await chrome.cookies.getAll({ url: tab.url });
      const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');
      
      // Analyze video
      statusDiv.textContent = 'Analyzing video...';
      const analyzeResponse = await fetch('https://api.y2mate.com/v2/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': cookieString
        },
        body: JSON.stringify({ url: tab.url })
      });
      
      const analyzeData = await analyzeResponse.json();
      if (analyzeData.status !== 'ok') {
        throw new Error('Failed to analyze video');
      }
      
      // Choose format
      const isAudio = format === 'mp3';
      const formats = isAudio ? analyzeData.a : analyzeData.v;
      if (!formats || formats.length === 0) {
        throw new Error('No formats available');
      }
      
      // Choose quality - for simplicity, choose the first one, or map
      let selectedFormat = formats[0]; // default to first
      if (quality !== 'best') {
        // Try to find matching quality
        selectedFormat = formats.find(f => f.q.includes(quality)) || formats[0];
      }
      
      // Convert
      statusDiv.textContent = 'Converting...';
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
      
      // Download
      statusDiv.textContent = 'Downloading...';
      await chrome.downloads.download({
        url: convertData.dlink,
        filename: `${analyzeData.title}.${isAudio ? 'mp3' : 'mp4'}`
      });
      
      statusDiv.textContent = 'Download started!';
      statusDiv.className = 'status success';
      convertBtn.disabled = false;
      
    } catch (error) {
      statusDiv.textContent = `Error: ${error.message}`;
      statusDiv.className = 'status error';
      convertBtn.disabled = false;
    }
  });

  async function pollDownloadStatus(downloadId) {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`http://localhost:8001/api/v1/video/status/${downloadId}`);
        const status = await response.json();
        
        if (status.finished) {
          clearInterval(pollInterval);
          if (status.file_path) {
            statusDiv.textContent = 'Download ready! Downloading...';
            // Trigger download
            chrome.downloads.download({
              url: `http://localhost:8001${status.file_path}`,
              filename: status.title + (status.format === 'MP3' ? '.mp3' : '.mp4')
            });
            statusDiv.textContent = 'Download started!';
          } else if (status.error) {
            statusDiv.textContent = `Error: ${status.error}`;
            statusDiv.className = 'status error';
            convertBtn.disabled = false;
          }
        } else {
          statusDiv.textContent = `Status: ${status.status} (${Math.round(status.progress * 100)}%)`;
        }
      } catch (error) {
        clearInterval(pollInterval);
        statusDiv.textContent = `Error checking status: ${error.message}`;
        statusDiv.className = 'status error';
        convertBtn.disabled = false;
      }
    }, 2000);
  }
});