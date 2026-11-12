/* Shared enhancements for londoniac.co.uk. No dependencies.
   1. Hero network: a 3D node graph with data pulses, drawn on a 2D canvas.
   2. Tilt cards:   project cards lean towards the pointer.
   3. Wonder Device: a CSS 3D model you can drag to rotate. */
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  /* ───────────── 1. HERO NETWORK ───────────── */
  function heroNetwork() {
    var hero = document.querySelector('.hero');
    if (!hero) return;
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext && canvas.getContext('2d');
    if (!ctx) return;
    canvas.className = 'hero-net';
    canvas.setAttribute('aria-hidden', 'true');
    hero.insertBefore(canvas, hero.querySelector('.hero-content'));

    var W = 0, H = 0, D = 0, builtW = 0;
    var nodes = [], edges = [], adj = [], pulses = [];
    var mx = 0, my = 0, tx = 0, ty = 0;
    var visible = true, running = false, last = 0;

    var seed = 1;
    function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }

    function glow(r, g, b) {
      var c = document.createElement('canvas');
      c.width = c.height = 64;
      var x = c.getContext('2d');
      var grad = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, 'rgba(' + r + ',' + g + ',' + b + ',1)');
      grad.addColorStop(0.25, 'rgba(' + r + ',' + g + ',' + b + ',0.45)');
      grad.addColorStop(1, 'rgba(' + r + ',' + g + ',' + b + ',0)');
      x.fillStyle = grad;
      x.fillRect(0, 0, 64, 64);
      return c;
    }
    var glowCyan = glow(0, 229, 255), glowIndigo = glow(129, 140, 248), glowWhite = glow(220, 250, 255);

    function build() {
      seed = 20240611;
      builtW = W;
      D = Math.min(W, H) * 0.45;
      var n = clamp(Math.round(W * H / 26000), 22, 60);
      var minDist = Math.sqrt(W * H / n) * 0.5;
      nodes = []; edges = []; adj = []; pulses = [];
      var tries = 0, i, j;
      while (nodes.length < n && tries < 4000) {
        tries++;
        var x = rnd() * 2 - 1, y = rnd() * 2 - 1, z = rnd() * 2 - 1;
        // thin the cloud out behind the headline
        if ((x / 0.6) * (x / 0.6) + (y / 0.55) * (y / 0.55) < 1 && rnd() < 0.8) continue;
        var p = { bx: x * W * 0.56, by: y * H * 0.48, bz: z * D };
        var ok = true;
        for (i = 0; i < nodes.length; i++) {
          var dx = nodes[i].bx - p.bx, dy = nodes[i].by - p.by;
          if (dx * dx + dy * dy < minDist * minDist) { ok = false; break; }
        }
        if (!ok) continue;
        p.r = 1.3 + rnd() * 1.7;
        p.hub = rnd() < 0.16;
        p.indigo = rnd() < 0.2;
        p.flash = 0;
        nodes.push(p);
        adj.push([]);
      }
      // link each node to its nearest neighbours
      var seen = {};
      for (i = 0; i < nodes.length; i++) {
        var near = [];
        for (j = 0; j < nodes.length; j++) {
          if (i === j) continue;
          var ax = nodes[i].bx - nodes[j].bx, ay = nodes[i].by - nodes[j].by, az = nodes[i].bz - nodes[j].bz;
          near.push([ax * ax + ay * ay + az * az * 0.3, j]);
        }
        near.sort(function (a, b) { return a[0] - b[0]; });
        var links = nodes[i].hub ? 3 : 2;
        for (j = 0; j < links && j < near.length; j++) {
          var o = near[j][1], key = i < o ? i + '-' + o : o + '-' + i;
          if (seen[key]) continue;
          seen[key] = true;
          adj[i].push(edges.length); adj[o].push(edges.length);
          edges.push({ a: i, b: o, len: Math.sqrt(near[j][0]) });
        }
      }
      var count = Math.max(4, Math.round(nodes.length / 4));
      for (i = 0; i < count && edges.length; i++) {
        var pulse = {};
        spawn(pulse);
        pulse.t = rnd();
        pulses.push(pulse);
      }
    }

    function spawn(p) {
      var e = Math.floor(rnd() * edges.length);
      p.e = e;
      p.from = rnd() < 0.5 ? edges[e].a : edges[e].b;
      p.t = 0;
      p.speed = 70 + rnd() * 90;
    }

    function advance(p, dt) {
      var e = edges[p.e];
      p.t += p.speed * dt / Math.max(e.len, 40);
      if (p.t < 1) return;
      var at = e.a === p.from ? e.b : e.a;
      nodes[at].flash = 1;
      // work flows left to right: prefer onward edges that head right
      var options = [], total = 0, i;
      for (i = 0; i < adj[at].length; i++) {
        var ei = adj[at][i];
        if (ei === p.e) continue;
        var other = edges[ei].a === at ? edges[ei].b : edges[ei].a;
        var w = nodes[other].bx > nodes[at].bx ? 4 : 1;
        options.push([ei, w]); total += w;
      }
      if (!options.length || rnd() < 0.08) { spawn(p); return; }
      var pick = rnd() * total;
      for (i = 0; i < options.length; i++) {
        pick -= options[i][1];
        if (pick <= 0) break;
      }
      p.e = options[Math.min(i, options.length - 1)][0];
      p.from = at;
      p.t = 0;
    }

    function render(time) {
      var yaw = Math.sin(time * 0.00012) * 0.22 + mx * 0.26;
      var pitch = Math.sin(time * 0.00009) * 0.06 + my * 0.14;
      var cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      var F = Math.max(W, H) * 1.1, i, n, e;

      for (i = 0; i < nodes.length; i++) {
        n = nodes[i];
        var x1 = n.bx * cy - n.bz * sy, z1 = n.bx * sy + n.bz * cy;
        var y1 = n.by * cp - z1 * sp, z2 = n.by * sp + z1 * cp;
        var f = F / (F + z2);
        n.sx = W / 2 + x1 * f; n.sy = H / 2 + y1 * f; n.f = f;
        n.a = clamp(0.3 + 0.7 * (1 - (z2 + D) / (2 * D)), 0.2, 1);
      }

      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineWidth = 1;
      for (i = 0; i < edges.length; i++) {
        e = edges[i];
        var a = nodes[e.a], b = nodes[e.b];
        ctx.strokeStyle = 'rgba(0, 200, 230, ' + (0.07 + 0.17 * (a.a + b.a) / 2).toFixed(3) + ')';
        ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); ctx.stroke();
      }
      for (i = 0; i < nodes.length; i++) {
        n = nodes[i];
        var size = (n.hub ? 26 : 16) * n.r * n.f * (1 + n.flash * 0.9);
        ctx.globalAlpha = clamp(n.a * (0.45 + n.flash * 0.55), 0, 1);
        ctx.drawImage(n.indigo ? glowIndigo : glowCyan, n.sx - size / 2, n.sy - size / 2, size, size);
        ctx.globalAlpha = n.a;
        ctx.fillStyle = n.indigo ? '#a5b4fc' : '#7df3ff';
        ctx.beginPath(); ctx.arc(n.sx, n.sy, n.r * n.f * (n.hub ? 1.5 : 1), 0, 6.2832); ctx.fill();
      }
      for (i = 0; i < pulses.length; i++) {
        var p = pulses[i];
        e = edges[p.e];
        var from = nodes[p.from], to = nodes[e.a === p.from ? e.b : e.a];
        var ex = to.sx - from.sx, ey = to.sy - from.sy;
        var step = 5 / Math.max(Math.sqrt(ex * ex + ey * ey), 1); // tail dots 5px apart
        for (var k = 0; k < 7; k++) {
          var t = p.t - k * step;
          if (t < 0) break;
          var px = from.sx + ex * t, py = from.sy + ey * t;
          var s = (k ? 16 - k * 1.6 : 22) * (from.f + to.f) / 2;
          ctx.globalAlpha = (k ? 0.6 - k * 0.08 : 1) * clamp((from.a + to.a) / 2 + 0.2, 0, 1);
          ctx.drawImage(k ? glowCyan : glowWhite, px - s / 2, py - s / 2, s, s);
        }
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    function frame(time) {
      if (!running) return;
      var dt = Math.min((time - last) / 1000, 0.05);
      last = time;
      mx += (tx - mx) * 0.04; my += (ty - my) * 0.04;
      for (var i = 0; i < pulses.length; i++) advance(pulses[i], dt);
      for (i = 0; i < nodes.length; i++) if (nodes[i].flash > 0) nodes[i].flash = Math.max(0, nodes[i].flash - dt * 1.8);
      render(time);
      requestAnimationFrame(frame);
    }

    function setRunning() {
      var should = visible && !document.hidden && !reduced;
      if (should && !running) {
        running = true;
        last = performance.now();
        requestAnimationFrame(frame);
      } else if (!should) {
        running = false;
      }
    }

    function resize() {
      var w = hero.clientWidth, h = hero.clientHeight;
      if (!w || !h) return;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = w; H = h;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // phones change height as the address bar hides; only rebuild on width changes
      if (Math.abs(w - builtW) > 1) build();
      if (!running) render(0);
    }

    resize();
    canvas.classList.add('on');
    var resizeTimer;
    window.addEventListener('resize', function () { clearTimeout(resizeTimer); resizeTimer = setTimeout(resize, 150); });
    window.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      tx = (e.clientX / window.innerWidth - 0.5) * 2;
      ty = (e.clientY / window.innerHeight - 0.5) * 2;
    }, { passive: true });
    document.addEventListener('visibilitychange', setRunning);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        setRunning();
      }).observe(hero);
    }
    setRunning();
  }

  /* ───────────── 2. TILT CARDS ───────────── */
  function tiltCards() {
    if (reduced || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    var cards = document.querySelectorAll('.tilt');
    Array.prototype.forEach.call(cards, function (card) {
      var pending = null, queued = false;
      function apply() {
        queued = false;
        if (!pending) return;
        var r = card.getBoundingClientRect();
        var px = clamp((pending.x - r.left) / r.width, 0, 1), py = clamp((pending.y - r.top) / r.height, 0, 1);
        card.style.setProperty('--ry', ((px - 0.5) * 16).toFixed(2) + 'deg');
        card.style.setProperty('--rx', ((0.5 - py) * 12).toFixed(2) + 'deg');
        card.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
        card.style.setProperty('--my', (py * 100).toFixed(1) + '%');
        card.style.setProperty('--px', (px - 0.5).toFixed(3));
        card.style.setProperty('--py', (py - 0.5).toFixed(3));
      }
      card.addEventListener('pointermove', function (e) {
        if (e.pointerType === 'touch') return;
        pending = { x: e.clientX, y: e.clientY };
        card.classList.add('is-tilting');
        if (!queued) { queued = true; requestAnimationFrame(apply); }
      });
      card.addEventListener('pointerleave', function () {
        pending = null;
        card.classList.remove('is-tilting');
        ['--rx', '--ry', '--px', '--py'].forEach(function (v) { card.style.removeProperty(v); });
      });
    });
  }

  /* ───────────── 3. WONDER DEVICE ───────────── */
  function wonderDevice() {
    var stage = document.getElementById('wonderDevice');
    if (!stage) return;
    var device = stage.querySelector('.wd-device');
    var glare = stage.querySelector('.wd-glare');
    var screens = stage.querySelectorAll('.wd-front img');
    var tabs = stage.parentNode.querySelectorAll('.wd-tab');
    var THICKNESS = 16; // px, matches --t in the CSS

    for (var i = 0; i <= THICKNESS; i++) {
      var layer = document.createElement('span');
      layer.className = 'wd-layer';
      layer.style.transform = 'translateZ(' + (i - THICKNESS / 2) + 'px)';
      device.insertBefore(layer, device.firstChild);
    }
    stage.classList.add('is-3d');

    // screens
    var current = 0, holdUntil = 0;
    function show(index) {
      current = (index + screens.length) % screens.length;
      Array.prototype.forEach.call(screens, function (img, n) { img.classList.toggle('on', n === current); });
      Array.prototype.forEach.call(tabs, function (tab, n) { tab.setAttribute('aria-pressed', n === current ? 'true' : 'false'); });
    }
    Array.prototype.forEach.call(tabs, function (tab, n) {
      tab.addEventListener('click', function () { holdUntil = Date.now() + 9000; show(n); });
    });

    // rotation
    var IDLE_YAW = -22, IDLE_PITCH = 7;
    var yaw = -24, pitch = IDLE_PITCH, spin = 0;
    var dragging = false, lastX = 0, lastY = 0, releasedAt = -1e9;
    var visible = false, running = false;

    function paint() {
      device.style.transform = 'rotateX(' + pitch.toFixed(2) + 'deg) rotateY(' + yaw.toFixed(2) + 'deg)';
      if (glare) {
        var facing = ((yaw % 360) + 540) % 360 - 180; // -180..180, 0 = facing the viewer
        glare.style.backgroundPosition = clamp(50 + facing * 1.1, 0, 100).toFixed(1) + '% 0';
      }
    }

    stage.addEventListener('pointerdown', function (e) {
      if (e.button) return;
      dragging = true; spin = 0;
      lastX = e.clientX; lastY = e.clientY;
      stage.classList.add('dragging');
      try { stage.setPointerCapture(e.pointerId); } catch (err) { /* older browsers */ }
    });
    stage.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      spin = dx * 0.6;
      yaw += spin;
      pitch = clamp(pitch - dy * 0.3, -28, 28);
      if (!running) paint();
    });
    function release() {
      if (!dragging) return;
      dragging = false;
      releasedAt = performance.now();
      stage.classList.remove('dragging');
    }
    stage.addEventListener('pointerup', release);
    stage.addEventListener('pointercancel', release);
    stage.addEventListener('dragstart', function (e) { e.preventDefault(); });

    function frame(time) {
      if (!running) return;
      if (!dragging) {
        if (time - releasedAt < 1600) {
          yaw += spin; spin *= 0.94; // coast after a flick
        } else {
          var targetYaw = IDLE_YAW + Math.sin(time * 0.0007) * 16;
          var targetPitch = IDLE_PITCH + Math.sin(time * 0.0005) * 3;
          var diff = (((targetYaw - yaw) % 360) + 540) % 360 - 180; // shortest way round
          yaw += diff * 0.04;
          pitch += (targetPitch - pitch) * 0.04;
        }
      }
      paint();
      requestAnimationFrame(frame);
    }
    function setRunning() {
      var should = visible && !document.hidden && !reduced;
      if (should && !running) { running = true; requestAnimationFrame(frame); }
      else if (!should) running = false;
    }
    document.addEventListener('visibilitychange', setRunning);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        setRunning();
      }).observe(stage);
    } else {
      visible = true; setRunning();
    }
    paint();

    if (!reduced) {
      setInterval(function () {
        if (visible && !document.hidden && !dragging && Date.now() > holdUntil) show(current + 1);
      }, 3200);
    }
  }

  function init() { heroNetwork(); tiltCards(); wonderDevice(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
