function startSession(account) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({
    accountId: account.id,
    username: account.username,
    role: account.role,
    loggedInAt: new Date().toISOString(),
  }));
}

function routeAfterLogin(account) {
  window.location.href = account.role === 'admin' ? 'admin.html' : 'builder.html';
}

const loginForm = document.getElementById('loginForm');
const authError = document.getElementById('authError');

function showError(html) {
  authError.innerHTML = html;
  authError.classList.add('show');
}

loginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const username = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  if (!username || !password) {
    showError('Fyll ut brukernavn og passord for å fortsette.');
    return;
  }

  const account = findAccountByCredentials(username, password);
  if (!account) {
    showError('Feil brukernavn eller passord. Prøv <strong>admin</strong>/<strong>123</strong> eller <strong>bruker</strong>/<strong>123</strong>.');
    return;
  }

  authError.classList.remove('show');
  const btn = loginForm.querySelector('button[type="submit"] span');
  btn.textContent = 'Logger inn ...';

  setTimeout(() => {
    startSession(account);
    routeAfterLogin(account);
  }, 400);
});

document.getElementById('adminLoginBtn').addEventListener('click', () => {
  const account = findAccountByCredentials('admin', '123');
  startSession(account);
  routeAfterLogin(account);
});

document.getElementById('userLoginBtn').addEventListener('click', () => {
  const account = findAccountByCredentials('bruker', '123');
  startSession(account);
  routeAfterLogin(account);
});

document.getElementById('fjordLoginBtn').addEventListener('click', () => {
  const account = findAccountByCredentials('fjord', 'fjord123');
  startSession(account);
  routeAfterLogin(account);
});

document.getElementById('forgotLink').addEventListener('click', (e) => {
  e.preventDefault();
  showError('Dette er en demo — passordgjenoppretting er ikke koblet til noe.');
});
