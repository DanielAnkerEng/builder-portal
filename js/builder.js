import { supabase } from './supabase.js'
import { requireAal2, signOut } from './auth.js'
import { loadWebsiteDraft, publishSite, saveDraft } from './api.js'

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
let siteData=migrateToPages(loaded.draft.content)||freshStateFromTemplate('restaurant');siteData.status='draft';let state=flatten();let saveTimer=null
const isAdmin=ctx.isPlatformAdmin;document.getElementById('userEmail').textContent=`${ctx.profile.display_name} (${isAdmin?'Wreach-admin':'kunde'})`;document.getElementById('userAvatarBtn').textContent=ctx.profile.display_name.slice(0,2).toUpperCase();document.getElementById('logoutBtn').addEventListener('click',signOut);document.getElementById('userAvatarBtn').addEventListener('click',()=>document.getElementById('userDropdown').classList.toggle('open'))
document.getElementById('projectName').value=website.name;document.getElementById('ownerTag').textContent=`${website.name} · privat utkast`;document.getElementById('ownerTag').style.display='inline-block';document.getElementById('customerSaveBar').style.display='block';document.getElementById('viewSiteBtn').href=`site.html?slug=${encodeURIComponent(website.public_slug)}`
document.getElementById('f-status').value='draft';document.getElementById('f-status').disabled=true
document.getElementById('codeBtn').disabled=true;document.getElementById('codeBtn').title='Egendefinert JavaScript er deaktivert i Security V2'

function page(){return siteData.pages.find(p=>p.id===siteData.activePageId)||siteData.pages[0]}function flatten(){const result={};for(const k of wide)result[k]=siteData[k];for(const k of PAGE_CONTENT_KEYS)result[k]=page()[k];return result}function commit(){for(const k of wide)siteData[k]=state[k];for(const k of PAGE_CONTENT_KEYS)page()[k]=state[k];siteData.status='draft'}
const fieldMap={'f-businessName':'businessName','f-heroTag':'heroTag','f-heroTitle':'heroTitle','f-heroSub':'heroSub','f-cta':'cta','f-badge':'badge','f-aboutTitle':'aboutTitle','f-aboutText':'aboutText','f-offeringsLabel':'offeringsLabel','f-address':'address','f-hours':'hours','f-domain':'domain','f-seoTitle':'seoTitle','f-seoDesc':'seoDesc','f-accent':'accent','f-accent2':'accent2'}
for(const[id,key]of Object.entries(fieldMap)){const el=document.getElementById(id);if(!el)continue;el.value=state[key]||'';el.addEventListener('input',()=>{state[key]=el.value;render();schedule()})}
const templateSelect=document.getElementById('f-template');for(const t of BUILDER_TEMPLATES){const option=document.createElement('option');option.value=t.id;option.textContent=`${t.icon} ${t.label}`;templateSelect.append(option)}templateSelect.value=state.templateId;templateSelect.addEventListener('change',()=>{siteData=freshStateFromTemplate(templateSelect.value);siteData.status='draft';state=flatten();location.reload()})
document.getElementById('f-language').value=state.language||'no';document.getElementById('f-language').addEventListener('change',e=>{state.language=e.target.value;schedule()})

function esc(value){return String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function preview(){const p=state,offerings=(p.offerings||[]).map(o=>`<article><h3>${esc(o.t)}</h3><p>${esc(o.d)}</p></article>`).join('');return `<div style="--accent:${esc(state.accent)}"><section class="hero"><span class="eyebrow">${esc(p.heroTag)}</span><h1>${esc(p.heroTitle).replace(/\n/g,'<br>')}</h1><p>${esc(p.heroSub)}</p><a class="button">${esc(p.cta)}</a></section><section class="section intro"><h2>${esc(p.aboutTitle)}</h2><p>${esc(p.aboutText)}</p></section><section class="section offerings"><h2>${esc(p.offeringsLabel)}</h2><div class="cards">${offerings}</div></section></div>`}
function render(){const html=preview();document.getElementById('previewDesktop').innerHTML=html;document.getElementById('previewMobile').innerHTML=html;document.getElementById('browserUrl').textContent=website.domain||website.public_slug}
function schedule(){document.getElementById('saveStatus').textContent='Ulagrede endringer';document.getElementById('customerSaveHint').textContent='Du har endringer som ikke er lagret';clearTimeout(saveTimer);saveTimer=setTimeout(()=>persist(false),800)}
async function persist(show=true){commit();clearTimeout(saveTimer);try{const saved=await saveDraft(websiteId,siteData,revision);revision=Number(saved.revision);document.getElementById('saveStatus').textContent=show?'Lagret ✓':'Alt lagret';document.getElementById('customerSaveHint').textContent=`Privat utkast · revisjon ${revision}`;document.getElementById('lastSavedInfo').textContent='Nå nettopp'}catch(error){document.getElementById('saveStatus').textContent=error.code==='STALE_REVISION'?'Nyere versjon finnes':'Lagring feilet'}}
document.getElementById('saveBtn').addEventListener('click',()=>persist(true));document.getElementById('customerSaveBtn').addEventListener('click',()=>persist(true))
const modal=document.getElementById('publishModal'),publishError=document.getElementById('publishError');document.getElementById('publishBtn').addEventListener('click',()=>{publishError.classList.remove('show');openPublishDialog()});document.getElementById('closeModal').addEventListener('click',()=>closePublishDialog());document.getElementById('confirmPublishBtn').addEventListener('click',async()=>{publishError.classList.remove('show');const key=document.getElementById('publishPersonalKey').value;try{await persist(false);const result=await publishSite(websiteId,revision,key);document.getElementById('publishPersonalKey').value='';closePublishDialog();document.getElementById('saveStatus').textContent=`Publisert versjon ${result.version} ✓`}catch(error){publishError.textContent=error.code==='STALE_REVISION'?'Utkastet er endret. Last inn siden på nytt.':'Publisering ble avvist. Kontroller nøkkel og tilgang.';publishError.classList.add('show')}})
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
  if(!modal.classList.contains('open'))return
  modal.classList.remove('open');document.body.style.overflow=previousOverflow
  dialogBackground.forEach((element,index)=>{element.inert=previousInert[index]})
  dialogReturnFocus?.focus()
}
modal.addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.preventDefault();closePublishDialog()}
  if(event.key==='Tab'){
    const controls=dialogControls.filter(control=>!control.disabled),first=controls[0],last=controls[controls.length-1]
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
  }
})
// END BUILDER PRESENTATION CONTROLS
document.getElementById('copyCodeBtn').disabled=true;document.getElementById('downloadDataBtn').style.display='none';document.getElementById('downloadHtmlBtn').style.display='none';render()
