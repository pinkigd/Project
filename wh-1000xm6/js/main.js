/* ============================================================
   WH-1000XM6 — scroll orchestration.
   Maps page scroll -> story progress, drives the canvas
   renderer, beat overlays, nav state, and smooth scrolling.
   ============================================================ */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var canvas = document.getElementById('sequence');
  var ctx = canvas.getContext('2d');
  var scrolly = document.getElementById('scrolly');
  var nav = document.getElementById('nav');
  var hint = document.getElementById('hint');
  var progressBar = document.getElementById('progress-bar');

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function smooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function win(p, a, b, r) {
    r = r || 0.05;
    var rise = a <= 0 ? 1 : smooth((p - a) / r);
    var fall = b >= 1 ? 1 : 1 - smooth((p - b) / r);
    return rise * fall;
  }

  /* ---------- story beats: progress window + entry direction ---------- */
  var BEATS = [
    { el: document.getElementById('beat-hero'), a: 0, b: 0.12, dx: 0, dy: 28 },
    { el: document.getElementById('beat-eng'), a: 0.18, b: 0.39, dx: -44, dy: 0 },
    { el: document.getElementById('beat-nc'), a: 0.43, b: 0.65, dx: 44, dy: 0 },
    { el: document.getElementById('beat-sound'), a: 0.68, b: 0.85, dx: -44, dy: 0 },
    { el: document.getElementById('beat-cta'), a: 0.90, b: 1, dx: 0, dy: 28 }
  ];

  /* ---------- smooth scrolling (Lenis) ---------- */
  var lenis = null;
  if (!reduceMotion && window.Lenis) {
    lenis = new Lenis({ duration: 1.15, smoothWheel: true });
  }

  // anchor navigation that respects the smooth scroller
  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener('click', function (ev) {
      var target = document.querySelector(link.getAttribute('href'));
      if (!target) return;
      ev.preventDefault();
      var top = target.getBoundingClientRect().top + window.scrollY;
      if (lenis) lenis.scrollTo(top, { duration: 1.4 });
      else window.scrollTo({ top: top, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  });

  /* ---------- canvas sizing ---------- */
  var dpr = 1, cw = 0, ch = 0;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cw = canvas.clientWidth;
    ch = canvas.clientHeight;
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
  }
  window.addEventListener('resize', resize);
  resize();

  /* ---------- progress ---------- */
  function storyProgress() {
    var rect = scrolly.getBoundingClientRect();
    var total = rect.height - window.innerHeight;
    return total > 0 ? clamp(-rect.top / total, 0, 1) : 0;
  }

  var sp = 0;            // smoothed story progress
  var first = true;

  function updateBeats(p) {
    for (var i = 0; i < BEATS.length; i++) {
      var beat = BEATS[i];
      var o = win(p, beat.a, beat.b);
      var el = beat.el;
      el.style.opacity = o.toFixed(3);
      el.style.transform = 'translate(' +
        (beat.dx * (1 - o)).toFixed(1) + 'px,' +
        (beat.dy * (1 - o)).toFixed(1) + 'px)';
      el.style.visibility = o > 0.01 ? 'visible' : 'hidden';
      el.style.pointerEvents = o > 0.6 ? 'auto' : 'none';
    }
  }

  function updateChrome(p) {
    nav.classList.toggle('nav--scrolled', window.scrollY > 24);
    hint.style.opacity = win(p, 0, 0.05, 0.03).toFixed(3);
    var doc = document.documentElement;
    var page = clamp(window.scrollY / (doc.scrollHeight - window.innerHeight), 0, 1);
    progressBar.style.transform = 'scaleX(' + page.toFixed(4) + ')';
  }

  /* ---------- main loop ---------- */
  function frame(time) {
    if (lenis) lenis.raf(time);

    var p = storyProgress();
    // critically-damped-ish lerp keeps frame mapping buttery, never jumpy
    sp = (reduceMotion || first) ? p : sp + (p - sp) * 0.14;
    first = false;
    if (Math.abs(p - sp) < 0.0005) sp = p;

    ctx.save();
    ctx.scale(dpr, dpr);
    window.XM6Renderer.render(ctx, cw, ch, sp, reduceMotion ? 0 : time);
    ctx.restore();

    updateBeats(sp);
    updateChrome(p);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /* ---------- reveal-on-scroll for the sections below the story ---------- */
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.18 });

  document.querySelectorAll('.card, .specs__inner > .eyebrow, .specs__inner > .headline, .buy > *')
    .forEach(function (el) {
      el.classList.add('will-reveal');
      observer.observe(el);
    });
})();
