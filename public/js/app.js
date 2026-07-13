(function () {
  var VIEWS = ['home', 'mix', 'inspire', 'spark', 'moment', 'gallery'];

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
            if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = window.t ? window.t('auth.submit') : 'Unlock'; }
          }
        })
        .catch(function () {
          if (errorEl) errorEl.style.display = '';
          if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = window.t ? window.t('auth.submit') : 'Unlock'; }
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
    if (name === 'moment' && typeof window.initMoment === 'function') setTimeout(window.initMoment, 60);
    if (name === 'gallery' && typeof window.initGallery === 'function') setTimeout(window.initGallery, 60);
  }

  function init() {
    var nav = document.getElementById('mainNav');
    var main = document.querySelector('main');
    if (nav) nav.style.display = 'none';
    if (main) main.style.display = 'none';

    if (window.setLang) {
      window.setLang(localStorage.getItem('alice_lang') || 'en');
    }

    initAuthForm();
    checkAuth();

    function toggleLang() { window.setLang(window.currentLang === 'en' ? 'nl' : 'en'); }
    var langBtn = document.getElementById('langToggle');
    if (langBtn) langBtn.addEventListener('click', toggleLang);
    var langBtnMobile = document.getElementById('langToggleMobile');
    if (langBtnMobile) langBtnMobile.addEventListener('click', toggleLang);

    document.getElementById('backBtn').addEventListener('click', function () { showView('home'); });

    // Feedback modal
    fetch('/api/config').then(function (r) { return r.json(); }).then(function (cfg) {
      var btn = document.getElementById('feedbackBtn');
      var link = document.getElementById('feedbackLink');
      if (cfg && cfg.feedbackUrl && btn) {
        btn.style.display = '';
        if (link) link.href = cfg.feedbackUrl;
      }
    }).catch(function () {});
    var feedbackBtn = document.getElementById('feedbackBtn');
    var feedbackOverlay = document.getElementById('feedbackOverlay');
    var feedbackClose = document.getElementById('feedbackClose');
    if (feedbackBtn) feedbackBtn.addEventListener('click', function () { if (feedbackOverlay) feedbackOverlay.style.display = ''; });
    if (feedbackClose) feedbackClose.addEventListener('click', function () { if (feedbackOverlay) feedbackOverlay.style.display = 'none'; });
    if (feedbackOverlay) feedbackOverlay.addEventListener('click', function (e) { if (e.target === feedbackOverlay) feedbackOverlay.style.display = 'none'; });

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
