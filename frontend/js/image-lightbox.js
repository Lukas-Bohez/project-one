;(function () {
  'use strict'

  /* ── state ── */
  var overlay, imgEl, zoomLabel, curZoom = 1, panX = 0, panY = 0
  var isDragging = false, dragStartX, dragStartY, panStartX, panStartY
  var lastTouchDist = null, isFullscreen = false

  /* ── helpers ── */
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

  function applyTransform() {
    imgEl.style.transform =
      'scale(' + curZoom + ') translate(' +
      (panX / curZoom) + 'px,' + (panY / curZoom) + 'px)'
    zoomLabel.textContent = curZoom.toFixed(1) + '\u00d7'
  }

  function resetZoom() {
    curZoom = 1; panX = 0; panY = 0; applyTransform()
  }

  function zoomBy(delta, cx, cy) {
    var rect = imgEl.getBoundingClientRect()
    var newZoom = clamp(curZoom + delta, 1, 4)
    if (newZoom === curZoom) return
    /* keep point under cursor fixed */
    var ox = (cx - rect.left) - rect.width  / 2
    var oy = (cy - rect.top)  - rect.height / 2
    panX = (panX - ox) * (newZoom / curZoom) + ox
    panY = (panY - oy) * (newZoom / curZoom) + oy
    curZoom = newZoom
    if (curZoom === 1) { panX = 0; panY = 0 }
    applyTransform()
  }

  /* ── open / close ── */
  function open(src, alt) {
    resetZoom()
    imgEl.src = src
    imgEl.alt = alt || ''
    overlay.style.display = 'flex'
    document.body.style.overflow = 'hidden'
    /* preload */
    imgEl.onload = function() { applyTransform() }
  }

  function close() {
    overlay.style.display = 'none'
    document.body.style.overflow = ''
    imgEl.src = ''
    if (document.fullscreenElement) document.exitFullscreen()
  }

  /* ── keyboard ── */
  function onKey(e) {
    if (overlay.style.display === 'none') return
    if (e.key === 'Escape') {
      if (document.fullscreenElement) document.exitFullscreen()
      else close()
    }
    if (e.key === '+' || e.key === '=') zoomBy(0.25, window.innerWidth/2, window.innerHeight/2)
    if (e.key === '-') zoomBy(-0.25, window.innerWidth/2, window.innerHeight/2)
    if (e.key === '0') resetZoom()
  }

  /* ── wheel ── */
  function onWheel(e) {
    e.preventDefault()
    zoomBy(e.deltaY * -0.002, e.clientX, e.clientY)
  }

  /* ── drag / pan ── */
  function onMouseDown(e) {
    if (e.target !== imgEl) return
    isDragging = true
    dragStartX = e.clientX; dragStartY = e.clientY
    panStartX  = panX;      panStartY  = panY
    e.preventDefault()
  }
  function onMouseMove(e) {
    if (!isDragging || curZoom <= 1) return
    panX = panStartX + (e.clientX - dragStartX)
    panY = panStartY + (e.clientY - dragStartY)
    applyTransform()
  }
  function onMouseUp() { isDragging = false }

  /* ── touch ── */
  function touchDist(t) {
    var dx = t[0].clientX - t[1].clientX
    var dy = t[0].clientY - t[1].clientY
    return Math.sqrt(dx*dx + dy*dy)
  }
  function onTouchStart(e) {
    if (e.touches.length === 2) {
      lastTouchDist = touchDist(e.touches)
      e.preventDefault()
    } else if (e.touches.length === 1 && curZoom > 1) {
      isDragging = true
      dragStartX = e.touches[0].clientX; dragStartY = e.touches[0].clientY
      panStartX  = panX;                 panStartY  = panY
    }
  }
  function onTouchMove(e) {
    if (e.touches.length === 2 && lastTouchDist) {
      var d = touchDist(e.touches)
      var cx = (e.touches[0].clientX + e.touches[1].clientX) / 2
      var cy = (e.touches[0].clientY + e.touches[1].clientY) / 2
      zoomBy((d - lastTouchDist) * 0.01, cx, cy)
      lastTouchDist = d
      e.preventDefault()
    } else if (e.touches.length === 1 && isDragging && curZoom > 1) {
      panX = panStartX + (e.touches[0].clientX - dragStartX)
      panY = panStartY + (e.touches[0].clientY - dragStartY)
      applyTransform()
    }
  }
  function onTouchEnd(e) {
    if (e.touches.length < 2) lastTouchDist = null
    if (e.touches.length === 0) isDragging = false
  }

  /* ── double-click/tap ── */
  var lastTap = 0
  function onDblClick(e) {
    if (curZoom === 1) zoomBy(1, e.clientX, e.clientY)
    else resetZoom()
  }
  function onTouchTap(e) {
    var now = Date.now()
    if (now - lastTap < 300) {
      onDblClick({ clientX: e.changedTouches[0].clientX,
                   clientY: e.changedTouches[0].clientY })
    }
    lastTap = now
  }

  /* ── fullscreen ── */
  function toggleFullscreen(btn) {
    if (!document.fullscreenElement) {
      overlay.requestFullscreen().catch(function(){})
    } else {
      document.exitFullscreen()
    }
  }
  document.addEventListener('fullscreenchange', function() {
    isFullscreen = !!document.fullscreenElement
    var btn = document.getElementById('ilb-fs')
    if (btn) btn.textContent = isFullscreen ? '\u26f6' : '\u26f6'
  })

  /* ── build overlay DOM ── */
  function buildOverlay() {
    overlay = document.createElement('div')
    overlay.id = 'ilb-overlay'
    overlay.style.cssText = [
      'display:none',
      'position:fixed',
      'inset:0',
      'z-index:99999',
      'background:rgba(0,0,0,0.92)',
      'align-items:center',
      'justify-content:center',
      'user-select:none'
    ].join(';')

    imgEl = document.createElement('img')
    imgEl.id = 'ilb-img'
    imgEl.style.cssText = [
      'max-width:90vw',
      'max-height:85vh',
      'object-fit:contain',
      'cursor:grab',
      'border-radius:4px',
      'transition:transform 0.05s',
      'will-change:transform'
    ].join(';')
    imgEl.addEventListener('dblclick', onDblClick)

    /* controls bar */
    var bar = document.createElement('div')
    bar.style.cssText = [
      'position:fixed',
      'bottom:24px',
      'left:50%',
      'transform:translateX(-50%)',
      'display:flex',
      'align-items:center',
      'gap:8px',
      'background:rgba(0,0,0,0.85)',
      'border-radius:12px',
      'padding:8px 16px',
      'backdrop-filter:blur(8px)',
      'z-index:100000'
    ].join(';')

    function makeBtn(id, label, title, handler) {
      var b = document.createElement('button')
      b.id = id
      b.textContent = label
      b.title = title
      b.style.cssText = [
        'background:rgba(255,255,255,0.15)',
        'border:none',
        'color:#fff',
        'padding:6px 12px',
        'border-radius:8px',
        'cursor:pointer',
        'font-size:14px',
        'font-weight:600',
        'transition:background 0.15s'
      ].join(';')
      b.addEventListener('mouseenter', function(){ this.style.background='rgba(255,255,255,0.3)' })
      b.addEventListener('mouseleave', function(){ this.style.background='rgba(255,255,255,0.15)' })
      b.addEventListener('click', function(e){ e.stopPropagation(); handler(e) })
      return b
    }

    zoomLabel = document.createElement('span')
    zoomLabel.style.cssText = 'color:#fff;font-size:13px;font-weight:700;min-width:38px;text-align:center'
    zoomLabel.textContent = '1.0\u00d7'

    bar.appendChild(makeBtn('ilb-zo', '− Out',  'Zoom out',   function(){ zoomBy(-0.5, window.innerWidth/2, window.innerHeight/2) }))
    bar.appendChild(zoomLabel)
    bar.appendChild(makeBtn('ilb-zi', '+ In',   'Zoom in',    function(){ zoomBy( 0.5, window.innerWidth/2, window.innerHeight/2) }))
    bar.appendChild(makeBtn('ilb-rs', '↺ Reset','Reset zoom',  function(){ resetZoom() }))
    bar.appendChild(makeBtn('ilb-fs', '⛶',      'Fullscreen', function(){ toggleFullscreen() }))
    bar.appendChild(makeBtn('ilb-cl', '✕ Close','Close',       function(){ close() }))

    /* backdrop click */
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) close()
    })

    /* zoom cursor */
    imgEl.addEventListener('mousedown', function(){ imgEl.style.cursor = 'grabbing' })
    overlay.addEventListener('mouseup',   function(){ imgEl.style.cursor = 'grab' })

    overlay.appendChild(imgEl)
    overlay.appendChild(bar)
    document.body.appendChild(overlay)

    /* global listeners */
    document.addEventListener('keydown', onKey)
    overlay.addEventListener('wheel',     onWheel,     { passive: false })
    overlay.addEventListener('mousedown', onMouseDown)
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup',   onMouseUp)
    overlay.addEventListener('touchstart', onTouchStart, { passive: false })
    overlay.addEventListener('touchmove',  onTouchMove,  { passive: false })
    overlay.addEventListener('touchend',   onTouchEnd)
    imgEl.addEventListener('touchend',     onTouchTap)
  }

  /* ── wire up images on page ── */
  function init() {
    buildOverlay()
    /* find all zoomable images */
    var imgs = document.querySelectorAll('[data-zoomable], .proof-screenshot img, .screenshot img, .gallery img, .project-screenshot, .c-proof-gallery__item img')
    imgs.forEach(function(img) {
      /* get the best available src */
      var src = img.getAttribute('data-full') ||
                img.getAttribute('data-src')  ||
                img.getAttribute('data-original') ||
                img.src
      if (!src || src === window.location.href) return
      img.style.cursor = 'zoom-in'
      img.title = img.title || 'Click to zoom'
      img.addEventListener('click', function(e) {
        e.stopPropagation()
        open(src, img.alt)
      })
    })
    /* also wire any existing proof-lightbox trigger buttons */
    var triggers = document.querySelectorAll('[data-lightbox-src], [data-screenshot-src], [data-proof-open]')
    triggers.forEach(function(el) {
      var src = el.getAttribute('data-lightbox-src') || 
                el.getAttribute('data-screenshot-src') ||
                el.getAttribute('data-proof-src')
      if (!src) {
        /* try to find sibling img */
        var img = el.parentElement.querySelector('img')
        if (img) src = img.src
      }
      if (!src) return
      el.style.cursor = 'zoom-in'
      el.addEventListener('click', function(e) {
        e.stopPropagation()
        open(src, el.getAttribute('alt') || el.getAttribute('title') || '')
      })
    })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()

