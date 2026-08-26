import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2'

export type SecurityContext = { user: User; userClient: SupabaseClient; adminClient: SupabaseClient }

function env(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing server environment variable: ${name}`)
  return value
}

export function correlationId(value: unknown): string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value : crypto.randomUUID()
}

export async function requireAal2(req: Request): Promise<SecurityContext> {
  const authorization = req.headers.get('Authorization') ?? ''
  if (!authorization.startsWith('Bearer ')) throw new Response('Unauthorized', { status: 401 })
  const url = env('SUPABASE_URL')
  const publishable = Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? env('SUPABASE_ANON_KEY')
  const secret = Deno.env.get('SUPABASE_SECRET_KEY') ?? env('SUPABASE_SERVICE_ROLE_KEY')
  const userClient = createClient(url, publishable, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } })
  const { data: { user }, error } = await userClient.auth.getUser()
  if (error || !user) throw new Response('Unauthorized', { status: 401 })
  const { data: assurance, error: assuranceError } = await userClient.auth.mfa.getAuthenticatorAssuranceLevel()
  if (assuranceError || assurance.currentLevel !== 'aal2') throw new Response('MFA required', { status: 403 })
  const adminClient = createClient(url, secret, { auth: { persistSession: false } })
  return { user, userClient, adminClient }
}

export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function bodyObject(req: Request): Promise<Record<string, unknown>> {
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Response('Invalid JSON body', { status: 400 })
  return body as Record<string, unknown>
}

export function text(value: unknown, max = 256): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > max) throw new Response('Invalid input', { status: 400 })
  return value
}

