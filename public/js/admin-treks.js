'use strict';

/**
 * Summit Sage — Admin trek manager.
 * Add, list and delete admin-managed treks that appear on the public site.
 * Reuses the same session token as the rest of the admin area.
 */
(function () {
  var TOKEN_KEY = 'ss_admin_token';

  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || '';
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
      }).catch(function () {
        return { status: r.status, data: {} };
      });
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

  function renderList(rows) {
    var tbody = document.getElementById('trekListBody');
    if (!tbody) return;
    if (!rows || rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="admin-empty">No treks added yet.</td></tr>';
      return;
    }
    tbody.innerHTML = rows
      .map(function (t) {
        var price = t.price != null ? '₹' + Number(t.price).toLocaleString('en-IN') : '—';
        return (
          '<tr>' +
          '<td>' + esc(t.name) + '</td>' +
          '<td>' + esc(t.region || '—') + '</td>' +
          '<td><span class="admin-tag">' + esc(t.difficulty || '—') + '</span></td>' +
          '<td>' + price + '</td>' +
          '<td><a href="/trek-detail?trek=' + esc(t.slug) + '" target="_blank" rel="noopener">/' + esc(t.slug) + '</a></td>' +
          '<td><button class="btn btn-outline btn-sm" data-del="' + t.id + '" data-name="' + esc(t.name) + '"><i class="fa-solid fa-trash"></i></button></td>' +
          '</tr>'
        );
      })
      .join('');

    tbody.querySelectorAll('[data-del]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-del');
        var name = btn.getAttribute('data-name');
        if (!window.confirm('Delete "' + name + '"? This removes it from the public site.')) return;
        api('/api/admin/treks?id=' + encodeURIComponent(id), { method: 'DELETE' }).then(function (res) {
          if (res.status === 401) { window.location.href = '/admin-login'; return; }
          if (res.data && res.data.ok) loadList();
          else showMsg((res.data && res.data.error) || 'Could not delete the trek.', false);
        });
      });
    });
  }

  function loadList() {
    api('/api/admin/treks').then(function (res) {
      if (res.status === 401) { window.location.href = '/admin-login'; return; }
      if (res.data && res.data.ok) {
        var rows = res.data.data || [];
        var stat = document.getElementById('statTreks');
        if (stat) stat.textContent = rows.length;
        renderList(rows);
      }
    });
  }

  function initForm() {
    var form = document.getElementById('trekForm');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = form.querySelector('[type="submit"]');
      btn.disabled = true;

      var body = {
        name: form.name.value.trim(),
        region: form.region.value.trim(),
        base: form.base.value.trim(),
        difficulty: form.difficulty.value,
        season: form.season.value.trim(),
        days: form.days.value,
        distanceKm: form.distanceKm.value,
        maxAltitude: form.maxAltitude.value,
        price: form.price.value,
        earlyBird: form.earlyBird.value,
        totalSeats: form.totalSeats.value,
        seatsLeft: form.seatsLeft.value,
        startDate: form.startDate.value,
        rating: form.rating.value,
        image: form.image.value.trim(),
        tags: form.tags.value.trim(),
        blurb: form.blurb.value.trim(),
        description: form.description.value.trim(),
        highlights: form.highlights.value.trim(),
      };

      api('/api/admin/treks', { method: 'POST', body: body }).then(function (res) {
        btn.disabled = false;
        if (res.status === 401) { window.location.href = '/admin-login'; return; }
        if (res.status >= 200 && res.status < 300 && res.data && res.data.ok) {
          showMsg('Trek "' + body.name + '" added and is now live on the site.', true);
          form.reset();
          loadList();
        } else {
          var err = (res.data && (res.data.error || (res.data.errors && res.data.errors.join(' ')))) || 'Could not save the trek.';
          showMsg(err, false);
        }
      }).catch(function () {
        btn.disabled = false;
        showMsg('Network error. Please try again.', false);
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!document.getElementById('trekForm')) return;
    // Guard: require a valid admin session.
    api('/api/admin/session').then(function (res) {
      if (res.status !== 200 || !res.data.ok) {
        window.location.href = '/admin-login';
        return;
      }
      var who = document.getElementById('adminWho');
      if (who) who.textContent = res.data.admin.name + ' · ' + res.data.admin.email;
      initForm();
      loadList();
    });

    var logout = document.getElementById('logoutBtn');
    if (logout) {
      logout.addEventListener('click', function () {
        localStorage.removeItem(TOKEN_KEY);
        window.location.href = '/admin-login';
      });
    }
  });
})();
