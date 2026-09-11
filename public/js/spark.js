(function () {
  var TIMES = [
    { key: 'time.30min', val: '30 min' },
    { key: 'time.1h', val: '1 hour' },
    { key: 'time.2h', val: '2+ hours' }
  ];
  var ACTIVITY_TYPES = [
    { key: 'spark.studio_games', val: 'studio_games' },
    { key: 'spark.sorelle_talks', val: 'sorelle_talks' },
    { key: 'spark.mix', val: 'mix' }
  ];
  var HAIRPIN_OPTS = [
    { key: 'spark.hairpin_small', val: 'small' },
    { key: 'spark.hairpin_large', val: 'large' }
  ];
  var PEOPLE_OPTS = [2, 3, 4];

  function isHairclip(productName) {
    var lower = (productName || '').toLowerCase();
    return lower.indexOf('hairclip') >= 0 || lower.indexOf('dazzl') >= 0;
  }

  var state = {
    step: 0, answers: [], products: [], occasions: [], otherText: '', hairpinSize: ''
  };

  function t(key, vars) { return window.t ? window.t(key, vars) : key; }
  function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function escAttr(s) { return String(s).replace(/"/g,'&quot;'); }

  // Returns the logical slot for the current display step.
  // Slots: 0=product, 1=people, 2=time, 3=occasion, 4=acttype, 'hairpin'=hairpin size
  function getSlot(step) {
    if (isHairclip(state.answers[0])) {
      if (step === 0) return 0;
      if (step === 1) return 'hairpin';
      return step - 1;
    }
    return step;
  }

  function getTotalSteps() {
    return isHairclip(state.answers[0]) ? 6 : 5;
  }

  function render() {
    var el = document.getElementById('spark-flow');
    if (!el) return;
    renderStep(el);
  }

  function renderStep(el) {
    var step = state.step;
    var slot = getSlot(step);
    var totalSteps = getTotalSteps();
    var html = '<p class="flow-step-num">' + t('common.step', { n: step + 1, total: totalSteps }) + '</p>';

    if (slot === 0) {
      html += '<p class="flow-question">' + t('spark.q1') + '</p>';
      html += '<div class="option-grid" id="opt-grid">';
      state.products.forEach(function (p) {
        var sel = state.answers[0] === p.name ? ' active' : '';
        html += '<button class="option-btn' + sel + '" data-val="' + escAttr(p.name) + '">' + escHtml(p.name) + '</button>';
      });
      html += '</div>';
    } else if (slot === 'hairpin') {
      html += '<p class="flow-question">' + t('spark.hairpin_q') + '</p>';
      html += '<div class="option-grid" id="opt-grid">';
      HAIRPIN_OPTS.forEach(function (o) {
        var sel = state.hairpinSize === o.val ? ' active' : '';
        html += '<button class="option-btn' + sel + '" data-val="' + o.val + '">' + t(o.key) + '</button>';
      });
      html += '</div>';
    } else if (slot === 1) {
      html += '<p class="flow-question">' + t('spark.q2') + '</p>';
      html += '<div class="option-grid" id="opt-grid">';
      PEOPLE_OPTS.forEach(function (n) {
        var label = n === 1 ? t('people.1') : t('people.n', { n: n });
        var sel = state.answers[1] === String(n) ? ' active' : '';
        html += '<button class="option-btn' + sel + '" data-val="' + n + '">' + label + '</button>';
      });
      var sel5 = state.answers[1] === '5+' ? ' active' : '';
      html += '<button class="option-btn' + sel5 + '" data-val="5+">' + t('people.5plus') + '</button>';
      html += '</div>';
    } else if (slot === 2) {
      html += '<p class="flow-question">' + t('spark.q3') + '</p>';
      html += '<div class="option-grid" id="opt-grid">';
      TIMES.forEach(function (ti) {
        var sel = state.answers[2] === ti.val ? ' active' : '';
        html += '<button class="option-btn' + sel + '" data-val="' + ti.val + '">' + t(ti.key) + '</button>';
      });
      html += '</div>';
    } else if (slot === 3) {
      html += '<p class="flow-question">' + t('spark.q4') + '</p>';
      html += '<div class="option-grid" id="opt-grid">';
      state.occasions.forEach(function (o) {
        var sel = state.answers[3] === o.name ? ' active' : '';
        html += '<button class="option-btn' + sel + '" data-val="' + escAttr(o.name) + '">' + escHtml(o.name) + '</button>';
      });
      html += '</div>';
    } else if (slot === 4) {
      html += '<p class="flow-question">' + t('spark.q5') + '</p>';
      html += '<div class="option-grid" id="opt-grid">';
      ACTIVITY_TYPES.forEach(function (a) {
        var sel = state.answers[4] === a.val ? ' active' : '';
        html += '<button class="option-btn' + sel + '" data-val="' + a.val + '">' + t(a.key) + '</button>';
      });
      html += '</div>';
    }

    html += '<div class="flow-nav">';
    if (step > 0) html += '<button class="flow-ghost-btn" id="flow-back">' + t('common.back') + '</button>';
    html += '<button class="flow-next-btn" id="flow-next">' + (step === totalSteps - 1 ? t('common.sparkcta') : t('common.next')) + '</button>';
    html += '</div>';

    el.innerHTML = html;
    bindStepEvents();
  }

  function bindStepEvents() {
    var grid = document.getElementById('opt-grid');
    var nextBtn = document.getElementById('flow-next');
    var backBtn = document.getElementById('flow-back');
    var slot = getSlot(state.step);

    function updateNext() {
      if (!nextBtn) return;
      var ans = slot === 'hairpin' ? state.hairpinSize : state.answers[slot];
      var ok = ans && !(ans === '__other__' && !(state.otherText && state.otherText.trim()));
      nextBtn.disabled = !ok;
    }

    if (grid) {
      grid.addEventListener('click', function (e) {
        var btn = e.target.closest('.option-btn');
        if (!btn) return;
        var val = btn.getAttribute('data-val');
        if (slot === 'hairpin') {
          state.hairpinSize = val;
        } else {
          state.answers[slot] = val;
        }
        grid.querySelectorAll('.option-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        if (val === '__other__') {
          state.otherText = '';
          render();
        } else {
          updateNext();
        }
      });
    }

    var otherInput = document.getElementById('other-input');
    if (otherInput) {
      otherInput.addEventListener('input', function () { state.otherText = otherInput.value; updateNext(); });
    }

    if (nextBtn) {
      updateNext();
      nextBtn.addEventListener('click', function () {
        var ans = slot === 'hairpin' ? state.hairpinSize : state.answers[slot];
        if (!ans) return;
        if (ans === '__other__') {
          var txt = state.otherText ? state.otherText.trim() : '';
          if (!txt) return;
          state.answers[0] = txt;
        }
        if (state.step === getTotalSteps() - 1) {
          submitSpark();
        } else {
          state.step++;
          render();
        }
      });
    }

    if (backBtn) {
      backBtn.addEventListener('click', function () { state.step--; render(); });
    }
  }

  function submitSpark() {
    var el = document.getElementById('spark-flow');
    el.innerHTML = '<div class="flow-loading"><div class="flow-spinner"></div><p class="flow-loading-text">' + t('spark.loading') + '</p></div>';
    var qs = [t('spark.q1'), t('spark.q2'), t('spark.q3'), t('spark.q4'), t('spark.q5')];
    var answers = state.answers.slice(0, 5).map(function (a, i) { return { question: qs[i], answer: a }; });
    fetch('/api/spark', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers: answers, lang: window.currentLang || 'en', hairpinSize: state.hairpinSize })
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.error) { showError(data.error); return; }
        if (!data.activities || !data.activities.length) { showError(t('common.retry')); return; }
        renderDeck(data.activities.map(function (a) { return a.description; }));
      })
      .catch(function () { showError(t('common.retry')); });
  }

  function renderDeck(activities) {
    var el = document.getElementById('spark-flow');
    var idx = 0;
    function renderCard() {
      var total = activities.length;
      var html = '<div class="spark-deck">';
      html += '<p class="spark-progress">' + t('spark.progress', { n: idx + 1, total: total }) + '</p>';
      html += '<div class="spark-card"><p class="spark-card-text">' + escHtml(activities[idx]) + '</p></div>';
      html += '<div class="spark-deck-nav">';
      if (idx < total - 1) {
        html += '<button class="flow-next-btn" id="spark-next">' + t('spark.next') + '</button>';
      } else {
        html += '<button class="flow-next-btn" id="spark-regen">' + t('spark.regenerate') + '</button>';
      }
      html += '<button class="flow-ghost-btn" id="spark-restart">' + t('spark.restart') + '</button>';
      html += '</div></div>';
      el.innerHTML = html;

      var nBtn = document.getElementById('spark-next');
      var rBtn = document.getElementById('spark-regen');
      var sBtn = document.getElementById('spark-restart');
      if (nBtn) nBtn.addEventListener('click', function () { idx++; renderCard(); });
      if (rBtn) rBtn.addEventListener('click', submitSpark);
      if (sBtn) sBtn.addEventListener('click', initSpark);
    }
    renderCard();
  }

  function showError(msg) {
    var el = document.getElementById('spark-flow');
    if (!el) return;
    el.innerHTML = '<div class="flow-error"><p>' + escHtml(msg) + '</p><button class="flow-ghost-btn" id="err-restart">' + t('spark.restart') + '</button></div>';
    var rb = document.getElementById('err-restart');
    if (rb) rb.addEventListener('click', initSpark);
  }

  window.initSpark = function () {
    state.step = 0;
    state.answers = [];
    state.otherText = '';
    state.hairpinSize = '';

    var el = document.getElementById('spark-flow');
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
