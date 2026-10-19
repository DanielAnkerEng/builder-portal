import { supabase } from './supabase.js'
import { requireAal2, signOut } from './auth.js'
import { loadWebsiteDraft, publishSite, saveDraft } from './api.js'
import { SECTION_TYPES, copy, emptyDraft, normalizeSections, addPage, addSection, moveSection, templateDraft, renderDraftPage } from './builder-editor.mjs'
import { renameWebsite } from './builder-project-api.mjs'

const ctx=await requireAal2();const params=new URLSearchParams(location.search);let websiteId=params.get('website')
if(!websiteId){const{data}=await supabase.from('websites').select('id').limit(1).maybeSingle();websiteId=data?.id}
if(!websiteId){
  const empty=document.createElement('main'),title=document.createElement('h1'),logout=document.createElement('button')
  empty.className='missing'
  title.textContent='Ingen nettside er knyttet til kontoen.'
  logout.type='button';logout.className='btn btn-primary';logout.textContent='Logg ut'
  logout.addEventListener('click',signOut)
  empty.append(title,logout);document.body.replaceChildren(empty)
  throw new Error('No authorized website')
}
const loaded=await loadWebsiteDraft(websiteId),website=loaded.website;let revision=loaded.draft.revision
const wide=['businessName','accent','accent2','bg','domain','language','status','seoTitle','seoDesc','templateId'];
let siteData=normalizeSections(migrateToPages(copy(loaded.draft.content))||emptyDraft(website.name));siteData.status='draft';let state=flatten();let saveTimer=null
let saving=null,editVersion=0,savedEditVersion=0,templateBusy=false,publishBusy=false,saveBlocked=false
const isAdmin=ctx.isPlatformAdmin;document.getElementById('userEmail').textContent=`${ctx.profile.display_name} (${isAdmin?'Wreach-admin':'kunde'})`;document.getElementById('userAvatarBtn').textContent=ctx.profile.display_name.slice(0,2).toUpperCase();document.getElementById('logoutBtn').addEventListener('click',signOut);document.getElementById('userAvatarBtn').addEventListener('click',()=>document.getElementById('userDropdown').classList.toggle('open'))
document.getElementById('projectName').value=website.name;document.getElementById('ownerTag').textContent=`${website.name} · privat utkast`;document.getElementById('ownerTag').style.display='inline-block';document.getElementById('customerSaveBar').style.display='block';document.getElementById('viewSiteBtn').href=`site.html?slug=${encodeURIComponent(website.public_slug)}`
document.getElementById('f-status').value='draft';document.getElementById('f-status').disabled=true
document.getElementById('codeBtn').disabled=true;document.getElementById('codeBtn').title='Egendefinert JavaScript er deaktivert i Security V2'

function page(){return siteData.pages.find(p=>p.id===siteData.activePageId)||siteData.pages[0]}function flatten(){const result={};for(const k of wide)result[k]=siteData[k];for(const k of PAGE_CONTENT_KEYS)result[k]=page()[k];return result}function commit(){for(const k of wide)siteData[k]=state[k];for(const k of PAGE_CONTENT_KEYS)page()[k]=state[k];siteData.status='draft'}
const fieldMap={'f-businessName':'businessName','f-heroTag':'heroTag','f-heroTitle':'heroTitle','f-heroSub':'heroSub','f-cta':'cta','f-badge':'badge','f-aboutTitle':'aboutTitle','f-aboutText':'aboutText','f-offeringsLabel':'offeringsLabel','f-address':'address','f-hours':'hours','f-domain':'domain','f-seoTitle':'seoTitle','f-seoDesc':'seoDesc','f-accent':'accent','f-accent2':'accent2'}
for(const[id,key]of Object.entries(fieldMap)){const el=document.getElementById(id);if(!el)continue;el.value=state[key]||'';el.addEventListener('input',()=>{state[key]=el.value;render();schedule()})}
const templateSelect=document.getElementById('f-template');for(const t of BUILDER_TEMPLATES){const option=document.createElement('option');option.value=t.id;option.textContent=`${t.icon} ${t.label}`;templateSelect.append(option)}templateSelect.value=state.templateId;templateSelect.addEventListener('change',()=>openTemplateDialog(templateSelect.value))
document.getElementById('f-language').value=state.language||'no';document.getElementById('f-language').addEventListener('change',e=>{state.language=e.target.value;schedule()})

function esc(value){return String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function preview(){return renderDraftPage(state,state)}
function render(){const html=preview();document.getElementById('previewDesktop').innerHTML=html;document.getElementById('previewMobile').innerHTML=html;document.getElementById('browserUrl').textContent=website.domain||website.public_slug}
function cancelAutosave(){clearTimeout(saveTimer);saveTimer=null}
function resumeAutosave(){
  cancelAutosave()
  if(editVersion!==savedEditVersion&&!saveBlocked&&!templateBusy&&!publishBusy&&!document.getElementById('templateModal').classList.contains('open'))
    saveTimer=setTimeout(()=>{saveTimer=null;return persist(false)},800)
}
function schedule(){editVersion++;document.getElementById('saveStatus').textContent=saveBlocked?'Lagring må avklares før flere endringer lagres.':'Ulagrede endringer';document.getElementById('customerSaveHint').textContent='Du har endringer som ikke er lagret';resumeAutosave()}
function savedFeedback(show){document.getElementById('saveStatus').textContent=show?'Lagret ✓':'Alt lagret';document.getElementById('customerSaveHint').textContent=`Privat utkast · revisjon ${revision}`;document.getElementById('lastSavedInfo').textContent='Nå nettopp'}
async function persist(show=true){
  cancelAutosave()
  if(templateBusy)return false
  if(saveBlocked){document.getElementById('saveStatus').textContent='Lagring er satt på pause. Åpne redigeringer er beholdt; avklar lagret tilstand før nytt forsøk.';return false}
  if(saving){if(!await saving)return false;if(savedEditVersion===editVersion)return true;return persist(show)}
  commit();const version=editVersion,snapshot=copy(siteData)
  saving=(async()=>{try{const saved=await saveDraft(websiteId,snapshot,revision);revision=Number(saved.revision);savedEditVersion=version;if(version===editVersion)savedFeedback(show);return true}catch(error){saveBlocked=true;cancelAutosave();document.getElementById('saveStatus').textContent=error.code==='STALE_REVISION'?'Nyere versjon finnes. Endringene dine er fortsatt åpne.':'Lagring kunne ikke bekreftes. Endringene dine er fortsatt åpne. Avklar lagret tilstand før nytt forsøk.';return false}})()
  try{return await saving}finally{saving=null}
}
document.getElementById('saveBtn').addEventListener('click',()=>persist(true));document.getElementById('customerSaveBtn').addEventListener('click',()=>persist(true))
const modal=document.getElementById('publishModal'),publishError=document.getElementById('publishError')
document.getElementById('publishBtn').addEventListener('click',()=>{publishError.classList.remove('show');openPublishDialog()})
document.getElementById('closeModal').addEventListener('click',()=>closePublishDialog())
document.getElementById('confirmPublishBtn').addEventListener('click',async()=>{
  if(publishBusy)return
  publishBusy=true;dialogControls.forEach(control=>{control.disabled=true});publishError.classList.remove('show')
  const expectedEditVersion=editVersion,key=document.getElementById('publishPersonalKey').value
  try{
    if(!await persist(false))throw Object.assign(Error(),{code:'SAVE_NOT_CONFIRMED'})
    if(editVersion!==expectedEditVersion||savedEditVersion!==editVersion)throw Object.assign(Error(),{code:'EDITS_CHANGED'})
    const result=await publishSite(websiteId,revision,key)
    document.getElementById('publishPersonalKey').value=''
    publishBusy=false;closePublishDialog()
    document.getElementById('saveStatus').textContent=editVersion===expectedEditVersion?`Publisert versjon ${result.version} ✓`:`Versjon ${result.version} ble publisert, men nyere åpne redigeringer er ikke publisert.`
  }catch(error){
    publishError.textContent=error.code==='SAVE_NOT_CONFIRMED'?'Publisering stoppet: lagring er ikke bekreftet. Endringene er beholdt. Avklar lagret tilstand før nytt forsøk.':error.code==='EDITS_CHANGED'?'Utkastet ble endret under lagring. Ingenting er publisert. Kontroller endringene og bekreft på nytt.':error.code==='STALE_REVISION'?'Utkastet er endret. Endringene dine er beholdt; avklar versjonen før nytt forsøk.':'Publisering kunne ikke bekreftes. Kontroller lagret publiseringsstatus og tilgang før nytt forsøk.'
    publishError.classList.add('show')
  }finally{publishBusy=false;dialogControls.forEach(control=>{control.disabled=false})}
})
// Draft editing controls. Values are committed to their own page before switching.
const byId=id=>document.getElementById(id)
function button(label,action){const node=document.createElement('button');node.type='button';node.className='btn btn-outline btn-small';node.textContent=label;node.addEventListener('click',action);return node}
function refreshFields(){for(const[id,key]of Object.entries(fieldMap)){const el=byId(id);if(el)el.value=state[key]||''}templateSelect.value=state.templateId;byId('f-language').value=state.language||'no'}
function focusSelectedPage(){byId('pageList').children[siteData.pages.findIndex(p=>p.id===siteData.activePageId)]?.focus()}
function selectPage(id){if(templateBusy)return;commit();if(!siteData.pages.some(p=>p.id===id))return;siteData.activePageId=id;state=flatten();refreshFields();renderEditing();render();schedule();focusSelectedPage()}
function renderPages(){
  const list=byId('pageList');list.replaceChildren()
  for(const p of siteData.pages){const entry=button(p.name,()=>selectPage(p.id));entry.setAttribute('aria-pressed',String(p.id===siteData.activePageId));entry.title=p.slug||'Forside';list.append(entry)}
}
byId('addPageBtn').addEventListener('click',()=>{
  byId('pageError').textContent=''
  try{commit();siteData=addPage(siteData,byId('newPageName').value,crypto.randomUUID());state=flatten();byId('newPageName').value='';refreshFields();renderEditing();render();schedule();focusSelectedPage()}
  catch(error){byId('pageError').textContent=error.message}
})
byId('newPageName').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();byId('addPageBtn').click()}})
let draggedSection=null
function reorder(from,to){state.sections=moveSection(state.sections||[],from,to);renderSections();render();schedule();byId('sectionList').children[to]?.querySelector('button:not(:disabled)')?.focus()}
function renderSections(){
  const list=byId('sectionList');list.replaceChildren()
  for(const[s,section]of (state.sections||[]).entries()){
    const row=document.createElement('div');row.className='builder-section-row';row.draggable=true
    const label=document.createElement('label'),toggle=document.createElement('input'),text=document.createElement('span')
    toggle.type='checkbox';toggle.checked=section.enabled;toggle.setAttribute('aria-label','Vis '+section.name);text.textContent=section.name||section.id
    toggle.addEventListener('change',()=>{section.enabled=toggle.checked;render();schedule()});label.append(toggle,text)
    const up=button('Opp',()=>reorder(s,s-1)),down=button('Ned',()=>reorder(s,s+1))
    up.disabled=s===0;down.disabled=s===state.sections.length-1
    up.setAttribute('aria-label','Flytt '+section.name+' opp');down.setAttribute('aria-label','Flytt '+section.name+' ned')
    row.addEventListener('dragstart',event=>{draggedSection=s;event.dataTransfer?.setData('text/plain',section.id)})
    row.addEventListener('dragover',event=>event.preventDefault())
    row.addEventListener('drop',event=>{event.preventDefault();if(draggedSection!==null)reorder(draggedSection,s);draggedSection=null})
    row.addEventListener('dragend',()=>{draggedSection=null})
    row.append(label,up,down);list.append(row)
  }
  const menu=byId('addSectionMenu');menu.replaceChildren()
  for(const type of SECTION_TYPES){const entry=button(type.name,()=>{state.sections=addSection(state.sections||[],type.id);renderSections();render();schedule()});entry.disabled=(state.sections||[]).some(s=>s.id===type.id)||(state.sections||[]).length>=30;menu.append(entry)}
}
byId('addSectionBtn').setAttribute('aria-expanded','false');byId('addSectionMenu').hidden=true
byId('addSectionBtn').addEventListener('click',()=>{const menu=byId('addSectionMenu');menu.hidden=!menu.hidden;menu.classList.toggle('open',!menu.hidden);byId('addSectionBtn').setAttribute('aria-expanded',String(!menu.hidden))})
function renderItems(){
  const list=byId('offeringsEditor');list.replaceChildren()
  for(const[itemIndex,item]of (state.offerings||[]).entries()){
    const row=document.createElement('div');row.className='field-group'
    for(const[key,label,max]of [['t','Tittel',300],['d','Beskrivelse',2000]]){const field=document.createElement('label'),caption=document.createElement('span'),input=document.createElement('input');field.className='b-field';caption.textContent=label;input.value=item[key];input.maxLength=max;input.setAttribute('aria-label',label+' for tilbud '+(itemIndex+1));input.addEventListener('input',()=>{item[key]=input.value;render();schedule()});field.append(caption,input);row.append(field)}
    row.append(button('Fjern tilbud',()=>{state.offerings.splice(itemIndex,1);renderItems();render();schedule()}));list.append(row)
  }
  const gallery=byId('galleryEditor');gallery.replaceChildren()
  for(const[index,item]of (state.gallery||[]).entries()){
    const row=document.createElement('div'),input=document.createElement('input');input.value=item.emoji||'';input.maxLength=32;input.setAttribute('aria-label','Gallerisymbol '+(index+1));input.addEventListener('input',()=>{item.emoji=input.value;render();schedule()});row.append(input,button('Fjern galleri-element',()=>{state.gallery.splice(index,1);renderItems();render();schedule()}));gallery.append(row)
  }
}
byId('addOfferingBtn').addEventListener('click',()=>{if((state.offerings||[]).length>=100)return;state.offerings=[...(state.offerings||[]),{t:'',d:''}];renderItems();render();schedule()})
byId('addGalleryItemBtn').textContent='+ Legg til gallerisymbol (ikke bildeopplasting)'
byId('addGalleryItemBtn').addEventListener('click',()=>{if((state.gallery||[]).length>=100)return;state.gallery=[...(state.gallery||[]),{emoji:'',img:null}];renderItems();render();schedule()})
function renderEditing(){renderPages();renderSections();renderItems()}
renderEditing()
byId('renameProjectBtn').addEventListener('click',async()=>{
  const control=byId('renameProjectBtn'),input=byId('projectName'),feedback=byId('renameStatus');if(control.disabled)return
  control.disabled=true;input.disabled=true;feedback.textContent='Lagrer navn …'
  try{const result=await renameWebsite(websiteId,input.value);website.name=result.name;input.value=result.name;byId('ownerTag').textContent=`${result.name} · privat utkast`;feedback.textContent='Prosjektnavnet er lagret.'}
  catch{feedback.textContent='Navnet ble ikke bekreftet lagret. Bruk 1–160 tegn og kontroller tilgang/forbindelse.'}
  finally{control.disabled=false;input.disabled=false}
})
const templateModal=byId('templateModal'),templateControls=['replaceTemplateContent','confirmTemplateBtn','cancelTemplateBtn'].map(byId)
let selectedTemplate=null,templateReturnFocus=null,templateOverflow='',templateInert=[],templateAttempted=false
function openTemplateDialog(id){
  selectedTemplate=BUILDER_TEMPLATES.find(t=>t.id===id);templateSelect.value=state.templateId;if(!selectedTemplate)return
  cancelAutosave();templateAttempted=false;templateReturnFocus=templateSelect;templateOverflow=document.body.style.overflow
  templateInert=dialogBackground.map(el=>el.inert);dialogBackground.forEach(el=>{el.inert=true});document.body.style.overflow='hidden'
  byId('replaceTemplateContent').checked=false;byId('templateError').textContent='';byId('templateSummary').textContent='Valgt mal: '+selectedTemplate.label+' · valgt side: '+page().name
  templateModal.classList.add('open');templateControls[0].focus()
}
function closeTemplateDialog(){if(templateBusy)return;templateModal.classList.remove('open');document.body.style.overflow=templateOverflow;dialogBackground.forEach((el,i)=>{el.inert=templateInert[i]});templateReturnFocus?.focus();if(!templateAttempted)resumeAutosave()}
byId('cancelTemplateBtn').addEventListener('click',closeTemplateDialog)
byId('confirmTemplateBtn').addEventListener('click',async()=>{
  if(templateBusy||saveBlocked){byId('templateError').textContent='Lagret tilstand må avklares før nytt malbytte. Åpne redigeringer er beholdt.';return}templateBusy=true;templateControls.forEach(el=>{el.disabled=true});byId('templateError').textContent='Lagrer privat utkast …';cancelAutosave()
  try{
    if(saving&&!await saving)throw Error('SAVE_FAILED')
    commit();const candidate=templateDraft(siteData,selectedTemplate,byId('replaceTemplateContent').checked)
    templateAttempted=true
    const saved=await saveDraft(websiteId,candidate,revision)
    revision=Number(saved.revision);savedEditVersion=editVersion;siteData=candidate;state=flatten();refreshFields();renderEditing();render();savedFeedback(true)
    templateBusy=false;closeTemplateDialog()
  }catch(error){saveBlocked=true;cancelAutosave();byId('saveStatus').textContent='Malbytte må avklares før videre lagring. Åpne redigeringer er beholdt.';byId('templateError').textContent=error.code==='STALE_REVISION'?'En nyere revisjon finnes. Malbyttet er ikke lagret. Dine åpne redigeringer er beholdt. Avbryt og avklar versjonen før nytt forsøk.':'Malbyttet kunne ikke bekreftes lagret. Dine åpne redigeringer er beholdt. Ikke gjenta ved uklart nettverksresultat før lagret tilstand er kontrollert.'}
  finally{templateBusy=false;templateControls.forEach(el=>{el.disabled=false})}
})
templateModal.addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.preventDefault();closeTemplateDialog()}
  if(event.key==='Tab'){const enabled=templateControls.filter(el=>!el.disabled),first=enabled[0],last=enabled[enabled.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}}
})
// BEGIN BUILDER PRESENTATION CONTROLS — no persistence or authorization actions.
const panelButtons=[...document.querySelectorAll('.sidebar-tabs .sidebar-tab')]
document.querySelector('.sidebar-tabs').setAttribute('role','tablist')
document.querySelector('.sidebar-tabs').setAttribute('aria-label','Nettsideverktøy')
function selectPanel(selected) {
  for(const button of panelButtons) {
    const active=button===selected, panel=document.getElementById('panel-'+button.dataset.tab)
    button.classList.toggle('active',active);button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1
    panel.classList.toggle('active',active);panel.hidden=!active
  }
}
for(const button of panelButtons) {
  button.id='builder-tab-'+button.dataset.tab;button.setAttribute('role','tab')
  button.setAttribute('aria-controls','panel-'+button.dataset.tab)
  const panel=document.getElementById('panel-'+button.dataset.tab)
  panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',button.id);panel.tabIndex=0
  button.addEventListener('click',()=>selectPanel(button))
  button.addEventListener('keydown',event=>{
    const index=panelButtons.indexOf(button)
    const next=event.key==='Home'?0:event.key==='End'?panelButtons.length-1:event.key==='ArrowRight'?(index+1)%panelButtons.length:event.key==='ArrowLeft'?(index+panelButtons.length-1)%panelButtons.length:-1
    if(next<0)return
    event.preventDefault();selectPanel(panelButtons[next]);panelButtons[next].focus()
  })
}
selectPanel(panelButtons.find(button=>button.classList.contains('active'))||panelButtons[0])
const viewButtons=[...document.querySelectorAll('.topbar-center .view-btn[data-view]')]
function selectView(view) {
  for(const button of viewButtons){const active=button.dataset.view===view;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active))}
  document.getElementById('mockupDesktop').hidden=view!=='desktop'
  document.getElementById('mockupMobile').hidden=view!=='mobile'
}
for(const button of viewButtons)button.addEventListener('click',()=>selectView(button.dataset.view))
selectView(window.matchMedia('(max-width: 780px)').matches?'mobile':'desktop')
const dialog=modal.querySelector('.modal'),dialogControls=['publishPersonalKey','confirmPublishBtn','closeModal'].map(id=>document.getElementById(id))
dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label','Publiser nettsiden')
const dialogBackground=[document.querySelector('.topbar'),document.querySelector('.builder-shell')]
let dialogReturnFocus=null, previousOverflow='', previousInert=[]
function openPublishDialog(){
  if(modal.classList.contains('open'))return
  dialogReturnFocus=document.activeElement;previousOverflow=document.body.style.overflow
  previousInert=dialogBackground.map(element=>element.inert)
  dialogBackground.forEach(element=>{element.inert=true});document.body.style.overflow='hidden'
  modal.classList.add('open');dialogControls[0].focus()
}
function closePublishDialog(){
  if(publishBusy||!modal.classList.contains('open'))return
  modal.classList.remove('open');document.body.style.overflow=previousOverflow
  dialogBackground.forEach((element,index)=>{element.inert=previousInert[index]})
  dialogReturnFocus?.focus()
}
modal.addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.preventDefault();closePublishDialog()}
  if(event.key==='Tab'){
    const controls=dialogControls.filter(control=>!control.disabled),first=controls[0],last=controls[controls.length-1]
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}
  }
})
// END BUILDER PRESENTATION CONTROLS
document.getElementById('copyCodeBtn').disabled=true;document.getElementById('downloadDataBtn').style.display='none';document.getElementById('downloadHtmlBtn').style.display='none';render()
