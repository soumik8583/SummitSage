'use strict';

/**
 * Summit Sage — Modify Trek page.
 * Loads treks into a dropdown (label = name, value = Trek ID), shows the
 * selected trek's fields locked, lets the admin unlock individual fields with
 * the pencil icon, then saves changes back to the "Trek" table (PUT).
 */
(function () {
  var TOKEN_KEY = 'ss_admin_token';
  var current = null;       // currently loaded trek row
  var newImageDataUrl = ''; // set only if the admin uploads a replacement

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

  function field(name) {
    return document.querySelector('[data-field="' + name + '"]');
  }

  function resizeImage(file, cb) {
    var reader = new FileReader();
    reader.onload = function (e) {
      var img = new Image();
      img.onload = function () {
        var maxW = 1000;
        var scale = Math.min(1, maxW / img.width);
        var w = Math.round(img.width * scale);
        var h = Math.round(img.height * scale);
        var canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        try { cb(canvas.toDataURL('image/jpeg', 0.78)); }
        catch (err) { cb(e.target.result); }
      };
      img.onerror = function () { cb(''); };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function daysBetween(a, b) {
    if (!a || !b) return null;
    var d = (new Date(b) - new Date(a)) / 86400000;
    if (!isFinite(d)) return null;
    return Math.max(1, Math.round(d) + 1);
  }

  function dateOnly(v) {
    if (!v) return '';
    return String(v).slice(0, 10);
  }

  function lockAll() {
    document.querySelectorAll('[data-field]').forEach(function (el) { el.disabled = true; });
    document.querySelectorAll('.edit-toggle').forEach(function (b) {
      b.classList.remove('active');
      b.innerHTML = '<i class="fa-solid fa-pen"></i>';
    });
  }

  function loadTrekList(selectId) {
    return api('/api/admin/treks').then(function (res) {
      if (res.status === 401) { window.location.href = '/admin-login'; return; }
      var sel = document.getElementById('trekSelect');
      if (!sel || !res.data || !res.data.ok) return;
      var rows = res.data.data || [];
      sel.innerHTML = '<option value="">— Choose a trek —</option>' +
        rows.map(function (t) {
          return '<option value="' + t.id + '">' + (t.name || ('Trek #' + t.id)) + '</option>';
        }).join('');
      if (selectId) sel.value = String(selectId);
    });
  }

  function loadTrek(id) {
    newImageDataUrl = '';
    api('/api/admin/treks?id=' + encodeURIComponent(id)).then(function (res) {
      if (res.status === 401) { window.location.href = '/admin-login'; return; }
      if (!res.data || !res.data.ok || !res.data.data) {
        showMsg('Could not load that trek.', false);
        return;
      }
      current = res.data.data;
      var section = document.getElementById('editSection');
      if (section) section.style.display = 'block';
      var idLabel = document.getElementById('editTrekId');
      if (idLabel) idLabel.textContent = '(Trek ID: ' + current.id + ')';

      if (field('name')) field('name').value = current.name || '';
      if (field('location')) field('location').value = current.region || '';
      if (field('altitude')) field('altitude').value = current.max_altitude != null ? current.max_altitude : '';
      if (field('details')) field('details').value = current.description || '';
      if (field('startDate')) field('startDate').value = dateOnly(current.start_date);
      if (field('endDate')) field('endDate').value = dateOnly(current.end_date);
      if (field('price')) field('price').value = current.price != null ? current.price : '';
      var totalSeats = current.total_seats != null && current.total_seats !== '' ? Number(current.total_seats) : '';
      var seatsLeft = current.seats_left != null && current.seats_left !== '' ? Number(current.seats_left) : '';
      if (field('totalSeats')) field('totalSeats').value = totalSeats;
      if (field('bookedSeats')) field('bookedSeats').value = (totalSeats !== '' && seatsLeft !== '') ? Math.max(0, totalSeats - seatsLeft) : '';
      if (field('availableSeats')) field('availableSeats').value = seatsLeft;
      if (field('imageFile')) field('imageFile').value = '';

      var imgEl = document.getElementById('currentImage');
      if (imgEl) {
        if (current.has_image || current.image) {
          imgEl.src = '/api/trek-image?id=' + current.id + '&t=' + Date.now();
          imgEl.style.display = 'block';
        } else {
          imgEl.style.display = 'none';
        }
      }
      lockAll();
    });
  }

  function initToggles() {
    document.querySelectorAll('.edit-toggle').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var name = btn.getAttribute('data-edit');
        var el = field(name);
        if (!el) return;
        var nowEnabled = el.disabled;
        el.disabled = !nowEnabled;
        btn.classList.toggle('active', nowEnabled);
        btn.innerHTML = nowEnabled ? '<i class="fa-solid fa-lock-open"></i>' : '<i class="fa-solid fa-pen"></i>';
        if (nowEnabled && el.type !== 'file') el.focus();
      });
    });

    // Available seats = Total − Booked (auto-computed).
    function computeAvailable() {
      var t = parseInt(field('totalSeats') && field('totalSeats').value, 10) || 0;
      var b = parseInt(field('bookedSeats') && field('bookedSeats').value, 10) || 0;
      if (field('availableSeats')) field('availableSeats').value = Math.max(0, t - b);
    }
    if (field('totalSeats')) field('totalSeats').addEventListener('input', computeAvailable);
    if (field('bookedSeats')) field('bookedSeats').addEventListener('input', computeAvailable);

    var fileInput = field('imageFile');
    if (fileInput) {
      fileInput.addEventListener('change', function () {
        var f = fileInput.files && fileInput.files[0];
        if (!f) { newImageDataUrl = ''; return; }
        resizeImage(f, function (dataUrl) {
          newImageDataUrl = dataUrl || '';
          var imgEl = document.getElementById('currentImage');
          if (imgEl && newImageDataUrl) { imgEl.src = newImageDataUrl; imgEl.style.display = 'block'; }
        });
      });
    }
  }

  function save() {
    if (!current) return;
    var saveBtn = document.getElementById('saveBtn');
    saveBtn.disabled = true;

    var startDate = field('startDate') ? field('startDate').value : '';
    var endDate = field('endDate') ? field('endDate').value : '';
    var total = field('totalSeats') ? (parseInt(field('totalSeats').value, 10) || 0) : null;
    var booked = field('bookedSeats') ? (parseInt(field('bookedSeats').value, 10) || 0) : null;
    var body = {
      id: current.id,
      name: field('name') ? field('name').value.trim() : undefined,
      location: field('location') ? field('location').value.trim() : undefined,
      altitude: field('altitude') ? field('altitude').value : undefined,
      details: field('details') ? field('details').value.trim() : undefined,
      startDate: startDate,
      endDate: endDate,
      price: field('price') ? field('price').value : undefined,
      totalSeats: field('totalSeats') ? field('totalSeats').value : undefined,
      seatsLeft: (total != null && booked != null) ? Math.max(0, total - booked) : undefined,
      days: daysBetween(startDate, endDate),
    };
    if (newImageDataUrl) body.image = newImageDataUrl;

    api('/api/admin/treks', { method: 'PUT', body: body }).then(function (res) {
      saveBtn.disabled = false;
      if (res.status === 401) { window.location.href = '/admin-login'; return; }
      if (res.data && res.data.ok) {
        showMsg('Changes saved to "' + body.name + '".', true);
        loadTrekList(current.id);
        loadTrek(current.id);
      } else {
        showMsg((res.data && res.data.error) || 'Could not save changes.', false);
      }
    }).catch(function () {
      saveBtn.disabled = false;
      showMsg('Network error. Please try again.', false);
    });
  }

  function del() {
    if (!current) return;
    if (!window.confirm('Delete "' + (current.name || 'this trek') + '"? This removes it from the public site.')) return;
    api('/api/admin/treks?id=' + encodeURIComponent(current.id), { method: 'DELETE' }).then(function (res) {
      if (res.status === 401) { window.location.href = '/admin-login'; return; }
      if (res.data && res.data.ok) {
        showMsg('Trek deleted.', true);
        current = null;
        document.getElementById('editSection').style.display = 'none';
        loadTrekList();
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
      loadTrekList().then(function () {
        // Auto-open a trek if arriving from the dashboard list (?id=<n>).
        var id = new URLSearchParams(location.search).get('id');
        if (id) {
          var sel = document.getElementById('trekSelect');
          if (sel) sel.value = String(id);
          loadTrek(id);
        }
      });
      initToggles();
    });

    var sel = document.getElementById('trekSelect');
    sel.addEventListener('change', function () {
      if (sel.value) loadTrek(sel.value);
      else { document.getElementById('editSection').style.display = 'none'; current = null; }
    });

    var saveBtn = document.getElementById('saveBtn');
    if (saveBtn) saveBtn.addEventListener('click', save);
    var delBtn = document.getElementById('deleteBtn');
    if (delBtn) delBtn.addEventListener('click', del);

    var logout = document.getElementById('logoutBtn');
    if (logout) logout.addEventListener('click', function () {
      localStorage.removeItem(TOKEN_KEY);
      window.location.href = '/admin-login';
    });
  });
})();
