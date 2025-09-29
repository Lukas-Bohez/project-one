// Dark Mode Modal (bottom-right floating button) integrated with themeManager
(function(){
  if (window.__darkModeModalInjected) return; // prevent double-inject
  window.__darkModeModalInjected = true;

  function el(tag, attrs={}, children=[]) {
    const n = document.createElement(tag);
    Object.entries(attrs).forEach(([k,v]) => {
      if (k === 'class') n.className = v; else if (k === 'style') Object.assign(n.style, v); else n.setAttribute(k, v);
    });
    (Array.isArray(children) ? children : [children]).filter(Boolean).forEach(c => n.append(c.nodeType ? c : document.createTextNode(c)));
    return n;
  }

  function createUI(){
    const fab = el('button', {class:'dm-fab', type:'button', 'aria-haspopup':'dialog', 'aria-controls':'dm-pop', title:'Toggle dark mode'}, '🌓');
    const pop = el('div', {id:'dm-pop', class:'dm-popover', role:'dialog', 'aria-modal':'false', 'aria-label':'Theme'}, [
      el('div', {class:'dm-popover__row'}, 'Theme'),
      el('div', {class:'dm-popover__actions'}, [
        el('button', {class:'c-btn c-btn--sm', type:'button', id:'dm-light'}, 'Light'),
        el('button', {class:'c-btn c-btn--sm c-btn--tertiary', type:'button', id:'dm-dark'}, 'Dark'),
        el('button', {class:'c-btn c-btn--sm', type:'button', id:'dm-toggle'}, 'Toggle')
      ])
    ]);

    document.body.append(fab, pop);

    const open = () => { pop.classList.add('is-open'); fab.setAttribute('aria-expanded','true'); };
    const close = () => { pop.classList.remove('is-open'); fab.setAttribute('aria-expanded','false'); };
    fab.addEventListener('click', (e)=>{ e.stopPropagation(); pop.classList.toggle('is-open'); fab.setAttribute('aria-expanded', pop.classList.contains('is-open')); });
    document.addEventListener('click', (e)=>{ if(!pop.contains(e.target) && e.target!==fab) close(); });

    const ensureTM = () => window.themeManager || window.themeManager?.applyTheme || window.setTheme;
    const setLight = () => window.setTheme ? window.setTheme('light') : document.documentElement.setAttribute('data-theme','light');
    const setDark = () => window.setTheme ? window.setTheme('dark') : document.documentElement.setAttribute('data-theme','dark');
    const toggle = () => window.toggleTheme ? window.toggleTheme() : document.documentElement.toggleAttribute('data-theme','dark');

    document.getElementById('dm-light').addEventListener('click', ()=>{ ensureTM(); setLight(); });
    document.getElementById('dm-dark').addEventListener('click', ()=>{ ensureTM(); setDark(); });
    document.getElementById('dm-toggle').addEventListener('click', ()=>{ ensureTM(); toggle(); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createUI);
  } else {
    createUI();
  }
})();
