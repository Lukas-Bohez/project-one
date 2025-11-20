/* donationProgress.js
   Simple client-side donation tracker for the progress bar in converter.html
   - Stores totals in localStorage (per-month)
   - Auto-resets at month boundary
   - Exposes simple API: add(amount), setTotal(amount), setGoal(amount), reset(), getState()
   - Optional remote sync: set CONFIG.fetchUrl and enable fetchOnInit to pull server totals

   Usage:
   - Include this script in converter.html (already added by the assistant)
   - From console or other scripts call: DonationProgress.add(5)
   - To change config, edit the CONFIG object below
*/

(function () {
  'use strict';

  // --- CONFIG: edit these values to suit your site ---
  const CONFIG = {
    storageKey: 'convertTheSpire.donation',
    // starting total for a new month (set to 0 if you want to start from zero)
    startingTotal: 320,
    // monthly goal displayed on the site (in baseCurrency)
    goal: 1000,
    // base currency used for storage and goal (server totals should be normalized to this)
    baseCurrency: 'USD',
    // supported display currencies and their symbols
    supportedCurrencies: [
      { code: 'USD', symbol: '$', name: 'US Dollar' },
      { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
      { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
      { code: 'CAD', symbol: '$', name: 'Canadian Dollar' },
      { code: 'EUR', symbol: '€', name: 'Euro' },
      { code: 'GBP', symbol: '£', name: 'British Pound' },
      { code: 'AUD', symbol: '$', name: 'Australian Dollar' }
    ],
    // if you have a totals endpoint returning { monthTotal, monthGoal, currency }
    // you can set fetchUrl and set fetchOnInit true to pull remote totals
    fetchUrl: '', // e.g. '/donations/totals'
    fetchOnInit: false,
    // how often to refresh remote totals (ms)
    fetchInterval: 1000 * 60 * 5,
    // whether to write remote totals into localStorage (true = replace local state)
    acceptRemoteTotals: true,
    // live FX provider (exchangerate.host free public API)
    fx: {
      provider: 'exchangerate.host',
      // URL template: replace {base} and {symbols}
      urlTemplate: 'https://api.exchangerate.host/latest?base={base}&symbols={symbols}',
      fetchOnInit: true,
      fetchInterval: 1000 * 60 * 60, // hourly
    }
  };

  // --- internal helpers ---
  function nowMonthKey() {
    const d = new Date();
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; // YYYY-MM
  }

  // month index 1-12 for quick checking as requested
  function nowMonthIndex() {
    const d = new Date();
    return d.getUTCMonth() + 1; // 1-12
  }

  function readState() {
    try {
      const raw = localStorage.getItem(CONFIG.storageKey);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      console.warn('donationProgress: failed to read localStorage', e);
      return null;
    }
  }

  function writeState(state) {
    try {
      localStorage.setItem(CONFIG.storageKey, JSON.stringify(state));
    } catch (e) {
      console.warn('donationProgress: failed to write localStorage', e);
    }
  }

  function formatNumber(n) {
    try {
      return n.toLocaleString();
    } catch (e) {
      return String(n);
    }
  }

  // --- state initialization and reset logic ---
  function ensureState() {
    let state = readState();
    const currentMonth = nowMonthKey();
    if (!state || state.month !== currentMonth) {
      // new month -> reset
      state = {
        month: currentMonth,
        monthIndex: nowMonthIndex(), // 1-12 store for quick checking
        total: CONFIG.startingTotal || 0,
        goal: CONFIG.goal,
        currency: CONFIG.baseCurrency,
        updatedAt: new Date().toISOString(),
      };
      writeState(state);
    }
    // ensure shape
    state.goal = state.goal || CONFIG.goal;
    state.currency = state.currency || CONFIG.currency;
    return state;
  }

  // --- DOM updates ---
  function updateDom(state) {
    const amtEl = document.getElementById('donation-amount');
    const goalEl = document.getElementById('donation-goal');
    const progEl = document.getElementById('donation-progress');
    const curSelect = document.getElementById('donation-currency-select');
    const convContainer = document.getElementById('donation-conversions');
    // populate currency selector (once)
    if (curSelect && curSelect.options.length === 0) {
      CONFIG.supportedCurrencies.forEach(({ code, symbol, name }) => {
        const opt = document.createElement('option');
        opt.value = code;
        opt.textContent = `${code} — ${name}`;
        curSelect.appendChild(opt);
      });
      // pick a sensible default using user locale
      const detected = detectUserCurrency();
      const defaultCurrency = detected || state.currency || CONFIG.baseCurrency;
      try { curSelect.value = defaultCurrency; } catch (e) {}
      // when changed, refresh display
      curSelect.addEventListener('change', () => renderSelectedCurrency(state));
    }

    // always render selected currency view (only show the selected, localized amount)
    renderSelectedCurrency(state);
  }

  // Detect user's likely currency from navigator locale (best-effort)
  function detectUserCurrency() {
    try {
      const lang = (navigator.languages && navigator.languages[0]) || navigator.language || '';
      // lang often like 'en-US' or 'ja-JP'
      const parts = lang.split(/[-_]/);
      const region = (parts[1] || parts[0] || '').toUpperCase();
      // map some common regions to currencies
      const regionToCurrency = {
        'US': 'USD', 'CA': 'CAD', 'GB': 'GBP', 'UK': 'GBP', 'AU': 'AUD', 'JP': 'JPY', 'CN': 'CNY', 'FR': 'EUR', 'DE': 'EUR', 'ES': 'EUR', 'IT': 'EUR', 'NL': 'EUR', 'BE': 'EUR', 'SE': 'EUR'
      };
      if (regionToCurrency[region]) return regionToCurrency[region];
      // fallback: some languages indicate euro countries
      if (parts[0] && ['fr','de','es','it','nl','sv'].includes(parts[0].toLowerCase())) return 'EUR';
      return CONFIG.baseCurrency;
    } catch (e) {
      return CONFIG.baseCurrency;
    }
  }

  // Render only the selected currency (localized display)
  function renderSelectedCurrency(state) {
    const convContainer = document.getElementById('donation-conversions');
    const curSelect = document.getElementById('donation-currency-select');
    const amtEl = document.getElementById('donation-amount');
    const goalEl = document.getElementById('donation-goal');
    const progEl = document.getElementById('donation-progress');
    const baseCurrencyEl = document.getElementById('donation-base-currency');

    const selected = (curSelect && curSelect.value) || state.currency || CONFIG.baseCurrency;
    const convTotal = convertAmount(state.total, selected);
    const convGoal = convertAmount(state.goal, selected);
    const symbol = symbolFor(selected) || '';

    if (amtEl) amtEl.textContent = `${symbol}${formatNumber(convTotal)}`;
    if (goalEl) goalEl.textContent = `${formatNumber(convGoal)}`;
    if (baseCurrencyEl) baseCurrencyEl.textContent = selected;

    if (progEl) {
      progEl.max = convGoal;
      progEl.value = Math.min(convTotal, convGoal);
      progEl.setAttribute('aria-valuenow', String(Math.min(convTotal, convGoal)));
      progEl.setAttribute('aria-valuemax', String(convGoal));
      progEl.setAttribute('aria-label', `Donations ${convTotal} of ${convGoal} ${selected}`);
    }

    // show only the selected currency in the conversions container (summary)
    if (convContainer) {
      convContainer.innerHTML = `<div style="font-weight:600;margin-bottom:6px;">${symbol}${formatNumber(convTotal)} ${selected} (current)</div>`;
    }
  }

  // Render converted equivalents for supported currencies
  function renderConversions(state) {
    const convContainer = document.getElementById('donation-conversions');
    const curSelect = document.getElementById('donation-currency-select');
    if (!convContainer) return;
    // prefer selected currency for primary display
    const selected = (curSelect && curSelect.value) || state.currency || CONFIG.baseCurrency;
    const lines = [];
    // show primary selected converted value first
    const primary = convertAmount(state.total, selected);
    const symbol = symbolFor(selected) || '';
    lines.push(`<div style="font-weight:600;margin-bottom:6px;">${symbol}${formatNumber(primary)} ${selected} (current)</div>`);
    // show a short list of other currencies (max 4)
    CONFIG.supportedCurrencies.forEach(({ code, symbol: s }) => {
      if (code === selected) return;
      const v = convertAmount(state.total, code);
      lines.push(`<div style="font-size:0.92em;color:var(--text-secondary);">${s}${formatNumber(v)} ${code}</div>`);
    });
    convContainer.innerHTML = lines.join('');
  }

  // --- public API ---
  const DonationProgress = {
    getState: function () {
      return readState() || ensureState();
    },
    add: function (amount) {
      if (typeof amount !== 'number' || Number.isNaN(amount)) return;
      const state = ensureState();
      state.total = Math.round((Number(state.total) + Number(amount)) * 100) / 100;
      state.updatedAt = new Date().toISOString();
      writeState(state);
      updateDom(state);
      return state;
    },
    setTotal: function (amount) {
      const state = ensureState();
      state.total = Number(amount) || 0;
      state.updatedAt = new Date().toISOString();
      writeState(state);
      updateDom(state);
      return state;
    },
    setGoal: function (amount) {
      const state = ensureState();
      state.goal = Number(amount) || CONFIG.goal;
      writeState(state);
      updateDom(state);
      return state;
    },
    reset: function () {
      const state = {
        month: nowMonthKey(),
        total: CONFIG.startingTotal || 0,
        goal: CONFIG.goal,
        currency: CONFIG.currency,
        updatedAt: new Date().toISOString(),
      };
      writeState(state);
      updateDom(state);
      return state;
    },
    // optional: fetch remote totals and optionally replace local state
    fetchRemote: async function () {
      if (!CONFIG.fetchUrl) return null;
      try {
        const r = await fetch(CONFIG.fetchUrl, { cache: 'no-store' });
        if (!r.ok) throw new Error('fetch failed');
        const json = await r.json();
        // expected shape: { monthTotal, monthGoal, currency }
        if (json && typeof json.monthTotal !== 'undefined') {
          const state = ensureState();
          if (CONFIG.acceptRemoteTotals) {
            state.total = Number(json.monthTotal) || state.total;
            state.goal = Number(json.monthGoal) || state.goal;
            state.currency = json.currency || state.currency;
            state.updatedAt = new Date().toISOString();
            writeState(state);
            updateDom(state);
            return state;
          }
        }
        return null;
      } catch (e) {
        console.warn('donationProgress: fetchRemote failed', e);
        return null;
      }
    }
    ,
    // Fetch FX rates from provider and store locally
    fetchRates: async function () {
      try {
        const symbols = CONFIG.supportedCurrencies.map(c => c.code).join(',');
        const url = CONFIG.fx.urlTemplate.replace('{base}', CONFIG.baseCurrency).replace('{symbols}', symbols);
        const r = await fetch(url);
        if (!r.ok) throw new Error('fx fetch failed');
        const json = await r.json();
        if (json && json.rates) {
          // store rates in localStorage under storageKey + '.rates'
          const key = CONFIG.storageKey + '.rates';
          localStorage.setItem(key, JSON.stringify({ fetchedAt: new Date().toISOString(), base: json.base || CONFIG.baseCurrency, rates: json.rates }));
          return json.rates;
        }
      } catch (e) {
        console.warn('donationProgress: fetchRates failed', e);
        return null;
      }
    },
    // get rates (from localStorage or static fallback)
    getRates: function () {
      const key = CONFIG.storageKey + '.rates';
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          return parsed.rates || null;
        }
      } catch (e) {}
      // fallback static approximate rates (Replace with live fetch for accuracy)
      return {
        USD: 1,
        JPY: 150,
        CNY: 7.2,
        CAD: 1.35,
        EUR: 0.92,
        GBP: 0.78,
        AUD: 1.51
      };
    },
    // convert amount (in baseCurrency) to target currency using rates
    convertTo: function (amount, targetCode) {
      const rates = DonationProgress.getRates();
      if (!rates) return amount;
      const rate = rates[targetCode];
      if (typeof rate === 'undefined') return amount;
      // if provider rates are expressed as target-per-base, multiply
      return Math.round((Number(amount) * Number(rate)) * 100) / 100;
    }
  };

  // attach to window for manual updates from console or other scripts
  window.DonationProgress = DonationProgress;

  // initialize on DOMContentLoaded
  document.addEventListener('DOMContentLoaded', function () {
    const state = ensureState();
    updateDom(state);
    if (CONFIG.fetchOnInit && CONFIG.fetchUrl) {
      DonationProgress.fetchRemote();
      setInterval(() => DonationProgress.fetchRemote(), CONFIG.fetchInterval);
    }
    // FX rates fetching
    if (CONFIG.fx && CONFIG.fx.fetchOnInit) {
      DonationProgress.fetchRates();
      setInterval(() => DonationProgress.fetchRates(), CONFIG.fx.fetchInterval);
    }
  });

  // helper: convert amount wrapper used by renderConversions
  function convertAmount(amount, targetCode) {
    if (!targetCode) return amount;
    // if rates are returned as { USD:1, EUR:0.92 } meaning 1 USD = 0.92 EUR
    return DonationProgress.convertTo(amount, targetCode);
  }

  function symbolFor(code) {
    const entry = CONFIG.supportedCurrencies.find(c => c.code === code);
    return entry ? entry.symbol : '';
  }

})();
