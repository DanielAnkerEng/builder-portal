const params = new URLSearchParams(location.search);
const accountId = params.get('account');
const account = findAccountById(accountId);
const state = account ? getAccountState(account.id) : null;
const root = document.getElementById('siteRoot');

function safe(value) {
  const div = document.createElement('div');
  div.textContent = value || '';
  return div.innerHTML;
}

if (!account || !state) {
  root.innerHTML = '<main class="missing"><h1>Nettsiden finnes ikke</h1><a href="index.html">Tilbake til Studio Nord</a></main>';
} else if (state.customCode) {
  document.open(); document.write(state.customCode); document.close();
} else {
  document.title = state.seoTitle || account.projectName;
  document.documentElement.style.setProperty('--accent', state.accent);
  document.documentElement.style.setProperty('--accent2', state.accent2);
  const sections = Object.fromEntries(state.sections.map(s => [s.id, s.enabled]));
  root.innerHTML = `
    <header class="site-nav">
      <a class="brand" href="#top">${safe(state.businessName)}</a>
      <nav><a href="#om">Om oss</a><a href="#tilbud">${safe(state.offeringsLabel)}</a><a href="#kontakt">Kontakt</a></nav>
      <a class="nav-cta" href="#kontakt">${safe(state.cta)}</a>
    </header>
    ${sections.hero !== false ? `<section class="hero" id="top" style="background:${state.bg}">
      <div class="hero-orb one"></div><div class="hero-orb two"></div>
      <div class="hero-content"><span class="eyebrow">${safe(state.heroTag)}</span><h1>${safe(state.heroTitle).replace(/\n/g,'<br>')}</h1><p>${safe(state.heroSub)}</p><div class="hero-actions"><a class="button" href="#kontakt">${safe(state.cta)}</a><span class="badge">${safe(state.badge)}</span></div></div>
      <div class="hero-art"><div class="art-card"><span>${safe(state.gallery[0]?.emoji || '✦')}</span><small>${safe(state.businessName)}</small></div></div>
    </section>` : ''}
    ${sections.about !== false ? `<section class="section intro" id="om"><span class="kicker">Om bedriften</span><h2>${safe(state.aboutTitle)}</h2><p>${safe(state.aboutText)}</p><div class="facts"><div><b>Personlig</b><span>Fast kontakt hele veien</span></div><div><b>Lokalt</b><span>Kunnskap som skaper trygghet</span></div><div><b>Enkelt</b><span>Tydelig prosess og raske svar</span></div></div></section>` : ''}
    ${sections.offerings !== false ? `<section class="section offerings" id="tilbud"><div class="section-head"><div><span class="kicker">Utvalgt for deg</span><h2>${safe(state.offeringsLabel)}</h2></div><p>Se et utvalg av det vi tilbyr akkurat nå.</p></div><div class="cards">${state.offerings.map((o,i)=>`<article><div class="card-visual"><span>${safe(state.gallery[i]?.emoji || '✦')}</span><em>0${i+1}</em></div><div class="card-copy"><h3>${safe(o.t)}</h3><p>${safe(o.d)}</p><a href="#kontakt">Les mer <span>→</span></a></div></article>`).join('')}</div></section>` : ''}
    ${sections.gallery !== false ? `<section class="gallery"><div class="gallery-copy"><span class="kicker">Et lite innblikk</span><h2>Detaljene gjør forskjellen.</h2></div><div class="gallery-grid">${state.gallery.map((g,i)=>`<div class="gallery-tile tile-${i+1}" ${g.img?`style="background-image:url('${g.img}')"`:''}><span>${g.img?'':safe(g.emoji)}</span></div>`).join('')}</div></section>` : ''}
    <section class="contact" id="kontakt" style="background:${state.bg}"><span class="kicker">La oss snakke sammen</span><h2>Klar for neste steg?</h2><p>${safe(state.hours)}</p><a class="button" href="mailto:${safe(account.email)}">${safe(state.cta)}</a><div class="contact-meta"><span>📍 ${safe(state.address)}</span><span>✉ ${safe(account.email)}</span></div></section>
    <footer><a class="brand" href="#top">${safe(state.businessName)}</a><span>© 2026 ${safe(state.businessName)}</span><span>Laget av Studio Nord</span></footer>`;
}
