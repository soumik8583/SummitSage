'use strict';

/**
 * Summit Sage — Trek catalogue (dummy content, easy to edit).
 * Exposed as window.SS.treks with a few helpers. Replace image URLs, prices,
 * dates and copy anytime — the whole site renders from this one file.
 *
 * Image URLs point to Unsplash (royalty-free). Each card has a gradient
 * fallback, so the layout stays premium even if an image fails to load.
 */
(function () {
  const IMG = function (id, w) {
    return (
      'https://images.unsplash.com/photo-' +
      id +
      '?auto=format&fit=crop&w=' +
      (w || 1200) +
      '&q=70'
    );
  };

  // Helper to build a future ISO date (days from today).
  const inDays = function (d) {
    const t = new Date();
    t.setDate(t.getDate() + d);
    t.setHours(6, 0, 0, 0);
    return t.toISOString();
  };

  const treks = [
    {
      slug: 'kedarkantha',
      name: 'Kedarkantha Summit',
      region: 'Uttarakhand',
      base: 'Sankri',
      difficulty: 'Moderate',
      seasons: ['Winter', 'Spring'],
      season: 'Winter',
      days: 6,
      distanceKm: 20,
      maxAltitude: 3810,
      price: 9500,
      earlyBird: 8100,
      earlyBirdEnds: inDays(24),
      startDate: inDays(58),
      totalSeats: 24,
      seatsLeft: 6,
      rating: 4.9,
      reviews: 214,
      fitness: 3,
      budgetTier: '5-10k',
      image: IMG('1516571748831-5d81767b788d'),
      tags: ['Snow trek', 'Summit', 'Beginner-friendly'],
      blurb:
        "India's most-loved winter summit — pristine snow, pine forests and a 360° Himalayan sunrise from the top.",
      highlights: [
        'Classic snow summit climb',
        'Camp beside frozen meadows',
        'Sunrise over Swargarohini range',
        'Perfect first Himalayan summit',
      ],
      coords: { lat: 31.0246, lng: 78.1636 },
      itinerary: [
        { title: 'Dehradun → Sankri', desc: 'Scenic 10-hour drive through the Tons valley to base camp (1,920 m).' },
        { title: 'Sankri → Juda ka Talab', desc: 'Trek through oak & pine forest to the frozen lake campsite (2,700 m).' },
        { title: 'Juda ka Talab → Kedarkantha Base', desc: 'Ascend open meadows with sweeping Himalayan views (3,400 m).' },
        { title: 'Summit Day', desc: 'Pre-dawn push to the 3,810 m summit for sunrise, then descend to Hargaon.' },
        { title: 'Hargaon → Sankri', desc: 'Gentle forest descent back to base camp.' },
        { title: 'Sankri → Dehradun', desc: 'Return drive with a certificate & celebration lunch.' },
      ],
      altitude: [1920, 2700, 3400, 3810, 2600, 1920],
      included: ['Certified mountain guides', 'All meals on trek', 'Camping & sleeping gear', 'Forest permits', 'First-aid & oxygen'],
      excluded: ['Transport to Dehradun', 'Personal gear', 'Insurance', 'Anything not listed'],
    },
    {
      slug: 'sandakphu-phalut',
      name: 'Sandakphu – Phalut Ridge',
      region: 'West Bengal',
      base: 'Maneybhanjang',
      difficulty: 'Moderate',
      seasons: ['Autumn', 'Spring'],
      season: 'Autumn',
      days: 5,
      distanceKm: 47,
      maxAltitude: 3636,
      price: 11500,
      earlyBird: 9900,
      earlyBirdEnds: inDays(18),
      startDate: inDays(40),
      totalSeats: 20,
      seatsLeft: 9,
      rating: 4.8,
      reviews: 176,
      fitness: 3,
      budgetTier: '10k+',
      image: IMG('1626621341517-bbf3d9990a23'),
      tags: ['Sleeping Buddha', 'Kolkata favourite', 'Ridge walk'],
      blurb:
        "Bengal's own Himalayan classic — walk the ridge with four of the five tallest peaks on Earth on the horizon.",
      highlights: [
        'View Everest & Kanchenjunga together',
        'The famous "Sleeping Buddha" skyline',
        'Highest point in West Bengal',
        'Rhododendron forests in spring',
      ],
      coords: { lat: 27.1051, lng: 88.0002 },
      itinerary: [
        { title: 'NJP → Maneybhanjang', desc: 'Drive to the trailhead town on the India–Nepal border (1,928 m).' },
        { title: 'Maneybhanjang → Tumling', desc: 'Climb through Singalila forest to Tumling (2,970 m).' },
        { title: 'Tumling → Sandakphu', desc: 'Reach the highest point in West Bengal (3,636 m) for the Sleeping Buddha view.' },
        { title: 'Sandakphu → Phalut → Gorkhey', desc: 'Long ridge walk facing Kanchenjunga, descend to a river hamlet.' },
        { title: 'Gorkhey → Sepi → NJP', desc: 'Final descent and return drive.' },
      ],
      altitude: [1928, 2970, 3636, 3600, 2100],
      included: ['Guides & permits', 'Trekkers hut / homestay stays', 'All meals on trek', 'Local transport', 'Medical kit'],
      excluded: ['Train/flight to NJP', 'Personal expenses', 'Insurance'],
    },
    {
      slug: 'goecha-la',
      name: 'Goecha La Expedition',
      region: 'Sikkim',
      base: 'Yuksom',
      difficulty: 'Challenging',
      seasons: ['Autumn', 'Spring'],
      season: 'Autumn',
      days: 9,
      distanceKm: 90,
      maxAltitude: 4940,
      price: 18500,
      earlyBird: 16500,
      earlyBirdEnds: inDays(30),
      startDate: inDays(74),
      totalSeats: 16,
      seatsLeft: 4,
      rating: 4.9,
      reviews: 98,
      fitness: 5,
      budgetTier: '10k+',
      image: IMG('1486911278844-a81c5267e227'),
      tags: ['Kanchenjunga', 'High altitude', 'Expedition'],
      blurb:
        'Stand almost close enough to touch Kanchenjunga — a demanding, unforgettable journey to the base of the third-highest peak on Earth.',
      highlights: [
        'Face-to-face with Kanchenjunga (8,586 m)',
        'Samiti Lake reflections at dawn',
        'Remote Sikkim wilderness',
        'True high-altitude expedition',
      ],
      coords: { lat: 27.3585, lng: 88.2196 },
      itinerary: [
        { title: 'NJP → Yuksom', desc: 'Drive to the historic first capital of Sikkim (1,780 m).' },
        { title: 'Yuksom → Sachen', desc: 'Enter Kanchenjunga National Park through dense forest.' },
        { title: 'Sachen → Tshoka', desc: 'Cross the Prek Chu and climb to Tshoka village.' },
        { title: 'Tshoka → Dzongri', desc: 'Steep ascent to the Dzongri meadows (4,020 m).' },
        { title: 'Dzongri Top & acclimatise', desc: 'Sunrise viewpoint over the entire range.' },
        { title: 'Dzongri → Thansing', desc: 'Descend and traverse to Thansing valley.' },
        { title: 'Thansing → Lamuney → Goecha La View I', desc: 'Summit push to 4,940 m for the Kanchenjunga sunrise.' },
        { title: 'Return to Tshoka', desc: 'Long descent through the valley.' },
        { title: 'Tshoka → Yuksom → NJP', desc: 'Final descent and return.' },
      ],
      altitude: [1780, 2200, 3050, 4020, 4200, 3930, 4940, 3050, 1780],
      included: ['Expedition leader & Sherpa support', 'National park permits', 'All camping & meals', 'Oxygen & PAC bag', 'Porters/yaks for gear'],
      excluded: ['Travel to NJP', 'Personal gear', 'Insurance (mandatory)', 'Emergency evacuation'],
    },
    {
      slug: 'valley-of-flowers',
      name: 'Valley of Flowers',
      region: 'Uttarakhand',
      base: 'Govindghat',
      difficulty: 'Easy',
      seasons: ['Monsoon', 'Summer'],
      season: 'Monsoon',
      days: 6,
      distanceKm: 37,
      maxAltitude: 3858,
      price: 12000,
      earlyBird: 10500,
      earlyBirdEnds: inDays(12),
      startDate: inDays(33),
      totalSeats: 22,
      seatsLeft: 11,
      rating: 4.7,
      reviews: 141,
      fitness: 2,
      budgetTier: '10k+',
      image: IMG('1464822759023-fed622ff2c3b'),
      tags: ['UNESCO site', 'Wildflowers', 'Easy'],
      blurb:
        'A UNESCO World Heritage valley that erupts into a carpet of 300+ wildflower species every monsoon.',
      highlights: [
        'UNESCO World Heritage Site',
        '300+ alpine flower species',
        'Visit Hemkund Sahib (4,300 m)',
        'Beginner-friendly Himalayan trek',
      ],
      coords: { lat: 30.7283, lng: 79.6045 },
      itinerary: [
        { title: 'Rishikesh → Govindghat', desc: 'Drive along the Alaknanda river to base (1,800 m).' },
        { title: 'Govindghat → Ghangaria', desc: 'Trek to the last village before the valley (3,050 m).' },
        { title: 'Valley of Flowers day-trek', desc: 'Explore the blooming valley and return to Ghangaria.' },
        { title: 'Hemkund Sahib', desc: 'Optional climb to the glacial lake & gurudwara (4,300 m).' },
        { title: 'Ghangaria → Govindghat', desc: 'Descend to base camp.' },
        { title: 'Govindghat → Rishikesh', desc: 'Return drive.' },
      ],
      altitude: [1800, 3050, 3858, 4300, 3050, 1800],
      included: ['Guides & permits', 'Hotel/guesthouse stays', 'All meals on trek', 'Transport from Rishikesh', 'First-aid'],
      excluded: ['Travel to Rishikesh', 'Hemkund pony', 'Personal expenses'],
    },
    {
      slug: 'roopkund',
      name: 'Roopkund Mystery Lake',
      region: 'Uttarakhand',
      base: 'Lohajung',
      difficulty: 'Challenging',
      seasons: ['Summer', 'Autumn'],
      season: 'Summer',
      days: 8,
      distanceKm: 53,
      maxAltitude: 5029,
      price: 14500,
      earlyBird: 12900,
      earlyBirdEnds: inDays(20),
      startDate: inDays(66),
      totalSeats: 18,
      seatsLeft: 7,
      rating: 4.8,
      reviews: 120,
      fitness: 5,
      budgetTier: '10k+',
      image: IMG('1454496522488-7a8e488e8606'),
      tags: ['Skeleton lake', 'High altitude', 'Bugyals'],
      blurb:
        'Trek across the vast Ali & Bedni Bugyal meadows to the mysterious skeleton lake at 5,029 m.',
      highlights: [
        "India's most beautiful high-altitude meadows",
        'The mysterious skeleton lake',
        'Views of Trishul & Nanda Ghunti',
        'Big-altitude challenge',
      ],
      coords: { lat: 30.2622, lng: 79.7318 },
      itinerary: [
        { title: 'Kathgodam → Lohajung', desc: 'Long drive to the base village (2,350 m).' },
        { title: 'Lohajung → Didna', desc: 'Descend and climb to Didna village.' },
        { title: 'Didna → Ali Bugyal', desc: 'Enter the giant alpine meadows (3,400 m).' },
        { title: 'Ali → Bedni Bugyal → Patar Nachauni', desc: 'Traverse rolling grasslands.' },
        { title: 'Patar Nachauni → Bhagwabasa', desc: 'Climb towards the summit camp (4,100 m).' },
        { title: 'Summit — Roopkund & Junargali', desc: 'Reach the skeleton lake (5,029 m), return to Patar Nachauni.' },
        { title: 'Descend to Didna', desc: 'Long descent through the meadows.' },
        { title: 'Didna → Lohajung → Kathgodam', desc: 'Final descent and return.' },
      ],
      altitude: [2350, 2450, 3400, 3600, 4100, 5029, 2450, 2350],
      included: ['Certified high-altitude guides', 'All camping & meals', 'Oxygen & first-aid', 'Forest permits', 'Mules for common load'],
      excluded: ['Travel to Kathgodam', 'Personal gear', 'Insurance (mandatory)'],
    },
    {
      slug: 'brahmatal',
      name: 'Brahmatal Winter Trek',
      region: 'Uttarakhand',
      base: 'Lohajung',
      difficulty: 'Moderate',
      seasons: ['Winter'],
      season: 'Winter',
      days: 6,
      distanceKm: 24,
      maxAltitude: 3734,
      price: 10500,
      earlyBird: 8900,
      earlyBirdEnds: inDays(15),
      startDate: inDays(50),
      totalSeats: 24,
      seatsLeft: 13,
      rating: 4.7,
      reviews: 103,
      fitness: 3,
      budgetTier: '10k+',
      image: IMG('1483728642387-6c3bdd6c93e5'),
      tags: ['Frozen lake', 'Snow trek', 'Ridge camp'],
      blurb:
        'A snow-laden winter classic with a frozen alpine lake and jaw-dropping views of Mt. Trishul and Nanda Ghunti.',
      highlights: [
        'Frozen Brahmatal lake',
        'Grand views of Trishul massif',
        'Golden oak & rhododendron forest',
        'Reliable winter snow',
      ],
      coords: { lat: 30.19, lng: 79.56 },
      itinerary: [
        { title: 'Kathgodam → Lohajung', desc: 'Drive to base village (2,350 m).' },
        { title: 'Lohajung → Bekaltal', desc: 'Forest trail to a serene lake camp (3,150 m).' },
        { title: 'Bekaltal → Brahmatal', desc: 'Climb to the ridge camp near the frozen lake (3,200 m).' },
        { title: 'Summit ridge & Brahmatal lake', desc: 'Reach 3,734 m for panoramic views, return to camp.' },
        { title: 'Brahmatal → Lohajung', desc: 'Descend through snow forest.' },
        { title: 'Lohajung → Kathgodam', desc: 'Return drive.' },
      ],
      altitude: [2350, 3150, 3200, 3734, 2600, 2350],
      included: ['Guides & permits', 'Camping & meals', 'Micro-spikes & gaiters', 'First-aid & oxygen'],
      excluded: ['Travel to Kathgodam', 'Personal gear', 'Insurance'],
    },
    {
      slug: 'ajodhya-hills',
      name: 'Ajodhya Hills Weekend',
      region: 'West Bengal',
      base: 'Purulia',
      difficulty: 'Easy',
      seasons: ['Winter', 'Autumn', 'Spring'],
      season: 'Winter',
      days: 2,
      distanceKm: 14,
      maxAltitude: 700,
      price: 3500,
      earlyBird: 2999,
      earlyBirdEnds: inDays(8),
      startDate: inDays(21),
      totalSeats: 30,
      seatsLeft: 17,
      rating: 4.6,
      reviews: 240,
      fitness: 1,
      budgetTier: 'under5k',
      image: IMG('1441974231531-c6227db76b6e'),
      tags: ['Weekend', 'Near Kolkata', 'Beginner'],
      blurb:
        'The perfect first trek — a relaxed weekend in Purulia’s Ajodhya Hills, just a night’s journey from Kolkata.',
      highlights: [
        'Ideal for absolute first-timers',
        'Overnight from Kolkata',
        'Bamni & Turga waterfalls',
        'Bonfire & community night',
      ],
      coords: { lat: 23.35, lng: 86.15 },
      itinerary: [
        { title: 'Kolkata → Ajodhya Hilltop', desc: 'Overnight train/drive, easy trek to viewpoints and waterfalls, bonfire night.' },
        { title: 'Sunrise & return', desc: 'Sunrise point, Bamni falls, and return to Kolkata by evening.' },
      ],
      altitude: [300, 700, 500, 300],
      included: ['Trek leader', 'Homestay/camp stay', 'Meals on trek', 'Local transport', 'Bonfire'],
      excluded: ['Kolkata transport', 'Personal expenses'],
    },
    {
      slug: 'har-ki-dun',
      name: 'Har Ki Dun Valley',
      region: 'Uttarakhand',
      base: 'Sankri',
      difficulty: 'Moderate',
      seasons: ['Spring', 'Autumn'],
      season: 'Spring',
      days: 7,
      distanceKm: 47,
      maxAltitude: 3566,
      price: 12500,
      earlyBird: 10900,
      earlyBirdEnds: inDays(26),
      startDate: inDays(62),
      totalSeats: 20,
      seatsLeft: 10,
      rating: 4.8,
      reviews: 87,
      fitness: 3,
      budgetTier: '10k+',
      image: IMG('1506905925346-21bda4d32df4'),
      tags: ["Valley of Gods", 'Ancient villages', 'Wildflowers'],
      blurb:
        'The cradle-shaped "Valley of Gods" — ancient Himalayan villages, the Swargarohini peaks and blooming meadows.',
      highlights: [
        '3,000-year-old villages',
        'Swargarohini peak views',
        'Riverside forest trails',
        'Rich local culture',
      ],
      coords: { lat: 31.11, lng: 78.41 },
      itinerary: [
        { title: 'Dehradun → Sankri', desc: 'Drive to base village (1,920 m).' },
        { title: 'Sankri → Taluka → Cheludgad', desc: 'Riverside forest trek.' },
        { title: 'Cheludgad → Osla / Seema', desc: 'Reach the ancient village (2,560 m).' },
        { title: 'Osla → Har Ki Dun', desc: 'Enter the Valley of Gods (3,566 m).' },
        { title: 'Explore & descend to Osla', desc: 'Optional Jaundhar glacier viewpoint.' },
        { title: 'Osla → Taluka', desc: 'Descend through forest.' },
        { title: 'Taluka → Sankri → Dehradun', desc: 'Return.' },
      ],
      altitude: [1920, 2100, 2560, 3566, 2560, 2100, 1920],
      included: ['Guides & permits', 'Camping & homestays', 'All meals on trek', 'First-aid'],
      excluded: ['Travel to Dehradun', 'Personal gear', 'Insurance'],
    },
    {
      slug: 'chadar-frozen-river',
      name: 'Chadar Frozen River',
      region: 'Ladakh',
      base: 'Leh',
      difficulty: 'Extreme',
      seasons: ['Winter'],
      season: 'Winter',
      days: 9,
      distanceKm: 62,
      maxAltitude: 3390,
      price: 22500,
      earlyBird: 19900,
      earlyBirdEnds: inDays(34),
      startDate: inDays(120),
      totalSeats: 14,
      seatsLeft: 3,
      rating: 4.9,
      reviews: 64,
      fitness: 5,
      budgetTier: '10k+',
      image: IMG('1548134600-af0dd7f43de5'),
      tags: ['Frozen river', 'Extreme', 'Bucket-list'],
      blurb:
        'Walk on the frozen Zanskar river at -25°C — one of the most extreme and iconic winter treks on the planet.',
      highlights: [
        'Walk a frozen river of ice',
        'Temperatures to -25°C',
        'Sleep in riverside caves',
        'A true bucket-list expedition',
      ],
      coords: { lat: 34.1526, lng: 77.577 },
      itinerary: [
        { title: 'Arrive Leh — acclimatise', desc: 'Rest at 3,500 m; mandatory medical check.' },
        { title: 'Acclimatisation day', desc: 'Local sightseeing to adjust to altitude.' },
        { title: 'Leh → Shingra Koma', desc: 'Drive to the river and first steps on the Chadar.' },
        { title: 'Shingra Koma → Tibb Cave', desc: 'Walk the ice sheet to a cave camp.' },
        { title: 'Tibb → Nerak', desc: 'Reach the frozen Nerak waterfall.' },
        { title: 'Nerak → Tibb', desc: 'Return leg on changing ice.' },
        { title: 'Tibb → Shingra Koma → Leh', desc: 'Complete the ice walk and drive back.' },
        { title: 'Buffer / rest day', desc: 'Weather buffer in Leh.' },
        { title: 'Depart Leh', desc: 'Fly out with a certificate.' },
      ],
      altitude: [3500, 3500, 3390, 3300, 3390, 3300, 3390, 3500, 3500],
      included: ['Expedition leader & local Zanskari guides', 'All camping & meals', 'Special sub-zero gear', 'Oxygen & medical', 'Leh transfers'],
      excluded: ['Flights to Leh', 'Wildlife/permits fees', 'Insurance (mandatory)'],
    },
  ];

  function fmtINR(n) {
    return '₹' + Number(n).toLocaleString('en-IN');
  }
  function diffClass(d) {
    return String(d || '').toLowerCase();
  }
  function get(slug) {
    return treks.filter(function (t) {
      return t.slug === slug;
    })[0];
  }

  window.SS = window.SS || {};
  window.SS.treks = treks;
  window.SS.fmtINR = fmtINR;
  window.SS.diffClass = diffClass;
  window.SS.getTrek = get;

  // ── Admin-managed treks (from the database) ────────────────────────────────
  // Normalise a DB row into the card/detail shape the site renders from.
  function normalizeDbTrek(d) {
    const price = Number(d.price) || 0;
    const early = d.early_bird != null && d.early_bird !== '' ? Number(d.early_bird) : null;
    const totalSeats = Number(d.total_seats) || 20;
    const listOf = function (v, sep) {
      if (!v) return [];
      return String(v).split(sep).map(function (s) { return s.trim(); }).filter(Boolean);
    };
    return {
      slug: d.slug,
      name: d.name,
      region: d.region || 'Himalaya',
      base: d.base || '',
      difficulty: d.difficulty || 'Moderate',
      seasons: d.season ? [d.season] : ['All'],
      season: d.season || 'All',
      days: Number(d.days) || 1,
      distanceKm: Number(d.distance_km) || 0,
      maxAltitude: Number(d.max_altitude) || 0,
      price: price,
      earlyBird: early && early < price ? early : price,
      earlyBirdEnds: d.start_date || null,
      startDate: d.start_date || inDays(30),
      totalSeats: totalSeats,
      seatsLeft: d.seats_left != null && d.seats_left !== '' ? Number(d.seats_left) : totalSeats,
      rating: Number(d.rating) || 4.8,
      reviews: 0,
      fitness: 3,
      budgetTier: price < 5000 ? 'budget' : price <= 10000 ? '5-10k' : '10k-plus',
      image: d.image || IMG('1516571748831-5d81767b788d'),
      tags: listOf(d.tags, ','),
      blurb: d.blurb || d.description || 'A Summit Sage guided adventure.',
      highlights: listOf(d.highlights, '\n'),
      coords: { lat: 0, lng: 0 },
      itinerary: [],
      altitude: [],
      included: [],
      excluded: [],
      _fromDb: true,
    };
  }

  // Fetch admin-managed treks once and merge them into the catalogue (newest
  // first). Cached so repeated calls across pages only hit the network once.
  let dbTreksPromise = null;
  window.SS.loadDbTreks = function () {
    if (dbTreksPromise) return dbTreksPromise;
    dbTreksPromise = fetch('/api/treks')
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res && res.ok && Array.isArray(res.data)) {
          const have = {};
          treks.forEach(function (t) { have[t.slug] = true; });
          for (let i = res.data.length - 1; i >= 0; i--) {
            const nt = normalizeDbTrek(res.data[i]);
            if (nt.slug && !have[nt.slug]) {
              treks.unshift(nt);
              have[nt.slug] = true;
            }
          }
        }
      })
      .catch(function () {});
    return dbTreksPromise;
  };
})();
