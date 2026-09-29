// Transport validation only. Phase B owns semantic validation and normalization.
export const MAX_BODY_BYTES = 16384
export class RequestError extends Error {
  code: string
  status: number
  constructor(code = 'INVALID_REQUEST', status = 400) { super(code); this.code = code; this.status = status }
}

export async function readPayload(req: Request): Promise<unknown> {
  if (!/^application\/json(?:\s*;\s*charset\s*=\s*(?:utf-8|"utf-8"))?\s*$/i.test(req.headers.get('content-type') ?? ''))
    throw new RequestError('UNSUPPORTED_MEDIA_TYPE', 415)
  const length = req.headers.get('content-length')
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_BODY_BYTES))
    throw new RequestError('PAYLOAD_TOO_LARGE', 413)
  if (!req.body) throw new RequestError()
  const reader = req.body.getReader(), chunks: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_BODY_BYTES) { await reader.cancel(); throw new RequestError('PAYLOAD_TOO_LARGE', 413) }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  let raw: string
  try { raw = new TextDecoder('utf-8', { fatal: true }).decode(bytes) } catch { throw new RequestError() }
  return parseUniqueJson(raw)
}

// Bounded recursive-descent syntax walk. Decode keys before comparing, so
// "name" and "\u006eame" collide. Each object has its own key set.
// No objects are constructed until the complete duplicate-free walk succeeds.
export function parseUniqueJson(raw: string): unknown {
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) throw new RequestError('PAYLOAD_TOO_LARGE', 413)
  let i = 0
  const bad = (): never => { throw new RequestError() }
  const ws = () => { while (i < raw.length && /[\x20\t\r\n]/.test(raw[i])) i++ }
  const string = (): string => {
    const start = i++
    while (i < raw.length) {
      const c = raw[i++]
      if (c === '"') {
        try { return JSON.parse(raw.slice(start, i)) } catch { return bad() }
      }
      if (c === '\\') {
        const escape = raw[i++]
        if (escape === 'u') {
          if (!/^[0-9a-fA-F]{4}$/.test(raw.slice(i, i + 4))) bad()
          i += 4
        } else if (!escape || !'"\\/bfnrt'.includes(escape)) bad()
      } else if (c.charCodeAt(0) < 32) bad()
    }
    return bad()
  }
  const value = (depth: number): void => {
    if (depth > 32) bad()
    ws()
    if (raw[i] === '"') { string(); return }
    if (raw[i] === '{' || raw[i] === '[') {
      const object = raw[i++] === '{', end = object ? '}' : ']'
      const keys = new Set<string>()
      ws()
      if (raw[i] === end) { i++; return }
      for (;;) {
        ws()
        if (object) {
          if (raw[i] !== '"') bad()
          const key = string()
          if (keys.has(key)) bad()
          keys.add(key); ws()
          if (raw[i++] !== ':') bad()
        }
        value(depth + 1); ws()
        if (raw[i] === end) { i++; return }
        if (raw[i++] !== ',') bad()
      }
    }
    const literal = /^(?:true|false|null|-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?)/.exec(raw.slice(i))
    if (!literal) bad()
    i += literal![0].length
  }
  value(0); ws()
  if (i !== raw.length) bad()
  try { return JSON.parse(raw) } catch { return bad() }
}

function object(v: unknown, allowed: string[], required = allowed): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new RequestError()
  const o = v as Record<string, unknown>
  if (Object.keys(o).some(k => !allowed.includes(k)) || required.some(k => !Object.hasOwn(o, k))) throw new RequestError()
  return o
}
function texts(o: Record<string, unknown>) {
  if (Object.values(o).some(v => v !== null && typeof v !== 'string')) throw new RequestError()
}
export function validateStructure(payload: unknown): void {
  const p = object(payload, ['schemaVersion', 'company', 'contact', 'services', 'internal'])
  if (p.schemaVersion !== 1) throw new RequestError()
  texts(object(p.company, ['name', 'organizationNumber', 'externalWebsiteUrl', 'contactEmail', 'contactPhone', 'address'], ['name']))
  if (p.contact !== null) texts(object(p.contact, ['name', 'email', 'phone', 'title'], ['name']))
  if (!Array.isArray(p.services) || p.services.some(v => typeof v !== 'string')) throw new RequestError()
  const cfg = object(p.internal, ['lifecycleStatus', 'assignments'])
  if (typeof cfg.lifecycleStatus !== 'string' || !Array.isArray(cfg.assignments)) throw new RequestError()
  for (const item of cfg.assignments) {
    const assignment = object(item, ['responsibilityType', 'assigneeUserId'])
    if (Object.values(assignment).some(v => typeof v !== 'string')) throw new RequestError()
  }
}
