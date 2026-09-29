import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {classify,assertLocalTarget,SQL} from '../../scripts/audit-company-access-mapping.mjs'
const row=(company_id=null,status='active')=>({id:'synthetic-user',company_id,status,email:'DO_NOT_EXPOSE',name:'PRIVATE'})
const member=(company_id,status='active')=>({user_id:'synthetic-user',company_id,status})
const report=(p=row(),ms=[],admins=[])=>classify({profiles:p?[p]:[],memberships:ms,admins,companies:['a','b']})
for(const [label,p,ms] of [
 ['BOTH_MATCH',row('a'),[member('a')]],['LEGACY_ONLY',row('a'),[]],
 ['MEMBERSHIP_ONLY',row(),[member('a')]],['BOTH_MISMATCH',row('a'),[member('b')]],
 ['NEITHER',row(),[]],['INVALID_PROFILE_COMPANY',row('missing'),[]]])
 test(label,()=>assert.equal(report(p,ms).details[0].primary_category,label))
for(const status of ['invited','suspended','removed','revoked'])test('legacy non-active '+status,()=>{
 const r=report(row('a'),[member('a',status)]).details[0]
 assert.ok(r.flags.includes('LEGACY_ACCESS_WITH_REVOKED_MEMBERSHIP'));assert.equal(r.attention,'HIGH_ATTENTION')
})
test('secondary flags preserve multiple/inactive/admin relationships',()=>{
 const r=report(row('a','suspended'),[member('a'),member('b')],[{user_id:'synthetic-user',is_active:true,admin_role:'admin'}]).details[0]
 for(const f of ['MULTIPLE_ACTIVE_MEMBERSHIPS','INACTIVE_PROFILE','INACTIVE_PROFILE_WITH_LEGACY_LINK','PLATFORM_ADMIN'])assert.ok(r.flags.includes(f))
 assert.equal(r.primary_category,'BOTH_MATCH');assert.equal(r.attention,'REVIEW')
})
test('missing profiles and invalid memberships are not hidden',()=>{
 const r=report(null,[member('missing')]).details[0]
 assert.ok(r.flags.includes('MISSING_PROFILE'));assert.ok(r.flags.includes('INVALID_MEMBERSHIP_COMPANY'))
})
test('privacy, deterministic ordering, aggregate counts',()=>{
 const data={profiles:[{...row('a'),id:'z'}, {...row(),id:'a'}],memberships:[{user_id:'z',company_id:'b',status:'active'},{user_id:'z',company_id:'a',status:'active'}],admins:[],companies:['a','b']}
 const r=classify(data)
 assert.deepEqual(r,classify({...data,profiles:[...data.profiles].reverse(),memberships:[...data.memberships].reverse()}))
 assert.deepEqual(r.details.map(x=>x.user_id),['a','z']);assert.equal(r.summary.total_profiles,2);assert.equal(r.summary.total_active_memberships,2)
 assert.doesNotMatch(JSON.stringify(r),/DO_NOT_EXPOSE|PRIVATE|email|phone|password|token/)
})
test('fixed target refuses every override',()=>{
 assert.doesNotThrow(()=>assertLocalTarget([]))
 for(const args of [['--host','localhost'],['postgres://hosted'],['--project-ref','anything']])assert.throws(()=>assertLocalTarget(args))
 assert.throws(()=>assertLocalTarget([],'other-container'))
})
test('read-only execution contract, safe fields and no mutation SQL',()=>{
 assert.match(SQL,/BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY/);assert.match(SQL,/ROLLBACK;/)
 assert.doesNotMatch(SQL,/\b(INSERT|UPDATE|DELETE|UPSERT|CREATE|ALTER|DROP|TRUNCATE|CALL)\b/i)
 assert.doesNotMatch(SQL,/email|phone|display_name|metadata|secret|token/i)
 const src=readFileSync(new URL('../../scripts/audit-company-access-mapping.mjs',import.meta.url),'utf8')
 assert.match(src,/'psql','-X'/);assert.doesNotMatch(src,/process\.env|fetch\(|service_role|SUPABASE_URL/)
})
