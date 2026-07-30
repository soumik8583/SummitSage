'use strict';

/**
 * Summit Sage — "Find Your Trek" quiz
 * A multi-step quiz that scores every trek in SS.treks against the user's
 * answers (fitness, budget, experience, season, duration, vibe) and renders
 * the best matches as live trek cards.
 */
(function () {
  const SS = window.SS || {};
  const mount = document.getElementById('quizMount');
  if (!mount || !SS.treks) return;

  const STEPS = [
    {
      key: 'fitness',
      q: 'How would you rate your fitness?',
      sub: 'Be honest — we’ll match the gradient to you.',
      icon: 'fa-heart-pulse',
      opts: [
        { label: 'Just starting out', val: 1, icon: 'fa-seedling' },
        { label: 'I walk / jog sometimes', val: 2, icon: 'fa-person-walking' },
        { label: 'Fairly active', val: 3, icon: 'fa-person-hiking' },
        { label: 'Gym rat / runner', val: 4, icon: 'fa-dumbbell' },
        { label: 'Endurance beast', val: 5, icon: 'fa-fire' }
      ]
    },
    {
      key: 'experience',
      q: 'How much trekking have you done?',
      sub: 'Your Himalayan mileage so far.',
      icon: 'fa-mountain-sun',
      opts: [
        { label: 'This is my first', val: 1, icon: 'fa-star' },
        { label: '1–2 easy treks', val: 2, icon: 'fa-shoe-prints' },
        { label: 'A few moderate ones', val: 3, icon: 'fa-route' },
        { label: 'Seasoned trekker', val: 4, icon: 'fa-medal' }
      ]
    },
    {
      key: 'budget',
      q: 'What’s your budget per person?',
      sub: 'All-inclusive from base camp.',
      icon: 'fa-wallet',
      opts: [
        { label: 'Under ₹5,000', val: 'under5k', icon: 'fa-piggy-bank' },
        { label: '₹5,000 – ₹10,000', val: '5-10k', icon: 'fa-coins' },
        { label: '₹10,000+', val: '10k+', icon: 'fa-gem' },
        { label: 'Flexible', val: 'any', icon: 'fa-infinity' }
      ]
    },
    {
      key: 'season',
      q: 'When do you want to go?',
      sub: 'Pick your season.',
      icon: 'fa-calendar-days',
      opts: [
        { label: 'Winter snow', val: 'Winter', icon: 'fa-snowflake' },
        { label: 'Spring blooms', val: 'Spring', icon: 'fa-fan' },
        { label: 'Summer', val: 'Summer', icon: 'fa-sun' },
        { label: 'Monsoon green', val: 'Monsoon', icon: 'fa-cloud-rain' },
        { label: 'Autumn clarity', val: 'Autumn', icon: 'fa-leaf' },
        { label: 'Any time', val: 'any', icon: 'fa-infinity' }
      ]
    },
    {
      key: 'days',
      q: 'How many days can you spare?',
      sub: 'Including travel buffer.',
      icon: 'fa-clock',
      opts: [
        { label: '2–4 days', val: 4, icon: 'fa-hourglass-start' },
        { label: '5–6 days', val: 6, icon: 'fa-hourglass-half' },
        { label: '7+ days', val: 9, icon: 'fa-hourglass-end' }
      ]
    },
    {
      key: 'vibe',
      q: 'What are you chasing?',
      sub: 'The feeling you want most.',
      icon: 'fa-compass',
      opts: [
        { label: 'Epic summit views', val: 'summit', icon: 'fa-mountain' },
        { label: 'Flowers & meadows', val: 'nature', icon: 'fa-spa' },
        { label: 'Adrenaline & challenge', val: 'thrill', icon: 'fa-bolt' },
        { label: 'A gentle escape', val: 'chill', icon: 'fa-mug-hot' }
      ]
    }
  ];

  const answers = {};
  let step = 0;

  function render() {
    if (step >= STEPS.length) return renderResults();
    const s = STEPS[step];
    const pct = Math.round((step / STEPS.length) * 100);
    mount.innerHTML =
      '<div class="quiz-card" data-reveal>' +
      '<div class="quiz-progress"><span style="width:' + pct + '%"></span></div>' +
      '<div class="quiz-meta"><span class="muted">Question ' + (step + 1) + ' of ' + STEPS.length + '</span>' +
      (step > 0 ? '<button class="link-btn" id="quizBack"><i class="fa-solid fa-arrow-left"></i> Back</button>' : '<span></span>') + '</div>' +
      '<div class="quiz-step active"><div class="quiz-icon"><i class="fa-solid ' + s.icon + '"></i></div>' +
      '<h2>' + s.q + '</h2><p class="muted">' + s.sub + '</p>' +
      '<div class="quiz-options">' +
      s.opts.map(function (o) {
        return '<button class="quiz-opt" data-val="' + o.val + '"><i class="fa-solid ' + o.icon + '"></i><b>' + o.label + '</b></button>';
      }).join('') +
      '</div></div></div>';

    mount.querySelectorAll('.quiz-opt').forEach(function (b) {
      b.addEventListener('click', function () {
        answers[s.key] = b.getAttribute('data-val');
        b.classList.add('selected');
        setTimeout(function () { step++; render(); }, 180);
      });
    });
    const back = document.getElementById('quizBack');
    if (back) back.addEventListener('click', function () { step--; render(); });

    if (window.SummitEffects) window.SummitEffects.initReveal();
  }

  function scoreTrek(t) {
    let score = 0;
    // Fitness proximity (trek.fitness is 1-5).
    score += 5 - Math.abs((+answers.fitness || 3) - t.fitness);
    // Experience vs difficulty.
    const diffRank = { Easy: 1, Moderate: 2, Challenging: 3, Extreme: 4 }[t.difficulty] || 2;
    const exp = +answers.experience || 1;
    if (exp >= diffRank) score += 3;
    else score -= (diffRank - exp) * 1.5;
    // Budget.
    if (answers.budget && answers.budget !== 'any') {
      if (t.budgetTier === answers.budget) score += 3;
    } else score += 1;
    // Season.
    if (answers.season && answers.season !== 'any') {
      if ((t.seasons || []).indexOf(answers.season) > -1 || t.season === answers.season) score += 3;
    } else score += 1;
    // Days proximity.
    score += Math.max(0, 3 - Math.abs((+answers.days || 6) - t.days) / 2);
    // Vibe.
    const tags = (t.tags || []).join(' ').toLowerCase() + ' ' + t.blurb.toLowerCase();
    const vibe = answers.vibe;
    if (vibe === 'summit' && (t.maxAltitude > 4000 || /summit|peak|view/.test(tags))) score += 2;
    if (vibe === 'nature' && /flower|meadow|forest|lake|valley/.test(tags)) score += 2;
    if (vibe === 'thrill' && (diffRank >= 3 || /frozen|adventure|ridge/.test(tags))) score += 2;
    if (vibe === 'chill' && diffRank <= 2) score += 2;
    return score;
  }

  function renderResults() {
    const finish = function () {
    const ranked = SS.treks
      .map(function (t) { return { t: t, s: scoreTrek(t) }; })
      .sort(function (a, b) { return b.s - a.s; });
    const top = ranked.slice(0, 3).map(function (r) { return r.t; });
    const best = top[0];

    if (!best) {
      mount.innerHTML =
        '<div class="quiz-card center" data-reveal>' +
        '<div class="quiz-icon success"><i class="fa-solid fa-mountain-sun"></i></div>' +
        '<h2 class="mt-1">No treks available yet</h2>' +
        '<p class="muted" style="max-width:520px;margin:8px auto 0">New expeditions are being added. Check back soon, or reach out to plan a custom trek.</p>' +
        '<div class="center mt-3"><button class="btn btn-outline" id="quizRestart"><i class="fa-solid fa-rotate-left"></i> Retake quiz</button> <a href="/contact" class="btn btn-ghost">Contact us</a></div></div>';
      const rb0 = document.getElementById('quizRestart');
      if (rb0) rb0.addEventListener('click', function () { step = 0; Object.keys(answers).forEach(function (k) { delete answers[k]; }); render(); });
      if (window.SummitEffects) window.SummitEffects.initReveal();
      return;
    }

    mount.innerHTML =
      '<div class="quiz-card" data-reveal>' +
      '<div class="quiz-progress"><span style="width:100%"></span></div>' +
      '<div class="center"><div class="quiz-icon success"><i class="fa-solid fa-check"></i></div>' +
      '<span class="eyebrow"><i class="fa-solid fa-wand-magic-sparkles"></i> Your match</span>' +
      '<h2 class="mt-1">You’re made for the ' + best.name + '</h2>' +
      '<p class="muted" style="max-width:520px;margin:8px auto 0">Based on your fitness, budget and vibe, here are your top 3 treks. Ranked just for you.</p></div>' +
      '</div>' +
      '<div class="grid cols-3 mt-3" id="quizResults">' + top.map(SS.trekCard).join('') + '</div>' +
      '<div class="center mt-3"><button class="btn btn-outline" id="quizRestart"><i class="fa-solid fa-rotate-left"></i> Retake quiz</button> ' +
      '<a href="/treks" class="btn btn-ghost">Browse all treks</a></div>';

    if (SS.wireCards) SS.wireCards(mount);
    if (window.SummitEffects) window.SummitEffects.initReveal();

    const restart = document.getElementById('quizRestart');
    if (restart) restart.addEventListener('click', function () {
      step = 0;
      Object.keys(answers).forEach(function (k) { delete answers[k]; });
      render();
    });
    };
    // Make sure admin-managed treks are loaded before ranking.
    if (SS.loadDbTreks) SS.loadDbTreks().then(finish);
    else finish();
  }

  if (SS.loadDbTreks) SS.loadDbTreks();
  render();
})();
