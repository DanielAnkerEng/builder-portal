// Pure, memory-only wizard model. This is UX state, never authorization.
export const SERVICES = Object.freeze(['website', 'website_management', 'seo', 'local_seo',
  'google_ads', 'meta_ads', 'linkedin_ads', 'tiktok_ads', 'social_media', 'content', 'analytics'])
export const LIFECYCLES = Object.freeze(['onboarding', 'active', 'paused', 'ended'])
export const RESPONSIBILITIES = Object.freeze(['account', 'seo', 'marketing', 'content'])
export const STEPS = Object.freeze([1, 2, 3, 4, 5])
const companyFields = ['name', 'organizationNumber', 'externalWebsiteUrl', 'contactEmail', 'contactPhone', 'address']
const contactFields = ['name', 'email', 'phone', 'title']
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const terminalCodes = new Set(['INVALID_REQUEST', 'INVALID_IDEMPOTENCY_KEY', 'INVALID_PAYLOAD',
  'INVALID_ORGANIZATION_NUMBER', 'INVALID_URL', 'INVALID_EMAIL', 'INVALID_PHONE', 'INVALID_ADDRESS',
  'INVALID_CONTACT', 'INVALID_SERVICE', 'DUPLICATE_SERVICE', 'INVALID_LIFECYCLE', 'INVALID_ASSIGNMENT',
  'DUPLICATE_ASSIGNMENT', 'INVALID_ASSIGNEE', 'ORGANIZATION_NUMBER_EXISTS', 'UNAUTHENTICATED',
  'MFA_REQUIRED', 'NOT_AUTHORIZED', 'PROFILE_INACTIVE', 'PAYLOAD_TOO_LARGE', 'UNSUPPORTED_MEDIA_TYPE', 'METHOD_NOT_ALLOWED'])
const uncertainCodes = new Set(['RETRY_SAME_REQUEST', 'TRANSPORT_ERROR', 'OPERATION_FAILED', 'IDEMPOTENCY_CONFLICT'])

function frozen(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const item of Object.values(value)) frozen(item)
    Object.freeze(value)
  }
  return value
}
function fail(code) { throw new Error(code) }
function editable(state) { if (state.submission.status !== 'editing') fail('EDITING_REQUIRED') }
function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value) }
function textFields(value, fields) {
  return object(value) && Object.keys(value).every(key => fields.includes(key)) &&
    fields.every(key => Object.hasOwn(value, key) && typeof value[key] === 'string')
}
const optional = value => value.trim() || null
// Remove display spaces only; no checksum/business normalization in this layer.
const organizationDigits = value => value.replace(/[ \u00a0\u202f]/g, '').trim()
const blank = fields => Object.fromEntries(fields.map(key => [key, '']))

export function createWizardState() {
  return frozen({ step: 1, company: blank(companyFields), contact: blank(contactFields), services: [],
    internal: { lifecycleStatus: 'onboarding', assignments: {} },
    submission: { status: 'editing', payload: null, idempotencyKey: null, operationId: null, companyId: null, errorCode: null } })
}
export function setStep(state, step) {
  editable(state)
  if (!STEPS.includes(step)) fail('INVALID_STEP')
  return frozen({ ...state, step })
}
function updateText(state, section, patch, fields) {
  editable(state)
  if (!object(patch) || Object.keys(patch).some(key => !fields.includes(key) || typeof patch[key] !== 'string')) fail('INVALID_FIELDS')
  return frozen({ ...state, [section]: { ...state[section], ...patch } })
}
export const updateCompany = (state, patch) => updateText(state, 'company', patch, companyFields)
export const updateContact = (state, patch) => updateText(state, 'contact', patch, contactFields)

export function relevantResponsibilities(services) {
  if (!Array.isArray(services) || services.some(value => !SERVICES.includes(value)) || new Set(services).size !== services.length)
    fail('INVALID_SERVICES')
  return RESPONSIBILITIES.filter(value => value === 'account' ||
    (value === 'seo' && services.some(s => ['seo', 'local_seo'].includes(s))) ||
    (value === 'marketing' && services.some(s => ['google_ads', 'meta_ads', 'linkedin_ads', 'tiktok_ads'].includes(s))) ||
    (value === 'content' && services.some(s => ['social_media', 'content'].includes(s))))
}
export function setServices(state, services) {
  editable(state)
  const relevant = relevantResponsibilities(services)
  return frozen({ ...state, services: SERVICES.filter(value => services.includes(value)),
    internal: { ...state.internal, assignments: Object.fromEntries(Object.entries(state.internal.assignments)
      .filter(([key]) => relevant.includes(key))) } })
}
export function setLifecycle(state, lifecycleStatus) {
  editable(state)
  if (!LIFECYCLES.includes(lifecycleStatus)) fail('INVALID_LIFECYCLE')
  return frozen({ ...state, internal: { ...state.internal, lifecycleStatus } })
}
export function setAssignment(state, responsibilityType, assigneeUserId) {
  editable(state)
  if (!RESPONSIBILITIES.includes(responsibilityType)) fail('INVALID_RESPONSIBILITY')
  if (!relevantResponsibilities(state.services).includes(responsibilityType)) fail('IRRELEVANT_ASSIGNMENT')
  const assignments = { ...state.internal.assignments }
  if (assigneeUserId === null || assigneeUserId === '') delete assignments[responsibilityType]
  else {
    if (typeof assigneeUserId !== 'string' || !uuid.test(assigneeUserId)) fail('INVALID_ASSIGNEE_ID')
    assignments[responsibilityType] = assigneeUserId
  }
  return frozen({ ...state, internal: { ...state.internal, assignments } })
}

export function validateStep(state, step = state?.step) {
  if (!STEPS.includes(step)) return [{ field: 'step', code: 'INVALID_STEP' }]
  if (step === 5) return [1, 2, 3, 4].flatMap(value => validateStep(state, value))
  const errors = [], add = (field, code) => errors.push({ field, code })
  if (step === 1) {
    if (!textFields(state?.company, companyFields)) add('company', 'INVALID_FIELDS')
    else {
      if (!state.company.name.trim()) add('company.name', 'REQUIRED')
      const org = organizationDigits(state.company.organizationNumber)
      if (org && !/^[0-9]{9}$/.test(org)) add('company.organizationNumber', 'NINE_DIGITS_REQUIRED')
    }
  }
  if (step === 2) {
    if (!textFields(state?.contact, contactFields)) add('contact', 'INVALID_FIELDS')
    else if (Object.values(state.contact).some(value => value.trim()) && !state.contact.name.trim()) add('contact.name', 'REQUIRED')
  }
  if (step === 3 || step === 4) {
    let relevant
    try { relevant = relevantResponsibilities(state?.services) } catch { add('services', 'INVALID_SERVICES') }
    if (step === 4) {
      const cfg = state?.internal
      if (!object(cfg) || Object.keys(cfg).some(key => !['lifecycleStatus', 'assignments'].includes(key))) add('internal', 'INVALID_FIELDS')
      if (!LIFECYCLES.includes(cfg?.lifecycleStatus)) add('internal.lifecycleStatus', 'INVALID_LIFECYCLE')
      if (!object(cfg?.assignments)) add('internal.assignments', 'INVALID_ASSIGNMENTS')
      else for (const [key, value] of Object.entries(cfg.assignments)) {
        if (!RESPONSIBILITIES.includes(key)) add('internal.assignments', 'INVALID_RESPONSIBILITY')
        else if (relevant?.includes(key) && value !== null && value !== '' && (typeof value !== 'string' || !uuid.test(value)))
          add(`internal.assignments.${key}`, 'INVALID_ASSIGNEE_ID')
      }
    }
  }
  return errors
}

export function buildPayload(state) {
  if (validateStep(state, 5).length) fail('INVALID_WIZARD')
  const relevant = relevantResponsibilities(state.services)
  return frozen({ schemaVersion: 1,
    company: { name: state.company.name.trim(), organizationNumber: organizationDigits(state.company.organizationNumber) || null,
      externalWebsiteUrl: optional(state.company.externalWebsiteUrl), contactEmail: optional(state.company.contactEmail),
      contactPhone: optional(state.company.contactPhone), address: optional(state.company.address) },
    contact: Object.values(state.contact).some(value => value.trim()) ? {
      name: state.contact.name.trim(), email: optional(state.contact.email), phone: optional(state.contact.phone), title: optional(state.contact.title),
    } : null,
    services: SERVICES.filter(value => state.services.includes(value)),
    internal: { lifecycleStatus: state.internal.lifecycleStatus, assignments: relevant
      .filter(key => state.internal.assignments[key] !== undefined && state.internal.assignments[key] !== null && state.internal.assignments[key] !== '')
      .map(key => ({ responsibilityType: key, assigneeUserId: state.internal.assignments[key] })) } })
}

// Caller must synchronously retain the returned state before starting I/O.
// Pure transitions cannot lock a stale copy or coordinate separate tabs.
export function prepareSubmission(state, randomUUID = () => globalThis.crypto.randomUUID()) {
  editable(state)
  if (state.step !== 5) fail('CONFIRMATION_REQUIRED')
  const payload = buildPayload(state), previous = state.submission
  const same = previous.payload !== null && JSON.stringify(previous.payload) === JSON.stringify(payload)
  const key = same ? previous.idempotencyKey : randomUUID()
  if (typeof key !== 'string' || !uuidV4.test(key)) fail('INVALID_IDEMPOTENCY_KEY')
  if (!same && key === previous.idempotencyKey) fail('IDEMPOTENCY_KEY_REUSE')
  return frozen({ ...state, submission: { status: 'submitting', payload: same ? previous.payload : payload,
    idempotencyKey: key, operationId: same ? previous.operationId : null, companyId: null, errorCode: null } })
}
export function recordOutcome(state, outcome) {
  if (!['submitting', 'uncertain'].includes(state.submission.status)) fail('NO_ACTIVE_ATTEMPT')
  if (!object(outcome)) fail('INVALID_OUTCOME')
  if (outcome.status === 'completed') {
    if (typeof outcome.operationId !== 'string' || typeof outcome.companyId !== 'string' ||
      !uuidV4.test(outcome.operationId) || !uuidV4.test(outcome.companyId)) fail('INVALID_RESULT_IDS')
    return frozen({ ...state, submission: { ...state.submission, status: 'completed', operationId: outcome.operationId,
      companyId: outcome.companyId, errorCode: null } })
  }
  const code = outcome.errorCode
  if (outcome.status === 'failed' && !terminalCodes.has(code)) fail('UNCONFIRMED_TERMINAL_FAILURE')
  if (outcome.status === 'uncertain' && !uncertainCodes.has(code)) fail('INVALID_UNCERTAIN_REASON')
  if (!['failed', 'uncertain'].includes(outcome.status)) fail('INVALID_OUTCOME')
  if (outcome.operationId != null && (typeof outcome.operationId !== 'string' || !uuidV4.test(outcome.operationId))) fail('INVALID_RESULT_IDS')
  return frozen({ ...state, submission: { ...state.submission, status: outcome.status, errorCode: code,
    operationId: outcome.operationId ?? state.submission.operationId } })
}
export function retrySubmission(state) {
  const attempt = state.submission
  if (!['failed', 'uncertain'].includes(attempt.status) || !attempt.payload || !uuidV4.test(attempt.idempotencyKey)) fail('RETRY_NOT_AVAILABLE')
  if (attempt.errorCode === 'IDEMPOTENCY_CONFLICT') fail('RECONCILIATION_REQUIRED')
  return frozen({ ...state, submission: { ...attempt, status: 'submitting', errorCode: null } })
}
export function resumeEditing(state) {
  if (state.submission.status !== 'failed') fail('CONFIRMED_FAILURE_REQUIRED')
  return frozen({ ...state, submission: { ...state.submission, status: 'editing' } })
}
export function navigationState(state) {
  const initial = createWizardState()
  const dirty = ['company', 'contact', 'services', 'internal'].some(key => JSON.stringify(state[key]) !== JSON.stringify(initial[key]))
  const status = state.submission.status
  return frozen({ pristine: !dirty && state.submission.payload === null, dirty,
    submitting: status === 'submitting', uncertain: status === 'uncertain', completed: status === 'completed',
    shouldWarnOnLeave: status === 'submitting' || status === 'uncertain' || (dirty && status !== 'completed') })
}
