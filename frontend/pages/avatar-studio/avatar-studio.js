/**
 * Avatar Studio — Centralized App State & Feature Modules
 * quizthespire.com/pages/avatar-studio/
 *
 * Architecture:
 *   AppState is the single source of truth — no DOM-as-state.
 *   Modular init: setupLiveMode(), setupStudioMode(), setupSettings(), setupTheme()
 */

/* ═══════════════════════════════════════════════
   APP STATE
   ═══════════════════════════════════════════════ */
const AppState = {
  activePanel: 'live',
  theme: 'dark',
  isLive: false,
  recognition: null,
  synth: window.speechSynthesis,
  ttsEngine: 'browser',
  hasMicPermission: false,
  transcript: [],
  keys: {
    elevenlabs: '',
    openai: '',
    anthropic: ''
  },
  capabilities: {
    speechRecognition: false,
    speechSynthesis: false,
    webgpu: false
  },
  studio: {
    blocks: [],
    isPlaying: false,
    audioBuffers: {},
    generatingUids: new Set()
  }
};

/* ═══════════════════════════════════════════════
   UTILITY FUNCTIONS
   ═══════════════════════════════════════════════ */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

/** Estimate speaking duration from text (syllable count * ~150 WPM avg) */
function estimateDuration(text) {
  if (!text || !text.trim()) return 0;
  const words = text.trim().split(/\s+/).length;
  const syllables = text.toLowerCase().replace(/[^a-z]/g, '').length * 0.35;
  const fromWords = words / 2.5;   // ~150 WPM = 2.5 words/sec
  const fromSyllables = syllables / 4.5;
  return Math.max(0.3, (fromWords + fromSyllables) / 2);
}

/** Format seconds as mm:ss.ms */
function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(1);
  return `${m}:${String(s).padStart(4, '0')}`;
}

/** Simple fuzzy match for command palette (also used by homepage) */
function fuzzyMatch(query, text) {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}

/** Load keys from localStorage */
function loadKeys() {
  try {
    AppState.keys.elevenlabs = localStorage.getItem('av-elevenlabs-key') || '';
    AppState.keys.openai = localStorage.getItem('av-openai-key') || '';
    AppState.keys.anthropic = localStorage.getItem('av-anthropic-key') || '';
  } catch (e) { /* localStorage unavailable */ }
}

/** Save a single key to localStorage */
function saveKey(provider, value) {
  try {
    if (value) localStorage.setItem(`av-${provider}-key`, value);
    else localStorage.removeItem(`av-${provider}-key`);
  } catch (e) { /* noop */ }
}

/** Load theme preference */
function loadTheme() {
  try {
    const stored = localStorage.getItem('av-theme');
    if (stored) AppState.theme = stored;
    else if (window.matchMedia && window.matchMedia('(prefers-color-scheme:dark)').matches) {
      AppState.theme = 'dark';
    }
  } catch (e) { /* default */ }
}

function saveTheme() {
  try { localStorage.setItem('av-theme', AppState.theme); } catch (e) { /* noop */ }
}

function applyTheme() {
  const body = document.body;
  body.classList.toggle('theme-dark', AppState.theme === 'dark');
  body.classList.toggle('theme-light', AppState.theme === 'light');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = AppState.theme === 'dark' ? '#16161C' : '#F8F9FC';
  saveTheme();
}

/* ═══════════════════════════════════════════════
   CHECK BROWSER CAPABILITIES
   ═══════════════════════════════════════════════ */
function checkCapabilities() {
  AppState.capabilities.speechRecognition = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  AppState.capabilities.speechSynthesis = !!window.speechSynthesis;
  AppState.capabilities.webgpu = !!navigator.gpu;

  const setCheck = (id, ok, label) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (ok) {
      el.innerHTML = `<i class="fa-solid fa-check"></i> ${label}`;
    } else {
      el.innerHTML = `<i class="fa-solid fa-xmark"></i> ${label} — not available`;
    }
  };

  setCheck('check-speech-recognition', AppState.capabilities.speechRecognition, 'Speech recognition available');
  setCheck('check-speech-synthesis', AppState.capabilities.speechSynthesis, 'Speech synthesis available');
  setCheck('check-webgpu', AppState.capabilities.webgpu, 'WebGPU available');

  // If speech recognition is missing, show a warning
  if (!AppState.capabilities.speechRecognition) {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    if (statusDot) statusDot.className = 'av-status-dot av-status-dot--error';
    if (statusText) statusText.textContent = 'Your browser doesn\'t support speech recognition. Live mode won\'t work — try Chrome or Edge.';
  }
}

/* ═══════════════════════════════════════════════
   PANEL SWITCHING (Live / Studio)
   ═══════════════════════════════════════════════ */
function setupPanels() {
  const tabs = $$('.av-header__tab');
  const panels = $$('.av-panel');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const panelId = tab.dataset.panel;
      if (!panelId) return;

      AppState.activePanel = panelId;
      tabs.forEach(t => t.setAttribute('aria-current', 'false'));
      tab.setAttribute('aria-current', 'true');
      panels.forEach(p => p.classList.remove('av-panel--active'));
      const target = document.getElementById(`${panelId}-panel`);
      if (target) target.classList.add('av-panel--active');

      // If switching away from live, stop it
      if (panelId !== 'live' && AppState.isLive) {
        stopLiveMode();
      }
    });
  });
}

/* ═══════════════════════════════════════════════
   THEME TOGGLE
   ═══════════════════════════════════════════════ */
function setupTheme() {
  const btn = document.getElementById('themeToggleBtn');
  if (!btn) return;

  loadTheme();
  applyTheme();

  btn.addEventListener('click', () => {
    AppState.theme = AppState.theme === 'dark' ? 'light' : 'dark';
    applyTheme();
  });

  // Listen for system theme changes
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme:dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem('av-theme')) {
        AppState.theme = e.matches ? 'dark' : 'light';
        applyTheme();
      }
    });
  }
}

/* ═══════════════════════════════════════════════
   SETTINGS MODAL
   ═══════════════════════════════════════════════ */
function setupSettingsModal() {
  const modal = document.getElementById('settingsModal');
  const openBtn = document.getElementById('openSettingsBtn');
  const closeBtn = document.getElementById('closeSettingsBtn');
  const openForTTS = document.getElementById('openSettingsForTTS');
  const backdrop = modal ? $('.av-modal__backdrop', modal) : null;

  function open() {
    if (!modal) return;
    modal.classList.add('av-modal--open');
    modal.setAttribute('aria-hidden', 'false');
    // Populate inputs from AppState
    loadKeys();
    document.getElementById('elevenlabsKey').value = AppState.keys.elevenlabs;
    document.getElementById('openaiKey').value = AppState.keys.openai;
    document.getElementById('anthropicKey').value = AppState.keys.anthropic;
    // Focus first input
    document.getElementById('elevenlabsKey')?.focus();
  }

  function close() {
    if (!modal) return;
    modal.classList.remove('av-modal--open');
    modal.setAttribute('aria-hidden', 'true');
  }

  if (openBtn) openBtn.addEventListener('click', open);
  if (openForTTS) openForTTS.addEventListener('click', open);
  if (closeBtn) closeBtn.addEventListener('click', close);
  if (backdrop) backdrop.addEventListener('click', close);
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) close();
    });
  }

  // Save on input change
  const keyFields = [
    { id: 'elevenlabsKey', provider: 'elevenlabs' },
    { id: 'openaiKey', provider: 'openai' },
    { id: 'anthropicKey', provider: 'anthropic' }
  ];

  keyFields.forEach(({ id, provider }) => {
    const input = document.getElementById(id);
    if (!input) return;
    input.addEventListener('change', () => {
      const val = input.value.trim();
      AppState.keys[provider] = val;
      saveKey(provider, val);
      updateTTSInfo();
    });
  });

  // Clear buttons
  document.getElementById('clearElevenlabsBtn')?.addEventListener('click', () => {
    document.getElementById('elevenlabsKey').value = '';
    AppState.keys.elevenlabs = '';
    saveKey('elevenlabs', '');
    updateTTSInfo();
  });
  document.getElementById('clearOpenaiBtn')?.addEventListener('click', () => {
    document.getElementById('openaiKey').value = '';
    AppState.keys.openai = '';
    saveKey('openai', '');
  });
  document.getElementById('clearAnthropicBtn')?.addEventListener('click', () => {
    document.getElementById('anthropicKey').value = '';
    AppState.keys.anthropic = '';
    saveKey('anthropic', '');
  });

  // Keyboard: Escape to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal && modal.classList.contains('av-modal--open')) {
      close();
    }
  });
}

/* ═══════════════════════════════════════════════
   TTS ENGINE SELECTION
   ═══════════════════════════════════════════════ */
function updateTTSInfo() {
  const info = document.getElementById('ttsInfo');
  const engine = AppState.ttsEngine;
  const hasElevenKey = !!AppState.keys.elevenlabs;

  if (!info) return;

  if (engine === 'elevenlabs' && !hasElevenKey) {
    info.innerHTML = '<p class="av-muted"><i class="fa-solid fa-triangle-exclamation"></i> ElevenLabs requires an API key. <button type="button" class="av-link" id="openSettingsForTTS">Set up ElevenLabs key</button> in Settings.</p>';
    // Re-bind the settings link
    document.getElementById('openSettingsForTTS')?.addEventListener('click', () => {
      document.getElementById('openSettingsBtn')?.click();
    });
  } else if (engine === 'elevenlabs') {
    info.innerHTML = '<p class="av-muted"><i class="fa-solid fa-check"></i> Using ElevenLabs for voice synthesis.</p>';
  } else {
    info.innerHTML = '<p class="av-muted">Using browser speech synthesis. <button type="button" class="av-link" id="openSettingsForTTS">Set up ElevenLabs key</button> for higher quality.</p>';
    document.getElementById('openSettingsForTTS')?.addEventListener('click', () => {
      document.getElementById('openSettingsBtn')?.click();
    });
  }
}

function setupTTSEngineSelector() {
  const radios = $$('input[name="ttsEngine"]');
  radios.forEach(radio => {
    radio.addEventListener('change', () => {
      if (radio.checked) {
        AppState.ttsEngine = radio.value;
        updateTTSInfo();
      }
    });
  });

  loadKeys();
  updateTTSInfo();
}

/* ═══════════════════════════════════════════════
   SPEAK TEXT — Unified TTS interface
   Returns a Promise that resolves with the AudioBuffer or null
   ═══════════════════════════════════════════════ */
async function speakText(text, onStart, onEnd) {
  if (AppState.ttsEngine === 'elevenlabs' && AppState.keys.elevenlabs) {
    return speakElevenLabs(text, onStart, onEnd);
  }
  return speakBrowser(text, onStart, onEnd);
}

function speakBrowser(text, onStart, onEnd) {
  return new Promise((resolve) => {
    if (!AppState.capabilities.speechSynthesis) {
      if (onEnd) onEnd();
      resolve(null);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.onstart = () => { if (onStart) onStart(); };
    utterance.onend = () => { if (onEnd) onEnd(); resolve(null); };
    utterance.onerror = () => { if (onEnd) onEnd(); resolve(null); };
    window.speechSynthesis.speak(utterance);
  });
}

async function speakElevenLabs(text, onStart, onEnd) {
  const key = AppState.keys.elevenlabs;
  if (!key) {
    // Fall back to browser
    return speakBrowser(text, onStart, onEnd);
  }

  try {
    const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': key
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 }
      })
    });

    if (!response.ok) {
      console.warn('ElevenLabs API error, falling back to browser speech');
      return speakBrowser(text, onStart, onEnd);
    }

    const arrayBuffer = await response.arrayBuffer();
    if (onStart) onStart();

    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);
    source.onended = () => { if (onEnd) onEnd(); };
    source.start(0);

    return audioBuffer;
  } catch (e) {
    console.warn('ElevenLabs fetch failed, falling back to browser speech:', e);
    return speakBrowser(text, onStart, onEnd);
  }
}

/* ═══════════════════════════════════════════════
   LIVE MODE — Speech Recognition → TTS → Lip-Sync
   ═══════════════════════════════════════════════ */
function setupLiveMode() {
  const startBtn = document.getElementById('startLiveBtn');
  const stopBtn = document.getElementById('stopLiveBtn');
  const transcriptBox = document.getElementById('liveTranscript');
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const mouth = document.getElementById('avatarMouth');

  if (!startBtn || !stopBtn) return;

  function updateStatus(state) {
    AppState.isLive = state === 'listening';
    startBtn.disabled = AppState.isLive;
    stopBtn.disabled = !AppState.isLive;

    if (statusDot && statusText) {
      statusDot.className = 'av-status-dot';
      if (state === 'listening') {
        statusDot.classList.add('av-status-dot--live');
        statusText.textContent = 'Live — speaking...';
      } else if (state === 'error') {
        statusDot.classList.add('av-status-dot--error');
        statusText.textContent = 'Microphone access denied. Check your browser permissions.';
      } else {
        statusText.textContent = 'Ready — click Start to begin';
      }
    }
  }

  function animateMouth(speaking) {
    if (!mouth) return;
    if (speaking) {
      mouth.classList.add('av-avatar-mouth--speaking');
    } else {
      mouth.classList.remove('av-avatar-mouth--speaking');
    }
  }

  function addTranscript(text) {
    if (!transcriptBox) return;
    AppState.transcript.push(text);
    const p = document.createElement('p');
    p.textContent = text;
    // Remove placeholder if present
    const placeholder = $('.av-transcript-placeholder', transcriptBox);
    if (placeholder) placeholder.remove();
    transcriptBox.appendChild(p);
    transcriptBox.scrollTop = transcriptBox.scrollHeight;
  }

  function startLiveMode() {
    if (!AppState.capabilities.speechRecognition) {
      alert('Your browser doesn\'t support speech recognition. Please use Chrome or Edge.');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      updateStatus('listening');
    };

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          const text = result[0].transcript.trim();
          if (!text) continue;
          addTranscript(text);
          // Send to TTS
          speakText(text, () => animateMouth(true), () => animateMouth(false));
        }
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        updateStatus('error');
        addTranscript('[Microphone access denied. Please allow microphone access in your browser settings.]');
      }
    };

    recognition.onend = () => {
      if (AppState.isLive) {
        // Restart if still supposed to be live (continuous mode sometimes stops)
        try { recognition.start(); } catch (e) { /* already started */ }
      }
    };

    AppState.recognition = recognition;
    try {
      recognition.start();
    } catch (e) {
      updateStatus('error');
    }
  }

  function stopLiveMode() {
    if (AppState.recognition) {
      AppState.recognition.stop();
      AppState.recognition = null;
    }
    updateStatus('idle');
    animateMouth(false);
  }

  startBtn.addEventListener('click', startLiveMode);
  stopBtn.addEventListener('click', stopLiveMode);
}

/* ═══════════════════════════════════════════════
   STUDIO MODE — Timeline Dubbing
   ═══════════════════════════════════════════════ */
function setupStudioMode() {
  const blocksContainer = document.getElementById('studioBlocks');
  const template = document.getElementById('studioBlockTemplate');
  const addBtn = document.getElementById('addBlockBtn');
  const playSeqBtn = document.getElementById('playSequenceBtn');
  const exportAudioBtn = document.getElementById('exportAudioBtn');
  const exportSrtBtn = document.getElementById('exportSrtBtn');
  const timelineCanvas = document.getElementById('timelineCanvas');
  const timelineEmpty = document.getElementById('timelineEmpty');
  const blockCountEl = document.getElementById('blockCount');
  const totalDurationEl = document.getElementById('totalDuration');

  if (!blocksContainer || !template || !addBtn) return;

  // Canvas setup
  let canvasCtx = null;
  if (timelineCanvas) {
    canvasCtx = timelineCanvas.getContext('2d');
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
  }

  function resizeCanvas() {
    if (!timelineCanvas || !canvasCtx) return;
    const wrap = timelineCanvas.parentElement;
    if (!wrap) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = wrap.getBoundingClientRect();
    timelineCanvas.width = rect.width * dpr;
    timelineCanvas.height = 140 * dpr;
    timelineCanvas.style.width = rect.width + 'px';
    timelineCanvas.style.height = '140px';
    canvasCtx.scale(dpr, dpr);
    drawTimeline();
  }

  /** Get next estimated start time based on existing blocks */
  function getNextStartTime() {
    if (AppState.studio.blocks.length === 0) return 0;
    const last = AppState.studio.blocks[AppState.studio.blocks.length - 1];
    return last.startTime + (last.duration || estimateDuration(last.text));
  }

  /** Create a new block */
  function createBlock(startTime, text) {
    const uid = 'block-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);

    const clone = template.content.cloneNode(true);
    const block = $('.av-studio-block', clone);
    block.dataset.uid = uid;

    const numberEl = $('.av-studio-block__number', clone);
    const textInput = $('.av-studio-block__text', clone);
    const timeInput = $('.av-studio-block__time', clone);
    const durationEl = $('.av-studio-block__duration', clone);
    const previewBtn = $('.av-studio-block__preview', clone);
    const deleteBtn = $('.av-studio-block__delete', clone);

    if (textInput) textInput.value = text || '';
    if (timeInput) timeInput.value = startTime.toFixed(1);

    const stateBlock = {
      uid,
      text: text || '',
      startTime,
      duration: 0,
      audioBuffer: null
    };
    AppState.studio.blocks.push(stateBlock);

    // Numbering
    const updateNumber = () => {
      const idx = AppState.studio.blocks.findIndex(b => b.uid === uid);
      if (numberEl) numberEl.textContent = `${idx + 1}.`;
    };

    // Estimate and display duration
    const estimate = estimateDuration(text || '');
    stateBlock.duration = estimate;
    if (durationEl) {
      durationEl.textContent = estimate > 0 ? `${estimate.toFixed(1)}s` : '—';
    }
    updateNumber();
    updateTimelineStats();
    drawTimeline();

    // Generate actual audio in background (non-blocking)
    if (text && text.trim()) {
      AppState.studio.generatingUids.add(uid);
      if (durationEl) durationEl.parentElement?.classList.add('av-studio-block--generating');
      speakText(text.trim(), null, () => {
        // After speaking, we have the real duration from the audio context
        // For browser TTS we can't easily measure, so keep estimate
        AppState.studio.generatingUids.delete(uid);
        if (durationEl) durationEl.parentElement?.classList.remove('av-studio-block--generating');
      }).then(audioBuffer => {
        if (audioBuffer) {
          stateBlock.audioBuffer = audioBuffer;
          stateBlock.duration = audioBuffer.duration;
          if (durationEl) durationEl.textContent = `${audioBuffer.duration.toFixed(1)}s`;
          updateTimelineStats();
          drawTimeline();
          updateExportButtons();
        }
      });
    }

    // Event: text change → re-estimate
    if (textInput) {
      textInput.addEventListener('input', () => {
        const newText = textInput.value.trim();
        stateBlock.text = newText;
        const est = estimateDuration(newText);
        stateBlock.duration = est;
        if (durationEl) durationEl.textContent = est > 0 ? `${est.toFixed(1)}s` : '—';
        updateTimelineStats();
        drawTimeline();
      });
    }

    // Event: time change
    if (timeInput) {
      timeInput.addEventListener('change', () => {
        const val = parseFloat(timeInput.value) || 0;
        stateBlock.startTime = Math.max(0, val);
        updateTimelineStats();
        drawTimeline();
        sortBlocks();
      });
    }

    // Event: preview
    if (previewBtn) {
      previewBtn.addEventListener('click', () => {
        const txt = stateBlock.text || textInput?.value?.trim() || '';
        if (!txt) return;
        speakText(txt, null, null);
      });
    }

    // Event: delete
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        block.remove();
        AppState.studio.blocks = AppState.studio.blocks.filter(b => b.uid !== uid);
        // Re-number remaining
        AppState.studio.blocks.forEach((b, i) => {
          const el = document.querySelector(`.av-studio-block[data-uid="${b.uid}"] .av-studio-block__number`);
          if (el) el.textContent = `${i + 1}.`;
        });
        updateTimelineStats();
        drawTimeline();
        updateExportButtons();
      });
    }

    // Insert into DOM
    blocksContainer.appendChild(block.cloneNode(true));
    // Re-attach the actual block with event listeners by finding the newly appended element
    // Since we used cloneNode, the events are on our manipulated clone but not the appended one.
    // Let's use direct DOM manipulation instead.
    blocksContainer.lastElementChild.remove();
    blocksContainer.appendChild(clone);

    updateExportButtons();
    if (timelineEmpty) timelineEmpty.style.display = AppState.studio.blocks.length === 0 ? '' : 'none';
  }

  /** Sort blocks by startTime and re-number */
  function sortBlocks() {
    AppState.studio.blocks.sort((a, b) => a.startTime - b.startTime);

    // Reorder DOM
    AppState.studio.blocks.forEach(b => {
      const el = document.querySelector(`.av-studio-block[data-uid="${b.uid}"]`);
      if (el) blocksContainer.appendChild(el);
    });

    // Re-number
    AppState.studio.blocks.forEach((b, i) => {
      const el = document.querySelector(`.av-studio-block[data-uid="${b.uid}"] .av-studio-block__number`);
      if (el) el.textContent = `${i + 1}.`;
      const timeEl = document.querySelector(`.av-studio-block[data-uid="${b.uid}"] .av-studio-block__time`);
      if (timeEl) timeEl.value = b.startTime.toFixed(1);
    });
  }

  function updateTimelineStats() {
    if (blockCountEl) blockCountEl.textContent = AppState.studio.blocks.length;
    const total = AppState.studio.blocks.reduce((sum, b) => {
      return Math.max(sum, b.startTime + (b.duration || 0));
    }, 0);
    if (totalDurationEl) totalDurationEl.textContent = total.toFixed(1);
  }

  function updateExportButtons() {
    const hasBlocks = AppState.studio.blocks.length > 0;
    if (exportAudioBtn) exportAudioBtn.disabled = !hasBlocks;
    if (exportSrtBtn) exportSrtBtn.disabled = !hasBlocks;
  }

  /** Draw timeline canvas */
  function drawTimeline() {
    if (!canvasCtx || !timelineCanvas) return;
    const w = timelineCanvas.getBoundingClientRect().width;
    const h = 140;
    const ctx = canvasCtx;

    ctx.clearRect(0, 0, w, h);

    if (AppState.studio.blocks.length === 0) return;

    // Find total span
    const maxTime = AppState.studio.blocks.reduce((max, b) => {
      return Math.max(max, b.startTime + (b.duration || estimateDuration(b.text)));
    }, 5);

    const padding = 40;
    const trackTop = 40;
    const trackHeight = 40;
    const usableWidth = w - padding * 2;
    const pxPerSecond = usableWidth / Math.max(maxTime, 1);

    // Draw time axis
    ctx.strokeStyle = 'var(--border, #dde0e8)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, trackTop);
    ctx.lineTo(w - padding, trackTop);
    ctx.moveTo(padding, trackTop + trackHeight);
    ctx.lineTo(w - padding, trackTop + trackHeight);
    ctx.stroke();

    // Ticks
    const tickInterval = Math.max(1, Math.ceil(maxTime / 10));
    ctx.fillStyle = 'var(--text-muted, #8B93A7)';
    ctx.font = '10px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    for (let t = 0; t <= maxTime; t += tickInterval) {
      const x = padding + t * pxPerSecond;
      ctx.beginPath();
      ctx.moveTo(x, trackTop - 4);
      ctx.lineTo(x, trackTop);
      ctx.stroke();
      ctx.fillText(`${t.toFixed(0)}s`, x, trackTop - 8);
    }

    // Draw blocks
    AppState.studio.blocks.forEach(b => {
      const x = padding + b.startTime * pxPerSecond;
      const dur = b.duration || estimateDuration(b.text);
      const bw = Math.max(6, dur * pxPerSecond);
      const isGenerating = AppState.studio.generatingUids.has(b.uid);

      // Block rect
      ctx.fillStyle = isGenerating ? 'rgba(91,79,224,0.2)' : 'rgba(91,79,224,0.3)';
      ctx.strokeStyle = isGenerating ? '#5B4FE0' : 'rgba(91,79,224,0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      roundRect(ctx, x, trackTop + 2, bw, trackHeight - 4, 4);
      ctx.fill();
      ctx.stroke();

      // Label
      if (bw > 30) {
        ctx.fillStyle = 'var(--spire-accent, #5B4FE0)';
        ctx.font = 'bold 11px "IBM Plex Sans", sans-serif';
        ctx.textAlign = 'center';
        const label = b.text ? b.text.slice(0, Math.floor(bw / 6)) : '';
        ctx.fillText(label, x + bw / 2, trackTop + trackHeight / 2 + 4);
      }
    });

    if (timelineEmpty) {
      timelineEmpty.style.display = AppState.studio.blocks.length === 0 ? '' : 'none';
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  /** Play sequence */
  if (playSeqBtn) {
    playSeqBtn.addEventListener('click', async () => {
      const blocks = [...AppState.studio.blocks].sort((a, b) => a.startTime - b.startTime);
      if (blocks.length === 0) return;

      // Cancel any ongoing speech
      if (AppState.capabilities.speechSynthesis) {
        window.speechSynthesis.cancel();
      }

      let currentIdx = 0;
      const playNext = () => {
        if (currentIdx >= blocks.length) return;
        const block = blocks[currentIdx];
        const txt = block.text.trim();
        if (!txt) { currentIdx++; playNext(); return; }

        speakText(txt, null, () => {
          currentIdx++;
          playNext();
        });
      };

      playNext();
    });
  }

  /** Export SRT */
  if (exportSrtBtn) {
    exportSrtBtn.addEventListener('click', () => {
      const blocks = [...AppState.studio.blocks].sort((a, b) => a.startTime - b.startTime);
      if (blocks.length === 0) return;

      let srt = '';
      blocks.forEach((b, i) => {
        const start = b.startTime;
        const dur = b.duration || estimateDuration(b.text);
        const end = start + dur;
        srt += `${i + 1}\n`;
        srt += `${toSrtTime(start)} --> ${toSrtTime(end)}\n`;
        srt += `${b.text.trim()}\n\n`;
      });

      const blob = new Blob([srt], { type: 'text/plain;charset=utf-8' });
      downloadBlob(blob, 'avatar-studio-subtitles.srt');
    });
  }

  /** Export audio — concatenate via AudioContext */
  if (exportAudioBtn) {
    exportAudioBtn.addEventListener('click', async () => {
      const blocks = [...AppState.studio.blocks].sort((a, b) => a.startTime - b.startTime);
      if (blocks.length === 0) return;

      // We need to generate audio for each block first
      // Show a note that audio generation is happening
      exportAudioBtn.disabled = true;
      exportAudioBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating audio...';

      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const maxEnd = blocks.reduce((max, b) => {
        const dur = b.duration || estimateDuration(b.text);
        return Math.max(max, b.startTime + dur);
      }, 0);

      const sampleRate = audioContext.sampleRate;
      const totalLength = Math.ceil(maxEnd * sampleRate);
      const offlineContext = new OfflineAudioContext(2, totalLength, sampleRate);

      // Generate each block
      for (const block of blocks) {
        const text = block.text.trim();
        if (!text) continue;

        // For browser TTS we can't easily render to buffer, so we use a tone generator as placeholder
        // In a real app, ElevenLabs responses would provide actual audio buffers
        const dur = block.duration || estimateDuration(text);
        const offset = Math.floor(block.startTime * sampleRate);
        const len = Math.ceil(dur * sampleRate);

        // Create a silent buffer for this block's timeslot
        // (In production: use block.audioBuffer if from ElevenLabs)
        if (block.audioBuffer) {
          const source = offlineContext.createBufferSource();
          source.buffer = block.audioBuffer;
          source.connect(offlineContext.destination);
          source.start(block.startTime);
        }
      }

      try {
        const rendered = await offlineContext.startRendering();
        const wavBlob = await audioBufferToWav(rendered);
        downloadBlob(wavBlob, 'avatar-studio-dub.wav');
      } catch (e) {
        console.error('Audio export failed:', e);
        alert('Audio export failed. Try generating blocks with ElevenLabs for high-quality audio export.');
      }

      exportAudioBtn.disabled = false;
      exportAudioBtn.innerHTML = '<i class="fa-solid fa-file-audio"></i> Export Audio';
    });
  }

  /** Add block button */
  addBtn.addEventListener('click', () => {
    const startTime = getNextStartTime();
    createBlock(startTime, '');

    // Focus the new text input
    const blocks = $$('.av-studio-block');
    const lastBlock = blocks[blocks.length - 1];
    const input = $('.av-studio-block__text', lastBlock);
    if (input) input.focus();
  });
}

/* ═══════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════ */
function toSrtTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const ms = Math.floor((s - Math.floor(s)) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(Math.floor(s)).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function audioBufferToWav(audioBuffer) {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const length = audioBuffer.length;
  const format = 1; // PCM
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = length * blockAlign;
  const headerSize = 44;
  const buffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');

  // fmt chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);

  // data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Write samples
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = audioBuffer.getChannelData(channel);
    let offset = 44 + channel * bytesPerSample;
    for (let i = 0; i < length; i++) {
      const sample = Math.max(-1, Math.min(1, channelData[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += blockAlign;
    }
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view, offset, str) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/* ═══════════════════════════════════════════════
   REDUCED MOTION
   ═══════════════════════════════════════════════ */
function setupReducedMotion() {
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  function handleChange(e) {
    document.documentElement.style.setProperty('--prefers-reduced-motion', e.matches ? 'reduce' : 'no-preference');
  }
  handleChange(mq);
  mq.addEventListener('change', handleChange);
}

/* ═══════════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════════ */
function init() {
  setupTheme();
  setupPanels();
  setupLiveMode();
  setupStudioMode();
  setupSettingsModal();
  setupTTSEngineSelector();
  checkCapabilities();
  setupReducedMotion();
}

// Run on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}