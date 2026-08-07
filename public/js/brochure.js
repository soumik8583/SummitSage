'use strict';

/**
 * Summit Sage — Brochure Agent.
 *
 * An internal, on-device "agent" that turns a trek's raw details into an
 * eye-catching, print-ready brochure. It runs the moment a trek exists in the
 * catalogue (i.e. right after an admin adds it) and needs no server, no
 * headless browser and no API keys.
 *
 * It works in two steps, like a small agent:
 *   1) ANALYSE  — read the trek's attributes (altitude, difficulty, tags,
 *                 season, region…) and decide what KIND of trek this is.
 *   2) COMPOSE  — write a tailored tagline, hook, "why choose", "what's
 *                 different", an at-a-glance panel and a CTA for that theme.
 *
 * SS.brochureAgent(trek)  → structured brochure content
 * SS.renderBrochure(trek, mountEl) → paints the brochure into the page
 */
(function () {
  var SS = (window.SS = window.SS || {});

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function hash(s) {
    s = String(s || ''); var h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h;
  }
  function pick(arr, seed) { return arr[seed % arr.length]; }
  function cleanText(s, max) {
    s = String(s == null ? '' : s)
      .replace(/[#*_>`~]/g, ' ')          // strip markdown marks
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // strip images
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links -> text
      .replace(/\s+/g, ' ')
      .trim();
    if (max && s.length > max) {
      s = s.slice(0, max);
      var i = s.lastIndexOf('. ');
      if (i > 70) s = s.slice(0, i + 1);
      else s = s.replace(/\s+\S*$/, '') + '\u2026';
    }
    return s;
  }
  function inr(n) { return SS.fmtINR ? SS.fmtINR(n) : '₹' + Number(n || 0).toLocaleString('en-IN'); }
  function ft(m) { return Math.round(m * 3.28084); }
  function fmtDate(d) {
    if (!d) return null;
    var dt = new Date(d);
    if (isNaN(dt.getTime())) return null;
    return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function addDays(d, n) { var dt = new Date(d); dt.setDate(dt.getDate() + n); return dt; }

  // ── The agent ───────────────────────────────────────────────────────────────
  SS.brochureAgent = function (t) {
    var seed = hash(t.slug || t.name);
    var tags = (t.tags || []).map(function (x) { return String(x).toLowerCase(); });
    var name = String(t.name || '').toLowerCase();
    var alt = Number(t.maxAltitude) || 0;
    var diff = String(t.difficulty || 'Moderate').toLowerCase();
    var region = t.region || 'the Himalaya';
    var season = t.season && t.season !== 'All' ? t.season : null;
    var days = Number(t.days) || 0;
    var has = function (k) {
      return tags.some(function (x) { return x.indexOf(k) > -1; }) || name.indexOf(k) > -1;
    };

    // 1) ANALYSE — what kind of trek is this?
    var theme;
    if (has('snow') || has('winter') || season === 'Winter') theme = 'snow';
    else if (alt >= 4500) theme = 'expedition';
    else if (has('lake')) theme = 'lake';
    else if (has('ridge') || has('pass')) theme = 'ridge';
    else if (diff === 'easy' || has('beginner')) theme = 'beginner';
    else theme = 'classic';

    var themeLabel = {
      snow: 'Snow Summit', expedition: 'High-Altitude Expedition', lake: 'Alpine Lake Trail',
      ridge: 'Ridge & Pass Walk', beginner: 'Beginner-Friendly Escape', classic: 'Himalayan Classic',
    }[theme];

    // 2) COMPOSE
    var taglines = {
      snow: ['Chase the snow. Own the summit.', 'Where winter turns into wonder.', 'Fresh powder, frozen lakes, endless white.'],
      expedition: ['Go higher than you ever have.', 'Thin air. Big dreams. Zero regrets.', 'An expedition that rewrites your limits.'],
      lake: ['Mirror lakes and mountain skies.', 'Water so clear it holds the sky.', 'Still waters, roaring adventure.'],
      ridge: ['Walk the roof of the region.', 'One ridge, a wall of giants.', 'Every step, a brand-new horizon.'],
      beginner: ['Your first Himalaya starts here.', 'Big mountains, gentle first steps.', 'No experience needed — just courage.'],
      classic: ['A Himalayan story worth living.', 'The mountains are calling.', 'Adventure, the Summit Sage way.'],
    };
    var tagline = pick(taglines[theme], seed);

    var hook =
      (t.base ? 'Set out from ' + t.base : 'Set out') + ' on a ' + (days ? days + '-day ' : '') +
      themeLabel.toLowerCase() + ' through ' + region + ', climbing to ' +
      (alt ? alt.toLocaleString('en-IN') + ' m (' + ft(alt).toLocaleString('en-IN') + ' ft)' : 'breathtaking heights') +
      '. ' + (cleanText(t.blurb, 220) || 'A guided adventure crafted for unforgettable memories.');

    var why = [];
    if (diff === 'easy' || diff === 'moderate')
      why.push({ icon: '🥾', title: 'Beginner-friendly', text: 'Gentle gradients, small groups and expert guides make this a confidence-building climb — ideal if it\'s your first big trek.' });
    if (alt >= 3500)
      why.push({ icon: '🏔️', title: 'Jaw-dropping views', text: 'Wake up to ' + (alt ? alt.toLocaleString('en-IN') + ' m' : 'high-altitude') + ' panoramas — ' + region + ' serves some of the planet\'s most dramatic skylines.' });
    why.push({ icon: '🛡️', title: 'Safety first', text: 'Certified leaders, oxygen, first-aid and a tried-and-tested route. You focus on the adventure — we handle the rest.' });
    if (t.totalSeats)
      why.push({ icon: '👥', title: 'Small batches', text: 'Only ' + t.totalSeats + ' spots per departure — intimate groups, personal attention and no crowding on the trail.' });
    if (season)
      why.push({ icon: '🍃', title: 'Perfect timing', text: 'We run this in ' + season + ', when ' + region + ' is at its most magical.' });
    why.push({ icon: '🎒', title: 'All sorted', text: 'Meals, camping gear, permits and guides are included — just bring your spirit of adventure.' });
    why = why.slice(0, 4);

    var diffPool = {
      snow: ['Camp on real Himalayan snow', 'A true sunrise summit push', 'Frozen lakes & pine-forest trails', 'Snow-craft basics with your guides'],
      expedition: ['Serious altitude, serious bragging rights', 'Glaciers and giant peaks up close', 'A summit few ever reach', 'Pro acclimatisation planning'],
      lake: ['A glacial lake that mirrors the peaks', 'Meadows, moraine and alpine calm', 'A photographer\'s paradise', 'Sunrise reflections you won\'t forget'],
      ridge: ['A continuous ridge with wall-to-wall peaks', 'More than one summit or pass in a trip', 'Sunrise and sunset over giants', 'Ever-changing panoramas'],
      beginner: ['Purpose-built for first-timers', 'A low-risk, high-reward route', 'Build genuine mountain confidence', 'Friendly pace, big payoff'],
      classic: ['A Himalayan bucket-list route', 'Culture, forests and summits combined', 'Endless photo opportunities', 'A story you\'ll retell for years'],
    };
    var whatsDifferent = (t.highlights && t.highlights.length)
      ? t.highlights.slice(0, 4).map(function (x) { return cleanText(x, 90); })
      : diffPool[theme];

    var start = t.startDate;
    var end = t.endDate || (start && days ? addDays(start, days - 1) : null);
    var glance = [
      { label: 'Duration', value: days ? days + ' days' : '—' },
      { label: 'Max altitude', value: alt ? alt.toLocaleString('en-IN') + ' m' : '—' },
      { label: 'Difficulty', value: t.difficulty || 'Moderate' },
      { label: 'Distance', value: t.distanceKm ? t.distanceKm + ' km' : '—' },
      { label: 'Best season', value: t.season && t.season !== 'All' ? t.season : 'Multiple' },
      { label: 'Region', value: region },
    ];

    var included = (t.included && t.included.length) ? t.included
      : ['Certified trek leader & local guides', 'All meals on the trek', 'Camping & sleeping gear', 'Forest permits & entry fees', 'First-aid & oxygen support'];

    var hasEarly = t.earlyBird && t.earlyBird < t.price;
    return {
      theme: theme, themeLabel: themeLabel, tagline: tagline, hook: hook,
      why: why, whatsDifferent: whatsDifferent, glance: glance, included: included,
      startText: fmtDate(start), endText: fmtDate(end),
      priceText: inr(hasEarly ? t.earlyBird : t.price),
      fullPrice: hasEarly ? inr(t.price) : null,
      seatsLeft: t.seatsLeft != null ? t.seatsLeft : null,
    };
  };

  var MARK =
    '<svg viewBox="0 0 48 48" width="34" height="34" aria-hidden="true"><rect width="48" height="48" rx="13" fill="#0A1628"/><path d="M8 34L19 15l6 9 3-5 12 15H8z" fill="#E85D04"/><path d="M19 15l6 9 3-5 3.6 4.5L27 24l-4 3-4-6-3.5 6H10L19 15z" fill="#fff" opacity=".92"/><circle cx="35" cy="13" r="3.2" fill="#fff"/></svg>';

  // ── Renderer ─────────────────────────────────────────────────────────────────
  SS.renderBrochure = function (t, mount) {
    if (!t || !mount) return;
    var b = SS.brochureAgent(t);
    var dateRange = b.startText ? (b.startText + (b.endText ? ' — ' + b.endText : '')) : 'Dates on request';

    var cover =
      '<section class="cover">' +
        '<img class="cover-img" src="' + esc(t.image || '') + '" alt="" onerror="this.style.display=\'none\'">' +
        '<div class="cover-shade"></div>' +
        '<div class="cover-in">' +
          '<div class="brandrow">' + MARK + '<span>SUMMIT<b>SAGE</b></span><i>Explore • Dream • Discover</i></div>' +
          '<span class="theme-pill">' + esc(b.themeLabel) + '</span>' +
          '<h1 class="cover-title">' + esc(t.name) + '</h1>' +
          '<div class="cover-tag">' + esc(b.tagline) + '</div>' +
          '<div class="cover-facts">' +
            '<div><b>' + esc(t.region || '—') + '</b><span>Location</span></div>' +
            '<div><b>' + esc(t.days ? t.days + ' days' : '—') + '</b><span>Duration</span></div>' +
            '<div><b>' + esc(t.maxAltitude ? t.maxAltitude.toLocaleString('en-IN') + ' m' : '—') + '</b><span>Max altitude</span></div>' +
            '<div><b>' + esc(t.difficulty || 'Moderate') + '</b><span>Grade</span></div>' +
          '</div>' +
          '<div class="cover-foot">' +
            '<div class="dates"><i class="cal"></i>' + esc(dateRange) + '</div>' +
            '<div class="price">' + b.priceText + (b.fullPrice ? ' <s>' + b.fullPrice + '</s>' : '') + '<span>per person</span></div>' +
          '</div>' +
        '</div>' +
      '</section>';

    var glance = b.glance.map(function (g) {
      return '<div class="g"><div class="gv">' + esc(g.value) + '</div><div class="gl">' + esc(g.label) + '</div></div>';
    }).join('');

    var why = b.why.map(function (w) {
      return '<div class="wc"><div class="wi">' + w.icon + '</div><div><b>' + esc(w.title) + '</b><p>' + esc(w.text) + '</p></div></div>';
    }).join('');

    var diff = b.whatsDifferent.map(function (d) {
      return '<li><span class="tick">◆</span>' + esc(d) + '</li>';
    }).join('');

    var incl = b.included.map(function (x) {
      return '<li><span class="chk">✔</span>' + esc(x) + '</li>';
    }).join('');

    var details =
      '<section class="details">' +
        '<p class="hook">' + esc(b.hook) + '</p>' +
        '<h2><span class="bar"></span>At a Glance</h2>' +
        '<div class="glance">' + glance + '</div>' +
        '<h2><span class="bar"></span>Why Choose This Trek</h2>' +
        '<div class="why">' + why + '</div>' +
        '<div class="two">' +
          '<div class="panel diff"><h3>🌟 What Makes It Different</h3><ul class="diff-list">' + diff + '</ul></div>' +
          '<div class="panel incl"><h3>🎒 What\'s Included</h3><ul class="incl-list">' + incl + '</ul></div>' +
        '</div>' +
        (b.seatsLeft != null ? '<div class="urgency">🔥 Only <b>' + esc(b.seatsLeft) + ' seats</b> left on the next batch — reserve yours before they\'re gone.</div>' : '') +
        '<div class="cta">' +
          '<div><div class="cta-big">Ready to walk with the giants? 🏔️</div><div class="cta-sm">Book your ' + esc(t.name) + ' adventure with Summit Sage</div></div>' +
          '<div class="cta-c">📞 9051261182<br>📷 summitsaage_ · summitsage.in</div>' +
        '</div>' +
        '<div class="brofoot"><span>Summit Sage · Kolkata, India · <b>summitsage.in</b></span><span>copyright@soumikmondal723</span></div>' +
      '</section>';

    mount.innerHTML = cover + details;
    document.title = t.name + ' — Brochure | Summit Sage';
  };
})();
