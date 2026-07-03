(function () {
  var STYLES = ['Abstract', 'Simplistic', 'Detailed', 'Playful', 'Geometric', 'Bold & Expressive'];
  var SUBJECTS = ['Nature', 'Animals', 'Food & Drink', 'Party', 'City', 'Fantasy', 'People'];

  var state = { step: 1, answers: {}, products: [], otherText: '', idea: '', errorMsg: '' };
  var initialized = false;

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function el(id) { return document.getElementById(id); }

  function buildOptionGrid(stepNum, opts) {
    return opts.map(function (o) {
      var active = state.answers['step' + stepNum] === o.value ? ' active' : '';
      return '<button class="option-btn' + active + '" data-step="' + stepNum + '" data-value="' + esc(o.value) + '">' + esc(o.label) + '</button>';
    }).join('');
  }

  function render() {
    var c = el('inspire-flow');
    if (!c) return;

    if (state.step === 'loading') {
      c.innerHTML = '<div class="flow-loading"><div class="flow-spinner"></div><p class="flow-loading-text">Crafting your painting idea…</p></div>';
      return;
    }

    if (state.step === 'result') {
      c.innerHTML =
        '<div class="inspire-result">' +
          '<p class="result-label">Your painting idea</p>' +
          '<div class="result-card"><p class="result-text">' + esc(state.idea).replace(/\n/g, '<br>') + '</p></div>' +
          '<div class="result-actions">' +
            '<button class="cta-btn" id="inspire-again">Try another idea</button>' +
            '<button class="flow-ghost-btn" id="inspire-restart">Start over</button>' +
          '</div>' +
        '</div>';
      el('inspire-again').addEventListener('click', submitInspire);
      el('inspire-restart').addEventListener('click', function () {
        state.step = 1; state.answers = {}; state.otherText = ''; render();
      });
      return;
    }

    if (state.step === 'error') {
      c.innerHTML =
        '<div class="flow-error">' +
          '<p>' + esc(state.errorMsg) + '</p>' +
          '<button class="cta-btn" id="inspire-retry" style="margin-top:1.25rem">Try again</button>' +
        '</div>';
      el('inspire-retry').addEventListener('click', submitInspire);
      return;
    }

    var stepNum = state.step;
    var question, opts, showOther = false;

    if (stepNum === 1) {
      question = 'What did you buy?';
      opts = state.products.map(function (p) { return { label: p.name, value: p.name }; });
      opts.push({ label: 'Something else', value: '__other' });
      showOther = true;
    } else if (stepNum === 2) {
      question = 'What painting style are you feeling?';
      opts = STYLES.map(function (s) { return { label: s, value: s }; });
    } else if (stepNum === 3) {
      question = 'What subject do you want to paint?';
      opts = SUBJECTS.map(function (s) { return { label: s, value: s }; });
    } else {
      question = 'How ambitious is your group today?';
      opts = [
        { label: 'Relaxed', value: 'Relaxed — easy and fun' },
        { label: 'Balanced', value: 'Balanced — some effort, still enjoyable' },
        { label: 'Ambitious', value: 'Ambitious — we want a challenge' }
      ];
    }

    var hasAnswer = !!state.answers['step' + stepNum];
    var isLast = stepNum === 4;
    var otherVisible = (state.answers.step1 === '__other') ? '' : 'none';

    c.innerHTML =
      '<div class="flow-step">' +
        '<p class="flow-step-num">Step ' + stepNum + ' of 4</p>' +
        '<h3 class="flow-question">' + esc(question) + '</h3>' +
        '<div class="option-grid">' + buildOptionGrid(stepNum, opts) + '</div>' +
        (showOther ? '<input id="inspire-other" class="flow-other-input" placeholder="Describe your box…" value="' + esc(state.otherText) + '" style="display:' + otherVisible + '">' : '') +
        '<div class="flow-nav">' +
          (stepNum > 1 ? '<button class="flow-ghost-btn" id="inspire-back">← Back</button>' : '') +
          '<button class="flow-next-btn" id="inspire-next"' + (hasAnswer ? '' : ' disabled') + '>' + (isLast ? 'Get my idea →' : 'Next →') + '</button>' +
        '</div>' +
      '</div>';

    attachEvents(c, stepNum);
  }

  function attachEvents(c, stepNum) {
    c.querySelectorAll('.option-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var val = btn.dataset.value;
        state.answers['step' + stepNum] = val;
        var otherInput = el('inspire-other');
        if (otherInput) {
          otherInput.style.display = val === '__other' ? '' : 'none';
          if (val !== '__other') state.otherText = '';
        }
        c.querySelectorAll('.option-btn[data-step="' + stepNum + '"]').forEach(function (b) {
          b.classList.toggle('active', b.dataset.value === val);
        });
        var nextBtn = el('inspire-next');
        if (nextBtn) nextBtn.disabled = false;
      });
    });

    var otherInput = el('inspire-other');
    if (otherInput) {
      otherInput.addEventListener('input', function () { state.otherText = otherInput.value; });
    }

    var nextBtn = el('inspire-next');
    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        if (stepNum === 1 && state.answers.step1 === '__other') {
          state.answers.step1 = state.otherText.trim() || 'a painting kit';
        }
        if (stepNum < 4) { state.step++; render(); }
        else { submitInspire(); }
      });
    }

    var backBtn = el('inspire-back');
    if (backBtn) {
      backBtn.addEventListener('click', function () { state.step--; render(); });
    }
  }

  function submitInspire() {
    state.step = 'loading';
    render();
    var answers = [
      { question: 'What did you buy?', answer: state.answers.step1 },
      { question: 'Painting style', answer: state.answers.step2 },
      { question: 'Subject', answer: state.answers.step3 },
      { question: 'Ambition level', answer: state.answers.step4 }
    ];
    fetch('/api/inspire', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers: answers })
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.error) { state.step = 'error'; state.errorMsg = data.error; }
        else { state.step = 'result'; state.idea = data.idea; }
        render();
      })
      .catch(function () {
        state.step = 'error'; state.errorMsg = 'Something went wrong. Please try again.'; render();
      });
  }

  window.initInspire = function () {
    state.step = 1; state.answers = {}; state.otherText = '';
    if (initialized && state.products.length) { render(); return; }
    initialized = true;
    fetch('/api/products')
      .then(function (r) { return r.json(); })
      .then(function (products) { state.products = products; render(); })
      .catch(function () { state.products = []; render(); });
  };
})();
