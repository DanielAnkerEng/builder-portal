import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../../'+p,import.meta.url),'utf8');
test('external synchronous bootstrap retains initial pending states and timed fail-open behavior',()=>{
 for(const reduced of [false,true]){const classes=new Set(),timers=[];const sandbox={document:{documentElement:{classList:{add:c=>classes.add(c),remove:c=>classes.delete(c)}}},window:{},setTimeout:(cb,ms)=>{timers.push({cb,ms});return timers.length},matchMedia:()=>({matches:reduced})};vm.runInNewContext(read('js/marketing-bootstrap.js'),sandbox);assert(classes.has('js-pending'));assert.equal(classes.has('motion-pending'),!reduced);assert(timers.every(t=>t.ms===4000));timers.forEach(t=>t.cb());assert.equal(classes.size,0)}
 const html=read('index.html');assert.match(html,/<script src="js\/marketing-bootstrap.js"><\/script>/);assert(html.indexOf('marketing-bootstrap.js')<html.indexOf('<body>'));assert.doesNotMatch(html,/<script(?![^>]*src=)[^>]*>\s*[^<\s]/);
});
test('public contact is explicit email only; no form, collection or false success',()=>{const h=read('index.html');assert.equal((h.match(/mailto:post@wreach.no/g)||[]).length,2);assert.match(h,/>post@wreach.no<\/a>/);assert.match(h,/Send oss en e-post/);assert.doesNotMatch(h,/<form|<textarea|id="samtale"|href="#samtale"|Ingen melding sendes|lokal prototype/i);assert.doesNotMatch(read('js/marketing-ui.js'),/fetch\(|sendBeacon|XMLHttpRequest|localStorage|sessionStorage|#samtale/)});
test('portal, credits, clear scope and future service status survive integration',()=>{const h=read('index.html');assert.match(h,/href="login.html">Kundeportal/);assert.match(h,/href="assets\/marketing\/credits.json"/);assert.match(h,/Omfang og pris avtales separat/);assert.match(h,/SEO og annonsering er planlagt fra februar 2027 og er ikke tilgjengelige ennå/);assert.match(read('assets/marketing/credits.json'),/wreach-design-desk/);assert.match(h,/Designkonsept/);assert.match(h,/AI-generert/)});
test('metadata is public while demo remains explicitly fictional and noindex',()=>{const h=read('index.html');assert.doesNotMatch(h,/noindex|Lokal designprototype|En lokal forsideprototype/);assert.match(h,/rel="canonical" href="https:\/\/wreach.no\/"/);for(const key of ['og:title','og:description','og:image','og:url'])assert(h.includes('property="'+key+'"'));assert.match(read('demo.html'),/noindex,nofollow/)});
test('public entrypoint loads no portal, backend or remote runtime',()=>{const h=read('index.html');for(const m of h.matchAll(/<script\b[^>]*src="([^"]+)"/g)){assert(m[1].startsWith('js/'));assert(!/auth|supabase|admin|builder|onboarding/.test(m[1]));assert(fs.existsSync(new URL('../../'+m[1],import.meta.url)))}assert.doesNotMatch(h,/unsafe-inline|unsafe-eval/)});

test('canonical and social metadata do not permit remote runtime resources',()=>{
 for(const file of ['index.html','demo.html']){
  const html=read(file);
  for(const tag of html.matchAll(/<(?:script|link|img|source)\b[^>]*>/g)){
   const markup=tag[0];
   if(/rel="canonical"/.test(markup)){assert.match(markup,/href="https:\/\/wreach\.no\/"/);continue}
   for(const attr of markup.matchAll(/(?:src|href|srcset)="([^"]+)"/g)){
    if(/rel="icon"/.test(markup)&&attr[1]==='data:,')continue;
    for(const item of attr[1].split(',')){
     const path=item.trim().split(/\s+/)[0];
     assert.match(path,/^(?:assets|css|js)\//,`${file}: remote runtime resource`);
     assert(fs.existsSync(new URL('../../'+path,import.meta.url)),`${file}: missing runtime resource`);
    }
   }
  }
 }
});
