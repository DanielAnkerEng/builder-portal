/* ===================== KONTOER / MULTI-PROSJEKT ===================== */
const SESSION_KEY = 'sn_session';
const ACCOUNTS_KEY = 'sn_accounts';
const DEMO_VERSION_KEY = 'sn_demo_version';

function stateKeyFor(accountId) {
  return `sn_builder_state__${accountId}`;
}

function seedAccountsIfNeeded() {
  if (localStorage.getItem(ACCOUNTS_KEY)) {
    ensureDemoAccounts();
    return;
  }

  const admin = {
    id: 'acc_admin',
    username: 'admin',
    password: '123',
    role: 'admin',
    email: 'admin@studionord.no',
    projectName: 'StudioNord Hovedkontor',
    templateId: null,
    createdAt: new Date().toISOString(),
  };
  const user = {
    id: 'acc_bruker',
    username: 'bruker',
    password: '123',
    role: 'user',
    email: 'bruker@studionord.no',
    projectName: 'Mitt nettsideprosjekt',
    templateId: 'restaurant',
    createdAt: new Date().toISOString(),
  };

  const demos = additionalDemoAccounts();
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify([admin, user, ...demos]));
  localStorage.setItem(stateKeyFor(user.id), JSON.stringify(freshStateFromTemplate(user.templateId)));
  demos.forEach(account => localStorage.setItem(stateKeyFor(account.id), JSON.stringify(demoStateFor(account))));
  localStorage.setItem(DEMO_VERSION_KEY, '2');
}

function additionalDemoAccounts() {
  return [
    fjordDemoAccount(),
    { id: 'acc_salong', username: 'salong', password: 'salong123', role: 'user', email: 'hei@nordlysstudio.no', projectName: 'Nordlys Hårstudio', templateId: 'frisor', createdAt: new Date().toISOString() },
    { id: 'acc_ror', username: 'ror', password: 'ror123', role: 'user', email: 'post@tryggror.no', projectName: 'Trygg Rørservice', templateId: 'handverker', createdAt: new Date().toISOString() },
    { id: 'acc_regnskap', username: 'tall', password: 'tall123', role: 'user', email: 'hei@klarregnskap.no', projectName: 'Klar Regnskap', templateId: 'konsulent', createdAt: new Date().toISOString() },
    { id: 'acc_mat', username: 'smak', password: 'smak123', role: 'user', email: 'bestilling@fjordgrill.no', projectName: 'Fjordgrill', templateId: 'restaurant', createdAt: new Date().toISOString() },
  ];
}

const DEMO_SITE_WIDE_KEYS = ['businessName', 'domain'];

function demoStateFor(account) {
  const state = freshStateFromTemplate(account.templateId);
  const home = state.pages[0];
  const custom = {
    acc_fjord: {},
    acc_salong: { businessName: 'Nordlys Hårstudio', domain: 'nordlyshar.no', heroTitle: 'Hår som føles\nhelt som deg.', heroSub: 'En rolig salongopplevelse med dyktige stylister, gode produkter og tid til deg.', badge: 'Ledige timer denne uken', address: 'Markveien 32, Oslo' },
    acc_ror: { businessName: 'Trygg Rørservice', domain: 'tryggror.no', heroTitle: 'Rask hjelp.\nSkikkelig utført.', heroSub: 'Lokale rørleggere med døgnvakt, tydelige priser og fagfolk du kan stole på.', badge: 'Døgnvakt · svar innen 5 minutter', address: 'Vi dekker Oslo og Akershus' },
    acc_regnskap: { businessName: 'Klar Regnskap', domain: 'klarregnskap.no', heroTitle: 'Mer oversikt.\nMindre stress.', heroSub: 'Moderne regnskap og personlig rådgivning for bedrifter som vil bruke tiden på vekst.', badge: 'Gratis oppstartsmøte', address: 'Dronningens gate 12, Trondheim' },
    acc_mat: { businessName: 'Fjordgrill', domain: 'fjordgrill.no', heroTitle: 'Smaken av kysten.\nRett fra grillen.', heroSub: 'Ferske råvarer, varme smaker og en avslappet restaurant ved vannet.', badge: 'Åpent i dag 12–23', address: 'Bryggetorget 2, Drøbak' },
  }[account.id] || {};
  Object.entries(custom).forEach(([key, value]) => {
    if (DEMO_SITE_WIDE_KEYS.includes(key)) state[key] = value;
    else home[key] = value;
  });
  state.seoTitle = `${state.businessName} | ${home.heroTag}`;
  return state;
}

function fjordDemoAccount() {
  return {
    id: 'acc_fjord',
    username: 'fjord',
    password: 'fjord123',
    role: 'user',
    email: 'demo@fjordbolig.no',
    projectName: 'Fjord Eiendom',
    templateId: 'fjordbolig',
    createdAt: new Date().toISOString(),
  };
}

function ensureFjordDemoAccount() {
  const accounts = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]');
  if (accounts.some(a => a.id === 'acc_fjord' || a.username.toLowerCase() === 'fjord')) return;
  const fjord = fjordDemoAccount();
  accounts.push(fjord);
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  localStorage.setItem(stateKeyFor(fjord.id), JSON.stringify(freshStateFromTemplate(fjord.templateId)));
}

function ensureDemoAccounts() {
  const accounts = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]');
  let changed = false;
  additionalDemoAccounts().forEach(account => {
    if (accounts.some(a => a.id === account.id || a.username.toLowerCase() === account.username)) return;
    accounts.push(account);
    localStorage.setItem(stateKeyFor(account.id), JSON.stringify(demoStateFor(account)));
    changed = true;
  });
  if (changed) localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  if (localStorage.getItem(DEMO_VERSION_KEY) !== '2') {
    additionalDemoAccounts().forEach(account => {
      localStorage.setItem(stateKeyFor(account.id), JSON.stringify(demoStateFor(account)));
    });
    localStorage.setItem(DEMO_VERSION_KEY, '2');
  }
}

function getAccounts() {
  return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]');
}

function saveAccounts(list) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list));
}

function findAccountById(id) {
  return getAccounts().find(a => a.id === id) || null;
}

function findAccountByCredentials(username, password) {
  const uname = (username || '').trim().toLowerCase();
  return getAccounts().find(a => a.username.toLowerCase() === uname && a.password === password) || null;
}

function usernameTaken(username) {
  const uname = (username || '').trim().toLowerCase();
  return getAccounts().some(a => a.username.toLowerCase() === uname);
}

function updateAccount(id, patch) {
  const accounts = getAccounts().map(a => a.id === id ? { ...a, ...patch } : a);
  saveAccounts(accounts);
  return findAccountById(id);
}

function createAccount({ username, password, projectName, templateId, companyId }) {
  const id = 'acc_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const account = {
    id,
    username: username.trim(),
    password,
    role: 'user',
    email: `${username.trim().toLowerCase()}@studionord.no`,
    projectName: projectName || 'Nytt nettsideprosjekt',
    templateId,
    companyId,
    createdAt: new Date().toISOString(),
  };
  const accounts = getAccounts();
  accounts.push(account);
  saveAccounts(accounts);
  localStorage.setItem(stateKeyFor(id), JSON.stringify(freshStateFromTemplate(templateId)));
  return account;
}

function deleteAccount(id) {
  saveAccounts(getAccounts().filter(a => a.id !== id));
  localStorage.removeItem(stateKeyFor(id));
}

function getAccountState(id) {
  const account = findAccountById(id);
  if (!account) return null;
  const stored = JSON.parse(localStorage.getItem(stateKeyFor(id)) || 'null');
  return migrateToPages(stored) || freshStateFromTemplate(account.templateId || 'restaurant');
}

seedAccountsIfNeeded();
