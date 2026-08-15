(function () {
  var COOKIE_NAME = 'budbase_age_verified';

  function getCookie(name) {
    var match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? match[2] : null;
  }

  function setCookie(name, value, days) {
    var expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = name + '=' + value + '; expires=' + expires + '; path=/; SameSite=Lax';
  }

  var gate = document.getElementById('age-gate');
  if (!gate) return;

  if (!getCookie(COOKIE_NAME)) {
    gate.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  var yesBtn = document.getElementById('age-gate-yes');
  yesBtn.addEventListener('click', function () {
    setCookie(COOKIE_NAME, '1', 30);
    gate.hidden = true;
    document.body.style.overflow = '';
  });
})();
