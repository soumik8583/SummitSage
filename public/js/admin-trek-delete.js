'use strict';

/**
 * Summit Sage — Delete / Abandon Trek page.
 * Same trek dropdown as the modify page. Abandon = hide from the public list
 * (PUT active=0); Restore = show again (active=1); Delete = remove permanently.
 */
(function () {
  var TOKEN_KEY = 'ss_admin_token';
  var current = null;

  function getToken() { return localStorage.getItem(TOKEN_KEY) || ''; }

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
      return r.json().then(function (d) { return { status: r.status, data: d }; })
        .catch(function () { return { status: r.status, data: {} }; });
    });
  }

  function showMsg(text, ok) {
    var el = document.getElementById('trekMsg');
    if (!el) return;
    el.textContent = text;
    el.className = 'admin-msg ' + (ok ? 'is-ok' : 'is-err');
    el.style.display = 'block';
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function loadList(keepId) {
    return api('/api/admin/treks').then(function (res) {
      if (res.status === 401) { window.location.href = '/admin-login'; return; }
      var sel = document.getElementById('trekSelect');
      if (!sel || !res.data || !res.data.ok) return;
      var rows = res.data.data || [];
      sel.innerHTML = '<option value="">— Choose a trek —</option>' +
        rows.map(function (t) {
          var hidden = Number(t.active) === 0 ? ' (hidden)' : '';
          return '<option value="' + t.id + '">' + (t.name || ('Trek #' + t.id)) + hidden + '</option>';
        }).join('');
      window._trekRows = rows;
      if (keepId) { sel.value = String(keepId); showTrek(keepId); }
    });
  }

  function showTrek(id) {
    var rows = window._trekRows || [];
    current = rows.filter(function (t) { return String(t.id) === String(id); })[0] || null;
    var section = document.getElementById('actionSection');
    if (!current) { if (section) section.style.display = 'none'; return; }
    section.style.display = 'block';
    document.getElementById('trekName').textContent = current.name + '  (Trek ID: ' + current.id + ')';
    var isActive = Number(current.active) !== 0;
    document.getElementById('trekStatus').textContent = isActive
      ? 'Status: visible on the public trek list.'
      : 'Status: abandoned — currently hidden from users.';
    document.getElementById('abandonBtn').style.display = isActive ? '' : 'none';
    document.getElementById('restoreBtn').style.display = isActive ? 'none' : '';
  }

  function setActive(active) {
    if (!current) return;
    api('/api/admin/treks', { method: 'PUT', body: { id: current.id, active: active } }).then(function (res) {
      if (res.status === 401) { window.location.href = '/admin-login'; return; }
      if (res.data && res.data.ok) {
        showMsg(active ? 'Trek restored — now visible to users.' : 'Trek abandoned — hidden from the public trek list.', true);
        loadList(current.id);
      } else {
        showMsg((res.data && res.data.error) || 'Could not update the trek.', false);
      }
    });
  }

  function del() {
    if (!current) return;
    if (!window.confirm('Permanently delete "' + (current.name || 'this trek') + '"? This cannot be undone.')) return;
    api('/api/admin/treks?id=' + encodeURIComponent(current.id), { method: 'DELETE' }).then(function (res) {
      if (res.status === 401) { window.location.href = '/admin-login'; return; }
      if (res.data && res.data.ok) {
        showMsg('Trek deleted permanently.', true);
        current = null;
        document.getElementById('actionSection').style.display = 'none';
        document.getElementById('trekSelect').value = '';
        loadList();
      } else {
        showMsg((res.data && res.data.error) || 'Could not delete the trek.', false);
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!document.getElementById('trekSelect')) return;
    api('/api/admin/session').then(function (res) {
      if (res.status !== 200 || !res.data.ok) { window.location.href = '/admin-login'; return; }
      var who = document.getElementById('adminWho');
      if (who) who.textContent = res.data.admin.name + ' · ' + res.data.admin.email;
      loadList();
    });

    var sel = document.getElementById('trekSelect');
    sel.addEventListener('change', function () {
      if (sel.value) showTrek(sel.value);
      else { document.getElementById('actionSection').style.display = 'none'; current = null; }
    });

    document.getElementById('abandonBtn').addEventListener('click', function () { setActive(0); });
    document.getElementById('restoreBtn').addEventListener('click', function () { setActive(1); });
    document.getElementById('deleteBtn').addEventListener('click', del);

    var logout = document.getElementById('logoutBtn');
    if (logout) logout.addEventListener('click', function () {
      localStorage.removeItem(TOKEN_KEY);
      window.location.href = '/admin-login';
    });
  });
})();
