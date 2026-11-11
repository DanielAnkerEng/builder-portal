"""Local Wreach project meeting. Only the fixture's own offline Supabase namespace is reachable."""
import errno
import sys
from profile_store import PROFILE, SOURCE, HERE, NODE, DOCKER
import base64, json, re, secrets, subprocess, threading, time
from functools import partial
from http.cookies import SimpleCookie
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

PUBLIC = Path(sys.argv[1])
FIX = json.loads((PROFILE/'binding.json').read_text())
CONTEXT_COOKIE = 'wr_context_' + FIX['instance']
EVENT_COOKIE = 'wr_event_' + FIX['instance']
DB = FIX['db']
assert re.fullmatch(r'wreach-membership-[a-f0-9-]{36}-db',DB)
PROJECTS = frozenset(FIX['projects'])
AD = 'instagram-bord-og-jord-torsk'
CHANNELS = ('instagram','nyhetsbrev',AD)
UUID = re.compile(r'[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}')
LOCK = threading.RLock()
clients, landings = {}, {}
def empty():
    return {'runde':secrets.token_hex(12),'incomplete':False, **{c:{'opening':0,'menu':0} for c in CHANNELS},}
def new_round():
    row=empty(); row[AD]['click']=0; return row
rounds={p:new_round() for p in PROJECTS}
docker = DOCKER + ['exec', '-i', DB]

def upstream(port, path, token='', method='GET', body=None, accept='application/json'):
    if not path.startswith('/') or any(ord(c)<32 for c in path+token+accept): raise ValueError()
    config=[('url','http://127.0.0.1:'+str(port)+path),('request',method),('header','Content-Type: application/json'),('header','Accept: '+accept)]
    if token: config.append(('header','Authorization: Bearer '+token))
    if body is not None: config.append(('data-raw',body))
    args='\n'.join(k+' = '+json.dumps(v,ensure_ascii=False) for k,v in config)
    out=subprocess.run(docker+['curl','-q','-sS','--globoff','--max-time','8','--config','-','-w','\n%{http_code}'],input=args,capture_output=True,text=True,check=True,timeout=12).stdout
    raw,code=out.rsplit('\n',1)
    return int(code),json.loads(raw) if raw.strip() else None

class Denied(Exception):
    def __init__(self,code=403): self.code=code

def claims(token):
    try:
        part=token.split('.')[1]
        c=json.loads(base64.urlsafe_b64decode(part+'='*(-len(part)%4)))
        if c['role']!='authenticated' or not all(UUID.fullmatch(c[k]) for k in ['sub','session_id']):raise ValueError()
        return c
    except (ValueError,KeyError,IndexError,TypeError): raise Denied(401)

def authorized(token,project,client):
    if project not in PROJECTS: raise Denied(404)
    c=claims(token)
    if c.get('aal')!='aal2' or time.time()>=c.get('exp',0): raise Denied(403)
    sid=c['session_id']
    with LOCK:
        if clients.get(client)!=sid:raise Denied(401)
    # GoTrue validates the bearer. Never authorize from local claim decoding alone.
    code,user=upstream(9999,'/user',token)
    if code!=200 or user.get('id')!=c['sub']: raise Denied(401)
    # Explicit revocation gate for JWTs whose expiry extends beyond logout.
    sql=f"BEGIN READ ONLY; SELECT EXISTS(SELECT 1 FROM auth.sessions WHERE id='{sid}'::uuid AND user_id='{c['sub']}'::uuid); ROLLBACK;"
    live=subprocess.run(docker+['psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'],input=sql,text=True,capture_output=True,timeout=6,check=True)
    if live.stdout.strip()!='t':raise Denied(401)
    for table,ident,extra in [('profiles',c['sub'],'&status=eq.active'),('websites',project,'')]:
        code,rows=upstream(3000,'/'+table+'?select=id&id=eq.'+ident+extra,token)
        if code!=200 or rows!=[{'id':ident}]: raise Denied()
    return sid

def prune():
    now=time.monotonic()
    for store in [landings]:
        for k in list(store):
            g=store[k]
            if g['until']<now or clients.get(g['client'])!=g['sid'] or rounds[g['pid']]['runde']!=g['round']: del store[k]

def check_binding(g):
    if clients.get(g['client'])!=g['sid']: raise Denied(401)
    if rounds[g['pid']]['runde']!=g['round']:raise Denied(409)

SECURITY_HEADERS=dict(line.strip().split(': ',1) for line in (PUBLIC/'_headers').read_text().split('\n\n')[0].splitlines()[1:])

class Handler(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
    def log_error(self,*args):pass
    def end_headers(self):
        self.send_header('Cache-Control','no-store')
        for key,value in SECURITY_HEADERS.items():self.send_header(key,value)
        super().end_headers()
    def reply(self,code,data=None,headers=()):
        body=b'' if data is None else json.dumps(data).encode()
        self.send_response(code);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(body)))
        for k,v in headers:self.send_header(k,v)
        self.end_headers();self.wfile.write(body)
    def cookie(self,name):
        jar=SimpleCookie();jar.load(self.headers.get('Cookie',''));return jar[name].value if name in jar else ''
    def body(self):
        n=int(self.headers.get('Content-Length',0))
        if n<0 or n>1048576:raise Denied(413)
        return self.rfile.read(n).decode()
    def do_POST(self):self.dispatch()
    def do_GET(self):self.dispatch()
    def do_HEAD(self):self.reply(405)
    def list_directory(self,path):self.reply(404)
    def dispatch(self):
        try:
            if self.headers.get('Host')!=self.server.host:raise Denied()
            parsed=urlsplit(self.path);route=parsed.path;post=self.command=='POST'
            if route == '/meeting/test-target' and self.command == 'GET':
                return self.reply(200, {'instance': FIX['instance'], 'kind': self.server.kind})
            if self.server.kind=='restaurant':return self.restaurant(route,post)
            if route=='/meeting/ready' and not post:return self.reply(200,{'instance':FIX['instance']})
            if post and self.headers.get('Origin')!=portal.origin:raise Denied()
            client=self.cookie(CONTEXT_COOKIE);token=self.headers.get('Authorization','').removeprefix('Bearer ')
            if route.startswith('/auth/v1/'):
                dest=route[len('/auth/v1'):]
                if not re.fullmatch(r'/(token|user|logout|factors(?:/[a-f0-9-]{36}/(?:challenge|verify))?)',dest):raise Denied(404)
                if token=='local-preview-public':token=''
                code,obj=upstream(9999,self.path[len('/auth/v1'):],token,self.command,self.body() if post else None)
                headers=[]
                with LOCK:
                    if dest=='/logout' and code<300:clients.pop(client,None)
                    if code==200 and isinstance(obj,dict) and obj.get('access_token'):
                        c=claims(obj['access_token']);sid=c['session_id']
                        if dest=='/token' and parse_qs(parsed.query).get('grant_type')==['password']:
                            clients.pop(client,None);client=secrets.token_hex(24)
                        elif not client or clients.get(client)!=sid:raise Denied(401)
                        clients[client]=sid
                        headers=[('Set-Cookie',CONTEXT_COOKIE+'='+client+'; HttpOnly; SameSite=Strict; Path=/')]
                return self.reply(code,obj,headers)
            if route=='/functions/v1/save-draft' and post:
                # Preserve Builder's normal autosave using the baseline handler and real local RPC.
                c=claims(token)
                with LOCK:
                    if c['aal']!='aal2' or clients.get(client)!=c['session_id']:raise Denied()
                node=NODE
                result=subprocess.run([str(node),'--disable-warning=ExperimentalWarning',str(HERE/'local-save.mjs'),str(PROFILE),str(PUBLIC),str(SOURCE)],
                    cwd=SOURCE,input=json.dumps({'bearer':token,'body':self.body()}),capture_output=True,text=True,timeout=25,check=True)
                packet=json.loads(result.stdout)
                return self.reply(packet['status'],packet['data'])
            if route.startswith('/rest/v1/'):
                if post or route.count('/')!=3 or route.split('/')[-1] not in ['profiles','platform_admins','company_memberships','websites','website_drafts']:raise Denied()
                code,obj=upstream(3000,self.path[len('/rest/v1'):],token,accept=self.headers.get('Accept','application/json'))
                return self.reply(code,obj)
            if route.startswith('/api/'):
                m=re.fullmatch(r'/api/projects/([a-f0-9-]{36})/(available|round|reset|launch)',route)
                if not m:raise Denied(404)
                pid,action=m.groups()
                if post!=(action in ['reset','launch']):raise Denied(405)
                sid=authorized(token,pid,client)
                with LOCK:
                    if clients.get(client)!=sid:raise Denied(401)
                    prune()
                    if action=='available':return self.reply(200,{'available':True})
                    if action=='reset':
                        if json.loads(self.body()).get('round')!=rounds[pid]['runde']:raise Denied(409)
                        rounds[pid]=new_round()
                    if action=='launch':
                        obj=json.loads(self.body())
                        if obj.get('channel') not in CHANNELS:raise Denied(400)
                        if obj.get('round')!=rounds[pid]['runde']:raise Denied(409)
                        rid=secrets.token_hex(12)
                        cookie=secrets.token_urlsafe(32)
                        prefix='/scene/'+rid+'/'
                        channel=obj['channel']
                        landings[rid]={'pid':pid,'round':obj['round'],'channel':channel,'sid':sid,
                                       'client':client,'token':token,'until':time.monotonic()+900,'secret':cookie}
                        if channel==AD: rounds[pid][AD]['click']+=1
                        headers=[('Set-Cookie',EVENT_COOKIE+'='+cookie+'; HttpOnly; SameSite=Strict; Path='+prefix)]
                        return self.reply(200,{'location':restaurant.origin+prefix+'bord-og-jord.html','restaurantOrigin':restaurant.origin},headers)
                    return self.reply(200,rounds[pid])
            if post:raise Denied(404)
            return super().do_GET()
        except Denied as e:self.reply(e.code)
        except (ValueError,KeyError,TypeError):self.reply(400)
        except (subprocess.SubprocessError,OSError):self.reply(503)
    def restaurant(self,route,post):
        m=re.fullmatch(r'/scene/([0-9a-f]{24})/(.+)',route)
        if not m:raise Denied(404)
        rid,path=m.groups()
        if path in ('event','incomplete') and post:
            if self.headers.get('Origin')!=restaurant.origin:raise Denied()
            with LOCK:
                g=landings.get(rid)
                if not g:raise Denied(409)
                if not secrets.compare_digest(self.cookie(EVENT_COOKIE),g['secret']):raise Denied()
                check_binding(g)
                if time.monotonic()>g['until']:raise Denied(401)
            if path=='incomplete':
                authorized(g['token'],g['pid'],g['client'])
                with LOCK:
                    check_binding(g);rounds[g['pid']]['incomplete']=True
                return self.reply(204)
            event=json.loads(self.body()).get('type')
            if event not in ('opening','menu'):raise Denied(400)
            authorized(g['token'],g['pid'],g['client'])
            with LOCK:
                check_binding(g);rounds[g['pid']][g['channel']][event]+=1
            return self.reply(204)
        if post or not (path in ['bord-og-jord.html','js/seo-restaurant.mjs','js/scene.mjs','js/demo-data.mjs','js/demo-renderer.mjs','css/demo.css','css/public-fonts.css'] or re.fullmatch(r'assets/marketing/[\w.-]+',path)):raise Denied(404)
        self.path='/'+('scene.html' if path=='bord-og-jord.html' else path)
        return super().do_GET()

def listener(kind):
    ports = PROFILE / 'origins.json'
    port = urlsplit(json.loads(ports.read_text())[kind]).port if ports.is_file() else 0
    def bind(number):
        return ThreadingHTTPServer(('127.0.0.1',number),partial(Handler,directory=str(PUBLIC)))
    try:
        server = bind(port)
    except OSError as error:
        if error.errno != errno.EADDRINUSE:
            raise
        server = bind(0)
    server.kind = kind
    server.host = '127.0.0.1:' + str(server.server_port)
    server.origin = 'http://' + server.host
    return server

portal = listener('portal')
restaurant = listener('restaurant')
tmp = PROFILE / 'origins.next'
tmp.write_text(json.dumps({'portal':portal.origin,'restaurant':restaurant.origin}))
tmp.replace(PROFILE / 'origins.json')
threading.Thread(target=restaurant.serve_forever, daemon=True).start()
print("Åpne portalen: " + portal.origin + "/login.html", flush=True)
print("Privat innloggingsark: " + str(PROFILE / 'Innlogging.html'), flush=True)
try:
    portal.serve_forever()
except KeyboardInterrupt:
    pass
finally:
    restaurant.shutdown()
    restaurant.server_close()
    portal.server_close()
