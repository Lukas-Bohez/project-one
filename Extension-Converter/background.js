// Background script: handle requests from content scripts (e.g., fetch cookies)

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	if (request && request.action === 'getCookies') {
		const url = request.url || (sender.tab && sender.tab.url) || '';
		try {
			chrome.cookies.getAll({ url }, (cookies) => {
				sendResponse({ success: true, cookies });
			});
			return true; // indicate async response
		} catch (error) {
			sendResponse({ success: false, message: error.message });
			return false;
		}
	}
  
	if (request && request.action === 'proxyFetch') {
		// request: { url, options, timeout }
		const url = request.url;
		const options = request.options || {};
		const timeout = request.timeout || 15000;

		(async () => {
			const controller = new AbortController();
			const id = setTimeout(() => controller.abort(), timeout);
			try {
				// Ensure options does not contain non-clonable fields
				const fetchOptions = { ...(options || {}) };
				// allow caller to request credentials: 'include' to send cookies for the target
				if (options && options.credentials) fetchOptions.credentials = options.credentials;

				const resp = await fetch(url, { ...fetchOptions, signal: controller.signal });
				clearTimeout(id);
				const contentType = resp.headers.get('content-type') || '';
				let text;
				// Try to read text for debugging; binary responses will be base64-encoded if requested by caller
				try {
					text = await resp.text();
				} catch (e) {
					text = '';
				}
				const headers = {};
				resp.headers.forEach((v, k) => { headers[k] = v; });
				sendResponse({ success: true, ok: resp.ok, status: resp.status, statusText: resp.statusText, headers, text, contentType });
			} catch (err) {
				clearTimeout(id);
				sendResponse({ success: false, message: err.message });
			}
		})();

		return true; // async
	}

	if (request && request.action === 'startConversion') {
		// request: { item, format, quality, downloadDir }
		const { item, format = 'mp3', quality = 'best', downloadDir = 'Downloads/ConvertTheSpire' } = request;

		(async () => {
			try {
				console.log('[Background] startConversion for', item && (item.id || item.url));

				const downloadUrl = await findDownloadUrl(item.url, format, quality, item);

				if (!downloadUrl) {
					sendResponse({ success: false, message: 'Unable to find download URL' });
					return;
				}

				const sanitizedTitle = (item.title || item.id || 'video').replace(/[<>:\"\/\\|?*]/g, '_').replace(/\s+/g, ' ').trim();
				const filename = `${downloadDir}/${sanitizedTitle}.${format}`;

				chrome.downloads.download({ url: downloadUrl, filename, conflictAction: 'uniquify' }, (downloadId) => {
					if (chrome.runtime.lastError) {
						console.error('[Background] download error', chrome.runtime.lastError.message);
						sendResponse({ success: false, message: chrome.runtime.lastError.message });
					} else {
						console.log('[Background] download started', downloadId);
						// track mapping from downloadId -> item
						try {
							downloadMap.set(downloadId, { itemId: item.id, item });
						} catch (e) { /* ignore */ }
						sendResponse({ success: true, downloadId });
					}
				});
			} catch (err) {
				console.error('[Background] startConversion failed', err);
				sendResponse({ success: false, message: err.message });
			}
		})();

		return true; // async
	}
});

// Track downloads and notify popup of progress
const downloadMap = new Map();

chrome.downloads.onChanged.addListener((delta) => {
	try {
		const info = downloadMap.get(delta.id);
		const msg = { action: 'downloadProgress', downloadId: delta.id };

		if (delta.state && delta.state.current) {
			msg.state = delta.state.current; // 'in_progress', 'complete', 'interrupted'
		}
		if (delta.bytesReceived) msg.bytesReceived = delta.bytesReceived.current;
		if (delta.totalBytes) msg.totalBytes = delta.totalBytes.current;

		if (info && info.itemId) msg.itemId = info.itemId;

		// Broadcast to all extension contexts (popup will receive it if open)
		chrome.runtime.sendMessage(msg);

		if (msg.state === 'complete' || msg.state === 'interrupted') {
			// cleanup mapping after finished
			downloadMap.delete(delta.id);
		}
	} catch (e) {
		console.error('[Background] downloads.onChanged error', e);
	}
});

// --- Helper functions for finding download URLs ---
async function fetchWithTimeout(url, options = {}, timeout = 15000) {
	const controller = new AbortController();
	const id = setTimeout(() => controller.abort(), timeout);
	try {
		const resp = await fetch(url, { ...options, signal: controller.signal });
		clearTimeout(id);
		return resp;
	} catch (err) {
		clearTimeout(id);
		throw err;
	}
}

async function tryDirectYouTubeStreams(streams, format, quality) {
	try {
		if (!streams) return null;
		const availableVideo = (streams.video || []).length;
		const availableAudio = (streams.audio || []).length;
		console.log('[Background] Selecting stream', { format, quality, availableVideo, availableAudio });

		let selectedStream = null;
		if (format === 'mp3' || format === 'audio') {
			if (availableAudio > 0) selectedStream = streams.audio[0];
			else if (availableVideo > 0) selectedStream = streams.video.find(s => s.hasAudio) || streams.video[0];
		} else {
			if (availableVideo > 0) {
				if (quality === 'best') selectedStream = streams.video[0];
				else {
					const targetHeight = quality.replace('p', '');
					selectedStream = streams.video.find(s => (s.quality || '').includes(targetHeight)) || streams.video[0];
				}
			}
		}

		if (!selectedStream || !selectedStream.url) return null;

		try {
			const test = await fetchWithTimeout(selectedStream.url, { method: 'HEAD' }, 5000);
			if (test.ok) return selectedStream.url;
			return null;
		} catch (e) {
			console.warn('[Background] stream test failed', e.message);
			return null;
		}
	} catch (e) {
		console.error('[Background] tryDirectYouTubeStreams error', e);
		return null;
	}
}

async function tryY2Mate(baseUrl, videoUrl, format, quality) {
	try {
		const cookies = await new Promise((resolve) => chrome.cookies.getAll({ url: videoUrl }, (c) => resolve(c)));
		const cookieString = (cookies || []).map(c => `${c.name}=${c.value}`).join('; ');

		let analyzeUrl = `${baseUrl}/analyze`;
		let analyzeResponse = await fetchWithTimeout(analyzeUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'Cookie': cookieString },
			body: JSON.stringify({ url: videoUrl })
		}, 15000);

		if (!analyzeResponse.ok) {
			analyzeUrl = 'https://www.y2mate.com/mates/analyzeV2';
			analyzeResponse = await fetchWithTimeout(analyzeUrl, {
				method: 'POST',
				headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cookie': cookieString },
				body: `url=${encodeURIComponent(videoUrl)}`
			}, 15000);
		}

		if (!analyzeResponse.ok) throw new Error(`HTTP ${analyzeResponse.status}`);
		const analyzeData = await analyzeResponse.json();
		const isAudio = format === 'mp3';
		const formats = isAudio ? (analyzeData.a || analyzeData.audio) : (analyzeData.v || analyzeData.video);
		if (!formats || formats.length === 0) throw new Error('No formats');
		let selectedFormat = formats[0];
		if (quality !== 'best') selectedFormat = formats.find(f => f.q && f.q.includes(quality)) || formats[0];

		let convertUrl = `${baseUrl}/convert`;
		let convertResponse = await fetchWithTimeout(convertUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'Cookie': cookieString },
			body: JSON.stringify({ vid: analyzeData.vid, k: selectedFormat.k })
		}, 15000);

		if (!convertResponse.ok) {
			convertUrl = 'https://www.y2mate.com/mates/convertV2';
			convertResponse = await fetchWithTimeout(convertUrl, {
				method: 'POST',
				headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cookie': cookieString },
				body: `vid=${analyzeData.vid}&k=${selectedFormat.k}`
			}, 15000);
		}

		if (!convertResponse.ok) throw new Error(`Convert HTTP ${convertResponse.status}`);
		const convertData = await convertResponse.json();
		if (!convertData.dlink && !convertData.download_url) throw new Error('No download link');
		return convertData.dlink || convertData.download_url;
	} catch (err) {
		console.warn('[Background] y2mate error', err.message);
		throw err;
	}
}

async function tryGenericApi(baseUrl, endpoint, videoUrl, format, quality) {
	const url = `${baseUrl}${endpoint}`;
	const resp = await fetchWithTimeout(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ url: videoUrl, format, quality })
	}, 15000);
	if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
	const data = await resp.json();
	if (data.status === 'success' && data.download_url) return data.download_url;
	throw new Error(data.message || 'failed');
}

async function findDownloadUrl(videoUrl, format, quality, videoData = null) {
	console.log('[Background] Finding download URL', { videoUrl: videoUrl && videoUrl.substring ? videoUrl.substring(0,60) : videoUrl, format, quality });

	if (videoData && videoData.streams) {
		const direct = await tryDirectYouTubeStreams(videoData.streams, format, quality);
		if (direct) return direct;
	}

	const services = [
		{ name: 'ytmp3', fn: async () => tryGenericApi('https://api.ytmp3.cc', '/api/convert', videoUrl, format, quality) },
		{ name: 'y2mate', fn: async () => tryY2Mate('https://api.y2mate.is', videoUrl, format, quality) },
		{ name: 'yt1s', fn: async () => tryGenericApi('https://api.yt1s.com', '/api/convert', videoUrl, format, quality) },
		{ name: 'y2meta', fn: async () => tryGenericApi('https://api.y2meta.com', '/api/analyze', videoUrl, format, quality) },
		{ name: 'yt5s', fn: async () => tryGenericApi('https://api.yt5s.com', '/api/analyze', videoUrl, format, quality) }
	];

	for (const svc of services) {
		try {
			console.log('[Background] Trying service', svc.name);
			const url = await svc.fn();
			if (url) return url;
		} catch (err) {
			console.warn('[Background] service failed', svc.name, err.message);
			continue;
		}
	}

	throw new Error('All services failed');
}