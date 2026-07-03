(function () {
  var state = { step: 1, answers: {}, occasions: [], products: [], cards: [], cardIndex: 0, errorMsg: '' };
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
    var c = el('spark-flow');
    if (!c) return;

    if (state.step === 'loading') {
      c.innerHTML = '<div class="flow-loading"><div class="flow-spinner"></div><p class="flow-loading-text">Generating your activities…</p></div>';
      return;
    }

    if (state.step === 'deck') { renderDeck(c); return; }

    if (state.step === 'error') {
      c.innerHTML =
        '<div class="flow-error"><p>' + esc(state.errorMsg) + '</p>' +
        '<button class="cta-btn" id="spark-retry" style="margin-top:1.25rem">Try again</button></div>';
      el('spark-retry').addEventListener('click', submitSpark);
      return;
    }

    var stepNum = state.step;
    var question, opts;

    if (stepNum === 1) {
      question = 'What box do you have?';
      opts = state.products.map(function (p) { return { label: p.name, value: p.name }; });
      opts.push({ label: 'Something else', value: 'Another painting kit' });
    } else if (stepNum === 2) {
      question = 'How many people are joining?';
      opts = ['1', '2', '3', '4', '5+'].map(function (n) {
        return { label: n + (n === '1' ? ' person' : ' people'), value: n + (n === '1' ? ' person' : ' people') };
      });
    } else if (stepNum === 3) {
      question = 'What kind of night is it?';
      opts = state.occasions.map(function (o) { return { label: o.name, value: o.name }; });
      opts.push({ label: 'Something else', value: 'A casual get-together' });
    } else {
      question = 'What type of activity do you prefer?';
      opts = [
        { label: 'Physical', value: 'Physical activities using the painting materials' },
        { label: 'Mental game', value: 'Mental games and creative thinking challenges' },
        { label: 'Mix of both', value: 'A mix of physical and mental activities' }
      ];
    }

    var hasAnswer = !!state.answers['step' + stepNum];
    var isLast = stepNum === 4;

    c.innerHTML =
      '<div class="flow-step">' +
        '<p class="flow-step-num">Step ' + stepNum + ' of 4</p>' +
        '<h3 class="flow-question">' + esc(question) + '</h3>' +
        '<div class="option-grid">' + buildOptionGrid(stepNum, opts) + '</div>' +
        '<div class="flow-nav">' +
          (stepNum > 1 ? '<button class="flow-ghost-btn" id="spark-back">← Back</button>' : '') +
          '<button class="flow-next-btn" id="spark-next"' + (hasAnswer ? '' : ' disabled') + '>' + (isLast ? 'Spark the session →' : 'Next →') + '</button>' +
        '</div>' +
      '</div>';

    attachEvents(c, stepNum);
  }

  function renderDeck(c) {
    var card = state.cards[state.cardIndex];
    var isLast = state.cardIndex >= state.cards.length - 1;
    c.innerHTML =
      '<div class="spark-deck">' +
        '<p class="spark-progress">Challenge ' + (state.cardIndex + 1) + ' of ' + state.cards.length + '</p>' +
        '<div class="spark-card"><p class="spark-card-text">' + esc(card) + '</p></div>' +
        '<div class="spark-deck-nav">' +
          (isLast
            ? '<button class="cta-btn" id="spark-regenerate">Generate a new set</button>' +
              '<button class="flow-ghost-btn" id="spark-restart">Start over</button>'
            : '<button class="cta-btn" id="spark-deck-next">Next challenge →</button>'
          ) +
        '</div>' +
      '</div>';

    if (!isLast) {
      el('spark-deck-next').addEventListener('click', function () { state.cardIndex++; render(); });
    } else {
      el('spark-regenerate').addEventListener('click', submitSpark);
      el('spark-restart').addEventListener('click', function () {
        state.step = 1; state.answers = {}; state.cards = []; state.cardIndex = 0; render();
      });
    }
  }

  function attachEvents(c, stepNum) {
    c.querySelectorAll('.option-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var val = btn.dataset.value;
        state.answers['step' + stepNum] = val;
        c.querySelectorAll('.option-btn[data-step="' + stepNum + '"]').forEach(function (b) {
          b.classList.toggle('active', b.dataset.value === val);
        });
        var nextBtn = el('spark-next');
        if (nextBtn) nextBtn.disabled = false;
      });
    });

    var nextBtn = el('spark-next');
    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        if (stepNum < 4) { state.step++; render(); }
        else { submitSpark(); }
      });
    }

    var backBtn = el('spark-back');
    if (backBtn) {
      backBtn.addEventListener('click', function () { state.step--; render(); });
    }
  }

  function parseCards(text) {
    var lines = text.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
    var cards = [];
    var current = '';
    lines.forEach(function (line) {
      if (/^\d+[\.\)]/.test(line)) {
        if (current) cards.push(current.trim());
        current = line.replace(/^\d+[\.\)]\s*/, '');
      } else {
        current += (current ? ' ' : '') + line;
      }
    });
    if (current) cards.push(current.trim());
    return cards.slice(0, 7);
  }

  function submitSpark() {
    state.step = 'loading'; state.cardIndex = 0; render();
    var answers = [
      { question: 'What box do you have?', answer: state.answers.step1 },
      { question: 'How many people?', answer: state.answers.step2 },
      { question: 'What kind of night?', answer: state.answers.step3 },
      { question: 'Activity preference', answer: state.answers.step4 }
    ];
    fetch('/api/spark', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers: answers })
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.error) { state.step = 'error'; state.errorMsg = data.error; }
        else {
          var cards = parseCards(data.text);
          if (!cards.length) { state.step = 'error'; state.errorMsg = 'No activities generated. Please try again.'; }
          else { state.cards = cards; state.step = 'deck'; }
        }
        render();
      })
      .catch(function () {
        state.step = 'error'; state.errorMsg = 'Something went wrong. Please try again.'; render();
      });
  }

  window.initSpark = function () {
    state.step = 1; state.answers = {}; state.cards = []; state.cardIndex = 0;
    if (initialized && state.products.length) { render(); return; }
    initialized = true;
    Promise.all([
      fetch('/api/products').then(function (r) { return r.json(); }),
      fetch('/api/occasions').then(function (r) { return r.json(); })
    ]).then(function (results) {
      state.products = results[0]; state.occasions = results[1]; render();
    }).catch(function () {
      state.products = []; state.occasions = []; render();
    });
  };
})();
