/* ===================== AUTH GUARD ===================== */
const session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
if (!session) {
  window.location.href = 'login.html';
} else if (session.role !== 'admin') {
  window.location.href = 'builder.html';
}

if (session && session.role === 'admin') {

  /* ===================== USER MENU ===================== */
  document.getElementById('userEmail').textContent = session.username + ' (admin)';
  document.getElementById('userAvatarBtn').addEventListener('click', () => {
    document.getElementById('userDropdown').classList.toggle('open');
  });
  document.addEventListener('click', (e) => {
    const menu = document.querySelector('.user-menu');
    if (!menu.contains(e.target)) document.getElementById('userDropdown').classList.remove('open');
  });
  document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem(SESSION_KEY);
    window.location.href = 'login.html';
  });

  /* ===================== TEMPLATE SELECT (new account modal) ===================== */
  const naTemplate = document.getElementById('na-template');
  BUILDER_TEMPLATES.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = `${t.icon} ${t.label}`;
    naTemplate.appendChild(opt);
  });

  /* ===================== ACCOUNT GRID ===================== */
  const accountGrid = document.getElementById('accountGrid');

  function statusLabel(status) {
    return status === 'live'
      ? '<span class="account-status live">● Live</span>'
      : '<span class="account-status draft">● Under utvikling</span>';
  }

  function renderAccounts() {
    const accounts = getAccounts().filter(a => a.role === 'user');
    accountGrid.innerHTML = '';

    document.getElementById('statTotal').textContent = accounts.length;

    let liveCount = 0;
    let draftCount = 0;

    if (accounts.length === 0) {
      accountGrid.innerHTML = '<div class="admin-empty">Ingen kundekontoer ennå. Klikk &laquo;Ny konto&raquo; for å opprette den første.</div>';
      document.getElementById('statLive').textContent = '0';
      document.getElementById('statDraft').textContent = '0';
      return;
    }

    accounts.forEach(account => {
      const state = getAccountState(account.id);
      const template = getTemplate(state.templateId);
      if (state.status === 'live') liveCount++; else draftCount++;

      const card = document.createElement('div');
      card.className = 'account-card';
      card.innerHTML = `
        <div class="account-card-head">
          <div class="account-card-icon">${template.icon}</div>
          <div class="account-card-title">
            <h3>${account.projectName}</h3>
            <p>@${account.username}</p>
          </div>
          ${statusLabel(state.status)}
        </div>
        <div class="account-card-meta">
          <span>Bransje: <strong>${template.label}</strong></span>
          <span>Domene: <strong>${state.domain}</strong></span>
          <span>Passord: <strong>${account.password}</strong></span>
        </div>
        <div class="account-card-actions">
          <button class="btn btn-primary btn-small edit-btn">Rediger nettside</button>
          <button class="btn btn-outline btn-small view-btn">Se nettside</button>
          <button class="btn-danger-ghost delete-btn" title="Slett konto" aria-label="Slett konto">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
      `;
      card.querySelector('.edit-btn').addEventListener('click', () => {
        window.location.href = `builder.html?account=${account.id}`;
      });
      card.querySelector('.view-btn').addEventListener('click', () => {
        window.open(`site.html?account=${account.id}`, '_blank');
      });
      card.querySelector('.delete-btn').addEventListener('click', () => {
        if (confirm(`Slette kontoen "${account.projectName}" (@${account.username})? Dette kan ikke angres.`)) {
          deleteAccount(account.id);
          renderAccounts();
        }
      });
      accountGrid.appendChild(card);
    });

    document.getElementById('statLive').textContent = liveCount;
    document.getElementById('statDraft').textContent = draftCount;
  }

  /* ===================== NEW ACCOUNT MODAL ===================== */
  const newAccountModal = document.getElementById('newAccountModal');
  const newAccountForm = document.getElementById('newAccountForm');
  const newAccountError = document.getElementById('newAccountError');

  document.getElementById('newAccountBtn').addEventListener('click', () => {
    newAccountForm.reset();
    newAccountError.classList.remove('show');
    newAccountModal.classList.add('open');
  });
  document.getElementById('closeNewAccountModal').addEventListener('click', () => {
    newAccountModal.classList.remove('open');
  });
  newAccountModal.addEventListener('click', (e) => {
    if (e.target.id === 'newAccountModal') newAccountModal.classList.remove('open');
  });

  newAccountForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('na-username').value.trim();
    const password = document.getElementById('na-password').value.trim();
    const projectName = document.getElementById('na-projectname').value.trim();
    const templateId = document.getElementById('na-template').value;
    const securityCode = document.getElementById('na-security-code').value.trim();

    if (!username || !password || !projectName || !securityCode) {
      newAccountError.textContent = 'Fyll ut alle feltene.';
      newAccountError.classList.add('show');
      return;
    }

    if (securityCode.length < 12) {
      newAccountError.textContent = 'Sikkerhetsnøkkelen må være minst 12 tegn.';
      newAccountError.classList.add('show');
      return;
    }

    if (usernameTaken(username)) {
      newAccountError.textContent = 'Dette brukernavnet er allerede i bruk.';
      newAccountError.classList.add('show');
      return;
    }

    const newAccount = createAccount({ username, password, projectName, templateId });
    console.log('NEW ACCOUNT:', newAccount);
    
    newAccountModal.classList.remove('open');
    renderAccounts();
  });

  renderAccounts();
}

