(function () {
  var GROUP_SIZES = [
    { key: 'inspire.group.alone', val: 'Alone' },
    { key: 'inspire.group.2',     val: '2' },
    { key: 'inspire.group.3',     val: '3' },
    { key: 'inspire.group.4',     val: '4' },
    { key: 'inspire.group.5plus', val: '5+' }
  ];
  var STYLES = [
    { key: 'style.abstract',        val: 'Abstract' },
    { key: 'style.minimalist',      val: 'Minimalist' },
    { key: 'style.realistic',       val: 'Realistic' },
    { key: 'style.impressionistic', val: 'Impressionistic' },
    { key: 'style.surreal',         val: 'Surreal' },
    { key: 'style.geometric',       val: 'Geometric' },
    { key: 'style.expressive',      val: 'Expressive' },
    { key: 'style.colorful',        val: 'Colorful' },
    { key: 'style.monochromatic',   val: 'Monochromatic' },
    { key: 'style.softdreamy',      val: 'Soft and dreamy' },
    { key: 'style.seasonal',        val: 'Seizoensgebonden' }
  ];
  var TOPICS = [
    { key: 'topic.landschappen', val: 'Landschappen' },
    { key: 'topic.stilleven',    val: 'Stilleven' },
    { key: 'topic.dranken',      val: 'Dranken' },
    { key: 'topic.dieren',       val: 'Dieren' },
    { key: 'topic.fantasie',     val: 'Fantasie' },
    { key: 'topic.natuur',       val: 'Natuur' },
    { key: 'topic.mensen',       val: 'Mensen' },
    { key: 'topic.party',        val: 'Party' },
    { key: 'topic.stad',         val: 'Stad' },
    { key: 'topic.vlakken',      val: 'Vlakken' }
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

  // answers[0]=group, answers[1]=product, answers[2]=style, answers[3]=topic, answers[4]=time, answers[5]=level
  var state = {
    step: 0, answers: [], products: [],
    idea: '', imageCount: 0, currentImageUrl: '',
    paintTogether: null   // true=together, false=separate, null=not asked
  };

  function t(key, vars) { return window.t ? window.t(key, vars) : key; }
  function escHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function escAttr(s) { return String(s).replace(/"/g, '&quot;'); }

  // Whether to show the "paint together or separate?" question
  // Condition: group > 1 AND product is canvas (not mini, not tote)
  function needsTogetherStep() {
    var group = state.answers[0];
    var box   = state.answers[1];
    if (!group || group === 'Alone') return false;
    if (!box) return false;
    var lower = box.toLowerCase();
    return lower.indexOf('mini') < 0 && lower.indexOf('tote') < 0;
  }

  // Total visible steps (6 or 7)
  function getTotalSteps() { return needsTogetherStep() ? 7 : 6; }

  // Is the current step the together/separate question?
  function isTogetherStep(step) { return needsTogetherStep() && step === 2; }

  // Visual step numbers for each question type
  function styleStep()  { return needsTogetherStep() ? 3 : 2; }
  function topicStep()  { return needsTogetherStep() ? 4 : 3; }
  function timeStep()   { return needsTogetherStep() ? 5 : 4; }
  function levelStep()  { return needsTogetherStep() ? 6 : 5; }

  // Map visual step → answers[] index (-1 = stored in state.paintTogether)
  function getAnswerIdx(step) {
    if (!needsTogetherStep()) return step;       // 6-step: direct map 0→0, 1→1, 2→2(style), 3→3(topic), 4→4(time), 5→5(level)
    if (step <= 1) return step;
    if (step === 2) return -1;                   // together step
    return step - 1;                             // 3→2(style), 4→3(topic), 5→4(time), 6→5(level)
  }

  function render() {
    var el = document.getElementById('inspire-flow');
    if (!el) return;
    renderStep(el);
  }

  function renderStep(el) {
    var step  = state.step;
    var total = getTotalSteps();
    var html  = '<p class="flow-step-num">' + t('common.step', { n: step + 1, total: total }) + '</p>';

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

    } else if (isTogetherStep(step)) {
      html += '<p class="flow-question">' + t('inspire.q.together') + '</p>';
      html += '<div class="option-grid" id="opt-grid">';
      var togSel = state.paintTogether === true  ? ' active' : '';
      var sepSel = state.paintTogether === false ? ' active' : '';
      html += '<button class="option-btn' + togSel + '" data-val="together">' + t('inspire.together.yes') + '</button>';
      html += '<button class="option-btn' + sepSel + '" data-val="separate">' + t('inspire.together.no') + '</button>';
      html += '</div>';

    } else if (step === styleStep()) {
      html += '<p class="flow-question">' + t('inspire.q2') + '</p>';
      html += '<div class="option-grid" id="opt-grid">';
      STYLES.forEach(function (s) {
        var sel = state.answers[2] === s.val ? ' active' : '';
        html += '<button class="option-btn' + sel + '" data-val="' + s.val + '">' + t(s.key) + '</button>';
      });
      html += '</div>';

    } else if (step === topicStep()) {
      html += '<p class="flow-question">' + t('inspire.q.topic') + '</p>';
      html += '<input class="flow-other-input" id="topic-input" placeholder="' + escAttr(t('inspire.topic.ph')) + '" value="' + escAttr(state.answers[3] || '') + '" autocomplete="off">';
      html += '<p class="flow-hint">' + t('inspire.topic.hint') + '</p>';
      html += '<div class="option-grid topic-presets" id="topic-grid">';
      TOPICS.forEach(function (tp) {
        var sel = state.answers[3] === tp.val ? ' active' : '';
        html += '<button class="option-btn' + sel + '" data-val="' + tp.val + '">' + t(tp.key) + '</button>';
      });
      var anySel = state.answers[3] === '__any__' ? ' active' : '';
      html += '<button class="option-btn' + anySel + '" data-val="__any__">' + t('inspire.topic.any') + '</button>';
      html += '</div>';

    } else if (step === timeStep()) {
      html += '<p class="flow-question">' + t('inspire.q3') + '</p>';
      html += '<div class="option-grid" id="opt-grid">';
      TIMES.forEach(function (ti) {
        var sel = state.answers[4] === ti.val ? ' active' : '';
        html += '<button class="option-btn' + sel + '" data-val="' + ti.val + '">' + t(ti.key) + '</button>';
      });
      html += '</div>';

    } else if (step === levelStep()) {
      html += '<p class="flow-question">' + t('inspire.q4') + '</p>';
      html += '<div class="option-grid" id="opt-grid">';
      DIFFS.forEach(function (d) {
        var sel = state.answers[5] === d.val ? ' active' : '';
        html += '<button class="option-btn' + sel + '" data-val="' + d.val + '">' + t(d.key) + '</button>';
      });
      html += '</div>';
    }

    html += '<div class="flow-nav">';
    if (step > 0) html += '<button class="flow-ghost-btn" id="flow-back">' + t('common.back') + '</button>';
    html += '<button class="flow-next-btn" id="flow-next">' + (step === getTotalSteps() - 1 ? t('common.getidea') : t('common.next')) + '</button>';
    html += '</div>';

    el.innerHTML = html;
    bindStepEvents();
  }

  function bindStepEvents() {
    var step    = state.step;
    var nextBtn = document.getElementById('flow-next');
    var backBtn = document.getElementById('flow-back');

    function updateNext() {
      if (!nextBtn) return;
      var ok = false;
      if (isTogetherStep(step)) {
        ok = state.paintTogether !== null;
      } else if (step === topicStep()) {
        // Topic is required: either typed something or picked a preset (including __any__)
        ok = !!(state.answers[3] && state.answers[3].length > 0);
      } else {
        var idx = getAnswerIdx(step);
        ok = idx >= 0 ? !!state.answers[idx] : false;
      }
      nextBtn.disabled = !ok;
    }

    if (isTogetherStep(step)) {
      var grid = document.getElementById('opt-grid');
      if (grid) {
        grid.addEventListener('click', function (e) {
          var btn = e.target.closest('.option-btn');
          if (!btn) return;
          state.paintTogether = btn.getAttribute('data-val') === 'together';
          grid.querySelectorAll('.option-btn').forEach(function (b) { b.classList.remove('active'); });
          btn.classList.add('active');
          updateNext();
        });
      }

    } else if (step === topicStep()) {
      var topicInput = document.getElementById('topic-input');
      var topicGrid  = document.getElementById('topic-grid');

      if (topicInput) {
        topicInput.addEventListener('input', function () {
          state.answers[3] = topicInput.value.trim() || '';
          // Clear any active preset button if user is typing freely
          if (topicGrid) topicGrid.querySelectorAll('.option-btn').forEach(function (b) { b.classList.remove('active'); });
          updateNext();
        });
      }
      if (topicGrid) {
        topicGrid.addEventListener('click', function (e) {
          var btn = e.target.closest('.option-btn');
          if (!btn) return;
          var val = btn.getAttribute('data-val');
          state.answers[3] = val;
          if (topicInput) {
            // Fill the text field with the preset label (or clear it for __any__)
            topicInput.value = val === '__any__' ? '' : btn.textContent;
          }
          topicGrid.querySelectorAll('.option-btn').forEach(function (b) { b.classList.remove('active'); });
          btn.classList.add('active');
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
          var idx = getAnswerIdx(step);
          if (idx >= 0) state.answers[idx] = val;
          grid.querySelectorAll('.option-btn').forEach(function (b) { b.classList.remove('active'); });
          btn.classList.add('active');
          updateNext();
        });
      }
    }

    if (nextBtn) {
      updateNext();
      nextBtn.addEventListener('click', function () {
        if (isTogetherStep(step)) {
          if (state.paintTogether === null) return;
        } else if (step === topicStep()) {
          var v = state.answers[3];
          if (!v || !v.length) return;
        } else {
          var idx = getAnswerIdx(step);
          if (idx < 0 || !state.answers[idx]) return;
        }
        if (step === getTotalSteps() - 1) {
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
    var qs = [t('inspire.q.group'), t('inspire.q1'), t('inspire.q2'), t('inspire.q.topic'), t('inspire.q3'), t('inspire.q4')];
    var answers = state.answers.slice(0, 6).map(function (a, i) { return { question: qs[i] || '', answer: a || '' }; });
    fetch('/api/inspire', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        answers: answers,
        lang: window.currentLang || 'en',
        paintTogether: needsTogetherStep() ? state.paintTogether : null
      })
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

    var againBtn   = document.getElementById('inspire-again');
    var restartBtn = document.getElementById('inspire-restart');
    var imgBtn     = document.getElementById('inspire-img-btn');

    if (againBtn)   againBtn.addEventListener('click', submitInspire);
    if (restartBtn) restartBtn.addEventListener('click', initInspire);
    if (imgBtn)     imgBtn.addEventListener('click', generateImage);
  }

  function generateImage() {
    var wrap = document.getElementById('inspire-image-wrap');
    if (wrap) {
      wrap.innerHTML = '<div class="flow-loading inspire-img-loading"><div class="flow-spinner"></div><p class="flow-loading-text">' + t('inspire.img.loading') + '</p></div>';
    }
    fetch('/api/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idea: state.idea,
        style: state.answers[2],
        topic: state.answers[3],
        box: state.answers[1],
        group: state.answers[0],
        paintTogether: needsTogetherStep() ? state.paintTogether : null
      })
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.error) {
          var w = document.getElementById('inspire-image-wrap');
          if (w) w.innerHTML = '<button class="flow-next-btn inspire-img-btn" id="inspire-img-btn">' + t('inspire.img.regenerate') + '</button>';
          var b = document.getElementById('inspire-img-btn');
          if (b) b.addEventListener('click', generateImage);
          return;
        }
        state.imageCount++;
        state.currentImageUrl = data.imageUrl;
        renderResult(document.getElementById('inspire-flow'));
      })
      .catch(function () {
        var w = document.getElementById('inspire-image-wrap');
        if (w) w.innerHTML = '<button class="flow-next-btn inspire-img-btn" id="inspire-img-btn">' + t('inspire.img.regenerate') + '</button>';
        var b = document.getElementById('inspire-img-btn');
        if (b) b.addEventListener('click', generateImage);
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
    state.paintTogether = null;

    var el = document.getElementById('inspire-flow');
    if (!el) return;

    if (state.products.length) { render(); return; }
    fetch('/api/products')
      .then(function (r) { return r.json(); })
      .then(function (products) { state.products = products; render(); })
      .catch(function () { state.products = []; render(); });
  };
})();
