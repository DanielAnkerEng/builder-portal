// P3 PLAN ONLY: no transport, credentials, deployment or database capability.
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const target = 'https://oqwpfnmqeriupujpssxz.supabase.co'
const path = '/functions/v1/admin-create-company'
const origin = 'https://wreach.no'
const headers = ['authorization', 'apikey', 'content-type', 'idempotency-key', 'x-client-info']
const inspect = ['status', 'access-control-allow-origin', 'access-control-allow-methods',
  'access-control-allow-headers', 'vary', 'cache-control', 'content-type', 'safe revision/request identifiers']

export function createPlan(options = {}) {
  if (!options || typeof options !== 'object' || Reflect.ownKeys(options).length)
    throw new Error('PLAN_ONLY_NO_OVERRIDES')
  const cases = [
    ['allowed-preflight', 'A', path, 'OPTIONS', origin, 'none', '204; exact ACAO; POST, OPTIONS; five approved headers'],
    ['denied-preflight', 'A', path, 'OPTIONS', 'https://canary.invalid', 'none', '403; no ACAO'],
    ['unsupported-method', 'A', path, 'GET', origin, 'none', '405 METHOD_NOT_ALLOWED, or upstream 401; never success'],
    ['missing-jwt', 'A', path, 'POST', origin, 'none', '401; never RPC'],
    ['invalid-jwt', 'A', path, 'POST', origin, 'invalid-placeholder-only', '401 at gateway; never handler'],
    ['authorized-missing-key', 'B', path, 'POST', origin, 'future-real-AAL2-active-admin', '400 INVALID_REQUEST; no operationId; never body read or RPC'],
    ['retired-invalid-jwt', 'A-after-tombstone-verification', '/functions/v1/admin-provision-company', 'POST', origin, 'invalid-placeholder-only', '401 at gateway'],
    ['retired-authorized', 'B-after-tombstone-verification', '/functions/v1/admin-provision-company', 'POST', origin, 'future-real-AAL2-active-admin', '410 LEGACY_PROVISIONING_RETIRED; no writes/email'],
  ].map(([id, level, route, method, requestOrigin, authRequirement, expected]) => ({
    id, level, route, method, origin: requestOrigin, authRequirement, expected,
    body: null, idempotencyKey: null,
    ...(method === 'OPTIONS' ? { requestedMethod: 'POST', requestedHeaders: [...headers] } : {}),
    inspect: [...inspect],
  }))
  return { mode: 'PLAN_ONLY', executionEnabled: false, target, cases,
    responsePolicy: { allowedOrigin: origin, methods: ['POST', 'OPTIONS'], headers: [...headers],
      varyIncludes: 'Origin', cacheControl: 'no-store', contentType: 'application/json; OPTIONS 204 has no body',
      gatewayDifference: 'Record separately; missing required headers blocks cutover, not an automatic exception.' } }
}

export function validateLocalContract(config, source, retired) {
  for (const name of ['admin-create-company', 'admin-provision-company']) {
    const section = config.split(`[functions.${name}]`)[1]?.split(/\n\[/)[0]
    if (!section || !/^enabled = true$/m.test(section) || !/^verify_jwt = true$/m.test(section))
      throw new Error('JWT_CONFIG_REVIEW_REQUIRED')
  }
  const markers = ["requireAal2(req, { platformAdmin: true })", "if (!key || !uuid.test(key)) return fail('INVALID_REQUEST', 400)",
    'const payload = await readPayload(req)', "context.userClient.rpc('security_v2_create_company'"]
  const positions = markers.map(marker => source.indexOf(marker))
  if (positions.some((p, i) => p < 0 || (i > 0 && p <= positions[i - 1])))
    throw new Error('PRE_RPC_ORDER_REVIEW_REQUIRED')
  for (const marker of ["'Cache-Control': 'no-store', Vary: 'Origin'", "'Access-Control-Allow-Origin', origin",
    "'Access-Control-Allow-Methods', 'POST, OPTIONS'", "return fail('NOT_AUTHORIZED', 403)",
    "return new Response(null, { status: 204, headers })", ...headers.map(h => `'${h}'`)])
    if (!source.includes(marker)) throw new Error('HTTP_CONTRACT_REVIEW_REQUIRED')
  if (!retired.includes("return fail('LEGACY_PROVISIONING_RETIRED', 410)") ||
      /\bimport\b|fetch\s*\(|\.rpc\s*\(|\.insert\s*\(|\.update\s*\(|\.delete\s*\(|req\.(json|text|body)/.test(retired))
    throw new Error('TOMBSTONE_REVIEW_REQUIRED')
  // Source-shape checks are drift alarms, not a hosted attestation or formal proof.
  return true
}

export async function main(args = []) {
  if (args.length) throw new Error('PLAN_ONLY_NO_ARGUMENTS')
  const root = new URL('../', import.meta.url)
  const sources = await Promise.all(['supabase/config.toml', 'supabase/functions/admin-create-company/index.ts',
    'supabase/functions/admin-provision-company/index.ts'].map(file => readFile(new URL(file, root), 'utf8')))
  validateLocalContract(...sources)
  return JSON.stringify(createPlan(), null, 2) + '\n'
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { process.stdout.write(await main(process.argv.slice(2))) }
  catch { process.stderr.write('P3 plan refused: arguments or local contract require review. No requests sent.\n'); process.exitCode = 1 }
}
