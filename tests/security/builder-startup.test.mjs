import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import {readFileSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import * as editor from '../../js/builder-editor.mjs'
import {randomUUID} from 'node:crypto'

const root=new URL('../../',import.meta.url)
const source=readFileSync(new URL('js/builder.js',root),'utf8')
const dataSource=readFileSync(new URL('js/builder-data.js',root),'utf8')
const html=readFileSync(new URL('builder.html',root),'utf8')
const websiteId='synthetic-local-project'
function projectContent(){return {
  businessName:'Synthetic startup test',accent:'#405735',accent2:'#526241',bg:'#ffffff',
  templateId:'restaurant',language:'no',status:'draft',activePageId:'home',
  pages:[{id:'home',slug:'',name:'Forside',heroTitle:'Synthetic heading',heroSub:'Synthetic text',
    cta:'Example',aboutTitle:'About',aboutText:'Synthetic only',offerings:[],gallery:[],sections:[{id:'hero',name:'Hero',enabled:true},{id:'about',name:'About',enabled:true}]}]
}}
function harness({content=projectContent(),search='',denied=false,mobile=false,save=null,rename=null,publish=null}={}){
  const calls=[],saved=[],published=[],pendingTimers=new Map(),timerErrors=[]
  let now=0,timerId=0
  const timers={get length(){return pendingTimers.size}}
  const setTimer=(fn,delay=0)=>{const id=++timerId;pendingTimers.set(id,{fn,at:now+delay});return id}
  const clearTimer=id=>pendingTimers.delete(id)
  const flush=()=>new Promise(resolve=>setImmediate(resolve))
  async function advance(ms){
    const end=now+ms
    for(;;){const next=[...pendingTimers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at||a[0]-b[0])[0];if(!next)break
      const [id,timer]=next;now=timer.at;pendingTimers.delete(id)
      try{Promise.resolve(timer.fn()).catch(error=>timerErrors.push(error))}catch(error){timerErrors.push(error)}
      await flush()
    }
    now=end;await flush();assert.deepEqual(timerErrors,[],'timer callback must not reject')
  }
  const document={activeElement:null}
  const node=()=>{
    const classes=new Set()
    return {value:'',textContent:'',innerHTML:'',disabled:false,hidden:false,inert:false,style:{},events:{},children:[],attrs:{},dataset:{},
      classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c),toggle:(c,on)=>{const add=on??!classes.has(c);if(add)classes.add(c);else classes.delete(c)}},
      focus(){document.activeElement=this},setAttribute(key,value){this.attrs[key]=value},
      append(...children){this.children.push(...children)},replaceChildren(...children){this.children=children},querySelector(){return this.children.find(c=>typeof c.events.click==='function')},click(){return this.events.click?.()},addEventListener(type,fn){this.events[type]=fn}}
  }
  // Use the real page's IDs rather than silently manufacturing missing controls.
  const elements=Object.fromEntries([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>[m[1],node()]))
  const buttons=(attribute)=>[...html.matchAll(new RegExp('<button[^>]*data-'+attribute+'="([^"]+)"[^>]*>','g'))].map(m=>{
    const button=node();button.dataset[attribute]=m[1];if(/class="[^"]*\bactive\b/.test(m[0]))button.classList.add('active');return button
  })
  const panelButtons=buttons('tab'),viewButtons=buttons('view'),tablist=node(),topbar=node(),shell=node(),dialog=node()
  elements.publishModal.querySelector=selector=>{assert.equal(selector,'.modal');return dialog}
  Object.assign(document,{body:node(),getElementById:id=>elements[id]??null,createElement:node,
    querySelector:selector=>{const result={'.sidebar-tabs':tablist,'.topbar':topbar,'.builder-shell':shell}[selector];assert(result,selector);return result},
    querySelectorAll:selector=>{const result={'.sidebar-tabs .sidebar-tab':panelButtons,'.topbar-center .view-btn[data-view]':viewButtons}[selector];assert(result,selector);return result}})
  document.body.style.overflow='auto'
  const context=vm.createContext({
    ...editor,crypto:{randomUUID},
    document,window:{matchMedia:query=>{assert.equal(query,'(max-width: 780px)');return {matches:mobile}}},
    URLSearchParams,location:{search,reload(){throw Error('Unexpected navigation')}},
    requireAal2:async()=>{calls.push('aal2');if(denied)throw Error('guard denied');return {isPlatformAdmin:false,profile:{display_name:'Synthetic customer'}}},
    supabase:{from(table){assert.equal(table,'websites');return {select(fields){assert.equal(fields,'id');return this},limit(n){assert.equal(n,1);return this},async maybeSingle(){calls.push('lookup');return {data:{id:websiteId},error:null}}}}},
    loadWebsiteDraft:async id=>{assert.equal(id,websiteId);calls.push('load');return {website:{id,company_id:'synthetic-company',name:'Synthetic project',public_slug:'synthetic-project'},draft:{content,revision:1}}},
    saveDraft:async(id,body,revision)=>{saved.push({id,body:JSON.parse(JSON.stringify(body)),revision});return save?save(id,body,revision):{revision:revision+1}},
    renameWebsite:async(id,name)=>{calls.push('rename');return rename?rename(id,name):{name:name.trim()}},
    publishSite:async(id,revision,key)=>{published.push({id,revision,key});if(!publish)throw Error('Unexpected simulated publish');return publish(id,revision,key)},
    signOut:()=>calls.push('signOut'),setTimeout:setTimer,clearTimeout:clearTimer
  })
  vm.runInContext(dataSource,context)
  return {elements,calls,saved,published,timers,advance,flush,document,panelButtons,viewButtons,topbar,shell,dialog,run:(code=source)=>vm.runInContext('(async()=>{\n'+code.replace(/^import .*$/gm,'')+'\n})()',context)}
}
test('actual complete Builder module initializes real project content and renders both previews',async()=>{
  const h=harness();await h.run()
  assert.deepEqual(h.calls,['aal2','lookup','load'])
  assert.equal(h.elements.projectName.value,'Synthetic project')
  assert.equal(h.elements['f-businessName'].value,'Synthetic startup test')
  assert.equal(h.elements['f-heroTitle'].value,'Synthetic heading')
  for(const id of ['previewDesktop','previewMobile']) assert.match(h.elements[id].innerHTML,/Synthetic heading/)
  assert(h.elements.codeBtn.disabled);assert(h.elements['f-status'].disabled)
  assert.equal(h.saved.length,0);assert.equal(h.timers.length,0)
  assert.equal(typeof h.elements.logoutBtn.events.click,'function')
})
test('real field input updates the visible preview immediately',async()=>{
  const h=harness();await h.run()
  h.elements['f-heroTitle'].value='Changed synthetic heading'
  h.elements['f-heroTitle'].events.input()
  assert.match(h.elements.previewDesktop.innerHTML,/Changed synthetic heading/)
  assert.match(h.elements.previewMobile.innerHTML,/Changed synthetic heading/)
  assert.equal(h.saved.length,0,'render must not write')
})
test('rendering escapes edited HTML, preserves inactive pages and does not mutate project data',async()=>{
  const content=projectContent();content.pages.push({...content.pages[0],id:'other',name:'Other',heroTitle:'Inactive title'})
  const h=harness({content});await h.run();const before=JSON.stringify(content)
  h.elements['f-heroTitle'].value='<img src=x onerror=alert(1)>'
  h.elements['f-heroTitle'].events.input()
  for(const id of ['previewDesktop','previewMobile']) {
    assert.match(h.elements[id].innerHTML,/&lt;img src=x onerror=alert\(1\)&gt;/)
    assert.doesNotMatch(h.elements[id].innerHTML,/<img/)
  }
  assert.equal(JSON.stringify(content),before);assert.equal(h.saved.length,0)
  await h.elements.saveBtn.events.click()
  assert.equal(h.saved[0].body.pages[1].heroTitle,'Inactive title')
})
test('actual panel click/arrow/Home/End handlers select accessible panels without saving edits',async()=>{
  const h=harness();await h.run()
  h.elements['f-heroTitle'].value='Pending edit';h.elements['f-heroTitle'].events.input()
  const timers=h.timers.length
  h.panelButtons[2].events.click()
  assert.equal(h.panelButtons[2].attrs['aria-selected'],'true');assert.equal(h.panelButtons[2].tabIndex,0)
  assert.equal(h.elements['panel-innhold'].hidden,false);assert.equal(h.elements['panel-oppsett'].hidden,true)
  for(const [index,key,target] of [[2,'ArrowRight',3],[3,'Home',0],[0,'End',3],[3,'ArrowRight',0],[0,'ArrowLeft',3]]) {
    let prevented=false;h.panelButtons[index].events.keydown({key,preventDefault(){prevented=true}})
    assert(prevented);assert.equal(h.document.activeElement,h.panelButtons[target]);assert.equal(h.panelButtons[target].attrs['aria-selected'],'true')
  }
  assert.equal(h.elements['f-heroTitle'].value,'Pending edit');assert.equal(h.saved.length,0);assert.equal(h.timers.length,timers)
})
for(const mobile of [false,true]) test('actual view buttons preserve edits and never save; mobile='+mobile,async()=>{
  const h=harness({mobile});await h.run()
  assert.equal(h.elements.mockupMobile.hidden,!mobile)
  h.elements['f-heroTitle'].value='Unsaved preview';h.elements['f-heroTitle'].events.input()
  const timers=h.timers.length
  for(const button of h.viewButtons){button.events.click();assert.equal(button.attrs['aria-pressed'],'true');assert.equal(h.elements.mockupDesktop.hidden,button.dataset.view!=='desktop');assert.equal(h.elements.mockupMobile.hidden,button.dataset.view!=='mobile')}
  assert.match(h.elements.previewDesktop.innerHTML,/Unsaved preview/);assert.match(h.elements.previewMobile.innerHTML,/Unsaved preview/)
  assert.equal(h.saved.length,0);assert.equal(h.timers.length,timers)
})
test('actual publish dialog traps focus, closes via Escape/cancel and restores scroll without writes',async()=>{
  const h=harness();await h.run();h.elements.publishBtn.focus();h.elements.publishBtn.events.click()
  assert.equal(h.dialog.attrs.role,'dialog');assert.equal(h.document.activeElement,h.elements.publishPersonalKey)
  assert(h.topbar.inert);assert(h.shell.inert);assert.equal(h.document.body.style.overflow,'hidden')
  h.elements.publishModal.events.keydown({key:'Tab',shiftKey:true,preventDefault(){}})
  assert.equal(h.document.activeElement,h.elements.closeModal)
  h.elements.publishModal.events.keydown({key:'Tab',shiftKey:false,preventDefault(){}})
  assert.equal(h.document.activeElement,h.elements.publishPersonalKey)
  h.elements.publishModal.events.keydown({key:'Escape',preventDefault(){}})
  assert(!h.elements.publishModal.classList.contains('open'));assert.equal(h.document.activeElement,h.elements.publishBtn)
  assert(!h.topbar.inert);assert(!h.shell.inert);assert.equal(h.document.body.style.overflow,'auto')
  h.elements.publishBtn.events.click();h.elements.closeModal.events.click()
  assert.equal(h.document.activeElement,h.elements.publishBtn);assert.equal(h.saved.length,0)
})
test('real save handler retains edited content and revision contract across a fresh startup',async()=>{
  const h=harness({search:'?website='+websiteId});await h.run()
  assert.deepEqual(h.calls,['aal2','load'])
  h.elements['f-heroTitle'].value='Changed synthetic heading'
  h.elements['f-heroTitle'].events.input()
  assert.equal(h.elements.saveStatus.textContent,'Ulagrede endringer')
  await h.elements.saveBtn.events.click()
  assert.equal(h.saved.length,1);assert.equal(h.saved[0].id,websiteId);assert.equal(h.saved[0].revision,1)
  assert.equal(h.saved[0].body.pages[0].heroTitle,'Changed synthetic heading')
  assert.equal(h.saved[0].body.status,'draft');assert.equal(h.elements.lastSavedInfo.textContent,'Nå nettopp')
  const reloaded=harness({content:h.saved[0].body});await reloaded.run()
  assert.equal(reloaded.elements['f-heroTitle'].value,'Changed synthetic heading')
  assert.match(reloaded.elements.previewDesktop.innerHTML,/Changed synthetic heading/)
})
test('complete startup still stops at denied AAL2 guard before loading project',async()=>{
  const h=harness({denied:true});await assert.rejects(h.run(),/guard denied/)
  assert.deepEqual(h.calls,['aal2']);assert.equal(h.elements.previewDesktop.innerHTML,'')
})
test('same runtime harness detects the actual baseline initialization defect',async()=>{
  const baseline=execFileSync('git',['show','85cb16a4156744c779b842d2bcbcf433f065a7d9:js/builder.js'],{cwd:root,encoding:'utf8'})
  const h=harness()
  await assert.rejects(h.run(baseline),/Cannot access 'wide' before initialization/)
  assert.deepEqual(h.calls,['aal2','lookup','load']);assert.equal(h.saved.length,0)
})

test('real page controls preserve unsaved edits and other pages across save/reload',async()=>{
  const h=harness();await h.run()
  h.elements['f-heroTitle'].value='Unsaved home';h.elements['f-heroTitle'].events.input()
  h.elements.newPageName.value='Om oss';h.elements.addPageBtn.events.click()
  assert.equal(h.elements.pageList.children.length,2);assert.equal(h.saved.length,0)
  assert.equal(h.elements['f-heroTitle'].value,'Om oss')
  h.elements.addSectionMenu.children[0].click()
  h.elements['f-heroTitle'].value='Second page';h.elements['f-heroTitle'].events.input()
  h.elements.pageList.children[0].click();assert.equal(h.elements['f-heroTitle'].value,'Unsaved home')
  h.elements.pageList.children[1].click();assert.match(h.elements.previewDesktop.innerHTML,/Second page/)
  await h.elements.saveBtn.events.click()
  const content=h.saved[0].body;assert.equal(content.pages[0].heroTitle,'Unsaved home');assert.equal(content.pages[1].heroTitle,'Second page')
  const reloaded=harness({content});await reloaded.run();assert.equal(reloaded.elements['f-heroTitle'].value,'Second page')
  reloaded.elements.pageList.children[0].click();assert.equal(reloaded.elements['f-heroTitle'].value,'Unsaved home')
})
test('page name errors are visible and do not create pages or write',async()=>{
  const h=harness();await h.run()
  for(const name of ['', 'x'.repeat(121), 'bad\nname']) {h.elements.newPageName.value=name;h.elements.addPageBtn.events.click();assert.match(h.elements.pageError.textContent,/1–120/);assert.equal(h.elements.pageList.children.length,1)}
  assert.equal(h.saved.length,0)
})
test('section buttons, switches and actual drag handlers update order and both previews without writes',async()=>{
  const h=harness();await h.run()
  h.elements.sectionList.children[1].children[1].click() // About up, keyboard-operable native button
  assert(h.elements.previewDesktop.innerHTML.indexOf('intro')<h.elements.previewDesktop.innerHTML.indexOf('class="hero"'))
  const toggle=h.elements.sectionList.children[0].children[0].children[0];toggle.checked=false;toggle.events.change()
  assert.doesNotMatch(h.elements.previewMobile.innerHTML,/class="section intro"/)
  const first=h.elements.sectionList.children[0],second=h.elements.sectionList.children[1]
  first.events.dragstart({dataTransfer:{setData(){}}});second.events.drop({preventDefault(){}})
  await h.elements.saveBtn.events.click();assert.deepEqual(h.saved[0].body.pages[0].sections.map(s=>s.id),['hero','about']);assert.equal(h.saved[0].body.pages[0].sections[1].enabled,false)
  const reloaded=harness({content:h.saved[0].body});await reloaded.run();assert.doesNotMatch(reloaded.elements.previewMobile.innerHTML,/class="section intro"/)
})
test('template cancel preserves every draft field and performs no request',async()=>{
  const h=harness();await h.run();h.elements['f-heroTitle'].value='Pending edit';h.elements['f-heroTitle'].events.input()
  const preview=h.elements.previewDesktop.innerHTML
  h.elements['f-template'].value='frisor';h.elements['f-template'].events.change()
  assert(h.elements.templateModal.classList.contains('open'));assert.equal(h.elements.replaceTemplateContent.checked,false)
  h.elements.cancelTemplateBtn.click();assert.equal(h.saved.length,0);assert.equal(h.elements.previewDesktop.innerHTML,preview);assert.equal(h.elements['f-template'].value,'restaurant')
  assert.equal(h.document.activeElement,h.elements['f-template'],'cancel returns keyboard focus to the template control')
  await h.elements.saveBtn.click();assert.equal(h.saved[0].body.pages[0].heroTitle,'Pending edit');assert.equal(h.saved[0].body.templateId,'restaurant')
})
test('confirmed template preserves customer content by default, actually changes layout and persists across reload',async()=>{
  const h=harness();await h.run();h.elements['f-heroTitle'].value='Keep my words';h.elements['f-heroTitle'].events.input()
  h.elements['f-template'].value='frisor';h.elements['f-template'].events.change();await h.elements.confirmTemplateBtn.click()
  assert.equal(h.saved.length,1);assert.equal(h.saved[0].body.templateId,'frisor');assert.equal(h.saved[0].body.pages[0].heroTitle,'Keep my words');assert.match(h.saved[0].body.bg,/^#[0-9a-f]{6}$/i)
  assert(!h.elements.templateModal.classList.contains('open'));assert.match(h.elements.previewDesktop.innerHTML,/draft-layout-frisor/)
  assert.equal(h.document.activeElement,h.elements['f-template'],'saved template returns focus to the template control')
  const reloaded=harness({content:h.saved[0].body});await reloaded.run();assert.equal(reloaded.elements['f-template'].value,'frisor');assert.match(reloaded.elements.previewMobile.innerHTML,/Keep my words/)
})
test('explicit template replacement clears only chosen page, retains identities and inserts no fabricated customers',async()=>{
  const content=projectContent();content.pages.push({...content.pages[0],id:'other',slug:'other',name:'Other',heroTitle:'Keep other',sections:[]})
  const h=harness({content});await h.run();h.elements['f-template'].value='eiendom';h.elements['f-template'].events.change();h.elements.replaceTemplateContent.checked=true;await h.elements.confirmTemplateBtn.click()
  const saved=h.saved[0];assert.equal(saved.id,websiteId);assert.equal(saved.body.pages[0].id,'home');assert.equal(saved.body.pages[0].slug,'');assert.equal(saved.body.pages[0].heroTitle,'Forside');assert.equal(saved.body.pages[0].aboutText,'')
  assert.equal(saved.body.pages[1].heroTitle,'Keep other');assert.equal(saved.body.businessName,content.businessName);assert.equal(saved.body.status,'draft');assert.equal(saved.body.pages.length,2)
})
for(const code of ['STALE_REVISION','NETWORK_ERROR']) test('template '+code+' keeps edits, does not claim success or reload',async()=>{
  const h=harness({save:async()=>{throw Object.assign(Error('private internals'),{code})}});await h.run()
  h.elements['f-heroTitle'].value='Do not lose';h.elements['f-heroTitle'].events.input()
  h.elements['f-template'].value='frisor';h.elements['f-template'].events.change();await h.elements.confirmTemplateBtn.click()
  assert.equal(h.saved.length,1);assert(h.elements.templateModal.classList.contains('open'));assert.equal(h.elements['f-template'].value,'restaurant');assert.equal(h.elements['f-heroTitle'].value,'Do not lose')
  assert.match(h.elements.templateError.textContent,/beholdt/);assert.doesNotMatch(h.elements.templateError.textContent,/private internals/);assert.notEqual(h.elements.lastSavedInfo.textContent,'Nå nettopp')
  h.elements.cancelTemplateBtn.click();assert.match(h.elements.previewDesktop.innerHTML,/Do not lose/)
})
test('template confirmation cannot double submit and waits for an in-flight draft revision',async()=>{
  let finish;let count=0
  const h=harness({save:async(id,body,revision)=>{if(++count===1)await new Promise(resolve=>{finish=resolve});return {revision:revision+1}}});await h.run()
  const first=h.elements.saveBtn.click();h.elements['f-template'].value='frisor';h.elements['f-template'].events.change()
  const change=h.elements.confirmTemplateBtn.click();await h.elements.confirmTemplateBtn.click();assert.equal(h.saved.length,1)
  finish();await first;await change;assert.equal(h.saved.length,2);assert.deepEqual(h.saved.map(s=>s.revision),[1,2]);assert.equal(h.saved[1].body.templateId,'frisor')
})
test('project name uses separate trusted operation, not businessName or draft',async()=>{
  const h=harness({rename:async(id,name)=>{assert.equal(id,websiteId);assert.equal(name,' New project ');return {name:'New project'}}});await h.run();h.elements.projectName.value=' New project ';await h.elements.renameProjectBtn.click()
  assert.equal(h.elements.projectName.value,'New project');assert.match(h.elements.ownerTag.textContent,/New project/);assert.equal(h.elements['f-businessName'].value,'Synthetic startup test');assert.equal(h.saved.length,0)
})
test('rename rejection is visible, retains entered name and unlocks retry',async()=>{
  const h=harness({rename:async()=>{throw Error('private server details')}});await h.run();h.elements.projectName.value='Pending name';await h.elements.renameProjectBtn.click()
  assert.equal(h.elements.projectName.value,'Pending name');assert.match(h.elements.renameStatus.textContent,/ikke bekreftet/);assert.doesNotMatch(h.elements.renameStatus.textContent,/private server/);assert.equal(h.elements.renameProjectBtn.disabled,false)
})

const edit=(h,value)=>{h.elements['f-heroTitle'].value=value;h.elements['f-heroTitle'].events.input()}
const chooseTemplate=h=>{h.elements['f-template'].value='frisor';h.elements['f-template'].events.change()}
const cancelTemplate=(h,method)=>method==='Escape'?h.elements.templateModal.events.keydown({key:'Escape',preventDefault(){}}):h.elements.cancelTemplateBtn.click()
const preparePublish=h=>{h.elements.publishBtn.click();h.elements.publishPersonalKey.value='synthetic-unit-test-key'}

test('controllable timers debounce edits, respect clearTimeout and do not fire early',async()=>{
  const h=harness();await h.run();edit(h,'First');await h.advance(500);edit(h,'Second')
  await h.advance(799);assert.equal(h.saved.length,0);assert.equal(h.timers.length,1)
  await h.advance(1);assert.equal(h.saved.length,1);assert.equal(h.saved[0].body.pages[0].heroTitle,'Second')
  await h.advance(5000);assert.equal(h.saved.length,1);assert.equal(h.timers.length,0)
})
for(const method of ['Avbryt','Escape']) test('ordinary template '+method+' resumes exactly one original-draft autosave',async()=>{
  const h=harness();await h.run();edit(h,'Original pending edit');await h.advance(400);chooseTemplate(h)
  await h.advance(3000);assert.equal(h.saved.length,0)
  cancelTemplate(h,method);await h.advance(799);assert.equal(h.saved.length,0)
  await h.advance(1);assert.equal(h.saved.length,1);assert.equal(h.saved[0].body.templateId,'restaurant');assert.equal(h.saved[0].body.pages[0].heroTitle,'Original pending edit')
  await h.advance(5000);assert.equal(h.saved.length,1)
})
test('canceling clean template does not save; manual save supersedes resumed timer',async()=>{
  const h=harness();await h.run();chooseTemplate(h);cancelTemplate(h,'Avbryt');await h.advance(2000);assert.equal(h.saved.length,0)
  edit(h,'Pending');chooseTemplate(h);cancelTemplate(h,'Escape');await h.elements.saveBtn.click();await h.advance(2000);assert.equal(h.saved.length,1)
})
test('cancel while original autosave is in flight does not duplicate an acknowledged revision',async()=>{
  let finish
  const h=harness({save:()=>new Promise(resolve=>{finish=resolve})});await h.run();edit(h,'Pending');await h.advance(800);chooseTemplate(h);cancelTemplate(h,'Avbryt')
  await h.advance(800);assert.equal(h.saved.length,1);finish({revision:2});await h.flush();await h.advance(4000)
  assert.equal(h.saved.length,1);assert.equal(h.elements.saveStatus.textContent,'Alt lagret')
})
for(const code of ['NETWORK_ERROR','STALE_REVISION']) for(const method of ['Avbryt','Escape']) test('attempted template '+code+' then '+method+' never autosaves over unresolved state',async()=>{
  const h=harness({save:async()=>{throw Object.assign(Error('private error'),{code})}});await h.run();edit(h,'Keep original');chooseTemplate(h);await h.elements.confirmTemplateBtn.click();cancelTemplate(h,method)
  await h.advance(10000);edit(h,'Still keep original');await h.advance(10000);chooseTemplate(h);cancelTemplate(h,method);await h.advance(10000)
  assert.equal(h.saved.length,1);assert.equal(h.elements['f-template'].value,'restaurant');assert.equal(h.elements['f-heroTitle'].value,'Still keep original');assert.equal(h.timers.length,0)
})
test('successful template acknowledgement cancels old timer and needs no duplicate save',async()=>{
  const h=harness();await h.run();edit(h,'Keep');chooseTemplate(h);await h.elements.confirmTemplateBtn.click();await h.advance(5000)
  assert.equal(h.saved.length,1);assert.equal(h.saved[0].body.templateId,'frisor')
})
for(const code of ['NETWORK_ERROR','STALE_REVISION']) test('publish stops after '+code+' saving failure, retains edits and never calls publishing',async()=>{
  const h=harness({save:async()=>{throw Object.assign(Error('private error'),{code})}});await h.run();edit(h,'Do not lose');preparePublish(h)
  await h.elements.confirmPublishBtn.click();await h.advance(4000)
  assert.equal(h.saved.length,1);assert.equal(h.published.length,0);assert.equal(h.elements['f-heroTitle'].value,'Do not lose')
  assert(h.elements.publishError.classList.contains('show'));assert.match(h.elements.publishError.textContent,/lagring er ikke bekreftet/);assert.doesNotMatch(h.elements.publishError.textContent,/private error/)
  assert(!h.elements.confirmPublishBtn.disabled);assert(h.elements.publishModal.classList.contains('open'))
})
test('publish waits for acknowledged draft and forwards unchanged server parameters once',async()=>{
  let finish
  const h=harness({save:()=>new Promise(resolve=>{finish=resolve}),publish:async()=>({version:7})});await h.run();edit(h,'Expected');preparePublish(h)
  const result=h.elements.confirmPublishBtn.click();await h.elements.confirmPublishBtn.click();await h.advance(2000)
  assert.equal(h.saved.length,1);assert.equal(h.published.length,0);assert(h.elements.confirmPublishBtn.disabled)
  h.elements.publishModal.events.keydown({key:'Escape',preventDefault(){}});assert(h.elements.publishModal.classList.contains('open'))
  finish({revision:2});await result
  assert.deepEqual(h.published,[{id:websiteId,revision:2,key:'synthetic-unit-test-key'}]);assert.equal(h.elements.saveStatus.textContent,'Publisert versjon 7 ✓');assert.equal(h.elements.publishPersonalKey.value,'')
})
test('edits arriving during required save block publish until the user confirms the newer content',async()=>{
  let finish
  const h=harness({save:()=>new Promise(resolve=>{finish=resolve}),publish:async()=>({version:1})});await h.run();edit(h,'At confirmation');preparePublish(h)
  const result=h.elements.confirmPublishBtn.click();edit(h,'Newer edit');finish({revision:2});await result;await h.advance(3000)
  assert.equal(h.published.length,0);assert.equal(h.saved.length,1);assert.match(h.elements.publishError.textContent,/endret under lagring/);assert.equal(h.elements['f-heroTitle'].value,'Newer edit')
  const retry=h.elements.confirmPublishBtn.click();assert.equal(h.saved[1].body.pages[0].heroTitle,'Newer edit');finish({revision:3});await retry
  assert.equal(h.published.length,1);assert.equal(h.published[0].revision,3)
})
test('publish joins existing autosave without duplicate save and denies if that autosave fails',async()=>{
  let reject
  const h=harness({save:()=>new Promise((resolve,no)=>{reject=no})});await h.run();edit(h,'Pending');await h.advance(800);preparePublish(h)
  const result=h.elements.confirmPublishBtn.click();reject(Error('network'));await result;await h.advance(4000)
  assert.equal(h.saved.length,1);assert.equal(h.published.length,0)
})
test('an unexpected edit during publish response is never described as published content',async()=>{
  let finish
  const h=harness({publish:()=>new Promise(resolve=>{finish=resolve})});await h.run();edit(h,'Confirmed');preparePublish(h)
  const result=h.elements.confirmPublishBtn.click();await h.flush();assert.equal(h.published.length,1)
  edit(h,'Later local edit');finish({version:9});await result
  assert.match(h.elements.saveStatus.textContent,/nyere åpne redigeringer er ikke publisert/);assert.doesNotMatch(h.elements.saveStatus.textContent,/✓/);assert.equal(h.elements['f-heroTitle'].value,'Later local edit')
})
test('publication rejection is visible, preserves edits and does not claim success',async()=>{
  const h=harness({publish:async()=>{throw Object.assign(Error('private error'),{code:'STALE_REVISION'})}});await h.run();edit(h,'Kept');preparePublish(h);await h.elements.confirmPublishBtn.click()
  assert.equal(h.published.length,1);assert.match(h.elements.publishError.textContent,/avklar versjonen/);assert(h.elements.publishModal.classList.contains('open'));assert.doesNotMatch(h.elements.saveStatus.textContent,/Publisert/)
})
