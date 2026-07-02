(function () {
  var VIEWS = ['home', 'mix', 'inspire', 'spark'];

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
    if (name === 'mix' && typeof window.initMixer === 'function') {
      setTimeout(window.initMixer, 60);
    }
  }

  function init() {
    // Scroll CTA on home
    var scrollBtn = document.getElementById('scrollToTiles');
    if (scrollBtn) {
      scrollBtn.addEventListener('click', function () {
        document.getElementById('tiles').scrollIntoView({ behavior: 'smooth' });
      });
    }

    // Back button
    document.getElementById('backBtn').addEventListener('click', function () {
      showView('home');
    });

    // Any element with data-view navigates to that view
    document.addEventListener('click', function (e) {
      var target = e.target.closest('[data-view]');
      if (!target) return;
      e.preventDefault();
      showView(target.getAttribute('data-view'));
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
