'use strict';

/**
 * Summit Sage — Add Trek page.
 * Captures the trek fields, resizes the uploaded image client-side into a
 * compact data URL, and POSTs to /api/admin/treks (the "Trek" table).
 */
(function () {
  var TOKEN_KEY = 'ss_admin_token';
  var imageDataUrl = '';

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

  // Resize an image file into a compact JPEG data URL (max 1000px wide).
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
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        try {
          cb(canvas.toDataURL('image/jpeg', 0.78));
        } catch (err) {
          cb(e.target.result); // fall back to original
        }
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

  function initForm() {
    var form = document.getElementById('trekForm');
    if (!form) return;

    // Available seats = Total − Booked (auto-computed, read-only).
    function updateAvailable() {
      var total = parseInt(form.totalSeats.value, 10) || 0;
      var booked = parseInt(form.bookedSeats.value, 10) || 0;
      form.availableSeats.value = Math.max(0, total - booked);
    }
    if (form.totalSeats) form.totalSeats.addEventListener('input', updateAvailable);
    if (form.bookedSeats) form.bookedSeats.addEventListener('input', updateAvailable);

    var fileInput = document.getElementById('imageFile');
    var preview = document.getElementById('imagePreview');
    if (fileInput) {
      fileInput.addEventListener('change', function () {
        var f = fileInput.files && fileInput.files[0];
        if (!f) { imageDataUrl = ''; if (preview) preview.style.display = 'none'; return; }
        resizeImage(f, function (dataUrl) {
          imageDataUrl = dataUrl || '';
          if (preview && imageDataUrl) { preview.src = imageDataUrl; preview.style.display = 'block'; }
        });
      });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = form.querySelector('[type="submit"]');
      btn.disabled = true;

      var startDate = form.startDate.value;
      var endDate = form.endDate.value;
      var total = parseInt(form.totalSeats.value, 10) || 0;
      var booked = parseInt(form.bookedSeats.value, 10) || 0;
      var body = {
        name: form.name.value.trim(),
        location: form.location.value.trim(),
        altitude: form.altitude.value,
        details: form.details.value.trim(),
        startDate: startDate,
        endDate: endDate,
        price: form.price.value,
        totalSeats: form.totalSeats.value,
        seatsLeft: Math.max(0, total - booked),
        image: imageDataUrl,
        days: daysBetween(startDate, endDate),
      };

      api('/api/admin/treks', { method: 'POST', body: body }).then(function (res) {
        btn.disabled = false;
        if (res.status === 401) { window.location.href = '/admin-login'; return; }
        if (res.status >= 200 && res.status < 300 && res.data && res.data.ok) {
          showMsg('Trek "' + body.name + '" added and is now live on the site.', true);
          form.reset();
          imageDataUrl = '';
          if (preview) preview.style.display = 'none';
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
    api('/api/admin/session').then(function (res) {
      if (res.status !== 200 || !res.data.ok) { window.location.href = '/admin-login'; return; }
      var who = document.getElementById('adminWho');
      if (who) who.textContent = res.data.admin.name + ' · ' + res.data.admin.email;
      initForm();
    });
    var logout = document.getElementById('logoutBtn');
    if (logout) logout.addEventListener('click', function () {
      localStorage.removeItem(TOKEN_KEY);
      window.location.href = '/admin-login';
    });
  });
})();
