import * as model from './admin-new-customer-state.mjs'
import { resultMatchesAttempt } from './admin-new-customer-api.mjs'
import { adminElement } from './admin-shell.mjs'
import { customerHref } from './admin-customers-data.mjs'

const steps = ['Bedrift', 'Kontaktperson', 'Tjenester', 'Wreach-oppsett', 'Bekreft']
const companyFields = [['name','Bedriftsnavn'],['organizationNumber','Organisasjonsnummer'],['externalWebsiteUrl','Eksisterende ekstern nettside'],['contactEmail','Bedriftens e-post'],['contactPhone','Telefonnummer'],['address','Adresse']]
const contactFields = [['name','Navn'],['email','E-post'],['phone','Telefonnummer'],['title','Stilling/rolle']]
const serviceGroups = [['NETTSIDE',['website','website_management']],['SEO',['seo','local_seo']],['ANNONSERING',['google_ads','meta_ads','linkedin_ads','tiktok_ads']],['INNHOLD',['social_media','content']],['DATA',['analytics']]]
const labels = { website:'Nettside', website_management:'Nettsideforvaltning', seo:'SEO', local_seo:'Lokal SEO', google_ads:'Google Ads', meta_ads:'Meta Ads', linkedin_ads:'LinkedIn Ads', tiktok_ads:'TikTok Ads', social_media:'Sosiale medier', content:'Innhold', analytics:'Analyse', account:'Kundeansvarlig', marketing:'Markedsføring' }
const lifecycleLabels = { onboarding:'Onboarding', active:'Aktiv', paused:'Pauset', ended:'Avsluttet' }
const messages = {
  UNAUTHENTICATED:'Økten er utløpt. Logg inn på nytt.', MFA_REQUIRED:'Bekreft tofaktorinnlogging før du fortsetter.',
  NOT_AUTHORIZED:'Du har ikke tilgang til å opprette kunder.', PROFILE_INACTIVE:'Du har ikke tilgang til å opprette kunder.',
  ORGANIZATION_NUMBER_EXISTS:'Organisasjonsnummeret er allerede registrert.',
  IDEMPOTENCY_CONFLICT:'Det forrige forsøket må kontrolleres før du kan fortsette.',
  INVALID_ORGANIZATION_NUMBER:'Kontroller organisasjonsnummeret.', INVALID_EMAIL:'Kontroller e-postadressene.',
  INVALID_URL:'Kontroller den eksterne nettadressen.', INVALID_PHONE:'Kontroller telefonnumrene.',
  INVALID_ASSIGNEE:'En valgt ansvarlig er ikke tilgjengelig. Kontroller Wreach-oppsettet.',
}

export function mountNewCustomer({ document, window, api, refreshCustomer, navigate }) {
  const el = (tag, css, text) => adminElement(document, tag, css, text)
  const element = el('section', 'new-customer')
  let state = model.createWizardState(), alive = true, busy = false, feedback = '', errors = []
  let assigneeStatus = 'idle', assignees = [], refreshStatus = 'idle'
  const notice = el('p', 'new-customer-notice'); notice.setAttribute('aria-live', 'polite'); notice.setAttribute('role', 'status')
  const body = el('div'), actions = el('div', 'new-customer-actions')
  element.append(notice, body, actions)
  const beforeUnload = event => { if (model.navigationState(state).shouldWarnOnLeave) { event.preventDefault(); event.returnValue = '' } }
  window.addEventListener('beforeunload', beforeUnload)
  function button(text, action, parent = actions) {
    const node = el('button', 'btn btn-outline', text); node.type = 'button'
    node.addEventListener('click', action); parent.append(node); return node
  }
  function canLeave() {
    const flags = model.navigationState(state)
    if (flags.submitting || flags.uncertain) { feedback = 'Resultatet må avklares før du forlater veiviseren.'; render(); return false }
    return !flags.shouldWarnOnLeave || window.confirm('Forkaste opplysningene og forlate veiviseren?')
  }
  function changeStep(step) {
    if (state.submission.status !== 'editing') return
    state = model.setStep(state, step); errors = []; feedback = ''; render(true)
    if (step === 4 && assigneeStatus === 'idle') void loadAssignees()
  }
  function next() {
    errors = model.validateStep(state)
    if (errors.length) { feedback = 'Kontroller de markerte feltene.'; render(); document.getElementById(`nc-${errors[0].field}`)?.focus(); return }
    changeStep(state.step + 1)
  }
  async function loadAssignees() {
    if (assigneeStatus === 'loading' || !alive) return
    assigneeStatus = 'loading'; render()
    let result
    try { result = await api.listAssignees() } catch { result = { ok: false } }
    if (!alive) return
    assigneeStatus = result.ok ? 'ready' : 'error'; assignees = result.ok ? result.assignees : []
    render()
  }
  function textInputs(section, fields) {
    const grid = el('div', 'new-customer-fields')
    for (const [key, label] of fields) {
      const wrapper = el('div', 'new-customer-field'), id = `nc-${section}.${key}`
      const caption = el('label', '', label); caption.htmlFor = id
      const input = el('input'); input.id = id; input.name = `${section}.${key}`; input.type = 'text'; input.value = state[section][key]
      input.autocomplete = 'off'
      if (section === 'company' && key === 'name') input.required = true
      if (key === 'organizationNumber') input.inputMode = 'numeric'
      const invalid = errors.find(error => error.field === `${section}.${key}`)
      if (invalid) {
        input.setAttribute('aria-invalid', 'true'); input.setAttribute('aria-describedby', `${id}-error`)
        const error = el('p', 'new-customer-error', invalid.code === 'NINE_DIGITS_REQUIRED' ? 'Bruk ni sifre, eventuelt med mellomrom.' : 'Navn må fylles ut.'); error.id = `${id}-error`; wrapper.append(error)
      }
      input.addEventListener('input', () => {
        if (state.submission.status !== 'editing') return
        state = section === 'company' ? model.updateCompany(state, { [key]: input.value }) : model.updateContact(state, { [key]: input.value })
      })
      wrapper.append(caption, input); grid.append(wrapper)
    }
    body.append(grid)
  }
  function services() {
    for (const [title, values] of serviceGroups) {
      const group = el('fieldset', 'new-customer-services'); group.append(el('legend', '', title))
      for (const value of values) {
        const label = el('label', 'new-customer-service'), input = el('input')
        input.type = 'checkbox'; input.value = value; input.checked = state.services.includes(value)
        input.addEventListener('change', () => {
          if (state.submission.status !== 'editing') return
          state = model.setServices(state, input.checked ? [...state.services, value] : state.services.filter(item => item !== value))
          empty.textContent = state.services.length ? `${state.services.length} tjenester valgt` : 'Ingen tjenester valgt. Du kan legge til tjenester senere.'
        })
        label.append(input, el('span', '', labels[value])); group.append(label)
      }
      body.append(group)
    }
    const empty = el('p', '', state.services.length ? `${state.services.length} tjenester valgt` : 'Ingen tjenester valgt. Du kan legge til tjenester senere.')
    empty.setAttribute('aria-live','polite'); body.append(empty)
  }
  function select(label, id, values, value, change, disabled = false) {
    const wrapper = el('div', 'new-customer-field'), caption = el('label', '', label), node = el('select')
    caption.htmlFor = id; node.id = id; node.disabled = disabled
    for (const [key, text] of values) { const option = el('option','',text); option.value = key; node.append(option) }
    node.value = value
    node.addEventListener('change', () => { if (state.submission.status === 'editing') change(node.value) })
    wrapper.append(caption,node); body.append(wrapper)
  }
  function internal() {
    body.append(el('p','','Internt Wreach-oppsett. Ingen innlogging, invitasjon eller nettside opprettes.'))
    select('Kundestatus','nc-lifecycle',Object.entries(lifecycleLabels),state.internal.lifecycleStatus,value => { state = model.setLifecycle(state,value) })
    const text = assigneeStatus === 'loading' ? 'Laster ansvarlige …' : assigneeStatus === 'error' ? 'Kunne ikke hente ansvarlige. Du kan velge Ikke tildelt eller prøve igjen.' : assignees.length ? 'Velg ansvarlige, eller la feltene stå uten tildeling.' : 'Ingen tilgjengelige ansvarlige. Ikke tildelt er gyldig.'
    body.append(el('p','',text))
    if (assigneeStatus === 'error') button('Hent ansvarlige på nytt',loadAssignees,body)
    for (const responsibility of model.relevantResponsibilities(state.services)) {
      select(responsibility === 'seo' ? 'SEO-ansvarlig' : labels[responsibility], `nc-assignment-${responsibility}`,
        [['','Ikke tildelt'], ...assignees.map(person => [person.userId, person.displayName])], state.internal.assignments[responsibility] || '', value => {
          if (value && !assignees.some(person => person.userId === value)) return
          state = model.setAssignment(state,responsibility,value)
        }, assigneeStatus === 'loading')
    }
  }
  function review() {
    function section(title, step, lines) {
      const card = el('section','new-customer-review'); card.append(el('h3','',title))
      for (const line of lines) card.append(el('p','',line))
      button(`Rediger ${title}`,() => changeStep(step),card); body.append(card)
    }
    section('Bedrift',1,companyFields.map(([key,label]) => `${label}: ${state.company[key].trim() || 'Ikke registrert'}`))
    section('Kontaktperson',2,contactFields.map(([key,label]) => `${label}: ${state.contact[key].trim() || 'Ikke registrert'}`))
    section('Tjenester',3,[state.services.map(value => labels[value]).join(', ') || 'Ingen tjenester valgt'])
    section('Wreach-oppsett',4,[`Kundestatus: ${lifecycleLabels[state.internal.lifecycleStatus]}`, ...model.relevantResponsibilities(state.services).map(value => `${labels[value]}: ${assignees.find(person => person.userId === state.internal.assignments[value])?.displayName || 'Ikke tildelt'}`)])
  }
  async function openCreated() {
    if (!alive || busy || state.submission.status !== 'completed') return
    busy = true; refreshStatus = 'loading'; render()
    let loaded = false
    try { loaded = await refreshCustomer(state.submission.companyId) } catch { /* Safe post-success state below. */ }
    if (!alive) return
    busy = false; refreshStatus = loaded ? 'ready' : 'error'; render()
    if (loaded) navigate(customerHref(state.submission.companyId))
  }
  function applyResult(result, attempt) {
    if (!alive || !resultMatchesAttempt(result, state.submission) || state.submission !== attempt) return false
    state = model.recordOutcome(state,result); feedback = ''
    if (state.submission.status === 'completed') window.removeEventListener('beforeunload',beforeUnload)
    return true
  }
  async function send(retry = false) {
    if (!alive || busy || (!retry && (state.step !== 5 || state.submission.status !== 'editing'))) return
    if (retry && !['failed','uncertain'].includes(state.submission.status)) return
    try { state = retry ? model.retrySubmission(state) : model.prepareSubmission(state) }
    catch { feedback = 'Kontroller opplysningene før du fortsetter.'; render(); return }
    const attempt = state.submission; busy = true; render()
    let result
    try { result = await api.createCompany(attempt) }
    catch { result = { attempt, idempotencyKey: attempt.idempotencyKey, status:'uncertain', errorCode:'OPERATION_FAILED' } }
    if (!applyResult(result,attempt)) return
    busy = false; render(true)
    if (state.submission.status === 'completed') void openCreated()
  }
  async function checkStatus() {
    if (!alive || busy || state.submission.status !== 'uncertain') return
    const attempt = state.submission; busy = true; feedback = 'Kontrollerer forrige forsøk …'; render()
    let result
    try { result = await api.getCreationStatus(attempt) } catch { result = null }
    if (!alive || state.submission !== attempt) return
    busy = false
    if (resultMatchesAttempt(result,attempt) && ['completed','failed'].includes(result.status)) {
      applyResult(result,attempt); feedback = ''; render(true)
      if (state.submission.status === 'completed') void openCreated()
    } else { feedback = 'Resultatet er fortsatt uavklart. Behold samme forespørsel; ikke start en ny opprettelse.'; render() }
  }
  function render(focus = false) {
    if (!alive) return
    const status = state.submission.status
    element.dataset.status = status; element.setAttribute('aria-busy',String(busy))
    body.replaceChildren(); actions.replaceChildren(); notice.textContent = feedback
    const heading = el('h2','',status === 'editing' ? steps[state.step - 1] : 'Opprett kunde'); heading.tabIndex = -1
    body.append(heading)
    if (status === 'editing') {
      const indicator = el('ol','new-customer-steps')
      steps.forEach((title,index) => { const item = el('li','',`${index + 1}. ${title}${index + 1 < state.step ? ' ✓' : ''}`); if (index + 1 === state.step) item.setAttribute('aria-current','step'); indicator.append(item) })
      body.append(indicator)
      if (state.step === 1) textInputs('company',companyFields)
      if (state.step === 2) { body.append(el('p','','Valgfri primærkontakt for kommunikasjon med Wreach. Dette oppretter ikke en Wreach-innlogging og sender ingen invitasjon.')); textInputs('contact',contactFields) }
      if (state.step === 3) services()
      if (state.step === 4) internal()
      if (state.step === 5) review()
      button('Avbryt',() => navigate('#customers'))
      if (state.step > 1) button('Tilbake',() => changeStep(state.step - 1))
      if (state.step < 5) button('Neste',next)
      else button('Opprett kunde',() => void send()).className = 'btn btn-primary'
    } else if (status === 'submitting') { notice.textContent = 'Oppretter kunde…'; const wait = button('Oppretter kunde…',() => {}); wait.disabled = true }
    else if (status === 'completed') {
      notice.textContent = refreshStatus === 'error' ? 'Kunden er opprettet, men kundedata kunne ikke lastes ennå.' : 'Kunde opprettet ✓ Åpner kunden…'
      if (refreshStatus === 'error') button('Hent kundedata på nytt',openCreated)
    } else if (status === 'uncertain') {
      const authBlocked = ['UNAUTHENTICATED','MFA_REQUIRED','NOT_AUTHORIZED','PROFILE_INACTIVE'].includes(state.submission.errorCode)
      notice.textContent = authBlocked
        ? 'Innlogging eller tilgang må bekreftes på nytt, men utfallet av den tidligere kundeopprettelsen er fortsatt uavklart.'
        : feedback || `Resultatet kunne ikke bekreftes. ${messages[state.submission.errorCode] || 'Kontroller status eller prøv samme forespørsel igjen.'}`
      body.append(el('p','','Ikke start en ny opprettelse før det tidligere forsøket er avklart. Innlogging på nytt, lasting av siden på nytt eller lukking av fanen mister forsøket som bare ligger i minnet. Det finnes ingen fortsett-etter-innlogging-flyt her; få administrativ hjelp til å avklare forsøket før en ny opprettelse.'))
      button('Kontroller status',checkStatus).disabled = busy
      if (!authBlocked && state.submission.errorCode !== 'IDEMPOTENCY_CONFLICT') button('Prøv samme forespørsel igjen',() => void send(true)).disabled = busy
    } else {
      notice.textContent = messages[state.submission.errorCode] || 'Opprettelsen ble avvist. Kontroller opplysningene og prøv igjen.'
      button('Rediger opplysninger',() => { state = model.resumeEditing(state); changeStep(1) })
      button('Avbryt',() => navigate('#customers'))
    }
    if (focus) heading.focus()
  }
  render()
  return { element, canLeave, destroy() { alive = false; window.removeEventListener('beforeunload',beforeUnload); element.replaceChildren() } }
}
