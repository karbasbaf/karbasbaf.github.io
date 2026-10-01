/* ==========================================================================
   site.js — shared behaviour for index.html and book-designs.html
   Navigation drawer · cover viewer (prev/next, keyboard, swipe, Front/Full
   Cover) · missing-image fallback · real-proportion cover frames.
   Do NOT load this on a page that still has its own inline nav script.
   ========================================================================== */
(function () {
  'use strict';

  var doc = document;
  var body = doc.body;

  function $(id) { return doc.getElementById(id); }
  function all(sel, root) {
    return Array.prototype.slice.call((root || doc).querySelectorAll(sel));
  }

  /* 1. Primary navigation ------------------------------------------------ */
  var navToggle = $('nav-toggle');
  var primaryNav = $('primary-nav');
  var desktopQuery = window.matchMedia('(min-width: 721px)');

  function isNavOpen() {
    return !!primaryNav && primaryNav.getAttribute('data-open') === 'true';
  }

  function openNav() {
    primaryNav.setAttribute('data-open', 'true');
    navToggle.setAttribute('aria-expanded', 'true');
    body.classList.add('nav-scrim-active');
    var firstLink = primaryNav.querySelector('a');
    if (firstLink) firstLink.focus();
  }

  function closeNav(returnFocus) {
    primaryNav.setAttribute('data-open', 'false');
    navToggle.setAttribute('aria-expanded', 'false');
    body.classList.remove('nav-scrim-active');
    if (returnFocus) navToggle.focus();
  }

  if (navToggle && primaryNav) {
    navToggle.addEventListener('click', function () {
      if (isNavOpen()) { closeNav(true); } else { openNav(); }
    });
    doc.addEventListener('click', function (e) {
      if (!isNavOpen()) return;
      if (!primaryNav.contains(e.target) && !navToggle.contains(e.target)) closeNav(false);
    });
    primaryNav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') closeNav(false);
    });
    desktopQuery.addEventListener('change', function (e) {
      if (e.matches && isNavOpen()) closeNav(false);
    });
  }

  /* 2. Cover viewer ------------------------------------------------------ */
  var reveal = $('book-reveal');
  var lastTrigger = null;
  var viewer = reveal ? initViewer() : null;

  function isRevealOpen() {
    return !!reveal && reveal.getAttribute('data-open') === 'true';
  }

  function visibleTriggers() {
    return all('.plate-trigger').filter(function (t) {
      return !t.hidden && !t.hasAttribute('inert') && !t.classList.contains('is-hidden');
    });
  }

  function initViewer() {
    var closeBtn = $('reveal-close');
    var image    = $('reveal-image');
    var frame    = $('reveal-frame');
    var titleEl  = $('reveal-title');
    var authorEl = $('reveal-author');
    var yearEl   = $('reveal-year');
    var mediumEl = $('reveal-medium');
    var noteEl   = $('reveal-note');
    var workEl   = $('reveal-work');
    var viewsEl  = $('reveal-views');
    var prevBtn  = $('reveal-prev');
    var nextBtn  = $('reveal-next');
    var countEl  = $('reveal-count');
    var liveEl   = $('reveal-live');
    var viewBtns = all('.view-trigger', viewsEl);

    var list = [];
    var index = -1;
    var current = {};
    var preferred = 'spread';

    function pad(n) { return n < 10 ? '0' + n : String(n); }

    /* Pre-fetch the large file so the viewer opens instantly — but never on
       a Data Saver connection. */
    function warm(t) {
      if (!t || t._warm) return;
      if (navigator.connection && navigator.connection.saveData) return;
      var src = t.getAttribute('data-spread') || t.getAttribute('data-image');
      if (src) { t._warm = true; new Image().src = src; }
    }

    function showView(view) {
      var useSpread = view === 'spread' && !!current.spread;
      var src = useSpread ? current.spread : current.front;
      var alt = useSpread ? current.spreadAlt : current.frontAlt;

      viewBtns.forEach(function (b) {
        b.setAttribute('aria-pressed',
          String(b.getAttribute('data-view') === (useSpread ? 'spread' : 'front')));
      });

      frame.setAttribute('data-loading', 'true');
      image.onload = function () {
        reveal.setAttribute('data-layout',
          image.naturalWidth / image.naturalHeight > 1.15 ? 'wide' : 'tall');
        frame.setAttribute('data-loading', 'false');
      };
      image.onerror = function () {
        image.onerror = null;
        if (useSpread && current.front) {
          current.spread = '';          /* full cover not uploaded: stop offering it */
          viewsEl.hidden = true;
          showView('front');
        } else {
          frame.setAttribute('data-loading', 'false');
        }
      };
      image.alt = alt;
      image.removeAttribute('src');
      image.src = src;
      if (image.complete && image.naturalWidth) image.onload();
    }

    function setText(el, value) {
      el.textContent = value;
      el.hidden = !value;
    }

    function loadItem(trigger) {
      lastTrigger = trigger;
      var frontAlt = trigger.getAttribute('data-alt') || '';
      var spread = trigger.getAttribute('data-spread') || '';
      current = {
        front: trigger.getAttribute('data-image'),
        spread: spread,
        frontAlt: frontAlt,
        spreadAlt: trigger.getAttribute('data-spread-alt') ||
          (spread ? 'Complete wrap-around cover: back panel, spine and front panel. ' + frontAlt : frontAlt)
      };

      viewsEl.hidden = !spread;
      showView(preferred);

      titleEl.textContent  = trigger.getAttribute('data-title')  || '';
      yearEl.textContent   = trigger.getAttribute('data-year')   || '';
      mediumEl.textContent = trigger.getAttribute('data-medium') || '';
      setText(authorEl, trigger.getAttribute('data-author') || '');
      setText(noteEl,   trigger.getAttribute('data-note')   || '');
      setText(workEl,   trigger.getAttribute('data-work')   || '');

      var multi = list.length > 1;
      prevBtn.hidden = !multi;
      nextBtn.hidden = !multi;
      countEl.hidden = !multi;
      countEl.textContent = pad(index + 1) + ' / ' + pad(list.length);

      reveal.scrollTop = 0;
      if (multi) {
        warm(list[(index + 1) % list.length]);
        warm(list[(index - 1 + list.length) % list.length]);
      }
    }

    function open(trigger) {
      list = visibleTriggers();
      index = list.indexOf(trigger);
      if (index < 0) { list = [trigger]; index = 0; }
      preferred = 'spread';
      loadItem(trigger);

      reveal.removeAttribute('inert');
      reveal.setAttribute('data-open', 'true');
      body.classList.add('scroll-locked');
      window.requestAnimationFrame(function () { closeBtn.focus(); });
    }

    function step(dir) {
      if (list.length < 2) return;
      index = (index + dir + list.length) % list.length;
      loadItem(list[index]);
      liveEl.textContent = titleEl.textContent + ', ' + (index + 1) + ' of ' + list.length;
    }

    function close() {
      reveal.setAttribute('data-open', 'false');
      body.classList.remove('scroll-locked');

      function finish() {
        if (isRevealOpen()) return;              /* re-opened during the fade */
        reveal.setAttribute('inert', '');
        if (lastTrigger && !lastTrigger.hidden) lastTrigger.focus();
      }

      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { finish(); }
      else { setTimeout(finish, 640); }
    }

    /* Delegated, so the JS-built grid on book-designs works too */
    doc.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('.plate-trigger') : null;
      if (t && !isRevealOpen()) open(t);
    });

    closeBtn.addEventListener('click', close);
    prevBtn.addEventListener('click', function () { step(-1); });
    nextBtn.addEventListener('click', function () { step(1); });

    viewBtns.forEach(function (b) {
      b.addEventListener('click', function () {
        preferred = b.getAttribute('data-view');
        showView(preferred);
      });
    });

    ['pointerover', 'focusin'].forEach(function (evt) {
      doc.addEventListener(evt, function (e) {
        var t = e.target.closest ? e.target.closest('.plate-trigger') : null;
        if (t) warm(t);
      });
    });

    /* Swipe between covers (ignored while the page is pinch-zoomed) */
    var sx = null, sy = 0;
    frame.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) { sx = null; return; }
      sx = e.touches[0].clientX;
      sy = e.touches[0].clientY;
    }, { passive: true });
    frame.addEventListener('touchend', function (e) {
      if (sx === null) return;
      var dx = e.changedTouches[0].clientX - sx;
      var dy = e.changedTouches[0].clientY - sy;
      sx = null;
      if (window.visualViewport && window.visualViewport.scale > 1.05) return;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
    }, { passive: true });

    return { open: open, close: close, step: step };
  }

  /* 3. Keyboard: Escape, arrows, focus trap ------------------------------ */
  function focusableInReveal() {
    return all('button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])', reveal)
      .filter(function (el) { return el.offsetParent !== null; });
  }

  doc.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (isRevealOpen()) { viewer.close(); return; }
      if (isNavOpen()) { closeNav(true); return; }
    }

    if (!isRevealOpen()) return;

    if (e.key === 'ArrowLeft')  { e.preventDefault(); viewer.step(-1); return; }
    if (e.key === 'ArrowRight') { e.preventDefault(); viewer.step(1);  return; }

    if (e.key === 'Tab') {
      var f = focusableInReveal();
      if (f.length === 0) return;
      if (f.length === 1) { e.preventDefault(); f[0].focus(); return; }
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  /* 4. Missing-image fallback ("frame--pending") ------------------------- */
  function markPending(img) {
    var frame = img.closest('.frame');
    if (!frame) return;
    frame.classList.add('frame--pending');
    if (!frame.querySelector('.frame-pending-label')) {
      var label = doc.createElement('span');
      label.className = 'frame-pending-label';
      label.textContent = img.alt || 'Artwork pending';
      frame.appendChild(label);
    }
  }

  function clearPending(img) {
    var frame = img.closest('.frame');
    if (!frame) return;
    frame.classList.remove('frame--pending');
    var label = frame.querySelector('.frame-pending-label');
    if (label) label.remove();
  }

  all('.frame img').forEach(function (img) {
    img.onerror = function () { markPending(img); };
    img.onload = function () { clearPending(img); };
    if (img.getAttribute('loading') !== 'lazy' && img.complete &&
        img.naturalWidth === 0 && img.getAttribute('src')) {
      markPending(img);
    }
  });

  /* 5. Cover frames follow each file's real proportions, never cropped --- */
  all('.cover-gallery .frame img, .portfolio-grid .frame img').forEach(function (img) {
    function lock() {
      var frame = img.closest('.frame');
      var w = img.naturalWidth || img.getAttribute('width');
      var h = img.naturalHeight || img.getAttribute('height');
      if (frame && w && h) frame.style.aspectRatio = w + ' / ' + h;
    }
    lock();
    img.addEventListener('load', lock);
  });
})();
