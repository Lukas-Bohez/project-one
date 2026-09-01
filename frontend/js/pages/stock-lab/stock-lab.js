const DATA_BASE = '/data/stock-lab';

const els = {
  grid: document.getElementById('labGrid'),
  tableBody: document.getElementById('scoreboardBody'),
  loading: document.getElementById('labLoading'),
  error: document.getElementById('labError'),
  errorText: document.getElementById('labErrorText'),
  empty: document.getElementById('labEmpty'),
  retryBtn: document.getElementById('retryBtn'),
  lastUpdated: document.getElementById('lastUpdated'),
  modelCount: document.getElementById('modelCount'),
  tickerCount: document.getElementById('tickerCount'),
};

let predictions = [];
let scoreboard = [];

function showState(state) {
  if (els.loading) els.loading.style.display = state === 'loading' ? 'block' : 'none';
  if (els.error) els.error.style.display = state === 'error' ? 'block' : 'none';
  if (els.empty) els.empty.style.display = state === 'empty' ? 'block' : 'none';
}

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

function renderPredictions(items) {
  if (!els.grid) return;
  if (!items.length) {
    els.grid.innerHTML = '';
    showState('empty');
    return;
  }
  showState('hidden');
  els.grid.innerHTML = items
    .map(
      (item) => `
    <article class="lab-card" aria-label="${esc(item.ticker)} prediction for ${esc(item.date)}">
      <div class="lab-card__head">
        <div>
          <div class="lab-card__ticker">${esc(item.ticker)}</div>
          <div class="lab-card__title">${esc(item.model)}</div>
        </div>
        <div class="lab-card__date">${esc(item.date)}</div>
      </div>
      <div class="lab-card__calls">
        <span class="lab-call" data-call="${esc(item.call)}">Call: ${esc(item.call)}</span>
        ${item.actual ? `<span class="lab-call" data-call="${esc(item.actual)}">Actual: ${esc(item.actual)}</span>` : ''}
        ${item.result ? `<span class="lab-call">Result: ${esc(item.result)}</span>` : ''}
      </div>
    </article>
  `
    )
    .join('');
}

function renderScoreboard(rows) {
  if (!els.tableBody) return;
  if (!rows.length) {
    els.tableBody.innerHTML = `<tr><td colspan="6" style="color:var(--text-muted)">No entries yet.</td></tr>`;
    return;
  }
  els.tableBody.innerHTML = rows
    .map((r) => {
      const resultClass = r.result === 'correct' ? 'result-correct' : r.result === 'miss' ? 'result-miss' : 'result-pending';
      const resultText = r.result ? r.result.charAt(0).toUpperCase() + r.result.slice(1) : 'Pending';
      return `
    <tr>
      <td>${esc(r.date)}</td>
      <td>${esc(r.model)}</td>
      <td>${esc(r.ticker)}</td>
      <td>${esc(r.call)}</td>
      <td>${esc(r.actual || '—')}</td>
      <td class="${resultClass}">${resultText}</td>
    </tr>
  `;
    })
    .join('');
}

async function loadJson(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function init() {
  showState('loading');
  try {
    const [preds, scores] = await Promise.all([
      loadJson(`${DATA_BASE}/predictions.json`),
      loadJson(`${DATA_BASE}/scoreboard.json`),
    ]);

    predictions = Array.isArray(preds) ? preds : [];
    scoreboard = Array.isArray(scores) ? scores : [];

    const latestDate = predictions.reduce((a, b) => (a.date > b.date ? a : b), {}).date;
    if (els.lastUpdated) els.lastUpdated.textContent = latestDate || '—';
    if (els.modelCount) els.modelCount.textContent = new Set(predictions.map((p) => p.model)).size || 0;
    if (els.tickerCount) els.tickerCount.textContent = new Set(predictions.map((p) => p.ticker)).size || 0;

    renderPredictions(predictions);
    renderScoreboard(scoreboard);
    showState(predictions.length ? 'hidden' : 'empty');
  } catch (err) {
    console.error('Failed to load stock lab data:', err);
    if (els.errorText) els.errorText.textContent = 'Could not load predictions. Please try again.';
    showState('error');
  }
}

if (els.retryBtn) {
  els.retryBtn.addEventListener('click', () => init());
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}