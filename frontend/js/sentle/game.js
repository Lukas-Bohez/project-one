/**
 * Sentle — sequential sentence-guessing game client.
 *
 * SENTLE REDESIGN — see masterprompt.md for
 * the full design rationale, research findings, and the API contract
 * this file talks to. Keep this file and that document in lockstep.
 *
 * INTEGRATION
 * This file renders the entire game into one mount point. Point
 * ROOT_SELECTOR below at whatever container already exists on
 * /pages/sentle/ (or add an empty <div id="sentle-root"></div> where
 * the old static markup used to live) -- everything else is built
 * from here, driven by the puzzle metadata the server returns, so it
 * naturally adapts to any sentence length or mode without touching
 * the page's HTML again.
 *
 * GAMEPLAY MODEL
 * One word is "active" at a time. Guessing it correctly -- or running
 * out of its attempt budget -- locks it permanently into the sentence
 * banner and activates the next word. The on-screen keyboard's
 * green/yellow/gray state is scoped to the active word and resets
 * when a new word becomes active (masterprompt §3).
 */

(() => {
  'use strict';

  // ---------------------------------------------------------------
  // Config
  // ---------------------------------------------------------------

  const ROOT_SELECTOR = '#sentle-root';
  const API_BASE = '/api/v1/sentle';
  const STORAGE_PREFIX = 'sentle:progress:';
  const KEYBOARD_ROWS = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', '⌫'],
  ];

  // ---------------------------------------------------------------
  // State
  //
  // Each slot's `history` holds one entry per submitted attempt for
  // that word: { guess, marks }. Both are kept (not just marks) so a
  // page reload can rebuild the on-screen keyboard's coloring from
  // localStorage -- marks alone aren't enough to know which physical
  // keys they belonged to.
  // ---------------------------------------------------------------

  const state = {
    root: null,
    mode: 'daily',
    puzzleId: null,
    slots: [],
    activeIndex: 0,
    keyboardState: {},   // letter -> 'correct' | 'present' | 'absent', scoped to the active word
    busy: false,          // true while a validate request is in flight
    complete: false,
    pendingReveal: null,  // { wordIndex, attemptKey } -- see isPendingReveal()
    shakingIndex: null,   // word index currently playing the invalid-guess shake, or null
  };

  // ---------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------

  async function init(mode = 'daily', seed = null) {
    const root = document.querySelector(ROOT_SELECTOR);
    if (!root) {
      console.error(`Sentle: mount point "${ROOT_SELECTOR}" not found.`);
      return;
    }
    state.root = root;
    state.mode = mode;
    root.setAttribute('aria-live', 'polite');
    root.innerHTML = renderLoadingSkeleton();

    try {
      const url = mode === 'infinite'
        ? `${API_BASE}/random${seed ? `?seed=${encodeURIComponent(seed)}` : ''}`
        : `${API_BASE}/daily`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error(`Sentle: ${url} responded ${res.status}`);
      const data = await res.json();
      hydrateFromPuzzle(data);
      restoreProgress();
      render();
    } catch (err) {
      console.error(err);
      root.innerHTML = renderErrorState();
    }
  }

  function hydrateFromPuzzle(data) {
    state.puzzleId = data.puzzle_id;
    state.slots = data.slots.map((s) => ({
      index: s.index,
      length: s.length,
      pos: s.pos,
      hint: s.hint || '',
      maxAttempts: s.max_attempts,
      attemptsUsed: 0,
      locked: false,
      revealed: false,
      answer: '',
      history: [],
      draft: '',
    }));
    state.activeIndex = 0;
    state.keyboardState = {};
    state.complete = false;
    state.pendingReveal = null;
  }

  // ---------------------------------------------------------------
  // Local persistence (per puzzle_id, so a reload mid-solve resumes
  // instead of re-fetching a puzzle you've already made progress on)
  // ---------------------------------------------------------------

  function storageKey() {
    return `${STORAGE_PREFIX}${state.mode}:${state.puzzleId}`;
  }

  function saveProgress() {
    try {
      localStorage.setItem(storageKey(), JSON.stringify({
        slots: state.slots,
        activeIndex: state.activeIndex,
        complete: state.complete,
      }));
    } catch (_) {
      // Storage full or unavailable (e.g. private browsing) -- fail
      // silently, gameplay still works, it just won't resume on reload.
    }
  }

  function restoreProgress() {
    try {
      const raw = localStorage.getItem(storageKey());
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved.slots?.length === state.slots.length) {
        state.slots = saved.slots;
        state.activeIndex = saved.activeIndex;
        state.complete = saved.complete;
        rebuildKeyboardStateForActiveWord();
      }
    } catch (_) {
      // Corrupt or unreadable -- start fresh rather than crash.
    }
  }

  function rebuildKeyboardStateForActiveWord() {
    state.keyboardState = {};
    const slot = state.slots[state.activeIndex];
    if (!slot) return;
    for (const attempt of slot.history) {
      updateKeyboardState(attempt.guess, attempt.marks);
    }
  }

  // ---------------------------------------------------------------
  // Input handling
  // ---------------------------------------------------------------

  function bindGlobalEvents() {
    document.addEventListener('keydown', onPhysicalKey);
    document.addEventListener('click', onDelegatedClick);
  }

  function onPhysicalKey(e) {
    if (!state.root || state.busy || state.complete) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    // Don't hijack typing into unrelated fields on the same page
    // (e.g. the existing "Your Name" setting).
    if (e.target.matches?.('input, textarea, [contenteditable="true"]')) return;

    const key = e.key;
    if (key === 'Enter') return handleKey('ENTER');
    if (key === 'Backspace') return handleKey('⌫');
    if (/^[a-zA-Z]$/.test(key)) return handleKey(key.toUpperCase());
  }

  function onDelegatedClick(e) {
    const keyBtn = e.target.closest('[data-key]');
    if (keyBtn && !state.busy && !state.complete) {
      handleKey(keyBtn.dataset.key);
      return;
    }
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'share') shareResult();
    if (action === 'retry') init(state.mode);
  }

  function handleKey(key) {
    const slot = state.slots[state.activeIndex];
    if (!slot || slot.locked) return;

    if (key === '⌫') {
      slot.draft = slot.draft.slice(0, -1);
      return render();
    }
    if (key === 'ENTER') {
      return submitGuess();
    }
    if (slot.draft.length < slot.length) {
      slot.draft += key.toLowerCase();
      render();
    }
  }

  // ---------------------------------------------------------------
  // Guess submission
  // ---------------------------------------------------------------

  async function submitGuess() {
    const slot = state.slots[state.activeIndex];
    if (slot.draft.length !== slot.length) {
      return shakeActiveWord();
    }

    state.busy = true;
    try {
      const res = await fetch(`${API_BASE}/validate`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          puzzle_id: state.puzzleId,
          word_index: slot.index,
          guess: slot.draft,
        }),
      });

      if (res.status === 400) {
        state.busy = false;
        return shakeActiveWord('Not a valid guess.');
      }
      if (!res.ok) throw new Error(`validate responded ${res.status}`);

      const result = await res.json();
      applyValidateResult(slot, result);
    } catch (err) {
      console.error(err);
      shakeActiveWord('Connection issue -- try again.');
    } finally {
      state.busy = false;
    }
  }

  function applyValidateResult(slot, result) {
    slot.attemptsUsed = result.attempts_used;
    slot.history.push({ guess: slot.draft, marks: result.letters });
    updateKeyboardState(slot.draft, result.letters);

    // Flag exactly which row just got judged so render() bakes the
    // reveal-flip/lock-in classes into only that row's HTML -- without
    // this, a full re-render on every keystroke would replay the
    // reveal flip on every past row too, not just the new one.
    state.pendingReveal = {
      wordIndex: slot.index,
      attemptKey: result.word_locked ? 'locked' : slot.history.length - 1,
    };

    if (result.word_locked) {
      slot.locked = true;
      slot.revealed = result.word_revealed;
      slot.answer = result.answer;
      if (!result.game_complete) {
        state.activeIndex = result.next_index;
        state.keyboardState = {};
      }
      // state.complete is set below, after the final word's own
      // lock-in has had time to play, so the two moments don't
      // visually collide.
    } else {
      slot.draft = '';
      state.shakingIndex = slot.index;
    }

    saveProgress();
    render(); // bakes pendingReveal / shakingIndex into fresh HTML; CSS animations start now

    if (result.word_locked) {
      // 1100ms comfortably covers the longest staggered tile-flip
      // (up to ~630ms delay + 420ms duration for an 8-letter word)
      // plus the lock-in stamp (560ms).
      setTimeout(() => {
        state.pendingReveal = null;
        if (result.game_complete) {
          state.complete = true;
          announce('Sentence complete! ' + buildShareSummary());
        }
        render();
      }, 1100);
    } else {
      setTimeout(() => {
        state.shakingIndex = null;
        render();
      }, 500);
    }
  }

  function updateKeyboardState(guess, marks) {
    const rank = { absent: 0, present: 1, correct: 2 };
    [...guess].forEach((letter, i) => {
      const mark = marks[i];
      const current = state.keyboardState[letter];
      if (!current || rank[mark] > rank[current]) {
        state.keyboardState[letter] = mark;
      }
    });
  }

  function isPendingReveal(wordIndex, attemptKey) {
    return !!state.pendingReveal
      && state.pendingReveal.wordIndex === wordIndex
      && state.pendingReveal.attemptKey === attemptKey;
  }

  // ---------------------------------------------------------------
  // Animation triggers (keyframes live in style.css; these just
  // toggle the classes that fire them and clean up afterward)
  // ---------------------------------------------------------------

  function shakeActiveWord(message) {
    state.shakingIndex = state.activeIndex;
    render();
    setTimeout(() => {
      state.shakingIndex = null;
      render();
    }, 500);
    if (message) announce(message);
  }

  function announce(text) {
    const live = state.root.querySelector('[data-announcer]');
    if (live) live.textContent = text;
  }

  // ---------------------------------------------------------------
  // Share summary (Wordle-style emoji recap)
  // ---------------------------------------------------------------

  function buildShareSummary() {
    const emojiFor = { correct: '🟩', present: '🟨', absent: '⬜' };
    const lines = state.slots.map((slot) => {
      if (slot.revealed) return '🔓'.repeat(slot.length);
      const lastAttempt = slot.history[slot.history.length - 1];
      const marks = lastAttempt ? lastAttempt.marks : [];
      return marks.map((m) => emojiFor[m] || '').join('');
    });
    const title = state.mode === 'daily'
      ? `Sentle ${state.puzzleId}`
      : `Sentle Infinite #${state.puzzleId}`;
    return [title, ...lines].join('\n');
  }

  async function shareResult() {
    const text = buildShareSummary();
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch (_) {
        // User cancelled the share sheet -- fall through to clipboard.
      }
    }
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      announce('Result copied to clipboard.');
    }
  }

  // ---------------------------------------------------------------
  // Rendering
  //
  // Full re-render on every state change (simple, correct at this
  // scale -- a handful of words and keys). Event listeners are all
  // delegated from `document` in bindGlobalEvents(), so they survive
  // every re-render without needing to be re-attached.
  // ---------------------------------------------------------------

  function render() {
    state.root.innerHTML = `
      <div class="sentle-banner ${state.complete ? 'is-complete' : ''}">
        ${state.slots.map(renderWordGroup).join('')}
      </div>
      ${renderActiveWordPanel()}
      ${renderKeyboard()}
      <div class="sentle-announcer visually-hidden" data-announcer aria-live="polite"></div>
      ${state.complete ? renderCompletionPanel() : ''}
    `;
  }

  function renderWordGroup(slot) {
    const isActive = slot.index === state.activeIndex && !slot.locked;
    const isFuture = slot.index > state.activeIndex && !slot.locked;

    let rowsHtml;
    if (slot.locked) {
      const revealing = isPendingReveal(slot.index, 'locked') ? 'is-revealing' : '';
      const stateClass = slot.revealed ? 'is-revealed' : 'is-correct';
      rowsHtml = renderTileRow(slot.answer.split(''), slot.length, () => `${stateClass} ${revealing}`);
    } else if (isFuture) {
      rowsHtml = renderTileRow([], slot.length, () => 'is-empty');
    } else {
      const pastRows = slot.history.map((attempt, attemptIndex) => {
        const revealing = isPendingReveal(slot.index, attemptIndex) ? 'is-revealing' : '';
        return renderTileRow(attempt.guess.split(''), slot.length, (i) => `is-${attempt.marks[i]} ${revealing}`);
      }).join('');
      const draftLetters = padDraft(slot.draft, slot.length).split('');
      const draftRow = renderTileRow(draftLetters, slot.length,
        (i) => (draftLetters[i] && draftLetters[i] !== ' ' ? 'is-filled' : 'is-empty'));
      rowsHtml = pastRows + draftRow;
    }

    const lockingIn = isPendingReveal(slot.index, 'locked') ? 'is-locking-in' : '';
    const shaking = slot.index === state.shakingIndex ? 'is-shaking' : '';
    return `
      <div class="sentle-word-group ${isActive ? 'is-active' : ''} ${slot.locked ? 'is-locked' : ''} ${lockingIn} ${shaking}"
           data-word-group="${slot.index}">
        <div class="sentle-word-rows">${rowsHtml}</div>
      </div>`;
  }

  function renderTileRow(letters, length, classFor) {
    const cells = [];
    for (let i = 0; i < length; i++) {
      const letter = letters[i] && letters[i] !== ' ' ? letters[i] : '';
      cells.push(`<div class="sentle-tile ${classFor(i)}">${letter}</div>`);
    }
    return `<div class="sentle-tile-row">${cells.join('')}</div>`;
  }

  function renderActiveWordPanel() {
    const slot = state.slots[state.activeIndex];
    if (!slot || slot.locked || state.complete) return '';
    const remaining = slot.maxAttempts - slot.attemptsUsed;
    return `
      <div class="sentle-active-panel">
        <div class="sentle-hint-tags">
          ${slot.pos ? `<span class="sentle-tag sentle-tag--pos">${slot.pos}</span>` : ''}
          ${slot.hint ? `<span class="sentle-tag sentle-tag--hint">${slot.hint}</span>` : ''}
        </div>
        <p class="sentle-attempts">Word ${slot.index + 1} of ${state.slots.length}
          · ${remaining} attempt${remaining === 1 ? '' : 's'} left</p>
      </div>`;
  }

  function renderKeyboard() {
    return `
      <div class="sentle-keyboard">
        ${KEYBOARD_ROWS.map((row) => `
          <div class="sentle-keyboard-row">
            ${row.map((key) => {
              const wide = key === 'ENTER' || key === '⌫';
              const mark = state.keyboardState[key.toLowerCase()];
              return `<button type="button" class="sentle-key ${wide ? 'is-wide' : ''} ${mark ? `is-${mark}` : ''}"
                        data-key="${key}" aria-label="${key === '⌫' ? 'Backspace' : key}">${key}</button>`;
            }).join('')}
          </div>`).join('')}
      </div>`;
  }

  function renderCompletionPanel() {
    return `
      <div class="sentle-completion">
        <p>Sentence complete!</p>
        <pre class="sentle-share-preview">${buildShareSummary()}</pre>
        <button type="button" class="sentle-share-button" data-action="share">Share result</button>
      </div>`;
  }

  function renderLoadingSkeleton() {
    return `<div class="sentle-loading" aria-busy="true">Loading today's Sentle…</div>`;
  }

  function renderErrorState() {
    return `<div class="sentle-error">Couldn't load Sentle right now. <button type="button" data-action="retry">Try again</button></div>`;
  }

  function padDraft(draft, length) {
    return draft.padEnd(length, ' ');
  }

  // ---------------------------------------------------------------
  // Public entry points
  //
  // The daily page just needs this script included -- it boots
  // itself. For an Infinite Mode page, call Sentle.init('infinite')
  // (optionally with a seed to replay a shared puzzle) instead of
  // relying on the default DOMContentLoaded boot below.
  // ---------------------------------------------------------------

  window.Sentle = { init };
  bindGlobalEvents();
  document.addEventListener('DOMContentLoaded', () => init('daily'));
})();
