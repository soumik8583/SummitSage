'use strict';

/**
 * Summit Sage — Theme (dark / light) toggle.
 *
 * Loaded as a blocking script in <head> on every page so the saved theme is
 * applied before first paint (no flash). Any element with the [data-theme-toggle]
 * attribute flips the theme when clicked (handled via event delegation, so it
 * also works for toggles injected later by layout.js / admin.js).
 *
 * The choice persists in localStorage under "ss_theme" and is reflected on
 * <html data-theme="dark|light">. Default is dark (the brand look).
 */
(function () {
  var KEY = 'ss_theme';

  function getTheme() {
    try {
      return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark';
    } catch (e) {
      return 'dark';
    }
  }

  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t === 'light' ? 'light' : 'dark');
  }

  function updateToggles(t) {
    var btns = document.querySelectorAll('[data-theme-toggle]');
    for (var i = 0; i < btns.length; i++) {
      var icon = btns[i].querySelector('i');
      // Show a sun in dark mode (click → go light) and a moon in light mode.
      if (icon) icon.className = t === 'light' ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
      var label = t === 'light' ? 'Switch to dark theme' : 'Switch to light theme';
      btns[i].setAttribute('aria-label', label);
      btns[i].setAttribute('title', label);
    }
  }

  function setTheme(t) {
    try {
      localStorage.setItem(KEY, t);
    } catch (e) {}
    applyTheme(t);
    updateToggles(t);
  }

  // Apply immediately (runs in <head>, before the body renders).
  applyTheme(getTheme());

  // Delegated toggle handling — works for static and injected buttons.
  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest ? e.target.closest('[data-theme-toggle]') : null;
    if (!btn) return;
    e.preventDefault();
    setTheme(getTheme() === 'light' ? 'dark' : 'light');
  });

  function init() {
    updateToggles(getTheme());
  }
  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);

  window.SSTheme = { get: getTheme, set: setTheme, toggle: function () { setTheme(getTheme() === 'light' ? 'dark' : 'light'); } };
})();
