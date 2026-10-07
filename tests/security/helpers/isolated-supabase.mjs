// Opt-in test infrastructure. Never attach to the browser stack or a hosted DB.
// Stock image bootstrap supplies roles/default ACLs. No existing Auth is copied.
import {spawnSync,spawn} from 'node:child_process'
import {randomBytes,randomUUID,createHmac} from 'node:crypto'
import {homedir} from 'node:os'

export const IMAGES=Object.freeze({
  db:'public.ecr.aws/supabase/postgres:17.6.1.155',
  auth:'public.ecr.aws/supabase/gotrue:v2.195.0',
  rest:'public.ecr.aws/supabase/postgrest:v14.17'
})
export const quote=value=>"'"+String(value).replaceAll("'","''")+"'"
export async function waitUntil(check,label){
  for(let i=0;i<150;i++){if(await check())return;await new Promise(r=>setTimeout(r,200))}
  throw new Error('Timed out: '+label)
}
export function isolatedSupabase(){
  if(process.env.WREACH_ISOLATED_MEMBERSHIP_TESTS!=='1')throw new Error('ISOLATED_LOCAL_OPT_IN_REQUIRED')
  const prefix='wreach-membership-'+randomUUID(),db=prefix+'-db',owned=[],secrets=[]
  const host=['--host','unix://'+homedir()+'/.docker/run/docker.sock']
  const protect=value=>(secrets.push(value),value)
  const password=protect(randomBytes(30).toString('hex')),jwtSecret=protect(randomBytes(48).toString('hex'))
  const safe=text=>{let s=String(text);for(const secret of secrets)if(secret)s=s.replaceAll(secret,'[REDACTED]');return s.replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,'[REDACTED JWT]')}
  function docker(args,input='',env={}){
    const r=spawnSync('docker',[...host,...args],{input,encoding:'utf8',env:{...process.env,...env},maxBuffer:32*1024*1024,timeout:60000})
    if(r.status!==0)throw new Error(safe(r.stderr||'Local Docker command failed'))
    return r.stdout
  }
  function sqlResult(query,role='supabase_admin'){
    if(!owned.some(o=>o.name===db))throw new Error('No owned isolated database')
    const r=spawnSync('docker',[...host,'exec','-i',db,'psql','-X','-U',role,'-d','postgres','-qAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose'],{input:query,encoding:'utf8',maxBuffer:32*1024*1024,timeout:60000})
    return {code:r.status,out:r.stdout?.trim()??'',err:safe(r.stderr??'')}
  }
  function sql(query,role='supabase_admin'){const r=sqlResult(query,role);if(r.code!==0)throw new Error(r.err);return r.out}
  function launch(name,kind,options,env){
    if(!name.startsWith(prefix+'-')||docker(['ps','-a','--filter','name=^/'+name+'$','--format','{{.ID}}']).trim())throw new Error('Resource ownership collision')
    const image=JSON.parse(docker(['image','inspect',IMAGES[kind]]))[0]
    console.info('ISOLATED IMAGE '+JSON.stringify({kind,tag:IMAGES[kind],id:image.Id,digests:image.RepoDigests}))
    // --pull=never and immutable local image ID: no registry/hosted requests.
    const id=docker(['create','--pull=never','--name',name,'--label','wreach.membership.exercise='+prefix,'--log-driver','none',...options,
      ...Object.keys(env).flatMap(key=>['-e',key]),image.Id],'',env).trim()
    owned.push({name,id});docker(['start',id])
    return JSON.parse(docker(['inspect',id]))[0]
  }
  function signedServiceToken(){
    const b=v=>Buffer.from(JSON.stringify(v)).toString('base64url')
    const unsigned=b({alg:'HS256',typ:'JWT'})+'.'+b({role:'service_role',iss:'isolated-test',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600})
    return protect(unsigned+'.'+createHmac('sha256',jwtSecret).update(unsigned).digest('base64url'))
  }
  const serviceToken=signedServiceToken()
  function request(port,path,token,body,method=body===undefined?'GET':'POST'){
    if(![3000,9999].includes(port)||!path.startsWith('/')||/[\r\n]/.test(path))throw new Error('Local HTTP target rejected')
    const config=[`url = ${JSON.stringify('http://127.0.0.1:'+port+path)}`,`request = ${JSON.stringify(method)}`,'header = "Content-Type: application/json"']
    if(token)config.push('header = '+JSON.stringify('Authorization: Bearer '+token))
    if(body!==undefined)config.push('data = '+JSON.stringify(JSON.stringify(body)))
    // Material stays in memory/stdin, not argv, files, Docker logs or reports.
    const out=docker(['exec','-i',db,'curl','-q','--silent','--show-error','--max-time','12','--config','-','--write-out','\n%{http_code}'],config.join('\n'))
    const pos=out.lastIndexOf('\n');let data
    try{data=JSON.parse(out.slice(0,pos))}catch{data=null}
    return {status:Number(out.slice(pos+1)),data}
  }
  async function start(){
    const v=launch(db,'db',['--network','none','--tmpfs','/var/lib/postgresql/data:rw,nosuid,size=1024m'],{
      POSTGRES_PASSWORD:password,POSTGRES_USER:'supabase_admin',POSTGRES_DB:'postgres',POSTGRES_HOST:'/var/run/postgresql',PGDATA:'/var/lib/postgresql/data',JWT_SECRET:jwtSecret})
    if(v.HostConfig.NetworkMode!=='none'||Object.keys(v.HostConfig.PortBindings??{}).length||v.Mounts.some(m=>m.Type!=='tmpfs'))throw new Error('Database isolation failed')
    console.info('ISOLATION '+JSON.stringify({name:db,id:v.Id,network:'none',publishedPorts:0,bindMounts:0,data:'fresh tmpfs',existingDatabaseAccess:false}))
    // Do not connect to the socket-only temporary server during image init.
    await waitUntil(()=>{try{return sql("select current_setting('listen_addresses')<>'' and exists(select 1 from pg_roles where rolname='supabase_auth_admin')")==='t'}catch{return false}},'fresh image bootstrap')
    sql(`alter role supabase_auth_admin password ${quote(password)};alter role authenticator password ${quote(password)};`)
    launch(prefix+'-auth','auth',['--network','container:'+db],{
      GOTRUE_API_HOST:'127.0.0.1',GOTRUE_API_PORT:'9999',API_EXTERNAL_URL:'http://127.0.0.1:9999',
      GOTRUE_DB_DRIVER:'postgres',GOTRUE_DB_DATABASE_URL:`postgres://supabase_auth_admin:${password}@127.0.0.1:5432/postgres?sslmode=disable`,
      GOTRUE_SITE_URL:'http://127.0.0.1:4175',GOTRUE_JWT_SECRET:jwtSecret,GOTRUE_JWT_AUD:'authenticated',GOTRUE_JWT_DEFAULT_GROUP_NAME:'authenticated',GOTRUE_JWT_ADMIN_ROLES:'service_role',GOTRUE_JWT_EXP:'900',
      GOTRUE_EXTERNAL_EMAIL_ENABLED:'true',GOTRUE_MAILER_AUTOCONFIRM:'true',GOTRUE_DISABLE_SIGNUP:'false',GOTRUE_PASSWORD_MIN_LENGTH:'12',
      GOTRUE_SMTP_HOST:'127.0.0.1',GOTRUE_SMTP_PORT:'1',GOTRUE_SMTP_ADMIN_EMAIL:'no-mail@fixture.invalid',GOTRUE_SMTP_SENDER_NAME:'Isolated test',
      GOTRUE_MFA_TOTP_ENROLL_ENABLED:'true',GOTRUE_MFA_TOTP_VERIFY_ENABLED:'true',GOTRUE_LOG_LEVEL:'error',
      GOTRUE_RATE_LIMIT_VERIFY:'1000',GOTRUE_RATE_LIMIT_MFA_CHALLENGE:'1000'
    })
    await waitUntil(()=>{try{return request(9999,'/health').status===200}catch{return false}},'fresh Auth')
    if(sql('select count(*) from auth.users')!=='0')throw new Error('Fresh Auth not empty')
    console.info('EMPTY AUTH VERIFIED; email transport unavailable; no existing users copied')
  }
  async function startRest(){
    launch(prefix+'-rest','rest',['--network','container:'+db],{
      PGRST_DB_URI:`postgres://authenticator:${password}@127.0.0.1:5432/postgres`,PGRST_DB_SCHEMAS:'public',PGRST_DB_EXTRA_SEARCH_PATH:'public,extensions',
      PGRST_DB_ANON_ROLE:'anon',PGRST_JWT_SECRET:jwtSecret,PGRST_SERVER_HOST:'127.0.0.1',PGRST_SERVER_PORT:'3000',PGRST_LOG_LEVEL:'error'
    })
    await waitUntil(()=>{try{return request(3000,'/').status===200}catch{return false}},'fresh PostgREST')
  }
  function connection(){
    const p=spawn('docker',[...host,'exec','-i',db,'psql','-X','-U','supabase_admin','-d','postgres','-qAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose'],{stdio:['pipe','pipe','pipe']})
    let out='',err=''
    p.stdout.on('data',b=>out+=b);p.stderr.on('data',b=>err+=b)
    const completed=new Promise(resolve=>p.on('close',code=>resolve({code,out:out.trim(),err:safe(err)})))
    return {write:q=>p.stdin.write(q+'\n'),end:()=>p.stdin.end(),output:()=>out,completed}
  }
  async function cleanup(){
    const errors=[]
    for(const {name,id} of owned.reverse())try{
      const v=JSON.parse(docker(['inspect',id]))[0]
      if(v.Id!==id||v.Name!=='/'+name||v.Config.Labels?.['wreach.membership.exercise']!==prefix)throw new Error('Cleanup ownership mismatch')
      docker(['rm','--force','--volumes',id])
    }catch(e){errors.push(safe(e.message))}
    if(docker(['ps','-a','--filter','label=wreach.membership.exercise='+prefix,'--format','{{.ID}}']).trim())errors.push('Owned resources remain')
    if(errors.length)throw new Error(errors.join('\n'))
    console.info('CLEANUP PASS: only owned containers/tmpfs removed; no fixture material on disk')
  }
  return {start,startRest,sql,sqlResult,request,serviceToken,protect,safe,connection,cleanup}
}
