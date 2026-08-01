'use strict';

/**
 * Summit Sage — Declarative section renderer
 * Any element with data-render="…" is filled from window.SS.* datasets.
 * Keeps the HTML pages lean and the content in one editable place.
 *   featured-treks · testimonials · leaderboard · badges · blog ·
 *   founders · gallery · instagram · partners · press
 */
(function () {
  const SS = (window.SS = window.SS || {});

  function stars(n) {
    let s = '';
    for (let i = 1; i <= 5; i++)
      s += '<i class="fa-' + (i <= n ? 'solid' : 'regular') + ' fa-star"></i>';
    return '<span class="stars">' + s + '</span>';
  }

  function reviewCard(t) {
    return (
      '<article class="review-card" data-reveal>' +
      stars(t.rating) +
      '<p class="quote">“' + t.quote + '”</p>' +
      '<div class="reviewer"><div class="avatar">' + t.initials + '</div>' +
      '<div><b>' + t.name + '</b><small>' + t.trek + ' · ' + t.city + '</small></div></div>' +
      '</article>'
    );
  }

  function boardRow(p, i) {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1;
    return (
      '<div class="board-row' + (i < 3 ? ' top' : '') + '" data-reveal>' +
      '<div class="rank">' + medal + '</div>' +
      '<div class="who"><div class="avatar" style="width:40px;height:40px;font-size:.85rem">' + p.initials + '</div><div><b>' + p.name + '</b><br><small class="muted">' + p.points.toLocaleString('en-IN') + ' points</small></div></div>' +
      '<span class="tier ' + p.tier.toLowerCase() + '">' + p.tier + '</span>' +
      '<div style="text-align:right"><b style="color:#fff;font-family:var(--font-display);font-size:1.2rem">' + p.treks + '</b><br><small class="muted">treks</small></div>' +
      '</div>'
    );
  }

  function meritTile(b) {
    return (
      '<div class="merit' + (b.unlocked ? '' : ' locked') + '" data-reveal title="' + (b.unlocked ? 'Unlocked' : 'Locked') + '">' +
      '<div class="ring"><i class="fa-solid ' + b.icon + '"></i></div>' +
      '<small>' + b.name + '</small></div>'
    );
  }

  function blogCard(b) {
    return (
      '<article class="card feature" data-reveal style="padding:0;overflow:hidden">' +
      '<div class="media-frame" style="aspect-ratio:16/9;border:0;border-radius:0;background-image:url(' + b.image + ')"></div>' +
      '<div style="padding:24px">' +
      '<div class="flex between items-center" style="margin-bottom:10px"><span class="tag">' + b.cat + '</span><small class="muted">' + b.read + ' min read</small></div>' +
      '<h3 style="font-size:1.2rem;margin-bottom:10px">' + b.title + '</h3>' +
      '<p class="muted" style="font-size:.94rem">' + b.excerpt + '</p>' +
      '<div class="flex between items-center" style="margin-top:16px"><small class="muted"><i class="fa-solid fa-feather"></i> ' + b.author + ' · ' + b.date + '</small>' +
      '<a href="/blog" class="accent" style="font-weight:700;font-size:.9rem">Read <i class="fa-solid fa-arrow-right"></i></a></div>' +
      '</div></article>'
    );
  }

  function founderCard(f) {
    return (
      '<article class="card center" data-reveal>' +
      '<div class="avatar" style="width:110px;height:110px;font-size:2rem;margin:0 auto 18px;background-image:url(' + f.image + ')"></div>' +
      '<h3>' + f.name + '</h3>' +
      '<p class="accent" style="font-weight:700;font-size:.9rem;margin:4px 0 12px">' + f.role + '</p>' +
      '<p class="muted" style="font-size:.94rem">' + f.bio + '</p>' +
      '<div class="social" style="justify-content:center;margin-top:16px">' +
      '<a href="#" aria-label="LinkedIn"><i class="fa-brands fa-linkedin-in"></i></a>' +
      '<a href="https://www.instagram.com/summitsage_?igsh=cHhrZGJjdHI4bzM=" target="_blank" rel="noopener" aria-label="Instagram"><i class="fa-brands fa-instagram"></i></a>' +
      '<a data-wa aria-label="WhatsApp"><i class="fa-brands fa-whatsapp"></i></a>' +
      '</div></article>'
    );
  }

  // ---- Lightbox for galleries ----
  function ensureLightbox() {
    let lb = document.getElementById('lightbox');
    if (lb) return lb;
    lb = document.createElement('div');
    lb.id = 'lightbox';
    lb.className = 'modal';
    lb.innerHTML =
      '<div class="modal-box" style="max-width:1000px;background:transparent;border:0"><button class="modal-close" aria-label="Close"><i class="fa-solid fa-xmark"></i></button><img class="lightbox-img" alt=""></div>';
    document.body.appendChild(lb);
    lb.addEventListener('click', function (e) {
      if (e.target === lb || e.target.closest('.modal-close')) lb.classList.remove('open');
    });
    return lb;
  }

  function renderGallery(el) {
    const items = SS.gallery || [];
    el.innerHTML = items
      .map(function (g) {
        return (
          '<a class="' + (g.span || '') + '" data-img="' + g.img + '"><img src="' + g.img + '" alt="' + g.trek + '" loading="lazy" onerror="this.parentNode.style.background=\'linear-gradient(160deg,#1c3454,#0b1a30)\'"></a>'
        );
      })
      .join('');
    const lb = ensureLightbox();
    el.querySelectorAll('[data-img]').forEach(function (a) {
      a.addEventListener('click', function () {
        lb.querySelector('img').src = a.getAttribute('data-img');
        lb.classList.add('open');
      });
    });
  }

  function render() {
    document.querySelectorAll('[data-render]').forEach(function (el) {
      const type = el.getAttribute('data-render');
      const limit = parseInt(el.getAttribute('data-limit'), 10) || 0;
      let html = '';
      switch (type) {
        case 'featured-treks':
          if (SS.renderFeatured) {
            const slugs = (el.getAttribute('data-slugs') || '').split(',').filter(Boolean);
            const doFeatured = function () {
              SS.renderFeatured('#' + el.id, slugs.length ? slugs : null);
            };
            // Ensure admin-managed treks are loaded before rendering.
            if (SS.loadDbTreks) SS.loadDbTreks().then(doFeatured);
            else doFeatured();
          }
          return;
        case 'testimonials': {
          let list = SS.testimonials || [];
          if (limit) list = list.slice(0, limit);
          html = list.map(reviewCard).join('');
          break;
        }
        case 'leaderboard':
          html = (SS.leaderboard || []).map(boardRow).join('');
          break;
        case 'badges':
          html = (SS.badges || []).map(meritTile).join('');
          break;
        case 'blog': {
          let list = SS.blog || [];
          const cat = el.getAttribute('data-cat');
          if (cat) list = list.filter(function (b) { return b.cat === cat; });
          if (limit) list = list.slice(0, limit);
          html = list.map(blogCard).join('');
          break;
        }
        case 'founders':
          html = (SS.founders || []).map(founderCard).join('');
          break;
        case 'gallery':
          renderGallery(el);
          return;
        case 'instagram':
          html = (SS.instagram || [])
            .slice(0, limit || 12)
            .map(function (src) {
              return '<a href="' + (window.SUMMIT ? window.SUMMIT.instagram : '#') + '" target="_blank" rel="noopener"><img src="' + src + '" alt="Summit Sage on Instagram" loading="lazy" onerror="this.parentNode.style.background=\'#16294a\'"></a>';
            })
            .join('');
          break;
        case 'partners':
          html = (SS.partners || [])
            .map(function (p) {
              return '<span class="logo"><i class="fa-solid fa-mountain-sun"></i>' + p + '</span>';
            })
            .join('');
          break;
        case 'press':
          html = (SS.press || [])
            .map(function (p) {
              return '<span class="logo" style="font-size:1.05rem">' + p + '</span>';
            })
            .join('');
          break;
        default:
          return;
      }
      el.innerHTML = html;
    });
    if (window.SS && window.SS.wireWA) window.SS.wireWA(document);
    if (window.SummitEffects) {
      window.SummitEffects.initReveal();
      window.SummitEffects.initTilt();
    }
  }

  if (document.readyState !== 'loading') render();
  else document.addEventListener('DOMContentLoaded', render);
})();
