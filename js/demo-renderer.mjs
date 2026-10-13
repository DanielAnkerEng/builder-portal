// Shared, text-only DOM rendering. Demo controls never send requests or collect data.
const ASSETS = 'assets/marketing/';
function el(doc, tag, className, text) {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function link(doc, text, href, className = 'demo-link') {
  const node = el(doc, 'a', className, text);
  node.setAttribute('href', href);
  return node;
}
function picture(doc, name, alt, eager = false, compact = false) {
  const image = el(doc, 'img', 'demo-image');
  image.setAttribute('src', `${ASSETS}${name}-640.webp`);
  image.setAttribute(compact ? 'data-full-srcset' : 'srcset', `${ASSETS}${name}-640.webp 640w, ${ASSETS}${name}-1600.webp 1600w`);
  image.setAttribute('sizes', '(max-width: 680px) 100vw, 65vw');
  image.setAttribute('alt', alt);
  image.setAttribute('width', '1600');
  image.setAttribute('height', '1200');
  image.setAttribute('loading', eager ? 'eager' : 'lazy');
  image.setAttribute('decoding', 'async');
  if (eager) image.setAttribute('fetchpriority', 'high');
  return image;
}
function section(doc, id, eyebrow, title, className = '') {
  const node = el(doc, 'section', `demo-section ${className}`);
  node.id = id;
  const head = el(doc, 'div', 'demo-section-head');
  head.append(el(doc, 'p', 'demo-eyebrow', eyebrow), el(doc, 'h2', '', title));
  node.append(head);
  return node;
}
function accordion(doc, title, body) {
  const details = el(doc, 'details', 'demo-accordion');
  details.append(el(doc, 'summary', '', title), el(doc, 'p', '', body));
  return details;
}
function steps(doc, entries) {
  const list = el(doc, 'ol', 'demo-steps');
  for (const [title, body] of entries) {
    const item = el(doc, 'li');
    item.append(el(doc, 'h3', '', title), el(doc, 'p', '', body));
    list.append(item);
  }
  return list;
}
function demoAction(doc, text, message) {
  const wrap = el(doc, 'div', 'demo-action-wrap');
  const button = el(doc, 'button', 'demo-button', text);
  button.type = 'button';
  const dialog = el(doc, 'dialog', 'demo-dialog');
  const close = el(doc, 'button', 'demo-button', 'Lukk demonstrasjonen');
  close.type = 'button';
  dialog.setAttribute('aria-label', 'Demonstrasjon – ingen bestilling');
  dialog.append(el(doc, 'p', 'demo-eyebrow', 'Fiktiv virksomhet'), el(doc, 'h2', '', 'Dette er et designforslag'), el(doc, 'p', '', message), close);
  button.addEventListener('click', () => dialog.showModal());
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => button.focus());
  wrap.append(button, dialog);
  return wrap;
}
function propertyDetails(doc, home) {
  const wrap = el(doc, 'div', 'demo-action-wrap');
  const trigger = el(doc, 'button', 'demo-button', 'Utforsk boligen ↗');
  trigger.type = 'button';
  const dialog = el(doc, 'dialog', 'demo-dialog property-dialog');
  dialog.setAttribute('aria-label', home.name + ' – fiktiv boligpresentasjon');
  const content = el(doc, 'div', 'property-content');
  content.append(el(doc, 'p', 'demo-eyebrow', home.type + ' / boligkonsept'), el(doc, 'h2', '', home.name), el(doc, 'p', '', home.description));
  const facts = el(doc, 'dl', 'property-facts');
  for (const [label, value] of [['Rom', home.rooms], ['Areal', home.area], ['Boligtype', home.type]]) {
    const pair = el(doc, 'div');
    pair.append(el(doc, 'dt', '', label), el(doc, 'dd', '', value));
    facts.append(pair);
  }
  const rooms = el(doc, 'ul');
  for (const feature of home.features) rooms.append(el(doc, 'li', '', feature));
  content.append(facts, el(doc, 'h3', '', 'Slik henger rommene sammen'), rooms, el(doc, 'h3', '', 'Materialer & uttrykk'), el(doc, 'p', '', home.materials), el(doc, 'h3', '', 'Omgivelsene'), el(doc, 'p', '', home.surroundings), el(doc, 'p', 'demo-note', 'Fiktiv bolig og eksempelopplysninger, ikke en salgsannonse. Bildet er en illustrasjon. Ingen visning eller kjøp kan bestilles her.'));
  const close = el(doc, 'button', 'demo-button', 'Tilbake til boligene');
  close.type = 'button';
  content.append(close);
  dialog.append(picture(doc, home.image, 'Illustrasjonsfoto: ' + home.name), content);
  trigger.addEventListener('click', () => dialog.showModal());
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => trigger.focus());
  wrap.append(trigger, dialog);
  return wrap;
}
function choices(doc, labels, onSelect, ariaLabel) {
  const group = el(doc, 'div', 'demo-choices');
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', ariaLabel);
  const buttons = labels.map((label, index) => {
    const button = el(doc, 'button', '', label);
    button.type = 'button';
    button.setAttribute('aria-pressed', String(index === 0));
    button.addEventListener('click', () => {
      buttons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      onSelect(label, index);
    });
    group.append(button);
    return button;
  });
  return group;
}
function restaurant(doc, site, data) {
  const menu = section(doc, 'meny', '01 / Fra kjøkkenet', 'Litt av sesongen.');
  const list = el(doc, 'div', 'demo-menu');
  list.setAttribute('aria-live', 'polite');
  const update = key => {
    list.replaceChildren();
    for (const [name, ingredients] of data.menu[key]) {
      const row = el(doc, 'div', 'demo-menu-row');
      row.append(el(doc, 'h3', '', name), el(doc, 'p', '', ingredients));
      list.append(row);
    }
  };
  menu.append(choices(doc, Object.keys(data.menu), update, 'Velg del av eksempelmenyen'), list,
    el(doc, 'p', 'demo-note', 'Et sesonginspirert menyeksempel. Spør alltid restauranten om allergener.'));
  update('Middag');
  const story = section(doc, 'stedet', '02 / Rundt bordet', 'God mat trenger ikke store ord.', 'demo-story');
  story.append(picture(doc, data.side, data.sideAlt), el(doc, 'p', 'demo-story-copy', 'Et sted å senke skuldrene. Noe varmt på tallerkenen, et glass i hånden og god tid til menneskene rundt deg. Det er ideen bak Bord & Jord.'));
  const visit = section(doc, 'besok', '03 / Bli litt til', 'Vi har spart en plass.', 'demo-ending');
  visit.append(el(doc, 'p', '', 'Slik kan en tydelig bordbestilling se ut på en restaurantside.'), demoAction(doc, 'Se bordbestilling ↗', 'Bord & Jord finnes bare i denne demoen. Ingen bord reserveres, og ingen personopplysninger samles inn.'));
  site.append(menu, story, visit);
}
function salon(doc, site, data) {
  const treatments = section(doc, 'behandlinger', '01 / På dine premisser', 'Finn formen din.', 'demo-treatments');
  const items = el(doc, 'div');
  for (const service of data.services) items.append(accordion(doc, ...service));
  treatments.append(items);
  const gallery = section(doc, 'galleri', '02 / Et lite moodboard', 'Rom for forandring.');
  const grid = el(doc, 'div', 'demo-salon-gallery');
  for (const [name, alt] of [[data.side, data.sideAlt], [data.hero, data.heroAlt]]) grid.append(picture(doc, name, alt));
  gallery.append(grid, el(doc, 'p', 'demo-note', 'Illustrasjonsbilder. Ikke dokumentasjon på utførte behandlinger eller kunder.'));
  const studio = section(doc, 'studio', '03 / En pause i dagen', 'God tid til deg.', 'demo-ending');
  studio.append(el(doc, 'p', '', 'En samtale først, en plan sammen. Dette fiktive studioet viser hvordan behandlinger og atmosfære kan få en tydelig plass på nett.'), demoAction(doc, 'Utforsk timebestilling ↗', 'Dette er en illustrasjon av en frisørside. Ingen timebestilling er koblet til, og ingen henvendelse sendes.'));
  site.append(treatments, gallery, studio);
}
function trade(doc, site, data) {
  const services = section(doc, 'tjenester', '01 / Det vi gjør', 'Fra rom til helhet.');
  services.append(steps(doc, data.services));
  const projects = section(doc, 'prosjekter', '02 / Materialer & muligheter', 'Se rommene for deg.');
  const grid = el(doc, 'div', 'demo-project-grid');
  for (const [image, title, description] of [[data.hero, 'Et lysere baderom', 'Store flater, dempede toner og plass til hverdagen.'], [data.side, 'Detaljer som samler rommet', 'Tre, stein og løsninger som spiller sammen.']]) {
    const card = el(doc, 'article', 'demo-project');
    card.append(picture(doc, image, 'Fiktiv prosjektpresentasjon: ' + title), el(doc, 'p', 'demo-eyebrow', 'Illustrasjonsprosjekt'), el(doc, 'h3', '', title), el(doc, 'p', '', description), accordion(doc, 'Materialer & planlegging', 'Start med bruken av rommet: bevegelsesplass, oppbevaring og lys. Velg deretter overflater som tåler belastningen, og avklar tekniske løsninger med kvalifiserte fagpersoner. Dette er en prosjektidé, ikke et dokumentert levert arbeid.'));
    grid.append(card);
  }
  projects.append(grid);
  const process = section(doc, 'prosess', '03 / Ingen løse tråder', 'En ryddig vei til ferdig rom.', 'demo-ending');
  process.append(steps(doc, [['Vi lytter', 'Behov, rammer og ønsker på bordet.'], ['Vi planlegger', 'Omfang og fremdrift gjøres forståelig.'], ['Vi følger opp', 'Detaljene gjennomgås sammen til slutt.']]));
  site.append(services, projects, process);
}
function auto(doc, site, data) {
  const service = section(doc, 'service', '01 / Finn riktig startpunkt', 'Hva trenger bilen?');
  const panel = el(doc, 'div', 'demo-service-panel');
  panel.setAttribute('aria-live', 'polite');
  const update = (_, index) => {
    panel.replaceChildren(el(doc, 'span', 'demo-service-number', `0${index + 1}`), el(doc, 'h3', '', data.services[index][0]), el(doc, 'p', '', data.services[index][1]), demoAction(doc, 'Se eksempel på forespørsel ↗', 'Ingen verkstedtime opprettes. En ekte løsning for timebestilling eller forespørsel må avtales separat.'));
  };
  service.append(choices(doc, data.services.map(item => item[0]), update, 'Velg verkstedtjeneste'), panel);
  update(null, 0);
  const process = section(doc, 'prosess', '02 / Under panseret', 'Du skal vite hva som skjer.', 'demo-auto-process');
  process.append(picture(doc, data.side, data.sideAlt), steps(doc, [['Fortell om bilen', 'Hva merker du, og når skjer det?'], ['Avklar arbeidet', 'Omfanget blir tydelig før noe settes i gang.'], ['Få en gjennomgang', 'En forståelig forklaring av arbeidet som er gjort.']]));
  const questions = section(doc, 'sporsmal', '03 / Greit å vite', 'Før du leverer bilen.');
  questions.append(accordion(doc, 'Kan jeg bestille en time her?', 'Nei. Dette er en fiktiv verkstedside uten kobling til et bookingsystem.'), accordion(doc, 'Hvor finner jeg prisene?', 'Priser er ikke satt i denne demoen. På en virkelig verkstedside må arbeid, biltype og omfang avklares.'));
  site.append(service, process, questions);
}
function estate(doc, site, data) {
  const homes = section(doc, 'boliger', '01 / To steder, to historier', 'Finn følelsen av hjemme.');
  const grid = el(doc, 'div', 'demo-property-grid');
  grid.setAttribute('aria-live', 'polite');
  const update = type => {
    grid.replaceChildren();
    for (const home of data.properties.filter(item => type === 'Alle' || item.type === type)) {
      const card = el(doc, 'article', 'demo-property');
      card.append(picture(doc, home.image, 'Illustrasjonsfoto: ' + home.name + ', ikke til salgs'), el(doc, 'p', 'demo-eyebrow', home.type + ' / boligkonsept'), el(doc, 'h3', '', home.name), el(doc, 'p', '', home.facts), propertyDetails(doc, home));
      grid.append(card);
    }
  };
  homes.append(choices(doc, ['Alle', 'Enebolig', 'Hytte'], update, 'Filtrer fiktive boliger'), grid);
  update('Alle');
  const selling = section(doc, 'selge', '02 / Når du skal videre', 'Hver bolig fortjener sin egen historie.', 'demo-ending');
  selling.append(steps(doc, data.services));
  const approach = section(doc, 'tilnaerming', '03 / Detaljene betyr noe', 'Mer enn kvadratmeter.', 'demo-story');
  approach.append(picture(doc, data.side, data.sideAlt), el(doc, 'p', 'demo-story-copy', 'Lys, materialer og hvordan rommene henger sammen. Denne demoen viser en boligpresentasjon som gir plass til både de praktiske detaljene og følelsen av et hjem.'));
  site.append(homes, selling, approach);
}
function consulting(doc, site, data) {
  const services = section(doc, 'tjenester', '01 / En enklere oversikt', 'Tallene er starten. Ikke hele svaret.', 'demo-consulting-services');
  for (const service of data.services) services.append(accordion(doc, ...service));
  const together = section(doc, 'samarbeid', '02 / Slik begynner vi', 'Først forstår vi. Så finner vi retningen.', 'demo-ending');
  together.append(steps(doc, [['Situasjonen din', 'Vi starter med det som fungerer og det som er vanskelig.'], ['En tydelig avtale', 'Omfang, ansvar og forventninger får en felles retning.'], ['Oversikt underveis', 'Avtalte oppfølgingspunkter gjør samarbeidet forståelig.']]));
  const questions = section(doc, 'sporsmal', '03 / Før vi møtes', 'La oss gjøre det enkelt.');
  questions.append(accordion(doc, 'Hva er nyttig å avklare før et første møte?', 'Tenk gjennom hvilke oppgaver du vil få hjelp med, hvilke beslutninger som nærmer seg og hvordan du følger opp økonomien i dag. Du trenger ikke dele dokumenter eller innloggingsopplysninger på denne siden.'), accordion(doc, 'Hva er forskjellen på resultat og likviditet?', 'Resultatet beskriver inntekter og kostnader i en periode. Likviditet handler om pengene du har tilgjengelig til å betale regninger. God planlegging ser på begge deler; dette er generell informasjon, ikke individuell rådgivning.'), accordion(doc, 'Er siden koblet til økonomisystemer?', 'Nei. Dette er en fiktiv virksomhet uten bank-, regnskaps- eller analyseintegrasjoner. Ingen opplysninger kan sendes eller lastes opp her.'));
  site.append(services, together, questions);
}
const bodies = { restaurant, salon, trade, auto, estate, consulting };

export function renderDemo(root, data, { preview = false, imageMode = 'responsive', previewContent = false } = {}) {
  const doc = root.ownerDocument;
  root.replaceChildren();
  const site = el(doc, 'div', `demo-site demo-${data.theme}`);
  if (preview) { site.setAttribute('inert', ''); site.setAttribute('aria-hidden', 'true'); }
  const nav = el(doc, 'header', 'demo-nav');
  nav.append(el(doc, 'span', 'demo-wordmark', data.name));
  const navLinks = el(doc, 'nav', 'demo-nav-links');
  navLinks.setAttribute('aria-label', 'Demonstrasjonens innhold');
  for (const [label, target] of data.nav) navLinks.append(preview ? el(doc, 'span', '', label) : link(doc, label, '#' + target));
  nav.append(navLinks);
  const hero = el(doc, 'section', 'demo-hero');
  const copy = el(doc, 'div', 'demo-hero-copy');
  copy.append(el(doc, 'p', 'demo-eyebrow', data.kicker), el(doc, preview ? 'h3' : 'h1', 'demo-title', data.title), el(doc, 'p', 'demo-intro', data.intro), preview ? el(doc, 'span', 'demo-button', data.cta + ' ↗') : link(doc, data.cta + ' ↗', '#' + data.target, 'demo-button'));
  const media = el(doc, 'div', 'demo-hero-media');
  if (data.hero) {
    media.append(picture(doc, data.hero, data.heroAlt, !preview, imageMode === 'compact'));
  } else {
    const compass = el(doc, 'div', 'demo-direction');
    compass.append(el(doc, 'span', 'direction-label', 'Et tydeligere beslutningsgrunnlag'), el(doc, 'span', 'direction-arrow', '↗'), el(doc, 'span', 'direction-bottom', 'Oversikt → Innsikt → Neste steg'));
    compass.setAttribute('aria-label', 'Fra oversikt til innsikt og neste steg');
    media.append(compass);
  }
  hero.append(copy, media);
  site.append(nav, hero);
  if (!preview || previewContent) bodies[data.theme](doc, site, data);
  if (!preview) {
    const footer = el(doc, 'footer', 'demo-footer');
    footer.append(el(doc, 'span', 'demo-wordmark', data.name), el(doc, 'p', '', 'En fiktiv virksomhet. Alle prosjekter og tilbud på denne siden er eksempler. Illustrasjonsfoto fra Unsplash.'), link(doc, 'Et designforslag fra Wreach ↗', 'index.html#nettsider'), link(doc, 'Bilder og bruksrett', 'assets/marketing/credits.json'));
    site.append(footer);
  }
  root.append(site);
  return site;
}
