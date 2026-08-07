'use strict';

/**
 * Summit Sage — Admin area logic.
 * Handles login, signup, Google sign-in, and the submissions dashboard.
 * One file drives all three admin pages; behaviour is chosen by which
 * elements exist on the current page.
 */
(function () {
  var TOKEN_KEY = 'ss_admin_token';
  var ACTIVITY_KEY = 'ss_admin_last_activity';
  var IDLE_LIMIT_MS = 60 * 60 * 1000; // Sign out after 1 hour of inactivity.

  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }
  function setToken(t) {
    localStorage.setItem(TOKEN_KEY, t);
    markActivity();
  }
  function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ACTIVITY_KEY);
  }

  // ── Inactivity tracking ──────────────────────────────────────────────────
  function markActivity() {
    localStorage.setItem(ACTIVITY_KEY, String(Date.now()));
  }
  function isIdleExpired() {
    var last = parseInt(localStorage.getItem(ACTIVITY_KEY) || '0', 10);
    if (!last) return false;
    return Date.now() - last > IDLE_LIMIT_MS;
  }
  // Best-effort server notice so the audit log records a logout time. Uses
  // keepalive so the request can complete even as the page navigates away.
  function notifyLogout() {
    var token = getToken();
    if (!token) return;
    try {
      fetch('/api/admin/logout', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token },
        keepalive: true,
      }).catch(function () {});
    } catch (e) {
      /* ignore — logout notice is best-effort */
    }
  }
  function logoutForIdle() {
    notifyLogout();
    clearToken();
    window.location.href = '/admin-login';
  }
  // Sign the admin out after 1 hour of inactivity: on reload (checked at boot)
  // and live via a timer + activity listeners while the page stays open.
  function setupIdleTimeout() {
    markActivity();
    var lastWrite = Date.now();
    function onActivity() {
      // Throttle localStorage writes to at most once every 30 seconds.
      if (Date.now() - lastWrite > 30 * 1000) {
        lastWrite = Date.now();
        markActivity();
      }
    }
    ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'].forEach(function (evt) {
      document.addEventListener(evt, onActivity, { passive: true });
    });
    setInterval(function () {
      if (isIdleExpired()) logoutForIdle();
    }, 60 * 1000);
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
      tbody.innerHTML = '<tr><td colspan="8" class="admin-empty">No submissions yet.</td></tr>';
      return;
    }
    tbody.innerHTML = list
      .map(function (r) {
        var trek = trekOf(r);
        return (
          '<tr data-id="' + r.id + '">' +
          '<td class="admin-sel"><input type="radio" class="row-sel" name="subsSel" value="' + r.id + '" aria-label="Select this submission"></td>' +
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
      tbody.innerHTML = '<tr><td colspan="4" class="admin-empty">No subscribers yet.</td></tr>';
      return;
    }
    tbody.innerHTML = rows
      .map(function (r) {
        return (
          '<tr data-id="' + r.id + '">' +
          '<td class="admin-sel"><input type="radio" class="row-sel" name="subscribersSel" value="' + r.id + '" aria-label="Select this subscriber"></td>' +
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

  function renderRegistrations(rows) {
    var tbody = document.getElementById('regsBody');
    if (!tbody) return;
    if (!rows || rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" class="admin-empty">No trek registrations yet.</td></tr>';
      return;
    }
    tbody.innerHTML = rows
      .map(function (r) {
        return (
          '<tr data-id="' + r.id + '">' +
          '<td class="admin-sel"><input type="radio" class="row-sel" name="regsSel" value="' + r.id + '" aria-label="Select this registration"></td>' +
          '<td>' + esc(r.name) + '</td>' +
          '<td><a href="mailto:' + esc(r.email) + '">' + esc(r.email) + '</a></td>' +
          '<td>' + (r.phone ? '<a href="tel:' + esc(r.phone) + '">' + esc(r.phone) + '</a>' : '—') + '</td>' +
          '<td>' + (r.people != null && r.people !== '' ? esc(r.people) : '—') + '</td>' +
          '<td>' + (r.city ? esc(r.city) : '—') + '</td>' +
          '<td>' + (r.tshirt_size ? esc(r.tshirt_size) : '—') + '</td>' +
          '<td>' + (r.trek ? esc(r.trek) : '—') + '</td>' +
          '<td class="admin-date">' + esc(r.created_at) + '</td>' +
          '</tr>'
        );
      })
      .join('');
  }

  function renderAdmins(rows, canManage) {
    var tbody = document.getElementById('adminsBody');
    if (!tbody) return;
    if (!rows || rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="admin-empty">No admins yet.</td></tr>';
      return;
    }
    tbody.innerHTML = rows
      .map(function (a) {
        var sel = canManage
          ? '<input type="radio" class="row-sel" name="adminsSel" value="' + a.id + '" aria-label="Select this admin">'
          : '';
        var role = a.is_super
          ? '<span class="admin-tag" style="background:rgba(232,93,4,.18);color:var(--orange-300)">Super admin</span>'
          : '<span class="admin-tag" style="background:var(--glass-2);color:var(--mist)">Admin</span>';
        return (
          '<tr data-id="' + a.id + '">' +
          '<td class="admin-sel">' + sel + '</td>' +
          '<td>' + esc(a.name) + '</td>' +
          '<td><a href="mailto:' + esc(a.email) + '">' + esc(a.email) + '</a></td>' +
          '<td><span class="admin-tag">' + esc(adminMethod(a)) + '</span></td>' +
          '<td>' + role + '</td>' +
          '<td class="admin-date">' + esc(a.created_at) + '</td>' +
          '</tr>'
        );
      })
      .join('');
  }

  // Human-friendly session length between two datetime strings.
  function sessionLength(login, logout) {
    if (!login || !logout) return '';
    var a = new Date(String(login).replace(' ', 'T') + 'Z').getTime();
    var b = new Date(String(logout).replace(' ', 'T') + 'Z').getTime();
    if (isNaN(a) || isNaN(b) || b < a) return '';
    var mins = Math.round((b - a) / 60000);
    if (mins < 1) return '<1 min';
    if (mins < 60) return mins + ' min';
    var h = Math.floor(mins / 60);
    var m = mins % 60;
    return m ? h + 'h ' + m + 'm' : h + 'h';
  }

  function renderAuditLogs(rows) {
    var tbody = document.getElementById('auditBody');
    if (!tbody) return;
    if (!rows || rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="admin-empty">No admin activity recorded yet.</td></tr>';
      return;
    }
    tbody.innerHTML = rows
      .map(function (r) {
        var updates = Array.isArray(r.updates) ? r.updates : [];
        var updatesHtml = updates.length
          ? '<ul style="margin:0;padding-left:18px">' +
              updates.map(function (u) { return '<li>' + esc(u) + '</li>'; }).join('') +
            '</ul>'
          : '—';
        var name = esc(r.admin_name || '—');
        if (r.admin_email) name += '<br><span class="muted" style="font-size:.8rem">' + esc(r.admin_email) + '</span>';
        var len = sessionLength(r.login_at, r.logout_at);
        return (
          '<tr>' +
          '<td>' + name + '</td>' +
          '<td class="admin-date">' + esc(r.login_at || '—') + '</td>' +
          '<td class="admin-date">' + (r.logout_at ? esc(r.logout_at) : '<span class="admin-tag">Active</span>') + '</td>' +
          '<td>' + (len || '—') + '</td>' +
          '<td class="admin-msg-cell">' + updatesHtml + '</td>' +
          '</tr>'
        );
      })
      .join('');
  }

  function initDashboard() {
    var root = document.getElementById('adminDash');
    if (!root) return;

    // If the admin has been idle for over an hour, sign out immediately
    // (this covers reloading the page after the session went stale).
    if (isIdleExpired()) {
      logoutForIdle();
      return;
    }
    setupIdleTimeout();

    var isSuper = false; // current admin's super-admin status
    var allRows = []; // submissions
    var subscriberRows = []; // newsletter subscribers
    var registrationRows = []; // trek registrations
    var adminRows = []; // admins

    // ── small utilities ───────────────────────────────────────────────────────
    function findById(arr, id) {
      for (var i = 0; i < arr.length; i++) {
        if (String(arr[i].id) === String(id)) return arr[i];
      }
      return null;
    }
    function openModal(id) {
      var m = document.getElementById(id);
      if (m) { m.classList.add('open'); m.setAttribute('aria-hidden', 'false'); }
    }
    function closeModal(id) {
      var m = document.getElementById(id);
      if (m) { m.classList.remove('open'); m.setAttribute('aria-hidden', 'true'); }
    }
    function hideMsg(elId) {
      var el = document.getElementById(elId);
      if (el) { el.style.display = 'none'; el.textContent = ''; }
    }
    function errText(res) {
      return (
        (res && res.data && (res.data.error || (res.data.errors && res.data.errors.join(' ')))) ||
        'Something went wrong. Please try again.'
      );
    }
    function guard401(res) {
      if (res.status === 401) {
        clearToken();
        window.location.href = '/admin-login';
        return true;
      }
      return false;
    }

    // ── row selection controllers (single radio-select per table) ─────────────
    function setupTableActions(opts) {
      var tbody = document.getElementById(opts.tbodyId);
      var editBtn = document.getElementById(opts.editBtnId);
      var delBtn = document.getElementById(opts.deleteBtnId);
      var selectedId = null;
      function setEnabled(on) {
        if (editBtn) editBtn.disabled = !on;
        if (delBtn) delBtn.disabled = !on;
      }
      function markRows() {
        if (!tbody) return;
        var trs = tbody.querySelectorAll('tr');
        for (var i = 0; i < trs.length; i++) {
          trs[i].classList.toggle('is-selected', trs[i].getAttribute('data-id') === String(selectedId));
        }
      }
      if (tbody) {
        tbody.addEventListener('change', function (e) {
          var t = e.target;
          if (t && t.classList && t.classList.contains('row-sel')) {
            selectedId = t.value;
            setEnabled(true);
            markRows();
          }
        });
      }
      if (editBtn) editBtn.addEventListener('click', function () {
        if (selectedId != null) opts.onEdit(selectedId);
      });
      if (delBtn) delBtn.addEventListener('click', function () {
        if (selectedId != null) opts.onDelete(selectedId);
      });
      return {
        reset: function () { selectedId = null; setEnabled(false); markRows(); },
      };
    }

    var subsSel = setupTableActions({
      tbodyId: 'subsBody', editBtnId: 'subsEditBtn', deleteBtnId: 'subsDeleteBtn',
      onEdit: openEditSubmission, onDelete: removeSubmission,
    });
    var subscribersSel = setupTableActions({
      tbodyId: 'subscribersBody', editBtnId: 'subscribersEditBtn', deleteBtnId: 'subscribersDeleteBtn',
      onEdit: openEditSubscriber, onDelete: removeSubscriber,
    });
    var regsSel = setupTableActions({
      tbodyId: 'regsBody', editBtnId: 'regsEditBtn', deleteBtnId: 'regsDeleteBtn',
      onEdit: openEditRegistration, onDelete: removeRegistration,
    });
    var adminsSel = setupTableActions({
      tbodyId: 'adminsBody', editBtnId: 'adminsEditBtn', deleteBtnId: 'adminsDeleteBtn',
      onEdit: openEditAdmin, onDelete: removeAdmin,
    });

    // ── submissions (registered users): edit + delete ────────────────────────
    function fillTypeSelect(sel, current) {
      if (!sel) return;
      sel.innerHTML = '';
      var keys = Object.keys(TYPE_LABELS);
      if (current && keys.indexOf(current) === -1) keys.push(current);
      keys.forEach(function (k) {
        var o = document.createElement('option');
        o.value = k;
        o.textContent = TYPE_LABELS[k] || k;
        if (k === current) o.selected = true;
        sel.appendChild(o);
      });
    }
    function openEditSubmission(id) {
      var row = findById(allRows, id);
      if (!row) return;
      var f = document.getElementById('editSubmissionForm').elements;
      f['id'].value = row.id;
      f['name'].value = row.name || '';
      f['email'].value = row.email || '';
      f['phone'].value = row.phone || '';
      fillTypeSelect(document.getElementById('editSubmissionType'), row.form_type || 'contact');
      f['subject'].value = row.subject || trekOf(row) || '';
      f['message'].value = row.message || '';
      hideMsg('editSubmissionMsg');
      openModal('editSubmissionModal');
    }
    function removeSubmission(id) {
      var row = findById(allRows, id);
      var who = row ? (row.name || row.email || ('#' + id)) : ('#' + id);
      if (!window.confirm('Delete the record from ' + who + '? This cannot be undone.')) return;
      api('/api/submissions?id=' + encodeURIComponent(id), { method: 'DELETE' }).then(function (res) {
        if (guard401(res)) return;
        if (res.data && res.data.ok) loadSubs();
        else window.alert(errText(res));
      }).catch(function () { window.alert('Network error. Please try again.'); });
    }

    // ── newsletter subscribers: edit + delete ─────────────────────────────────
    function openEditSubscriber(id) {
      var row = findById(subscriberRows, id);
      if (!row) return;
      var f = document.getElementById('editSubscriberForm').elements;
      f['id'].value = row.id;
      f['email'].value = row.email || '';
      f['source'].value = row.source || '';
      hideMsg('editSubscriberMsg');
      openModal('editSubscriberModal');
    }
    function removeSubscriber(id) {
      var row = findById(subscriberRows, id);
      var who = row ? (row.email || ('#' + id)) : ('#' + id);
      if (!window.confirm('Delete subscriber ' + who + '? This cannot be undone.')) return;
      api('/api/subscribers?id=' + encodeURIComponent(id), { method: 'DELETE' }).then(function (res) {
        if (guard401(res)) return;
        if (res.data && res.data.ok) loadSubscribers();
        else window.alert(errText(res));
      }).catch(function () { window.alert('Network error. Please try again.'); });
    }

    // ── trek registrations (User Registered Trek): edit + delete ──────────────
    function openEditRegistration(id) {
      var row = findById(registrationRows, id);
      if (!row) return;
      var f = document.getElementById('editRegistrationForm').elements;
      f['id'].value = row.id;
      f['name'].value = row.name || '';
      f['email'].value = row.email || '';
      f['phone'].value = row.phone || '';
      f['people'].value = (row.people != null ? row.people : '');
      f['city'].value = row.city || '';
      f['tshirt_size'].value = row.tshirt_size || '';
      f['emergency_contact'].value = row.emergency_contact || '';
      f['trek'].value = row.trek || '';
      f['message'].value = row.message || '';
      hideMsg('editRegistrationMsg');
      openModal('editRegistrationModal');
    }
    function removeRegistration(id) {
      var row = findById(registrationRows, id);
      var who = row ? (row.name || row.email || ('#' + id)) : ('#' + id);
      if (!window.confirm('Delete the registration from ' + who + '? This cannot be undone.')) return;
      api('/api/registrations?id=' + encodeURIComponent(id), { method: 'DELETE' }).then(function (res) {
        if (guard401(res)) return;
        if (res.data && res.data.ok) loadRegistrations();
        else window.alert(errText(res));
      }).catch(function () { window.alert('Network error. Please try again.'); });
    }

    // ── admins: edit + delete (super admin only) ──────────────────────────────
    function openEditAdmin(id) {
      if (!isSuper) return;
      var row = findById(adminRows, id);
      if (!row) return;
      var f = document.getElementById('editAdminForm').elements;
      f['id'].value = row.id;
      f['name'].value = row.name || '';
      f['email'].value = row.email || '';
      f['password'].value = '';
      f['is_super'].checked = !!row.is_super;
      hideMsg('editAdminMsg');
      openModal('editAdminModal');
    }
    function removeAdmin(id) {
      if (!isSuper) return;
      var row = findById(adminRows, id);
      var who = row ? (row.name || row.email || ('#' + id)) : ('#' + id);
      if (!window.confirm('Remove admin ' + who + '? They will lose access immediately.')) return;
      api('/api/admins?id=' + encodeURIComponent(id), { method: 'DELETE' }).then(function (res) {
        if (guard401(res)) return;
        if (res.data && res.data.ok) loadAdmins();
        else window.alert(errText(res));
      }).catch(function () { window.alert('Network error. Please try again.'); });
    }

    // ── modal edit-form submissions ───────────────────────────────────────────
    function wireEditForm(formId, msgId, buildBody, urlBase, onDone) {
      var form = document.getElementById(formId);
      if (!form) return;
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var body = buildBody(form.elements);
        if (body === false) return; // validation failed inside buildBody
        var id = form.elements['id'].value;
        var msg = document.getElementById(msgId);
        var btn = form.querySelector('[type="submit"]');
        btn.disabled = true;
        api(urlBase + '?id=' + encodeURIComponent(id), { method: 'PUT', body: body }).then(function (res) {
          btn.disabled = false;
          if (res.status >= 200 && res.status < 300 && res.data && res.data.ok) {
            var modal = form.closest('.modal');
            if (modal) closeModal(modal.id);
            onDone();
          } else {
            showMsg(msg, errText(res), false);
          }
        }).catch(function () {
          btn.disabled = false;
          showMsg(msg, 'Network error. Please try again.', false);
        });
      });
    }

    wireEditForm('editSubmissionForm', 'editSubmissionMsg', function (f) {
      return {
        name: f['name'].value.trim(),
        email: f['email'].value.trim(),
        phone: f['phone'].value.trim(),
        form_type: f['form_type'].value,
        subject: f['subject'].value.trim(),
        message: f['message'].value.trim(),
      };
    }, '/api/submissions', function () { loadSubs(); });

    wireEditForm('editSubscriberForm', 'editSubscriberMsg', function (f) {
      return {
        email: f['email'].value.trim(),
        source: f['source'].value.trim(),
      };
    }, '/api/subscribers', function () { loadSubscribers(); });

    wireEditForm('editRegistrationForm', 'editRegistrationMsg', function (f) {
      return {
        name: f['name'].value.trim(),
        email: f['email'].value.trim(),
        phone: f['phone'].value.trim(),
        people: f['people'].value.trim(),
        city: f['city'].value.trim(),
        tshirt_size: f['tshirt_size'].value,
        emergency_contact: f['emergency_contact'].value.trim(),
        trek: f['trek'].value.trim(),
        message: f['message'].value.trim(),
      };
    }, '/api/registrations', function () { loadRegistrations(); });

    wireEditForm('editAdminForm', 'editAdminMsg', function (f) {
      var body = {
        name: f['name'].value.trim(),
        email: f['email'].value.trim(),
        is_super: f['is_super'].checked,
      };
      var pw = f['password'].value;
      if (pw) {
        if (pw.length < 8) {
          showMsg(document.getElementById('editAdminMsg'), 'Password must be at least 8 characters.', false);
          return false;
        }
        body.password = pw;
      }
      return body;
    }, '/api/admins', function () { loadAdmins(); });

    // Close modals via [data-close], backdrop click, or the Escape key.
    document.addEventListener('click', function (e) {
      var t = e.target;
      var closer = t.closest ? t.closest('[data-close]') : null;
      if (closer) {
        var m = closer.closest('.modal');
        if (m) closeModal(m.id);
      } else if (t.classList && t.classList.contains('modal')) {
        closeModal(t.id);
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        var open = document.querySelectorAll('.modal.open');
        for (var i = 0; i < open.length; i++) closeModal(open[i].id);
      }
    });

    // ── session guard + initial load ──────────────────────────────────────────
    api('/api/admin/session').then(function (res) {
      if (res.status !== 200 || !res.data.ok) {
        clearToken();
        window.location.href = '/admin-login';
        return;
      }
      var admin = res.data.admin || {};
      isSuper = !!admin.is_super;
      var who = document.getElementById('adminWho');
      if (who) who.textContent = admin.name + ' · ' + admin.email + (isSuper ? ' · Super admin' : '');
      var adminsActions = document.getElementById('adminsActions');
      var adminsHint = document.getElementById('adminsHint');
      if (isSuper) {
        if (adminsActions) adminsActions.style.display = '';
        if (adminsHint) adminsHint.textContent = 'Select an admin to edit or delete.';
      } else {
        if (adminsActions) adminsActions.style.display = 'none';
        if (adminsHint) adminsHint.textContent = 'Only super admins can edit or delete admins.';
      }
      // Audit logs are visible to super admins only.
      var auditSection = document.getElementById('auditSection');
      if (auditSection) auditSection.style.display = isSuper ? '' : 'none';
      loadSubs();
      loadSubscribers();
      loadRegistrations();
      loadAdmins();
      loadTreksManagement();
      if (isSuper) loadAudit();
    });

    function loadSubs() {
      var status = document.getElementById('subsStatus');
      if (status) status.textContent = 'Loading…';
      api('/api/submissions?limit=200').then(function (res) {
        if (guard401(res)) return;
        if (!res.data.ok) {
          if (status) status.textContent = 'Failed to load submissions.';
          return;
        }
        // Trek registrations now live in their own table — keep them out here.
        allRows = (res.data.data || []).filter(function (r) { return r.form_type !== 'registration'; });
        if (status) status.textContent = '';
        updateStats(allRows);
        buildFilter(allRows);
        renderRows(allRows, currentFilter());
        subsSel.reset();
      });
    }

    function currentFilter() {
      var sel = document.getElementById('typeFilter');
      return sel ? sel.value : '';
    }

    function loadSubscribers() {
      api('/api/subscribers?limit=500').then(function (res) {
        if (guard401(res)) return;
        if (!res.data || !res.data.ok) return;
        subscriberRows = res.data.data || [];
        var stat = document.getElementById('statSubs');
        if (stat) stat.textContent = res.data.total != null ? res.data.total : subscriberRows.length;
        renderSubscribers(subscriberRows);
        subscribersSel.reset();
      });
    }

    function loadAdmins() {
      api('/api/admins').then(function (res) {
        if (guard401(res)) return;
        if (!res.data || !res.data.ok) return;
        adminRows = res.data.data || [];
        var stat = document.getElementById('statAdmins');
        if (stat) stat.textContent = res.data.total != null ? res.data.total : adminRows.length;
        renderAdmins(adminRows, isSuper);
        adminsSel.reset();
      });
    }

    function loadAudit() {
      if (!isSuper) return;
      api('/api/admin/audit?limit=200').then(function (res) {
        if (guard401(res)) return;
        if (!res.data || !res.data.ok) return;
        renderAuditLogs(res.data.data || []);
      });
    }

    function loadRegistrations() {
      var status = document.getElementById('regsStatus');
      if (status) status.textContent = 'Loading…';
      api('/api/registrations?limit=500').then(function (res) {
        if (guard401(res)) return;
        if (!res.data || !res.data.ok) {
          if (status) status.textContent = 'Failed to load registrations.';
          return;
        }
        registrationRows = res.data.data || [];
        if (status) status.textContent = '';
        var stat = document.getElementById('statRegs');
        if (stat) stat.textContent = res.data.total != null ? res.data.total : registrationRows.length;
        renderRegistrations(registrationRows);
        regsSel.reset();
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
      var contacts = document.getElementById('statContacts');
      if (total) total.textContent = rows.length;
      if (contacts) contacts.textContent = rows.filter(function (r) { return r.form_type === 'contact'; }).length;
      // statRegs is owned by loadRegistrations (dedicated trek_registrations table).
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
        subsSel.reset();
      });
    }

    var logout = document.getElementById('logoutBtn');
    if (logout) {
      logout.addEventListener('click', function () {
        notifyLogout();
        clearToken();
        window.location.href = '/admin-login';
      });
    }

    var refresh = document.getElementById('refreshBtn');
    if (refresh) {
      refresh.addEventListener('click', function () {
        loadSubs();
        loadSubscribers();
        loadRegistrations();
        loadAdmins();
        loadTreksManagement();
        loadAudit();
      });
    }
  }

  // ── Boot ────────────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    // If already logged in, skip login/signup pages.
    if ((document.getElementById('loginForm') || document.getElementById('signupForm')) && getToken()) {
      if (isIdleExpired()) {
        // Session went stale from inactivity — clear it and stay on login.
        clearToken();
      } else {
        api('/api/admin/session').then(function (res) {
          if (res.status === 200 && res.data.ok) {
            window.location.href = '/admin';
          } else {
            clearToken();
          }
        });
      }
    }
    initLogin();
    initSignup();
    initDashboard();
  });
})();
