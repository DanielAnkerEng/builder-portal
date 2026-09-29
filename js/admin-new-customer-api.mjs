// Transport only. Inject Admin's existing authenticated Supabase client.
// Never infer permission here: RPC/Edge authorization remains authoritative.
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const v4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const validId = value => typeof value === 'string' && v4.test(value)
const groups = {
  validation: ['INVALID_REQUEST', 'INVALID_PAYLOAD', 'INVALID_ORGANIZATION_NUMBER', 'INVALID_URL',
    'INVALID_EMAIL', 'INVALID_PHONE', 'INVALID_ADDRESS', 'INVALID_CONTACT', 'INVALID_SERVICE',
    'DUPLICATE_SERVICE', 'INVALID_LIFECYCLE', 'INVALID_ASSIGNMENT', 'DUPLICATE_ASSIGNMENT',
    'INVALID_ASSIGNEE', 'INVALID_IDEMPOTENCY_KEY', 'PAYLOAD_TOO_LARGE', 'UNSUPPORTED_MEDIA_TYPE', 'METHOD_NOT_ALLOWED'],
  authentication: ['UNAUTHENTICATED', 'MFA_REQUIRED'],
  authorization: ['NOT_AUTHORIZED', 'PROFILE_INACTIVE'],
  conflict: ['ORGANIZATION_NUMBER_EXISTS', 'IDEMPOTENCY_CONFLICT'],
  retry_same_request: ['RETRY_SAME_REQUEST'],
  internal: ['OPERATION_FAILED'],
}
const classificationOf = code => Object.keys(groups).find(group => groups[group].includes(code))
const errorResult = (classification = 'internal', errorCode = 'OPERATION_FAILED', status = 'uncertain') =>
  ({ ok: false, status, classification, errorCode })
const freeze = result => Object.freeze(result)

function serverFailure(data) {
  if (!object(data) || data.ok !== false || !object(data.error)) return null
  const code = data.error.code, classification = classificationOf(code)
  if (!classification || (data.operationId !== undefined && !validId(data.operationId))) return null
  const uncertain = ['IDEMPOTENCY_CONFLICT', 'RETRY_SAME_REQUEST', 'OPERATION_FAILED'].includes(code)
  return { ...errorResult(classification, code, uncertain ? 'uncertain' : 'failed'),
    ...(data.operationId === undefined ? {} : { operationId: data.operationId }) }
}
function completed(data) {
  return object(data) && data.ok === true && data.status === 'completed' && validId(data.operationId) && validId(data.companyId)
    ? { ok: true, status: 'completed', operationId: data.operationId, companyId: data.companyId } : null
}
// functions-js returns FunctionsHttpError.context = the non-2xx Response.
// Read only that envelope; never copy SDK messages, bodies, stacks or DB errors.
async function httpFailure(error) {
  if (error?.name !== 'FunctionsHttpError' || !(error.context instanceof Response) || error.context.ok) return null
  try { return serverFailure(await error.context.clone().json()) } catch { return null }
}
function frozenTree(value) {
  return value === null || typeof value !== 'object' ||
    (Object.isFrozen(value) && Object.values(value).every(frozenTree))
}
function requireAttempt(attempt, creating = false) {
  if (!object(attempt) || !Object.isFrozen(attempt) || !validId(attempt.idempotencyKey) ||
    (creating && (attempt.status !== 'submitting' || !object(attempt.payload) || !frozenTree(attempt.payload))))
    throw new TypeError('INVALID_SUBMISSION_ATTEMPT')
}

// D3: retain D1's submitting state BEFORE calling createCompany(state.submission).
// Apply a result only when resultMatchesAttempt(result, currentState.submission).
// A retry creates a new submission object, so late responses from the old call
// cannot match it even though the exact same idempotency key is retained.
// NOT_FOUND/pending/read errors are NOT D1 terminal failures: retain the attempt.
// No result from this adapter authorizes changing a key automatically.
export function resultMatchesAttempt(result, attempt) {
  return object(result) && result.attempt === attempt && validId(result.idempotencyKey) &&
    result.idempotencyKey === attempt?.idempotencyKey
}

export function createNewCustomerApi(client) {
  if (typeof client?.rpc !== 'function' || typeof client?.functions?.invoke !== 'function')
    throw new TypeError('EXISTING_CLIENT_REQUIRED')
  return Object.freeze({
    async listAssignees() {
      try {
        const { data, error } = await client.rpc('security_v2_list_company_assignees')
        if (error) return freeze(errorResult('internal', 'OPERATION_FAILED', 'request_failed'))
        if (data?.error === 'NOT_AUTHORIZED') return freeze(errorResult('authorization', 'NOT_AUTHORIZED', 'request_failed'))
        if (!Array.isArray(data) || data.some(row => !object(row) || typeof row.userId !== 'string' ||
          !uuid.test(row.userId) || typeof row.displayName !== 'string') ||
          new Set(data.map(row => row.userId.toLowerCase())).size !== data.length)
          return freeze(errorResult('internal', 'OPERATION_FAILED', 'malformed'))
        return freeze({ ok: true, assignees: Object.freeze(data.map(row => freeze({ userId: row.userId, displayName: row.displayName }))) })
      } catch { return freeze(errorResult('internal', 'OPERATION_FAILED', 'request_failed')) }
    },
    async createCompany(attempt) {
      requireAttempt(attempt, true)
      const correlate = result => freeze({ ...result, attempt, idempotencyKey: attempt.idempotencyKey })
      try {
        const { data, error } = await client.functions.invoke('admin-create-company', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': attempt.idempotencyKey },
          body: attempt.payload,
        })
        if (error) {
          const known = await httpFailure(error)
          return correlate(known ?? errorResult(error.name === 'FunctionsHttpError' ? 'internal' : 'uncertain_transport'))
        }
        return correlate(completed(data) ?? serverFailure(data) ?? errorResult())
      } catch { return correlate(errorResult('uncertain_transport')) }
    },
    async getCreationStatus(attempt) {
      requireAttempt(attempt)
      const correlate = result => freeze({ ...result, attempt, idempotencyKey: attempt.idempotencyKey })
      try {
        const { data, error } = await client.rpc('security_v2_get_company_creation_status', { p_idempotency_key: attempt.idempotencyKey })
        if (error) return correlate(errorResult('internal', 'OPERATION_FAILED', 'request_failed'))
        if (data?.error === 'NOT_FOUND') return correlate({ ok: true, status: 'not_found' })
        if (data?.error === 'NOT_AUTHORIZED') return correlate(errorResult('authorization', 'NOT_AUTHORIZED', 'request_failed'))
        if (object(data) && validId(data.operationId)) {
          if (data.status === 'completed' && validId(data.companyId) && data.errorCode === null)
            return correlate({ ok: true, status: 'completed', operationId: data.operationId, companyId: data.companyId })
          if (data.status === 'pending' && data.companyId === null && data.errorCode === null)
            return correlate({ ok: true, status: 'pending', operationId: data.operationId })
          // Only these terminal package failures are persisted by Phase B.
          if (data.status === 'failed' && data.companyId === null && ['INVALID_ASSIGNEE', 'ORGANIZATION_NUMBER_EXISTS'].includes(data.errorCode))
            return correlate({ ...errorResult(classificationOf(data.errorCode), data.errorCode, 'failed'), operationId: data.operationId })
        }
        return correlate(errorResult('internal', 'OPERATION_FAILED', 'malformed'))
      } catch { return correlate(errorResult('internal', 'OPERATION_FAILED', 'request_failed')) }
    },
  })
}
