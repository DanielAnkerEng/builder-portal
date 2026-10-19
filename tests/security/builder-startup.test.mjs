import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import {readFileSync} from 'node:fs'
import {execFileSync} from 'node:child_process'

const root=new URL('../../',import.meta.url)
const source=readFileSync(new URL('js/builder.js',root),'utf8')
const dataSource=readFileSync(new URL('js/builder-data.js',root),'utf8')
const html=readFileSync(new URL('builder.html',root),'utf8')
const websiteId='synthetic-local-project'
function projectContent(){return {
  businessName:'Synthetic startup test',accent:'#405735',accent2:'#526241',bg:'#ffffff',
  templateId:'restaurant',language:'no',status:'draft',activePageId:'home',
  pages:[{id:'home',slug:'',name:'Forside',heroTitle:'Synthetic heading',heroSub:'Synthetic text',
    cta:'Example',aboutTitle:'About',aboutText:'Synthetic only',offerings:[],gallery:[],sections:[]}]
}}
function harness({content=projectContent(),search='',denied=false,mobile=false}={}){
  const calls=[],saved=[],timers=[]
  const document={activeElement:null}
  const node=()=>{
    const classes=new Set()
    return {value:'',textContent:'',innerHTML:'',disabled:false,hidden:false,inert:false,style:{},events:{},children:[],attrs:{},dataset:{},
      classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c),toggle:(c,on)=>{const add=on??!classes.has(c);if(add)classes.add(c);else classes.delete(c)}},
      focus(){document.activeElement=this},setAttribute(key,value){this.attrs[key]=value},
      append(...children){this.children.push(...children)},addEventListener(type,fn){this.events[type]=fn}}
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
    document,window:{matchMedia:query=>{assert.equal(query,'(max-width: 780px)');return {matches:mobile}}},
    URLSearchParams,location:{search,reload(){throw Error('Unexpected navigation')}},
    requireAal2:async()=>{calls.push('aal2');if(denied)throw Error('guard denied');return {isPlatformAdmin:false,profile:{display_name:'Synthetic customer'}}},
    supabase:{from(table){assert.equal(table,'websites');return {select(fields){assert.equal(fields,'id');return this},limit(n){assert.equal(n,1);return this},async maybeSingle(){calls.push('lookup');return {data:{id:websiteId},error:null}}}}},
    loadWebsiteDraft:async id=>{assert.equal(id,websiteId);calls.push('load');return {website:{id,company_id:'synthetic-company',name:'Synthetic project',public_slug:'synthetic-project'},draft:{content,revision:1}}},
    saveDraft:async(id,body,revision)=>{saved.push({id,body:JSON.parse(JSON.stringify(body)),revision});return {revision:revision+1}},
    publishSite:async()=>{throw Error('Publishing must not occur during startup')},
    signOut:()=>calls.push('signOut'),setTimeout:fn=>{timers.push(fn);return timers.length},clearTimeout:()=>{}
  })
  vm.runInContext(dataSource,context)
  return {elements,calls,saved,timers,document,panelButtons,viewButtons,topbar,shell,dialog,run:(code=source)=>vm.runInContext('(async()=>{\n'+code.replace(/^import .*$/gm,'')+'\n})()',context)}
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
