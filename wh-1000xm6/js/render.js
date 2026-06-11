/* ============================================================
   WH-1000XM6 — scroll-driven exploded-view renderer.
   Draws the headphones in a 1600x1000 virtual space and
   choreographs disassembly/reassembly from a single scroll
   progress value (0..1). Hot path is allocation-free.
   ============================================================ */
(function () {
  'use strict';

  var VW = 1600, VH = 1000;          // virtual design space
  var CX = 800, CY = 560;            // product anchor inside it
  var CUP_X = 270, CUP_Y = 60;       // ear-cup centers relative to anchor

  var BLUE = '0,80,255';
  var CYAN = '0,214,255';

  /* ---------- easing ---------- */
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function smooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  // staggered ramp: 0 before t0, 1 after t1
  function stag(e, t0, t1) { return smooth((e - t0) / (t1 - t0)); }
  // trapezoid window over progress, with soft ramps of width r
  function win(p, a, b, r) {
    r = r || 0.06;
    var rise = a <= 0 ? 1 : smooth((p - a) / r);
    var fall = b >= 1 ? 1 : 1 - smooth((p - b) / r);
    return rise * fall;
  }

  /* ---------- shape helpers ---------- */
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function ellipse(ctx, x, y, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  }

  function matteEllipse(ctx, x, y, rx, ry, top, bottom, alpha) {
    var g = ctx.createLinearGradient(x - rx * 0.6, y - ry, x + rx * 0.6, y + ry);
    g.addColorStop(0, top);
    g.addColorStop(1, bottom);
    ellipse(ctx, x, y, rx, ry);
    ctx.fillStyle = g;
    ctx.globalAlpha = alpha;
    ctx.fill();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  /* ---------- the renderer ---------- */
  function render(ctx, w, h, p, time) {
    ctx.clearRect(0, 0, w, h);

    // explosion amount: 0 (assembled) -> 1 (diagram) -> 0 (reassembled)
    var e = smooth(stag(p, 0.12, 0.55)) * (1 - smooth(stag(p, 0.80, 0.96)));
    // section focus weights for accent lighting
    var focusNC = win(p, 0.40, 0.66, 0.08);
    var focusSound = win(p, 0.64, 0.86, 0.08);
    // labels appear only near full explosion; illegible on small screens
    var labelA = w < 640 ? 0 : stag(e, 0.82, 0.98);
    // extra breathing room while the NC beat inspects the diagram
    var spread = 1 + 0.07 * win(p, 0.40, 0.72, 0.1);

    // composition: cede space to the active copy block
    var heroW = 1 - smooth(stag(p, 0.08, 0.18)); // hero copy sits above
    var ctaW = smooth(stag(p, 0.86, 0.96));      // CTA copy sits below
    var engW = win(p, 0.18, 0.39, 0.08);         // copy left -> product right
    var shiftX = 140 * (engW + focusSound) - 140 * focusNC;
    var shiftY = 200 * heroW - 200 * ctaW;

    // assembled product is much narrower than the exploded diagram, so on
    // portrait screens let it fill more width while assembled
    var fitW = VW - 500 * (1 - e);
    var scale = Math.min(h / VH, Math.max(w / VW, w / fitW)) *
      (1.04 - 0.18 * e) * (1 - 0.10 * heroW - 0.18 * ctaW);
    var floatY = Math.sin(time / 1400) * 9 * (1 - e * 0.6);
    var tilt = -0.045 * (1 - e); // editorial tilt in the hero, level diagram

    ctx.save();
    ctx.translate(w / 2, h / 2 + floatY * scale);
    ctx.scale(scale, scale);
    ctx.rotate(tilt);
    ctx.translate(shiftX, CY - VH / 2 + shiftY);

    // internals materialize as the cups open
    var innerA = stag(e, 0.05, 0.28);

    /* ----- headband cushion (behind band) ----- */
    var k = stag(e, 0.05, 0.65);
    drawBandPad(ctx, 0, -115 * k * spread);

    /* ----- headband ----- */
    k = stag(e, 0.0, 0.6);
    drawBand(ctx, 0, -170 * k * spread);

    /* ----- sliders + yokes ----- */
    k = stag(e, 0.0, 0.6);
    drawSlider(ctx, -1, 0, -150 * k * spread);
    drawSlider(ctx, 1, 0, -150 * k * spread);
    k = stag(e, 0.05, 0.65);
    drawYoke(ctx, -1, -26 * k * spread, -70 * k * spread);
    drawYoke(ctx, 1, 26 * k * spread, -70 * k * spread);

    /* ----- ear cushions (drawn behind shells) ----- */
    k = stag(e, 0.05, 0.6);
    drawCushion(ctx, -1, (14 + 10 * k) * spread, 38 * k * spread);
    drawCushion(ctx, 1, -(14 + 10 * k) * spread, 38 * k * spread);

    /* ----- battery & PCB (between shell and driver) ----- */
    k = stag(e, 0.3, 0.85);
    drawBattery(ctx, -140 * k * spread, 290 * k * spread, innerA * k);
    drawPCB(ctx, 140 * k * spread, 290 * k * spread, innerA * k, focusNC);

    /* ----- outer shells ----- */
    k = stag(e, 0.0, 0.55);
    drawShell(ctx, -1, -330 * k * spread, 0);
    drawShell(ctx, 1, 330 * k * spread, 0);

    /* ----- magnets ----- */
    k = stag(e, 0.1, 0.65);
    drawMagnet(ctx, -1, -225 * k * spread, 0, innerA, focusSound);
    drawMagnet(ctx, 1, 225 * k * spread, 0, innerA, focusSound);

    /* ----- drivers ----- */
    k = stag(e, 0.15, 0.7);
    drawDriver(ctx, -1, -120 * k * spread, -10 * k, innerA, focusSound);
    drawDriver(ctx, 1, 120 * k * spread, -10 * k, innerA, focusSound);

    /* ----- baffle rings ----- */
    k = stag(e, 0.2, 0.75);
    drawBaffle(ctx, -1, -55 * k * spread, -5 * k, innerA);
    drawBaffle(ctx, 1, 55 * k * spread, -5 * k, innerA);

    /* ----- microphone capsules ----- */
    k = stag(e, 0.3, 0.9);
    drawMics(ctx, k * spread, innerA * stag(e, 0.3, 0.6), focusNC, time);

    /* ----- technical labels ----- */
    if (labelA > 0.01) drawLabels(ctx, labelA, spread, focusNC, focusSound);

    ctx.restore();
  }

  /* ---------- parts ---------- */

  function bandPath(ctx, dx, dy, inset) {
    inset = inset || 0;
    ctx.beginPath();
    ctx.moveTo(-CUP_X + dx, -140 + dy + inset);
    ctx.quadraticCurveTo(dx, -560 + dy + inset * 2, CUP_X + dx, -140 + dy + inset);
  }

  function drawBand(ctx, dx, dy) {
    bandPath(ctx, dx, dy);
    ctx.lineCap = 'round';
    ctx.lineWidth = 36;
    var g = ctx.createLinearGradient(0, -460 + dy, 0, -120 + dy);
    g.addColorStop(0, '#222226');
    g.addColorStop(1, '#0c0c0e');
    ctx.strokeStyle = g;
    ctx.stroke();
    // rim light tracing the top of the band
    bandPath(ctx, dx, dy - 15);
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = 'rgba(170,210,255,0.22)';
    ctx.stroke();
  }

  function drawBandPad(ctx, dx, dy) {
    bandPath(ctx, dx, dy, 26);
    ctx.lineCap = 'round';
    ctx.lineWidth = 20;
    ctx.strokeStyle = '#09090b';
    ctx.stroke();
    bandPath(ctx, dx, dy, 26);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.stroke();
  }

  function drawSlider(ctx, side, dx, dy) {
    var x = side * CUP_X + dx;
    rr(ctx, x - 11, -150 + dy, 22, 58, 8);
    var g = ctx.createLinearGradient(x - 11, 0, x + 11, 0);
    g.addColorStop(0, '#1d1d21');
    g.addColorStop(0.5, '#2a2a2f');
    g.addColorStop(1, '#121215');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function drawYoke(ctx, side, dx, dy) {
    var x = side * CUP_X + dx, y = CUP_Y + dy;
    ctx.beginPath();
    ctx.arc(x, y, 172, -2.55, -0.59);
    ctx.lineCap = 'round';
    ctx.lineWidth = 13;
    ctx.strokeStyle = '#1a1a1e';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, 177, -2.45, -0.69);
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = 'rgba(190,220,255,0.14)';
    ctx.stroke();
  }

  function drawCushion(ctx, side, dx, dy) {
    var x = side * CUP_X + side * dx, y = CUP_Y + dy;
    matteEllipse(ctx, x, y, 100, 140, '#141417', '#08080a', 1);
    // inner well
    ellipse(ctx, x, y, 58, 92);
    ctx.fillStyle = '#050506';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function drawShell(ctx, side, dx, dy) {
    var x = side * CUP_X + dx, y = CUP_Y + dy;
    matteEllipse(ctx, x, y, 112, 152, '#26262b', '#0c0c0e', 1);
    // soft top-left specular
    var g = ctx.createRadialGradient(x - 40, y - 70, 6, x - 40, y - 70, 130);
    g.addColorStop(0, 'rgba(255,255,255,0.10)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ellipse(ctx, x, y, 112, 152);
    ctx.fillStyle = g;
    ctx.fill();
    // recessed face line
    ellipse(ctx, x, y, 84, 120);
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    // flush mic ports on the shell face
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    for (var i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(x + side * (30 + i * 16), y - 96 + i * 9, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawMagnet(ctx, side, dx, dy, a, focus) {
    if (a <= 0.01) return;
    var x = side * CUP_X + dx, y = CUP_Y + dy;
    ctx.globalAlpha = a;
    ctx.beginPath(); ctx.arc(x, y, 46, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, 40, 0, Math.PI * 2);
    var g = ctx.createRadialGradient(x - 10, y - 12, 4, x, y, 44);
    g.addColorStop(0, '#1e1e23');
    g.addColorStop(1, '#0b0b0d');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, 27, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(' + CYAN + ',' + (0.12 + 0.30 * focus) + ')';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    // pole slots
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 16, y); ctx.lineTo(x + 16, y);
    ctx.moveTo(x, y - 16); ctx.lineTo(x, y + 16);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function drawDriver(ctx, side, dx, dy, a, focus) {
    if (a <= 0.01) return;
    var x = side * CUP_X + dx, y = CUP_Y + dy;
    ctx.globalAlpha = a;
    // diaphragm
    ctx.beginPath(); ctx.arc(x, y, 60, 0, Math.PI * 2);
    var g = ctx.createRadialGradient(x - 14, y - 18, 4, x, y, 64);
    g.addColorStop(0, '#222228');
    g.addColorStop(1, '#0a0a0c');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    // concentric corrugations
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 1;
    [48, 34, 20].forEach(function (r) {
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    });
    // voice coil — glows during the sound beat
    ctx.beginPath(); ctx.arc(x, y, 41, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(' + CYAN + ',' + (0.18 + 0.55 * focus) + ')';
    ctx.lineWidth = 2.2;
    ctx.shadowColor = 'rgba(' + CYAN + ',' + 0.8 * focus + ')';
    ctx.shadowBlur = 26 * focus;
    ctx.stroke();
    ctx.shadowBlur = 0;
    // center dome
    ctx.beginPath(); ctx.arc(x, y, 15, 0, Math.PI * 2);
    var d = ctx.createRadialGradient(x - 4, y - 5, 1, x, y, 16);
    d.addColorStop(0, '#3a3a42');
    d.addColorStop(1, '#101013');
    ctx.fillStyle = d;
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawBaffle(ctx, side, dx, dy, a) {
    if (a <= 0.01) return;
    var x = side * CUP_X + dx, y = CUP_Y + dy;
    ctx.globalAlpha = a;
    ctx.beginPath(); ctx.arc(x, y, 72, 0, Math.PI * 2);
    ctx.strokeStyle = '#17171b';
    ctx.lineWidth = 14;
    ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, 79, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();
    // acoustic vents
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    for (var i = 0; i < 8; i++) {
      var ang = (Math.PI * 2 * i) / 8 + 0.4;
      ctx.beginPath();
      ctx.arc(x + Math.cos(ang) * 56, y + Math.sin(ang) * 56, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawPCB(ctx, dx, dy, a, focus) {
    if (a <= 0.01) return;
    var x = CUP_X + dx, y = CUP_Y + dy;
    ctx.globalAlpha = a;
    rr(ctx, x - 65, y - 45, 130, 90, 10);
    ctx.fillStyle = '#0a0f15';
    ctx.fill();
    ctx.strokeStyle = 'rgba(' + CYAN + ',' + (0.20 + 0.25 * focus) + ')';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    // traces
    ctx.strokeStyle = 'rgba(' + CYAN + ',' + (0.14 + 0.18 * focus) + ')';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 52, y - 26); ctx.lineTo(x - 20, y - 26); ctx.lineTo(x - 14, y - 13);
    ctx.moveTo(x - 52, y + 28); ctx.lineTo(x - 24, y + 28); ctx.lineTo(x - 14, y + 14);
    ctx.moveTo(x + 52, y - 22); ctx.lineTo(x + 22, y - 22); ctx.lineTo(x + 14, y - 12);
    ctx.moveTo(x + 52, y + 24); ctx.lineTo(x + 24, y + 24); ctx.lineTo(x + 14, y + 12);
    ctx.stroke();
    // QN3 processor die — pulses during the NC beat
    rr(ctx, x - 13, y - 13, 26, 26, 4);
    ctx.fillStyle = '#10161f';
    ctx.fill();
    ctx.strokeStyle = 'rgba(' + CYAN + ',' + (0.35 + 0.45 * focus) + ')';
    ctx.shadowColor = 'rgba(' + CYAN + ',' + 0.8 * focus + ')';
    ctx.shadowBlur = 22 * focus;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  function drawBattery(ctx, dx, dy, a) {
    if (a <= 0.01) return;
    var x = -CUP_X + dx, y = CUP_Y + dy;
    ctx.globalAlpha = a;
    rr(ctx, x - 60, y - 36, 120, 72, 14);
    var g = ctx.createLinearGradient(x, y - 36, x, y + 36);
    g.addColorStop(0, '#17171b');
    g.addColorStop(1, '#0a0a0c');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.beginPath();
    ctx.moveTo(x - 44, y); ctx.lineTo(x + 44, y);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  var MICS = [
    { sx: -1, ox: -90, oy: -210 }, { sx: -1, ox: -150, oy: -160 }, { sx: -1, ox: -185, oy: -90 },
    { sx: 1, ox: 90, oy: -210 }, { sx: 1, ox: 150, oy: -160 }, { sx: 1, ox: 185, oy: -90 }
  ];

  function drawMics(ctx, k, a, focus, time) {
    if (a <= 0.01) return;
    var pulse = 0.5 + 0.5 * Math.sin(time / 320);
    ctx.globalAlpha = a;
    for (var i = 0; i < MICS.length; i++) {
      var m = MICS[i];
      var x = m.sx * CUP_X + m.ox * k;
      var y = CUP_Y - 100 + (m.oy + 100) * k;
      ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fillStyle = '#1b1b20';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.16)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, 2.6, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(' + CYAN + ',' + (0.35 + 0.55 * focus * pulse) + ')';
      ctx.shadowColor = 'rgba(' + CYAN + ',' + 0.9 * focus + ')';
      ctx.shadowBlur = 14 * focus;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- technical diagram labels ---------- */

  var LABELS = [
    { text: 'FIBER-COMPOSITE HEADBAND', lx: -540, ly: -440, ax: -130, ay: -390 },
    { text: '30 MM CARBON-DOME DRIVER', lx: -540, ly: -150, ax: -390, ay: 45, sound: true },
    { text: 'MEMORY-FOAM EARPAD', lx: -540, ly: 290, ax: -262, ay: 105 },
    { text: 'BATTERY CELL', lx: -540, ly: 440, ax: -420, ay: 370 },
    { text: 'BEAMFORMING MIC ARRAY', lx: 540, ly: -300, ax: 366, ay: -155, nc: true },
    { text: 'NEODYMIUM MAGNET', lx: 540, ly: -150, ax: 505, ay: 55, sound: true },
    { text: 'QN3 NC PROCESSOR', lx: 540, ly: 440, ax: 420, ay: 370, nc: true }
  ];

  function drawLabels(ctx, a, spread, focusNC, focusSound) {
    ctx.save();
    ctx.font = '500 13px Inter, system-ui, sans-serif';
    if ('letterSpacing' in ctx) ctx.letterSpacing = '2px';
    for (var i = 0; i < LABELS.length; i++) {
      var L = LABELS[i];
      var hot = (L.nc ? focusNC : 0) + (L.sound ? focusSound : 0);
      var ax = L.ax * spread, ay = L.ay * spread;
      var right = L.lx > 0;
      var elbow = L.lx + (right ? -24 : 24);
      // yield to same-side copy blocks (NC copy sits right, sound copy left)
      var sideA = right ? 1 - 0.9 * focusNC : 1 - 0.9 * focusSound;
      ctx.globalAlpha = a * sideA * (0.55 + 0.45 * hot);
      // hairline leader: anchor -> elbow -> label
      ctx.strokeStyle = 'rgba(255,255,255,0.28)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(elbow, L.ly + 5);
      ctx.lineTo(L.lx, L.ly + 5);
      ctx.stroke();
      // anchor dot
      ctx.beginPath(); ctx.arc(ax, ay, 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(' + CYAN + ',' + (0.5 + 0.5 * hot) + ')';
      ctx.fill();
      // label text
      ctx.fillStyle = hot > 0.4
        ? 'rgba(190,238,255,' + (0.7 + 0.3 * hot) + ')'
        : 'rgba(255,255,255,0.5)';
      ctx.textAlign = right ? 'left' : 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(L.text, L.lx + (right ? 10 : -10), L.ly + 5);
    }
    ctx.restore();
  }

  window.XM6Renderer = { render: render };
})();
