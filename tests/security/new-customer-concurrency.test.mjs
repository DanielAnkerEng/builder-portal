import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { homedir } from 'node:os'

// Opt-in: separate psql sessions in ONE fixed LOCAL Supabase container.
// Never accepts a DB URL, project-ref, password, remote Docker endpoint or production key.
const enabled = process.env.WREACH_LOCAL_DB_TESTS === '1'
const dockerArgs = ['--host', 'unix://' + homedir() + '/.docker/run/docker.sock',
  'exec', '-i', 'supabase_db_webbyra-demo-github', 'psql', '-U', 'postgres', '-d', 'postgres', '-qAt', '-v', 'ON_ERROR_STOP=1']
const literal = value => "'" + String(value).replaceAll("'", "''") + "'"
function query(sql, onOutput) {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', dockerArgs, { stdio: ['pipe', 'pipe', 'pipe'] })
    let out = '', err = ''
    const timer = setTimeout(() => { child.kill(); reject(new Error('Local SQL timed out')) }, 15000)
    child.stdout.on('data', data => { out += data; onOutput?.(out) })
    child.stderr.on('data', data => { err += data })
    child.on('error', error => { clearTimeout(timer); reject(error) })
    child.on('close', exit => {
      clearTimeout(timer)
      if (exit !== 0) reject(new Error('Local SQL failed: ' + err))
      else resolve(out.trim())
    })
    child.stdin.end(sql)
  })
}
const payload = name => ({ schemaVersion: 1, company: { name }, contact: null,
  services: [], internal: { lifecycleStatus: 'onboarding', assignments: [] } })

test('New Customer: isolated LOCAL multi-connection tests', { skip: !enabled }, async t => {
  const actor = randomUUID(), assignee = randomUUID()
  const run = async (key, body) => {
    const output = await query(
      'begin; set local role authenticated; set local request.jwt.claims = ' +
      literal(JSON.stringify({ sub: actor, role: 'authenticated', aal: 'aal2' })) +
      '; select public.security_v2_create_company(' + literal(key) + ',' +
      literal(JSON.stringify(body)) + '::jsonb); commit;')
    return JSON.parse(output)
  }
  try {
    await query('begin; insert into auth.users(id,email) values (' + literal(actor) +
      ",'concurrency-actor@test.invalid'),(" + literal(assignee) + ",'concurrency-assignee@test.invalid');" +
      'insert into public.profiles(id,display_name,status) values (' + literal(actor) +
      ",'Local concurrency actor','active'),(" + literal(assignee) + ",'Local assignee','active');" +
      'insert into public.platform_admins(user_id,admin_role) values (' + literal(actor) +
      ",'admin'),(" + literal(assignee) + ",'admin'); commit;")

    await t.test('same actor/key/payload creates one package and one success audit', async () => {
      const key = randomUUID(), body = payload('Local concurrent identical')
      const [one, two] = await Promise.all([run(key, body), run(key, body)])
      assert.equal(one.ok, true)
      assert.deepEqual(one, two)
      assert.equal(await query('select count(*) from public.audit_events where request_correlation_id=' +
        literal(one.operationId) + " and result='success'"), '1')
    })
    await t.test('same key/different payload has one winner and one conflict', async () => {
      const key = randomUUID()
      const results = await Promise.all([run(key, payload('Local version A')), run(key, payload('Local version B'))])
      assert.equal(results.filter(r => r.ok).length, 1)
      assert.equal(results.filter(r => r.error === 'IDEMPOTENCY_CONFLICT').length, 1)
    })
    await t.test('different keys/same organization cannot duplicate a legal entity', async () => {
      const body = payload('Local org race')
      // Mod-11 valid synthetic fixture, never submitted to a production service.
      body.company.organizationNumber = '123456785'
      assert.equal(await query("select count(*) from public.companies where organization_number='123456785'"), '0',
        'Fixture organization number must not already exist; do not delete unrelated data')
      const results = await Promise.all([run(randomUUID(), body), run(randomUUID(), body)])
      assert.equal(results.filter(r => r.ok).length, 1)
      assert.equal(results.filter(r => r.error === 'ORGANIZATION_NUMBER_EXISTS' && r.status === 'failed').length, 1)
    })
    await t.test('assignment waits for concurrent deactivation and then rejects', async () => {
      let locked
      const ready = new Promise(resolve => { locked = resolve })
      const mutation = query('begin; update public.platform_admins set is_active=false where user_id=' +
        literal(assignee) + ";\n\\echo LOCK_READY\nselect pg_sleep(0.5); commit;", output => {
          if (output.includes('LOCK_READY')) locked()
        })
      await Promise.race([ready, mutation.then(() => { throw new Error('Missing lock marker') })])
      const body = payload('Local assignment race')
      body.internal.assignments = [{ responsibilityType: 'seo', assigneeUserId: assignee }]
      const result = await run(randomUUID(), body)
      await mutation
      assert.equal(result.error, 'INVALID_ASSIGNEE')
      assert.equal(result.status, 'failed')
    })
    await t.test('discarded response is recovered by same-key retry', async () => {
      const key = randomUUID(), body = payload('Local lost response')
      await run(key, body) // deliberately discard response after committed request
      const result = await run(key, body)
      assert.equal(result.ok, true)
      assert.equal(await query('select count(*) from private.provisioning_operations where actor_user_id=' +
        literal(actor) + ' and idempotency_key=' + literal(key)), '1')
      assert.equal(await query('select count(*) from public.audit_events where request_correlation_id=' +
        literal(result.operationId) + " and result='success'"), '1')
    })
  } finally {
    // Delete only this run's random actor-owned fixture package, never existing local data.
    await query('begin; create temporary table fixture_companies as select company_id id from ' +
      'private.provisioning_operations where actor_user_id=' + literal(actor) + ' and company_id is not null;' +
      'delete from public.audit_events where actor_user_id=' + literal(actor) + ';' +
      'delete from public.company_assignments where company_id in(select id from fixture_companies);' +
      'delete from public.company_internal_settings where company_id in(select id from fixture_companies);' +
      'delete from public.company_services where company_id in(select id from fixture_companies);' +
      'delete from public.company_contacts where company_id in(select id from fixture_companies);' +
      'delete from private.provisioning_operations where actor_user_id=' + literal(actor) + ';' +
      'delete from public.companies where id in(select id from fixture_companies);' +
      'delete from public.platform_admins where user_id in(' + literal(actor) + ',' + literal(assignee) + ');' +
      'delete from public.profiles where id in(' + literal(actor) + ',' + literal(assignee) + ');' +
      'delete from auth.users where id in(' + literal(actor) + ',' + literal(assignee) + '); commit;')
  }
})
