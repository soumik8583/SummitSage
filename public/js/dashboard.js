'use strict';

/**
 * Summit Sage — Trekker Dashboard
 * A demo, front-end-only loyalty dashboard. Profile lives in localStorage so
 * the experience persists without a login backend: tier progress, loyalty
 * points, earned badges, wishlist, upcoming/past treks and a referral code.
 */
(function () {
  const SS = window.SS || {};
  const mount = document.getElementById('dashMount');
  if (!mount) return;

  const KEY = 'ss_profile';
  const TIERS = [
    { name: 'Bronze', min: 0, cls: 'bronze', icon: 'fa-award' },
    { name: 'Silver', min: 500, cls: 'silver', icon: 'fa-medal' },
    { name: 'Gold', min: 1200, cls: 'gold', icon: 'fa-trophy' },
    { name: 'Summit', min: 2500, cls: 'summit', icon: 'fa-mountain-sun' }
  ];

  function load() {
    try {
      const p = JSON.parse(localStorage.getItem(KEY));
      if (p && p.name) return p;
    } catch (e) {}
    return null;
  }
  function save(p) { localStorage.setItem(KEY, JSON.stringify(p)); }

  function demoProfile() {
    return {
      name: 'Trailblazer',
      email: '',
      points: 1450,
      joined: new Date().getFullYear(),
      completed: ['sandakphu-phalut', 'brahmatal'],
      upcoming: ['kedarkantha'],
      referral: 'SAGE-' + Math.random().toString(36).slice(2, 7).toUpperCase(),
      badgeIds: [1, 2, 3, 5, 7]
    };
  }

  function tierFor(points) {
    let cur = TIERS[0];
    for (let i = 0; i < TIERS.length; i++) if (points >= TIERS[i].min) cur = TIERS[i];
    return cur;
  }
  function nextTier(points) {
    for (let i = 0; i < TIERS.length; i++) if (points < TIERS[i].min) return TIERS[i];
    return null;
  }

  function renderLogin() {
    mount.innerHTML =
      '<div class="dash-login card center" data-reveal>' +
      '<div class="quiz-icon"><i class="fa-solid fa-user-astronaut"></i></div>' +
      '<h2 class="mt-1">Your basecamp dashboard</h2>' +
      '<p class="muted" style="max-width:460px;margin:8px auto 20px">Track your tier, loyalty points, badges and wishlist. This is a live demo — your profile is saved locally on this device.</p>' +
      '<div class="form-row" style="max-width:420px;margin:0 auto"><div class="form-group" style="text-align:left"><label>Your name</label><input class="control" id="dashName" placeholder="e.g. Ananya"></div></div>' +
      '<button class="btn btn-primary btn-lg mt-1" id="dashEnter"><i class="fa-solid fa-right-to-bracket"></i> Enter dashboard (demo)</button>' +
      '</div>';
    if (window.SummitEffects) window.SummitEffects.initReveal();
    document.getElementById('dashEnter').addEventListener('click', function () {
      const p = demoProfile();
      const nm = (document.getElementById('dashName').value || '').trim();
      if (nm) p.name = nm;
      save(p);
      renderDash(p);
    });
  }

  function trekMini(slug) {
    const t = SS.getTrek ? SS.getTrek(slug) : null;
    if (!t) return '';
    return (
      '<a class="dash-trek" href="/trek-detail?trek=' + t.slug + '">' +
      '<div class="dash-trek-img" style="background-image:url(' + t.image + ')"></div>' +
      '<div><b>' + t.name + '</b><small class="muted">' + t.region + ' · ' + t.days + ' days</small></div>' +
      '<i class="fa-solid fa-chevron-right"></i></a>'
    );
  }

  function renderDash(p) {
    const tier = tierFor(p.points);
    const nxt = nextTier(p.points);
    const pct = nxt ? Math.round(((p.points - tier.min) / (nxt.min - tier.min)) * 100) : 100;
    const wish = (SS.wishlist ? SS.wishlist.get() : []) || [];
    const badges = (SS.badges || []).map(function (b) {
      const earned = p.badgeIds.indexOf(b.id) > -1;
      return '<div class="merit ' + (earned ? '' : 'locked') + '"><div class="ring"><i class="fa-solid ' + b.icon + '"></i></div><b>' + b.name + '</b><small class="muted">' + (earned ? b.desc : 'Locked') + '</small></div>';
    }).join('');

    mount.innerHTML =
      // Header
      '<div class="dash-head card" data-reveal><div class="flex between items-center wrap gap-2">' +
      '<div class="flex items-center gap-2"><div class="dash-avatar ' + tier.cls + '">' + p.name.charAt(0).toUpperCase() + '</div>' +
      '<div><span class="eyebrow" style="margin:0"><i class="fa-solid ' + tier.icon + '"></i> ' + tier.name + ' trekker</span>' +
      '<h2 style="margin:2px 0 0">Namaste, ' + p.name + ' 👋</h2><small class="muted">Member since ' + p.joined + '</small></div></div>' +
      '<div class="dash-points"><b data-counter="' + p.points + '">0</b><small>loyalty points</small></div></div>' +
      // Tier progress
      '<div class="dash-progress mt-2"><div class="flex between"><span class="muted">' + tier.name + '</span>' + (nxt ? '<span class="muted">' + (nxt.min - p.points) + ' pts to ' + nxt.name + '</span>' : '<span class="accent">Top tier reached 🏔️</span>') + '</div>' +
      '<div class="seat-bar mt-1"><span style="width:' + pct + '%"></span></div></div></div>' +

      // Stat cards
      '<div class="grid cols-4 mt-3">' +
      statCard('fa-mountain', p.completed.length, 'Treks completed') +
      statCard('fa-calendar-check', p.upcoming.length, 'Upcoming') +
      statCard('fa-heart', wish.length, 'Wishlisted') +
      statCard('fa-medal', p.badgeIds.length, 'Badges earned') +
      '</div>' +

      // Body split
      '<div class="split mt-3" style="align-items:start">' +
      '<div>' +
      section('fa-calendar-check', 'Upcoming adventures', p.upcoming.length ? p.upcoming.map(trekMini).join('') : emptyMsg('No upcoming treks yet — time to book!')) +
      section('fa-flag-checkered', 'Completed treks', p.completed.length ? p.completed.map(trekMini).join('') : emptyMsg('Your summit story starts soon.')) +
      section('fa-heart', 'Your wishlist', wish.length ? wish.map(trekMini).join('') : emptyMsg('Tap the ♥ on any trek to save it here.')) +
      '</div>' +
      '<div>' +
      // Referral
      '<div class="card"><h3><i class="fa-solid fa-gift accent"></i> Refer & earn</h3><p class="muted" style="font-size:.9rem;margin:6px 0 12px">Share your code — you both get ₹300 off.</p>' +
      '<div class="referral"><code id="refCode">' + p.referral + '</code><button class="btn btn-sm btn-primary" id="copyRef"><i class="fa-solid fa-copy"></i> Copy</button></div></div>' +
      // Perks
      '<div class="card mt-2"><h3><i class="fa-solid ' + tier.icon + ' accent"></i> ' + tier.name + ' perks</h3><ul class="mt-1">' +
      tierPerks(tier.name).map(function (x) { return '<li style="padding:7px 0;border-top:1px solid var(--line);display:flex;gap:10px"><i class="fa-solid fa-check accent" style="margin-top:4px"></i><span style="font-size:.9rem">' + x + '</span></li>'; }).join('') +
      '</ul></div>' +
      '<button class="btn btn-ghost btn-block mt-2" id="dashReset"><i class="fa-solid fa-arrow-right-from-bracket"></i> Reset demo</button>' +
      '</div></div>' +

      // Badges
      '<div class="mt-4"><div class="section-head left"><span class="eyebrow"><i class="fa-solid fa-medal"></i> Achievements</span><h2 class="mt-1">Your badge wall</h2></div><div class="badge-grid mt-2">' + badges + '</div></div>';

    // Effects & counters
    if (window.SummitEffects) {
      window.SummitEffects.initReveal();
      window.SummitEffects.initCounters(mount);
    }

    const copy = document.getElementById('copyRef');
    if (copy) copy.addEventListener('click', function () {
      const code = p.referral;
      if (navigator.clipboard) navigator.clipboard.writeText(code);
      copy.innerHTML = '<i class="fa-solid fa-check"></i> Copied';
      setTimeout(function () { copy.innerHTML = '<i class="fa-solid fa-copy"></i> Copy'; }, 1600);
    });
    const reset = document.getElementById('dashReset');
    if (reset) reset.addEventListener('click', function () {
      localStorage.removeItem(KEY);
      renderLogin();
    });
  }

  function statCard(icon, num, label) {
    return '<div class="card stat-card" data-reveal><i class="fa-solid ' + icon + ' accent"></i><b data-counter="' + num + '">0</b><small class="muted">' + label + '</small></div>';
  }
  function section(icon, title, body) {
    return '<div class="dash-section"><h3><i class="fa-solid ' + icon + ' accent"></i> ' + title + '</h3><div class="mt-1">' + body + '</div></div>';
  }
  function emptyMsg(m) { return '<p class="muted" style="padding:16px;border:1px dashed var(--line);border-radius:12px;text-align:center">' + m + '</p>'; }
  function tierPerks(name) {
    const map = {
      Bronze: ['Welcome scratch-card reward', 'Members-only trek updates', 'Birthday month discount'],
      Silver: ['5% off every trek', 'Priority batch booking', 'Free gear rental once'],
      Gold: ['10% off + free companion once', 'Exclusive summit meetups', 'Complimentary trek photos'],
      Summit: ['15% lifetime discount', 'Free annual trek slot', 'Personal trek concierge', 'First access to new expeditions']
    };
    return map[name] || map.Bronze;
  }

  const existing = load();
  if (existing) renderDash(existing);
  else renderLogin();
})();
