// Stored authorization relationships only; never runtime/session authorization.
import { execFileSync } from 'node:child_process'
import { homedir } from 'node:os'
import { pathToFileURL } from 'node:url'
export const CONTAINER = 'supabase_db_webbyra-demo-github'
export const SQL = `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '10s';
SELECT json_build_object(
 'read_only',current_setting('transaction_read_only'),
 'profiles',(select coalesce(json_agg(json_build_object('id',id,'status',status,'company_id',company_id)),'[]') from public.profiles),
 'memberships',(select coalesce(json_agg(json_build_object('user_id',user_id,'company_id',company_id,'status',status)),'[]') from public.company_memberships),
 'admins',(select coalesce(json_agg(json_build_object('user_id',user_id,'is_active',is_active,'admin_role',admin_role)),'[]') from public.platform_admins),
 'companies',(select coalesce(json_agg(id),'[]') from public.companies)
);
ROLLBACK;`
export function assertLocalTarget(args, container = CONTAINER) {
  if (args.length !== 0 || container !== CONTAINER) throw new Error('LOCAL_FIXED_TARGET_ONLY')
}
export function classify({ profiles, memberships, admins, companies }) {
  const known = new Set(companies), ids = [...new Set([...profiles.map(p=>p.id),...memberships.map(m=>m.user_id),...admins.map(a=>a.user_id)])].sort()
  if (new Set(profiles.map(p=>p.id)).size !== profiles.length || new Set(admins.map(a=>a.user_id)).size !== admins.length)
    throw new Error('DUPLICATE_IDENTITY_ROWS')
  const details = ids.map(user_id => {
    const p=profiles.find(p=>p.id===user_id), a=admins.find(a=>a.user_id===user_id)
    const ms=memberships.filter(m=>m.user_id===user_id), legacy=p?.company_id ?? null
    const active=[...new Set(ms.filter(m=>m.status==='active').map(m=>m.company_id))].sort()
    const inactive=ms.filter(m=>m.status!=='active').map(m=>({company_id:m.company_id,status:m.status}))
      .sort((a,b)=>a.company_id.localeCompare(b.company_id)||a.status.localeCompare(b.status))
    const category=legacy ? !known.has(legacy) ? 'INVALID_PROFILE_COMPANY' : active.includes(legacy) ? 'BOTH_MATCH'
      : active.length ? 'BOTH_MISMATCH' : 'LEGACY_ONLY' : active.length ? 'MEMBERSHIP_ONLY' : 'NEITHER'
    const flags=[]
    if (!p) flags.push('MISSING_PROFILE')
    if (p && p.status!=='active') flags.push('INACTIVE_PROFILE')
    if (legacy && p?.status!=='active') flags.push('INACTIVE_PROFILE_WITH_LEGACY_LINK')
    if (inactive.some(m=>m.company_id===legacy)) flags.push('LEGACY_ACCESS_WITH_REVOKED_MEMBERSHIP')
    if (active.length>1) flags.push('MULTIPLE_ACTIVE_MEMBERSHIPS')
    if (a?.is_active===true) flags.push('PLATFORM_ADMIN')
    if (a && a.is_active!==true) flags.push('INACTIVE_PLATFORM_ADMIN')
    if (ms.some(m=>!known.has(m.company_id))) flags.push('INVALID_MEMBERSHIP_COMPANY')
    if ((p && !['active','suspended','deactivated'].includes(p.status)) ||
      ms.some(m=>!['active','invited','suspended','removed'].includes(m.status)) ||
      (a && (!['owner','admin'].includes(a.admin_role)||typeof a.is_active!=='boolean')) ||
      new Set(ms.map(m=>m.company_id)).size!==ms.length) flags.push('UNEXPECTED_STATUS_OR_RELATIONSHIP')
    const attention=['LEGACY_ONLY','BOTH_MISMATCH','INVALID_PROFILE_COMPANY'].includes(category) || flags.includes('LEGACY_ACCESS_WITH_REVOKED_MEMBERSHIP')
      ? 'HIGH_ATTENTION' : flags.some(f=>f!=='PLATFORM_ADMIN') ? 'REVIEW' : 'LOWER_ATTENTION'
    return {user_id,profile_status:p?.status ?? null,profile_company_id:legacy,
      active_membership_company_ids:active,inactive_memberships:inactive,
      platform_admin:a?.is_active===true,platform_admin_status:a ? a.is_active===true?'active':'inactive':'absent',
      primary_category:category,flags:flags.sort(),attention,
      legacy_path_structurally_matches_company:legacy!==null && known.has(legacy)}
  })
  const count = values => Object.fromEntries([...new Set(values)].sort().map(k=>[k,values.filter(v=>v===k).length]))
  return {scope:'STORED_RELATIONSHIPS_ONLY_NOT_RUNTIME_ACCESS',summary:{total_profiles:profiles.length,
    total_users_considered:ids.length,total_active_memberships:memberships.filter(m=>m.status==='active').length,
    total_platform_admin_rows:admins.length,total_active_platform_admins:admins.filter(a=>a.is_active===true).length,
    categories:count(details.map(d=>d.primary_category)),flags:count(details.flatMap(d=>d.flags)),attention:count(details.map(d=>d.attention))},details}
}
export function run(args = process.argv.slice(2)) {
  assertLocalTarget(args)
  const docker = (args,input) => execFileSync('docker',['--host','unix://'+homedir()+'/.docker/run/docker.sock',...args],
    {input,encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:15000}).trim()
  if (docker(['inspect','--format','{{.Name}} {{.State.Running}}',CONTAINER])!== '/'+CONTAINER+' true') throw new Error('LOCAL_CONTAINER_REQUIRED')
  const raw=JSON.parse(docker(['exec','-i',CONTAINER,'psql','-X','-U','postgres','-d','postgres','-qAt','-v','ON_ERROR_STOP=1'],SQL))
  if(raw.read_only!=='on')throw new Error('READ_ONLY_REQUIRED')
  return classify(raw)
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  try { console.log(JSON.stringify(run(),null,2)) }
  catch { console.error('Local read-only access audit failed; check target/availability/schema. Raw diagnostics withheld.');process.exitCode=1 }
}
