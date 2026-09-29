// LOCAL disposable browser fixture only. Never import this module into the app.
import { execFileSync } from 'node:child_process'
import { randomUUID, randomBytes } from 'node:crypto'
import { homedir, tmpdir } from 'node:os'
import { mkdirSync, writeFileSync, readFileSync, lstatSync, realpathSync, unlinkSync, rmdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { LOCAL_SUPABASE_CONFIG } from '../../js/supabase.local.js'

const base = 'http://127.0.0.1:54321'
const container = 'supabase_db_webbyra-demo-github'
const directory = join(realpathSync(tmpdir()), 'wreach-d4-browser-fixture-' + process.getuid())
const manifestPath = join(directory, 'manifest.json')
const credentialsPath = join(directory, 'credentials.txt')
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const quote = v => "'" + String(v).replaceAll("'", "''") + "'"
let stage = 'arguments / local opt-in'
function ensure(condition) { if (!condition) throw new Error('Fixture safety check failed') }
function docker(args, input) {
  return execFileSync('docker', ['--host', 'unix://' + homedir() + '/.docker/run/docker.sock', ...args],
    { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 15000 }).trim()
}
function sql(statement) {
  return docker(['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-qAt', '-v', 'ON_ERROR_STOP=1'], statement)
}
function privatePath(path, isDirectory = false) {
  const s = lstatSync(path)
  ensure(!s.isSymbolicLink() && s.uid === process.getuid() && (s.mode & 0o077) === 0)
  ensure(isDirectory ? s.isDirectory() : s.isFile() && s.nlink === 1)
}
function saveManifest(m) {
  writeFileSync(manifestPath, JSON.stringify(m), { mode: 0o600 })
}
const tables = ['public.companies', 'public.company_contacts', 'public.company_services',
  'public.company_internal_settings', 'public.company_assignments', 'private.provisioning_operations',
  'public.audit_events', 'public.company_memberships', 'public.websites', 'public.website_drafts',
  'public.website_publications', 'public.user_security_credentials', 'public.company_security']
function counts() { return sql('select ' + tables.map(t => '(select count(*) from ' + t + ')').join(',') + ';') }
async function guard() {
  stage = 'local environment and MFA cascade verification'
  ensure(LOCAL_SUPABASE_CONFIG.url === base)
  ensure(docker(['inspect', '--format', '{{.Name}} {{.State.Running}}', container]) === '/' + container + ' true')
  ensure(sql("select count(*) from pg_constraint where conrelid='auth.mfa_factors'::regclass and confrelid='auth.users'::regclass and contype='f' and confdeltype='c';") === '1')
  const r = await fetch(base + '/auth/v1/health', { redirect: 'error', signal: AbortSignal.timeout(5000),
    headers: { apikey: LOCAL_SUPABASE_CONFIG.key } })
  ensure(r.ok)
}
function cleanup() {
  stage = 'manifest validation'
  if (!existsSync(directory)) { console.info('No local fixture manifest remains.'); return }
  privatePath(directory, true); privatePath(manifestPath)
  if (existsSync(credentialsPath)) privatePath(credentialsPath)
  const m = JSON.parse(readFileSync(manifestPath, 'utf8'))
  ensure(m.version === 1 && uuid.test(m.runId) && m.email === 'd4-' + m.runId + '@test.invalid')
  ensure(Number.isFinite(Date.parse(m.createdAt)) && (m.userId === null || uuid.test(m.userId)))
  // Also recover a signup that succeeded before its HTTP response reached this process.
  const found = sql('select id from auth.users where email=' + quote(m.email) + ';')
  ensure(!found || uuid.test(found))
  ensure(!found || m.userId === null || found === m.userId)
  const user = m.userId || found
  if (user) {
    stage = 'transactional ownership validation and cleanup (manifest retained on failure)'
    const u = quote(user)
    const owned = 'select company_id from d4_owned'
    sql(`begin;
      lock table auth.users, public.profiles, public.platform_admins, public.companies,
        private.provisioning_operations, public.audit_events, public.company_contacts,
        public.company_services, public.company_internal_settings, public.company_assignments,
        public.company_memberships, public.websites, public.user_security_credentials, public.company_security
        in share row exclusive mode;
      create temporary table d4_owned on commit drop as
        select company_id from private.provisioning_operations where actor_user_id=${u} and company_id is not null;
      do $fixture$ begin
        if exists(select 1 from auth.users where id=${u} and (email<>${quote(m.email)} or created_at<${quote(m.createdAt)}::timestamptz - interval '5 seconds'))
          or exists(select 1 from public.profiles where id=${u} and (display_name<>${quote('Local D4 ' + m.runId)} or company_id is not null))
          or exists(select 1 from private.provisioning_operations where actor_user_id=${u} and (operation_type<>'company.create.v1' or status='pending'))
          or exists(select 1 from private.provisioning_operations where company_id in(${owned}) and actor_user_id<>${u})
          or exists(select 1 from public.company_memberships where user_id=${u} or company_id in(${owned}))
          or exists(select 1 from public.profiles where company_id in(${owned}))
          or exists(select 1 from public.websites where created_by=${u} or company_id in(${owned}))
          or exists(select 1 from public.user_security_credentials where user_id=${u})
          or exists(select 1 from public.company_security where company_id in(${owned}))
          or exists(select 1 from public.company_services where company_id in(${owned}) and created_by<>${u})
          or exists(select 1 from public.company_internal_settings where company_id in(${owned}) and updated_by<>${u})
          or exists(select 1 from public.company_assignments where company_id in(${owned}) and assigned_by<>${u})
          or exists(select 1 from public.audit_events where company_id in(${owned}) and actor_user_id is distinct from ${u}::uuid)
        then raise exception 'Fixture ownership requires manual review'; end if;
      end $fixture$;
      delete from public.audit_events where actor_user_id=${u};
      ${['company_assignments','company_contacts','company_services','company_internal_settings'].map(t => 'delete from public.' + t + ' where company_id in(' + owned + ');').join('\n')}
      delete from private.provisioning_operations where actor_user_id=${u};
      delete from public.companies where id in(${owned});
      delete from public.platform_admins where user_id=${u};
      delete from public.profiles where id=${u};
      delete from auth.users where id=${u};
      do $fixture$ begin
        if exists(select 1 from auth.users where id=${u}) or exists(select 1 from auth.mfa_factors where user_id=${u})
          or exists(select 1 from private.provisioning_operations where actor_user_id=${u})
          or exists(select 1 from public.companies where id in(${owned}))
          or exists(select 1 from public.profiles where id=${u}) or exists(select 1 from public.platform_admins where user_id=${u})
        then raise exception 'Fixture cleanup verification failed'; end if;
      end $fixture$; commit;`)
  }
  stage = 'remove ephemeral handoff after verified database cleanup'
  if (existsSync(credentialsPath)) unlinkSync(credentialsPath)
  unlinkSync(manifestPath); rmdirSync(directory)
  console.info('PASS: exact local fixture cleanup; Auth/profile/admin/operations/company packages/MFA absent.')
}
async function setup() {
  stage = 'exclusive private fixture directory (existing fixture must be cleaned first)'
  mkdirSync(directory, { mode: 0o700 })
  const m = { version: 1, runId: randomUUID(), userId: null, email: '', createdAt: new Date().toISOString() }
  m.email = 'd4-' + m.runId + '@test.invalid'
  saveManifest(m)
  try {
    const before = counts()
    stage = 'local signup'
    const password = 'D4!a9-' + randomBytes(32).toString('base64url')
    writeFileSync(credentialsPath, 'LOCAL DISPOSABLE D4 ONLY\nEmail: ' + m.email + '\nPassword: ' + password + '\n', { flag: 'wx', mode: 0o600 })
    const response = await fetch(base + '/auth/v1/signup', { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { apikey: LOCAL_SUPABASE_CONFIG.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: m.email, password }) })
    ensure(response.ok)
    const result = await response.json()
    m.userId = result.user?.id
    ensure(uuid.test(m.userId)); saveManifest(m)
    stage = 'prove Auth/DB identity match before granting local fixture admin'
    ensure(sql('select count(*) from auth.users where id=' + quote(m.userId) + ' and email=' + quote(m.email) + ';') === '1')
    sql('begin; insert into public.profiles(id,display_name,status) values(' + quote(m.userId) + ',' + quote('Local D4 ' + m.runId) + ",'active');" +
      'insert into public.platform_admins(user_id,admin_role) values(' + quote(m.userId) + ",'admin');commit;")
    stage = 'verify setup and zero business side effects'
    ensure(sql('select count(*) from public.profiles p join public.platform_admins a on a.user_id=p.id where p.id=' + quote(m.userId) + " and p.status='active' and a.admin_role='admin' and a.is_active;") === '1')
    ensure(counts() === before)
    ensure(sql('select count(*) from auth.mfa_factors where user_id=' + quote(m.userId)) === '0')
    console.info('PASS: local Auth/profile/admin ready; 13 business/security table counts unchanged; no MFA enrollment.')
    console.info('Private handoff: ' + credentialsPath)
    console.info('Private manifest: ' + manifestPath)
  } catch {
    const failed = stage
    try { cleanup() } catch { console.error('Cleanup incomplete at: ' + stage + '. Private manifest retained: ' + manifestPath) }
    stage = failed
    throw new Error('Setup failed')
  }
}
try {
  ensure(process.env.WREACH_D4_BROWSER_TEST === '1' && process.argv.length === 3 && ['setup', 'cleanup'].includes(process.argv[2]))
  await guard()
  if (process.argv[2] === 'setup') await setup()
  else cleanup()
} catch {
  // Never emit raw HTTP/SQL errors, request bodies or child-process diagnostics.
  console.error('D4 fixture stopped at: ' + stage)
  process.exitCode = 1
}
