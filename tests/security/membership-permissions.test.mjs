import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {isolatedSupabase,IMAGES} from './helpers/isolated-supabase.mjs'

const root=new URL('../../',import.meta.url)
const migration=readFileSync(new URL('supabase/migrations/20261007180000_membership_write_permissions.sql',root),'utf8')
test('membership hardening is scoped, transactional and retains unrelated capabilities',()=>{
  assert.match(migration,/begin;/);assert.match(migration,/commit;/)
  assert.equal((migration.match(/^revoke /gm)||[]).length,1)
  assert.match(migration,/revoke insert, update, delete, truncate on table public\.company_memberships from service_role;/)
  assert.doesNotMatch(migration,/^\s*(?:grant |alter role|alter default|alter table|create |drop |insert |update |delete |truncate )/im)
  assert.match(migration,/aclexplode\(c\.attacl\)/)
  assert.match(migration,/pg_has_role\('service_role',a\.grantee,'USAGE'\)/)
  assert.match(migration,/pg_has_role\('service_role',a\.grantee,'SET'\)/)
  assert.match(migration,/MEMBERSHIP_ACL_EFFECTIVE_WRITE_REMAINS/)
  for(const retained of ['SELECT','REFERENCES','TRIGGER','MAINTAIN'])assert.ok(migration.includes(retained))
})
test('disposable bootstrap requires opt-in and has no existing/hosted target override',()=>{
  if(process.env.WREACH_ISOLATED_MEMBERSHIP_TESTS!=='1')assert.throws(()=>isolatedSupabase(),/OPT_IN_REQUIRED/)
  const source=readFileSync(new URL('tests/security/helpers/isolated-supabase.mjs',root),'utf8')
  assert.match(IMAGES.db,/:17\.6\.1\.155$/)
  assert.match(source,/--pull=never/);assert.match(source,/--network','none'/)
  assert.match(source,/--tmpfs/);assert.match(source,/--log-driver','none'/)
  assert.match(source,/wreach\.membership\.exercise/)
  assert.doesNotMatch(source,/supabase_db_webbyra-demo-github|api\.supabase\.com|oqwpfnmqeriupujpssxz|pg_dump|db reset|process\.argv|process\.env\.(?:DATABASE|SUPABASE)/)
})
