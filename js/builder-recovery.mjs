// Content-only helpers. Never accept Auth/session or browser-storage objects.
const clone = value => JSON.parse(JSON.stringify(value))
const canonical = value => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item)
export const sameDraft = (a, b) => canonical(a) === canonical(b)
export function classifyDraft(confirmed, attempt, server) {
  if (!server || !Number.isSafeInteger(server.revision) || server.revision < confirmed.revision)
    throw Error('INVALID_SERVER_REVISION')
  if (attempt && server.revision > attempt.revision && sameDraft(server.content, attempt.content)) return 'attempt'
  if (server.revision === confirmed.revision && sameDraft(server.content, confirmed.content)) return 'previous'
  return 'different'
}
export function draftDifferences(a, b, path = '') {
  if (sameDraft(a, b)) return []
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return [path || 'utkast']
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap(key => draftDifferences(a[key], b[key], path ? `${path}.${key}` : key))
}
const fieldNames = {
  businessName:'Bedriftsnavn', heroTag:'Merking over overskriften', heroTitle:'Hovedoverskrift',
  heroSub:'Ingress', cta:'Knappetekst', badge:'Merke', aboutTitle:'Om oss – overskrift',
  aboutText:'Om oss – tekst', offeringsLabel:'Tjenester – overskrift', offerings:'Tjenester',
  gallery:'Galleri', address:'Adresse', hours:'Åpningstider', domain:'Domene', language:'Språk',
  status:'Utkaststatus', seoTitle:'Søketittel', seoDesc:'Søkebeskrivelse', templateId:'Mal',
  accent:'Hovedfarge', accent2:'Sekundærfarge', bg:'Bakgrunnsfarge', name:'Navn', slug:'Nettadresse',
  enabled:'Synlig', removable:'Kan fjernes', locked:'Låst', customCode:'Egendefinert kode',
  title:'Overskrift', text:'Tekst', description:'Beskrivelse', image:'Bilde', url:'Lenke',
  src:'Bildefil', alt:'Bildetekst', price:'Pris', activePageId:'Valgt side', id:'ID',
}
const sectionNames = {hero:'Toppbanner',about:'Om oss',offerings:'Tilbud / tjenester',gallery:'Galleri',contact:'Kontakt'}
const valueText = value => value === undefined ? 'Ikke til stede' : value === null ? 'Ingen verdi'
  : value === '' ? '(tom tekst)' : value === true ? 'Ja' : value === false ? 'Nei'
  : typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)
const named = (item, section) => section ? sectionNames[item.id] || item.name || item.id : item.name || item.id
const keyed = items => Array.isArray(items) && items.every(item => item && typeof item.id === 'string')
  && new Set(items.map(item => item.id)).size === items.length

// Presentation only: align pages/sections by stable IDs, never by their array position.
export function draftComparison(local, server) {
  const result = []
  const add = (label, a, b) => result.push({label, local:valueText(a), server:valueText(b)})
  function visit(a, b, labels = [], key = '') {
    if (sameDraft(a, b)) return
    if ((key === 'pages' || key === 'sections') && keyed(a) && keyed(b)) {
      const section = key === 'sections', prefix = section ? labels : []
      const idsA = a.map(item => item.id), idsB = b.map(item => item.id)
      const describe = items => items.length ? items.map((item, i) => `${i + 1}. ${named(item, section)} [${item.id}]`).join('\n') : '(ingen)'
      if (!sameDraft(idsA, idsB)) add([...prefix, section ? 'Seksjonsrekkefølge' : 'Siderekkefølge'].join(' → '), describe(a), describe(b))
      for (const id of new Set([...idsA, ...idsB])) {
        const left = a.find(item => item.id === id), right = b.find(item => item.id === id)
        const name = named(left || right, section), path = [...prefix, name]
        if (!left || !right) add([...path, `${section ? 'Seksjon' : 'Side'} ${left ? 'bare i ditt åpne utkast (tilføyd lokalt eller fjernet på serveren)' : 'bare på serveren (fjernet lokalt eller tilføyd på serveren)'}`].join(' → '), left, right)
        else visit(left, right, path)
      }
      return
    }
    if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
      for (const child of new Set([...Object.keys(a), ...Object.keys(b)])) {
        const next = child === 'pages' || child === 'sections' ? labels : [...labels, fieldNames[child] || `Felt «${child}»`]
        if (child === 'activePageId') {
          if (a[child] !== b[child]) add([...labels, fieldNames[child]].join(' → '),
            local?.pages?.find(p => p.id === a[child])?.name || a[child], server?.pages?.find(p => p.id === b[child])?.name || b[child])
        } else visit(a[child], b[child], next, child)
      }
      return
    }
    add(labels.join(' → ') || 'Hele utkastet', a, b)
  }
  visit(local, server)
  return result
}

// No HTML interpretation or event handlers: native details supports pointer and keyboard.
export function renderDraftComparison(document, list, differences) {
  list.replaceChildren()
  const textNode = (tag, text, className) => {
    const node = document.createElement(tag); node.textContent = text
    if (className) node.className = className
    return node
  }
  function pair(parent, difference, abbreviated) {
    const values = document.createElement('dl'); values.className = 'recovery-values'
    for (const [label, value] of [['Ditt åpne utkast', difference.local], ['Kontrollert serverversjon', difference.server]]) {
      values.append(textNode('dt', label), textNode('dd', abbreviated && value.length > 180 ? value.slice(0, 180) + ' …' : value))
    }
    parent.append(values)
  }
  for (const difference of differences) {
    const item = document.createElement('li'); item.className = 'recovery-difference'
    item.append(textNode('h3', difference.label)); pair(item, difference, true)
    if (difference.local.length > 180 || difference.server.length > 180) {
      const full = document.createElement('details')
      full.append(textNode('summary', 'Vis hele forskjellen')); pair(full, difference, false); item.append(full)
    }
    list.append(item)
  }
}
export function openDraftCopy(content, fields, wide, pageKeys) {
  const result = clone(content), page = result.pages.find(p => p.id === result.activePageId) || result.pages[0]
  for (const key of wide) result[key] = fields[key]
  for (const key of pageKeys) page[key] = fields[key] === undefined ? undefined : clone(fields[key])
  result.status = 'draft'
  return clone(result)
}
export function draftExport(websiteId, content) {
  return JSON.stringify({format:'wreach-draft',formatVersion:1,websiteId,content:clone(content)}, null, 2)
}
