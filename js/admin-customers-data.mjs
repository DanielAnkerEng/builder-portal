// Read-only frontend data shaping. Backend RLS remains authoritative.
export const CUSTOMER_TABS = Object.freeze([
  ['overview', 'Oversikt'], ['websites', 'Nettside'], ['seo', 'SEO'],
  ['marketing', 'Markedsføring'], ['content', 'Innhold'], ['leads', 'Leads'],
  ['analytics', 'Analyse'], ['tasks', 'Oppgaver'], ['approvals', 'Godkjenninger'],
  ['integrations', 'Integrasjoner'], ['billing', 'Fakturering'], ['activity', 'Aktivitet'],
].map(([id, label]) => Object.freeze({ id, label })))
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const validCompanyId = value => typeof value === 'string' && uuid.test(value)
export function customerRoute(hash) {
  if (hash === '#customers') return { kind: 'list' }
  const match = /^#customer\/([^/]+)(?:\/([a-z]+))?$/.exec(hash)
  if (!match || !validCompanyId(match[1])) return { kind: 'invalid' }
  const tab = match[2] || 'overview'
  if (!CUSTOMER_TABS.some(item => item.id === tab)) return { kind: 'invalid' }
  return { kind: 'workspace', id: match[1].toLowerCase(), tab }
}
export const customerHref = (id, tab = 'overview') => `#customer/${encodeURIComponent(id)}/${tab}`
const safeText = value => typeof value === 'string' ? value : ''
const normalize = value => safeText(value).trim().replace(/\s+/g, ' ').toLocaleLowerCase('nb-NO')

export function aggregateCustomers(companies, websites) {
  if (!Array.isArray(companies) || !Array.isArray(websites)) throw new Error('CUSTOMER_DATA_INVALID')
  const byId = new Map(), siteIds = new Set(), orphans = []
  for (const company of companies) {
    if (!company || !validCompanyId(company.id) || byId.has(company.id.toLowerCase())) throw new Error('CUSTOMER_DATA_INVALID')
    const id = company.id.toLowerCase()
    byId.set(id, { id, name: safeText(company.name) || 'Selskap uten navn', websites: [], published: 0 })
  }
  for (const site of websites) {
    if (!site || typeof site.id !== 'string' || !site.id || siteIds.has(site.id)) throw new Error('CUSTOMER_DATA_INVALID')
    siteIds.add(site.id)
    const company = validCompanyId(site.company_id) ? byId.get(site.company_id.toLowerCase()) : null
    if (!company) { orphans.push(site); continue }
    company.websites.push({ ...site, companies: { name: company.name } })
    if (typeof site.current_publication_id === 'string' && site.current_publication_id) company.published++
  }
  return { customers: [...byId.values()], orphans }
}

export function selectCustomers(customers, { search = '', filter = 'all', sort = 'asc' } = {}) {
  const term = normalize(search)
  return customers.filter(company => {
    const matches = [company.name, ...company.websites.flatMap(site => [site.name, site.public_slug])].some(value => normalize(value).includes(term))
    const accepted = filter === 'published' ? company.published > 0
      : filter === 'unpublished' ? company.websites.length > company.published
      : filter === 'none' ? company.websites.length === 0 : true
    return matches && accepted
  }).sort((a, b) => (a.name.localeCompare(b.name, 'nb-NO') || a.id.localeCompare(b.id)) * (sort === 'desc' ? -1 : 1))
}

// Fetch complete, ordered pages; never present a truncated/failed response as zero.
export async function readCustomers(client) {
  async function pages(table, fields) {
    const result = [], size = 500
    for (let page = 0; page < 100; page++) {
      const { data, error } = await client.from(table).select(fields).order('id').range(page * size, (page + 1) * size - 1)
      if (error || !Array.isArray(data)) throw new Error('CUSTOMERS_LOAD_FAILED')
      result.push(...data)
      if (data.length < size) return result
    }
    throw new Error('CUSTOMERS_DATA_LIMIT')
  }
  const [companies, websites] = await Promise.all([
    pages('companies', 'id,name'),
    pages('websites', 'id,company_id,name,public_slug,current_publication_id'),
  ])
  return aggregateCustomers(companies, websites)
}
