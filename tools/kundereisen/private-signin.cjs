// Private file for the fixture owner. Never served by either HTTP listener.
const fs=require('node:fs'), path=require('node:path'), crypto=require('node:crypto');
const dir=process.argv[2];
const {email,password,seed}=JSON.parse(fs.readFileSync(path.join(dir,'account.json')));
const js=`const seed=${JSON.stringify(seed)};
async function current(){
 const bits=[...seed].map(c=>'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(c).toString(2).padStart(5,'0')).join('');
 const key=await crypto.subtle.importKey('raw',Uint8Array.from(bits.match(/.{8}/g),b=>parseInt(b,2)),{name:'HMAC',hash:'SHA-1'},false,['sign']);
 const buf=new DataView(new ArrayBuffer(8));buf.setBigUint64(0,BigInt(Math.floor(Date.now()/30000)));
 const h=new Uint8Array(await crypto.subtle.sign('HMAC',key,buf.buffer)),n=h[19]&15;
 document.querySelector('output').textContent=String((new DataView(h.buffer).getUint32(n)&0x7fffffff)%1000000).padStart(6,'0');
 document.querySelector('small').textContent='Ny kode om '+(30-Math.floor(Date.now()/1000)%30)+' sekunder.';
}
current();setInterval(current,1000);`;
const csp=crypto.createHash('sha256').update(js).digest('base64');
const doc='<!doctype html><html lang="nb"><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'sha256-'+csp+'\'; style-src \'unsafe-inline\'; base-uri \'none\'; form-action \'none\'"><title>Lokal demokunde · Bord &amp; Jord</title><style>body{font:18px/1.6 system-ui;background:#f3f0e8;color:#171b1b;max-width:40rem;margin:3rem auto;padding:1rem}code,output{display:block;overflow-wrap:anywhere}output{font-size:2rem}</style><h1>Bord &amp; Jord · lokal testkunde</h1><p>Kun for den isolerte portalen. Hold dette vinduet utenfor skjermdeling.</p><h2>E-post</h2><code>'+email+'</code><h2>Passord</h2><code>'+password+'</code><h2>Tofaktorkode</h2><output>Åpne filen lokalt i en nettleser.</output><small></small><script>'+js+'</script></html>';
const temp=path.join(dir,'signin-'+crypto.randomUUID());
fs.writeFileSync(temp,doc,{mode:0o600,flag:'wx'});
fs.renameSync(temp,path.join(dir,'Innlogging.html'));
console.log(path.join(dir,'Innlogging.html'));
