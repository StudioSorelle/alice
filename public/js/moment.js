(function () {
  var state = {
    step: 0,
    products: [], occasions: [],
    product: null, file: null, previewUrl: null,
    occasion: null, quote: '', description: '', authorName: '', socialConsent: false
  };

  function t(key, vars) { return window.t ? window.t(key, vars) : key; }
  function escHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function escAttr(s) { return String(s).replace(/"/g, '&quot;'); }

  function render() {
    var el = document.getElementById('moment-flow');
    if (!el) return;
    if (state.step === 0) renderProduct(el);
    else if (state.step === 1) renderUpload(el);
    else if (state.step === 2) renderDetails(el);
  }

  // ── Step 1: which box ──
  function renderProduct(el) {
    var html = '<p class="flow-step-num">' + t('common.step', { n: 1, total: 3 }) + '</p>';
    html += '<p class="flow-question">' + t('share.q1') + '</p>';
    html += '<div class="option-grid" id="opt-grid">';
    state.products.forEach(function (p) {
      var sel = state.product === p.name ? ' active' : '';
      html += '<button class="option-btn' + sel + '" data-val="' + escAttr(p.name) + '">' + escHtml(p.name) + '</button>';
    });
    html += '</div>';
    html += '<div class="flow-nav"><button class="flow-next-btn" id="flow-next"' + (state.product ? '' : ' disabled') + '>' + t('common.next') + '</button></div>';
    el.innerHTML = html;

    var grid = document.getElementById('opt-grid');
    var nextBtn = document.getElementById('flow-next');
    if (grid) {
      grid.addEventListener('click', function (e) {
        var btn = e.target.closest('.option-btn');
        if (!btn) return;
        state.product = btn.getAttribute('data-val');
        grid.querySelectorAll('.option-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        if (nextBtn) nextBtn.disabled = false;
      });
    }
    if (nextBtn) nextBtn.addEventListener('click', function () { state.step = 1; render(); });
  }

  // ── Step 2: upload photo ──
  function renderUpload(el) {
    var html = '<p class="flow-step-num">' + t('common.step', { n: 2, total: 3 }) + '</p>';
    html += '<p class="flow-question">' + t('share.upload.label') + '</p>';

    if (state.previewUrl) {
      html += '<div class="upload-preview">';
      html += '<img src="' + escAttr(state.previewUrl) + '" class="upload-preview-img" alt="Preview">';
      html += '<button class="flow-ghost-btn" id="change-photo">' + t('share.upload.change') + '</button>';
      html += '</div>';
    } else {
      html += '<label class="upload-area" for="file-input">';
      html += '<span class="upload-area-inner">' + t('share.upload.btn') + '</span>';
      html += '</label>';
      html += '<input type="file" id="file-input" class="file-input-hidden" accept="image/*">';
    }

    html += '<div class="flow-nav">';
    html += '<button class="flow-ghost-btn" id="flow-back">' + t('common.back') + '</button>';
    html += '<button class="flow-next-btn" id="flow-next"' + (state.file ? '' : ' disabled') + '>' + t('common.next') + '</button>';
    html += '</div>';
    el.innerHTML = html;

    var fileInput = document.getElementById('file-input');
    var nextBtn = document.getElementById('flow-next');
    var backBtn = document.getElementById('flow-back');
    var changeBtn = document.getElementById('change-photo');

    if (fileInput) {
      fileInput.addEventListener('change', function () {
        var file = fileInput.files[0];
        if (!file) return;
        if (file.size > 20 * 1024 * 1024) { alert('Photo must be under 20 MB.'); return; }
        state.file = file;
        state.previewUrl = URL.createObjectURL(file);
        render();
      });
    }
    if (changeBtn) changeBtn.addEventListener('click', function () { state.file = null; state.previewUrl = null; render(); });
    if (nextBtn) nextBtn.addEventListener('click', function () { state.step = 2; render(); });
    if (backBtn) backBtn.addEventListener('click', function () { state.step = 0; render(); });
  }

  // ── Step 3: optional details ──
  function renderDetails(el) {
    var html = '<p class="flow-step-num">' + t('common.step', { n: 3, total: 3 }) + '</p>';
    html += '<p class="flow-question">' + t('share.details.label') + '</p>';

    html += '<p class="share-field-label">' + t('share.occasion.label') + '</p>';
    html += '<div class="option-grid share-occ-grid" id="occ-grid">';
    state.occasions.forEach(function (o) {
      var sel = state.occasion === o.name ? ' active' : '';
      html += '<button class="option-btn' + sel + '" data-occ="' + escAttr(o.name) + '">' + escHtml(o.name) + '</button>';
    });
    html += '</div>';

    html += '<p class="share-field-label">' + t('share.quote.label') + '</p>';
    html += '<textarea class="share-textarea" id="share-quote" placeholder="' + t('share.quote.ph') + '" rows="3">' + escHtml(state.quote) + '</textarea>';

    html += '<p class="share-field-label">' + t('share.desc.label') + '</p>';
    html += '<textarea class="share-textarea" id="share-desc" placeholder="' + t('share.desc.ph') + '" rows="4">' + escHtml(state.description) + '</textarea>';

    html += '<p class="share-field-label">' + t('share.name.label') + '</p>';
    html += '<input class="flow-other-input" id="share-name" placeholder="' + t('share.name.ph') + '" value="' + escAttr(state.authorName) + '">';

    html += '<div class="consent-wrap">';
    html += '<label class="consent-label"><input type="checkbox" id="share-consent"' + (state.socialConsent ? ' checked' : '') + '> ' + t('share.consent') + '</label>';
    html += '</div>';

    html += '<div class="flow-nav">';
    html += '<button class="flow-ghost-btn" id="flow-back">' + t('common.back') + '</button>';
    html += '<button class="flow-next-btn" id="flow-submit">' + t('share.submit') + '</button>';
    html += '</div>';
    el.innerHTML = html;

    var occGrid = document.getElementById('occ-grid');
    var quoteInput = document.getElementById('share-quote');
    var descInput = document.getElementById('share-desc');
    var nameInput = document.getElementById('share-name');
    var consentInput = document.getElementById('share-consent');
    var submitBtn = document.getElementById('flow-submit');
    var backBtn = document.getElementById('flow-back');

    if (occGrid) {
      occGrid.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-occ]');
        if (!btn) return;
        var val = btn.getAttribute('data-occ');
        if (state.occasion === val) {
          state.occasion = null;
          occGrid.querySelectorAll('[data-occ]').forEach(function (b) { b.classList.remove('active'); });
        } else {
          state.occasion = val;
          occGrid.querySelectorAll('[data-occ]').forEach(function (b) { b.classList.remove('active'); });
          btn.classList.add('active');
        }
      });
    }
    if (quoteInput) quoteInput.addEventListener('input', function () { state.quote = quoteInput.value; });
    if (descInput) descInput.addEventListener('input', function () { state.description = descInput.value; });
    if (nameInput) nameInput.addEventListener('input', function () { state.authorName = nameInput.value; });
    if (consentInput) consentInput.addEventListener('change', function () { state.socialConsent = consentInput.checked; });
    if (submitBtn) submitBtn.addEventListener('click', submitMoment);
    if (backBtn) backBtn.addEventListener('click', function () { state.step = 1; render(); });
  }

  // ── Submit: presign → upload → save ──
  function submitMoment() {
    var el = document.getElementById('moment-flow');
    el.innerHTML = '<div class="flow-loading"><div class="flow-spinner"></div><p class="flow-loading-text">' + t('share.uploading') + '</p></div>';

    fetch('/api/moments/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: state.file.name, contentType: state.file.type })
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.error) throw new Error(data.error);
        return fetch(data.url, {
          method: 'PUT', body: state.file,
          headers: { 'Content-Type': state.file.type }
        }).then(function (r) {
          if (!r.ok) throw new Error('Upload to storage failed (' + r.status + ')');
          return data.key;
        });
      })
      .then(function (key) {
        return fetch('/api/moments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            product: state.product, occasion: state.occasion,
            quote: state.quote, description: state.description,
            name: state.authorName, imageKey: key, socialConsent: state.socialConsent
          })
        }).then(function (r) { return r.json(); });
      })
      .then(function (data) {
        if (data.error) throw new Error(data.error);
        renderSuccess(document.getElementById('moment-flow'), data.imageUrl);
      })
      .catch(function (err) {
        var el2 = document.getElementById('moment-flow');
        if (!el2) return;
        el2.innerHTML = '<div class="flow-error"><p>' + escHtml(err.message || t('common.retry')) + '</p><button class="flow-ghost-btn" id="err-back">' + t('common.back') + '</button></div>';
        var rb = document.getElementById('err-back');
        if (rb) rb.addEventListener('click', function () { state.step = 2; render(); });
      });
  }

  function renderSuccess(el, imageUrl) {
    var html = '<div class="share-success">';
    if (imageUrl) html += '<img src="' + escAttr(imageUrl) + '" class="share-success-img" alt="' + t('share.success.title') + '">';
    html += '<p class="share-success-title">' + t('share.success.title') + '</p>';
    html += '<p class="share-success-sub">' + t('share.success.sub') + '</p>';
    html += '<button class="flow-ghost-btn" id="share-restart">' + t('share.restart') + '</button>';
    html += '</div>';
    el.innerHTML = html;
    var rb = document.getElementById('share-restart');
    if (rb) rb.addEventListener('click', initMoment);
  }

  window.initMoment = function () {
    state.step = 0;
    state.product = null; state.file = null; state.previewUrl = null;
    state.occasion = null; state.quote = ''; state.description = ''; state.authorName = ''; state.socialConsent = false;

    var el = document.getElementById('moment-flow');
    if (!el) return;

    var needProds = !state.products.length;
    var needOccs = !state.occasions.length;
    if (needProds || needOccs) {
      var pReq = needProds ? fetch('/api/products').then(function (r) { return r.json(); }) : Promise.resolve(state.products);
      var oReq = needOccs ? fetch('/api/occasions').then(function (r) { return r.json(); }) : Promise.resolve(state.occasions);
      Promise.all([pReq, oReq]).then(function (res) {
        state.products = res[0]; state.occasions = res[1]; render();
      }).catch(function () { render(); });
    } else {
      render();
    }
  };
})();
