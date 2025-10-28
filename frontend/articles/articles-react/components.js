/* global React */
// Lightweight React components to render an Articles hub.
// Exposes window.Articles = { App, ArticleList, ArticleCard, SearchBar }
(function(){
  const e = React.createElement;

  function SearchBar({query, onChange, tags, activeTag, onTag}){
    return e('div', {className:'a-toolbar'}, [
      e('input', {
        key:'q',
        className:'a-input',
        type:'search',
        placeholder:'Search articles…',
        value: query,
        onChange: ev => onChange(ev.target.value),
        'aria-label':'Search articles'
      }),
      e('select', {
        key:'t', className:'a-select', value: activeTag||'',
        onChange: ev => onTag(ev.target.value||null), 'aria-label':'Filter by tag'
      }, [e('option', {value:''}, 'All tags')].concat(tags.map(t=>e('option', {key:t, value:t}, t))))
    ]);
  }

  function ArticleCard({a}){
    const [expanded, setExpanded] = React.useState(false);
    const href = a.url || `article.html?slug=${encodeURIComponent(a.slug)}`;
    const click = () => { location.href = href; };
    const desc = a.description ? (a.description.length > 120 ? a.description.slice(0, 120) + '...' : a.description) : null;
    const fullDesc = a.description;
    return e('article', {className:'a-card', role:'article'}, [
      a.thumbnail ? e('img', {className:'a-card__thumb', src:a.thumbnail, alt:''}) : null,
      e('div', {className:'a-card__body'}, [
        e('h2', {className:'a-card__title'}, a.title),
        e('div', {className:'a-card__meta'}, `${new Date(a.date).toLocaleDateString()}${a.author? ' • ' + a.author:''}`),
        fullDesc ? e('p', {className: expanded ? 'a-card__desc a-card__desc--expanded' : 'a-card__desc'}, expanded ? fullDesc : desc) : null,
        fullDesc && fullDesc.length > 120 ? e('button', {
          className:'a-card__expand-btn',
          onClick: (e) => { e.stopPropagation(); setExpanded(!expanded); },
          'aria-expanded': expanded
        }, expanded ? 'Show less' : 'Read more') : null,
        a.tags?.length ? e('div', {className:'a-card__tags'}, a.tags.map(t=>e('span', {key:t, className:'tag'}, t))) : null,
        e('div', {style:{marginTop:'auto'}},
          e('a', {className:'c-btn c-btn--tertiary', href: href}, 'Read article')
        )
      ])
    ]);
  }

  function ArticleList({items}){
    if(!items.length){
      return e('p', null, 'No articles match your search.');
    }
    return e('section', {className:'a-grid'}, items.map(a=>e(ArticleCard, {key:a.slug, a})));
  }

  function App({articles}){
    const [query, setQuery] = React.useState('');
    const [tag, setTag] = React.useState(null);

    const tags = React.useMemo(()=>{
      const t = new Set();
      articles.forEach(a=>a.tags?.forEach(x=>t.add(x)));
      return Array.from(t).sort();
    }, [articles]);

    const filtered = articles.filter(a=>{
      const q = query.trim().toLowerCase();
      const inTag = !tag || (a.tags||[]).includes(tag);
      if(!q) return inTag;
      const blob = `${a.title} ${a.description||''} ${(a.tags||[]).join(' ')}`.toLowerCase();
      return inTag && blob.includes(q);
    }).sort((a,b)=>new Date(b.date)-new Date(a.date));

    return e(React.Fragment, null, [
      e(SearchBar, {key:'sb', query, onChange:setQuery, tags, activeTag:tag, onTag:setTag}),
      e(ArticleList, {key:'list', items: filtered})
    ]);
  }

  window.Articles = { App, ArticleList, ArticleCard, SearchBar };
})();
