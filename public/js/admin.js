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

  function adminMethod(a) {
    if (a.has_password && a.has_google) return 'Password + Google';
    if (a.has_password) return 'Password';
    if (a.has_google) return 'Google';
    return '—';
  }

  function renderAdmins(rows) {
    var tbody = document.getElementById('adminsBody');
    if (!tbody) return;
    if (!rows || rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="admin-empty">No admins yet.</td></tr>';
      return;
    }
    tbody.innerHTML = rows
      .map(function (a) {
        return (
          '<tr>' +
          '<td>' + esc(a.name) + '</td>' +
          '<td><a href="mailto:' + esc(a.email) + '">' + esc(a.email) + '</a></td>' +
          '<td><span class="admin-tag">' + esc(adminMethod(a)) + '</span></td>' +
          '<td class="admin-date">' + esc(a.created_at) + '</td>' +
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
      loadAdmins();
      loadTreksManagement();
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

    function loadAdmins() {
      api('/api/admins').then(function (res) {
        if (res.status === 401) {
          clearToken();
          window.location.href = '/admin-login';
          return;
        }
        if (!res.data || !res.data.ok) return;
        var rows = res.data.data || [];
        var stat = document.getElementById('statAdmins');
        if (stat) stat.textContent = res.data.total != null ? res.data.total : rows.length;
        renderAdmins(rows);
      });
    }

    function loadTreksManagement() {
      var tbody = document.getElementById('trekMgmtBody');
      if (!tbody) return;
      api('/api/admin/treks').then(function (res) {
        if (res.status === 401) {
          clearToken();
          window.location.href = '/admin-login';
          return;
        }
        if (!res.data || !res.data.ok) return;
        var rows = res.data.data || [];
        var countEl = document.getElementById('trekMgmtCount');
        if (countEl) countEl.textContent = '(' + rows.length + ')';
        if (rows.length === 0) {
          tbody.innerHTML = '<tr><td colspan="6" class="admin-empty">No treks yet. Use “Add new Trek” to create one.</td></tr>';
          return;
        }
        tbody.innerHTML = rows.map(function (t) {
          var price = t.price != null ? '₹' + Number(t.price).toLocaleString('en-IN') : '—';
          var seats = (t.seats_left != null && t.total_seats != null) ? (t.seats_left + ' / ' + t.total_seats) : '—';
          var hidden = Number(t.active) === 0;
          var status = hidden
            ? '<span class="admin-tag" style="background:rgba(220,50,50,.15);color:#ffb4b4">Hidden</span>'
            : '<span class="admin-tag" style="background:rgba(40,180,90,.15);color:#a9f0c4">Live</span>';
          return (
            '<tr class="clickable" data-id="' + t.id + '">' +
            '<td><b style="color:#fff">' + esc(t.name) + '</b></td>' +
            '<td>' + esc(t.region || '—') + '</td>' +
            '<td>' + esc(t.difficulty || '—') + '</td>' +
            '<td>' + price + '</td>' +
            '<td>' + seats + '</td>' +
            '<td>' + status + '</td>' +
            '</tr>'
          );
        }).join('');
        tbody.querySelectorAll('tr.clickable').forEach(function (tr) {
          tr.addEventListener('click', function () {
            window.location.href = '/admin-trek-edit?id=' + tr.getAttribute('data-id');
          });
        });
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
        loadAdmins();
        loadTreksManagement();
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
