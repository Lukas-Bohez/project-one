/**
 * Image Lightbox - Pure vanilla JS image zoom and fullscreen viewer
 * No dependencies, works in all modern browsers
 */

(function () {
  'use strict';

  const DEFAULT_ZOOM_MIN = 1;
  const DEFAULT_ZOOM_MAX = 4;
  const DEFAULT_ZOOM_STEP = 0.5;

  class ImageLightbox {
    constructor(imageElement) {
      this.img = imageElement;
      this.isOpen = false;
      this.zoom = 1;
      this.panX = 0;
      this.panY = 0;
      this.isDragging = false;
      this.isFullscreen = false;
      this.lastTouchDist = 0;
      this.dragStart = { x: 0, y: 0, panX: 0, panY: 0 };

      this.init();
    }

    init() {
      // Add cursor style to indicate zoomability
      this.img.style.cursor = 'zoom-in';
      this.img.addEventListener('click', (e) => {
        e.preventDefault();
        this.open();
      });
    }

    open() {
      this.isOpen = true;
      this.zoom = 1;
      this.panX = 0;
      this.panY = 0;

      const backdrop = document.createElement('div');
      backdrop.className = 'image-lightbox-backdrop';
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          this.close();
        }
      });

      const container = document.createElement('div');
      container.className = 'image-lightbox-container';

      // Main image display
      const imgWrapper = document.createElement('div');
      imgWrapper.className = 'image-lightbox-img-wrapper';
      imgWrapper.addEventListener('wheel', (e) => this.handleWheel(e));
      imgWrapper.addEventListener('mousedown', (e) => this.handleMouseDown(e));
      imgWrapper.addEventListener('mousemove', (e) => this.handleMouseMove(e));
      imgWrapper.addEventListener('mouseup', () => this.handleMouseUp());
      imgWrapper.addEventListener('mouseleave', () => this.handleMouseUp());
      imgWrapper.addEventListener('touchstart', (e) => this.handleTouchStart(e));
      imgWrapper.addEventListener('touchmove', (e) => this.handleTouchMove(e));
      imgWrapper.addEventListener('touchend', () => this.handleTouchEnd());
      imgWrapper.addEventListener('dblclick', () => this.toggleZoom());

      const displayImg = document.createElement('img');
      displayImg.src = this.img.src;
      displayImg.alt = this.img.alt;
      displayImg.className = 'image-lightbox-img';
      displayImg.style.userSelect = 'none';
      displayImg.style.WebkitUserSelect = 'none';
      imgWrapper.appendChild(displayImg);

      // Controls bar
      const controls = document.createElement('div');
      controls.className = 'image-lightbox-controls';

      const zoomOutBtn = document.createElement('button');
      zoomOutBtn.textContent = '− Out';
      zoomOutBtn.className = 'image-lightbox-btn';
      zoomOutBtn.addEventListener('click', () => this.zoomOut());
      controls.appendChild(zoomOutBtn);

      const zoomLevel = document.createElement('div');
      zoomLevel.className = 'image-lightbox-zoom-level';
      zoomLevel.textContent = '1.0×';
      this.zoomLevelEl = zoomLevel;
      controls.appendChild(zoomLevel);

      const zoomInBtn = document.createElement('button');
      zoomInBtn.textContent = '+ In';
      zoomInBtn.className = 'image-lightbox-btn';
      zoomInBtn.addEventListener('click', () => this.zoomIn());
      controls.appendChild(zoomInBtn);

      const resetBtn = document.createElement('button');
      resetBtn.textContent = '↺ Reset';
      resetBtn.className = 'image-lightbox-btn';
      resetBtn.addEventListener('click', () => this.resetZoom());
      controls.appendChild(resetBtn);

      const fullscreenBtn = document.createElement('button');
      fullscreenBtn.textContent = '⛶ Full';
      fullscreenBtn.className = 'image-lightbox-btn';
      fullscreenBtn.addEventListener('click', () => this.toggleFullscreen(backdrop));
      this.fullscreenBtn = fullscreenBtn;
      controls.appendChild(fullscreenBtn);

      const closeBtn = document.createElement('button');
      closeBtn.textContent = '✕ Close';
      closeBtn.className = 'image-lightbox-btn image-lightbox-btn-close';
      closeBtn.addEventListener('click', () => this.close());
      controls.appendChild(closeBtn);

      container.appendChild(imgWrapper);
      container.appendChild(controls);
      backdrop.appendChild(container);

      this.displayImg = displayImg;
      this.backdrop = backdrop;
      this.imgWrapper = imgWrapper;

      document.body.appendChild(backdrop);
      document.body.style.overflow = 'hidden';

      // Keyboard listeners
      this.keyHandler = (e) => this.handleKeyDown(e);
      document.addEventListener('keydown', this.keyHandler);

      // Fullscreen change listener
      this.fullscreenHandler = () => this.updateFullscreenState();
      document.addEventListener('fullscreenchange', this.fullscreenHandler);
    }

    close() {
      if (this.isFullscreen && document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        this.destroy();
      }
    }

    destroy() {
      if (this.backdrop) {
        this.backdrop.remove();
      }
      document.body.style.overflow = '';
      document.removeEventListener('keydown', this.keyHandler);
      document.removeEventListener('fullscreenchange', this.fullscreenHandler);
      this.isOpen = false;
      this.isFullscreen = false;
    }

    updateFullscreenState() {
      const inFullscreen = !!document.fullscreenElement;
      if (inFullscreen !== this.isFullscreen) {
        this.isFullscreen = inFullscreen;
        if (this.fullscreenBtn) {
          this.fullscreenBtn.textContent = inFullscreen ? '⤢ Exit' : '⛶ Full';
        }
      }
      if (!inFullscreen && this.backdrop && !this.backdrop.parentElement) {
        this.destroy();
      }
    }

    toggleFullscreen(element) {
      if (!this.isFullscreen && element) {
        element.requestFullscreen().catch(() => {
          console.error('Fullscreen request failed');
        });
      } else if (document.fullscreenElement) {
        document.exitFullscreen();
      }
    }

    clampPan(x, y) {
      if (this.zoom <= 1) return { x: 0, y: 0 };

      const rect = this.displayImg.getBoundingClientRect();
      const maxPanX = (rect.width * (this.zoom - 1)) / 2;
      const maxPanY = (rect.height * (this.zoom - 1)) / 2;

      return {
        x: Math.max(-maxPanX, Math.min(maxPanX, x)),
        y: Math.max(-maxPanY, Math.min(maxPanY, y)),
      };
    }

    handleWheel(e) {
      e.preventDefault();
      const newZoom = Math.max(
        DEFAULT_ZOOM_MIN,
        Math.min(DEFAULT_ZOOM_MAX, this.zoom - e.deltaY * 0.001)
      );
      this.setZoom(newZoom);
    }

    handleMouseDown(e) {
      if (this.zoom <= 1) return;
      this.isDragging = true;
      this.dragStart = {
        x: e.clientX,
        y: e.clientY,
        panX: this.panX,
        panY: this.panY,
      };
    }

    handleMouseMove(e) {
      if (!this.isDragging || this.zoom <= 1) return;

      const deltaX = e.clientX - this.dragStart.x;
      const deltaY = e.clientY - this.dragStart.y;

      const newX = this.dragStart.panX + deltaX;
      const newY = this.dragStart.panY + deltaY;

      const clamped = this.clampPan(newX, newY);
      this.panX = clamped.x;
      this.panY = clamped.y;

      this.updateDisplay();
    }

    handleMouseUp() {
      this.isDragging = false;
    }

    handleTouchStart(e) {
      if (e.touches.length === 2) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        this.lastTouchDist = dist;
      } else if (e.touches.length === 1) {
        this.isDragging = true;
        this.dragStart = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
          panX: this.panX,
          panY: this.panY,
        };
      }
    }

    handleTouchMove(e) {
      if (e.touches.length === 2 && this.lastTouchDist > 0) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const zoomFactor = dist / this.lastTouchDist;
        this.setZoom(this.zoom * zoomFactor);
        this.lastTouchDist = dist;
      } else if (e.touches.length === 1 && this.isDragging && this.zoom > 1) {
        const deltaX = e.touches[0].clientX - this.dragStart.x;
        const deltaY = e.touches[0].clientY - this.dragStart.y;

        const newX = this.dragStart.panX + deltaX;
        const newY = this.dragStart.panY + deltaY;

        const clamped = this.clampPan(newX, newY);
        this.panX = clamped.x;
        this.panY = clamped.y;

        this.updateDisplay();
      }
    }

    handleTouchEnd() {
      this.isDragging = false;
      this.lastTouchDist = 0;
    }

    toggleZoom() {
      if (this.zoom > 1) {
        this.resetZoom();
      } else {
        this.setZoom(2);
      }
    }

    setZoom(newZoom) {
      this.zoom = Math.max(DEFAULT_ZOOM_MIN, Math.min(DEFAULT_ZOOM_MAX, newZoom));
      if (this.zoom === 1) {
        this.panX = 0;
        this.panY = 0;
      }
      this.updateDisplay();
    }

    zoomIn() {
      this.setZoom(this.zoom + DEFAULT_ZOOM_STEP);
    }

    zoomOut() {
      this.setZoom(this.zoom - DEFAULT_ZOOM_STEP);
    }

    resetZoom() {
      this.zoom = 1;
      this.panX = 0;
      this.panY = 0;
      this.updateDisplay();
    }

    updateDisplay() {
      if (this.displayImg) {
        this.displayImg.style.transform = `scale(${this.zoom}) translate(${this.panX}px, ${this.panY}px)`;
      }
      if (this.zoomLevelEl) {
        this.zoomLevelEl.textContent = `${this.zoom.toFixed(1)}×`;
      }
      if (this.imgWrapper) {
        this.imgWrapper.style.cursor = this.isDragging ? 'grabbing' : 'grab';
      }
    }

    handleKeyDown(e) {
      if (!this.isOpen) return;

      if (e.key === 'Escape') {
        this.close();
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        this.zoomIn();
      } else if (e.key === '-') {
        e.preventDefault();
        this.zoomOut();
      } else if (e.key === '0') {
        e.preventDefault();
        this.resetZoom();
      }
    }
  }

  // Initialize when DOM is ready
  function initLightboxes() {
    document.querySelectorAll('[data-zoomable]').forEach((img) => {
      new ImageLightbox(img);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLightboxes);
  } else {
    initLightboxes();
  }

  // Expose to window if needed
  window.ImageLightbox = ImageLightbox;
})();
