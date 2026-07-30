'use strict';

/**
 * Summit Sage — Admin area logic.
 * Handles login, signup, Google sign-in, and the submissions dashboard.
 * One file drives all three admin pages; behaviour is chosen by which
 * elements exist on the current page.
 */
(function () {
  var TOKEN_KEY = 'ss_admin_token';

  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }
  function setToken(t) {
    localStorage.setItem(TOKEN_KEY, t);
  }
  function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function api(path, opts) {
    opts = opts || {};
    var headers = opts.headers || {};
    if (opts.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
    var token = getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;
    return fetch(path, {
      method: opts.method || 'GET',
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    }).then(function (r) {
      return r.json().then(function (data) {
        return { status: r.status, data: data };
      });
    });
  }

  function showMsg(el, text, ok) {
    if (!el) return;
    el.textContent = text;
    el.className = 'admin-msg ' + (ok ? 'is-ok' : 'is-err');
    el.style.display = 'block';
  }

  // ── Google Sign-In wiring (optional) ───────────────────────────────────────
  function initGoogle(onCredential) {
    var mount = document.getElementById('googleBtn');
    if (!mount) return;
    api('/api/admin/config').then(function (res) {
      var cid = res.data && res.data.googleClientId;
      if (!cid || !window.google || !window.google.accounts) {
        // Google not configured or library blocked — hide the divider + button.
        var wrap = document.getElementById('googleWrap');
        if (wrap) wrap.style.display = 'none';
        return;
      }
      window.google.accounts.id.initialize({
        client_id: cid,
        callback: function (response) {
          onCredential(response.credential);
        },
      });
      window.google.accounts.id.renderButton(mount, {
        theme: 'filled_black',
        size: 'large',
        width: 320,
        text: 'continue_with',
      });
    });
  }

  function handleAuthResult(res, msgEl) {
    if (res.status >= 200 && res.status < 300 && res.data && res.data.token) {
      setToken(res.data.token);
      window.location.href = '/admin';
      return;
    }
    var err =
      (res.data && (res.data.error || (res.data.errors && res.data.errors.join(' ')))) ||
      'Something went wrong. Please try again.';
    showMsg(msgEl, err, false);
  }

  // ── LOGIN PAGE ─────────────────────────────────────────────────────────────
  function initLogin() {
    var form = document.getElementById('loginForm');
    if (!form) return;
    var msg = document.getElementById('adminMsg');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = form.querySelector('[type="submit"]');
      btn.disabled = true;
      api('/api/admin/login', {
        method: 'POST',
        body: {
          email: form.email.value.trim(),
          password: form.password.value,
        },
      })
        .then(function (res) {
          btn.disabled = false;
          handleAuthResult(res, msg);
        })
        .catch(function () {
          btn.disabled = false;
          showMsg(msg, 'Network error. Please try again.', false);
        });
    });

    initGoogle(function (credential) {
      api('/api/admin/google', { method: 'POST', body: { credential: credential } })
        .then(function (res) {
          handleAuthResult(res, msg);
        })
        .catch(function () {
          showMsg(msg, 'Google sign-in failed. Please try again.', false);
        });
    });
  }

  // ── SIGNUP PAGE ────────────────────────────────────────────────────────────
  function initSignup() {
    var form = document.getElementById('signupForm');
    if (!form) return;
    var msg = document.getElementById('adminMsg');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (form.password.value !== form.confirm.value) {
        showMsg(msg, 'Passwords do not match.', false);
        return;
      }
      var btn = form.querySelector('[type="submit"]');
      btn.disabled = true;
      api('/api/admin/signup', {
        method: 'POST',
        body: {
          name: form.name.value.trim(),
          email: form.email.value.trim(),
          password: form.password.value,
          code: form.code.value.trim(),
        },
      })
        .then(function (res) {
          btn.disabled = false;
          handleAuthResult(res, msg);
        })
        .catch(function () {
          btn.disabled = false;
          showMsg(msg, 'Network error. Please try again.', false);
        });
    });

    initGoogle(function (credential) {
      api('/api/admin/google', { method: 'POST', body: { credential: credential } })
        .then(function (res) {
          handleAuthResult(res, msg);
        })
        .catch(function () {
          showMsg(msg, 'Google sign-in failed. Please try again.', false);
        });
    });
  }

  // ── DASHBOARD PAGE ─────────────────────────────────────────────────────────
  var TYPE_LABELS = {
    contact: 'Contact',
    registration: 'Trek registration',
    corporate: 'Corporate',
    community: 'Community',
    ambassador: 'Ambassador',
    review: 'Review',
    waitlist: 'Waitlist',
  };

  function trekOf(row) {
    // Trek interest lives in `subject` for registrations, else in details.trek.
    if (row.subject) return row.subject;
    if (row.details) {
      try {
        var d = typeof row.details === 'string' ? JSON.parse(row.details) : row.details;
        if (d && d.trek) return d.trek;
      } catch (e) {}
    }
    return '';
  }

  function renderRows(rows, filter) {
    var tbody = document.getElementById('subsBody');
    if (!tbody) return;
    var list = rows.filter(function (r) {
      return !filter || r.form_type === filter;
    });
    if (list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="admin-empty">No submissions yet.</td></tr>';
      return;
    }
    tbody.innerHTML = list
      .map(function (r) {
        var trek = trekOf(r);
        return (
          '<tr>' +
          '<td>' + esc(r.name) + '</td>' +
          '<td><a href="mailto:' + esc(r.email) + '">' + esc(r.email) + '</a></td>' +
          '<td>' + (r.phone ? '<a href="tel:' + esc(r.phone) + '">' + esc(r.phone) + '</a>' : '—') + '</td>' +
          '<td><span class="admin-tag">' + esc(TYPE_LABELS[r.form_type] || r.form_type) + '</span></td>' +
          '<td>' + (trek ? esc(trek) : '—') + '</td>' +
          '<td class="admin-msg-cell">' + (r.message ? esc(r.message) : '—') + '</td>' +
          '<td class="admin-date">' + esc(r.created_at) + '</td>' +
          '</tr>'
        );
      })
      .join('');
  }

  function renderSubscribers(rows) {
    var tbody = document.getElementById('subscribersBody');
    if (!tbody) return;
    if (!rows || rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" class="admin-empty">No subscribers yet.</td></tr>';
      return;
    }
    tbody.innerHTML = rows
      .map(function (r) {
        return (
          '<tr>' +
          '<td><a href="mailto:' + esc(r.email) + '">' + esc(r.email) + '</a></td>' +
          '<td>' + (r.source ? esc(r.source) : '—') + '</td>' +
          '<td class="admin-date">' + esc(r.created_at) + '</td>' +
          '</tr>'
        );
      })
      .join('');
  }

  function initDashboard() {
    var root = document.getElementById('adminDash');
    if (!root) return;

    // Guard: must have a valid session.
    api('/api/admin/session').then(function (res) {
      if (res.status !== 200 || !res.data.ok) {
        clearToken();
        window.location.href = '/admin-login';
        return;
      }
      var who = document.getElementById('adminWho');
      if (who) who.textContent = res.data.admin.name + ' · ' + res.data.admin.email;
      loadSubs();
      loadSubscribers();
    });

    var allRows = [];

    function loadSubs() {
      var status = document.getElementById('subsStatus');
      if (status) status.textContent = 'Loading…';
      api('/api/submissions?limit=200').then(function (res) {
        if (res.status === 401) {
          clearToken();
          window.location.href = '/admin-login';
          return;
        }
        if (!res.data.ok) {
          if (status) status.textContent = 'Failed to load submissions.';
          return;
        }
        allRows = res.data.data || [];
        if (status) status.textContent = '';
        updateStats(allRows);
        buildFilter(allRows);
        renderRows(allRows, currentFilter());
      });
    }

    function currentFilter() {
      var sel = document.getElementById('typeFilter');
      return sel ? sel.value : '';
    }

    function loadSubscribers() {
      api('/api/subscribers?limit=500').then(function (res) {
        if (res.status === 401) {
          clearToken();
          window.location.href = '/admin-login';
          return;
        }
        if (!res.data || !res.data.ok) return;
        var rows = res.data.data || [];
        var stat = document.getElementById('statSubs');
        if (stat) stat.textContent = res.data.total != null ? res.data.total : rows.length;
        renderSubscribers(rows);
      });
    }

    function updateStats(rows) {
      var total = document.getElementById('statTotal');
      var regs = document.getElementById('statRegs');
      var contacts = document.getElementById('statContacts');
      if (total) total.textContent = rows.length;
      if (regs) regs.textContent = rows.filter(function (r) { return r.form_type === 'registration'; }).length;
      if (contacts) contacts.textContent = rows.filter(function (r) { return r.form_type === 'contact'; }).length;
    }

    function buildFilter(rows) {
      var sel = document.getElementById('typeFilter');
      if (!sel || sel._built) return;
      sel._built = true;
      var types = {};
      rows.forEach(function (r) { types[r.form_type] = true; });
      Object.keys(types).forEach(function (t) {
        var o = document.createElement('option');
        o.value = t;
        o.textContent = TYPE_LABELS[t] || t;
        sel.appendChild(o);
      });
      sel.addEventListener('change', function () {
        renderRows(allRows, sel.value);
      });
    }

    var logout = document.getElementById('logoutBtn');
    if (logout) {
      logout.addEventListener('click', function () {
        clearToken();
        window.location.href = '/admin-login';
      });
    }

    var refresh = document.getElementById('refreshBtn');
    if (refresh) {
      refresh.addEventListener('click', function () {
        loadSubs();
        loadSubscribers();
      });
    }
  }

  // ── Boot ────────────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    // If already logged in, skip login/signup pages.
    if ((document.getElementById('loginForm') || document.getElementById('signupForm')) && getToken()) {
      api('/api/admin/session').then(function (res) {
        if (res.status === 200 && res.data.ok) {
          window.location.href = '/admin';
        } else {
          clearToken();
        }
      });
    }
    initLogin();
    initSignup();
    initDashboard();
  });
})();
