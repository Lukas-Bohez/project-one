/**
 * Avatar Studio — Timeline Dubbing & Audio Export
 * Record each line with your microphone, then assemble all clips
 * at their timeline offsets into one downloadable MP3.
 */

const AppState = {
  theme: 'dark',
  selectedVoice: null,
  studio: { blocks: [], isPlaying: false, playAbortController: null },
  mediaRecorder: null,
  recordingBlock: null,
  audioCtx: null
};

/* ── UTILITY ── */
const $ = (s, c) => (c || document).querySelector(s);
const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));
function estimateDuration(text) {
  if (!text || !text.trim()) return 0;
  const w = text.trim().split(/\s+/).length;
  return Math.max(0.3, (w / 2.5 + text.toLowerCase().replace(/[^a-z]/g, '').length * 0.35 / 4.5) / 2);
}

/* ── THEME ── */
function loadTheme() { try { AppState.theme = localStorage.getItem('av-theme') || 'dark'; } catch (e) { } }
function applyTheme() {
  document.body.classList.toggle('theme-dark', AppState.theme === 'dark');
  document.body.classList.toggle('theme-light', AppState.theme === 'light');
  try { localStorage.setItem('av-theme', AppState.theme); } catch (e) { }
}

/* ── VOICE ── */
function populateVoiceSelect() {
  const s = document.getElementById('browserVoiceSelect');
  if (!s) return;
  function load() {
    let v = window.speechSynthesis?.getVoices() || []; if (!v.length) { setTimeout(load, 200); return; }
    s.innerHTML = '';
    v.sort((a, b) => a.lang.localeCompare(b.lang));
    v.forEach(x => { const e = document.createElement('option'); e.value = x.name; e.textContent = `${x.name} (${x.lang})`; if (x.name === AppState.selectedVoice) e.selected = true; s.appendChild(e); });
    if (!AppState.selectedVoice && v.length > 0) { AppState.selectedVoice = v[0].name; s.value = v[0].name; }
  }
  load();
  if (window.speechSynthesis) window.speechSynthesis.addEventListener('voiceschanged', load);
  s.addEventListener('change', () => { AppState.selectedVoice = s.value; try { localStorage.setItem('av-selected-voice', AppState.selectedVoice); } catch (e) { } });
}

/* ── BROWSER SPEECH (preview only) ── */
function speakBrowser(text) {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) { resolve(); return; }
    const u = new SpeechSynthesisUtterance(text);
    if (AppState.selectedVoice) { const v = window.speechSynthesis.getVoices().find(x => x.name === AppState.selectedVoice); if (v) u.voice = v; }
    u.onend = u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
}

/* ═══════════════════════════════════════════════
   AUDIO RECORDING & MP3 EXPORT
   ═══════════════════════════════════════════════ */

function getAudioContext() {
  if (!AppState.audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    AppState.audioCtx = new AC();
  }
  return AppState.audioCtx;
}

function blobToArrayBuffer(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsArrayBuffer(blob);
  });
}

async function decodeBlob(blob) {
  const ctx = getAudioContext();
  const ab = await blobToArrayBuffer(blob);
  return ctx.decodeAudioData(ab);
}

function getSupportedMimeType() {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg', 'audio/mp4'];
  for (const t of types) if (MediaRecorder.isTypeSupported(t)) return t;
  return '';
}

function startRecording(block, recBtn, stopBtn) {
  return new Promise(async (resolve, reject) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = getSupportedMimeType();
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      const chunks = [];
      recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        block.audioBlob = new Blob(chunks, { type: mime || 'audio/webm' });
        block.audioMime = mime || 'audio/webm';
        block.duration = estimateDuration(block.text || '');
        updateBlockUI(block);
        resolve();
      };
      recorder.onerror = (e) => { stream.getTracks().forEach(t => t.stop()); reject(e); };
      AppState.mediaRecorder = recorder;
      AppState.recordingBlock = block;
      recorder.start(100);
      recBtn?.classList.add('av-studio-block__record--hidden');
      stopBtn?.classList.remove('av-studio-block__record--hidden');
    } catch (e) {
      reject(e);
    }
  });
}

function stopRecording(recBtn, stopBtn) {
  return new Promise((resolve) => {
    if (!AppState.mediaRecorder || AppState.mediaRecorder.state === 'inactive') { resolve(); return; }
    const mr = AppState.mediaRecorder;
    mr.onstop = ((orig) => (e) => {
      orig && orig(e);
      recBtn?.classList.remove('av-studio-block__record--hidden');
      stopBtn?.classList.add('av-studio-block__record--hidden');
      AppState.mediaRecorder = null;
      AppState.recordingBlock = null;
      resolve();
    })(mr.onstop);
    mr.stop();
  });
}

function updateBlockUI(block) {
  const el = document.querySelector(`.av-studio-block[data-uid="${block.uid}"]`);
  if (!el) return;
  const dur = el.querySelector('.av-studio-block__duration');
  const hasAudio = !!block.audioBlob;
  el.classList.toggle('av-studio-block--recorded', hasAudio);
  if (dur) dur.textContent = block.duration > 0 ? `${block.duration.toFixed(1)}s` : '—';
  const playBtn = el.querySelector('.av-studio-block__play');
  if (playBtn) playBtn.disabled = !hasAudio;
}

/* ── MIX RECORDED CLIPS INTO ONE MP3 ── */
async function buildMp3(blocks) {
  const recorded = blocks.filter(b => b.audioBlob).sort((a, b) => a.startTime - b.startTime);
  if (!recorded.length) throw new Error('No recorded audio clips. Record at least one block.');

  const ctx = getAudioContext();
  const sampleRate = ctx.sampleRate;

  // Decode each recorded blob and find total length
  const decoded = [];
  let maxEnd = 0;
  for (const b of recorded) {
    const buf = await decodeBlob(b.audioBlob);
    decoded.push({ buf, startTime: b.startTime });
    maxEnd = Math.max(maxEnd, b.startTime + buf.duration);
  }

  const totalFrames = Math.ceil(maxEnd * sampleRate);
  const offline = new OfflineAudioContext(2, totalFrames, sampleRate);

  for (const { buf, startTime } of decoded) {
    const src = offline.createBufferSource();
    src.buffer = buf;
    const startFrame = Math.floor(startTime * sampleRate);
    const dstGain = offline.createGain();
    dstGain.gain.value = 0.95;
    src.connect(dstGain);
    dstGain.connect(offline.destination);
    src.start(startFrame / sampleRate);
  }

  const rendered = await offline.startRendering();
  const left = rendered.getChannelData(0);
  const right = rendered.getChannelData(1);

  // Clamp
  for (let i = 0; i < totalFrames; i++) {
    left[i] = Math.max(-1, Math.min(1, left[i]));
    right[i] = Math.max(-1, Math.min(1, right[i]));
  }

  // Encode MP3 via lamejs (loaded from CDN)
  if (!window.lamejs) {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js';
      s.onload = resolve;
      s.onerror = () => reject(new Error('Could not load MP3 encoder. Check your internet connection.'));
      document.head.appendChild(s);
    });
  }

  const mp3encoder = new window.lamejs.Mp3Encoder(2, sampleRate, 192);
  const sampleBlockSize = 1152;
  const left16 = new Int16Array(totalFrames);
  const right16 = new Int16Array(totalFrames);
  for (let i = 0; i < totalFrames; i++) {
    left16[i] = Math.max(-32768, Math.min(32767, Math.round(left[i] * 32767)));
    right16[i] = Math.max(-32768, Math.min(32767, Math.round(right[i] * 32767)));
  }

  const mp3Data = [];
  for (let i = 0; i < totalFrames; i += sampleBlockSize) {
    const len = Math.min(sampleBlockSize, totalFrames - i);
    const l = new Int16Array(left16.buffer, i * 2, len);
    const r = new Int16Array(right16.buffer, i * 2, len);
    const mp3buf = mp3encoder.encodeBuffer(l, r);
    if (mp3buf.length) mp3Data.push(mp3buf);
  }
  const endBuf = mp3encoder.flush();
  if (endBuf.length) mp3Data.push(endBuf);

  return new Blob(mp3Data, { type: 'audio/mp3' });
}

/* ── SRT ── */
function toSrtTime(s) { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60, ms = Math.floor((sec - Math.floor(sec)) * 1000); return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(Math.floor(sec)).padStart(2, '0')},${String(ms).padStart(3, '0')}`; }
function downloadBlob(b, fn) { const u = URL.createObjectURL(b), a = document.createElement('a'); a.href = u; a.download = fn; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(u); }
function parseSrt(c) {
  const r = [], l = c.trim().split(/\r?\n/); let i = 0;
  while (i < l.length) {
    while (i < l.length && !l[i].trim()) i++; if (i >= l.length) break; i++; if (i >= l.length) break;
    const m = l[i].match(/(\d{2}):(\d{2}):(\d{2})[,\.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,\.](\d{3})/); if (!m) { i++; continue; }
    const st = parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseInt(m[3]) + parseInt(m[4]) / 1000; i++;
    const t = []; while (i < l.length && l[i].trim()) { t.push(l[i].trim()); i++; }
    const tx = t.join(' '); if (tx) r.push({ startTime: st, text: tx });
  }
  return r;
}

/* ── MAIN ── */
async function init() {
  loadTheme(); applyTheme();
  document.getElementById('themeToggleBtn')?.addEventListener('click', () => { AppState.theme = AppState.theme === 'dark' ? 'light' : 'dark'; applyTheme(); });

  populateVoiceSelect();

  const bc = document.getElementById('studioBlocks'), tpl = document.getElementById('studioBlockTemplate');
  const addBtn = document.getElementById('addBlockBtn'), playBtn = document.getElementById('playSequenceBtn');
  const expABtn = document.getElementById('exportAudioBtn'), expSBtn = document.getElementById('exportSrtBtn');
  const impSrt = document.getElementById('importSrtInput');
  const tlCanvas = document.getElementById('timelineCanvas'), tlEmpty = document.getElementById('timelineEmpty');
  const bcEl = document.getElementById('blockCount'), tdEl = document.getElementById('totalDuration');
  if (!bc || !tpl || !addBtn) return;

  let ctx = null;
  if (tlCanvas) { ctx = tlCanvas.getContext('2d'); resizeCanvas(); window.addEventListener('resize', resizeCanvas); }
  function resizeCanvas() {
    if (!tlCanvas || !ctx) return; const w = tlCanvas.parentElement; if (!w) return;
    const dpr = window.devicePixelRatio || 1, r = w.getBoundingClientRect();
    tlCanvas.width = r.width * dpr; tlCanvas.height = 140 * dpr;
    tlCanvas.style.width = r.width + 'px'; tlCanvas.style.height = '140px'; ctx.scale(dpr, dpr); drawTimeline();
  }

  function getNextStart() {
    if (!AppState.studio.blocks.length) return 0;
    return AppState.studio.blocks[AppState.studio.blocks.length - 1].startTime + (AppState.studio.blocks[AppState.studio.blocks.length - 1].duration || 1);
  }

  function createBlock(startTime, text) {
    const uid = 'b-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
    const cl = tpl.content.cloneNode(true), blk = $('.av-studio-block', cl);
    blk.dataset.uid = uid;
    const no = $('.av-studio-block__number', cl), ti = $('.av-studio-block__text', cl);
    const tmi = $('.av-studio-block__time', cl), de = $('.av-studio-block__duration', cl);
    const pb = $('.av-studio-block__preview', cl), db = $('.av-studio-block__delete', cl);
    const recBtn = $('.av-studio-block__record', cl), stopBtn = $('.av-studio-block__stop', cl);
    const playBtn = $('.av-studio-block__play', cl);
    if (ti) ti.value = text || '';
    if (tmi) tmi.value = startTime.toFixed(1);
    const sb = { uid, text: text || '', startTime, duration: estimateDuration(text || ''), audioBlob: null, audioMime: '' };
    AppState.studio.blocks.push(sb);
    if (de) de.textContent = sb.duration > 0 ? `${sb.duration.toFixed(1)}s` : '—';
    const rn = () => { const idx = AppState.studio.blocks.findIndex(b => b.uid === uid); if (no) no.textContent = `${idx + 1}.`; };
    rn(); updateStats(); drawTimeline();

    ti?.addEventListener('input', () => { sb.text = ti.value.trim(); sb.duration = estimateDuration(sb.text); if (de) de.textContent = sb.duration > 0 ? `${sb.duration.toFixed(1)}s` : '—'; updateStats(); drawTimeline(); });
    tmi?.addEventListener('change', () => { sb.startTime = Math.max(0, parseFloat(tmi.value) || 0); updateStats(); drawTimeline(); sortBlocks(); });
    pb?.addEventListener('click', () => { const txt = sb.text || ti?.value?.trim() || ''; if (txt) speakBrowser(txt); });
    db?.addEventListener('click', () => { blk.remove(); AppState.studio.blocks = AppState.studio.blocks.filter(b => b.uid !== uid); AppState.studio.blocks.forEach((b, i) => { const e = document.querySelector(`.av-studio-block[data-uid="${b.uid}"] .av-studio-block__number`); if (e) e.textContent = `${i + 1}.`; }); updateStats(); drawTimeline(); updateExportButtons(); });

    recBtn?.addEventListener('click', async () => {
      try {
        await startRecording(sb, recBtn, stopBtn);
      } catch (e) {
        alert('Microphone access denied or not available: ' + e.message);
        recBtn?.classList.remove('av-studio-block__record--hidden');
        stopBtn?.classList.add('av-studio-block__record--hidden');
      }
    });
    stopBtn?.addEventListener('click', () => stopRecording(recBtn, stopBtn));
    playBtn?.addEventListener('click', () => {
      if (!sb.audioBlob) return;
      const url = URL.createObjectURL(sb.audioBlob);
      const a = new Audio(url);
      a.onended = () => URL.revokeObjectURL(url);
      a.play();
    });

    bc.appendChild(cl); updateExportButtons();
    if (tlEmpty) tlEmpty.style.display = AppState.studio.blocks.length === 0 ? '' : 'none';
  }

  function sortBlocks() { AppState.studio.blocks.sort((a, b) => a.startTime - b.startTime); AppState.studio.blocks.forEach(b => { const e = document.querySelector(`.av-studio-block[data-uid="${b.uid}"]`); if (e) bc.appendChild(e); }); AppState.studio.blocks.forEach((b, i) => { const e = document.querySelector(`.av-studio-block[data-uid="${b.uid}"] .av-studio-block__number`); if (e) e.textContent = `${i + 1}.`; const t = document.querySelector(`.av-studio-block[data-uid="${b.uid}"] .av-studio-block__time`); if (t) t.value = b.startTime.toFixed(1); }); }
  function updateStats() { if (bcEl) bcEl.textContent = AppState.studio.blocks.length; const t = AppState.studio.blocks.reduce((s, b) => Math.max(s, b.startTime + (b.duration || 0)), 0); if (tdEl) tdEl.textContent = t.toFixed(1); }
  function updateExportButtons() { const h = AppState.studio.blocks.length > 0; if (expABtn) expABtn.disabled = !h; if (expSBtn) expSBtn.disabled = !h; }

  function drawTimeline() { if (!ctx || !tlCanvas) return; const w = tlCanvas.getBoundingClientRect().width, h = 140; ctx.clearRect(0, 0, w, h); if (!AppState.studio.blocks.length) { if (tlEmpty) tlEmpty.style.display = ''; return; } if (tlEmpty) tlEmpty.style.display = 'none'; const mt = AppState.studio.blocks.reduce((m, b) => Math.max(m, b.startTime + (b.duration || estimateDuration(b.text))), 5); const p = 40, t = 40, th = 40, uw = w - p * 2, pps = uw / Math.max(mt, 1); ctx.strokeStyle = '#404550'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p, t); ctx.lineTo(w - p, t); ctx.moveTo(p, t + th); ctx.lineTo(w - p, t + th); ctx.stroke(); const ti = Math.max(1, Math.ceil(mt / 10)); ctx.fillStyle = '#8B93A7'; ctx.font = '10px "IBM Plex Mono",monospace'; ctx.textAlign = 'center'; for (let s = 0; s <= mt; s += ti) { const x = p + s * pps; ctx.beginPath(); ctx.moveTo(x, t - 4); ctx.lineTo(x, t); ctx.stroke(); ctx.fillText(`${s.toFixed(0)}s`, x, t - 8); } AppState.studio.blocks.forEach(b => { const x = p + b.startTime * pps; const dur = b.duration || estimateDuration(b.text); const bw = Math.max(6, dur * pps); ctx.fillStyle = b.audioBlob ? 'rgba(63,184,118,0.35)' : 'rgba(91,79,224,0.3)'; ctx.strokeStyle = b.audioBlob ? 'rgba(63,184,118,0.8)' : 'rgba(91,79,224,0.6)'; ctx.lineWidth = 1.5; ctx.beginPath(); rr(ctx, x, t + 2, bw, th - 4, 4); ctx.fill(); ctx.stroke(); if (bw > 30) { ctx.fillStyle = b.audioBlob ? '#3FB876' : '#5B4FE0'; ctx.font = 'bold 11px "IBM Plex Sans",sans-serif'; ctx.textAlign = 'center'; ctx.fillText((b.text || '').slice(0, Math.floor(bw / 6)), x + bw / 2, t + th / 2 + 4); } }); }
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r); c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h); c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r); c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath(); }

  function stopSequence() { AppState.studio.playAbortController?.abort(); AppState.studio.playAbortController = null; window.speechSynthesis.cancel(); AppState.studio.isPlaying = false; if (playBtn) { playBtn.innerHTML = '<i class="fa-solid fa-play"></i> Preview All'; playBtn.className = 'av-btn av-btn--primary av-btn--lg'; } }

  if (playBtn) { playBtn.addEventListener('click', () => { if (AppState.studio.isPlaying) { stopSequence(); return; } const blocks = [...AppState.studio.blocks].sort((a, b) => a.startTime - b.startTime).filter(b => b.text?.trim()); if (!blocks.length) return; AppState.studio.playAbortController = new AbortController(); const signal = AppState.studio.playAbortController.signal; AppState.studio.isPlaying = true; playBtn.innerHTML = '<i class="fa-solid fa-stop"></i> Stop'; playBtn.className = 'av-btn av-btn--primary av-btn--lg'; let idx = 0; async function playNext() { if (signal.aborted) { stopSequence(); return; } if (idx >= blocks.length) { stopSequence(); return; } const b = blocks[idx]; const u = new SpeechSynthesisUtterance(b.text); if (AppState.selectedVoice) { const v = window.speechSynthesis.getVoices().find(x => x.name === AppState.selectedVoice); if (v) u.voice = v; } const ah = () => { window.speechSynthesis.cancel(); stopSequence(); }; signal.addEventListener('abort', ah, { once: true }); u.onend = u.onerror = () => { signal.removeEventListener('abort', ah); idx++; playNext(); }; window.speechSynthesis.speak(u); } playNext(); }); }

  if (expSBtn) { expSBtn.addEventListener('click', () => { const blocks = [...AppState.studio.blocks].sort((a, b) => a.startTime - b.startTime); let srt = ''; blocks.forEach((b, i) => { const s = b.startTime, d = b.duration || estimateDuration(b.text); srt += `${i + 1}\n${toSrtTime(s)} --> ${toSrtTime(s + d)}\n${b.text?.trim() || ''}\n\n`; }); downloadBlob(new Blob([srt], { type: 'text/plain;charset=utf-8' }), 'avatar-studio-subtitles.srt'); }); }

  if (impSrt) { impSrt.addEventListener('change', (e) => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = (ev) => { const p = parseSrt(ev.target.result); AppState.studio.blocks = []; bc.innerHTML = ''; p.forEach(x => createBlock(x.startTime, x.text)); updateStats(); drawTimeline(); updateExportButtons(); }; r.readAsText(f); impSrt.value = ''; }); }

  if (expABtn) {
    expABtn.addEventListener('click', async () => {
      const blocks = [...AppState.studio.blocks].sort((a, b) => a.startTime - b.startTime);
      if (!blocks.length) return;
      expABtn.disabled = true;
      expABtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Mixing MP3...';
      try {
        const mp3 = await buildMp3(blocks);
        downloadBlob(mp3, 'avatar-studio-dub.mp3');
      } catch (e) {
        alert('Export failed: ' + e.message);
      }
      expABtn.disabled = false;
      expABtn.innerHTML = '<i class="fa-solid fa-file-audio"></i> Record to MP3';
    });
  }

  addBtn.addEventListener('click', () => { const s = getNextStart(); createBlock(s, ''); const b = $$('.av-studio-block'); const l = b[b.length - 1]; const i = $('.av-studio-block__text', l); if (i) i.focus(); });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
