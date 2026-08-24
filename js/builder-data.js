/* ===================== BUILDER: BRANSJE-MALER ===================== */
const BUILDER_TEMPLATES = [
  {
    id: 'restaurant',
    icon: '🌯',
    label: 'Restaurant / takeaway',
    url: 'baeroskebab.no',
    businessName: 'Bæros Kebab',
    heroTag: 'Kebab & Grill',
    heroTitle: 'Ekte kebab.\nEkte smak.',
    heroSub: 'Laget fra bunnen hver dag med ferske råvarer, midt i sentrum.',
    cta: 'Bestill nå',
    badge: 'Åpent nå · 11–23',
    aboutTitle: 'Om oss',
    aboutText: 'Bæros Kebab har servert ekte, hjemmelaget kebab i Oslo siden 2014. Vi bruker ferske råvarer og egen krydderblanding i alt vi lager.',
    offeringsLabel: 'Meny',
    offerings: [
      { t: '🌯 Kebabrull', d: '139 kr' },
      { t: '🍗 Kebabtallerken', d: '169 kr' },
      { t: '🥤 Meny med drikke', d: '189 kr' },
    ],
    gallery: ['🌯', '🍟', '🥙', '🥤'],
    address: 'Storgata 14, Oslo',
    hours: 'Åpent 11–23 alle dager',
    bg: 'linear-gradient(150deg,#2b0f0a,#160705 60%)',
    accent: '#ff7a3d',
    accent2: '#ffb14e',
  },
  {
    id: 'frisor',
    icon: '💇',
    label: 'Frisør / skjønnhet',
    url: 'studiofrisor.no',
    businessName: 'Studio Frisør & Skjønnhet',
    heroTag: 'Hår & Skjønnhet',
    heroTitle: 'Ny look,\nny selvtillit.',
    heroSub: 'Klipp, farge og styling av erfarne frisører i hjertet av byen.',
    cta: 'Book time',
    badge: 'Ledige timer denne uken',
    aboutTitle: 'Om studioet',
    aboutText: 'Studio Frisør & Skjønnhet er stedet du kommer for å føle deg som den beste versjonen av deg selv. Erfarne frisører, avslappet atmosfære.',
    offeringsLabel: 'Tjenester & priser',
    offerings: [
      { t: '✂️ Klipp', d: 'fra 650 kr' },
      { t: '🎨 Farge', d: 'fra 1200 kr' },
      { t: '✨ Styling', d: 'fra 450 kr' },
    ],
    gallery: ['💇‍♀️', '💅', '✂️', '🎨'],
    address: 'Bogstadveien 22, Oslo',
    hours: 'Book online 24/7',
    bg: 'linear-gradient(150deg,#2a0f24,#170513 60%)',
    accent: '#ff6fb5',
    accent2: '#c98bff',
  },
  {
    id: 'handverker',
    icon: '🔧',
    label: 'Håndverker',
    url: 'haugenror.no',
    businessName: 'Haugen Rørlegger AS',
    heroTag: 'Rørlegger',
    heroTitle: 'Rørleggerhjelp\ndu kan stole på.',
    heroSub: 'Fra akutt lekkasje til komplett baderomsrenovering.',
    cta: 'Få gratis befaring',
    badge: 'Døgnvakt tilgjengelig',
    aboutTitle: 'Om oss',
    aboutText: 'Haugen Rørlegger AS har over 20 års erfaring med rørleggerarbeid i Oslo-området. Vi tar jobben seriøst, uansett størrelse.',
    offeringsLabel: 'Tjenester',
    offerings: [
      { t: '🚨 Akutt hjelp', d: 'Innen 1 time' },
      { t: '🛁 Rehab bad', d: 'Fastpris' },
      { t: '🏗️ Nyanlegg', d: 'Prosjekttilbud' },
    ],
    gallery: ['🔧', '🚿', '🛠️', '🏠'],
    address: 'Betjener hele Oslo-området',
    hours: 'Ring: 900 00 000',
    bg: 'linear-gradient(150deg,#0b1c2b,#050d16 60%)',
    accent: '#4f8bff',
    accent2: '#22d3ee',
  },
  {
    id: 'bilverksted',
    icon: '🚗',
    label: 'Bilverksted',
    url: 'ekspressverksted.no',
    businessName: 'Ekspress Bilverksted',
    heroTag: 'Bilverksted',
    heroTitle: 'Service. Dekk.\nEU-kontroll.',
    heroSub: 'Rask og pålitelig service for alle bilmerker, samme dag.',
    cta: 'Book verksted',
    badge: 'Ledig verkstedtid i dag',
    aboutTitle: 'Om verkstedet',
    aboutText: 'Ekspress Bilverksted tilbyr rask og pålitelig service for alle bilmerker. Vi setter kundens tid og trygghet først.',
    offeringsLabel: 'Tjenester',
    offerings: [
      { t: '🛠️ Service', d: 'fra 1990 kr' },
      { t: '🛞 Dekkskift', d: 'fra 490 kr' },
      { t: '📋 EU-kontroll', d: '990 kr' },
    ],
    gallery: ['🚗', '🛞', '🔩', '🧰'],
    address: 'Industriveien 8, Bergen',
    hours: 'Åpent 07–17 man–fre',
    bg: 'linear-gradient(150deg,#1b1b1f,#0a0a0c 60%)',
    accent: '#ff4d4d',
    accent2: '#ff9a5a',
  },
  {
    id: 'eiendom',
    icon: '🏠',
    label: 'Eiendom',
    url: 'fjordeiendom.no',
    businessName: 'Fjord Eiendomsmegling',
    heroTag: 'Eiendomsmegling',
    heroTitle: 'Din bolig,\nvårt håndverk.',
    heroSub: 'Vi hjelper deg å finne, eller selge, hjemmet ditt.',
    cta: 'Se boliger',
    badge: '12 boliger til salgs',
    aboutTitle: 'Om oss',
    aboutText: 'Fjord Eiendomsmegling hjelper deg med å kjøpe eller selge bolig med trygghet og lokalkunnskap i ryggen.',
    offeringsLabel: 'Boliger til salgs',
    offerings: [
      { t: '🏡 Enebolig, Nordstrand', d: '8,9 mill' },
      { t: '🏢 Leilighet, Grünerløkka', d: '4,2 mill' },
      { t: '🏘️ Rekkehus, Bekkestua', d: '6,5 mill' },
    ],
    gallery: ['🏡', '🔑', '📐', '🌇'],
    address: 'Karl Johans gate 5, Oslo',
    hours: 'Gratis verdivurdering',
    bg: 'linear-gradient(150deg,#161821,#0a0b10 60%)',
    accent: '#c9a15a',
    accent2: '#4f8bff',
  },
  {
    id: 'fjordbolig',
    icon: '⛵',
    label: 'Fjord Eiendom — premium',
    url: 'fjordbolig.no',
    businessName: 'Fjord Eiendom',
    heroTag: 'Lokalkjent eiendomsmegler',
    heroTitle: 'Hjem ved fjorden.\nSolgt med omtanke.',
    heroSub: 'Vi kombinerer lokalkunnskap, moderne markedsføring og personlig oppfølging — fra første verdivurdering til nøklene er overlevert.',
    cta: 'Bestill verdivurdering',
    badge: 'Nye boliger denne uken',
    aboutTitle: 'Eiendomsmegling med lokal forankring',
    aboutText: 'Fjord Eiendom kjenner nabolagene, menneskene og markedet langs fjorden. Hos oss får du én fast megler, en tydelig salgsplan og tett oppfølging hele veien.',
    offeringsLabel: 'Utvalgte boliger',
    offerings: [
      { t: '🏡 Fjordveien 18, Drøbak', d: 'Prisant. 8 950 000' },
      { t: '🌊 Bryggekanten 4, Son', d: 'Prisant. 6 490 000' },
      { t: '🌲 Utsikten 12, Nesodden', d: 'Prisant. 11 200 000' },
    ],
    gallery: ['🌊', '🏡', '🔑', '⛵'],
    address: 'Havnepromenaden 8, Drøbak',
    hours: 'Gratis og uforpliktende verdivurdering',
    bg: 'linear-gradient(145deg,#102a31,#07171c 58%,#153b42)',
    accent: '#d5b46d',
    accent2: '#69b7b0',
  },
  {
    id: 'konsulent',
    icon: '📊',
    label: 'Konsulent / regnskap',
    url: 'nordregnskap.no',
    businessName: 'Nord Regnskap & Rådgivning',
    heroTag: 'Regnskap & Rådgivning',
    heroTitle: 'Tall du\nkan stole på.',
    heroSub: 'Regnskap, lønn og rådgivning for små og mellomstore bedrifter.',
    cta: 'Book samtale',
    badge: 'Gratis førstegangssamtale',
    aboutTitle: 'Om oss',
    aboutText: 'Nord Regnskap & Rådgivning leverer ryddig regnskap og strategisk rådgivning til små og mellomstore bedrifter.',
    offeringsLabel: 'Tjenester',
    offerings: [
      { t: '📒 Regnskap', d: 'fra 990 kr/mnd' },
      { t: '💡 Rådgivning', d: 'Timepris' },
      { t: '🧾 Skatt & MVA', d: 'Fastpris' },
    ],
    gallery: ['📊', '💼', '🧾', '📈'],
    address: 'Rådhusgata 2, Trondheim',
    hours: 'Svar innen 24 timer',
    bg: 'linear-gradient(150deg,#0c1f1c,#05100d 60%)',
    accent: '#2fd6a7',
    accent2: '#22d3ee',
  },
];

/* Default section order/visibility for a fresh project */
const DEFAULT_SECTIONS = [
  { id: 'hero', name: 'Hero', enabled: true, locked: true },
  { id: 'about', name: 'Om oss', enabled: true, locked: false },
  { id: 'offerings', name: 'Meny / Tjenester', enabled: true, locked: false },
  { id: 'gallery', name: 'Galleri', enabled: true, locked: false },
  { id: 'contact', name: 'Kontakt', enabled: true, locked: false },
];

/* Ekstra seksjonstyper som kan legges til etter behov */
const EXTRA_SECTION_TYPES = [
  { id: 'testimonials', name: 'Kundeanmeldelser', icon: '💬' },
  { id: 'team', name: 'Vårt team', icon: '🧑‍🤝‍🧑' },
  { id: 'faq', name: 'Ofte stilte spørsmål', icon: '❓' },
  { id: 'ctabanner', name: 'Ekstra CTA-banner', icon: '📣' },
];

/* Kjernetyper (alltid tilgjengelig på forsiden) — brukt når nye sider skal
   kunne velge blant ALLE seksjonstyper, ikke bare tilleggstypene over. */
const CORE_SECTION_TYPES = [
  { id: 'hero', name: 'Hero / toppbanner', icon: '🚀' },
  { id: 'about', name: 'Om oss / tekst', icon: 'ℹ️' },
  { id: 'offerings', name: 'Meny / tilbud', icon: '📋' },
  { id: 'gallery', name: 'Galleri', icon: '🖼️' },
  { id: 'contact', name: 'Kontakt', icon: '✉️' },
];

const ALL_SECTION_TYPES = [...CORE_SECTION_TYPES, ...EXTRA_SECTION_TYPES];

/* Generisk standardinnhold for ekstra seksjoner (ikke bransjetilpasset) */
const EXTRA_SECTION_CONTENT = {
  testimonials: {
    items: [
      { quote: 'Fantastisk service og et resultat vi er kjempefornøyde med.', name: 'Kari N.' },
      { quote: 'Rask, ryddig og profesjonelt fra start til slutt.', name: 'Ole M.' },
      { quote: 'Vi anbefaler dem på det varmeste!', name: 'Sara T.' },
    ],
  },
  team: {
    items: [
      { emoji: '🙂', name: 'Anna Berg', role: 'Daglig leder' },
      { emoji: '🙂', name: 'Jonas Lie', role: 'Fagansvarlig' },
      { emoji: '🙂', name: 'Maria Aas', role: 'Kundekontakt' },
    ],
  },
  faq: {
    items: [
      { q: 'Hvor lang leveringstid har dere?', a: 'Vanligvis 1–2 uker, avhengig av omfang.' },
      { q: 'Kan jeg endre innholdet selv senere?', a: 'Ja, du får full tilgang til å redigere når nettsiden er levert.' },
      { q: 'Tilbyr dere support etter lansering?', a: 'Ja, vi er tilgjengelige for spørsmål og justeringer.' },
    ],
  },
  ctabanner: {
    sub: 'Ta kontakt for et uforpliktende tilbud i dag.',
  },
};

function getTemplate(id) {
  return BUILDER_TEMPLATES.find(t => t.id === id) || BUILDER_TEMPLATES[0];
}

function truncate(str, n) {
  if (!str) return '';
  return str.length > n ? str.slice(0, n - 1).trim() + '…' : str;
}

function slugifyPageName(str) {
  return (str || '')
    .toLowerCase()
    .trim()
    .replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/å/g, 'a')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'side';
}

function uniquePageSlug(base, pages, excludeId) {
  const taken = new Set(pages.filter(p => p.id !== excludeId).map(p => p.slug));
  let slug = base;
  let n = 2;
  while (taken.has(slug)) {
    slug = `${base}-${n}`;
    n += 1;
  }
  return slug;
}

function newPageId() {
  return 'page_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/* Sidenes innholdsfelter — hver side har sitt eget sett, uavhengig av andre sider */
const PAGE_CONTENT_KEYS = [
  'heroTag', 'heroTitle', 'heroSub', 'cta', 'badge',
  'aboutTitle', 'aboutText',
  'offeringsLabel', 'offerings', 'gallery',
  'address', 'hours',
  'sections', 'customCode',
];

function homePageFromTemplate(t) {
  return {
    id: 'page_home',
    slug: '',
    name: 'Forside',
    locked: true,
    heroTag: t.heroTag,
    heroTitle: t.heroTitle,
    heroSub: t.heroSub,
    cta: t.cta,
    badge: t.badge,
    aboutTitle: t.aboutTitle,
    aboutText: t.aboutText,
    offeringsLabel: t.offeringsLabel,
    offerings: t.offerings.map(o => ({ ...o })),
    gallery: t.gallery.map(emoji => ({ emoji, img: null })),
    address: t.address,
    hours: t.hours,
    sections: DEFAULT_SECTIONS.map(s => ({ ...s })),
    customCode: null,
  };
}

/* Ny, tom side (f.eks. "Meny", "Produkter") — arver kontaktinfo/CTA fra
   forsiden så innholdet ikke blir tomt hvis man legger til en kontakt-seksjon,
   men starter uten seksjoner slik at brukeren velger dem selv. */
function createBlankPage(name, pages, basePage) {
  const slug = uniquePageSlug(slugifyPageName(name), pages);
  return {
    id: newPageId(),
    slug,
    name: name || 'Ny side',
    locked: false,
    heroTag: basePage.heroTag,
    heroTitle: name || 'Ny side',
    heroSub: '',
    cta: basePage.cta,
    badge: '',
    aboutTitle: name || 'Ny side',
    aboutText: '',
    offeringsLabel: name || 'Ny side',
    offerings: [],
    gallery: [],
    address: basePage.address,
    hours: basePage.hours,
    sections: [],
    customCode: null,
  };
}

function freshStateFromTemplate(templateId) {
  const t = getTemplate(templateId);
  return {
    templateId: t.id,
    businessName: t.businessName,
    accent: t.accent,
    accent2: t.accent2,
    bg: t.bg,

    /* Oppsett / tekniske felter (gjelder hele nettsiden, ikke per side) */
    domain: t.url,
    language: 'no',
    status: 'draft',
    seoTitle: `${t.businessName} | ${t.heroTag}`,
    seoDesc: truncate(t.aboutText, 140),

    pages: [homePageFromTemplate(t)],
    activePageId: 'page_home',
  };
}

/* Migrerer gamle kontoer (lagret før flere-sider-støtte) til pages-formatet.
   Muterer og returnerer samme objekt, trygt å kalle flere ganger. */
function migrateToPages(data) {
  if (!data) return data;
  if (!Array.isArray(data.pages) || !data.pages.length) {
    const page = { id: 'page_home', slug: '', name: 'Forside', locked: true };
    PAGE_CONTENT_KEYS.forEach(k => {
      page[k] = k in data ? data[k] : (k === 'sections' ? DEFAULT_SECTIONS.map(s => ({ ...s })) : (k === 'offerings' || k === 'gallery' ? [] : (k === 'customCode' ? null : '')));
      delete data[k];
    });
    data.pages = [page];
  }
  if (!data.activePageId || !data.pages.some(p => p.id === data.activePageId)) {
    data.activePageId = data.pages[0].id;
  }
  return data;
}
