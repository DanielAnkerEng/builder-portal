/* ===================== DATA: BRANSJER / DEMO-NETTSIDER ===================== */
const industries = [
  {
    id: 'restaurant',
    icon: '🌯',
    navName: 'Restaurant / takeaway',
    cardTitle: 'Restaurant / takeaway',
    cardDesc: 'Meny, kontakt og åpningstider rett foran kunden.',
    tabLabel: 'Restaurant',
    url: 'bransjedemo.example',
    showTitle: 'Glød Kjøkken (demo)',
    showDesc: 'En sulten kunde skal kunne åpne siden og finne meny, kontakt og åpningstider på under 30 sekunder. Sterk atmosfære og tydelig struktur gjør valget enkelt.',
    features: ['Oversiktlig digital meny', 'Tydelig vei til bestilling', 'Åpningstider synlig på forsiden', 'Atmosfære og mat i fokus'],
    bg: 'linear-gradient(150deg,#2b0f0a,#160705 60%)',
    accent: '#ff7a3d',
    accent2: '#ffb14e',
    badge: 'FIKTIV DEMO',
    heroTag: 'Kebab & Grill',
    heroTitle: 'Ekte kebab.\nEkte smak.',
    heroSub: 'Laget fra bunnen hver dag med ferske råvarer, midt i sentrum.',
    cta: 'Se menyen',
    cards: [
      { t: '🌯 Signaturrull', d: 'Husets favoritt' },
      { t: '🔥 Grilltallerken', d: 'Rett fra grillen' },
      { t: '🥗 Friske sider', d: 'Laget hver dag' },
    ],
    footerLeft: 'Fiktivt eksempel',
    footerRight: 'Ingen innsending eller live-data',
  },
  {
    id: 'frisor',
    icon: '💇',
    navName: 'Frisør / skjønnhet',
    cardTitle: 'Frisør / skjønnhet',
    cardDesc: 'Timebestilling og porteføljebilder som selger stilen din.',
    tabLabel: 'Frisør',
    url: 'bransjedemo.example',
    showTitle: 'Studio Frisør & Skjønnhet',
    showDesc: 'Design som føles eksklusivt uten å være vanskelig å bruke. Kundene finner behandlingene og kan be om en time direkte fra forsiden.',
    features: ['Enkel timeforespørsel', 'Tydelig behandlingsoversikt', 'Redaksjonelt galleri', 'Kundeomtaler på forsiden'],
    bg: 'linear-gradient(150deg,#2a0f24,#170513 60%)',
    accent: '#ff6fb5',
    accent2: '#c98bff',
    badge: 'FIKTIV DEMO',
    heroTag: 'Hår & Skjønnhet',
    heroTitle: 'Ny look,\nny selvtillit.',
    heroSub: 'Klipp, farge og styling av erfarne frisører i hjertet av byen.',
    cta: 'Be om en time',
    cards: [
      { t: '✂️ Klipp', d: 'Personlig tilpasset' },
      { t: '🎨 Farge', d: 'Dybde og glans' },
      { t: '✨ Styling', d: 'Til hverdag og fest' },
    ],
    footerLeft: 'Fiktivt eksempel',
    footerRight: 'Ingen innsending eller live-data',
  },
  {
    id: 'handverker',
    icon: '🔧',
    navName: 'Håndverker',
    cardTitle: 'Håndverker',
    cardDesc: 'Bygg tillit med referanseprosjekter og rask kontakt.',
    tabLabel: 'Håndverker',
    url: 'bransjedemo.example',
    showTitle: 'Form Rørservice (demo)',
    showDesc: 'Trygghet og tillit i hver piksel. Store bilder av gjennomførte prosjekter, tydelig telefonnummer og enkel kontakt for befaring.',
    features: ['Referanseprosjekter med bilder', 'Ring-knapp alltid synlig', 'Tilbudsskjema for befaring', 'Tydelig tjenestepresentasjon'],
    bg: 'linear-gradient(150deg,#0b1c2b,#050d16 60%)',
    accent: '#4f8bff',
    accent2: '#22d3ee',
    badge: 'FIKTIV DEMO',
    heroTag: 'Rørlegger',
    heroTitle: 'Rørleggerhjelp\ndu kan stole på.',
    heroSub: 'Fra akutt lekkasje til komplett baderomsrenovering.',
    cta: 'Få gratis befaring',
    cards: [
      { t: '🚨 Akutt hjelp', d: 'Eksempel på tjeneste' },
      { t: '🛁 Rehab bad', d: 'Fra idé til ferdig bad' },
      { t: '🏗️ Nyanlegg', d: 'Prosjekttilbud' },
    ],
    footerLeft: 'Fiktivt eksempel',
    footerRight: 'Ingen innsending eller live-data',
  },
  {
    id: 'bilverksted',
    icon: '🚗',
    navName: 'Bilverksted',
    cardTitle: 'Bilverksted',
    cardDesc: 'Finn riktig service og send en enkel forespørsel.',
    tabLabel: 'Bilverksted',
    url: 'bransjedemo.example',
    showTitle: 'Ekspress Bilverksted',
    showDesc: 'Rett på sak: finn riktig tjeneste og verkstedet på kartet. Ingen unødvendige steg mellom kunde og forespørsel.',
    features: ['Enkel serviceforespørsel', 'Tydelig tjenesteoversikt', 'Dekkhotell-informasjon', 'Praktisk kundeoppfølging'],
    bg: 'linear-gradient(150deg,#1b1b1f,#0a0a0c 60%)',
    accent: '#ff4d4d',
    accent2: '#ff9a5a',
    badge: 'FIKTIV DEMO',
    heroTag: 'Bilverksted',
    heroTitle: 'Service. Dekk.\nEU-kontroll.',
    heroSub: 'Rask og pålitelig service for alle bilmerker, med oversiktlig tjenestepresentasjon.',
    cta: 'Send forespørsel',
    cards: [
      { t: '🛠️ Service', d: 'For alle bilmerker' },
      { t: '🛞 Dekkskift', d: 'Effektivt og trygt' },
      { t: '📋 EU-kontroll', d: 'Bestill ønsket tid' },
    ],
    footerLeft: 'Fiktivt eksempel',
    footerRight: 'Ingen innsending eller live-data',
  },
  {
    id: 'eiendom',
    icon: '🏠',
    navName: 'Eiendom',
    cardTitle: 'Eiendom',
    cardDesc: 'Vis frem boliger med stil, kart og visningspåmelding.',
    tabLabel: 'Eiendom',
    url: 'bransjedemo.example',
    showTitle: 'Fjord Eiendomsmegling',
    showDesc: 'Magasinaktig design som får boligene til å skinne. Eksempelinnhold for boliger og kontakt.',
    features: ['Presentasjon av boligtyper', 'Visningspåmelding', 'Eksempel på beliggenhet', 'Prisantydning og nøkkeltall'],
    bg: 'linear-gradient(150deg,#161821,#0a0b10 60%)',
    accent: '#c9a15a',
    accent2: '#4f8bff',
    badge: 'FIKTIV DEMO',
    heroTag: 'Eiendomsmegling',
    heroTitle: 'Din bolig,\nvårt håndverk.',
    heroSub: 'Vi hjelper deg å finne, eller selge, hjemmet ditt.',
    cta: 'Se boliger',
    cards: [
      { t: '🏡 Enebolig, Nordstrand', d: 'Eksempelbolig' },
      { t: '🏢 Leilighet, Grünerløkka', d: 'Eksempelbolig' },
      { t: '🏘️ Rekkehus, Bekkestua', d: 'Eksempelbolig' },
    ],
    footerLeft: 'Fiktivt eksempel',
    footerRight: 'Ingen innsending eller live-data',
  },
  {
    id: 'konsulent',
    icon: '📊',
    navName: 'Konsulent / regnskap',
    cardTitle: 'Konsulent / regnskap',
    cardDesc: 'Profesjonell tillit fra første sekund, med enkel booking.',
    tabLabel: 'Konsulent',
    url: 'bransjedemo.example',
    showTitle: 'Nord Regnskap & Rådgivning',
    showDesc: 'Ryddig, seriøst og tillitsvekkende. Perfekt for tjenester der kunden må stole på deg før de tar kontakt.',
    features: ['Book gratis konsultasjon', 'Tydelig tjenesteoversikt', 'Eksempel på faglig innhold', 'Oversiktlig kontaktseksjon'],
    bg: 'linear-gradient(150deg,#0c1f1c,#05100d 60%)',
    accent: '#2fd6a7',
    accent2: '#22d3ee',
    badge: 'FIKTIV DEMO',
    heroTag: 'Regnskap & Rådgivning',
    heroTitle: 'Tall du\nkan stole på.',
    heroSub: 'Regnskap, lønn og rådgivning for små og mellomstore bedrifter.',
    cta: 'Book samtale',
    cards: [
      { t: '📒 Regnskap', d: 'Oversikt hele året' },
      { t: '💡 Rådgivning', d: 'Beslutningsstøtte' },
      { t: '🧾 Skatt & MVA', d: 'Riktig og ryddig' },
    ],
    footerLeft: 'Fiktivt eksempel',
    footerRight: 'Ingen innsending eller live-data',
  },
];

let currentIndex = 0;
let currentView = 'desktop';

/* ===================== RENDER: INDUSTRY CARDS ===================== */
const industryGrid = document.getElementById('industryGrid');
industries.forEach((ind, i) => {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'industry-card';
  card.innerHTML = `
    <div class="industry-icon">${ind.icon}</div>
    <h3>${ind.cardTitle}</h3>
    <p>${ind.cardDesc}</p>
    <div class="industry-arrow">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M7 17L17 7M17 7H8M17 7v9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>
  `;
  card.addEventListener('click', () => {
    selectIndustry(i);
    document.getElementById('portfolio').scrollIntoView({ behavior: 'smooth' });
  });
  industryGrid.appendChild(card);
});

/* ===================== RENDER: PORTFOLIO TABS ===================== */
const portfolioTabs = document.getElementById('portfolioTabs');
industries.forEach((ind, i) => {
  const tab = document.createElement('button');
  tab.className = 'tab-btn';
  tab.textContent = ind.tabLabel;
  tab.addEventListener('click', () => selectIndustry(i));
  portfolioTabs.appendChild(tab);
});

/* ===================== BUILD SITE PREVIEW HTML ===================== */
function buildPreviewHTML(ind) {
  return `
    <div class="sp" style="background:${ind.bg}; color:#fff;">
      <div class="sp-nav">
        <span>${ind.showTitle}</span>
        <span class="sp-nav-links"><span>Meny</span><span>Om oss</span><span>Kontakt</span></span>
      </div>
      <div class="sp-hero">
        <span class="sp-badge" style="background:${ind.accent};color:#0a0a0a;">${ind.badge}</span>
        <div class="sp-hero-tag" style="color:${ind.accent2};">${ind.heroTag}</div>
        <h4>${ind.heroTitle.replace('\n', '<br>')}</h4>
        <p>${ind.heroSub}</p>
        <span class="sp-btn" style="background:${ind.accent};color:#0a0a0a;">${ind.cta}</span>
      </div>
      <div class="sp-row">
        ${ind.cards.map(c => `
          <div class="sp-card" style="background:rgba(255,255,255,0.06);">
            <div class="t">${c.t}</div>
            <div style="opacity:.75">${c.d}</div>
          </div>
        `).join('')}
      </div>
      <div class="sp-foot">
        <span>${ind.footerLeft}</span>
        <span>${ind.footerRight}</span>
      </div>
    </div>
  `;
}

/* ===================== SELECT INDUSTRY ===================== */
const showTag = document.getElementById('showTag');
const showTitle = document.getElementById('showTitle');
const showDesc = document.getElementById('showDesc');
const showFeatures = document.getElementById('showFeatures');
const browserUrl = document.getElementById('browserUrl');
const sitePreviewDesktop = document.getElementById('sitePreviewDesktop');
const sitePreviewMobile = document.getElementById('sitePreviewMobile');
const showFullDemo = document.getElementById('showFullDemo');
const tabButtons = () => document.querySelectorAll('.tab-btn');
const industryCards = () => document.querySelectorAll('.industry-card');

function selectIndustry(i) {
  currentIndex = i;
  const ind = industries[i];

  showTag.textContent = ind.navName;
  showTitle.textContent = ind.showTitle;
  showDesc.textContent = ind.showDesc;
  showFeatures.innerHTML = ind.features.map(f => `<li>${f}</li>`).join('');
  browserUrl.textContent = ind.url;
  showFullDemo.href = `demo.html?site=${encodeURIComponent(ind.id)}`;

  const html = buildPreviewHTML(ind);
  sitePreviewDesktop.innerHTML = html;
  sitePreviewMobile.innerHTML = html;

  tabButtons().forEach((btn, idx) => btn.classList.toggle('active', idx === i));
  industryCards().forEach((card, idx) => card.classList.toggle('active', idx === i));
}
selectIndustry(0);

/* ===================== VIEW TOGGLE (desktop/mobil) ===================== */
const viewBtns = document.querySelectorAll('.view-btn');
const mockupStage = document.querySelector('.mockup-stage');
viewBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    currentView = btn.dataset.view;
    viewBtns.forEach(b => b.classList.toggle('active', b === btn));
    mockupStage.classList.toggle('mobile-focus', currentView === 'mobile');
  });
});

/* ===================== NAV: SCROLL STATE + MOBILE TOGGLE ===================== */
const navEl = document.getElementById('nav');
window.addEventListener('scroll', () => {
  navEl.classList.toggle('scrolled', window.scrollY > 20);
}, { passive: true });

const navToggle = document.getElementById('navToggle');
navToggle.addEventListener('click', () => {
  const links = document.querySelector('.nav-links');
  const isOpen = links.classList.contains('is-open');
  navToggle.setAttribute('aria-expanded', String(!isOpen));
  links.classList.toggle('is-open', !isOpen);
});
document.querySelectorAll('.nav-links a').forEach(a => {
  a.addEventListener('click', () => {
    document.querySelector('.nav-links').classList.remove('is-open');
    navToggle.setAttribute('aria-expanded', 'false');
  });
});

/* ===================== SCROLL REVEAL ===================== */
const revealEls = document.querySelectorAll('.reveal');
const io = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('in-view');
      io.unobserve(entry.target);
    }
  });
}, { threshold: 0.15 });
revealEls.forEach(el => io.observe(el));

/* ===================== CURSOR GLOW ===================== */
const cursorGlow = document.getElementById('cursorGlow');
let glowX = 0, glowY = 0, targetX = 0, targetY = 0;
window.addEventListener('mousemove', (e) => {
  targetX = e.clientX;
  targetY = e.clientY;
});
function animateGlow() {
  glowX += (targetX - glowX) * 0.08;
  glowY += (targetY - glowY) * 0.08;
  cursorGlow.style.transform = `translate(${glowX}px, ${glowY}px) translate(-50%, -50%)`;
  requestAnimationFrame(animateGlow);
}
animateGlow();
