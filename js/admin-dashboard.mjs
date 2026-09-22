import { adminElement, createAdminState } from './admin-shell.mjs'

export const DASHBOARD_STATES = Object.freeze(['loading', 'real', 'empty', 'unavailable', 'error', 'demo'])

// Presentation data only; identities and permissions never originate here.
export function websiteState(state, rows) {
  if (state === 'loading' || state === 'unavailable' || state === 'error') return { state, rows: [], value: null }
  if (!['real', 'empty', 'demo'].includes(state) || !Array.isArray(rows) || rows.some(row => !row || typeof row.id !== 'string' || !row.id)) {
    return { state: 'error', rows: [], value: null }
  }
  return { state: state === 'demo' ? 'demo' : rows.length ? 'real' : 'empty', rows, value: rows.length }
}

export function createKpi(document, { label, state = 'unavailable', value = null, trend, period, description = 'Ingen data ennå' }) {
  const el = (tag, css, text) => adminElement(document, tag, css, text)
  const card = el('article', 'dashboard-kpi')
  card.dataset.state = DASHBOARD_STATES.includes(state) ? state : 'unavailable'
  const available = ['real', 'empty', 'demo'].includes(card.dataset.state) && Number.isFinite(value) && value >= 0
  card.append(el('h2', '', label), el('p', 'dashboard-kpi-value', state === 'loading' ? 'Laster …' : available ? String(value) : '—'))
  card.append(el('p', 'dashboard-kpi-note', state === 'demo' ? 'DEMO DATA' : state === 'loading' ? 'Henter oversikten' : state === 'error' ? 'Kunne ikke hente data' : available ? description : 'Ingen data ennå'))
  if (available && trend && period) card.append(el('p', 'dashboard-kpi-note', `${trend} · ${period}`))
  return card
}

export function createProjectRow(document, site) {
  const el = (tag, css, text) => adminElement(document, tag, css, text)
  const row = el('li', 'dashboard-project')
  const details = el('div', 'dashboard-project-details')
  details.append(el('h3', '', typeof site.name === 'string' ? site.name : 'Nettside uten navn'),
    el('p', '', typeof site.companies?.name === 'string' ? site.companies.name : 'Ingen bedriftsnavn tilgjengelig'))
  const published = typeof site.current_publication_id === 'string' && Boolean(site.current_publication_id)
  const badge = el('span', `dashboard-badge${published ? ' is-published' : ''}`, published ? 'Publisert' : 'Uten publikasjon')
  const actions = el('div', 'dashboard-project-actions')
  const edit = el('a', 'btn btn-outline btn-small', 'Åpne Builder')
  edit.href = `builder.html?website=${encodeURIComponent(site.id)}`
  actions.append(edit)
  if (published && typeof site.public_slug === 'string' && site.public_slug.trim()) {
    const live = el('a', 'dashboard-live-link', 'Se live ↗')
    live.href = `site.html?slug=${encodeURIComponent(site.public_slug)}`
    live.target = '_blank'; live.rel = 'noopener noreferrer'
    live.setAttribute('aria-label', `Se live: ${typeof site.name === 'string' ? site.name : 'nettside'} (ny fane)`)
    actions.append(live)
  }
  row.append(details, badge, actions)
  return row
}

export function mountDashboard({ document, host, projectAction }) {
  const el = (tag, css, text) => adminElement(document, tag, css, text)
  const kpis = el('div', 'dashboard-kpis')
  kpis.setAttribute('aria-label', 'Nøkkeltall'); kpis.setAttribute('aria-live', 'polite')
  const grid = el('div', 'dashboard-grid')
  function section(title, css = '') {
    const node = el('section', `dashboard-section ${css}`)
    const head = el('div', 'dashboard-section-head')
    head.append(el('h2', '', title)); node.append(head); grid.append(node)
    return { node, head }
  }
  function unavailable(title, description, css) {
    const { node } = section(title, css)
    node.dataset.state = 'unavailable'
    node.append(el('p', 'dashboard-availability', 'Ikke koblet til'), el('p', 'dashboard-empty-copy', description))
  }
  unavailable('Krever oppmerksomhet', 'Varsler fra oppgaver, SEO, leads og integrasjoner vises her når modulene kobles til. Overvåking er ikke aktivert.', 'dashboard-attention')
  unavailable('Mine oppgaver', 'Arbeid som er tildelt deg, vises her når Oppgaver er implementert.')
  unavailable('Resultater siste 30 dager', 'Ingen datakilder er koblet til ennå. Resultater vises når integrasjoner er tilgjengelige.', 'dashboard-wide')
  const projects = section('Nettsideprosjekter', 'dashboard-wide')
  if (projectAction) projects.head.append(projectAction)
  projects.node.append(el('p', 'dashboard-section-note', 'Eksisterende nettsider i hentet oversikt. Dette er ikke en kundeliste.'))
  const projectBody = el('div', 'dashboard-project-body'); projects.node.append(projectBody)
  unavailable('Siste aktivitet', 'Aktivitet fra Wreach-modulene vises her etter hvert som de kobles til.', 'dashboard-wide')
  host.replaceChildren(kpis, grid)

  function update(state, rows) {
    const data = websiteState(state, rows)
    kpis.replaceChildren(...[
      { label: 'Aktive kunder' },
      { label: 'Nettsider', ...data, description: 'I hentet prosjektoversikt' },
      { label: 'Aktive kampanjer' },
      { label: 'Nye leads' },
    ].map(metric => createKpi(document, metric)))
    projects.node.dataset.state = data.state
    projectBody.setAttribute('aria-busy', String(data.state === 'loading'))
    if (data.state === 'real' || data.state === 'demo') {
      const list = el('ul', 'dashboard-project-list')
      for (const site of data.rows) list.append(createProjectRow(document, site))
      projectBody.replaceChildren(...(data.state === 'demo' ? [el('p', 'dashboard-availability', 'DEMO DATA · Ingen virkelige prosjekter')] : []), list)
    } else {
      const messages = {
        loading: ['Laster nettsideprosjekter …', 'Henter eksisterende prosjektoversikt.'],
        empty: ['Ingen nettsideprosjekter ennå', 'Spørringen er fullført. Ingen nettsider ble funnet.'],
        unavailable: ['Prosjektdata er ikke tilgjengelig', 'Ingen prosjektoversikt er koblet til.'],
        error: ['Kunne ikke hente kontooversikten', 'Prosjektdata kunne ikke lastes. Last siden på nytt for å prøve igjen. De øvrige dashboardseksjonene er fortsatt tilgjengelige.'],
      }
      const [title, description] = messages[data.state]
      projectBody.replaceChildren(createAdminState(document, { kind: data.state, title, description }))
    }
  }
  update('loading')
  return { update }
}

// Both returned query errors and rejected network requests become a safe visible state.
export async function loadDashboardWebsites(dashboard, query) {
  dashboard.update('loading')
  try {
    const result = await query()
    if (result?.error || !Array.isArray(result?.data)) dashboard.update('error')
    else dashboard.update('real', result.data)
  } catch {
    dashboard.update('error')
  }
}
