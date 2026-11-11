// Supabase CLI leaves HostIp empty. Set it before Docker creates pilot containers.
import http from 'node:http';
import net from 'node:net';
import {mkdtemp, rm, chmod} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync,spawn} from 'node:child_process';
import {once} from 'node:events';

export async function startLocalSupabase(root, project, log) {
  const endpoint=process.env.DOCKER_HOST || execFileSync('docker',['context','inspect','--format','{{(index .Endpoints "docker").Host}}'],{encoding:'utf8'}).trim();
  if (!endpoint.startsWith('unix:///')) throw Error('LOCAL_DOCKER_SOCKET_REQUIRED');
  const socketPath=endpoint.slice('unix://'.length);
  const dir=await mkdtemp(join(tmpdir(),'bli-stogg-docker-'));
  const local=join(dir,'engine.sock');
  const proxy=http.createServer(async (req,res)=>{
    try {
      const url=new URL(req.url,'http://docker');
      let body;
      const headers={...req.headers};
      if (req.method==='POST' && url.pathname.endsWith('/containers/create')) {
        const bytes=[]; for await (const part of req) bytes.push(part);
        const spec=JSON.parse(Buffer.concat(bytes));
        if (spec.Labels?.['com.supabase.cli.project']!==project)
          throw Error('UNEXPECTED_CONTAINER');
        for (const mappings of Object.values(spec.HostConfig?.PortBindings || {}))
          for (const mapping of mappings) mapping.HostIp='127.0.0.1';
        body=Buffer.from(JSON.stringify(spec));
        delete headers['transfer-encoding'];headers['content-length']=body.length;
      }
      const upstream=http.request({socketPath,path:req.url,method:req.method,headers},response=>{
        // Docker's wait endpoint sends headers before the container starts.
        // The CLI schedules start after receiving those headers.
        res.writeHead(response.statusCode,response.headers);
        res.flushHeaders();
        response.pipe(res);
      });
      upstream.on('error',()=>res.destroy());
      if (body) upstream.end(body);else req.pipe(upstream);
    } catch {res.writeHead(400);res.end('Invalid local Docker request');}
  });
  proxy.on('upgrade',(req,client,head)=>{
    const upstream=net.connect(socketPath,()=>{
      upstream.write([req.method+' '+req.url+' HTTP/'+req.httpVersion,...Object.entries(req.headers).map(([k,v])=>k+': '+v),'',''].join('\r\n'));
      upstream.write(head);client.pipe(upstream).pipe(client);
    });
    upstream.on('error',()=>client.destroy());client.on('error',()=>upstream.destroy());
    client.on('close',()=>upstream.destroy());
  });
  try {
    proxy.listen(local);await once(proxy,'listening');await chmod(local,0o600);
    const cli=spawn('supabase',['start','--workdir',root,'--exclude','studio,imgproxy,storage-api,realtime,logflare,vector,edge-runtime'],{
      env:{...process.env,DOCKER_HOST:'unix://'+local,DOCKER_CONTEXT:'',DO_NOT_TRACK:'1',SUPABASE_TELEMETRY_DISABLED:'1',SUPABASE_SERVICES_HOSTNAME:'127.0.0.1'},
      stdio:['ignore',log,log]});
    if ((await once(cli,'exit'))[0]!==0) throw Error('LOCAL_SUPABASE_START_FAILED');
  } finally {proxy.close();proxy.closeAllConnections();await rm(dir,{recursive:true,force:true});}
}
