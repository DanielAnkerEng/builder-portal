import { adminElement, createAdminState } from './admin-shell.mjs'
import { createProjectRow } from './admin-dashboard.mjs'
import { CUSTOMER_TABS, customerRoute, customerHref, selectCustomers, validCompanyId } from './admin-customers-data.mjs'
import { mountNewCustomer } from './admin-new-customer.mjs'
import { mountCustomerInvite } from './admin-customer-invite.mjs'

export function mountCustomers({ document, load, window, newCustomerApi, createInviteApi }) {
  const el = (tag, css, text) => adminElement(document, tag, css, text)
  const element = el('div', 'customers-module')
  let state = typeof load === 'function' ? 'idle' : 'unavailable'
  let data = { customers: [], orphans: [] }, hash = '#customers', pending = false
  const options = { search: '', filter: 'all', sort: 'asc' }
  let wizard = null
  function link(label, href, css = '') {
    const node = el('a', css, label); node.href = href; return node
  }
  function message(kind, title, description) {
    return createAdminState(document, { kind, title, description })
  }
  function projectList(customer) {
    if (!customer.websites.length) return message('empty', 'Ingen nettsider ennå', 'Dette selskapet har ingen nettsider i den hentede oversikten. Ingen nettside opprettes automatisk.')
    const list = el('ul', 'dashboard-project-list')
    for (const site of customer.websites) list.append(createProjectRow(document, site))
    return list
  }
  function renderList() {
    const header = el('div', 'customers-list-head')
    header.append(el('p', '', 'Registrerte selskaper, også uten nettsider. Livssyklus og kundeansvar er ikke registrert i denne oversikten.'))
    const add = el('button', 'btn btn-primary', '+ Ny kunde · kommer senere'); add.type = 'button'; add.disabled = true
    if (newCustomerApi) { add.textContent = '+ Ny kunde'; add.disabled = false; add.addEventListener('click', () => { window.location.hash = '#customers/new' }) }
    header.append(add)
    const toolbar = el('div', 'customers-toolbar')
    function control(label, node) {
      const wrapper = el('label', 'customers-control')
      wrapper.append(el('span', '', label), node); toolbar.append(wrapper)
    }
    const search = el('input'); search.type = 'search'; search.value = options.search
    search.placeholder = 'Søk etter selskap eller nettside'; control('Søk', search)
    function select(label, entries, selected, disabled = false) {
      const node = el('select'); node.disabled = disabled
      for (const [value, title] of entries) { const option = el('option', '', title); option.value = value; node.append(option) }
      node.value = selected; control(label, node); return node
    }
    const filter = select('Nettsidestatus', [['all','Alle'],['published','Har publisert nettside'],['unpublished','Har nettside uten publikasjon'],['none','Ingen nettsider']], options.filter)
    const sort = select('Sorter', [['asc','Navn A–Å'],['desc','Navn Å–A']], options.sort)
    for (const label of ['Kundestatus','Tjeneste','Ansvarlig']) select(label, [['unavailable','Ikke tilgjengelig']], 'unavailable', true)
    const summary = el('p', 'customers-result-count'); summary.setAttribute('role', 'status')
    const results = el('div', 'customers-results')
    function refresh() {
      const rows = selectCustomers(data.customers, options)
      summary.textContent = `${rows.length} av ${data.customers.length} selskaper i hentet oversikt`
      results.dataset.state = !data.customers.length ? 'empty' : rows.length ? 'real' : 'no-results'
      if (!data.customers.length) { results.replaceChildren(message('empty', 'Ingen selskaper funnet', 'Spørringen er fullført. Ingen selskaper er tilgjengelige i denne oversikten.')); return }
      if (!rows.length) { results.replaceChildren(message('empty', 'Ingen treff', 'Prøv et annet søk eller velg et annet nettsidefilter.')); return }
      const list = el('ul', 'customers-list')
      for (const customer of rows) {
        const row = el('li', 'customer-row')
        const identity = el('div', 'customer-row-identity')
        const heading = el('h2'); heading.append(link(customer.name, customerHref(customer.id)))
        identity.append(heading, el('p', '', 'Selskap'))
        const count = el('div', 'customer-row-metric'); count.append(el('span', '', 'Nettsider'), el('strong', '', String(customer.websites.length)))
        const publication = el('div', 'customer-row-metric'); publication.append(el('span', '', 'Nettsidestatus'), el('strong', '', `${customer.published} publisert / ${customer.websites.length - customer.published} uten publikasjon`))
        const open = link('Åpne kunde', customerHref(customer.id), 'btn btn-outline btn-small')
        open.setAttribute('aria-label', `Åpne kunde: ${customer.name}`)
        row.append(identity, count, publication, open)
        list.append(row)
      }
      results.replaceChildren(list)
    }
    search.addEventListener('input', () => { options.search = search.value; refresh() })
    filter.addEventListener('change', () => { options.filter = filter.value; refresh() })
    sort.addEventListener('change', () => { options.sort = sort.value; refresh() })
    element.replaceChildren(header, toolbar)
    if (data.orphans.length) {
      const notice = el('p', 'customers-orphan-notice', `${data.orphans.length} nettside(r) mangler kobling til et selskap i den hentede oversikten. De er ikke gjort om til kunder. Kontroller koblingen separat; nettsidene kan fortsatt finnes på Dashboard.`)
      notice.setAttribute('role','status'); element.append(notice)
    }
    element.append(summary, results); refresh()
  }
  function renderWorkspace(route) {
    const customer = data.customers.find(item => item.id === route.id)
    const back = link('← Tilbake til Kunder', '#customers', 'customers-back')
    if (!customer) { element.replaceChildren(back, message('unavailable', 'Kunden er ikke tilgjengelig', 'Selskapet finnes ikke i den hentede oversikten, eller du har ikke tilgang.')); return }
    const header = el('header', 'customer-workspace-header')
    header.append(back, el('h2', '', customer.name), el('p', '', `${customer.websites.length} nettsider · ${customer.published} publisert`))
    const nav = el('nav', 'customer-workspace-nav'); nav.setAttribute('aria-label','Kundens områder')
    for (const tab of CUSTOMER_TABS) {
      const node = link(tab.label, customerHref(customer.id, tab.id))
      if (tab.id === route.tab) node.setAttribute('aria-current','page')
      nav.append(node)
    }
    const body = el('section', 'dashboard-section customer-workspace-body')
    const tab = CUSTOMER_TABS.find(item => item.id === route.tab)
    body.append(el('h3', 'customer-section-title', tab.label))
    if (route.tab === 'websites') body.append(projectList(customer))
    else if (route.tab === 'overview') {
      body.append(el('p', 'dashboard-empty-copy', 'Nettsider og publikasjoner er tilgjengelige. Kundestatus, ansvarlig og kontaktperson er ikke registrert som datakilder her.'))
      const websites = el('div', 'customer-overview-sites')
      websites.append(el('h3', '', 'Nettsider'), projectList(customer)); body.append(websites)
      const future = el('div', 'customer-future-summary')
      future.append(el('h3', '', 'Videre oppfølging'),
        el('p', '', 'Tjenestedata vises ikke i dette arbeidsområdet ennå.'),
        el('p', '', 'Ansvar og onboarding er ikke tilgjengelig ennå.'),
        el('p', '', 'Oppgaver, godkjenninger, varsler, resultater og aktivitet vises når modulene kobles til. Ingen overvåking er aktivert her.'))
      body.append(future)
    } else body.append(message('unavailable', `${tab.label} kommer senere`, 'Denne kundemodulen er ikke koblet til. Ingen data eller handlinger er tilgjengelige ennå.'))
    if (route.tab === 'overview' && createInviteApi) body.append(mountCustomerInvite({ document, companyId: customer.id, createApi: createInviteApi }))
    element.replaceChildren(header, nav, body)
  }
  function render() {
    element.dataset.state = state; element.setAttribute('aria-busy', String(state === 'loading'))
    const route = customerRoute(hash)
    if (route.kind === 'new' && newCustomerApi) {
      if (!wizard) wizard = mountNewCustomer({ document, window, api: newCustomerApi,
        navigate: target => { window.location.hash = target },
        refreshCustomer: async id => { await refresh(); return state === 'real' && data.customers.some(customer => customer.id === id) },
      })
      element.replaceChildren(wizard.element); return
    }
    if (route.kind === 'invalid') { element.replaceChildren(link('← Tilbake til Kunder','#customers'), message('error','Ugyldig kundeadresse','Velg en kunde fra oversikten.')); return }
    if (state !== 'real') {
      const messages = {
        idle:['Laster kunder …','Henter selskaper og nettsider.'],
        loading:['Laster kunder …','Henter selskaper og nettsider.'],
        unavailable:['Kundedata er ikke tilgjengelig','Datakilden er ikke koblet til.'],
        error:['Kunne ikke hente kundeoversikten','Prøv igjen. Ingen backenddetaljer vises, og de øvrige Admin-sidene er fortsatt tilgjengelige.'],
      }
      const [title, description] = messages[state] || messages.error
      element.replaceChildren(message(state, title, description))
      if (state === 'error') { const retry = el('button','btn btn-outline','Prøv igjen'); retry.type='button'; retry.addEventListener('click',refresh); element.append(retry) }
      return
    }
    if (route.kind === 'list') renderList(); else renderWorkspace(route)
  }
  async function refresh() {
    if (pending) { await pending; return }
    if (typeof load !== 'function') return
    state = 'loading'; render()
    pending = (async () => {
    try {
      const result = await load()
      if (!result || !Array.isArray(result.customers) || !Array.isArray(result.orphans) || result.customers.some(customer =>
        !customer || !validCompanyId(customer.id) || typeof customer.name !== 'string' || !Array.isArray(customer.websites) ||
        !Number.isInteger(customer.published) || customer.published < 0 || customer.published > customer.websites.length ||
        customer.websites.some(site => !site || typeof site.id !== 'string' || !site.id)
      )) throw new Error('CUSTOMER_DATA_INVALID')
      data = result; state = 'real'
    } catch { data = { customers:[], orphans:[] }; state = 'error' }
    finally { render() }
    })()
    await pending; pending = false
  }
  return { element, canCreate: Boolean(newCustomerApi),
    beforeLeave(nextHash) { return nextHash === '#customers/new' || !wizard || wizard.canLeave() },
    leave(nextHash) { if (nextHash !== '#customers/new' && wizard) { wizard.destroy(); wizard = null } },
    route(nextHash) { hash = nextHash; render(); if (state === 'idle' && ['list', 'workspace'].includes(customerRoute(hash).kind)) void refresh() },
  }
}
