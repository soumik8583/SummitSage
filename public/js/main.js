'use strict';

/**
 * Summit Sage — Global site config + UI behaviour
 * Navbar, mobile menu, language (EN/বাংলা) toggle, back-to-top,
 * WhatsApp links, footer year and the rule-based trek assistant.
 */

/* Central config — replace these placeholders with real details anytime. */
window.SUMMIT = {
  // WhatsApp business numbers (country code + number). A click routes to one
  // of these, chosen at random, so enquiries are shared across both phones.
  whatsapp: ['918910414249', '917278601577'],
  whatsappText:
    "Hi Summit Sage! I'd love to know more about your upcoming treks.",
  instagram: 'https://instagram.com',
  email: 'hello@summitsage.in',
  phoneDisplay: '+91 98300 12345',
  city: 'Kolkata, India',
};

(function () {
  const SUMMIT = window.SUMMIT;

  /* ---- WhatsApp links (also wires dynamically-injected ones) ---- */
  // Accept either a single number (string) or a list; pick one per click so
  // messages are distributed between the team's phones.
  const waNumbers = [].concat(SUMMIT.whatsapp).filter(Boolean);
  function pickWaNumber() {
    return waNumbers[Math.floor(Math.random() * waNumbers.length)];
  }
  function waLink(text) {
    return (
      'https://wa.me/' + pickWaNumber() + '?text=' + encodeURIComponent(text)
    );
  }
  window.SS = window.SS || {};
  window.SS.wireWA = function (root) {
    (root || document).querySelectorAll('[data-wa]').forEach(function (a) {
      if (a._wa) return;
      a._wa = true;
      const custom = a.getAttribute('data-wa');
      a.href = waLink(custom || SUMMIT.whatsappText);
      a.target = '_blank';
      a.rel = 'noopener';
    });
  };
  window.SS.wireWA(document);

  /* ---- Navbar scroll + back-to-top ---- */
  const navbar = document.getElementById('navbar');
  const toTop = document.getElementById('toTop');
  function onScroll() {
    const y = window.scrollY;
    if (navbar) navbar.classList.toggle('scrolled', y > 36);
    if (toTop) toTop.classList.toggle('show', y > 560);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  if (toTop)
    toTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

  /* ---- Mobile menu ---- */
  const navToggle = document.getElementById('navToggle');
  const navLinks = document.getElementById('navLinks');
  function closeMenu() {
    if (!navLinks || !navToggle) return;
    navLinks.classList.remove('open');
    navToggle.classList.remove('active');
    navToggle.setAttribute('aria-expanded', 'false');
  }
  if (navToggle && navLinks) {
    navToggle.addEventListener('click', function () {
      const open = navLinks.classList.toggle('open');
      navToggle.classList.toggle('active', open);
      navToggle.setAttribute('aria-expanded', String(open));
    });
    navLinks.querySelectorAll('a').forEach(function (l) {
      l.addEventListener('click', closeMenu);
    });
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeMenu();
  });

  /* ---- Active nav link ---- */
  const path = location.pathname.replace(/\/index(\.html)?$/, '/').replace(/\.html$/, '');
  document.querySelectorAll('.nav-links a[href]').forEach(function (a) {
    const href = a.getAttribute('href').replace(/\.html$/, '');
    if (
      href &&
      href !== '#' &&
      (href === path || (href !== '/' && path.indexOf(href) === 0))
    ) {
      a.classList.add('active');
    }
  });

  /* ---- Language toggle (EN / বাংলা) ---- */
  const savedLang = localStorage.getItem('ss_lang') || 'en';
  function applyLang(lang) {
    document.body.classList.toggle('lang-bn', lang === 'bn');
    document.querySelectorAll('.lang-toggle button').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-lang') === lang);
    });
    localStorage.setItem('ss_lang', lang);
    document.documentElement.lang = lang === 'bn' ? 'bn' : 'en';
  }
  document.querySelectorAll('.lang-toggle button').forEach(function (b) {
    b.addEventListener('click', function () {
      applyLang(b.getAttribute('data-lang'));
    });
  });
  applyLang(savedLang);

  /* ---- Footer year ---- */
  const yr = document.getElementById('year');
  if (yr) yr.textContent = new Date().getFullYear();

  /* ============================================================
     Trek assistant — lightweight rule-based chatbot
     ============================================================ */
  const bot = document.getElementById('chatbot');
  const botBtn = document.getElementById('chatbotBtn');
  if (bot && botBtn) {
    const body = bot.querySelector('.chatbot-body');
    const input = bot.querySelector('.chatbot-input input');
    const sendBtn = bot.querySelector('.chatbot-input button');

    function add(text, who) {
      const div = document.createElement('div');
      div.className = 'msg ' + who;
      div.innerHTML = text;
      body.appendChild(div);
      body.scrollTop = body.scrollHeight;
    }

    const KB = [
      {
        k: ['price', 'cost', 'budget', 'fee', 'charge', 'much'],
        a: 'Our treks range from <b>₹3,500</b> (weekend escapes) to <b>₹18,500</b> (Himalayan expeditions). Early-bird pricing saves up to 15%, and groups of 5+ get an automatic discount. Browse <a href="/treks">Upcoming Treks</a> for exact prices.',
      },
      {
        k: ['beginner', 'first', 'easy', 'new', 'fitness'],
        a: 'Perfect — many of our trekkers start as first-timers! Try our <a href="/quiz">Find Your Trek quiz</a> or look for the green <b>Easy</b> badge. Kedarkantha and Kolli Hills are great beginner-friendly options.',
      },
      {
        k: ['book', 'register', 'join', 'sign', 'seat', 'reserve'],
        a: "Tap <b>Register</b> on any trek page and fill the quick form — you'll get a confirmation on WhatsApp and email. Seats are limited and update live, so grab yours early!",
      },
      {
        k: ['payment', 'upi', 'razorpay', 'emi', 'installment', 'pay'],
        a: 'We accept UPI, cards and net-banking via Razorpay, plus <b>EMI / split payment</b> for group bookings. NRI trekkers can pay in multiple currencies.',
      },
      {
        k: ['difficulty', 'hard', 'challenging', 'extreme', 'level'],
        a: 'Every trek shows a difficulty badge: <b>Easy</b>, <b>Moderate</b>, <b>Challenging</b> or <b>Extreme</b> — based on altitude, distance and terrain. Filter by difficulty on the <a href="/treks">Treks</a> page.',
      },
      {
        k: ['corporate', 'team', 'company', 'group', 'office'],
        a: 'We run tailored <a href="/corporate">corporate & team-building treks</a> with private batches, invoicing and dedicated guides. Share your team size and we\'ll craft a package.',
      },
      {
        k: ['refund', 'cancel', 'weather'],
        a: 'If we cancel a trek (e.g. weather), you get a full auto-refund or free reschedule. Personal cancellations follow a tiered policy shared at booking.',
      },
      {
        k: ['contact', 'call', 'reach', 'phone', 'whatsapp'],
        a: 'You can reach us on <a href="' +
          waUrl +
          '" target="_blank" rel="noopener">WhatsApp</a>, call <b>' +
          SUMMIT.phoneDisplay +
          '</b>, or use the <a href="/contact">contact form</a>.',
      },
      {
        k: ['gear', 'pack', 'bring', 'equipment', 'list'],
        a: "Each trek page includes an auto-generated <b>packing list</b> tailored to its altitude and season. Partnered with Decathlon, we also help you rent or buy gear at a discount.",
      },
    ];

    function answer(q) {
      const t = q.toLowerCase();
      let best = null;
      for (const item of KB) {
        if (item.k.some(function (w) { return t.indexOf(w) > -1; })) {
          best = item.a;
          break;
        }
      }
      return (
        best ||
        "Great question! I can help with treks, pricing, difficulty, booking, payments and gear. You can also explore <a href='/treks'>Upcoming Treks</a> or message our team on <a href='" +
          waUrl +
          "' target='_blank' rel='noopener'>WhatsApp</a>."
      );
    }

    function respond(q) {
      add(q, 'user');
      setTimeout(function () {
        add(answer(q), 'bot');
      }, 420);
    }

    function toggle(open) {
      bot.classList.toggle('open', open);
      if (open && !body.dataset.greeted) {
        body.dataset.greeted = '1';
        add(
          "Namaste! 🏔️ I'm <b>Sage</b>, your trek assistant. Ask me anything about our treks, pricing or booking.",
          'bot'
        );
      }
    }
    botBtn.addEventListener('click', function () {
      toggle(!bot.classList.contains('open'));
    });
    bot.querySelector('.chatbot-close').addEventListener('click', function () {
      toggle(false);
    });
    function submit() {
      const q = input.value.trim();
      if (!q) return;
      respond(q);
      input.value = '';
    }
    sendBtn.addEventListener('click', submit);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') submit();
    });
    bot.querySelectorAll('.chat-suggest button').forEach(function (b) {
      b.addEventListener('click', function () {
        respond(b.textContent.trim());
      });
    });
  }
})();
