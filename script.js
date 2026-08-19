/* ===================== DATA: BRANSJER / DEMO-NETTSIDER ===================== */
const industries = [
  {
    id: 'restaurant',
    icon: '🌯',
    navName: 'Restaurant / takeaway',
    cardTitle: 'Restaurant / takeaway',
    cardDesc: 'Meny, bestilling og åpningstider rett foran kunden.',
    tabLabel: 'Restaurant',
    url: 'baeroskebab.no',
    showTitle: 'Bæros Kebab',
    showDesc: 'En sulten kunde skal kunne åpne siden, se menyen, og bestille på under 30 sekunder. Stort matbilde, tydelig CTA og åpningstider rett under logoen.',
    features: ['Digital meny med priser', 'Bestill-knapp til nettbestilling', 'Åpningstider synlig på forsiden', 'Bilder av maten i fokus'],
    bg: 'linear-gradient(150deg,#2b0f0a,#160705 60%)',
    accent: '#ff7a3d',
    accent2: '#ffb14e',
    badge: 'Åpent nå · 11–23',
    heroTag: 'Kebab & Grill',
    heroTitle: 'Ekte kebab.\nEkte smak.',
    heroSub: 'Laget fra bunnen hver dag med ferske råvarer, midt i sentrum.',
    cta: 'Bestill nå',
    cards: [
      { t: '🌯 Kebabrull', d: '139 kr' },
      { t: '🍗 Kebabtallerken', d: '169 kr' },
      { t: '🥤 Meny med drikke', d: '189 kr' },
    ],
    footerLeft: '📍 Storgata 14, Oslo',
    footerRight: 'Åpent 11–23 alle dager',
  },
  {
    id: 'frisor',
    icon: '💇',
    navName: 'Frisør / skjønnhet',
    cardTitle: 'Frisør / skjønnhet',
    cardDesc: 'Timebestilling og porteføljebilder som selger stilen din.',
    tabLabel: 'Frisør',
    url: 'studiofrisor.no',
    showTitle: 'Studio Frisør & Skjønnhet',
    showDesc: 'Design som føles eksklusivt uten å være vanskelig å bruke. Kundene booker time direkte fra forsiden, på under ett minutt.',
    features: ['Online timebestilling', 'Prisliste for alle behandlinger', 'Instagram-stil galleri', 'Google Reviews vist på forsiden'],
    bg: 'linear-gradient(150deg,#2a0f24,#170513 60%)',
    accent: '#ff6fb5',
    accent2: '#c98bff',
    badge: 'Ledige timer denne uken',
    heroTag: 'Hår & Skjønnhet',
    heroTitle: 'Ny look,\nny selvtillit.',
    heroSub: 'Klipp, farge og styling av erfarne frisører i hjertet av byen.',
    cta: 'Book time',
    cards: [
      { t: '✂️ Klipp', d: 'fra 650 kr' },
      { t: '🎨 Farge', d: 'fra 1200 kr' },
      { t: '✨ Styling', d: 'fra 450 kr' },
    ],
    footerLeft: '📍 Bogstadveien 22, Oslo',
    footerRight: 'Book online 24/7',
  },
  {
    id: 'handverker',
    icon: '🔧',
    navName: 'Håndverker',
    cardTitle: 'Håndverker',
    cardDesc: 'Bygg tillit med referanseprosjekter og rask kontakt.',
    tabLabel: 'Håndverker',
    url: 'haugenror.no',
    showTitle: 'Haugen Rørlegger AS',
    showDesc: 'Trygghet og tillit i hver piksel. Store bilder av gjennomførte prosjekter, tydelig telefonnummer og enkel kontakt for befaring.',
    features: ['Referanseprosjekter med bilder', 'Ring-knapp alltid synlig', 'Tilbudsskjema for befaring', 'Godkjenninger og sertifiseringer'],
    bg: 'linear-gradient(150deg,#0b1c2b,#050d16 60%)',
    accent: '#4f8bff',
    accent2: '#22d3ee',
    badge: 'Døgnvakt tilgjengelig',
    heroTag: 'Rørlegger',
    heroTitle: 'Rørleggerhjelp\ndu kan stole på.',
    heroSub: 'Fra akutt lekkasje til komplett baderomsrenovering.',
    cta: 'Få gratis befaring',
    cards: [
      { t: '🚨 Akutt hjelp', d: 'Innen 1 time' },
      { t: '🛁 Rehab bad', d: 'Fastpris' },
      { t: '🏗️ Nyanlegg', d: 'Prosjekttilbud' },
    ],
    footerLeft: '📍 Betjener hele Oslo-området',
    footerRight: 'Ring: 900 00 000',
  },
  {
    id: 'bilverksted',
    icon: '🚗',
    navName: 'Bilverksted',
    cardTitle: 'Bilverksted',
    cardDesc: 'Book service og EU-kontroll direkte på nett.',
    tabLabel: 'Bilverksted',
    url: 'ekspressverksted.no',
    showTitle: 'Ekspress Bilverksted',
    showDesc: 'Rett på sak: book service, se priser og finn verkstedet ditt på kartet. Ingen unødvendige steg mellom kunde og bestilling.',
    features: ['Book service online', 'Fast pris på EU-kontroll', 'Dekkhotell-oversikt', 'Live status på bilen din'],
    bg: 'linear-gradient(150deg,#1b1b1f,#0a0a0c 60%)',
    accent: '#ff4d4d',
    accent2: '#ff9a5a',
    badge: 'Ledig verkstedtid i dag',
    heroTag: 'Bilverksted',
    heroTitle: 'Service. Dekk.\nEU-kontroll.',
    heroSub: 'Rask og pålitelig service for alle bilmerker, samme dag.',
    cta: 'Book verksted',
    cards: [
      { t: '🛠️ Service', d: 'fra 1990 kr' },
      { t: '🛞 Dekkskift', d: 'fra 490 kr' },
      { t: '📋 EU-kontroll', d: '990 kr' },
    ],
    footerLeft: '📍 Industriveien 8, Bergen',
    footerRight: 'Åpent 07–17 man–fre',
  },
  {
    id: 'eiendom',
    icon: '🏠',
    navName: 'Eiendom',
    cardTitle: 'Eiendom',
    cardDesc: 'Vis frem boliger med stil, kart og visningspåmelding.',
    tabLabel: 'Eiendom',
    url: 'fjordeiendom.no',
    showTitle: 'Fjord Eiendomsmegling',
    showDesc: 'Magasinaktig design som får boligene til å skinne. Filtrerbar boligliste, stort bildefokus og enkel visningspåmelding.',
    features: ['Boligliste med filter', 'Visningspåmelding', 'Interaktivt kart', 'Prisantydning og nøkkeltall'],
    bg: 'linear-gradient(150deg,#161821,#0a0b10 60%)',
    accent: '#c9a15a',
    accent2: '#4f8bff',
    badge: '12 boliger til salgs',
    heroTag: 'Eiendomsmegling',
    heroTitle: 'Din bolig,\nvårt håndverk.',
    heroSub: 'Vi hjelper deg å finne, eller selge, hjemmet ditt.',
    cta: 'Se boliger',
    cards: [
      { t: '🏡 Enebolig, Nordstrand', d: '8,9 mill' },
      { t: '🏢 Leilighet, Grünerløkka', d: '4,2 mill' },
      { t: '🏘️ Rekkehus, Bekkestua', d: '6,5 mill' },
    ],
    footerLeft: '📍 Karl Johans gate 5, Oslo',
    footerRight: 'Gratis verdivurdering',
  },
  {
    id: 'konsulent',
    icon: '📊',
    navName: 'Konsulent / regnskap',
    cardTitle: 'Konsulent / regnskap',
    cardDesc: 'Profesjonell tillit fra første sekund, med enkel booking.',
    tabLabel: 'Konsulent',
    url: 'nordregnskap.no',
    showTitle: 'Nord Regnskap & Rådgivning',
    showDesc: 'Ryddig, seriøst og tillitsvekkende. Perfekt for tjenester der kunden må stole på deg før de tar kontakt.',
    features: ['Book gratis konsultasjon', 'Tydelig tjenesteoversikt', 'Kundecase og resultater', 'Sikker kontakt/kundeportal'],
    bg: 'linear-gradient(150deg,#0c1f1c,#05100d 60%)',
    accent: '#2fd6a7',
    accent2: '#22d3ee',
    badge: 'Gratis førstegangssamtale',
    heroTag: 'Regnskap & Rådgivning',
    heroTitle: 'Tall du\nkan stole på.',
    heroSub: 'Regnskap, lønn og rådgivning for små og mellomstore bedrifter.',
    cta: 'Book samtale',
    cards: [
      { t: '📒 Regnskap', d: 'fra 990 kr/mnd' },
      { t: '💡 Rådgivning', d: 'Timepris' },
      { t: '🧾 Skatt & MVA', d: 'Fastpris' },
    ],
    footerLeft: '📍 Rådhusgata 2, Trondheim',
    footerRight: 'Svar innen 24 timer',
  },
];

let currentIndex = 0;
let currentView = 'desktop';

/* ===================== RENDER: INDUSTRY CARDS ===================== */
const industryGrid = document.getElementById('industryGrid');
industries.forEach((ind, i) => {
  const card = document.createElement('div');
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
  const isOpen = links.style.display === 'flex';
  links.style.display = isOpen ? 'none' : 'flex';
  links.style.cssText += isOpen ? '' : `
    position:absolute; top:100%; left:0; right:0;
    flex-direction:column; background:rgba(8,9,12,0.97);
    padding:24px 32px; border-bottom:1px solid var(--border);
    gap:18px;
  `;
});
document.querySelectorAll('.nav-links a').forEach(a => {
  a.addEventListener('click', () => {
    if (window.innerWidth <= 720) document.querySelector('.nav-links').style.display = 'none';
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

/* ===================== COUNT-UP STATS ===================== */
const statNums = document.querySelectorAll('.stat-num');
const statIO = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const el = entry.target;
    const target = parseInt(el.dataset.count, 10);
    const duration = 1400;
    const start = performance.now();
    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(eased * target);
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    statIO.unobserve(el);
  });
}, { threshold: 0.5 });
statNums.forEach(el => statIO.observe(el));

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

/* ===================== CONTACT FORM (DEMO ONLY) ===================== */
const contactForm = document.getElementById('contactForm');
contactForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const btn = contactForm.querySelector('button[type="submit"] span');
  const original = btn.textContent;
  btn.textContent = 'Takk! Vi tar kontakt ✓';
  contactForm.querySelector('button[type="submit"]').style.opacity = '0.85';
  setTimeout(() => {
    btn.textContent = original;
    contactForm.querySelector('button[type="submit"]').style.opacity = '1';
    contactForm.reset();
  }, 2600);
});
