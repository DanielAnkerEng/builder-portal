import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync, statSync} from 'node:fs';
import {DEMOS, resolveDemo} from '../../js/demo-data.mjs';
import {renderDemo} from '../../js/demo-renderer.mjs';

const read = path => readFileSync(new URL('../../' + path, import.meta.url), 'utf8');
function documentStub() {
  const doc = {createElement(tag) { return {tag, ownerDocument:doc, children:[], attrs:{}, listeners:{}, textContent:'',
    append(...nodes) {this.children.push(...nodes);}, replaceChildren(...nodes) {this.children=nodes;},
    setAttribute(key,value) {this.attrs[key]=value;}, addEventListener(type,fn) {this.listeners[type]=fn;},
    showModal() {this.open=true;}, close() {this.open=false;this.listeners.close?.();}, focus() {this.focused=true;},
  };}};
  return doc;
}
const flatten = node => [node, ...node.children.flatMap(flatten)];
const byClass = (node, name) => flatten(node).find(n => n.className?.split(' ').includes(name));
const text = node => flatten(node).map(n=>n.textContent).join(' ');
function render(data, preview=false) {const doc=documentStub();const root=doc.createElement('main');renderDemo(root,data,{preview});return root;}

for (const [key,data] of Object.entries(DEMOS)) {
  test(`${key}: preview and full page share exact hero, image and navigation`, () => {
    const full=render(data), preview=render(data,true);
    assert.equal(text(byClass(full,'demo-hero')),text(byClass(preview,'demo-hero')));
    const fullMedia=byClass(full,'demo-hero-media').children[0], previewMedia=byClass(preview,'demo-hero-media').children[0];
    for (const attr of ['src','srcset','alt','width','height','sizes']) assert.equal(fullMedia.attrs[attr],previewMedia.attrs[attr]);
    if(data.hero) { assert.equal(fullMedia.attrs.loading,'eager'); assert.equal(previewMedia.attrs.loading,'lazy'); }
    assert.equal(text(byClass(full,'demo-nav')),text(byClass(preview,'demo-nav')));
    assert.equal(flatten(preview).filter(n=>n.tag==='a').length,0,'inert previews do not nest links in exhibition links');
    assert.equal(byClass(preview,'demo-site').attrs.inert,'');
    assert.equal(byClass(preview,'demo-site').attrs['aria-hidden'],'true');
    assert.equal(flatten(full).filter(n=>n.tag==='h1').length,1);
    assert.equal(flatten(preview).filter(n=>n.tag==='h1').length,0);
    const ids=flatten(full).map(n=>n.id).filter(Boolean);
    for (const anchor of flatten(full).filter(n=>n.tag==='a'&&n.attrs.href.startsWith('#'))) assert(ids.includes(anchor.attrs.href.slice(1)));
    assert(ids.length>=3);
    assert.match(text(full),/fiktiv virksomhet/i);
  });
}
test('six distinct themes, with real sector-specific body structure',()=>{
  assert.equal(new Set(Object.values(DEMOS).map(d=>d.theme)).size,6);
  for(const [key,className] of [['restaurant','demo-menu'],['frisor','demo-salon-gallery'],['handverker','demo-project-grid'],['bilverksted','demo-service-panel'],['eiendom','demo-property-grid'],['konsulent','demo-consulting-services']]) assert(byClass(render(DEMOS[key]),className));
});
test('menu choice replaces dishes and exposes pressed state',()=>{
  const root=render(DEMOS.restaurant);const button=flatten(root).find(n=>n.tag==='button'&&n.textContent==='Dessert');
  button.listeners.click();assert.match(text(byClass(root,'demo-menu')),/Eple & vanilje/);assert.doesNotMatch(text(byClass(root,'demo-menu')),/torsk/);assert.equal(button.attrs['aria-pressed'],'true');
});
test('property filter retains only matching fictional listing',()=>{
  const root=render(DEMOS.eiendom);const button=flatten(root).find(n=>n.tag==='button'&&n.textContent==='Hytte');
  button.listeners.click();const grid=byClass(root,'demo-property-grid');assert.equal(grid.children.length,1);assert.match(text(grid),/Skogro/);assert.doesNotMatch(text(grid),/Lysningen/);
});
test('workshop service selector updates descriptive panel, never submits',()=>{
  const root=render(DEMOS.bilverksted);flatten(root).find(n=>n.tag==='button'&&n.textContent==='Feilsøking').listeners.click();assert.match(text(byClass(root,'demo-service-panel')),/En ulyd eller et varsel/);assert.equal(flatten(root).filter(n=>n.tag==='form'||n.tag==='input').length,0);
});
test('demo modal explains no transaction and restores focus to trigger',()=>{
  const root=render(DEMOS.restaurant);const wrap=byClass(root,'demo-action-wrap');const [button,dialog]=wrap.children;button.listeners.click();assert.equal(dialog.open,true);assert.match(text(dialog),/Ingen bord reserveres/);dialog.children.at(-1).listeners.click();assert.equal(dialog.open,false);assert.equal(button.focused,true);
});
test('project and headline text are never parsed as HTML',()=>{
  const malicious='<img src=x onerror=alert(1)>';
  const root=render({...DEMOS.handverker,title:malicious,name:malicious});
  assert.equal(byClass(root,'demo-title').textContent,malicious);assert.equal(byClass(root,'demo-wordmark').textContent,malicious);
  assert(flatten(root).filter(n=>n.tag==='img').every(n=>!n.attrs.onerror));
});
test('prototype properties cannot choose a demo',()=>{
  for(const key of ['constructor','__proto__','toString','<script>','restaurant&redirect=https://example.invalid']) assert.equal(resolveDemo(key),DEMOS.restaurant);
});
test('public rendering has no executable HTML, storage, forms, remote operations or tracking',()=>{
  for(const file of ['js/demo-renderer.mjs','js/demo.js','js/script.js','js/marketing-scenes.mjs']) {
    const source=read(file);
    assert.doesNotMatch(source,/innerHTML|outerHTML|insertAdjacentHTML|document\.write|\beval\s*\(|new Function|srcdoc|localStorage|sessionStorage|console\.|supabase|\bfetch\s*\(|XMLHttpRequest|sendBeacon/);
  }
  for(const file of ['index.html','demo.html']) {
    const html=read(file);assert.doesNotMatch(html,/<form|on(?:click|load|error)\s*=|<script[^>]*>\s*[^<\s]|https:\/\//);
    assert.match(html,/public-fonts\.css/);assert.doesNotMatch(html,/href="css\/styles.css"/);
  }
});
test('all image assets and licences exist; bounded responsive local images',()=>{
  const credits=JSON.parse(read('assets/marketing/credits.json'));
  assert.equal(credits.images.length,12);
  const publicImages=credits.generatedImages.filter(item=>item.name==='wreach-web-studio');
  assert.equal(publicImages.length,1);
  for(const item of publicImages) {
    assert.equal(item.source,'OpenAI ImageGen (built-in)');
    assert.match(item.usage,/AI-generert illustrasjon/);
    for(const width of item.widths) {const file=new URL(`../../assets/marketing/${item.name}-${width}.webp`,import.meta.url);assert(existsSync(file));assert(statSync(file).size<600000);}
  }
  for(const item of credits.images) {
    assert.equal(item.license,'https://unsplash.com/license');
    for(const width of [640,1600]) {const file=new URL(`../../assets/marketing/${item.name}-${width}.webp`,import.meta.url);assert(existsSync(file));assert(statSync(file).size<600000);}
  }
  for(const name of ['OFL-Manrope.txt','OFL-Fraunces.txt']) assert.match(read('assets/marketing/'+name),/SIL OPEN FONT LICENSE/);
  assert.match(read('js/demo-renderer.mjs'),/loading', eager \? 'eager' : 'lazy'/);
  assert.match(read('js/demo-renderer.mjs'),/srcset/);
});
test('homepage uses a responsive web-design illustration, not a sector demo photo',()=>{
  const home=read('index.html');
  assert.match(home, /class="hero-photograph"[^>]*src="assets\/marketing\/wreach-web-studio-1536.webp"/);
  assert.match(home, /wreach-web-studio-640.webp 640w, assets\/marketing\/wreach-web-studio-1536.webp 1536w/);
  assert.match(home, /AI-generert illustrasjon/);
  assert.doesNotMatch(home, /Restaurantkonseptet Bord & Jord/);
});
test('mobile menu, six linked previews and calm-view control are explicit',()=>{
  const html=read('index.html'), source=read('js/script.js');
  assert.match(html,/aria-controls="mainNav" aria-expanded="false"/);
  assert.equal((html.match(/data-tile=/g)||[]).length,6);
  assert.equal((html.match(/data-scene="/g)||[]).length,4);
  assert.match(html,/id="motionToggle" type="button" aria-pressed="false"/);
  for (const key of Object.keys(DEMOS)) assert(html.includes(`href="demo.html?site=${key}"`));
  assert.match(source,/event.key === 'Escape'/);assert.match(source,/toggle.focus\(\)/);
  assert.match(source,/renderDemo\(root, demo, \{ preview: true, imageMode: 'compact'/);
  assert.match(source,/installScenes/);
});
test('reduced motion is supported without hiding content and mobile uses container width',()=>{
  for(const file of ['css/marketing.css','css/demo.css']) {const css=read(file);assert.match(css,/prefers-reduced-motion:reduce/);assert.doesNotMatch(css,/align-end:|scroll-snap|opacity:\s*0(?:[;}])/);}
  assert.match(read('css/demo.css'),/@container demo \(max-width:600px\)/);
});
test('primary text and button palettes meet 4.5:1 contrast',()=>{
  const luminance = value => value.match(/../g).map(n=>parseInt(n,16)/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4).reduce((sum,n,i)=>sum+n*[.2126,.7152,.0722][i],0);
  for(const [foreground,background] of [['f0eee8','a84429'],['171b1b','d3e59f'],['d9ed70','192126'],['f5efe9','4d292e'],['f0ecdf','2c392e'],['334438','f3f3ec'],['243c50','edf0ed'],['f3f0e8','171b1b'],['bcbfb7','171b1b']]) {
    const a=luminance(foreground),b=luminance(background);assert((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5);
    assert(read('css/demo.css').includes('#'+background)||read('css/marketing.css').includes('#'+background));
  }
});
test('property detail is useful, fictional and restores focus without collecting data',()=>{
  const root=render(DEMOS.eiendom), dialog=byClass(root,'property-dialog');
  for (const value of ['Lysningen','146 m²','Slik henger rommene sammen','Materialer & uttrykk','Omgivelsene','ikke en salgsannonse']) assert(text(dialog).includes(value));
  const wrap=flatten(root).find(n=>n.children.includes(dialog));
  wrap.children[0].listeners.click();assert.equal(dialog.open,true);
  flatten(dialog).find(n=>n.tag==='button').listeners.click();assert.equal(dialog.open,false);assert.equal(wrap.children[0].focused,true);
  assert.equal(flatten(dialog).filter(n=>n.tag==='input'||n.tag==='form').length,0);
});
test('compact previews defer large images, mobile scene uses actual demo body',()=>{
  const doc=documentStub(), root=doc.createElement('div');
  renderDemo(root,DEMOS.restaurant,{preview:true,imageMode:'compact',previewContent:true});
  const heroImage=byClass(root,'demo-hero-media').children[0];
  assert.equal(heroImage.attrs.srcset,undefined);assert.match(heroImage.attrs['data-full-srcset'],/1600w/);
  assert(byClass(root,'demo-menu'));assert.equal(byClass(root,'demo-site').attrs.inert,'');
});
