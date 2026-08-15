(function () {
  var openBtn = document.getElementById('mobile-nav-open');
  var closeBtn = document.getElementById('mobile-nav-close');
  var nav = document.getElementById('mobile-nav');
  var overlay = document.getElementById('mobile-nav-overlay');

  if (!openBtn || !nav) return;

  function open() {
    nav.classList.add('is-open');
    overlay.classList.add('is-open');
  }
  function close() {
    nav.classList.remove('is-open');
    overlay.classList.remove('is-open');
  }

  openBtn.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', close);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') close();
  });
})();
