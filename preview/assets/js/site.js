/* Campbell Content Studio: progressive enhancement only.
   Every link and every piece of content works without this file. */
(function () {
  'use strict';
  var doc = document, root = doc.documentElement, win = window;
  root.classList.add('js');

  var reduce = win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  var saveData = !!(conn && conn.saveData === true);
  var hasIO = 'IntersectionObserver' in win;
  var hasDialog = typeof win.HTMLDialogElement === 'function';
  function $(s, c) { return (c || doc).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); }
  function byHash(h) { try { return h && h.length > 1 ? doc.getElementById(decodeURIComponent(h.slice(1))) : null; } catch (e) { return null; } }

  /* ---- scroll lock shared by the menu and the screening room ---- */
  function lock() { root.classList.add('locked'); }
  function unlock() { root.classList.remove('locked'); }

  /* ---------- 1. slow reveals + gate-opening frames (content is visible without JS) ---------- */
  var els = $$('.reveal,.gate');
  var io = null;
  function showAll(list) { list.forEach(function (el) { el.classList.add('in'); }); }
  if (reduce || !hasIO) {
    showAll(els);
  } else {
    /* a closed gate (clip-path) has no visible area, so gates are watched through their parent */
    var watch = new Map();
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { showAll(watch.get(e.target) || []); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    els.forEach(function (el) {
      var t = el.classList.contains('gate') ? el.parentNode : el;
      if (!watch.has(t)) { watch.set(t, []); io.observe(t); }
      watch.get(t).push(el);
    });
    /* the hero never waits */
    showAll($$('.hero .reveal,.hero .gate'));
  }
  win.addEventListener('beforeprint', function () { showAll(els); });
  /* jumping to an anchor never lands on blank space: reveal everything above and around it */
  function revealUpTo(target) {
    if (!target || !io) return;
    var y = target.getBoundingClientRect().top + win.scrollY + win.innerHeight * 1.5;
    els.forEach(function (el) {
      if (!el.classList.contains('in') && el.getBoundingClientRect().top + win.scrollY < y) el.classList.add('in');
    });
  }
  doc.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (a) revealUpTo(byHash(a.getAttribute('href')));
  });
  win.addEventListener('hashchange', function () { revealUpTo(byHash(location.hash)); });
  if (location.hash) revealUpTo(byHash(location.hash));

  /* ---------- 2. hero reel: muted loop, cut list synced to video.currentTime ---------- */
  var hero = $('.hero'), video = $('.hero-frame video'), toggle = $('.reel-toggle');
  var roomOpen = false, syncReel = function () {};
  if (hero && video && toggle) (function () {
    var cuts = $$('.cut'), tracks = cuts.map(function (c) { return c.querySelector('.track i'); });
    var names = cuts.map(function (c) { return c.querySelector('.cut-t').textContent; });
    var tcEl = $('.tcb .tc'), nowEl = $('.tcb .now b'), lbl = toggle.querySelector('.lbl');
    /* contract timing (crossfade midpoints): neon [0,3.5) duel [3.5,7.5) candles [7.5,11.5) seven [11.5,15.5) neon [15.5,16) */
    var EDGES = [3.5, 7.5, 11.5, 15.5];
    var loaded = false, want = false, onScreen = true, raf = 0, active = -1, failed = false, lastK = '', lastTC = '';
    var vfc = typeof video.requestVideoFrameCallback === 'function';

    function pad(n) { return (n < 10 ? '0' : '') + n; }
    function shotAt(t) {
      if (t >= EDGES[3]) return [0, (t - EDGES[3]) / 4];
      if (t < EDGES[0]) return [0, (t + 16 - EDGES[3]) / 4];
      for (var i = 1; i < 4; i++) if (t < EDGES[i]) return [i, (t - EDGES[i - 1]) / 4];
      return [0, 0];
    }
    function setActive(i) {
      if (i === active) return;
      active = i;
      cuts.forEach(function (c, k) {
        c.classList.toggle('is-on', k === i);
        if (k !== i) tracks[k].style.transform = 'scaleX(0)';
      });
      if (nowEl) nowEl.textContent = names[i];
    }
    /* writes only what changed: the TC moves at 24 fps, the bar in 0.25% steps */
    function render() {
      var t = video.currentTime || 0, s = shotAt(t), k = Math.max(0, Math.min(1, s[1])).toFixed(3), sec = Math.floor(t), tc;
      if (s[0] !== active) { setActive(s[0]); lastK = ''; }
      if (k !== lastK) { lastK = k; tracks[s[0]].style.transform = 'scaleX(' + k + ')'; }
      tc = 'TC 00:00:' + pad(sec) + ':' + pad(Math.min(23, Math.floor((t - sec) * 24)));
      if (tcEl && tc !== lastTC) { lastTC = tc; tcEl.textContent = tc; }
    }
    /* one update per decoded frame (24/s) where supported, not one per screen refresh */
    function next() { raf = vfc ? video.requestVideoFrameCallback(loop) : win.requestAnimationFrame(loop); }
    function loop() { render(); next(); }
    function startLoop() { if (!raf) next(); }
    function stopLoop() { if (raf) { if (vfc) video.cancelVideoFrameCallback(raf); else win.cancelAnimationFrame(raf); } raf = 0; }
    function setState(playing) {
      toggle.setAttribute('data-state', playing ? 'playing' : 'paused');
      lbl.textContent = playing ? 'Pause reel' : 'Play reel';
      hero.classList.toggle('paused', !playing);
    }
    function load() {
      if (loaded) return;
      loaded = true;
      /* AV1 files are pre-cropped to the frame they fill (4:3 on phones, 2.39:1 from 900px) */
      [
        ['assets/video/reel-720-av1.webm', 'video/webm; codecs="av01.0.05M.08"', '(max-width: 899px)'],
        ['assets/video/reel-720.webm', 'video/webm; codecs=vp9', '(max-width: 899px)'],
        ['assets/video/reel-720.mp4', 'video/mp4', '(max-width: 899px)'],
        ['assets/video/reel-1080-av1.webm', 'video/webm; codecs="av01.0.08M.08"'],
        ['assets/video/reel-1080.webm', 'video/webm; codecs=vp9'],
        ['assets/video/reel-1080.mp4', 'video/mp4']
      ].forEach(function (s, i, all) {
        var el = doc.createElement('source');
        el.src = s[0]; el.type = s[1];
        if (s[2]) el.media = s[2];
        if (i === all.length - 1) el.addEventListener('error', fail);
        video.appendChild(el);
      });
      video.load();
    }
    function fail() { failed = true; want = false; stopLoop(); setState(false); toggle.hidden = true; }
    function tryPlay() {
      if (failed) return;
      load();
      var p = video.play();
      if (p && p.catch) p.catch(function () { if (video.paused) { want = false; setState(false); } });
    }
    syncReel = function () {
      if (want && onScreen && !doc.hidden && !roomOpen) { if (video.paused) tryPlay(); }
      else if (!video.paused) video.pause();
    };

    video.addEventListener('playing', function () { setState(true); startLoop(); });
    video.addEventListener('pause', function () { setState(false); stopLoop(); render(); });
    video.addEventListener('seeked', function () { if (video.paused) render(); });
    toggle.addEventListener('click', function () {
      if (video.paused) { want = true; onScreen = true; tryPlay(); }
      else { want = false; video.pause(); }
    });
    if (hasIO) {
      new IntersectionObserver(function (en) { onScreen = en[0].isIntersecting; syncReel(); }, { threshold: 0 })
        .observe(video.parentNode);
    }
    doc.addEventListener('visibilitychange', syncReel);

    /* score cue: a separate audio file, off by default and only ever started by a click.
       The button stays hidden until data-src names the file (assets/audio/_README.txt). */
    var snd = $('.sound-toggle'), scoreSrc = snd && snd.getAttribute('data-src');
    if (snd && scoreSrc) (function () {
      var score = null, on = false, fadeRaf = 0, sndLbl = snd.querySelector('.lbl');
      function setSound(v) {
        on = v;
        snd.setAttribute('data-state', v ? 'on' : 'off');
        sndLbl.textContent = v ? 'Sound off' : 'Sound on';
      }
      /* short volume ramps so the cue never clicks in or out (iOS ignores volume; it just starts and stops) */
      function fade(to, ms, done) {
        win.cancelAnimationFrame(fadeRaf);
        var from = score.volume, t0 = 0;
        function step(ts) {
          if (!t0) t0 = ts;
          var k = Math.min(1, (ts - t0) / ms);
          score.volume = from + (to - from) * k;
          if (k < 1) fadeRaf = win.requestAnimationFrame(step); else if (done) done();
        }
        fadeRaf = win.requestAnimationFrame(step);
      }
      function stop() {
        setSound(false);
        if (score && !score.paused) fade(0, 300, function () { score.pause(); });
      }
      function start() {
        if (!score) {
          score = new Audio(scoreSrc);
          score.preload = 'auto';
          score.addEventListener('ended', function () { setSound(false); });
          score.addEventListener('error', function () { setSound(false); snd.hidden = true; });
        }
        setSound(true);
        /* picture and music start together from the top of the reel */
        video.currentTime = 0;
        want = true; onScreen = true;
        tryPlay();
        score.currentTime = 0;
        score.volume = 0;
        var p = score.play();
        if (p && p.catch) p.catch(function () { setSound(false); });
        fade(0.9, 400);
      }
      snd.addEventListener('click', function () { if (on) stop(); else start(); });
      /* the cue follows the picture: it pauses with the reel (button, off screen, hidden tab, film playing) and resumes with it */
      video.addEventListener('pause', function () { if (on && score && !score.paused) score.pause(); });
      video.addEventListener('playing', function () {
        if (on && score && score.paused && !score.ended) { var p = score.play(); if (p && p.catch) p.catch(function () { setSound(false); }); }
      });
      snd.hidden = false;
    })();

    toggle.hidden = false;
    setState(false);
    render();
    if (reduce || saveData) {
      /* poster frame only: shot 1, its track full; the visitor can start the reel */
      tracks[0].style.transform = 'scaleX(1)';
    } else {
      var start = function () { want = true; syncReel(); };
      if (doc.readyState === 'complete') start(); else win.addEventListener('load', start);
    }
  })();

  /* ---------- 3. burned-in subtitle: one slow pass while on screen, then rests on EN.
     Each row is a button that shows its language and stops the cycle; hover or focus pauses it. ---------- */
  var subs = $$('.subbox span'), rows = $$('.subs li'), burn = $('.burn');
  if (burn && subs.length && subs.length === rows.length) (function () {
    var si = 0, timer = 0, done = false, media = burn.parentNode;
    var btns = rows.map(function (li, k) {
      var b = doc.createElement('button');
      b.type = 'button'; b.className = 'sub-pick';
      b.setAttribute('aria-pressed', String(k === 0));
      while (li.firstChild) b.appendChild(li.firstChild);
      li.appendChild(b);
      b.addEventListener('click', function () { stop(); show(k); });
      return b;
    });
    function show(k) {
      subs[si].classList.remove('on'); rows[si].classList.remove('on'); btns[si].setAttribute('aria-pressed', 'false');
      si = k;
      subs[si].classList.add('on'); rows[si].classList.add('on'); btns[si].setAttribute('aria-pressed', 'true');
    }
    function stop() { done = true; if (timer) win.clearInterval(timer); timer = 0; }
    function step() {
      if (doc.hidden || media.matches(':hover,:focus-within')) return;
      show((si + 1) % subs.length);
      if (si === 0) stop();
    }
    if (!reduce && hasIO) new IntersectionObserver(function (en) {
      if (en[0].isIntersecting && !timer && !done) timer = win.setInterval(step, 3600);
      else if (!en[0].isIntersecting && timer) { win.clearInterval(timer); timer = 0; }
    }).observe(burn);
  })();

  /* ---------- 4. screening room: the YouTube player loads only after a click ---------- */
  var room = null, roomFrame, roomTitle, roomLink, roomSr, opener = null;
  function buildRoom() {
    room = doc.createElement('dialog');
    room.className = 'room';
    room.setAttribute('aria-labelledby', 'room-title');
    room.innerHTML =
      '<div class="room-inner">' +
        '<div class="room-bar"><p class="room-title billing" id="room-title">Now playing · <b></b></p>' +
        '<button class="room-close billing" type="button">Close <span aria-hidden="true">✕</span></button></div>' +
        '<div class="room-frame"></div>' +
        '<p class="room-foot"><span>Playing through YouTube’s privacy-enhanced player.<span class="kbd"> Press Esc or Close to return to the site.</span></span>' +
        '<a class="room-yt" href="https://www.youtube.com/">Watch on YouTube<span class="sr"></span> <span aria-hidden="true">↗</span></a></p>' +
      '</div>';
    doc.body.appendChild(room);
    roomFrame = $('.room-frame', room);
    roomTitle = $('.room-title b', room);
    roomLink = $('.room-yt', room);
    roomSr = $('.sr', roomLink);
    $('.room-close', room).addEventListener('click', function () { room.close(); });
    room.addEventListener('click', function (e) { if (e.target === room) room.close(); });
    room.addEventListener('close', function () {
      while (roomFrame.firstChild) roomFrame.removeChild(roomFrame.firstChild);
      roomOpen = false;
      unlock();
      if (opener && opener.isConnected) opener.focus({ preventScroll: true });
      opener = null;
      syncReel();
    });
  }
  function openRoom(a) {
    var id = a.getAttribute('data-yt'), title = a.getAttribute('data-title') || 'Video';
    if (!/^[\w-]{11}$/.test(id)) return false;
    if (!room) buildRoom();
    opener = a;
    roomTitle.textContent = title;
    roomLink.href = 'https://www.youtube.com/watch?v=' + id;
    roomSr.textContent = ': ' + title;
    roomOpen = true;
    syncReel();
    room.showModal();
    lock();
    var f = doc.createElement('iframe');
    f.src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0&playsinline=1';
    f.title = title;
    f.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
    f.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    f.setAttribute('allowfullscreen', '');
    roomFrame.appendChild(f);
    $('.room-close', room).focus();
    return true;
  }
  if (hasDialog) {
    doc.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[data-yt]');
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (openRoom(a)) e.preventDefault();
    });
  }

  /* ---------- 5. phone menu: full-screen modal dialog ---------- */
  var menu = $('#menu'), mLink = $('[data-menu-toggle]');
  if (menu && mLink && hasDialog) (function () {
    var btn = doc.createElement('button'), jumping = false;
    btn.type = 'button';
    btn.className = mLink.className;
    btn.textContent = 'Menu';
    btn.setAttribute('aria-haspopup', 'dialog');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', 'menu');
    mLink.parentNode.replaceChild(btn, mLink);

    function focusables() { return $$('a[href],button', menu); }
    btn.addEventListener('click', function () {
      menu.showModal();
      btn.setAttribute('aria-expanded', 'true');
      lock();
      focusables()[0].focus();
    });
    $('.menu-close', menu).addEventListener('click', function () { menu.close(); });
    menu.addEventListener('close', function () {
      btn.setAttribute('aria-expanded', 'false');
      unlock();
      if (!jumping) (btn.offsetParent ? btn : $('.nav-links a') || $('.wordmark')).focus({ preventScroll: true });
      jumping = false;
    });
    menu.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      var f = focusables(), first = f[0], last = f[f.length - 1];
      if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    menu.addEventListener('click', function (e) {
      var a = e.target.closest('a');
      if (!a) return;
      var href = a.getAttribute('href') || '', target = href.charAt(0) === '#' ? byHash(href) : null;
      jumping = true;
      menu.close();
      if (target) {
        e.preventDefault();
        revealUpTo(target);
        if (history.pushState) history.pushState(null, '', href);
        target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
        if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
      }
    });
    if (win.matchMedia) {
      var wide = win.matchMedia('(min-width: 900px)');
      var onWide = function () { if (wide.matches && menu.open) menu.close(); };
      if (wide.addEventListener) wide.addEventListener('change', onWide);
    }
  })();
})();
