// Background script: handle requests from content scripts (e.g., fetch cookies)
// Firefox-only extension using Manifest V2 due to download restrictions in Chrome's Manifest V3

const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// Store YouTube data from content scripts
const youtubeDataStore = new Map();

browserAPI.runtime.onMessage.addListener((request, sender, sendResponse) => {
	// Handle YouTube data from content script
	if (request && request.type === 'YOUTUBE_DATA') {
		console.log('[Background] Received YouTube data from content script');
		const tabId = sender.tab ? sender.tab.id : 'unknown';
		youtubeDataStore.set(tabId, request.data);
		sendResponse({ success: true });
		return false;
	}

	// Handle request for YouTube data from popup
	if (request && request.action === 'getYouTubeData') {
		console.log('[Background] Popup requesting YouTube data');
		const tabId = request.tabId;
		const data = youtubeDataStore.get(tabId);
		if (data) {
			sendResponse({ success: true, data: data });
		} else {
			sendResponse({ success: false, message: 'No data available' });
		}
		return false;
	}

	if (request && request.action === 'getCookies') {
		const url = request.url || (sender.tab && sender.tab.url) || '';
		try {
			browserAPI.cookies.getAll({ url }, (cookies) => {
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
				console.log('[Background] item streams?', item && item.streams ? {
					progressive: item.streams.progressive?.length || 0,
					video: item.streams.video?.length || 0,
					audio: item.streams.audio?.length || 0
				} : 'NO STREAMS');

				const downloadUrl = await findDownloadUrl(item.url, format, quality, item);

				if (!downloadUrl) {
					sendResponse({ success: false, message: 'Unable to find download URL' });
					return;
				}

				const sanitizedTitle = (item.title || item.id || 'video').replace(/[<>:\"\/\\|?*]/g, '_').replace(/\s+/g, ' ').trim();
				const filename = `${downloadDir}/${sanitizedTitle}.${format}`;

				browserAPI.downloads.download({ url: downloadUrl, filename, conflictAction: 'uniquify' }, (downloadId) => {
					if (browserAPI.runtime.lastError) {
						console.error('[Background] download error', browserAPI.runtime.lastError.message);
						sendResponse({ success: false, message: browserAPI.runtime.lastError.message });
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
				sendResponse({ success: false, message: err.message, diagnostics: err.diagnostics || null });
			}
		})();

		return true; // async
	}
});

// Track downloads and notify popup of progress
const downloadMap = new Map();

browserAPI.downloads.onChanged.addListener((delta) => {
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
		browserAPI.runtime.sendMessage(msg);

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
		const availableProgressive = (streams.progressive || []).length;
		console.log('[Background] Selecting stream', { format, quality, availableVideo, availableAudio, availableProgressive });

		let selectedStream = null;
		if (format === 'mp3' || format === 'audio') {
			if (availableAudio > 0) selectedStream = streams.audio[0];
			else if (availableProgressive > 0) selectedStream = streams.progressive[0]; // Progressive has audio
			else if (availableVideo > 0) selectedStream = streams.video.find(s => s.hasAudio) || streams.video[0];
		} else {
			// For video formats (mp4, etc.), prefer progressive (has video+audio)
			if (availableProgressive > 0) {
				if (quality === 'best') {
					// Sort by quality, highest first
					const sorted = [...streams.progressive].sort((a, b) => {
						const aHeight = parseInt((a.quality || '0p').replace('p', ''));
						const bHeight = parseInt((b.quality || '0p').replace('p', ''));
						return bHeight - aHeight;
					});
					selectedStream = sorted[0];
				} else {
					const targetHeight = quality.replace('p', '');
					selectedStream = streams.progressive.find(s => (s.quality || '').includes(targetHeight)) || streams.progressive[0];
				}
			} else if (availableVideo > 0) {
				if (quality === 'best') selectedStream = streams.video[0];
				else {
					const targetHeight = quality.replace('p', '');
					selectedStream = streams.video.find(s => (s.quality || '').includes(targetHeight)) || streams.video[0];
				}
			}
		}

		if (!selectedStream || !selectedStream.url) {
			console.log('[Background] No selected stream or URL:', selectedStream ? 'has stream but no URL' : 'no stream');
			return null;
		}
		
		console.log('[Background] Testing stream URL:', selectedStream.url.substring(0, 100) + '...');

		try {
			const test = await fetchWithTimeout(selectedStream.url, { method: 'HEAD' }, 5000);
			if (test.ok) {
				console.log('[Background] ✓ Stream URL works!');
				return selectedStream.url;
			}
			console.warn('[Background] Stream URL returned status:', test.status);
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

// Helper: extract video id from various YouTube url forms
function extractVideoIdFromUrl(url) {
	if (!url) return null;
	const patterns = [/[?&]v=([^#\&\?]*)/, /youtu\.be\/([^\/\?]+)/, /youtube\.com\/embed\/([^\/\?]+)/, /youtube\.com\/shorts\/([^\/\?]+)/];
	for (const p of patterns) {
		const m = url.match(p);
		if (m && m[1]) return m[1];
	}
	return null;
}

// Fetch YouTube player_response via get_video_info and parse it
async function fetchPlayerResponseFromYouTube(videoUrl) {
	try {
		const vid = extractVideoIdFromUrl(videoUrl);
		if (!vid) throw new Error('No video id');
		const url = `https://www.youtube.com/get_video_info?video_id=${encodeURIComponent(vid)}&el=detailpage&hl=en`;
		console.log('[Background] Fetching get_video_info for', vid);
		const resp = await fetchWithTimeout(url, { method: 'GET', credentials: 'include' }, 15000);
		if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
		const text = await resp.text();
		// Log a truncated snippet of the raw get_video_info response for debugging
		try { console.debug('[Background] get_video_info raw:', text.substring(0, 2000)); } catch (e) { /* ignore */ }
		const params = new URLSearchParams(text);
		const player_response_text = params.get('player_response') || params.get('playerResponse');
		if (!player_response_text) {
			return { player: null, rawText: text };
		}
		const player = JSON.parse(player_response_text);
		return { player, rawText: text };
	} catch (err) {
		console.warn('[Background] fetchPlayerResponseFromYouTube failed', err.message);
		return { player: null, rawText: null, error: err.message };
	}
}

// Cache for fetched player JS
const playerJsCache = new Map();

// Parse streamingData from player_response and return streams object like content script
async function extractStreamingUrlsFromPlayer(player) {
	const streams = { video: [], audio: [] };
	if (!player) return streams;
	const streamingData = player.streamingData || player?.player_response?.streamingData || null;
	if (!streamingData) return streams;
	try {
		if (streamingData.formats) {
			for (const format of streamingData.formats) {
				let url = format.url || null;
				let signature = null;
				if (!url && format.signatureCipher) {
					const params = new URLSearchParams(format.signatureCipher);
					url = params.get('url') || null;
					signature = { s: params.get('s'), sp: params.get('sp') || 'signature' };
				}
				if (signature && signature.s) {
					try {
						const playerJs = player?.assets?.js || player?.js || null;
						if (playerJs) {
							const dec = await decipherSignature(signature.s, playerJs);
							if (dec) {
								const sep = url && url.includes('?') ? '&' : '?';
								url = `${url}${sep}${signature.sp}=${encodeURIComponent(dec)}`;
							}
						}
					} catch (e) {
						console.warn('[Background] signature decipher error', e.message);
					}
				}
				streams.video.push({ url: url || '', quality: format.qualityLabel || `${format.height}p`, type: 'progressive', container: (format.mimeType||'').split(';')[0].split('/')[1] || 'mp4', bitrate: format.bitrate, contentLength: format.contentLength, hasAudio: true, hasVideo: true });
			}
		}
		if (streamingData.adaptiveFormats) {
			for (const format of streamingData.adaptiveFormats) {
				let url = format.url || null;
				let signature = null;
				if (!url && format.signatureCipher) {
					const params = new URLSearchParams(format.signatureCipher);
					url = params.get('url') || null;
					signature = { s: params.get('s'), sp: params.get('sp') || 'signature' };
				}
				if (signature && signature.s) {
					try {
						const playerJs = player?.assets?.js || player?.js || null;
						if (playerJs) {
							const dec = await decipherSignature(signature.s, playerJs);
							if (dec) {
								const sep = url && url.includes('?') ? '&' : '?';
								url = `${url}${sep}${signature.sp}=${encodeURIComponent(dec)}`;
							}
						}
					} catch (e) {
						console.warn('[Background] signature decipher error', e.message);
					}
				}
				const isAudio = (format.mimeType||'').includes('audio');
				const streamType = isAudio ? 'audio' : 'video';
				streams[streamType].push({ url: url || '', quality: format.qualityLabel || (isAudio ? `${format.bitrate}kbps` : `${format.height}p`), type: 'adaptive', container: (format.mimeType||'').split(';')[0].split('/')[1] || (isAudio ? 'mp4' : 'mp4'), bitrate: format.bitrate, contentLength: format.contentLength, hasAudio: isAudio, hasVideo: !isAudio, fps: format.fps });
			}
		}
		streams.video.sort((a,b)=>{ const aQ=parseInt(a.quality)||0; const bQ=parseInt(b.quality)||0; return bQ-aQ; });
		streams.audio.sort((a,b)=>{ const aB=parseInt(a.bitrate)||0; const bB=parseInt(b.bitrate)||0; return bB-aB; });
	} catch (e) {
		console.warn('[Background] extractStreamingUrlsFromPlayer error', e.message);
	}
	return streams;
}

// Fetch player JS (absolute or relative) and cache it
async function fetchPlayerJsText(playerJsUrl) {
	if (!playerJsUrl) return null;
	let fullUrl = playerJsUrl;
	if (playerJsUrl.startsWith('//')) fullUrl = 'https:' + playerJsUrl;
	if (playerJsUrl.startsWith('/')) fullUrl = 'https://www.youtube.com' + playerJsUrl;
	if (playerJsCache.has(fullUrl)) return playerJsCache.get(fullUrl);
	try {
		const resp = await fetchWithTimeout(fullUrl, { method: 'GET' }, 15000);
		if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
		const text = await resp.text();
		playerJsCache.set(fullUrl, text);
		try { console.debug('[Background] fetched player JS snippet:', text.substring(0,2000)); } catch(e){}
		return text;
	} catch (e) {
		console.warn('[Background] fetchPlayerJsText failed', e.message);
		return null;
	}
}

// Heuristic decipher implementation: parse player JS to extract simple transform sequence
async function decipherSignature(s, playerJsUrl) {
	try {
		const jsText = await fetchPlayerJsText(playerJsUrl);
		if (!jsText) return null;

		// Find the name of the function that transforms the signature (looks for function that uses split and join)
		const fnNameMatch = jsText.match(/([a-zA-Z0-9$]{2,})=function\(a\)\{a=a\.split\(""\)/);
		let fnName = fnNameMatch ? fnNameMatch[1] : null;
		if (!fnName) {
			const altMatch = jsText.match(/function\s+([a-zA-Z0-9$]{2,})\(a\)\{a=a\.split\(""\)/);
			fnName = altMatch ? altMatch[1] : null;
		}

		// If we couldn't find a main function, try to find sequence calls like "a=a.split("")...;return a.join("")"
		let fnBody = null;
		if (fnName) {
			const re = new RegExp(fnName + "=function\\(a\\)\\{([\\s\\S]*?)\\}");
			const m = jsText.match(re);
			fnBody = m ? m[1] : null;
		} else {
			const m2 = jsText.match(/function\s+[a-zA-Z0-9$]{2,}\(a\)\{([\s\S]*?)\}/);
			fnBody = m2 ? m2[1] : null;
		}

		// If we have a function body, try to extract a sequence of operations referencing a helper object
		let ops = null;
		if (fnBody) {
			// Find helper object name used inside (e.g., var bH={...};) referenced like bH.x(a,3)
			const objNameMatch = fnBody.match(/([a-zA-Z0-9$]{2,})\.[a-zA-Z0-9$]{1,}\(a,\d+\)/);
			const objName = objNameMatch ? objNameMatch[1] : null;
			if (objName) {
				// Extract object definition
				const objRe = new RegExp('var ' + objName + '=\{([\\s\\S]*?)\};');
				const objMatch = jsText.match(objRe);
				const objBody = objMatch ? objMatch[1] : '';

				// Map helper keys to operations by inspecting function bodies
				const opsMap = {};
				const fnPairs = objBody.match(/([a-zA-Z0-9$]{1,}):function\([a-z,]+\)\{([\s\S]*?)\}/g) || [];
				for (const pair of fnPairs) {
					const nameMatch = pair.match(/([a-zA-Z0-9$]{1,}):function/);
					const key = nameMatch ? nameMatch[1] : null;
					if (!key) continue;
					if (pair.includes('.reverse(') || pair.includes('reverse()')) opsMap[key] = 'reverse';
					else if (pair.includes('.splice(') || pair.includes('splice(')) opsMap[key] = 'splice';
					else if (pair.match(/var\s+[a-z]=a\[0\];a\[0\]=a\[b%a\.length\];a\[b%a\.length\]=[a]/)) opsMap[key] = 'swap';
					else if (pair.includes('var c=a[0]') || pair.includes('a[0]=a[b%a.length]')) opsMap[key] = 'swap';
				}

				// Extract sequence of calls in the main function body
				const callRe = new RegExp(objName + '\\.([a-zA-Z0-9$]{1,})\(a,(\d+)\)', 'g');
				ops = [];
				let callMatch;
				while ((callMatch = callRe.exec(fnBody)) !== null) {
					const key = callMatch[1];
					const arg = parseInt(callMatch[2], 10);
					const op = opsMap[key] || 'unknown';
					ops.push({ op, arg });
				}
			}
		}

		// Fallback: try to infer simple operations if no ops found (common patterns)
		if (!ops || ops.length === 0) {
			// Try to detect simple reverse or splice in the function body
			if (fnBody && fnBody.includes('reverse')) ops = [{ op: 'reverse' }];
			else if (fnBody && fnBody.includes('splice')) ops = [{ op: 'splice', arg: 3 }];
		}

		// Apply operations to signature
		let arr = s.split('');
		if (ops && ops.length > 0) {
			for (const step of ops) {
				if (step.op === 'reverse') arr = arr.reverse();
				else if (step.op === 'splice') arr.splice(0, step.arg || 1);
				else if (step.op === 'swap') {
					const i = step.arg || 0;
					const j = i % arr.length;
					const tmp = arr[0]; arr[0] = arr[j]; arr[j] = tmp;
				} else {
					// unknown: try simple rotate by arg
					if (typeof step.arg === 'number') {
						const n = step.arg % arr.length;
						arr = arr.slice(n).concat(arr.slice(0, n));
					}
				}
			}
			return arr.join('');
		}

		return null;
	} catch (e) {
		console.warn('[Background] decipherSignature failed', e.message);
		return null;
	}
}

async function tryY2Mate(baseUrl, videoUrl, format, quality) {
	try {
		const cookies = await new Promise((resolve) => browserAPI.cookies.getAll({ url: videoUrl }, (c) => resolve(c)));
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

		if (!analyzeResponse.ok) {
			const raw = await analyzeResponse.text().catch(()=>'');
			console.warn('[Background] y2mate analyze non-OK', analyzeUrl, analyzeResponse.status, (raw||'').substring(0,2000));
			throw new Error(`HTTP ${analyzeResponse.status}`);
		}
		const analyzeText = await analyzeResponse.text();
		let analyzeData;
		try {
			analyzeData = JSON.parse(analyzeText);
		} catch (e) {
			console.warn('[Background] y2mate analyze parse error', e.message);
			console.debug('[Background] y2mate analyze raw snippet:', analyzeText.substring(0,2000));
			throw new Error('Invalid JSON from y2mate analyze');
		}
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

		if (!convertResponse.ok) {
			const rawc = await convertResponse.text().catch(()=>'');
			console.warn('[Background] y2mate convert non-OK', convertUrl, convertResponse.status, (rawc||'').substring(0,2000));
			throw new Error(`Convert HTTP ${convertResponse.status}`);
		}
		const convertText = await convertResponse.text();
		let convertData;
		try {
			convertData = JSON.parse(convertText);
		} catch (e) {
			console.warn('[Background] y2mate convert parse error', e.message);
			console.debug('[Background] y2mate convert raw snippet:', convertText.substring(0,2000));
			throw new Error('Invalid JSON from y2mate convert');
		}
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
	if (!resp.ok) {
		const txt = await resp.text().catch(()=>'');
		console.warn('[Background] tryGenericApi non-OK response', url, resp.status, (txt||'').substring(0,2000));
		throw new Error(`HTTP ${resp.status}`);
	}
	const text = await resp.text();
	try {
		const data = JSON.parse(text);
		if (data.status === 'success' && data.download_url) return data.download_url;
		throw new Error(data.message || 'failed');
	} catch (e) {
		console.warn('[Background] tryGenericApi parse error or unexpected response', e.message);
		console.debug('[Background] tryGenericApi raw response snippet:', text.substring(0,2000));
		throw new Error(`Invalid JSON response from ${url}: ${e.message}`);
	}
}

async function findDownloadUrl(videoUrl, format, quality, videoData = null) {
		console.log('[Background] Finding download URL', { videoUrl: videoUrl && videoUrl.substring ? videoUrl.substring(0,60) : videoUrl, format, quality });

		const diagnostics = [];

		// Try streams provided by the page first (should have decrypted URLs from injected script)
		if (videoData && videoData.streams) {
				diagnostics.push({ method: 'page_streams', videoCount: (videoData.streams.video||[]).length, audioCount: (videoData.streams.audio||[]).length });
				const direct = await tryDirectYouTubeStreams(videoData.streams, format, quality);
				diagnostics.push({ method: 'page_streams_test', result: !!direct });
				if (direct) return direct;
		} else {
				diagnostics.push({ method: 'page_streams', present: false });
		}

		// Try to fetch player_response via get_video_info and use its streamingData
		try {
			const pr = await fetchPlayerResponseFromYouTube(videoUrl);
			if (pr && pr.rawText) diagnostics.push({ method: 'get_video_info_raw_snippet', snippet: pr.rawText.substring(0,1000) });
			if (pr && pr.player && pr.player.streamingData) {
				diagnostics.push({ method: 'get_video_info', streamingDataFound: true });
				console.log('[Background] Found streamingData via get_video_info');
				const streams = await extractStreamingUrlsFromPlayer(pr.player);
				const direct2 = await tryDirectYouTubeStreams(streams, format, quality);
				diagnostics.push({ method: 'get_video_info_stream_test', result: !!direct2 });
				if (direct2) return direct2;
			} else {
				diagnostics.push({ method: 'get_video_info', streamingDataFound: false, error: pr && pr.error ? pr.error : null });
			}
		} catch (e) {
			console.warn('[Background] get_video_info fallback failed', e.message);
			diagnostics.push({ method: 'get_video_info', error: e.message });
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
			diagnostics.push({ method: 'service', name: svc.name, success: !!url, urlSnippet: url ? (''+url).substring(0,200) : null });
			if (url) return url;
		} catch (err) {
			console.warn('[Background] service failed', svc.name, err.message);
			diagnostics.push({ method: 'service', name: svc.name, error: err.message });
			try { console.debug('[Background] service failure details', svc.name, err); } catch(e){}
			continue;
		}
	}

	const err = new Error('All services failed');
	err.diagnostics = diagnostics;
	throw err;
}