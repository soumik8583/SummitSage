'use strict';

/**
 * Summit Sage — Visual effects engine
 * Particle starfield · cursor glow · 3D tilt · parallax · counters ·
 * snow · scroll-reveal. All effects respect prefers-reduced-motion and
 * pause when the tab is hidden.
 */
(function () {
  const reduceMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;
  const isTouch = window.matchMedia('(hover: none)').matches;

  /* ============================================================
     1. PARTICLE STARFIELD (reacts to the mouse)
     ============================================================ */
  function initParticles() {
    const canvas = document.querySelector('.hero-particles');
    if (!canvas || reduceMotion) return;

    const ctx = canvas.getContext('2d');
    let w, h, dpr, particles;
    const mouse = { x: -9999, y: -9999, active: false };

    function size() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(120, Math.floor((w * h) / 12000));
      particles = new Array(count).fill(0).map(function () {
        return {
          x: Math.random() * w,
          y: Math.random() * h,
          r: Math.random() * 1.7 + 0.4,
          vx: (Math.random() - 0.5) * 0.28,
          vy: (Math.random() - 0.5) * 0.28,
          tw: Math.random() * Math.PI * 2,
        };
      });
    }

    function frame() {
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.tw += 0.02;

        // Mouse interaction — gentle repulsion within a radius.
        if (mouse.active) {
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 130) {
            const force = (130 - dist) / 130;
            p.x += (dx / dist) * force * 1.6;
            p.y += (dy / dist) * force * 1.6;
          }
        }

        // Wrap around edges.
        if (p.x < -5) p.x = w + 5;
        if (p.x > w + 5) p.x = -5;
        if (p.y < -5) p.y = h + 5;
        if (p.y > h + 5) p.y = -5;

        const alpha = 0.35 + Math.sin(p.tw) * 0.3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,' + Math.max(0.08, alpha) + ')';
        ctx.fill();

        // Connect to nearby particles for a constellation feel.
        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j];
          const d = Math.hypot(p.x - q.x, p.y - q.y);
          if (d < 108) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.strokeStyle = 'rgba(232,93,4,' + (0.12 * (1 - d / 108)) + ')';
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }
      raf = requestAnimationFrame(frame);
    }

    let raf = null;
    function start() {
      if (!raf) raf = requestAnimationFrame(frame);
    }
    function stop() {
      if (raf) {
        cancelAnimationFrame(raf);
        raf = null;
      }
    }

    const hero = canvas.closest('.hero') || canvas.parentElement;
    hero.addEventListener('mousemove', function (e) {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
      mouse.active = true;
    });
    hero.addEventListener('mouseleave', function () {
      mouse.active = false;
      mouse.x = mouse.y = -9999;
    });

    window.addEventListener('resize', size, { passive: true });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stop();
      else start();
    });

    size();
    start();
  }

  /* ============================================================
     2. CURSOR GLOW TRAIL
     ============================================================ */
  function initCursorGlow() {
    if (isTouch || reduceMotion) return;
    const glow = document.querySelector('.cursor-glow');
    if (!glow) return;

    let tx = 0,
      ty = 0,
      cx = 0,
      cy = 0;
    window.addEventListener('mousemove', function (e) {
      tx = e.clientX;
      ty = e.clientY;
      glow.style.opacity = '1';
    });
    window.addEventListener('mouseout', function () {
      glow.style.opacity = '0';
    });

    (function loop() {
      cx += (tx - cx) * 0.14;
      cy += (ty - cy) * 0.14;
      glow.style.transform =
        'translate(' + cx + 'px,' + cy + 'px) translate(-50%,-50%)';
      requestAnimationFrame(loop);
    })();
  }

  /* ============================================================
     3. 3D TILT on cards
     ============================================================ */
  function initTilt() {
    if (isTouch || reduceMotion) return;
    document.querySelectorAll('.tilt').forEach(function (el) {
      const max = 12;
      el.addEventListener('mousemove', function (e) {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform =
          'perspective(900px) rotateY(' +
          px * max +
          'deg) rotateX(' +
          -py * max +
          'deg) translateY(-6px)';
      });
      el.addEventListener('mouseleave', function () {
        el.style.transform = '';
      });
    });
  }

  /* ============================================================
     4. PARALLAX on scroll
     ============================================================ */
  function initParallax() {
    if (reduceMotion) return;
    const els = Array.prototype.slice.call(
      document.querySelectorAll('[data-parallax]')
    );
    if (!els.length) return;

    let ticking = false;
    function update() {
      const vh = window.innerHeight;
      els.forEach(function (el) {
        const speed = parseFloat(el.getAttribute('data-parallax')) || 0.2;
        const rect = el.getBoundingClientRect();
        const offset = rect.top + rect.height / 2 - vh / 2;
        el.style.transform = 'translate3d(0,' + -offset * speed + 'px,0)';
      });
      ticking = false;
    }
    window.addEventListener(
      'scroll',
      function () {
        if (!ticking) {
          requestAnimationFrame(update);
          ticking = true;
        }
      },
      { passive: true }
    );
    update();
  }

  /* ============================================================
     5. ANIMATED COUNTERS
     ============================================================ */
  function initCounters(root) {
    const els = (root || document).querySelectorAll('[data-counter]:not([data-counted])');
    if (!els.length) return;

    function run(el) {
      el.setAttribute('data-counted', '1');
      const target = parseFloat(el.getAttribute('data-counter'));
      const dur = 1600;
      const dec = (el.getAttribute('data-decimals') || '0') | 0;
      const start = performance.now();
      function step(now) {
        const t = Math.min((now - start) / dur, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        const val = target * eased;
        el.textContent =
          dec > 0
            ? val.toFixed(dec)
            : Math.floor(val).toLocaleString('en-IN');
        if (t < 1) requestAnimationFrame(step);
        else
          el.textContent =
            dec > 0 ? target.toFixed(dec) : target.toLocaleString('en-IN');
      }
      requestAnimationFrame(step);
    }

    if ('IntersectionObserver' in window && !reduceMotion) {
      const io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (en) {
            if (en.isIntersecting) {
              run(en.target);
              io.unobserve(en.target);
            }
          });
        },
        { threshold: 0.4 }
      );
      els.forEach(function (el) {
        io.observe(el);
      });
    } else {
      els.forEach(run);
    }
  }

  /* ============================================================
     6. SNOW
     ============================================================ */
  function initSnow() {
    if (reduceMotion) return;
    document.querySelectorAll('.snow').forEach(function (layer) {
      const count = 26;
      let html = '';
      for (let i = 0; i < count; i++) {
        const size = Math.random() * 4 + 1.5;
        const left = Math.random() * 100;
        const dur = Math.random() * 8 + 7;
        const delay = Math.random() * -15;
        const op = Math.random() * 0.5 + 0.3;
        html +=
          '<i style="left:' +
          left +
          '%;width:' +
          size +
          'px;height:' +
          size +
          'px;opacity:' +
          op +
          ';animation-duration:' +
          dur +
          's;animation-delay:' +
          delay +
          's"></i>';
      }
      layer.innerHTML = html;
    });
  }

  /* ============================================================
     7. SCROLL REVEAL
     ============================================================ */
  function initReveal() {
    const els = document.querySelectorAll('[data-reveal]');
    if (!els.length) return;
    if ('IntersectionObserver' in window && !reduceMotion) {
      const io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (en, i) {
            if (en.isIntersecting) {
              const delay = Math.min(i * 55, 240);
              setTimeout(function () {
                en.target.classList.add('visible');
              }, delay);
              io.unobserve(en.target);
            }
          });
        },
        { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
      );
      els.forEach(function (el) {
        io.observe(el);
      });
    } else {
      els.forEach(function (el) {
        el.classList.add('visible');
      });
    }
  }

  /* ============================================================
     8. HERO VIDEO (optional) — fades in when a source is provided
     ============================================================ */
  function initHeroVideo() {
    const v = document.querySelector('.hero-video');
    if (!v || reduceMotion) return;
    const src = v.getAttribute('data-src');
    if (!src) return; // no source → particles remain the background
    v.src = src;
    v.addEventListener('canplay', function () {
      v.classList.add('ready');
      v.play().catch(function () {});
    });
  }

  /* ---- boot ---- */
  function boot() {
    initReveal();
    initCounters();
    initParticles();
    initCursorGlow();
    initTilt();
    initParallax();
    initSnow();
    initHeroVideo();
  }
  if (document.readyState !== 'loading') boot();
  else document.addEventListener('DOMContentLoaded', boot);

  // Re-init effects for content injected later (trek grids, dashboards, etc.).
  window.SummitEffects = {
    initTilt: initTilt,
    initReveal: initReveal,
    initCounters: initCounters,
    initParallax: initParallax,
    initSnow: initSnow,
  };
})();
