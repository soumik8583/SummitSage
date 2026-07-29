'use strict';

/**
 * Summit Sage — Trek Detail page
 * Renders a full trek page from ?trek=<slug>: hero, live countdown & seats,
 * tabbed overview / itinerary / route+altitude / safety / reviews, an
 * auto-generated packing list, a route map, an altitude profile chart and a
 * registration form (emails + stores via /api/contact).
 */
(function () {
  const SS = window.SS || {};
  const root = document.getElementById('detailRoot');
  if (!root) return;

  const params = new URLSearchParams(location.search);
  const slug = params.get('trek') || (SS.treks && SS.treks[0] && SS.treks[0].slug);
  const t = SS.getTrek ? SS.getTrek(slug) : null;

  if (!t) {
    root.innerHTML =
      '<div class="page-hero"><div class="container center"><h1>Trek not found</h1><p class="muted">This trek may have wrapped up. Explore what’s coming next.</p><a href="/treks" class="btn btn-primary mt-2">Browse all treks</a></div></div>';
    return;
  }

  document.title = t.name + ' · Summit Sage';

  /* ---------- Altitude profile SVG ---------- */
  function altChart(data) {
    const W = 720, H = 240, pad = 34;
    const max = Math.max.apply(null, data) * 1.05;
    const min = Math.min.apply(null, data) * 0.9;
    const stepX = (W - pad * 2) / (data.length - 1);
    const y = function (v) {
      return H - pad - ((v - min) / (max - min)) * (H - pad * 2);
    };
    let line = '', area = '';
    data.forEach(function (v, i) {
      const px = pad + i * stepX;
      const py = y(v);
      line += (i ? 'L' : 'M') + px.toFixed(1) + ' ' + py.toFixed(1) + ' ';
      area += (i ? 'L' : 'M') + px.toFixed(1) + ' ' + py.toFixed(1) + ' ';
    });
    area += 'L' + (pad + (data.length - 1) * stepX).toFixed(1) + ' ' + (H - pad) + ' L' + pad + ' ' + (H - pad) + ' Z';
    const dots = data
      .map(function (v, i) {
        const px = pad + i * stepX;
        return '<circle cx="' + px.toFixed(1) + '" cy="' + y(v).toFixed(1) + '" r="3.5" fill="#E85D04"/><text x="' + px.toFixed(1) + '" y="' + (y(v) - 10).toFixed(1) + '" fill="#cdd9ec" font-size="10" text-anchor="middle">' + v + 'm</text>';
      })
      .join('');
    const labels = data
      .map(function (v, i) {
        const px = pad + i * stepX;
        return '<text x="' + px.toFixed(1) + '" y="' + (H - 10) + '" fill="#8ea1bd" font-size="10" text-anchor="middle">D' + (i + 1) + '</text>';
      })
      .join('');
    return (
      '<svg class="altitude-chart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet">' +
      '<defs><linearGradient id="altg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E85D04" stop-opacity=".5"/><stop offset="1" stop-color="#E85D04" stop-opacity="0"/></linearGradient></defs>' +
      '<path d="' + area + '" fill="url(#altg)"/>' +
      '<path d="' + line + '" fill="none" stroke="#E85D04" stroke-width="2.5"/>' +
      dots + labels +
      '</svg>'
    );
  }

  /* ---------- AI-style packing list ---------- */
  function packingList() {
    const base = ['45–55L backpack + rain cover', 'Trekking shoes (ankle support)', 'Refillable water bottles (2L)', '2 quick-dry T-shirts', 'Sunscreen SPF 50 & lip balm', 'Personal medical kit', 'Headlamp + spare batteries', 'Reusable cutlery & mug'];
    const cold = ['Insulated down jacket', 'Thermal base layers (2 sets)', 'Woollen cap, gloves & neck gaiter', 'Fleece / mid-layer', '4+ pairs woollen socks'];
    const warm = ['Sun hat & bandana', 'Light full-sleeve layers', 'Electrolyte sachets'];
    const rain = ['Waterproof jacket & pants', 'Dry bags for electronics', 'Extra quick-dry socks'];
    const high = ['Diamox (consult your doctor)', 'UV-protection sunglasses (cat. 3)', 'Trekking poles', 'Down mittens'];
    let list = base.slice();
    if (['Winter', 'Spring'].indexOf(t.season) > -1 || t.maxAltitude > 3500) list = list.concat(cold);
    else list = list.concat(warm);
    if (t.season === 'Monsoon') list = list.concat(rain);
    if (t.maxAltitude >= 4000) list = list.concat(high);
    return list;
  }

  /* ---------- Weather (illustrative, season-aware) ---------- */
  function weather() {
    const cold = t.season === 'Winter' || t.maxAltitude > 4000;
    const wet = t.season === 'Monsoon';
    const icons = wet
      ? ['fa-cloud-rain', 'fa-cloud-showers-heavy', 'fa-cloud', 'fa-cloud-sun-rain', 'fa-cloud-rain']
      : cold
      ? ['fa-snowflake', 'fa-cloud', 'fa-sun', 'fa-snowflake', 'fa-cloud-sun']
      : ['fa-sun', 'fa-cloud-sun', 'fa-sun', 'fa-cloud', 'fa-sun'];
    const hi = cold ? [-2, 1, 3, 0, 2] : wet ? [16, 15, 17, 14, 16] : [20, 22, 21, 19, 23];
    const lo = cold ? [-12, -10, -8, -11, -9] : wet ? [9, 8, 10, 7, 9] : [8, 9, 7, 6, 10];
    const days = ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5'];
    return (
      '<div class="weather">' +
      days.map(function (d, i) {
        return '<div class="day-w"><small>' + d + '</small><i class="fa-solid ' + icons[i] + '"></i><b>' + hi[i] + '°</b><small>' + lo[i] + '°</small></div>';
      }).join('') +
      '</div>' +
      '<p class="muted" style="font-size:.82rem;margin-top:10px"><i class="fa-solid fa-circle-info"></i> Indicative conditions for ' + t.base + '. Live forecasts are shared with your batch 72 hours before departure.</p>'
    );
  }

  /* ---------- Reviews for this trek ---------- */
  function reviews() {
    const list = (SS.testimonials || []).filter(function (r) {
      return r.trek.toLowerCase().indexOf(t.name.split(' ')[0].toLowerCase()) > -1;
    });
    const use = list.length ? list : (SS.testimonials || []).slice(0, 2);
    return use
      .map(function (r) {
        let s = '';
        for (let i = 1; i <= 5; i++) s += '<i class="fa-' + (i <= r.rating ? 'solid' : 'regular') + ' fa-star"></i>';
        return '<article class="review-card"><span class="stars">' + s + '</span><p class="quote">“' + r.quote + '”</p><div class="reviewer"><div class="avatar">' + r.initials + '</div><div><b>' + r.name + '</b><small>' + r.city + '</small></div></div></article>';
      })
      .join('');
  }

  /* ---------- Related ---------- */
  function related() {
    return (SS.treks || [])
      .filter(function (x) {
        return x.slug !== t.slug && (x.difficulty === t.difficulty || x.region === t.region);
      })
      .slice(0, 3)
      .map(SS.trekCard)
      .join('');
  }

  const hasEarly = t.earlyBird && t.earlyBird < t.price;
  const mapSrc = 'https://www.google.com/maps?q=' + t.coords.lat + ',' + t.coords.lng + '&z=9&output=embed';

  /* ---------- Build page ---------- */
  root.innerHTML =
    // HERO
    '<section class="page-hero" style="padding-bottom:40px">' +
    '<div class="media-frame" style="position:absolute;inset:0;z-index:-2;border-radius:0;aspect-ratio:auto;background-image:url(' + t.image + ')"></div>' +
    '<div style="position:absolute;inset:0;z-index:-1;background:linear-gradient(to top,var(--navy) 6%,rgba(10,22,40,.72) 55%,rgba(10,22,40,.55))"></div>' +
    '<div class="container" style="text-align:left">' +
    '<div class="breadcrumb"><a href="/">Home</a> / <a href="/treks">Treks</a> / ' + t.name + '</div>' +
    '<div class="flex gap-1 wrap items-center" style="margin-bottom:14px"><span class="badge ' + SS.diffClass(t.difficulty) + ' solid">' + t.difficulty + '</span>' +
    t.tags.map(function (tg) { return '<span class="tag">' + tg + '</span>'; }).join('') + '</div>' +
    '<h1 style="max-width:820px">' + t.name + '</h1>' +
    '<p class="lead" style="max-width:640px;margin-top:14px">' + t.blurb + '</p>' +
    '<div class="flex gap-2 wrap" style="margin-top:24px">' +
    fact('fa-location-dot', t.region, t.base + ' base') +
    fact('fa-clock', t.days + ' days', 'Duration') +
    fact('fa-mountain', t.maxAltitude + ' m', 'Max altitude') +
    fact('fa-route', t.distanceKm + ' km', 'Distance') +
    fact('fa-star', t.rating + ' / 5', t.reviews + ' reviews') +
    '</div></div></section>' +

    // BOOKING BAR
    '<section class="section-tight"><div class="container"><div class="card" style="display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:24px;align-items:center">' +
    '<div><div class="price" style="font-size:2rem">' + SS.fmtINR(hasEarly ? t.earlyBird : t.price) + (hasEarly ? ' <s>' + SS.fmtINR(t.price) + '</s>' : '') + '<small>' + (hasEarly ? 'Early-bird price · per person' : 'per person') + '</small></div>' +
    (hasEarly ? '<p class="muted" style="font-size:.85rem;margin-top:6px"><i class="fa-solid fa-bolt accent"></i> Early-bird ends soon — save ' + SS.fmtINR(t.price - t.earlyBird) + '</p>' : '') +
    '<p class="muted" style="font-size:.85rem"><i class="fa-solid fa-users accent"></i> Groups of 5+ get an extra discount · EMI available</p></div>' +
    '<div><small class="muted" style="font-weight:700;text-transform:uppercase;letter-spacing:.1em;font-size:.72rem">Next batch departs in</small>' +
    '<div class="countdown lg" data-deadline="' + t.startDate + '" style="margin-top:8px"><div class="unit"><b>00</b><span>days</span></div><div class="unit"><b>00</b><span>hrs</span></div><div class="unit"><b>00</b><span>min</span></div><div class="unit"><b>00</b><span>sec</span></div></div></div>' +
    '<div>' + seatMeter() + '<div class="flex gap-1" style="margin-top:14px"><a href="#register" class="btn btn-primary" style="flex:1">Register now</a>' +
    '<button class="btn btn-outline" data-fav="' + t.slug + '" aria-label="Save"><i class="fa-regular fa-heart"></i></button>' +
    '<button class="btn btn-outline" id="dlItinerary" title="Download offline itinerary"><i class="fa-solid fa-file-arrow-down"></i></button></div></div>' +
    '</div></div></section>' +

    // TABS
    '<section class="section-tight"><div class="container">' +
    '<div class="tabs" id="detailTabs">' +
    '<button class="active" data-tab="overview">Overview</button>' +
    '<button data-tab="itinerary">Itinerary</button>' +
    '<button data-tab="route">Route & Altitude</button>' +
    '<button data-tab="safety">Safety</button>' +
    '<button data-tab="reviews">Reviews</button>' +
    '</div>' +

    // Overview
    '<div class="tab-panel active" data-panel="overview"><div class="split" style="align-items:start">' +
    '<div><h2>Trip overview</h2><p class="mt-1">' + t.blurb + '</p>' +
    '<h3 style="margin:24px 0 12px">Highlights</h3><ul class="mt-1">' +
    t.highlights.map(function (h) { return '<li style="padding:7px 0;display:flex;gap:10px"><i class="fa-solid fa-circle-check accent" style="margin-top:5px"></i><span>' + h + '</span></li>'; }).join('') + '</ul>' +
    '<div class="grid cols-2 mt-2"><div class="card"><h3 style="font-size:1.05rem"><i class="fa-solid fa-circle-check accent"></i> What’s included</h3><ul class="mt-1">' +
    t.included.map(function (x) { return '<li style="padding:5px 0;color:var(--mist-dim)">• ' + x + '</li>'; }).join('') + '</ul></div>' +
    '<div class="card"><h3 style="font-size:1.05rem"><i class="fa-solid fa-circle-xmark" style="color:#ff5c6c"></i> Not included</h3><ul class="mt-1">' +
    t.excluded.map(function (x) { return '<li style="padding:5px 0;color:var(--mist-dim)">• ' + x + '</li>'; }).join('') + '</ul></div></div></div>' +
    '<div><div class="card"><h3 style="font-size:1.15rem"><i class="fa-solid fa-suitcase-rolling accent"></i> Smart packing list</h3>' +
    '<p class="muted" style="font-size:.85rem;margin:6px 0 14px">Auto-generated for this trek’s altitude & season.</p><ul>' +
    packingList().map(function (p) { return '<li style="padding:6px 0;border-top:1px solid var(--line);display:flex;gap:10px"><i class="fa-regular fa-square-check accent" style="margin-top:4px"></i><span style="font-size:.92rem">' + p + '</span></li>'; }).join('') + '</ul></div>' +
    '<div class="card mt-2"><h3 style="font-size:1.15rem"><i class="fa-solid fa-cloud-sun accent"></i> Weather outlook</h3><div class="mt-1">' + weather() + '</div></div></div>' +
    '</div></div>' +

    // Itinerary
    '<div class="tab-panel" data-panel="itinerary"><h2>Day-by-day itinerary</h2><div class="mt-2" id="accordion">' +
    t.itinerary.map(function (d, i) {
      return '<div class="acc-item' + (i === 0 ? ' open' : '') + '"><button class="acc-head"><span class="day">' + (i + 1) + '</span><span>' + d.title + '</span><i class="fa-solid fa-chevron-down chev"></i></button><div class="acc-body"' + (i === 0 ? ' style="max-height:200px"' : '') + '><div class="acc-body-inner">' + d.desc + '</div></div></div>';
    }).join('') +
    '</div><div class="center mt-2"><button class="btn btn-outline" id="dlItinerary2"><i class="fa-solid fa-file-arrow-down"></i> Download offline itinerary (PDF-ready)</button></div></div>' +

    // Route & Altitude
    '<div class="tab-panel" data-panel="route"><div class="split" style="align-items:start"><div><h2>Route map</h2><p class="muted mt-1">Interactive map centred on ' + t.base + '. The full GPX route is shared with confirmed trekkers.</p><div class="map-frame mt-2"><iframe src="' + mapSrc + '" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Trek route map"></iframe></div></div>' +
    '<div><h2>Altitude profile</h2><p class="muted mt-1">Peak elevation of <b style="color:#fff">' + t.maxAltitude + ' m</b> across ' + t.days + ' days.</p><div class="chart-wrap mt-2">' + altChart(t.altitude) + '</div></div></div></div>' +

    // Safety
    '<div class="tab-panel" data-panel="safety"><div class="split" style="align-items:start">' +
    '<div><h2>Safety & emergency</h2><ul class="mt-2">' +
    ['Certified & first-aid trained mountain leaders on every batch', 'Portable oxygen cylinders and a PAC bag on high-altitude treks', 'Daily health & oximeter checks above 3,000 m', 'Weather-based go/no-go decisions with full refund policy', 'Satellite phone / radio in no-network zones', '24×7 Kolkata control-room support during live treks'].map(function (s) { return '<li style="padding:8px 0;display:flex;gap:10px"><i class="fa-solid fa-shield-heart accent" style="margin-top:4px"></i><span>' + s + '</span></li>'; }).join('') + '</ul></div>' +
    '<div class="card"><h3><i class="fa-solid fa-phone-volume accent"></i> Emergency contacts</h3><div class="mt-1"><p style="padding:10px 0;border-top:1px solid var(--line)"><b style="color:#fff">Control Room (Kolkata)</b><br><span class="muted">+91 98300 12345 · 24×7</span></p><p style="padding:10px 0;border-top:1px solid var(--line)"><b style="color:#fff">Trek Leader</b><br><span class="muted">Shared with your batch before departure</span></p><p style="padding:10px 0;border-top:1px solid var(--line)"><b style="color:#fff">Nearest hospital</b><br><span class="muted">Mapped for every campsite</span></p></div>' +
    '<button class="btn btn-primary btn-block mt-1" id="sosBtn"><i class="fa-solid fa-tower-broadcast"></i> Demo SOS &amp; location share</button></div></div></div>' +

    // Reviews
    '<div class="tab-panel" data-panel="reviews"><div class="flex between items-center wrap gap-1"><h2>Trekker reviews</h2><div class="flex items-center gap-1"><span style="font-family:var(--font-display);font-size:2rem;color:#fff">' + t.rating + '</span><div><div class="stars"><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star-half-stroke"></i></div><small class="muted">' + t.reviews + ' verified reviews</small></div></div></div>' +
    '<div class="grid cols-2 mt-3">' + reviews() + '</div></div>' +
    '</div></section>' +

    // REGISTER
    '<section class="section snow-section" id="register"><div class="fog"></div><div class="container"><div class="split" style="align-items:start">' +
    '<div><span class="eyebrow"><i class="fa-solid fa-flag-checkered"></i> Reserve your spot</span><h2 class="mt-1">Register for ' + t.name + '</h2>' +
    '<p class="muted mt-1">Only <b style="color:#fff">' + t.seatsLeft + ' seats</b> left for the next batch. Fill this in and we’ll confirm on WhatsApp & email within hours.</p>' +
    '<div class="card mt-2"><div class="flex between items-center"><span class="muted">Trek</span><b style="color:#fff">' + t.name + '</b></div>' +
    '<div class="flex between items-center" style="margin-top:10px"><span class="muted">Price</span><b style="color:#fff">' + SS.fmtINR(hasEarly ? t.earlyBird : t.price) + ' / person</b></div>' +
    '<div class="flex between items-center" style="margin-top:10px"><span class="muted">Pay</span><span class="flex gap-1 wrap"><span class="tag"><i class="fa-solid fa-indian-rupee-sign"></i> UPI</span><span class="tag">Cards</span><span class="tag">EMI</span><span class="tag">Split</span></span></div></div></div>' +
    '<form class="card" data-form="registration" novalidate>' +
    '<input type="text" name="website" class="honey" tabindex="-1" autocomplete="off" aria-hidden="true">' +
    '<input type="hidden" name="subject" value="' + t.name + '">' +
    '<input type="hidden" name="trek" value="' + t.name + '">' +
    '<div class="form-row"><div class="form-group"><label>Full name <span class="req">*</span></label><input class="control" name="name" required></div>' +
    '<div class="form-group"><label>Email <span class="req">*</span></label><input class="control" type="email" name="email" required></div></div>' +
    '<div class="form-row"><div class="form-group"><label>WhatsApp number</label><input class="control" name="phone" placeholder="+91"></div>' +
    '<div class="form-group"><label>Number of people</label><input class="control" type="number" name="people" min="1" value="1"></div></div>' +
    '<div class="form-row"><div class="form-group"><label>City</label><input class="control" name="city" placeholder="Kolkata"></div>' +
    '<div class="form-group"><label>T-shirt size</label><select class="control" name="tShirtSize"><option>S</option><option selected>M</option><option>L</option><option>XL</option><option>XXL</option></select></div></div>' +
    '<div class="form-group"><label>Emergency contact</label><input class="control" name="emergencyContact" placeholder="Name & phone"></div>' +
    '<div class="form-group"><label>Anything we should know?</label><textarea class="control" name="message" rows="3" placeholder="Fitness, dietary needs, questions…"></textarea></div>' +
    '<button class="btn btn-primary btn-block btn-lg" type="submit"><i class="fa-solid fa-mountain-sun"></i> Confirm my spot</button>' +
    '<div class="wa-alt"><div class="wa-or">or register instantly</div>' +
    '<a class="btn btn-whatsapp btn-block" data-wa="Hi Summit Sage! I\'d like to register for the ' + t.name + ' trek."><i class="fa-brands fa-whatsapp"></i> Register via WhatsApp</a></div>' +
    '<p class="muted center" style="font-size:.8rem;margin-top:12px">You’ll get a scratch-card reward on registration 🎁</p>' +
    '</form></div></div></section>' +

    // RELATED
    '<section class="section-tight"><div class="container"><div class="section-head left"><span class="eyebrow"><i class="fa-solid fa-layer-group"></i> You may also like</span><h2 class="mt-1">Similar treks</h2></div><div class="grid cols-3" id="relatedGrid">' + related() + '</div></div></section>';

  function fact(icon, big, small) {
    return '<div><i class="fa-solid ' + icon + ' accent"></i> <b style="color:#fff;font-family:var(--font-display);font-size:1.1rem">' + big + '</b><br><small class="muted">' + small + '</small></div>';
  }
  function seatMeter() {
    const booked = Math.round(((t.totalSeats - t.seatsLeft) / t.totalSeats) * 100);
    return '<div class="seat"><div class="seat-info" style="margin-bottom:6px"><span class="muted">Seats filling</span><span><b style="color:#fff">' + t.seatsLeft + '</b> of ' + t.totalSeats + ' left</span></div><div class="seat-bar"><span style="width:' + booked + '%"></span></div></div>';
  }

  /* ---------- Wire interactions ---------- */
  // Tabs
  root.querySelectorAll('#detailTabs button').forEach(function (b) {
    b.addEventListener('click', function () {
      root.querySelectorAll('#detailTabs button').forEach(function (x) { x.classList.remove('active'); });
      root.querySelectorAll('.tab-panel').forEach(function (p) { p.classList.remove('active'); });
      b.classList.add('active');
      root.querySelector('[data-panel="' + b.getAttribute('data-tab') + '"]').classList.add('active');
    });
  });
  // Accordion
  root.querySelectorAll('.acc-head').forEach(function (h) {
    h.addEventListener('click', function () {
      const item = h.parentElement;
      const body = item.querySelector('.acc-body');
      const open = item.classList.toggle('open');
      body.style.maxHeight = open ? body.scrollHeight + 40 + 'px' : '0';
    });
  });
  // Download itinerary (offline HTML, PDF-ready via print)
  function downloadItinerary() {
    const html =
      '<!doctype html><html><head><meta charset="utf-8"><title>' + t.name + ' — Summit Sage Itinerary</title>' +
      '<style>body{font-family:Georgia,serif;max-width:720px;margin:40px auto;padding:0 24px;color:#0A1628;line-height:1.6}h1{color:#0A1628}h2{color:#E85D04;margin-top:24px}.tag{display:inline-block;background:#f3f0eb;padding:4px 10px;border-radius:6px;margin:2px;font-size:13px}hr{border:none;border-top:1px solid #ddd;margin:20px 0}</style></head><body>' +
      '<h1>' + t.name + '</h1><p><b>' + t.region + '</b> · ' + t.days + ' days · Max ' + t.maxAltitude + ' m · ' + t.difficulty + '</p>' +
      '<p>' + t.blurb + '</p><hr><h2>Day-by-day</h2>' +
      t.itinerary.map(function (d, i) { return '<p><b>Day ' + (i + 1) + ': ' + d.title + '</b><br>' + d.desc + '</p>'; }).join('') +
      '<hr><h2>What to pack</h2><p>' + packingList().map(function (p) { return '• ' + p; }).join('<br>') + '</p>' +
      '<hr><h2>Included</h2><p>' + t.included.join(', ') + '</p><h2>Emergency</h2><p>Summit Sage Control Room (Kolkata): +91 98300 12345 · 24×7</p>' +
      '<hr><p style="color:#888">Generated from summitsage.in — carry this offline for no-signal zones.</p>' +
      '<script>window.onload=function(){setTimeout(function(){window.print()},400)}<\/script></body></html>';
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = t.slug + '-itinerary.html';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  ['dlItinerary', 'dlItinerary2'].forEach(function (id) {
    const b = document.getElementById(id);
    if (b) b.addEventListener('click', downloadItinerary);
  });
  // SOS demo
  const sos = document.getElementById('sosBtn');
  if (sos) sos.addEventListener('click', function () {
    if (navigator.geolocation) {
      sos.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Getting location…';
      navigator.geolocation.getCurrentPosition(
        function (pos) {
          alert('Demo SOS ready ✅\nYour location: ' + pos.coords.latitude.toFixed(4) + ', ' + pos.coords.longitude.toFixed(4) + '\nIn a live trek this instantly alerts the Summit Sage control room with your coordinates.');
          sos.innerHTML = '<i class="fa-solid fa-tower-broadcast"></i> Demo SOS &amp; location share';
        },
        function () {
          alert('Demo SOS ✅ In a live trek this shares your location with our control room. (Location permission was denied for this demo.)');
          sos.innerHTML = '<i class="fa-solid fa-tower-broadcast"></i> Demo SOS &amp; location share';
        }
      );
    } else {
      alert('Demo SOS ✅ In a live trek this shares your location with our control room.');
    }
  });

  // Wire shared behaviours on the freshly-injected DOM.
  if (SS.wireCards) SS.wireCards(root);
  if (SS.wireForms) SS.wireForms(root);
  if (SS.wireWA) SS.wireWA(root);
  if (SS.startCountdowns) SS.startCountdowns();
  if (window.SummitEffects) {
    window.SummitEffects.initReveal();
    window.SummitEffects.initTilt();
  }
})();
