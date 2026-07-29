'use strict';

/**
 * Summit Sage — Shared layout
 * Injects the navbar, footer and floating UI (WhatsApp, back-to-top,
 * trek assistant, cursor glow, compare tray & modals) into every page,
 * so the chrome stays identical everywhere and is edited in one place.
 *
 * Loaded FIRST with `defer`, so it runs after the DOM is parsed but before
 * the other deferred scripts (effects/main/treks) that wire it up.
 */
(function () {
  const MARK =
    '<svg class="brand-mark" viewBox="0 0 48 48" fill="none" aria-hidden="true">' +
    '<rect width="48" height="48" rx="13" fill="#0A1628"/>' +
    '<path d="M8 34L19 15l6 9 3-5 12 15H8z" fill="#E85D04"/>' +
    '<path d="M19 15l6 9 3-5 3.6 4.5L27 24l-4 3-4-6-3.5 6H10L19 15z" fill="#fff" opacity=".92"/>' +
    '<circle cx="35" cy="13" r="3.2" fill="#fff"/></svg>';

  const brand =
    '<a href="/" class="brand" aria-label="Summit Sage home">' +
    MARK +
    '<span>Summit<span class="b-sage">Sage</span><small>Trek · Ascend · Belong</small></span></a>';

  const navLinks =
    '<nav class="nav-links" id="navLinks" aria-label="Primary">' +
    '<a href="/treks">Treks</a>' +
    '<a href="/gallery">Gallery</a>' +
    '<a href="/about">About</a>' +
    '<a href="/community">Community</a>' +
    '<a href="/blog">Journal</a>' +
    '<div class="has-drop"><button aria-haspopup="true">More <i class="fa-solid fa-chevron-down" style="font-size:.7em"></i></button>' +
    '<div class="drop">' +
    '<a href="/testimonials"><i class="fa-solid fa-star"></i> Testimonials</a>' +
    '<a href="/corporate"><i class="fa-solid fa-briefcase"></i> Corporate Treks</a>' +
    '<a href="/quiz"><i class="fa-solid fa-wand-magic-sparkles"></i> Find Your Trek</a>' +
    '<a href="/dashboard"><i class="fa-solid fa-gauge-high"></i> Trekker Dashboard</a>' +
    '</div></div>' +
    '<a href="/contact">Contact</a>' +
    '</nav>';

  const navRight =
    '<div class="nav-right">' +
    '<div class="lang-toggle" role="group" aria-label="Language">' +
    '<button data-lang="en" class="active">EN</button>' +
    '<button data-lang="bn">বাংলা</button>' +
    '</div>' +
    '<a class="btn btn-primary btn-sm" data-wa><i class="fa-brands fa-whatsapp"></i> Join</a>' +
    '<button class="nav-toggle" id="navToggle" aria-label="Toggle menu" aria-expanded="false"><span></span><span></span><span></span></button>' +
    '</div>';

  const header =
    '<div class="cursor-glow" aria-hidden="true"></div>' +
    '<header class="navbar" id="navbar"><div class="container nav-inner">' +
    brand +
    navLinks +
    navRight +
    '</div></header>';

  const footer =
    '<footer class="footer"><div class="container">' +
    '<div class="footer-grid">' +
    '<div><a href="/" class="brand" style="font-size:1.4rem">' + MARK + '<span>Summit<span class="b-sage">Sage</span></span></a>' +
    '<p class="about">A premium trekking & adventure community from Kolkata — turning first-timers into lifelong mountaineers, one summit at a time.</p>' +
    '<div class="social">' +
    '<a href="#" aria-label="Instagram"><i class="fa-brands fa-instagram"></i></a>' +
    '<a data-wa aria-label="WhatsApp"><i class="fa-brands fa-whatsapp"></i></a>' +
    '<a href="#" aria-label="YouTube"><i class="fa-brands fa-youtube"></i></a>' +
    '<a href="#" aria-label="Facebook"><i class="fa-brands fa-facebook"></i></a>' +
    '<a href="#" aria-label="Strava"><i class="fa-brands fa-strava"></i></a>' +
    '</div></div>' +
    '<div><h4>Explore</h4><div class="footer-links">' +
    '<a href="/treks">Upcoming Treks</a><a href="/gallery">Past Treks & Gallery</a>' +
    '<a href="/quiz">Find Your Trek</a><a href="/corporate">Corporate Treks</a>' +
    '<a href="/dashboard">Trekker Dashboard</a></div></div>' +
    '<div><h4>Community</h4><div class="footer-links">' +
    '<a href="/about">About Us</a><a href="/community">Community</a>' +
    '<a href="/blog">Trek Journal</a><a href="/testimonials">Testimonials</a>' +
    '<a href="/contact">Contact</a></div></div>' +
    '<div><h4>Join the newsletter</h4><p class="about" style="margin-top:0">Trek drops, gear tips & early-bird alerts. No spam — ever.</p>' +
    '<form class="newsletter" data-form="newsletter">' +
    '<input type="text" name="website" class="honey" tabindex="-1" autocomplete="off" aria-hidden="true">' +
    '<input type="email" name="email" placeholder="you@email.com" aria-label="Email" required>' +
    '<button class="btn btn-primary btn-sm" type="submit"><i class="fa-solid fa-paper-plane"></i></button>' +
    '</form>' +
    '<p class="muted" style="font-size:.8rem;margin-top:14px">Proudly partnered with <b style="color:#cdd9ec">Decathlon</b></p>' +
    '</div></div>' +
    '<div class="footer-bottom"><span>© <span id="year">2026</span> Summit Sage · Kolkata, India. All rights reserved.</span>' +
    '<span class="flex gap-1 wrap"><a href="#">Privacy</a><a href="#">Terms</a><a href="#">Safety</a></span></div>' +
    '</div></footer>';

  const floats =
    '<a class="fab fab-whatsapp" data-wa aria-label="Chat on WhatsApp"><i class="fa-brands fa-whatsapp"></i></a>' +
    '<button class="fab fab-top" id="toTop" aria-label="Back to top"><i class="fa-solid fa-arrow-up"></i></button>' +
    '<button class="chatbot-btn" id="chatbotBtn"><i class="fa-solid fa-wand-magic-sparkles"></i> <span>Ask Sage</span></button>' +
    '<div class="chatbot" id="chatbot">' +
    '<div class="chatbot-head"><div class="av"><i class="fa-solid fa-mountain-sun"></i></div>' +
    '<div><b>Sage · Trek Assistant</b><small>● Online — replies instantly</small></div>' +
    '<button class="chatbot-close" style="margin-left:auto;color:#fff" aria-label="Close">&times;</button></div>' +
    '<div class="chatbot-body"></div>' +
    '<div class="chat-suggest"><button>Best trek for beginners?</button><button>Trek prices?</button><button>How do I book?</button></div>' +
    '<div class="chatbot-input"><input type="text" placeholder="Ask about treks…" aria-label="Message"><button aria-label="Send"><i class="fa-solid fa-paper-plane"></i></button></div>' +
    '</div>';

  const modals =
    '<div class="compare-tray" id="compareTray"><span class="muted" style="font-weight:700;font-size:.85rem">Compare</span>' +
    '<div class="slots"></div>' +
    '<button class="btn btn-primary btn-sm" id="compareOpen">Compare now</button></div>' +
    '<div class="modal" id="compareModal"><div class="modal-box"><button class="modal-close" aria-label="Close"><i class="fa-solid fa-xmark"></i></button><div class="modal-body"></div></div></div>' +
    '<div class="modal" id="rewardModal"><div class="modal-box" style="max-width:440px"><button class="modal-close" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>' +
    '<div class="center" style="padding:44px 34px">' +
    '<div style="font-size:3rem">🎉</div>' +
    '<h2 style="margin:10px 0">You unlocked a reward!</h2>' +
    '<p class="muted">Use this code on your next trek registration:</p>' +
    '<div style="font-family:var(--font-display);font-size:2rem;color:var(--orange-300);letter-spacing:3px;margin:18px 0;padding:16px;border:2px dashed var(--line-strong);border-radius:14px" data-reward-code>SUMMIT200</div>' +
    '<button class="btn btn-primary btn-block" data-close>Awesome, thanks!</button>' +
    '</div></div></div>';

  // Inject header now (script is deferred → body already parsed).
  document.body.insertAdjacentHTML('afterbegin', header);
  document.body.insertAdjacentHTML('beforeend', footer + floats + modals);
})();
