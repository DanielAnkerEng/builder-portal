const params = new URLSearchParams(location.search);
const accountId = params.get('account');
const pageSlug = params.get('page') || '';
const account = findAccountById(accountId);
const siteData = account ? getAccountState(account.id) : null;
const root = document.getElementById('siteRoot');

function safe(value) {
  const div = document.createElement('div');
  div.textContent = value || '';
  return div.innerHTML;
}

function findPage(data, slug) {
  return data.pages.find(p => p.slug === slug) || data.pages[0];
}

function renderNav(data, activeSlug) {
  return data.pages.map(p => {
    const href = `site.html?account=${accountId}${p.slug ? `&page=${p.slug}` : ''}`;
    return `<a href="${href}"${p.slug === activeSlug ? ' aria-current="page"' : ''}>${safe(p.name)}</a>`;
  }).join('');
}

function renderSection(section, page, data) {
  if (!section.enabled) return '';
  switch (section.id) {
    case 'hero':
      return `<section class="hero" id="top" style="background:${data.bg}">
      <div class="hero-orb one"></div><div class="hero-orb two"></div>
      <div class="hero-content"><span class="eyebrow">${safe(page.heroTag)}</span><h1>${safe(page.heroTitle).replace(/\n/g,'<br>')}</h1><p>${safe(page.heroSub)}</p><div class="hero-actions"><a class="button" href="#kontakt">${safe(page.cta)}</a><span class="badge">${safe(page.badge)}</span></div></div>
      <div class="hero-art"><div class="art-card"><span>${safe(page.gallery[0]?.emoji || '✦')}</span><small>${safe(data.businessName)}</small></div></div>
    </section>`;
    case 'about':
      return `<section class="section intro" id="om"><span class="kicker">Om bedriften</span><h2>${safe(page.aboutTitle)}</h2><p>${safe(page.aboutText)}</p><div class="facts"><div><b>Personlig</b><span>Fast kontakt hele veien</span></div><div><b>Lokalt</b><span>Kunnskap som skaper trygghet</span></div><div><b>Enkelt</b><span>Tydelig prosess og raske svar</span></div></div></section>`;
    case 'offerings':
      return `<section class="section offerings" id="tilbud"><div class="section-head"><div><span class="kicker">Utvalgt for deg</span><h2>${safe(page.offeringsLabel)}</h2></div><p>Se et utvalg av det vi tilbyr akkurat nå.</p></div><div class="cards">${page.offerings.map((o,i)=>`<article><div class="card-visual"><span>${safe(page.gallery[i]?.emoji || '✦')}</span><em>0${i+1}</em></div><div class="card-copy"><h3>${safe(o.t)}</h3><p>${safe(o.d)}</p><a href="#kontakt">Les mer <span>→</span></a></div></article>`).join('')}</div></section>`;
    case 'gallery':
      return `<section class="gallery"><div class="gallery-copy"><span class="kicker">Et lite innblikk</span><h2>Detaljene gjør forskjellen.</h2></div><div class="gallery-grid">${page.gallery.map((g,i)=>`<div class="gallery-tile tile-${i+1}" ${g.img?`style="background-image:url('${g.img}')"`:''}><span>${g.img?'':safe(g.emoji)}</span></div>`).join('')}</div></section>`;
    case 'contact':
      return `<section class="contact" id="kontakt" style="background:${data.bg}"><span class="kicker">La oss snakke sammen</span><h2>Klar for neste steg?</h2><p>${safe(page.hours)}</p><a class="button" href="mailto:${safe(account.email)}">${safe(page.cta)}</a><div class="contact-meta"><span>📍 ${safe(page.address)}</span><span>✉ ${safe(account.email)}</span></div></section>`;
    case 'testimonials': {
      const c = EXTRA_SECTION_CONTENT.testimonials;
      return `<section class="testimonials"><span class="kicker">Hva kundene sier</span><h2>${safe(section.name)}</h2><div class="cards">${c.items.map(it=>`<article><blockquote>"${safe(it.quote)}"</blockquote><cite>${safe(it.name)}</cite></article>`).join('')}</div></section>`;
    }
    case 'team': {
      const c = EXTRA_SECTION_CONTENT.team;
      return `<section class="team"><span class="kicker">Menneskene bak</span><h2>${safe(section.name)}</h2><div class="team-grid">${c.items.map(it=>`<div class="team-member"><span>${it.emoji}</span><strong>${safe(it.name)}</strong><em>${safe(it.role)}</em></div>`).join('')}</div></section>`;
    }
    case 'faq': {
      const c = EXTRA_SECTION_CONTENT.faq;
      return `<section class="faq"><span class="kicker">Lurer du på noe?</span><h2>${safe(section.name)}</h2>${c.items.map(it=>`<details class="faq-item"><summary>${safe(it.q)}</summary><p>${safe(it.a)}</p></details>`).join('')}</section>`;
    }
    case 'ctabanner': {
      const c = EXTRA_SECTION_CONTENT.ctabanner;
      return `<section class="cta-banner"><h2>${safe(section.name)}</h2><p>${safe(c.sub)}</p><a class="button" href="#kontakt">${safe(page.cta)}</a></section>`;
    }
    default:
      return '';
  }
}

if (!account || !siteData) {
  root.innerHTML = '<main class="missing"><h1>Nettsiden finnes ikke</h1><a href="index.html">Tilbake til Studio Nord</a></main>';
} else {
  const page = findPage(siteData, pageSlug);
  if (page.customCode) {
    document.open(); document.write(page.customCode); document.close();
  } else {
    document.title = page.slug ? `${page.name} | ${siteData.businessName}` : (siteData.seoTitle || account.projectName);
    document.documentElement.style.setProperty('--accent', siteData.accent);
    document.documentElement.style.setProperty('--accent2', siteData.accent2);
    const sectionsHTML = page.sections.map(sec => renderSection(sec, page, siteData)).filter(Boolean).join('');
    root.innerHTML = `
    <header class="site-nav">
      <a class="brand" href="site.html?account=${accountId}">${safe(siteData.businessName)}</a>
      <nav>${renderNav(siteData, page.slug)}</nav>
      <a class="nav-cta" href="#kontakt">${safe(page.cta)}</a>
    </header>
    ${sectionsHTML}
    <footer><a class="brand" href="site.html?account=${accountId}">${safe(siteData.businessName)}</a><span>© ${new Date().getFullYear()} ${safe(siteData.businessName)}</span><span>Laget av Studio Nord</span></footer>`;
  }
}
