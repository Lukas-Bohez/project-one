/**
 * Avatar Studio — Timeline Dubbing & Playback
 * Preview your monologue with browser speech, drag blocks on the timeline
 * to place them, scrub the playhead, and record the output with OBS.
 */

const AppState = {
  theme: 'dark',
  selectedVoice: null,
  studio: { blocks: [], isPlaying: false, playAbortController: null },
  timeline: { dragUid: null, playhead: 0, hoverX: null }
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

/* ── BROWSER SPEECH ── */
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
   TIMELINE LAYOUT
   ═══════════════════════════════════════════════ */

function getTimelineMetrics(canvas) {
  const rect = canvas.getBoundingClientRect();
  const w = rect.width;
  const mt = AppState.studio.blocks.reduce((m, b) => Math.max(m, b.startTime + (b.duration || estimateDuration(b.text))), 5);
  const p = 40, t = 40, th = 40, uw = w - p * 2;
  const pps = uw / Math.max(mt, 1);
  return { w, h: 140, p, t, th, uw, pps, mt };
}

function blockAtPos(mx, my, canvas) {
  const { p, t, th, pps } = getTimelineMetrics(canvas);
  for (const b of AppState.studio.blocks) {
    const x = p + b.startTime * pps;
    const dur = b.duration || estimateDuration(b.text);
    const bw = Math.max(6, dur * pps);
    const y = t + 2;
    if (mx >= x && mx <= x + bw && my >= y && my <= y + th - 4) return b;
  }
  return null;
}

function timeAtPos(mx, canvas) {
  const { p, uw, mt } = getTimelineMetrics(canvas);
  const raw = (mx - p) / (uw / Math.max(mt, 1));
  return Math.max(0, Math.min(mt, raw));
}

function posAtTime(time, canvas) {
  const { p, uw, mt } = getTimelineMetrics(canvas);
  return p + time * (uw / Math.max(mt, 1));
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
  const expSBtn = document.getElementById('exportSrtBtn');
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
    if (ti) ti.value = text || '';
    if (tmi) tmi.value = startTime.toFixed(1);
    const sb = { uid, text: text || '', startTime, duration: estimateDuration(text || '') };
    AppState.studio.blocks.push(sb);
    if (de) de.textContent = sb.duration > 0 ? `${sb.duration.toFixed(1)}s` : '—';
    const rn = () => { const idx = AppState.studio.blocks.findIndex(b => b.uid === uid); if (no) no.textContent = `${idx + 1}.`; };
    rn(); updateStats(); drawTimeline();

    ti?.addEventListener('input', () => { sb.text = ti.value.trim(); sb.duration = estimateDuration(sb.text); if (de) de.textContent = sb.duration > 0 ? `${sb.duration.toFixed(1)}s` : '—'; updateStats(); drawTimeline(); });
    tmi?.addEventListener('change', () => { sb.startTime = Math.max(0, parseFloat(tmi.value) || 0); updateStats(); drawTimeline(); sortBlocks(); });
    pb?.addEventListener('click', () => { const txt = sb.text || ti?.value?.trim() || ''; if (txt) speakBrowser(txt); });
    db?.addEventListener('click', () => { blk.remove(); AppState.studio.blocks = AppState.studio.blocks.filter(b => b.uid !== uid); AppState.studio.blocks.forEach((b, i) => { const e = document.querySelector(`.av-studio-block[data-uid="${b.uid}"] .av-studio-block__number`); if (e) e.textContent = `${i + 1}.`; }); updateStats(); drawTimeline(); updateExportButtons(); });

    bc.appendChild(cl); updateExportButtons();
    if (tlEmpty) tlEmpty.style.display = AppState.studio.blocks.length === 0 ? '' : 'none';
  }

  function sortBlocks() { AppState.studio.blocks.sort((a, b) => a.startTime - b.startTime); AppState.studio.blocks.forEach(b => { const e = document.querySelector(`.av-studio-block[data-uid="${b.uid}"]`); if (e) bc.appendChild(e); }); AppState.studio.blocks.forEach((b, i) => { const e = document.querySelector(`.av-studio-block[data-uid="${b.uid}"] .av-studio-block__number`); if (e) e.textContent = `${i + 1}.`; const t = document.querySelector(`.av-studio-block[data-uid="${b.uid}"] .av-studio-block__time`); if (t) t.value = b.startTime.toFixed(1); }); }
  function updateStats() { if (bcEl) bcEl.textContent = AppState.studio.blocks.length; const t = AppState.studio.blocks.reduce((s, b) => Math.max(s, b.startTime + (b.duration || 0)), 0); if (tdEl) tdEl.textContent = t.toFixed(1); }
  function updateExportButtons() { const h = AppState.studio.blocks.length > 0; if (playBtn) playBtn.disabled = !h; if (expSBtn) expSBtn.disabled = !h; }

  function drawTimeline() {
    if (!ctx || !tlCanvas) return;
    const { w, h, p, t, th, pps, mt } = getTimelineMetrics(tlCanvas);
    ctx.clearRect(0, 0, w, h);
    if (!AppState.studio.blocks.length) { if (tlEmpty) tlEmpty.style.display = ''; return; }
    if (tlEmpty) tlEmpty.style.display = 'none';
    ctx.strokeStyle = '#404550'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p, t); ctx.lineTo(w - p, t); ctx.moveTo(p, t + th); ctx.lineTo(w - p, t + th); ctx.stroke();
    const ti = Math.max(1, Math.ceil(mt / 10));
    ctx.fillStyle = '#8B93A7'; ctx.font = '10px "IBM Plex Mono",monospace'; ctx.textAlign = 'center';
    for (let s = 0; s <= mt; s += ti) { const x = p + s * pps; ctx.beginPath(); ctx.moveTo(x, t - 4); ctx.lineTo(x, t); ctx.stroke(); ctx.fillText(`${s.toFixed(0)}s`, x, t - 8); }
    AppState.studio.blocks.forEach(b => {
      const x = p + b.startTime * pps;
      const dur = b.duration || estimateDuration(b.text);
      const bw = Math.max(6, dur * pps);
      ctx.fillStyle = 'rgba(91,79,224,0.3)'; ctx.strokeStyle = 'rgba(91,79,224,0.6)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); rr(ctx, x, t + 2, bw, th - 4, 4); ctx.fill(); ctx.stroke();
      if (bw > 30) { ctx.fillStyle = '#5B4FE0'; ctx.font = 'bold 11px "IBM Plex Sans",sans-serif'; ctx.textAlign = 'center'; ctx.fillText((b.text || '').slice(0, Math.floor(bw / 6)), x + bw / 2, t + th / 2 + 4); }
    });
    // Playhead
    const px = posAtTime(AppState.timeline.playhead, tlCanvas);
    ctx.strokeStyle = '#E8A33D'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px, t - 6); ctx.lineTo(px, t + th + 6); ctx.stroke();
    ctx.fillStyle = '#E8A33D'; ctx.beginPath(); ctx.arc(px, t - 8, 4, 0, Math.PI * 2); ctx.fill();
  }
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r); c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h); c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r); c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath(); }

  // Drag interactions on timeline
  if (tlCanvas) {
    tlCanvas.style.cursor = 'crosshair';
    tlCanvas.addEventListener('pointerdown', (e) => {
      const rect = tlCanvas.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const hit = blockAtPos(mx, my, tlCanvas);
      if (hit) {
        AppState.timeline.dragUid = hit.uid;
        AppState.timeline.dragOffsetX = mx - posAtTime(hit.startTime, tlCanvas);
        tlCanvas.setPointerCapture(e.pointerId);
      } else {
        AppState.timeline.playhead = timeAtPos(mx, tlCanvas);
        drawTimeline();
      }
    });
    tlCanvas.addEventListener('pointermove', (e) => {
      const rect = tlCanvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      AppState.timeline.hoverX = mx;
      if (AppState.timeline.dragUid) {
        const b = AppState.studio.blocks.find(x => x.uid === AppState.timeline.dragUid);
        if (b) {
          const { p, uw, mt } = getTimelineMetrics(tlCanvas);
          const newTime = Math.max(0, (mx - AppState.timeline.dragOffsetX - p) / (uw / Math.max(mt, 1)));
          b.startTime = Math.round(newTime * 10) / 10;
          const tel = document.querySelector(`.av-studio-block[data-uid="${b.uid}"] .av-studio-block__time`);
          if (tel) tel.value = b.startTime.toFixed(1);
          updateStats(); sortBlocks(); drawTimeline();
        }
      } else {
        const { t, th } = getTimelineMetrics(tlCanvas);
        const my = e.clientY - rect.top;
        tlCanvas.style.cursor = blockAtPos(mx, my, tlCanvas) ? 'grab' : 'crosshair';
      }
    });
    tlCanvas.addEventListener('pointerup', (e) => {
      AppState.timeline.dragUid = null;
      tlCanvas.releasePointerCapture(e.pointerId);
    });
    tlCanvas.addEventListener('pointerleave', () => { AppState.timeline.hoverX = null; });
  }

  async function playFrom(startTime) {
    const blocks = [...AppState.studio.blocks].sort((a, b) => a.startTime - b.startTime).filter(b => b.text?.trim());
    if (!blocks.length) return;
    AppState.timeline.playhead = startTime;
    AppState.studio.playAbortController = new AbortController();
    const signal = AppState.studio.playAbortController.signal;
    AppState.studio.isPlaying = true;
    if (playBtn) { playBtn.innerHTML = '<i class="fa-solid fa-stop"></i> Stop'; playBtn.className = 'av-btn av-btn--primary av-btn--lg'; }
    const startAt = performance.now();

    function setPlayhead() {
      if (signal.aborted) return;
      const elapsed = (performance.now() - startAt) / 1000 + startTime;
      AppState.timeline.playhead = elapsed;
      drawTimeline();
      if (AppState.studio.isPlaying) requestAnimationFrame(setPlayhead);
    }
    requestAnimationFrame(setPlayhead);

    let idx = 0;
    while (idx < blocks.length) {
      if (signal.aborted) break;
      const b = blocks[idx];
      const wait = b.startTime - ((performance.now() - startAt) / 1000 + startTime);
      if (wait > 0) await new Promise(r => setTimeout(r, wait * 1000));
      if (signal.aborted) break;
      await new Promise(resolve => {
        const u = new SpeechSynthesisUtterance(b.text);
        if (AppState.selectedVoice) { const v = window.speechSynthesis.getVoices().find(x => x.name === AppState.selectedVoice); if (v) u.voice = v; }
        const ah = () => { window.speechSynthesis.cancel(); stopSequence(); };
        signal.addEventListener('abort', ah, { once: true });
        u.onend = u.onerror = () => { signal.removeEventListener('abort', ah); resolve(); };
        window.speechSynthesis.speak(u);
      });
      idx++;
    }
    stopSequence();
  }

  function stopSequence() {
    AppState.studio.playAbortController?.abort();
    AppState.studio.playAbortController = null;
    window.speechSynthesis.cancel();
    AppState.studio.isPlaying = false;
    if (playBtn) { playBtn.innerHTML = '<i class="fa-solid fa-play"></i> Preview from playhead'; playBtn.className = 'av-btn av-btn--primary av-btn--lg'; }
  }

  if (playBtn) {
    playBtn.addEventListener('click', () => {
      if (AppState.studio.isPlaying) { stopSequence(); return; }
      playFrom(AppState.timeline.playhead || 0);
    });
  }

  if (expSBtn) { expSBtn.addEventListener('click', () => { const blocks = [...AppState.studio.blocks].sort((a, b) => a.startTime - b.startTime); let srt = ''; blocks.forEach((b, i) => { const s = b.startTime, d = b.duration || estimateDuration(b.text); srt += `${i + 1}\n${toSrtTime(s)} --> ${toSrtTime(s + d)}\n${b.text?.trim() || ''}\n\n`; }); downloadBlob(new Blob([srt], { type: 'text/plain;charset=utf-8' }), 'avatar-studio-subtitles.srt'); }); }

  if (impSrt) { impSrt.addEventListener('change', (e) => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = (ev) => { const p = parseSrt(ev.target.result); AppState.studio.blocks = []; bc.innerHTML = ''; p.forEach(x => createBlock(x.startTime, x.text)); updateStats(); drawTimeline(); updateExportButtons(); }; r.readAsText(f); impSrt.value = ''; }); }

  addBtn.addEventListener('click', () => { const s = getNextStart(); createBlock(s, ''); const b = $$('.av-studio-block'); const l = b[b.length - 1]; const i = $('.av-studio-block__text', l); if (i) i.focus(); });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
