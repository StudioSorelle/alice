(function () {
  var VIEWS = ['home', 'mix', 'inspire', 'spark'];

  // ── Auth ──
  function getAuth() {
    try { return JSON.parse(localStorage.getItem('alice_auth') || 'null'); } catch (e) { return null; }
  }

  function checkAuth() {
    var auth = getAuth();
    var gate = document.getElementById('view-auth');
    var nav = document.getElementById('mainNav');
    var main = document.querySelector('main');

    if (!auth || !auth.expiresAt || new Date(auth.expiresAt) <= new Date()) {
      if (gate) gate.style.display = '';
      if (nav) nav.style.display = 'none';
      if (main) main.style.display = 'none';
      if (auth && auth.expiresAt && new Date(auth.expiresAt) <= new Date()) {
        var expired = document.getElementById('auth-msg-expired');
        var normal = document.getElementById('auth-msg-normal');
        var formWrap = document.getElementById('auth-form-wrap');
        if (expired) expired.style.display = '';
        if (normal) normal.style.display = 'none';
        if (formWrap) formWrap.style.display = 'none';
      }
      return false;
    }
    if (gate) gate.style.display = 'none';
    if (nav) nav.style.display = '';
    if (main) main.style.display = '';
    return true;
  }

  function initAuthForm() {
    var submitBtn = document.getElementById('auth-submit');
    var input = document.getElementById('auth-code-input');
    var errorEl = document.getElementById('auth-error');

    function tryCode() {
      var code = input ? input.value.trim().toUpperCase() : '';
      if (!code) return;
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = '…'; }
      fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code })
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.valid) {
            localStorage.setItem('alice_auth', JSON.stringify({ code: code, expiresAt: data.expiresAt }));
            checkAuth();
            showView('home');
          } else {
            if (errorEl) errorEl.style.display = '';
            if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Unlock'; }
          }
        })
        .catch(function () {
          if (errorEl) errorEl.style.display = '';
          if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Unlock'; }
        });
    }

    if (submitBtn) submitBtn.addEventListener('click', tryCode);
    if (input) {
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') tryCode(); });
      input.addEventListener('input', function () {
        if (errorEl) errorEl.style.display = 'none';
        input.value = input.value.toUpperCase();
      });
    }
  }

  // ── View navigation ──
  function showView(name) {
    if (VIEWS.indexOf(name) === -1) return;
    VIEWS.forEach(function (v) {
      var el = document.getElementById('view-' + v);
      if (el) el.classList.toggle('active', v === name);
    });
    var isHome = name === 'home';
    document.getElementById('backBtn').style.display = isHome ? 'none' : '';
    document.getElementById('backBtn').classList.toggle('visible', !isHome);
    document.getElementById('navLinks').style.display = isHome ? '' : 'none';
    window.scrollTo(0, 0);
    if (name === 'mix' && typeof window.initMixer === 'function') setTimeout(window.initMixer, 60);
    if (name === 'inspire' && typeof window.initInspire === 'function') setTimeout(window.initInspire, 60);
    if (name === 'spark' && typeof window.initSpark === 'function') setTimeout(window.initSpark, 60);
  }

  function init() {
    // Hide nav/main by default until auth check passes
    var nav = document.getElementById('mainNav');
    var main = document.querySelector('main');
    if (nav) nav.style.display = 'none';
    if (main) main.style.display = 'none';

    initAuthForm();
    checkAuth();

    var scrollBtn = document.getElementById('scrollToTiles');
    if (scrollBtn) {
      scrollBtn.addEventListener('click', function () {
        document.getElementById('tiles').scrollIntoView({ behavior: 'smooth' });
      });
    }

    document.getElementById('backBtn').addEventListener('click', function () { showView('home'); });

    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-view]');
      if (!target) return;
      e.preventDefault();
      showView(target.getAttribute('data-view'));
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
