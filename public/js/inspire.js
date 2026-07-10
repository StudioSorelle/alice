(function () {
  var STEPS = 5;
  var GROUP_SIZES = [
    { key: 'inspire.group.alone', val: 'Alone' },
    { key: 'inspire.group.two', val: 'With 2' },
    { key: 'inspire.group.small', val: 'With 3-4' },
    { key: 'inspire.group.full', val: 'Full group' }
  ];
  var STYLES = [
    { key: 'style.abstract',         val: 'Abstract' },
    { key: 'style.simplistisch',     val: 'Simplistisch' },
    { key: 'style.landschappen',     val: 'Landschappen' },
    { key: 'style.stilleven',        val: 'Stilleven' },
    { key: 'style.speels',           val: 'Speels' },
    { key: 'style.aesthetic',        val: 'Aesthetic' },
    { key: 'style.dranken',          val: 'Dranken' },
    { key: 'style.dieren',           val: 'Dieren' },
    { key: 'style.fantasie',         val: 'Fantasie' },
    { key: 'style.natuur',           val: 'Natuur' },
    { key: 'style.mensen',           val: 'Mensen' },
    { key: 'style.party',            val: 'Party' },
    { key: 'style.stad',             val: 'Stad' },
    { key: 'style.seizoensgebonden', val: 'Seizoensgebonden' }
  ];
  var TIMES = [
    { key: 'time.30min', val: '30 minutes' },
    { key: 'time.1h',    val: '1 hour' },
    { key: 'time.2h',    val: '2+ hours' }
  ];
  var DIFFS = [
    { key: 'diff.relaxed',   val: 'Relaxed' },
    { key: 'diff.balanced',  val: 'Balanced' },
    { key: 'diff.ambitious', val: 'Ambitious' }
  ];

  // answers[0]=group, answers[1]=product, answers[2]=style, answers[3]=time, answers[4]=ambition
  var state = {
    step: 0, answers: [], products: [],
    idea: '', imageCount: 0, currentImageUrl: '',
    otherStyleText: ''
  };

  function t(key, vars) { return window.t ? window.t(key, vars) : key; }
  function escHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function escAttr(s) { return String(s).replace(/"/g, '&quot;'); }

  function render() {
    var el = document.getElementById('inspire-flow');
    if (!el) return;
    if (state.step < STEPS) renderStep(el);
  }

  function renderStep(el) {
    var step = state.step;
    var html = '<p class="flow-step-num">' + t('common.step', { n: step + 1, total: STEPS }) + '</p>';

    if (step === 0) {
      html += '<p class="flow-question">' + t('inspire.q.group') + '</p>';
      html += '<div class="option-grid" id="opt-grid">';
      GROUP_SIZES.forEach(function (g) {
        var sel = state.answers[0] === g.val ? ' active' : '';
        html += '<button class="option-btn' + sel + '" data-val="' + g.val + '">' + t(g.key) + '</button>';
      });
      html += '</div>';

    } else if (step === 1) {
      html += '<p class="flow-question">' + t('inspire.q1') + '</p>';
      html += '<div class="option-grid" id="opt-grid">';
      state.products.forEach(function (p) {
        var sel = state.answers[1] === p.name ? ' active' : '';
        html += '<button class="option-btn' + sel + '" data-val="' + escAttr(p.name) + '">' + escHtml(p.name) + '</button>';
      });
      html += '</div>';

    } else if (step === 2) {
      html += '<p class="flow-question">' + t('inspire.q2') + '</p>';
      html += '<div class="option-grid" id="style-grid">';
      STYLES.forEach(function (s) {
        var sel = state.answers[2] === s.val ? ' active' : '';
        html += '<button class="option-btn' + sel + '" data-val="' + s.val + '">' + t(s.key) + '</button>';
      });
      var otherSel = state.answers[2] === '__other__' ? ' active' : '';
      html += '<button class="option-btn' + otherSel + '" data-val="__other__">' + t('inspire.other') + '</button>';
      html += '</div>';
      if (state.answers[2] === '__other__') {
        html += '<input class="flow-other-input" id="other-input" placeholder="' + escAttr(t('inspire.other.ph')) + '" value="' + escAttr(state.otherStyleText) + '">';
      }

    } else if (step === 3) {
      html += '<p class="flow-question">' + t('inspire.q3') + '</p>';
      html += '<div class="option-grid" id="opt-grid">';
      TIMES.forEach(function (ti) {
        var sel = state.answers[3] === ti.val ? ' active' : '';
        html += '<button class="option-btn' + sel + '" data-val="' + ti.val + '">' + t(ti.key) + '</button>';
      });
      html += '</div>';

    } else if (step === 4) {
      html += '<p class="flow-question">' + t('inspire.q4') + '</p>';
      html += '<div class="option-grid" id="opt-grid">';
      DIFFS.forEach(function (d) {
        var sel = state.answers[4] === d.val ? ' active' : '';
        html += '<button class="option-btn' + sel + '" data-val="' + d.val + '">' + t(d.key) + '</button>';
      });
      html += '</div>';
    }

    html += '<div class="flow-nav">';
    if (step > 0) html += '<button class="flow-ghost-btn" id="flow-back">' + t('common.back') + '</button>';
    html += '<button class="flow-next-btn" id="flow-next">' + (step === STEPS - 1 ? t('common.getidea') : t('common.next')) + '</button>';
    html += '</div>';

    el.innerHTML = html;
    bindStepEvents();
  }

  function bindStepEvents() {
    var step = state.step;
    var nextBtn = document.getElementById('flow-next');
    var backBtn = document.getElementById('flow-back');

    function getOtherText() {
      var inp = document.getElementById('other-input');
      return inp ? inp.value.trim() : '';
    }

    function updateNext() {
      if (!nextBtn) return;
      var ok = false;
      if (step === 2) {
        ok = !!(state.answers[2] && !(state.answers[2] === '__other__' && !getOtherText()));
      } else {
        ok = !!state.answers[step];
      }
      nextBtn.disabled = !ok;
    }

    if (step === 2) {
      var styleGrid = document.getElementById('style-grid');
      if (styleGrid) {
        styleGrid.addEventListener('click', function (e) {
          var btn = e.target.closest('[data-val]');
          if (!btn) return;
          var val = btn.getAttribute('data-val');
          state.answers[2] = val;
          styleGrid.querySelectorAll('.option-btn').forEach(function (b) { b.classList.remove('active'); });
          btn.classList.add('active');
          if (val === '__other__') {
            state.otherStyleText = '';
            render();
          } else {
            updateNext();
          }
        });
      }
      var otherInput = document.getElementById('other-input');
      if (otherInput) {
        otherInput.addEventListener('input', function () {
          state.otherStyleText = otherInput.value;
          updateNext();
        });
      }
    } else {
      var grid = document.getElementById('opt-grid');
      if (grid) {
        grid.addEventListener('click', function (e) {
          var btn = e.target.closest('.option-btn');
          if (!btn) return;
          var val = btn.getAttribute('data-val');
          state.answers[step] = val;
          grid.querySelectorAll('.option-btn').forEach(function (b) { b.classList.remove('active'); });
          btn.classList.add('active');
          updateNext();
        });
      }
    }

    if (nextBtn) {
      updateNext();
      nextBtn.addEventListener('click', function () {
        if (step === 2) {
          if (!state.answers[2]) return;
          if (state.answers[2] === '__other__') {
            var txt = getOtherText();
            if (!txt) return;
            state.answers[2] = txt;
          }
        } else {
          if (!state.answers[step]) return;
        }
        if (step === STEPS - 1) {
          submitInspire();
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

  function submitInspire() {
    var el = document.getElementById('inspire-flow');
    el.innerHTML = '<div class="flow-loading"><div class="flow-spinner"></div><p class="flow-loading-text">' + t('inspire.loading') + '</p></div>';
    var qs = [t('inspire.q.group'), t('inspire.q1'), t('inspire.q2'), t('inspire.q3'), t('inspire.q4')];
    var answers = state.answers.slice(0, 5).map(function (a, i) { return { question: qs[i], answer: a || '' }; });
    fetch('/api/inspire', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers: answers, lang: window.currentLang || 'en' })
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.error) { showError(data.error); return; }
        state.idea = data.idea;
        state.imageCount = 0;
        state.currentImageUrl = '';
        renderResult(document.getElementById('inspire-flow'));
      })
      .catch(function () { showError(t('common.retry')); });
  }

  function renderResult(el) {
    var html = '<div class="inspire-result">';

    if (state.currentImageUrl) {
      html += '<img src="' + escAttr(state.currentImageUrl) + '" class="inspire-img inspire-img-full" alt="Generated painting idea">';
    }

    html += '<p class="result-label">' + t('inspire.result.label') + '</p>';
    html += '<div class="result-card"><p class="result-text">' + escHtml(state.idea).replace(/\n/g, '<br>') + '</p></div>';

    html += '<div class="inspire-image-wrap" id="inspire-image-wrap">';
    if (state.imageCount < 3) {
      var btnLabel = state.imageCount === 0 ? t('inspire.img.generate') : t('inspire.img.regenerate');
      html += '<button class="flow-next-btn inspire-img-btn" id="inspire-img-btn">' + btnLabel + '</button>';
    } else {
      html += '<p class="inspire-img-note">' + t('inspire.img.max') + '</p>';
    }
    html += '</div>';

    html += '<div class="result-actions">';
    html += '<button class="flow-ghost-btn" id="inspire-again">' + t('inspire.again') + '</button>';
    html += '<button class="flow-ghost-btn" id="inspire-restart">' + t('inspire.restart') + '</button>';
    html += '</div>';
    html += '<p class="inspire-again-note">' + t('inspire.again.note') + '</p>';
    html += '</div>';

    el.innerHTML = html;

    var againBtn = document.getElementById('inspire-again');
    var restartBtn = document.getElementById('inspire-restart');
    var imgBtn = document.getElementById('inspire-img-btn');

    if (againBtn) againBtn.addEventListener('click', submitInspire);
    if (restartBtn) restartBtn.addEventListener('click', initInspire);
    if (imgBtn) imgBtn.addEventListener('click', generateImage);
  }

  function generateImage() {
    var btn = document.getElementById('inspire-img-btn');
    if (btn) { btn.disabled = true; btn.textContent = t('inspire.img.loading'); }
    fetch('/api/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idea: state.idea, style: state.answers[2] })
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.error) {
          if (btn) { btn.disabled = false; btn.textContent = t('inspire.img.regenerate'); }
          return;
        }
        state.imageCount++;
        state.currentImageUrl = data.imageUrl;
        renderResult(document.getElementById('inspire-flow'));
      })
      .catch(function () {
        if (btn) { btn.disabled = false; btn.textContent = t('inspire.img.regenerate'); }
      });
  }

  function showError(msg) {
    var el = document.getElementById('inspire-flow');
    if (!el) return;
    el.innerHTML = '<div class="flow-error"><p>' + escHtml(msg) + '</p><button class="flow-ghost-btn" id="err-restart">' + t('inspire.restart') + '</button></div>';
    var rb = document.getElementById('err-restart');
    if (rb) rb.addEventListener('click', initInspire);
  }

  window.initInspire = function () {
    state.step = 0;
    state.answers = [];
    state.idea = '';
    state.imageCount = 0;
    state.currentImageUrl = '';
    state.otherStyleText = '';

    var el = document.getElementById('inspire-flow');
    if (!el) return;

    if (state.products.length) { render(); return; }
    fetch('/api/products')
      .then(function (r) { return r.json(); })
      .then(function (products) { state.products = products; render(); })
      .catch(function () { state.products = []; render(); });
  };
})();
