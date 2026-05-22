const MANIFEST_SHEETS = Array.isArray(window.BOOK_SHEETS) ? window.BOOK_SHEETS : [];

const thumbs        = document.getElementById('galleryThumbs');
const carouselModal = document.getElementById('carouselModal');
const carouselView  = document.getElementById('carouselView');
const prevBtn       = document.getElementById('prev');
const nextBtn       = document.getElementById('next');
const closeCarousel = document.getElementById('closeCarousel');

let sheets  = MANIFEST_SHEETS;
let current = 0;

// ── Gesture state ─────────────────────────────────────────────────────────────
let zoom     = { scale: 1, x: 0, y: 0 };
let ptrs     = new Map();   // pointerId → {x, y}
let gMode    = 'idle';      // 'idle' | 'swipe' | 'pan' | 'pinch'
let swipeO   = null;        // {x, y} — swipe start
let panO     = null;        // {x, y, ox, oy} — pan start + initial offset
let pinchO   = null;        // pinch start state
let navTimer = null;        // pending navigate() after exit animation

function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

function getImg() { return carouselView.querySelector('img'); }

function applyTransform() {
  const img = getImg();
  if (img) img.style.transform = `translate(${zoom.x}px,${zoom.y}px) scale(${zoom.scale})`;
}

function setArrows(show) {
  prevBtn.classList.toggle('hidden', !show);
  nextBtn.classList.toggle('hidden', !show);
}

function cancelNav() {
  clearTimeout(navTimer);
  navTimer = null;
}

function resetGesture() {
  cancelNav();
  zoom   = { scale: 1, x: 0, y: 0 };
  ptrs   = new Map();
  gMode  = 'idle';
  swipeO = panO = pinchO = null;
}

function navigate(dir) {
  current = (current + dir + sheets.length) % sheets.length;
  loadCurrent();
}

function loadCurrent() {
  resetGesture();
  setArrows(true);
  carouselView.classList.remove('grabbing');

  const img      = document.createElement('img');
  const sheet    = sheets[current];
  img.src        = sheet.full;
  img.alt        = sheet.name || `Planche ${current + 1}`;
  img.loading    = 'eager';
  img.decoding   = 'async';
  img.draggable  = false;
  carouselView.replaceChildren(img);
}

// ── Gesture handlers ──────────────────────────────────────────────────────────

carouselView.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  carouselView.setPointerCapture(e.pointerId);
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  setArrows(false);
  carouselView.classList.add('grabbing');

  if (ptrs.size === 1) {
    swipeO = { x: e.clientX, y: e.clientY };
    panO   = { x: e.clientX, y: e.clientY, ox: zoom.x, oy: zoom.y };
    gMode  = zoom.scale > 1.02 ? 'pan' : 'swipe';
    pinchO = null;
  }

  if (ptrs.size === 2) {
    gMode  = 'pinch';
    swipeO = null;
    const [a, b] = [...ptrs.values()];
    pinchO = {
      dist:  Math.hypot(b.x - a.x, b.y - a.y) || 1,
      scale: zoom.scale,
      x: zoom.x, y: zoom.y,
      midX: (a.x + b.x) / 2,
      midY: (a.y + b.y) / 2,
    };
  }
});

carouselView.addEventListener('pointermove', (e) => {
  if (!ptrs.has(e.pointerId)) return;
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if (gMode === 'pinch' && pinchO && ptrs.size >= 2) {
    const [a, b] = [...ptrs.values()];
    const dist   = Math.hypot(b.x - a.x, b.y - a.y);
    const midX   = (a.x + b.x) / 2;
    const midY   = (a.y + b.y) / 2;
    zoom.scale   = clamp(pinchO.scale * (dist / pinchO.dist), 1, 8);
    zoom.x       = pinchO.x + (midX - pinchO.midX);
    zoom.y       = pinchO.y + (midY - pinchO.midY);
    if (zoom.scale <= 1) { zoom.x = 0; zoom.y = 0; }
    applyTransform();
    return;
  }

  if (gMode === 'pan' && panO) {
    zoom.x = panO.ox + (e.clientX - panO.x);
    zoom.y = panO.oy + (e.clientY - panO.y);
    applyTransform();
    return;
  }

  // Swipe: image follows finger in real time
  if (gMode === 'swipe' && swipeO && ptrs.size === 1) {
    const dx  = e.clientX - swipeO.x;
    const img = getImg();
    if (img) img.style.transform = `translate(${dx}px,0) scale(1)`;
  }
});

carouselView.addEventListener('pointerup', (e) => {
  const savedMode  = gMode;
  const savedSwipe = swipeO;
  ptrs.delete(e.pointerId);
  try { carouselView.releasePointerCapture(e.pointerId); } catch (_) {}

  if (ptrs.size === 0) {
    carouselView.classList.remove('grabbing');

    if (savedMode === 'swipe' && savedSwipe) {
      const dx    = e.clientX - savedSwipe.x;
      const dy    = e.clientY - savedSwipe.y;
      const viewW = carouselView.offsetWidth;
      const img   = getImg();

      // Navigate if horizontal dominates and distance > 28% of screen
      if (Math.abs(dx) > viewW * 0.28 && Math.abs(dx) > Math.abs(dy) * 1.2 && img) {
        const exitX = dx < 0 ? -viewW : viewW;
        img.style.transition = 'transform 0.18s ease-out';
        img.style.transform  = `translate(${exitX}px,0) scale(1)`;
        navTimer = setTimeout(() => {
          navTimer = null;
          navigate(dx < 0 ? 1 : -1);
        }, 185);
      } else if (img) {
        // Snap back to center
        img.style.transition = 'transform 0.25s ease-out';
        img.style.transform  = 'translate(0,0) scale(1)';
        img.addEventListener('transitionend', () => { img.style.transition = ''; }, { once: true });
        setArrows(true);
      }

      gMode = 'idle';
      swipeO = panO = null;
      return;
    }

    setArrows(zoom.scale <= 1);
    gMode  = 'idle';
    swipeO = panO = pinchO = null;

  } else if (ptrs.size === 1) {
    pinchO = null;
    const [pt] = ptrs.values();
    panO   = { x: pt.x, y: pt.y, ox: zoom.x, oy: zoom.y };
    swipeO = { x: pt.x, y: pt.y };
    gMode  = zoom.scale > 1.02 ? 'pan' : 'swipe';
  }
});

carouselView.addEventListener('pointercancel', (e) => {
  const img = getImg();
  ptrs.delete(e.pointerId);
  if (ptrs.size === 0) {
    // Snap back if mid-swipe
    if (gMode === 'swipe' && img) {
      img.style.transition = 'transform 0.25s ease-out';
      img.style.transform  = 'translate(0,0) scale(1)';
      img.addEventListener('transitionend', () => { img.style.transition = ''; }, { once: true });
    }
    carouselView.classList.remove('grabbing');
    setArrows(zoom.scale <= 1);
    gMode  = 'idle';
    swipeO = panO = pinchO = null;
  }
});

// Mouse wheel zoom (desktop)
carouselView.addEventListener('wheel', (e) => {
  e.preventDefault();
  zoom.scale = clamp(zoom.scale * (e.deltaY < 0 ? 1.12 : 0.9), 1, 8);
  if (zoom.scale <= 1) { zoom.x = 0; zoom.y = 0; }
  applyTransform();
  setArrows(zoom.scale <= 1);
}, { passive: false });

// ── Carousel ──────────────────────────────────────────────────────────────────

function renderThumbs() {
  thumbs.innerHTML = '';
  sheets.forEach((sheet, i) => {
    const btn = document.createElement('button');
    btn.className = 'thumb';

    const img    = document.createElement('img');
    img.src      = sheet.thumb;
    img.alt      = sheet.name || `Planche ${i + 1}`;
    img.loading  = 'lazy';
    img.decoding = 'async';
    img.addEventListener('click', () => openCarousel(i));

    btn.appendChild(img);
    thumbs.appendChild(btn);
  });
}

function openCarousel(index) {
  current = index;
  loadCurrent();
  carouselModal.classList.remove('hidden');
  carouselModal.setAttribute('aria-hidden', 'false');
}

function closeCarouselFn() {
  carouselModal.classList.add('hidden');
  carouselModal.setAttribute('aria-hidden', 'true');
}

prevBtn.addEventListener('click', () => navigate(-1));
nextBtn.addEventListener('click', () => navigate(1));
closeCarousel.addEventListener('click', closeCarouselFn);

document.addEventListener('keydown', (e) => {
  if (carouselModal.classList.contains('hidden')) return;
  if (e.key === 'Escape')     closeCarouselFn();
  if (e.key === 'ArrowRight') navigate(1);
  if (e.key === 'ArrowLeft')  navigate(-1);
});

// ── Init ──────────────────────────────────────────────────────────────────────

function init() {
  if (!sheets.length) {
    thumbs.innerHTML = '<p class="empty">Aucune planche trouvée dans <code>images/Siv</code>.</p>';
    return;
  }
  renderThumbs();
}

init();
