(function () {
  'use strict';

  var gallery = document.querySelector('.c-proof-gallery');
  if (!gallery) return;

  var dialog = document.createElement('div');
  dialog.className = 'proof-lightbox';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-hidden', 'true');
  dialog.innerHTML =
    '<div class="proof-lightbox__panel" role="document">' +
    '<div class="proof-lightbox__toolbar">' +
    '<h4 class="proof-lightbox__title">Screenshot preview</h4>' +
    '<button type="button" class="proof-lightbox__close" aria-label="Close preview">×</button>' +
    '</div>' +
    '<div class="proof-lightbox__media">' +
    '<button type="button" class="proof-lightbox__nav proof-lightbox__nav--prev" aria-label="Previous screenshot">‹</button>' +
    '<img alt="" decoding="async" />' +
    '<button type="button" class="proof-lightbox__nav proof-lightbox__nav--next" aria-label="Next screenshot">›</button>' +
    '</div>' +
    '<div class="proof-lightbox__caption"></div>' +
    '</div>';
  document.body.appendChild(dialog);

  var closeButton = dialog.querySelector('.proof-lightbox__close');
  var prevButton = dialog.querySelector('.proof-lightbox__nav--prev');
  var nextButton = dialog.querySelector('.proof-lightbox__nav--next');
  var previewImage = dialog.querySelector('img');
  var caption = dialog.querySelector('.proof-lightbox__caption');
  var items = Array.prototype.slice.call(gallery.querySelectorAll('.c-proof-gallery__item'));
  var lastActive = null;
  var currentIndex = -1;

  function openAt(index) {
    var item = items[index];
    if (!item) return;

    var image = item.querySelector('[data-proof-image]');
    var figcaption = item.querySelector('figcaption');
    var title = figcaption ? figcaption.querySelector('strong') : null;
    var captionText = figcaption ? figcaption.querySelector('span') : null;

    currentIndex = index;
    lastActive = document.activeElement;

    previewImage.src = image ? image.currentSrc || image.src : '';
    previewImage.alt = image ? image.alt || '' : '';
    caption.innerHTML =
      '<strong>' + (title ? title.textContent : 'Screenshot preview') + '</strong>' +
      '<div>' + (captionText ? captionText.textContent : '') + '</div>';

    dialog.classList.add('is-open');
    dialog.setAttribute('aria-hidden', 'false');
    closeButton.focus();
    document.documentElement.classList.add('proof-lightbox-open');
  }

  function close() {
    dialog.classList.remove('is-open');
    dialog.setAttribute('aria-hidden', 'true');
    document.documentElement.classList.remove('proof-lightbox-open');
    if (lastActive && typeof lastActive.focus === 'function') {
      lastActive.focus();
    }
  }

  function step(direction) {
    if (!items.length) return;
    var nextIndex = (currentIndex + direction + items.length) % items.length;
    openAt(nextIndex);
  }

  gallery.addEventListener('click', function (event) {
    var openButton = event.target.closest('[data-proof-open]');
    if (!openButton) return;
    var item = openButton.closest('.c-proof-gallery__item');
    var index = items.indexOf(item);
    if (index >= 0) openAt(index);
  });

  dialog.addEventListener('click', function (event) {
    if (event.target === dialog) close();
  });

  closeButton.addEventListener('click', close);
  prevButton.addEventListener('click', function () {
    step(-1);
  });
  nextButton.addEventListener('click', function () {
    step(1);
  });

  document.addEventListener('keydown', function (event) {
    if (!dialog.classList.contains('is-open')) return;
    if (event.key === 'Escape') {
      close();
      return;
    }
    if (event.key === 'ArrowRight') {
      step(1);
      return;
    }
    if (event.key === 'ArrowLeft') {
      step(-1);
    }
  });
})();
