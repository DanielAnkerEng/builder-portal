// Presentation only. The caller must complete the existing admin guard before mounting.
export const ADMIN_NAVIGATION = Object.freeze([
  ['OVERSIKT', [['dashboard', 'Dashboard', '/admin']]],
  ['KUNDER', [['customers', 'Kunder', '/admin/customers']]],
  ['ARBEID', [['tasks', 'Oppgaver', '/admin/tasks'], ['approvals', 'Godkjenninger', '/admin/approvals']]],
  ['TJENESTER', [['seo', 'SEO', '/admin/seo'], ['marketing', 'Markedsføring', '/admin/marketing'], ['content', 'Innhold', '/admin/content'], ['leads', 'Leads', '/admin/leads']]],
  ['RESULTATER', [['analytics', 'Analyse', '/admin/analytics'], ['reports', 'Rapporter', '/admin/reports']]],
  ['SYSTEM', [['integrations', 'Integrasjoner', '/admin/integrations'], ['settings', 'Innstillinger', '/admin/settings']]],
].map(([label, items]) => Object.freeze({ label, items: Object.freeze(items.map(([id, title, futurePath]) => Object.freeze({ id, title, futurePath }))) })))

const pages = ADMIN_NAVIGATION.flatMap(group => group.items)
export function resolveAdminPage(hash) {
  if (typeof hash === 'string' && (hash === '#customer' || hash.startsWith('#customer/'))) return pages.find(page => page.id === 'customers')
  return pages.find(page => `#${page.id}` === hash) || pages[0]
}

export function adminElement(document, tag, className, text) {
  const element = document.createElement(tag)
  if (className) element.className = className
  if (text !== undefined) element.textContent = text
  return element
}

export function createAdminState(document, { kind = 'empty', title, description }) {
  const node = adminElement(document, 'section', `admin-state admin-state-${kind}`)
  node.setAttribute('role', kind === 'error' ? 'alert' : 'status')
  node.append(adminElement(document, 'span', 'admin-state-symbol', kind === 'error' ? '!' : '—'),
    adminElement(document, 'h2', '', title), adminElement(document, 'p', '', description))
  return node
}

// Focus containment for temporary navigation and dialogs; never changes authorization.
export function containAdminFocus(event, container) {
  if (event.key !== 'Tab') return
  const nodes = [...container.querySelectorAll('a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]')]
    .filter(node => !node.hidden && node.getClientRects().length)
  if (!nodes.length) { event.preventDefault(); container.focus(); return }
  const first = nodes[0], last = nodes[nodes.length - 1]
  const focused = container.ownerDocument.activeElement
  if (event.shiftKey && (focused === first || !container.contains(focused))) { event.preventDefault(); last.focus() }
  else if (!event.shiftKey && (focused === last || !container.contains(focused))) { event.preventDefault(); first.focus() }
}

export function mountAdminShell({ document, window, host, content, profile, platformRole, modules = new Map() }) {
  const el = (tag, css, text) => adminElement(document, tag, css, text)
  const sidebar = el('aside', 'admin-sidebar')
  sidebar.id = 'adminNavigation'
  sidebar.setAttribute('aria-label', 'Admin-navigasjon')
  sidebar.tabIndex = -1
  const brand = el('a', 'admin-brand', 'Wreach')
  brand.href = '#dashboard'
  const close = el('button', 'admin-nav-close', 'Lukk meny ×')
  close.type = 'button'
  sidebar.append(brand, el('span', 'admin-workspace-label', 'ARBEIDSOMRÅDE'), close)
  const nav = el('nav', 'admin-nav')
  nav.setAttribute('aria-label', 'Hovedmeny')
  const links = []
  for (const group of ADMIN_NAVIGATION) {
    const section = el('div', 'admin-nav-group')
    section.append(el('p', 'admin-nav-group-title', group.label))
    for (const page of group.items) {
      const link = el('a', 'admin-nav-link', page.title)
      link.href = `#${page.id}`
      section.append(link)
      links.push({ page, link })
    }
    nav.append(section)
  }
  sidebar.append(nav)
  const user = el('div', 'admin-sidebar-user')
  const displayName = typeof profile?.display_name === 'string' ? profile.display_name : 'Innlogget bruker'
  user.append(el('span', 'admin-user-initial', displayName.slice(0, 1).toUpperCase()))
  const identity = el('div', 'admin-user-identity')
  identity.append(el('strong', '', displayName), el('span', '', platformRole === 'owner' ? 'Plattformeier' : platformRole === 'admin' ? 'Plattformadministrator' : ''))
  const logout = el('button', 'admin-logout', 'Logg ut')
  logout.type = 'button'; logout.id = 'logoutBtn'
  user.append(identity, logout); sidebar.append(user)

  const workspace = el('div', 'admin-workspace')
  const topbar = el('header', 'admin-topbar')
  const menu = el('button', 'admin-menu-toggle', '☰ Meny')
  menu.type = 'button'; menu.setAttribute('aria-controls', sidebar.id); menu.setAttribute('aria-expanded', 'false')
  const breadcrumbs = el('nav', 'admin-breadcrumbs')
  breadcrumbs.setAttribute('aria-label', 'Brødsmuler')
  const crumb = el('span', '', 'Dashboard'); crumb.setAttribute('aria-current', 'page')
  breadcrumbs.append(el('span', '', 'Arbeidsområde'), el('span', 'admin-crumb-separator', '/'), crumb)
  const quickWrap = el('div', 'admin-quick-wrap')
  const quick = el('button', 'btn btn-primary admin-quick-trigger', '+ Ny')
  quick.type = 'button'; quick.setAttribute('aria-expanded', 'false'); quick.setAttribute('aria-controls', 'adminQuickActions')
  const quickPanel = el('section', 'admin-quick-panel')
  quickPanel.id = 'adminQuickActions'; quickPanel.hidden = true
  quickPanel.setAttribute('aria-label', 'Nye handlinger')
  quickPanel.append(el('p', '', 'Kommer i senere faser'))
  for (const label of ['Ny kunde', 'Ny oppgave', 'Ny kampanje', 'Nytt innhold', 'Registrer lead']) {
    const button = el('button', '', label); button.type = 'button'; button.disabled = true; quickPanel.append(button)
  }
  quickWrap.append(quick, quickPanel); topbar.append(menu, breadcrumbs, quickWrap)
  const main = el('main', 'admin-main'); main.id = 'adminMain'; main.tabIndex = -1
  const pageHeader = el('div', 'admin-page-header')
  const title = el('h1', '', 'Dashboard'); title.tabIndex = -1
  const subtitle = el('p', '', 'Oversikt over kunder, arbeid og det som krever oppmerksomhet.')
  pageHeader.append(el('p', 'admin-eyebrow', 'WREACH ADMIN'), title, subtitle)
  const future = el('div', 'admin-future'); future.hidden = true
  main.append(pageHeader, content, future); content.hidden = false
  workspace.append(topbar, main)
  const backdrop = el('button', 'admin-nav-backdrop'); backdrop.type = 'button'; backdrop.hidden = true
  backdrop.setAttribute('aria-label', 'Lukk navigasjon'); backdrop.tabIndex = -1
  const skip = el('a', 'admin-skip', 'Hopp til innhold'); skip.href = '#adminMain'
  skip.addEventListener('click', event => { event.preventDefault(); main.focus() })
  host.replaceChildren(skip, sidebar, backdrop, workspace)

  const mobile = window.matchMedia('(max-width: 1000px)')
  let menuOpen = false
  function setMenu(open, returnFocus = true) {
    menuOpen = Boolean(open && mobile.matches)
    sidebar.classList.toggle('is-open', menuOpen)
    sidebar.inert = mobile.matches && !menuOpen
    workspace.inert = menuOpen
    backdrop.hidden = !menuOpen
    menu.setAttribute('aria-expanded', String(menuOpen))
    document.body.classList.toggle('admin-nav-open', menuOpen)
    if (menuOpen) { sidebar.setAttribute('role', 'dialog'); sidebar.setAttribute('aria-modal', 'true'); close.focus() }
    else { sidebar.removeAttribute('role'); sidebar.removeAttribute('aria-modal'); if (returnFocus && mobile.matches) menu.focus() }
  }
  menu.addEventListener('click', () => setMenu(!menuOpen))
  close.addEventListener('click', () => setMenu(false))
  backdrop.addEventListener('click', () => setMenu(false))
  const resized = () => { const inside = sidebar.contains(document.activeElement); setMenu(false, false); if (mobile.matches && inside) menu.focus() }
  mobile.addEventListener('change', resized)
  setMenu(false, false)
  function setQuick(open) { quickPanel.hidden = !open; quick.setAttribute('aria-expanded', String(open)) }
  quick.addEventListener('click', () => setQuick(quickPanel.hidden))
  const clickAway = event => { if (!quickWrap.contains(event.target)) setQuick(false) }
  const keys = event => {
    if (event.key === 'Escape') { if (menuOpen) setMenu(false); if (!quickPanel.hidden) { setQuick(false); quick.focus() } }
    if (menuOpen) containAdminFocus(event, sidebar)
  }
  document.addEventListener('click', clickAway)
  document.addEventListener('keydown', keys)
  function renderPage(focus = false) {
    const page = resolveAdminPage(window.location.hash)
    for (const entry of links) {
      if (entry.page.id === page.id) entry.link.setAttribute('aria-current', 'page')
      else entry.link.removeAttribute('aria-current')
    }
    title.textContent = page.title; crumb.textContent = page.title
    document.title = `${page.title} | Wreach Admin`
    const dashboard = page.id === 'dashboard'
    subtitle.textContent = dashboard ? 'Oversikt over kunder, arbeid og det som krever oppmerksomhet.' : page.id === 'customers' && modules.has('customers') ? 'Selskaper og nettsider samlet i kundens arbeidsområde.' : 'Dette området er planlagt for en senere fase.'
    content.hidden = !dashboard; future.hidden = dashboard
    if (!dashboard) {
      const module = modules.get(page.id)
      if (module) { future.replaceChildren(module.element); module.route(window.location.hash) }
      else future.replaceChildren(createAdminState(document, { title: `${page.title} kommer senere`, description: 'Denne modulen er ikke aktivert ennå. Bruk Dashboard for eksisterende nettsideprosjekter.' }))
    }
    setMenu(false, false); setQuick(false)
    if (focus) title.focus()
  }
  const routeChanged = () => renderPage(true)
  for (const { link } of links) link.addEventListener('click', () => { if (link.hash === window.location.hash) { setMenu(false, false); title.focus() } })
  window.addEventListener('hashchange', routeChanged); renderPage()
  return { logout, setMenu, destroy() { mobile.removeEventListener('change', resized); window.removeEventListener('hashchange', routeChanged); document.removeEventListener('click', clickAway); document.removeEventListener('keydown', keys); document.body.classList.remove('admin-nav-open') } }
}
