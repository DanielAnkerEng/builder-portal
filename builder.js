/* ===================== AUTH GUARD + KONTO-OPPSLAG ===================== */
const session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
let bail = false;
let targetAccountId = null;
let targetAccount = null;

if (!session) {
  window.location.href = 'login.html';
  bail = true;
} else {
  const urlParams = new URLSearchParams(window.location.search);
  const requestedAccountId = urlParams.get('account');

  if (session.role === 'admin') {
    targetAccountId = requestedAccountId;
    if (!targetAccountId) {
      window.location.href = 'admin.html';
      bail = true;
    }
  } else {
    targetAccountId = session.accountId;
    if (requestedAccountId && requestedAccountId !== session.accountId) {
      window.location.href = 'builder.html';
      bail = true;
    }
  }

  if (!bail) {
    targetAccount = findAccountById(targetAccountId);
    if (!targetAccount) {
      window.location.href = session.role === 'admin' ? 'admin.html' : 'login.html';
      bail = true;
    }
  }
}

if (!bail) {

const isAdmin = session.role === 'admin';
document.getElementById('viewSiteBtn').href = `site.html?account=${targetAccountId}`;
if (!isAdmin) document.getElementById('customerSaveBar').style.display = 'block';

/* ===================== STATE ===================== */
let state = JSON.parse(localStorage.getItem(stateKeyFor(targetAccountId)) || 'null') || freshStateFromTemplate(targetAccount.templateId || 'restaurant');
let draggedId = null;
let saveTimer = null;

function slugify(str) {
  return (str || '')
    .toLowerCase()
    .replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/å/g, 'a')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 30) || 'minbedrift';
}

function persistState(showStatus) {
  clearTimeout(saveTimer);
  localStorage.setItem(stateKeyFor(targetAccountId), JSON.stringify(state));
  const info = document.getElementById('lastSavedInfo');
  if (info) info.textContent = 'Nå nettopp';
  const hint = document.getElementById('customerSaveHint');
  if (hint) hint.textContent = 'Lagret nå ✓';
  if (showStatus) {
    const el = document.getElementById('saveStatus');
    el.textContent = 'Lagret ✓';
    setTimeout(() => { el.textContent = 'Alt lagret'; }, 1800);
  }
}

function scheduleAutosave() {
  const el = document.getElementById('saveStatus');
  el.textContent = 'Lagrer ...';
  const hint = document.getElementById('customerSaveHint');
  if (hint) hint.textContent = 'Du har endringer som ikke er lagret';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => persistState(false), 500);
  clearTimeout(window._statusTimer);
  window._statusTimer = setTimeout(() => { el.textContent = 'Alt lagret'; }, 900);
}

/* ===================== USER MENU / ADMIN-BADGE ===================== */
document.getElementById('userEmail').textContent = `${session.username} (${isAdmin ? 'admin' : 'kunde'})`;
document.getElementById('userAvatarBtn').textContent = session.username.slice(0, 2).toUpperCase();
if (isAdmin) document.getElementById('userAvatarBtn').classList.add('admin-avatar');

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

/* ===================== ADMIN-VISNING (fremmed prosjekt) ===================== */
if (isAdmin) {
  document.getElementById('backToAdmin').style.display = 'inline-flex';
  const ownerTag = document.getElementById('ownerTag');
  ownerTag.style.display = 'inline-block';
  ownerTag.textContent = `redigerer for @${targetAccount.username}`;
  document.getElementById('codeModeToggle').style.display = 'inline-flex';
}

/* ===================== PROSJEKTNAVN ===================== */
const projectNameInput = document.getElementById('projectName');
projectNameInput.value = targetAccount.projectName || 'Mitt nettsideprosjekt';
projectNameInput.addEventListener('input', () => {
  targetAccount = updateAccount(targetAccountId, { projectName: projectNameInput.value });
});

/* ===================== SIDEBAR TABS ===================== */
document.querySelectorAll('.sidebar-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.sidebar-tab').forEach(t => t.classList.toggle('active', t === tab));
    document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === `panel-${tab.dataset.tab}`));
  });
});

/* ===================== VIEW TOGGLE ===================== */
document.querySelectorAll('.topbar .view-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.topbar .view-btn').forEach(b => b.classList.toggle('active', b === btn));
    document.getElementById('mockupStage').classList.toggle('show-mobile', btn.dataset.view === 'mobile');
  });
});

/* ===================== BRANSJE-DROPDOWN (Oppsett) ===================== */
const templateSelect = document.getElementById('f-template');
BUILDER_TEMPLATES.forEach(t => {
  const opt = document.createElement('option');
  opt.value = t.id;
  opt.textContent = `${t.icon} ${t.label}`;
  templateSelect.appendChild(opt);
});
templateSelect.addEventListener('change', () => {
  const id = templateSelect.value;
  if (id === state.templateId) return;
  state = freshStateFromTemplate(id);
  targetAccount = updateAccount(targetAccountId, { templateId: id });
  renderAll();
  scheduleAutosave();
});

/* ===================== OPPSETT-FELTER ===================== */
document.getElementById('f-domain').addEventListener('input', (e) => {
  state.domain = e.target.value;
  updatePreview();
  scheduleAutosave();
});
document.getElementById('f-language').addEventListener('change', (e) => {
  state.language = e.target.value;
  scheduleAutosave();
});
document.getElementById('f-status').addEventListener('change', (e) => {
  state.status = e.target.value;
  scheduleAutosave();
});
document.getElementById('f-seoTitle').addEventListener('input', (e) => {
  state.seoTitle = e.target.value;
  scheduleAutosave();
});
document.getElementById('f-seoDesc').addEventListener('input', (e) => {
  state.seoDesc = e.target.value;
  scheduleAutosave();
});

function fillOppsettFields() {
  templateSelect.value = state.templateId;
  document.getElementById('f-domain').value = state.domain;
  document.getElementById('f-language').value = state.language;
  document.getElementById('f-status').value = state.status;
  document.getElementById('f-seoTitle').value = state.seoTitle;
  document.getElementById('f-seoDesc').value = state.seoDesc;
}

/* ===================== CONTENT FIELDS ===================== */
const fieldMap = {
  'f-businessName': 'businessName',
  'f-heroTag': 'heroTag',
  'f-heroTitle': 'heroTitle',
  'f-heroSub': 'heroSub',
  'f-cta': 'cta',
  'f-badge': 'badge',
  'f-aboutTitle': 'aboutTitle',
  'f-aboutText': 'aboutText',
  'f-offeringsLabel': 'offeringsLabel',
  'f-address': 'address',
  'f-hours': 'hours',
};

function bindFields() {
  Object.entries(fieldMap).forEach(([elId, key]) => {
    const el = document.getElementById(elId);
    el.addEventListener('input', () => {
      state[key] = el.value;
      updatePreview();
      scheduleAutosave();
    });
  });

  document.getElementById('f-accent').addEventListener('input', (e) => {
    state.accent = e.target.value;
    updatePreview();
    scheduleAutosave();
  });
  document.getElementById('f-accent2').addEventListener('input', (e) => {
    state.accent2 = e.target.value;
    updatePreview();
    scheduleAutosave();
  });
}

function fillFields() {
  Object.entries(fieldMap).forEach(([elId, key]) => {
    document.getElementById(elId).value = state[key] || '';
  });
  document.getElementById('f-accent').value = state.accent;
  document.getElementById('f-accent2').value = state.accent2;
  renderOfferingsEditor();
  renderGalleryEditor();
}

/* ===================== OFFERINGS EDITOR ===================== */
const offeringsEditor = document.getElementById('offeringsEditor');
function renderOfferingsEditor() {
  offeringsEditor.innerHTML = '';
  state.offerings.forEach((o, i) => {
    const row = document.createElement('div');
    row.className = 'offering-row';
    row.innerHTML = `
      <input type="text" class="off-name" value="${o.t.replace(/"/g, '&quot;')}" placeholder="Navn">
      <input type="text" class="off-price" value="${o.d.replace(/"/g, '&quot;')}" placeholder="Pris">
    `;
    row.querySelector('.off-name').addEventListener('input', (e) => {
      state.offerings[i].t = e.target.value;
      updatePreview();
      scheduleAutosave();
    });
    row.querySelector('.off-price').addEventListener('input', (e) => {
      state.offerings[i].d = e.target.value;
      updatePreview();
      scheduleAutosave();
    });
    offeringsEditor.appendChild(row);
  });
}

/* ===================== GALLERY EDITOR (bilder) ===================== */
function resizeImageToDataURL(file, maxDim, quality) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) { reject(new Error('Ikke en bildefil')); return; }
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Kunne ikke lese bildet'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

const galleryEditor = document.getElementById('galleryEditor');
function renderGalleryEditor() {
  galleryEditor.innerHTML = '';
  state.gallery.forEach((item, i) => {
    const row = document.createElement('div');
    row.className = 'gallery-editor-item';
    row.innerHTML = `
      <div class="gallery-thumb" ${item.img ? `style="background-image:url('${item.img}')"` : ''}>${item.img ? '' : item.emoji}</div>
      <div class="gallery-item-actions">
        <button type="button" class="btn btn-outline btn-small upload-btn">Last opp bilde</button>
        ${item.img ? '<button type="button" class="text-link-btn remove-img-btn">Fjern bilde</button>' : ''}
      </div>
      <input type="file" accept="image/*" class="gallery-file-input" style="display:none;">
      <button type="button" class="gallery-remove-btn" title="Fjern element" aria-label="Fjern element">✕</button>
    `;
    const fileInput = row.querySelector('.gallery-file-input');
    row.querySelector('.upload-btn').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      resizeImageToDataURL(file, 640, 0.8).then(dataUrl => {
        state.gallery[i].img = dataUrl;
        renderGalleryEditor();
        updatePreview();
        scheduleAutosave();
      }).catch(() => alert('Kunne ikke laste opp bildet. Prøv et annet.'));
    });
    const removeImgBtn = row.querySelector('.remove-img-btn');
    if (removeImgBtn) {
      removeImgBtn.addEventListener('click', () => {
        state.gallery[i].img = null;
        renderGalleryEditor();
        updatePreview();
        scheduleAutosave();
      });
    }
    row.querySelector('.gallery-remove-btn').addEventListener('click', () => {
      state.gallery.splice(i, 1);
      renderGalleryEditor();
      updatePreview();
      scheduleAutosave();
    });
    galleryEditor.appendChild(row);
  });
}
document.getElementById('addGalleryItemBtn').addEventListener('click', () => {
  state.gallery.push({ emoji: '🖼️', img: null });
  renderGalleryEditor();
  updatePreview();
  scheduleAutosave();
});

/* ===================== SECTION LIST (drag / toggle / fjern) ===================== */
const sectionList = document.getElementById('sectionList');
function renderSectionList() {
  sectionList.innerHTML = '';
  state.sections.forEach(section => {
    const row = document.createElement('div');
    row.className = 'section-row' + (section.locked ? ' locked' : '');
    row.draggable = !section.locked;
    row.dataset.id = section.id;
    row.innerHTML = `
      <span class="drag-handle">&#9776;</span>
      <span class="section-name">${section.name}</span>
      ${section.locked ? '<span class="section-lock-tag">Alltid på</span>' : ''}
      <label class="switch">
        <input type="checkbox" ${section.enabled ? 'checked' : ''} ${section.locked ? 'disabled' : ''}>
        <span class="switch-track"></span>
      </label>
      ${section.removable ? '<button type="button" class="section-delete-btn" title="Fjern seksjon" aria-label="Fjern seksjon">✕</button>' : ''}
    `;
    row.querySelector('input[type="checkbox"]').addEventListener('change', (e) => {
      section.enabled = e.target.checked;
      updatePreview();
      scheduleAutosave();
    });

    if (section.removable) {
      row.querySelector('.section-delete-btn').addEventListener('click', () => {
        state.sections = state.sections.filter(s => s.id !== section.id);
        renderSectionList();
        renderAddSectionMenu();
        updatePreview();
        scheduleAutosave();
      });
    }

    row.addEventListener('dragstart', () => {
      if (section.locked) return;
      draggedId = section.id;
      row.classList.add('dragging');
    });
    row.addEventListener('dragend', () => {
      row.classList.remove('dragging');
      draggedId = null;
    });
    row.addEventListener('dragover', (e) => {
      e.preventDefault();
    });
    row.addEventListener('drop', (e) => {
      e.preventDefault();
      if (!draggedId || draggedId === section.id || section.locked) return;
      const fromIdx = state.sections.findIndex(s => s.id === draggedId);
      const toIdx = state.sections.findIndex(s => s.id === section.id);
      if (fromIdx === -1 || toIdx === -1) return;
      const [moved] = state.sections.splice(fromIdx, 1);
      state.sections.splice(toIdx, 0, moved);
      renderSectionList();
      updatePreview();
      scheduleAutosave();
    });

    sectionList.appendChild(row);
  });
}

/* ===================== LEGG TIL SEKSJON ===================== */
const addSectionBtn = document.getElementById('addSectionBtn');
const addSectionMenu = document.getElementById('addSectionMenu');
addSectionBtn.addEventListener('click', () => {
  addSectionMenu.classList.toggle('open');
});
document.addEventListener('click', (e) => {
  if (!document.querySelector('.add-section-wrap').contains(e.target)) {
    addSectionMenu.classList.remove('open');
  }
});
function renderAddSectionMenu() {
  const existingIds = state.sections.map(s => s.id);
  const available = EXTRA_SECTION_TYPES.filter(t => !existingIds.includes(t.id));
  addSectionMenu.innerHTML = '';
  if (available.length === 0) {
    addSectionMenu.innerHTML = '<div class="add-section-empty">Alle tilgjengelige seksjoner er lagt til.</div>';
    addSectionBtn.disabled = true;
    return;
  }
  addSectionBtn.disabled = false;
  available.forEach(t => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'add-section-option';
    item.innerHTML = `<span>${t.icon}</span> ${t.name}`;
    item.addEventListener('click', () => {
      state.sections.push({ id: t.id, name: t.name, enabled: true, locked: false, removable: true });
      renderSectionList();
      renderAddSectionMenu();
      addSectionMenu.classList.remove('open');
      updatePreview();
      scheduleAutosave();
    });
    addSectionMenu.appendChild(item);
  });
}

/* ===================== PREVIEW RENDERING ===================== */
function renderHeroBlock(s) {
  return `
    <span class="sp-badge" style="background:${s.accent};color:#0a0a0a;">${s.badge}</span>
    <div class="sp-hero-tag" style="color:${s.accent2};">${s.heroTag}</div>
    <h4>${(s.heroTitle || '').replace(/\n/g, '<br>')}</h4>
    <p>${s.heroSub}</p>
    <span class="sp-btn" style="background:${s.accent};color:#0a0a0a;">${s.cta}</span>
  `;
}

function renderSectionBlock(section, s) {
  if (!section.enabled) return '';
  switch (section.id) {
    case 'hero':
      return `<div class="sp-hero">${renderHeroBlock(s)}</div>`;
    case 'about':
      return `
        <div class="sp-section">
          <div class="sp-section-title">${s.aboutTitle}</div>
          <div class="sp-section-sub">${s.aboutText}</div>
        </div>`;
    case 'offerings':
      return `
        <div class="sp-section">
          <div class="sp-section-title">${s.offeringsLabel}</div>
          <div class="sp-row">
            ${s.offerings.map(o => `
              <div class="sp-card" style="background:rgba(255,255,255,0.06);">
                <div class="t">${o.t}</div>
                <div style="opacity:.75">${o.d}</div>
              </div>
            `).join('')}
          </div>
        </div>`;
    case 'gallery':
      return `
        <div class="sp-section">
          <div class="sp-section-title">Galleri</div>
          <div class="sp-gallery">
            ${s.gallery.map(g => g.img
              ? `<div class="sp-gallery-item" style="background-image:url('${g.img}');background-size:cover;background-position:center;"></div>`
              : `<div class="sp-gallery-item" style="background:${s.accent}22;">${g.emoji}</div>`
            ).join('')}
          </div>
        </div>`;
    case 'contact':
      return `
        <div class="sp-section sp-contact">
          <div class="sp-section-title">Kontakt oss</div>
          <div class="sp-contact-row">
            <div class="sp-contact-info">📍 ${s.address}<br>${s.hours}</div>
            <span class="sp-btn" style="background:${s.accent};color:#0a0a0a;">${s.cta}</span>
          </div>
        </div>`;
    case 'testimonials': {
      const c = EXTRA_SECTION_CONTENT.testimonials;
      return `
        <div class="sp-section">
          <div class="sp-section-title">${section.name}</div>
          <div class="sp-row">
            ${c.items.map(it => `
              <div class="sp-card" style="background:rgba(255,255,255,0.06);">
                <div style="opacity:.85;font-style:italic;">"${it.quote}"</div>
                <div class="t" style="margin-top:8px;">${it.name}</div>
              </div>
            `).join('')}
          </div>
        </div>`;
    }
    case 'team': {
      const c = EXTRA_SECTION_CONTENT.team;
      return `
        <div class="sp-section">
          <div class="sp-section-title">${section.name}</div>
          <div class="sp-row">
            ${c.items.map(it => `
              <div class="sp-card" style="background:rgba(255,255,255,0.06);text-align:center;">
                <div style="font-size:22px;">${it.emoji}</div>
                <div class="t" style="margin-top:6px;">${it.name}</div>
                <div style="opacity:.7;">${it.role}</div>
              </div>
            `).join('')}
          </div>
        </div>`;
    }
    case 'faq': {
      const c = EXTRA_SECTION_CONTENT.faq;
      return `
        <div class="sp-section">
          <div class="sp-section-title">${section.name}</div>
          <div class="sp-faq">
            ${c.items.map(it => `
              <div class="sp-faq-item">
                <div class="sp-faq-q">${it.q}</div>
                <div class="sp-faq-a">${it.a}</div>
              </div>
            `).join('')}
          </div>
        </div>`;
    }
    case 'ctabanner': {
      const c = EXTRA_SECTION_CONTENT.ctabanner;
      return `
        <div class="sp-section sp-contact">
          <div class="sp-section-title">${section.name}</div>
          <div class="sp-contact-row">
            <div class="sp-contact-info">${c.sub}</div>
            <span class="sp-btn" style="background:${s.accent};color:#0a0a0a;">${s.cta}</span>
          </div>
        </div>`;
    }
    default:
      return '';
  }
}

function buildPreviewHTML(s) {
  const blocks = s.sections.map(sec => renderSectionBlock(sec, s)).join('');
  return `
    <div class="sp" style="background:${s.bg};color:#fff;">
      <div class="sp-nav">
        <span>${s.businessName}</span>
        <span class="sp-nav-links"><span>Om oss</span><span>${s.offeringsLabel}</span><span>Kontakt</span></span>
      </div>
      ${blocks}
    </div>
  `;
}

function renderCustomCodeIframe(container) {
  container.innerHTML = '';
  // height:100% needs a resolvable ancestor height, but .site-preview only
  // sets min-height (auto height otherwise) — so pin an explicit pixel
  // height here, or the iframe collapses to the browser's ~150px default.
  const fixedHeight = container.classList.contains('site-preview-mobile') ? 560 : 640;
  container.style.height = `${fixedHeight}px`;
  const iframe = document.createElement('iframe');
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.style.border = '0';
  iframe.style.background = '#0b0c10';
  iframe.srcdoc = state.customCode;
  container.appendChild(iframe);
}

function resetPreviewContainerHeight(container) {
  container.style.height = '';
}

function updatePreview() {
  const previewDesktop = document.getElementById('previewDesktop');
  const previewMobile = document.getElementById('previewMobile');
  if (state.customCode) {
    renderCustomCodeIframe(previewDesktop);
    renderCustomCodeIframe(previewMobile);
  } else {
    resetPreviewContainerHeight(previewDesktop);
    resetPreviewContainerHeight(previewMobile);
    const html = buildPreviewHTML(state);
    previewDesktop.innerHTML = html;
    previewMobile.innerHTML = html;
  }
  document.getElementById('browserUrl').textContent = state.domain || (slugify(state.businessName) + '.no');
}

/* ===================== PUBLISH MODAL ===================== */
document.getElementById('publishBtn').addEventListener('click', () => {
  persistState(true);
  document.getElementById('modalUrl').textContent = `https://${state.domain || slugify(state.businessName) + '.no'}`;
  document.getElementById('publishModal').classList.add('open');
});
document.getElementById('closeModal').addEventListener('click', () => {
  document.getElementById('publishModal').classList.remove('open');
});
document.getElementById('publishModal').addEventListener('click', (e) => {
  if (e.target.id === 'publishModal') e.currentTarget.classList.remove('open');
});

/* ===================== SAVE BUTTON ===================== */
document.getElementById('saveBtn').addEventListener('click', () => persistState(true));
document.getElementById('customerSaveBtn').addEventListener('click', () => {
  persistState(true);
  const btn = document.getElementById('customerSaveBtn');
  btn.textContent = 'Lagret ✓';
  btn.classList.add('saved');
  setTimeout(() => { btn.textContent = 'Lagre endringer'; btn.classList.remove('saved'); }, 1800);
});

/* ===================== KODE-VISNING / -REDIGERING ===================== */
function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function codeSectionMarkup(section, s, indent) {
  if (!section.enabled) return '';
  const pad = '  '.repeat(indent);
  switch (section.id) {
    case 'hero':
      return `${pad}<section class="hero">\n${pad}  <span class="badge">${esc(s.badge)}</span>\n${pad}  <p class="tag">${esc(s.heroTag)}</p>\n${pad}  <h1>${esc(s.heroTitle).replace(/\n/g, '<br>')}</h1>\n${pad}  <p>${esc(s.heroSub)}</p>\n${pad}  <a class="btn" href="#kontakt">${esc(s.cta)}</a>\n${pad}</section>`;
    case 'about':
      return `${pad}<section class="about">\n${pad}  <h2>${esc(s.aboutTitle)}</h2>\n${pad}  <p>${esc(s.aboutText)}</p>\n${pad}</section>`;
    case 'offerings':
      return `${pad}<section class="offerings">\n${pad}  <h2>${esc(s.offeringsLabel)}</h2>\n${pad}  <ul>\n${s.offerings.map(o => `${pad}    <li><span>${esc(o.t)}</span><span>${esc(o.d)}</span></li>`).join('\n')}\n${pad}  </ul>\n${pad}</section>`;
    case 'gallery':
      return `${pad}<section class="gallery">\n${s.gallery.map(g => g.img
        ? `${pad}  <img src="${g.img}" alt="">`
        : `${pad}  <div class="gallery-item">${esc(g.emoji)}</div>`
      ).join('\n')}\n${pad}</section>`;
    case 'contact':
      return `${pad}<section class="contact" id="kontakt">\n${pad}  <h2>Kontakt oss</h2>\n${pad}  <address>${esc(s.address)}<br>${esc(s.hours)}</address>\n${pad}  <a class="btn" href="tel:">${esc(s.cta)}</a>\n${pad}</section>`;
    case 'testimonials': {
      const c = EXTRA_SECTION_CONTENT.testimonials;
      return `${pad}<section class="testimonials">\n${pad}  <h2>${esc(section.name)}</h2>\n${c.items.map(it => `${pad}  <blockquote>"${esc(it.quote)}"<cite>${esc(it.name)}</cite></blockquote>`).join('\n')}\n${pad}</section>`;
    }
    case 'team': {
      const c = EXTRA_SECTION_CONTENT.team;
      return `${pad}<section class="team">\n${pad}  <h2>${esc(section.name)}</h2>\n${c.items.map(it => `${pad}  <div class="team-member"><span>${it.emoji}</span><strong>${esc(it.name)}</strong><span>${esc(it.role)}</span></div>`).join('\n')}\n${pad}</section>`;
    }
    case 'faq': {
      const c = EXTRA_SECTION_CONTENT.faq;
      return `${pad}<section class="faq">\n${pad}  <h2>${esc(section.name)}</h2>\n${c.items.map(it => `${pad}  <details><summary>${esc(it.q)}</summary><p>${esc(it.a)}</p></details>`).join('\n')}\n${pad}</section>`;
    }
    case 'ctabanner': {
      const c = EXTRA_SECTION_CONTENT.ctabanner;
      return `${pad}<section class="cta-banner">\n${pad}  <h2>${esc(section.name)}</h2>\n${pad}  <p>${esc(c.sub)}</p>\n${pad}  <a class="btn" href="#kontakt">${esc(s.cta)}</a>\n${pad}</section>`;
    }
    default:
      return '';
  }
}

function generateSiteCode(s) {
  const langAttr = s.language === 'en' ? 'en' : 'no';
  const sections = s.sections.map(sec => codeSectionMarkup(sec, s, 2)).filter(Boolean).join('\n\n');
  return `<!DOCTYPE html>
<html lang="${langAttr}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(s.seoTitle)}</title>
  <meta name="description" content="${esc(s.seoDesc)}">
  <link rel="stylesheet" href="styles.css">
</head>
<body style="--accent:${s.accent}; --accent-2:${s.accent2};">

  <!-- Generert av StudioNord Nettsidebygger -->
  <nav class="site-nav">
    <span class="logo">${esc(s.businessName)}</span>
    <div class="links">
      <a href="#om-oss">Om oss</a>
      <a href="#tilbud">${esc(s.offeringsLabel)}</a>
      <a href="#kontakt">Kontakt</a>
    </div>
  </nav>

${sections}

  <footer>
    <p>&copy; ${new Date().getFullYear()} ${esc(s.businessName)}. Bygget med StudioNord.</p>
  </footer>

</body>
</html>`;
}

function currentSiteCode() {
  return state.customCode || generateSiteCode(state);
}

function highlightHTML(code) {
  // Order matters: tag/attr first, then comments last, so the spans we
  // inject don't get re-matched and mangled by the earlier patterns.
  return code
    .replace(/([a-zA-Z-]+)(=)(".*?")/g, '<span class="attr">$1</span><span class="punct">$2</span><span class="str">$3</span>')
    .replace(/(&lt;\/?)([a-zA-Z0-9-]+)/g, '$1<span class="tag">$2</span>')
    .replace(/(&lt;!--.*?--&gt;)/g, '<span class="cmt">$1</span>');
}

function refreshCodeView() {
  const raw = currentSiteCode();
  document.getElementById('codeOutput').innerHTML = highlightHTML(esc(raw));
  document.getElementById('codeOutput').dataset.raw = raw;
}

let codeMode = 'view';
function setCodeMode(mode) {
  codeMode = mode;
  document.querySelectorAll('#codeModeToggle .view-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  const isEdit = mode === 'edit';
  document.getElementById('codeOutput').style.display = isEdit ? 'none' : 'block';
  document.getElementById('codeEditor').style.display = isEdit ? 'block' : 'none';
  document.getElementById('resetCodeBtn').style.display = isEdit ? 'inline-flex' : 'none';
  document.getElementById('applyCodeBtn').style.display = isEdit ? 'inline-flex' : 'none';
  document.getElementById('codeModalNote').style.display = isEdit ? 'none' : 'inline';
  if (isEdit) {
    document.getElementById('codeEditor').value = currentSiteCode();
  }
}

function openCodeModal() {
  setCodeMode('view');
  refreshCodeView();
  document.getElementById('codeModalSub').textContent = state.domain || (slugify(state.businessName) + '.no');
  document.getElementById('customCodeBanner').style.display = state.customCode ? 'block' : 'none';
  document.getElementById('codeModal').classList.add('open');
}

document.getElementById('codeBtn').addEventListener('click', openCodeModal);
document.getElementById('closeCodeModal').addEventListener('click', () => {
  document.getElementById('codeModal').classList.remove('open');
});
document.getElementById('codeModal').addEventListener('click', (e) => {
  if (e.target.id === 'codeModal') e.currentTarget.classList.remove('open');
});

if (isAdmin) {
  document.querySelectorAll('#codeModeToggle .view-btn').forEach(btn => {
    btn.addEventListener('click', () => setCodeMode(btn.dataset.mode));
  });
  document.getElementById('applyCodeBtn').addEventListener('click', () => {
    state.customCode = document.getElementById('codeEditor').value;
    persistState(true);
    updatePreview();
    document.getElementById('customCodeBanner').style.display = 'block';
    refreshCodeView();
    setCodeMode('view');
  });
  document.getElementById('resetCodeBtn').addEventListener('click', () => {
    if (!confirm('Tilbakestille til automatisk generert kode? Dine kodeendringer forsvinner.')) return;
    state.customCode = null;
    persistState(true);
    updatePreview();
    document.getElementById('customCodeBanner').style.display = 'none';
    refreshCodeView();
    setCodeMode('view');
  });
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } catch (err) { /* ignore */ }
  document.body.removeChild(ta);
}

document.getElementById('copyCodeBtn').addEventListener('click', (e) => {
  const raw = codeMode === 'edit' ? document.getElementById('codeEditor').value : (document.getElementById('codeOutput').dataset.raw || '');
  const btn = e.currentTarget;
  const original = btn.textContent;
  const showCopied = () => {
    btn.textContent = 'Kopiert ✓';
    setTimeout(() => { btn.textContent = original; }, 1800);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(raw).then(showCopied).catch(() => {
      fallbackCopy(raw);
      showCopied();
    });
  } else {
    fallbackCopy(raw);
    showCopied();
  }
});

/* ===================== INIT ===================== */
function renderAll() {
  fillOppsettFields();
  fillFields();
  renderSectionList();
  renderAddSectionMenu();
  updatePreview();
}

bindFields();
renderAll();

} /* end if (!bail) */
