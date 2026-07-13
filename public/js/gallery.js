(function () {
  var state = {
    moments: [],
    loaded: false,
    occasionFilter: null,
    boxFilter: null
  };

  function t(key) { return window.t ? window.t(key) : key; }
  function escHtml(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function getAuthCode() {
    try {
      var auth = JSON.parse(localStorage.getItem('alice_auth') || 'null');
      return auth ? auth.code : '';
    } catch (e) { return ''; }
  }

  function filtered() {
    return state.moments.filter(function (m) {
      if (state.occasionFilter && m.occasion !== state.occasionFilter) return false;
      if (state.boxFilter) {
        var lower = (m.product || '').toLowerCase();
        var boxKey = lower.indexOf('mini') >= 0 ? 'mini' : lower.indexOf('tote') >= 0 ? 'tote' : 'canvas';
        if (boxKey !== state.boxFilter) return false;
      }
      return true;
    });
  }

  function uniqueOccasions() {
    var seen = {};
    var list = [];
    state.moments.forEach(function (m) {
      if (m.occasion && !seen[m.occasion]) { seen[m.occasion] = true; list.push(m.occasion); }
    });
    return list;
  }

  function render() {
    var el = document.getElementById('gallery-flow');
    if (!el) return;

    if (!state.loaded) {
      el.innerHTML = '<p class="gallery-loading">' + t('gallery.loading') + '</p>';
      return;
    }

    var occasions = uniqueOccasions();
    var items = filtered();

    var html = '';

    // Filter bar
    html += '<div class="gallery-filters">';
    // Occasion filters
    if (occasions.length) {
      html += '<button class="gallery-filter-btn' + (!state.occasionFilter ? ' active' : '') + '" data-occ="">' + t('gallery.filter.all') + '</button>';
      occasions.forEach(function (occ) {
        html += '<button class="gallery-filter-btn' + (state.occasionFilter === occ ? ' active' : '') + '" data-occ="' + escHtml(occ) + '">' + escHtml(occ) + '</button>';
      });
      html += '<span class="gallery-filter-sep"></span>';
    }
    // Box type filters
    ['', 'canvas', 'mini', 'tote'].forEach(function (box) {
      var label = box ? t('gallery.filter.' + box) : t('gallery.filter.all');
      html += '<button class="gallery-filter-btn box-filter' + (state.boxFilter === (box || null) ? ' active' : '') + '" data-box="' + escHtml(box) + '">' + label + '</button>';
    });
    html += '</div>';

    // Grid
    if (!items.length) {
      html += '<p class="gallery-empty">' + t('gallery.empty') + '</p>';
    } else {
      html += '<div class="gallery-grid">';
      items.forEach(function (m) {
        html += '<div class="gallery-card">';
        html += '<img class="gallery-img" src="' + escHtml(m.image_url) + '" alt="" loading="lazy">';
        html += '<div class="gallery-card-body">';
        if (m.occasion) html += '<span class="gallery-badge">' + escHtml(m.occasion) + '</span>';
        if (m.quote) html += '<p class="gallery-quote">“' + escHtml(m.quote) + '”</p>';
        if (m.name) html += '<p class="gallery-name">' + escHtml(m.name) + '</p>';
        html += '</div></div>';
      });
      html += '</div>';
    }

    el.innerHTML = html;

    // Filter events
    el.querySelectorAll('[data-occ]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.occasionFilter = btn.getAttribute('data-occ') || null;
        render();
      });
    });
    el.querySelectorAll('[data-box]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.boxFilter = btn.getAttribute('data-box') || null;
        render();
      });
    });
  }

  window.initGallery = function () {
    var el = document.getElementById('gallery-flow');
    if (!el) return;
    if (state.loaded) { render(); return; }
    state.loaded = false;
    render();
    var code = getAuthCode();
    fetch('/api/moments/public', { headers: { 'x-access-code': code } })
      .then(function (r) {
        if (!r.ok) throw new Error('status ' + r.status);
        return r.json();
      })
      .then(function (rows) {
        state.moments = rows;
        state.loaded = true;
        render();
      })
      .catch(function () {
        var el2 = document.getElementById('gallery-flow');
        if (el2) el2.innerHTML = '<p class="gallery-empty">' + t('gallery.empty') + '</p>';
      });
  };
})();
