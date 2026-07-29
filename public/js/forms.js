'use strict';

/**
 * Summit Sage — Universal form handling
 * Any <form data-form="contact|registration|corporate|community|ambassador|review">
 * posts to /api/contact; <form data-form="newsletter"> posts to /api/subscribe.
 * Handles validation, honeypot, loading state and success/error messaging,
 * plus a celebratory scratch-card reward after a trek registration.
 */
(function () {
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function status(form, msg, type) {
    let el = form.querySelector('.form-status');
    if (!el) {
      el = document.createElement('div');
      el.className = 'form-status';
      form.appendChild(el);
    }
    el.textContent = msg;
    el.className = 'form-status show ' + (type || '');
  }

  function loading(btn, on, original) {
    if (!btn) return;
    btn.disabled = on;
    btn.innerHTML = on
      ? '<i class="fa-solid fa-circle-notch fa-spin"></i> Sending…'
      : original;
  }

  function collect(form) {
    const data = {};
    form.querySelectorAll('input, textarea, select').forEach(function (el) {
      if (!el.name) return;
      if (el.type === 'checkbox') {
        if (el.checked) data[el.name] = (data[el.name] ? data[el.name] + ', ' : '') + (el.value || 'yes');
      } else if (el.type === 'radio') {
        if (el.checked) data[el.name] = el.value;
      } else {
        data[el.name] = el.value.trim();
      }
    });
    return data;
  }

  function scratchReward() {
    const modal = document.getElementById('rewardModal');
    if (!modal) return;
    modal.classList.add('open');
    const codes = ['SUMMIT200', 'TRAIL10', 'FIRSTPEAK', 'SAGE300'];
    const code = codes[Math.floor(Math.random() * codes.length)];
    const el = modal.querySelector('[data-reward-code]');
    if (el) el.textContent = code;
  }

  async function handle(form, e) {
    e.preventDefault();
    const type = form.getAttribute('data-form');
    const btn = form.querySelector('[type="submit"]');
    const original = btn ? btn.innerHTML : '';
    const data = collect(form);

    // Honeypot.
    if (data.website) {
      form.reset();
      status(form, '✓ Thank you! Your request has been received.', 'success');
      return;
    }

    // Basic validation.
    if (type === 'newsletter') {
      if (!EMAIL_RE.test(data.email || '')) {
        status(form, 'Please enter a valid email address.', 'error');
        return;
      }
    } else {
      if (!data.name || data.name.length < 2) {
        status(form, 'Please enter your name.', 'error');
        return;
      }
      if (!EMAIL_RE.test(data.email || '')) {
        status(form, 'Please enter a valid email address.', 'error');
        return;
      }
    }

    const endpoint = type === 'newsletter' ? '/api/subscribe' : '/api/contact';
    if (type && type !== 'newsletter') data.formType = type;

    loading(btn, true, original);
    status(form, 'Sending your request…', 'loading');

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json().catch(function () {
        return {};
      });
      if (!res.ok || !result.ok) {
        const m =
          (result.errors && result.errors.join(' ')) ||
          result.error ||
          'We could not send your request. Please try again.';
        throw new Error(m);
      }
      form.reset();
      const success =
        type === 'registration'
          ? '✓ You’re in! Check your email & WhatsApp for confirmation.'
          : type === 'newsletter'
          ? '✓ Subscribed! Watch your inbox for the next expedition.'
          : '✓ Thank you! We’ll get back to you shortly.';
      status(form, success, 'success');
      if (type === 'registration') scratchReward();
    } catch (err) {
      status(
        form,
        err.message ||
          'Sorry, we could not send your request right now. Please WhatsApp us instead.',
        'error'
      );
    } finally {
      loading(btn, false, original);
    }
  }

  function wireForms(root) {
    (root || document).querySelectorAll('form[data-form]').forEach(function (form) {
      if (form._wired) return;
      form._wired = true;
      form.addEventListener('submit', function (e) {
        handle(form, e);
      });
      // Clear invalid state on input.
      form.querySelectorAll('.control').forEach(function (el) {
        el.addEventListener('input', function () {
          el.classList.remove('invalid');
        });
      });
    });
  }

  // Exposed so dynamically-injected forms (trek detail, quiz) can be wired.
  window.SS = window.SS || {};
  window.SS.wireForms = wireForms;

  function boot() {
    wireForms(document);
    // Reward modal close.
    const modal = document.getElementById('rewardModal');
    if (modal) {
      modal.addEventListener('click', function (e) {
        if (e.target === modal || e.target.closest('.modal-close') || e.target.closest('[data-close]')) {
          modal.classList.remove('open');
        }
      });
    }
  }
  if (document.readyState !== 'loading') boot();
  else document.addEventListener('DOMContentLoaded', boot);
})();
