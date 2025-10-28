// AI Image Provider using Lexica API with caching and graceful fallbacks
// No API keys required. Generates image URLs for queries and applies them to DOM.
(function(){
  'use strict';

  const CACHE_KEY = 'qts-articles-ai-images-v2'; // Updated to force cache refresh for better housing images
  const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

  function loadCache(){
    try{
      const raw = localStorage.getItem(CACHE_KEY);
      return raw ? JSON.parse(raw) : {};
    }catch(_){ return {}; }
  }
  function saveCache(cache){
    try{ localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); }catch(_){}
  }

  function slugify(str){
    return (str || '').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
  }

  async function lexicaSearch(query){
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    try {
      const url = `https://lexica.art/api/v1/search?q=${encodeURIComponent(query)}`;
      const res = await fetch(url, {
        mode:'cors',
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if(!res.ok) throw new Error('Lexica search failed: '+res.status);
      const data = await res.json();
      if(!data || !Array.isArray(data.images) || data.images.length === 0){
        throw new Error('No images from Lexica');
      }
      // Prefer highest quality src if available
      const img = data.images[0];
      const src = img.src || img.srcSmall || img.image || img.url;
      if(!src) throw new Error('No usable image URL');
      return {url: src, prompt: img.prompt || query};
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Lexica search timed out');
      }
      throw error;
    }
  }

  function fallbackImage(query){
    // Picsum with seeded size for stable look; not topic-accurate but graceful
    const seed = slugify(query) || Math.random().toString(36).slice(2);
    return {url: `https://picsum.photos/seed/${seed}/1200/630`, prompt: query};
  }

  async function getAiImage(query){
    const cache = loadCache();
    const key = slugify(query);
    const now = Date.now();
    const hit = cache[key];
    if(hit && (now - hit.ts) < CACHE_TTL_MS) return hit;

    try{
      const result = await lexicaSearch(query);
      cache[key] = {url: result.url, prompt: result.prompt, ts: now};
      saveCache(cache);

      // Notify service worker to cache this image
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'CACHE_IMAGE',
          url: result.url,
          query: query
        });
      }

      return cache[key];
    }catch(err){
      console.warn('Lexica failed, using fallback image for', query, err);
      const f = fallbackImage(query);
      cache[key] = {url: f.url, prompt: f.prompt, ts: now};
      saveCache(cache);

      // Notify service worker to cache fallback image too
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'CACHE_IMAGE',
          url: f.url,
          query: query
        });
      }

      return cache[key];
    }
  }

  async function applyToThumb(thumbEl, query){
    try{
      const {url} = await getAiImage(query);
      // Remove any existing placeholder nodes (e.g., emoji spans/text)
      Array.from(thumbEl.childNodes).forEach(node => {
        const isImgNode = node.nodeType === 1 && node.matches && node.matches('img.a-card__img');
        if (!isImgNode) {
          thumbEl.removeChild(node);
        }
      });

      // Ensure we have a single image element
      let img = thumbEl.querySelector('img.a-card__img');
      if(!img){
        img = document.createElement('img');
        img.className = 'a-card__img';
        img.loading = 'lazy';
        thumbEl.appendChild(img);
      }
      img.onload = function() {
        const aspectRatio = this.naturalWidth / this.naturalHeight;
        
        // Adjust thumb container based on image aspect ratio
        if (aspectRatio > 2) {
          // Very wide image - use landscape mode
          thumbEl.style.aspectRatio = `${aspectRatio}`;
          thumbEl.style.maxHeight = '200px';
        } else if (aspectRatio < 0.8) {
          // Tall image - use portrait mode  
          thumbEl.style.aspectRatio = `${aspectRatio}`;
          thumbEl.style.maxHeight = '300px';
        } else {
          // Standard ratio - keep default
          thumbEl.style.aspectRatio = '16/9';
          thumbEl.style.maxHeight = 'none';
        }
        
        // Ensure image fills container properly
        if (aspectRatio > 1.78) {
          // Wide image - fit height and crop sides
          this.style.objectFit = 'cover';
          this.style.objectPosition = 'center';
        } else if (aspectRatio < 1.5) {
          // Narrow image - fit width and crop top/bottom  
          this.style.objectFit = 'cover';
          this.style.objectPosition = 'center top';
        } else {
          // Good aspect ratio
          this.style.objectFit = 'cover';
          this.style.objectPosition = 'center';
        }
      };
      // If AI image fails to load, hide the img and mark as no image
      img.onerror = function(){
        this.style.display = 'none';
        thumbEl.classList.add('no-img');
      };
      
      img.src = url;
      img.style.display = 'block';
      thumbEl.classList.remove('no-img');
    }catch(err){
      console.error('Failed to apply AI image to card', err);
    }
  }

  async function applyToInlineImage(imgEl, query){
    try{
      const {url} = await getAiImage(query);
      
      // Special handling for header background images
      if (imgEl.classList.contains('header-bg-image')) {
        imgEl.onload = function() {
          const aspectRatio = this.naturalWidth / this.naturalHeight;
          
          // Adjust height based on image aspect ratio for better composition
          if (aspectRatio > 2.5) {
            // Very wide image - reduce height to show more of the image
            this.style.height = '300px';
            this.style.objectPosition = 'center 30%';
          } else if (aspectRatio < 1.2) {
            // Tall image - increase height to show more content
            this.style.height = '500px';
            this.style.objectPosition = 'center 20%';
          } else {
            // Standard landscape - keep default
            this.style.height = '400px';
            this.style.objectPosition = 'center 25%';
          }
        };
      }
      
      imgEl.src = url;
      imgEl.loading = 'lazy';
    }catch(err){
      console.error('Failed to apply AI image to inline element', err);
    }
  }

  async function populateThumbnails(container){
    const thumbs = (container || document).querySelectorAll('[data-ai-query]');
    // Process all thumbnails in parallel to avoid blocking
    const promises = Array.from(thumbs).map(async (t) => {
      try {
        const q = t.getAttribute('data-ai-query');
        if(q) await applyToThumb(t, q);
      } catch (err) {
        console.warn('Failed to load thumbnail:', err);
        // Continue with other thumbnails even if one fails
      }
    });
    // Don't await here - let thumbnails load in background
    Promise.allSettled(promises).catch(err => console.warn('Some thumbnails failed to load:', err));
  }

  async function populateInline(){
    const imgs = document.querySelectorAll('img[data-ai-query]');
    for(const el of imgs){
      const q = el.getAttribute('data-ai-query');
      if(q) await applyToInlineImage(el, q);
    }
  }

  window.imageProvider = {
    getAiImage,
    populateThumbnails,
    populateInline,
    applyToThumb,
    applyToInlineImage,
  };

  // Auto-run on content pages
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', () => {
      populateInline();
    });
  }else{
    populateInline();
  }
})();