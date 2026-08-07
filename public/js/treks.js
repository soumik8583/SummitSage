'use strict';

/**
 * Summit Sage — Trek rendering & interactivity
 * Card rendering, live countdown timers, seat meters, wishlist (localStorage),
 * filtering, smart search, sort, side-by-side compare and calendar view.
 * Shared by the homepage (featured) and the Upcoming Treks page.
 */
(function () {
  const SS = (window.SS = window.SS || {});
  const treks = SS.treks || [];

  /* ---------- Wishlist store ---------- */
  const WISH_KEY = 'ss_wishlist';
  function getWish() {
    try {
      return JSON.parse(localStorage.getItem(WISH_KEY)) || [];
    } catch (e) {
      return [];
    }
  }
  function setWish(list) {
    localStorage.setItem(WISH_KEY, JSON.stringify(list));
    document.querySelectorAll('[data-wishcount]').forEach(function (el) {
      el.textContent = list.length;
    });
  }
  function toggleWish(slug) {
    const list = getWish();
    const i = list.indexOf(slug);
    if (i > -1) list.splice(i, 1);
    else list.push(slug);
    setWish(list);
    return i === -1;
  }
  SS.wishlist = { get: getWish, toggle: toggleWish };

  /* ---------- Card HTML ---------- */
  function seatMeter(t) {
    const booked = Math.round(((t.totalSeats - t.seatsLeft) / t.totalSeats) * 100);
    const low = t.seatsLeft <= 6;
    return (
      '<div class="seat">' +
      '<div class="seat-bar"><span style="width:' + booked + '%"></span></div>' +
      '<div class="seat-info"><span>' +
      (low ? '🔥 Filling fast' : 'Seats') +
      '</span><span><b>' + t.seatsLeft + '</b> of ' + t.totalSeats + ' left</span></div>' +
      '</div>'
    );
  }

  function priceBlock(t) {
    const hasEarly = t.earlyBird && t.earlyBird < t.price;
    return (
      '<div class="price">' +
      SS.fmtINR(hasEarly ? t.earlyBird : t.price) +
      (hasEarly ? ' <s>' + SS.fmtINR(t.price) + '</s>' : '') +
      '<small>' + (hasEarly ? 'Early-bird · per person' : 'per person') + '</small></div>'
    );
  }

  SS.trekCard = function (t) {
    const wished = getWish().indexOf(t.slug) > -1;
    return (
      '<article class="trek-card tilt" data-slug="' + t.slug + '" data-reveal>' +
      '<div class="tilt-inner">' +
      '<div class="media">' +
      '<img src="' + t.image + '" alt="' + t.name + '" loading="lazy" onerror="this.style.display=\'none\'">' +
      '<div class="trek-top">' +
      '<span class="badge ' + SS.diffClass(t.difficulty) + ' solid">' + t.difficulty + '</span>' +
      '<button class="trek-fav' + (wished ? ' active' : '') + '" data-fav="' + t.slug + '" aria-label="Save to wishlist" title="Save for later">' +
      '<i class="fa-' + (wished ? 'solid' : 'regular') + ' fa-heart"></i></button>' +
      '</div></div>' +
      '<div class="trek-body">' +
      '<div class="trek-meta"><span><i class="fa-solid fa-location-dot"></i>' + t.region + '</span>' +
      '<span><i class="fa-solid fa-clock"></i>' + t.days + ' days</span>' +
      '<span><i class="fa-solid fa-star" style="color:#f2c14e"></i>' + t.rating + '</span></div>' +
      '<h3>' + t.name + '</h3>' +
      '<p class="muted" style="font-size:.92rem;min-height:44px">' + t.blurb.slice(0, 96) + (t.blurb.length > 96 ? '…' : '') + '</p>' +
      seatMeter(t) +
      '<div class="trek-info" style="margin-top:14px">' +
      priceBlock(t) +
      '<div class="countdown" data-deadline="' + t.startDate + '" aria-label="Starts in">' +
      '<div class="unit"><b>00</b><span>days</span></div>' +
      '<div class="unit"><b>00</b><span>hrs</span></div>' +
      '<div class="unit"><b>00</b><span>min</span></div>' +
      '</div></div>' +
      '<div class="flex gap-1" style="margin-top:16px">' +
      '<a href="/trek-detail?trek=' + t.slug + '" class="btn btn-primary btn-sm" style="flex:1">View trek</a>' +
      '<button class="btn btn-outline btn-sm" data-compare="' + t.slug + '" title="Add to compare"><i class="fa-solid fa-code-compare"></i></button>' +
      '</div>' +
      '<a href="/brochure?trek=' + t.slug + '" target="_blank" rel="noopener" class="brochure-link"><i class="fa-solid fa-file-arrow-down"></i> Download Brochure</a>' +
      '</div></div></article>'
    );
  };

  /* ---------- Live countdown ---------- */
  function tick() {
    const now = Date.now();
    document.querySelectorAll('[data-deadline]').forEach(function (el) {
      const target = new Date(el.getAttribute('data-deadline')).getTime();
      let diff = Math.max(0, target - now);
      const d = Math.floor(diff / 86400000);
      diff -= d * 86400000;
      const h = Math.floor(diff / 3600000);
      diff -= h * 3600000;
      const m = Math.floor(diff / 60000);
      diff -= m * 60000;
      const s = Math.floor(diff / 1000);
      const units = el.querySelectorAll('.unit b');
      const vals = el.classList.contains('lg') ? [d, h, m, s] : [d, h, m];
      units.forEach(function (u, i) {
        if (vals[i] !== undefined) u.textContent = String(vals[i]).padStart(2, '0');
      });
    });
  }
  SS.startCountdowns = function () {
    tick();
    clearInterval(SS._cd);
    SS._cd = setInterval(tick, 1000);
  };

  /* ---------- Wire card buttons ---------- */
  SS.wireCards = function (root) {
    (root || document).querySelectorAll('[data-fav]').forEach(function (btn) {
      if (btn._wired) return;
      btn._wired = true;
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        const on = toggleWish(btn.getAttribute('data-fav'));
        btn.classList.toggle('active', on);
        btn.querySelector('i').className = 'fa-' + (on ? 'solid' : 'regular') + ' fa-heart';
      });
    });
    (root || document).querySelectorAll('[data-compare]').forEach(function (btn) {
      if (btn._wired) return;
      btn._wired = true;
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        addCompare(btn.getAttribute('data-compare'));
      });
    });
    if (window.SummitEffects) {
      window.SummitEffects.initTilt();
      window.SummitEffects.initReveal();
    }
    SS.startCountdowns();
  };

  /* ---------- Featured (homepage) ---------- */
  SS.renderFeatured = function (selector, slugs) {
    const wrap = document.querySelector(selector);
    if (!wrap) return;
    let list = slugs ? slugs.map(SS.getTrek).filter(Boolean) : [];
    // Fall back to the first few available (admin-managed) treks.
    if (!list.length) list = treks.slice(0, 3);
    if (!list.length) {
      wrap.innerHTML = '<div class="card center" style="grid-column:1/-1;padding:40px"><p class="muted">New treks are on the way — check back soon.</p></div>';
      return;
    }
    wrap.innerHTML = list.map(SS.trekCard).join('');
    SS.wireCards(wrap);
  };

  /* ---------- Compare ---------- */
  let compareList = [];
  function addCompare(slug) {
    if (compareList.indexOf(slug) > -1) return;
    if (compareList.length >= 2) compareList.shift();
    compareList.push(slug);
    renderTray();
  }
  function removeCompare(slug) {
    compareList = compareList.filter(function (s) {
      return s !== slug;
    });
    renderTray();
  }
  function renderTray() {
    const tray = document.getElementById('compareTray');
    if (!tray) return;
    const slots = tray.querySelector('.slots');
    slots.innerHTML = [0, 1]
      .map(function (i) {
        const slug = compareList[i];
        const t = slug ? SS.getTrek(slug) : null;
        return t
          ? '<div class="compare-slot" style="background-image:url(' + t.image + ')"><button class="rm" data-rm="' + t.slug + '">&times;</button></div>'
          : '<div class="compare-slot"><i class="fa-solid fa-plus"></i></div>';
      })
      .join('');
    tray.classList.toggle('show', compareList.length > 0);
    slots.querySelectorAll('[data-rm]').forEach(function (b) {
      b.addEventListener('click', function () {
        removeCompare(b.getAttribute('data-rm'));
      });
    });
  }
  function openCompare() {
    if (compareList.length < 2) {
      alert('Pick two treks to compare — tap the compare icon on any trek card.');
      return;
    }
    const a = SS.getTrek(compareList[0]);
    const b = SS.getTrek(compareList[1]);
    const rows = [
      ['Region', a.region, b.region],
      ['Difficulty', a.difficulty, b.difficulty],
      ['Duration', a.days + ' days', b.days + ' days'],
      ['Max altitude', a.maxAltitude + ' m', b.maxAltitude + ' m'],
      ['Distance', a.distanceKm + ' km', b.distanceKm + ' km'],
      ['Best season', a.season, b.season],
      ['Price', SS.fmtINR(a.earlyBird), SS.fmtINR(b.earlyBird)],
      ['Rating', a.rating + ' ★', b.rating + ' ★'],
      ['Seats left', a.seatsLeft, b.seatsLeft],
      ['Fitness (1-5)', a.fitness, b.fitness],
    ];
    const modal = document.getElementById('compareModal');
    modal.querySelector('.modal-body').innerHTML =
      '<div style="padding:32px">' +
      '<h2 style="margin-bottom:6px">Compare treks</h2>' +
      '<div class="grid cols-2" style="margin:20px 0">' +
      [a, b].map(function (t) {
        return '<div class="media-frame" style="aspect-ratio:16/9;background-image:url(' + t.image + ')"></div>';
      }).join('') +
      '</div>' +
      '<table style="width:100%;border-collapse:collapse">' +
      '<tr><td></td><th style="text-align:left;padding:10px;color:#fff">' + a.name + '</th><th style="text-align:left;padding:10px;color:#fff">' + b.name + '</th></tr>' +
      rows.map(function (r) {
        return '<tr style="border-top:1px solid var(--line)"><td style="padding:10px;color:var(--mist-dim);font-weight:600">' + r[0] + '</td><td style="padding:10px;color:#fff">' + r[1] + '</td><td style="padding:10px;color:#fff">' + r[2] + '</td></tr>';
      }).join('') +
      '</table>' +
      '<div class="flex gap-1" style="margin-top:22px">' +
      '<a href="/trek-detail?trek=' + a.slug + '" class="btn btn-outline btn-sm">Open ' + a.name + '</a>' +
      '<a href="/trek-detail?trek=' + b.slug + '" class="btn btn-outline btn-sm">Open ' + b.name + '</a>' +
      '</div></div>';
    modal.classList.add('open');
  }
  SS.initCompare = function () {
    const btn = document.getElementById('compareOpen');
    if (btn) btn.addEventListener('click', openCompare);
    const modal = document.getElementById('compareModal');
    if (modal) {
      modal.addEventListener('click', function (e) {
        if (e.target === modal || e.target.closest('.modal-close')) modal.classList.remove('open');
      });
    }
  };

  /* ---------- Smart search parser ---------- */
  function smartMatch(t, q) {
    if (!q) return true;
    const query = q.toLowerCase();
    // price: "under 5000", "below 8000", "< 10000"
    const priceM = query.match(/(?:under|below|less than|<)\s*₹?\s*(\d{3,6})/);
    if (priceM && t.earlyBird > parseInt(priceM[1], 10)) return false;
    const overM = query.match(/(?:over|above|more than|>)\s*₹?\s*(\d{3,6})/);
    if (overM && t.earlyBird < parseInt(overM[1], 10)) return false;
    // season / difficulty keywords
    const seasons = ['winter', 'spring', 'summer', 'monsoon', 'autumn'];
    const foundSeason = seasons.filter(function (s) { return query.indexOf(s) > -1; });
    if (foundSeason.length && !foundSeason.some(function (s) {
      return t.seasons.map(function (x) { return x.toLowerCase(); }).indexOf(s) > -1;
    })) return false;
    const diffs = ['easy', 'moderate', 'challenging', 'extreme'];
    const foundDiff = diffs.filter(function (d) { return query.indexOf(d) > -1; });
    if (foundDiff.length && foundDiff.indexOf(t.difficulty.toLowerCase()) === -1) return false;
    // free-text remainder against name/region/tags
    const cleaned = query
      .replace(/(?:under|below|less than|over|above|more than)\s*₹?\s*\d{3,6}/g, '')
      .replace(new RegExp('\\b(' + seasons.concat(diffs).join('|') + ')\\b', 'g'), '')
      .replace(/[<>₹]/g, '')
      .trim();
    if (!cleaned) return true;
    const hay = (t.name + ' ' + t.region + ' ' + t.base + ' ' + t.tags.join(' ')).toLowerCase();
    return cleaned.split(/\s+/).every(function (w) { return hay.indexOf(w) > -1; });
  }

  /* ---------- Treks page controller ---------- */
  function initTreksPage() {
    const grid = document.getElementById('trekGrid');
    if (!grid) return;

    const state = { difficulty: 'all', season: 'all', budget: 'all', sort: 'date', q: '', wishOnly: false };

    function apply() {
      let list = treks.filter(function (t) {
        if (state.difficulty !== 'all' && t.difficulty !== state.difficulty) return false;
        if (state.season !== 'all' && t.seasons.indexOf(state.season) === -1) return false;
        if (state.budget !== 'all' && t.budgetTier !== state.budget) return false;
        if (state.wishOnly && getWish().indexOf(t.slug) === -1) return false;
        if (!smartMatch(t, state.q)) return false;
        return true;
      });
      list.sort(function (a, b) {
        if (state.sort === 'price') return a.earlyBird - b.earlyBird;
        if (state.sort === 'price-desc') return b.earlyBird - a.earlyBird;
        if (state.sort === 'rating') return b.rating - a.rating;
        if (state.sort === 'difficulty') {
          const order = { Easy: 1, Moderate: 2, Challenging: 3, Extreme: 4 };
          return order[a.difficulty] - order[b.difficulty];
        }
        return new Date(a.startDate) - new Date(b.startDate);
      });

      const count = document.getElementById('resultCount');
      if (count) count.textContent = list.length;

      grid.innerHTML = list.length
        ? list.map(SS.trekCard).join('')
        : (treks.length === 0
            ? '<div class="card center" style="grid-column:1/-1;padding:60px"><i class="fa-solid fa-mountain-sun" style="font-size:2rem;color:var(--orange);margin-bottom:14px"></i><h3>New treks coming soon</h3><p class="muted">We\u2019re lining up the next set of expeditions. Check back shortly, or <a href="/contact">get in touch</a> to plan a custom trek.</p></div>'
            : '<div class="card center" style="grid-column:1/-1;padding:60px"><i class="fa-solid fa-mountain" style="font-size:2rem;color:var(--orange);margin-bottom:14px"></i><h3>No treks match your filters</h3><p class="muted">Try widening your search or clearing filters.</p></div>');
      SS.wireCards(grid);
    }

    // Search
    const search = document.getElementById('trekSearch');
    if (search) {
      search.addEventListener('input', function () {
        state.q = search.value;
        apply();
      });
    }
    // Difficulty chips
    document.querySelectorAll('[data-filter="difficulty"]').forEach(function (chip) {
      chip.addEventListener('click', function () {
        document.querySelectorAll('[data-filter="difficulty"]').forEach(function (c) {
          c.classList.remove('active');
        });
        chip.classList.add('active');
        state.difficulty = chip.getAttribute('data-value');
        apply();
      });
    });
    // Selects
    const seasonSel = document.getElementById('filterSeason');
    if (seasonSel) seasonSel.addEventListener('change', function () { state.season = seasonSel.value; apply(); });
    const budgetSel = document.getElementById('filterBudget');
    if (budgetSel) budgetSel.addEventListener('change', function () { state.budget = budgetSel.value; apply(); });
    const sortSel = document.getElementById('sortBy');
    if (sortSel) sortSel.addEventListener('change', function () { state.sort = sortSel.value; apply(); });
    // Wishlist toggle
    const wishBtn = document.getElementById('wishOnly');
    if (wishBtn) {
      wishBtn.addEventListener('click', function () {
        state.wishOnly = !state.wishOnly;
        wishBtn.classList.toggle('active', state.wishOnly);
        apply();
      });
    }

    // Calendar / grid view toggle
    const viewBtns = document.querySelectorAll('[data-view]');
    viewBtns.forEach(function (b) {
      b.addEventListener('click', function () {
        viewBtns.forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        const cal = document.getElementById('calendarView');
        const isCal = b.getAttribute('data-view') === 'calendar';
        if (cal) cal.classList.toggle('hidden', !isCal);
        grid.classList.toggle('hidden', isCal);
        if (isCal) renderCalendar();
      });
    });

    apply();
    SS.initCompare();
    setWish(getWish());
  }

  /* ---------- Calendar view ---------- */
  function renderCalendar() {
    const wrap = document.getElementById('calendarView');
    if (!wrap) return;
    const byMonth = {};
    treks.forEach(function (t) {
      const d = new Date(t.startDate);
      const key = d.getFullYear() + '-' + d.getMonth();
      (byMonth[key] = byMonth[key] || []).push({ t: t, day: d.getDate() });
    });
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const now = new Date();
    let html = '<div class="grid cols-3">';
    for (let i = 0; i < 6; i++) {
      const m = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const key = m.getFullYear() + '-' + m.getMonth();
      const items = (byMonth[key] || []).sort(function (a, b) { return a.day - b.day; });
      html +=
        '<div class="card" data-reveal><h3 style="font-size:1.1rem;margin-bottom:12px">' + months[m.getMonth()] + ' ' + m.getFullYear() + '</h3>' +
        (items.length
          ? items.map(function (it) {
              return '<a href="/trek-detail?trek=' + it.t.slug + '" class="flex items-center gap-1" style="padding:9px 0;border-top:1px solid var(--line)"><span class="tag">' + it.day + '</span><span style="color:#fff;font-weight:600">' + it.t.name + '</span></a>';
            }).join('')
          : '<p class="muted" style="font-size:.9rem">No departures this month.</p>') +
        '</div>';
    }
    html += '</div>';
    wrap.innerHTML = html;
    if (window.SummitEffects) window.SummitEffects.initReveal();
  }

  /* ---------- boot ---------- */
  function boot() {
    setWish(getWish());
    // Pull in any admin-managed treks from the DB, then render the grid.
    if (SS.loadDbTreks) SS.loadDbTreks().then(initTreksPage);
    else initTreksPage();
  }
  if (document.readyState !== 'loading') boot();
  else document.addEventListener('DOMContentLoaded', boot);
})();
