(function () {
  var openBtn = document.getElementById('search-open');
  var closeBtn = document.getElementById('search-close');
  var panel = document.getElementById('search-panel');
  var backdrop = document.getElementById('search-backdrop');
  var input = document.getElementById('search-input');

  if (!openBtn || !panel) return;

  function open() {
    panel.classList.add('is-open');
    backdrop.classList.add('is-open');
    input.focus();
  }

  function close() {
    panel.classList.remove('is-open');
    backdrop.classList.remove('is-open');
  }

  openBtn.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', close);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') close();
  });
})();
