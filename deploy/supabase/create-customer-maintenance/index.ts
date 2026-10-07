// P4D9B-R immutable release candidate: ZERO application IO, for old/new DB.
// MUST deploy as create-customer with verify_jwt=true. The gateway authenticates
// JWTs; this handler grants no action/data to any caller, including AAL2 admins.
const origins = new Set(['https://wreach.no','http://127.0.0.1:4175','http://localhost:4175'])
const allowed = ['authorization','apikey','content-type','idempotency-key','x-client-info']
Deno.serve((req: Request): Response => {
  const origin = req.headers.get('origin')
  const headers = new Headers({'Cache-Control':'no-store',Vary:'Origin'})
  if(origin && origins.has(origin)) {
    headers.set('Access-Control-Allow-Origin',origin)
    headers.set('Access-Control-Allow-Methods','POST, OPTIONS')
    headers.set('Access-Control-Allow-Headers',allowed.join(', '))
  }
  const fail=(code:string,status:number)=>Response.json({ok:false,error:{code}},{status,headers})
  if(origin && !origins.has(origin))return fail('NOT_AUTHORIZED',403)
  if(req.method==='OPTIONS') {
    if(!origin || req.headers.get('access-control-request-method')!=='POST' ||
      (req.headers.get('access-control-request-headers')??'').split(',').filter(Boolean).some(h=>!allowed.includes(h.trim().toLowerCase())))return fail('INVALID_REQUEST',400)
    return new Response(null,{status:204,headers})
  }
  if(!req.headers.get('authorization')?.startsWith('Bearer '))return fail('UNAUTHENTICATED',401)
  return fail('INVITATIONS_MAINTENANCE',503)
})
