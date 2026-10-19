// Draft-only editing. No authorization, persistence or external requests here.
export const SECTION_TYPES = [
  {id:'hero',name:'Toppbanner'}, {id:'about',name:'Om oss'},
  {id:'offerings',name:'Tilbud / tjenester'}, {id:'gallery',name:'Galleri'},
  {id:'contact',name:'Kontakt'},
]
export const copy = value => JSON.parse(JSON.stringify(value))
export function emptyDraft(name) {
  return {businessName:name,templateId:'restaurant',accent:'#405735',accent2:'#526241',bg:'#ffffff',language:'no',status:'draft',activePageId:'home',pages:[{id:'home',slug:'',name:'Forside',heroTitle:'',heroSub:'',offerings:[],gallery:[],sections:[]}]}
}
export function normalizeSections(content) {
  const result=copy(content)
  for(const page of result.pages) for(const section of page.sections||[]) {
    if(Object.hasOwn(section,'locked')) {
      if(!Object.hasOwn(section,'removable')) section.removable=!section.locked
      delete section.locked
    }
  }
  return result
}
export function addPage(content,rawName,id) {
  const name=String(rawName).trim()
  if(!name||name.length>120||/[\u0000-\u001f\u007f]/.test(name)) throw Error('Sidenavnet må ha 1–120 tegn.')
  if(content.pages.length>=50) throw Error('Maksimalt 50 sider.')
  if(!/^[a-zA-Z0-9_-]{1,80}$/.test(id)||content.pages.some(p=>p.id===id)) throw Error('Ugyldig eller brukt side-ID.')
  const base=name.toLowerCase().replace(/æ/g,'ae').replace(/ø/g,'o').replace(/å/g,'a').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40)||'side'
  let slug=base,n=2
  while(content.pages.some(p=>p.slug===slug)) slug=base+'-'+n++
  const result=copy(content)
  result.pages.push({id,slug,name,heroTag:'',heroTitle:name,heroSub:'',cta:'',badge:'',aboutTitle:'',aboutText:'',offeringsLabel:'',offerings:[],gallery:[],address:'',hours:'',sections:[],customCode:null})
  result.activePageId=id
  return result
}
export function addSection(sections,id) {
  const type=SECTION_TYPES.find(s=>s.id===id)
  if(!type||sections.some(s=>s.id===id)||sections.length>=30) throw Error('Seksjonen kan ikke legges til.')
  return [...copy(sections),{...type,enabled:true,removable:true}]
}
export function moveSection(sections,from,to) {
  if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<0||from>=sections.length||to>=sections.length) return copy(sections)
  const result=copy(sections),[item]=result.splice(from,1);result.splice(to,0,item);return result
}
const orders={restaurant:['hero','offerings','about','gallery','contact'],frisor:['hero','gallery','offerings','about','contact'],handverker:['hero','about','offerings','gallery','contact'],bilverksted:['hero','offerings','contact','about','gallery'],eiendom:['hero','gallery','about','offerings','contact'],fjordbolig:['hero','gallery','about','contact','offerings'],konsulent:['hero','about','contact','offerings','gallery']}
export function templateDraft(content,template,replace=false) {
  if(!Object.hasOwn(orders,template.id)) throw Error('Ukjent mal.')
  const result=normalizeSections(content),order=orders[template.id]
  result.templateId=template.id;result.accent=template.accent;result.accent2=template.accent2
  result.bg=template.bg.match(/#[0-9a-f]{6}/i)?.[0]||'#ffffff'
  for(const page of result.pages) {
    if(replace&&page.id===result.activePageId) {
      for(const key of ['heroTag','heroSub','cta','badge','aboutTitle','aboutText','offeringsLabel','address','hours']) page[key]=''
      page.heroTitle=page.name;page.offerings=[];page.gallery=[];page.customCode=null
      page.sections=order.map(id=>({...SECTION_TYPES.find(s=>s.id===id),enabled:true,removable:true}))
    } else {
      page.sections.sort((a,b)=>(order.includes(a.id)?order.indexOf(a.id):99)-(order.includes(b.id)?order.indexOf(b.id):99))
    }
  }
  result.status='draft'
  return result
}
export function escapeText(value){return String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}
const color=value=>/^#[0-9a-f]{6}$/i.test(value||'')?value:'#ffffff'
const foreground=value=>{const rgb=color(value).slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722>0.179?'#000000':'#ffffff'}
const media=value=>typeof value==='string'&&(/^https:\/\/[^\s<>"']{1,2000}$/.test(value)||(value.length<=800000&&/^data:image\/(png|jpeg|webp|gif);base64,[a-z0-9+/]+={0,2}$/i.test(value)))?value:null
export function renderDraftPage(p,site) {
  const e=escapeText
  const sections={
    hero:()=>`<section class="hero" style="background:${color(site.bg)};color:${foreground(site.bg)}"><span class="eyebrow">${e(p.heroTag)}</span><h1>${e(p.heroTitle).replace(/\n/g,'<br>')}</h1><p>${e(p.heroSub)}</p><span class="button">${e(p.cta)}</span><p>${e(p.badge)}</p></section>`,
    about:()=>`<section class="section intro"><h2>${e(p.aboutTitle)}</h2><p>${e(p.aboutText)}</p></section>`,
    offerings:()=>`<section class="section offerings"><h2>${e(p.offeringsLabel)}</h2><div class="cards">${(p.offerings||[]).map(o=>`<article><h3>${e(o.t)}</h3><p>${e(o.d)}</p></article>`).join('')}</div></section>`,
    gallery:()=>`<section class="section gallery"><h2>Galleri</h2>${(p.gallery||[]).map(g=>media(g.img)?`<img src="${e(media(g.img))}" alt="" loading="lazy" referrerpolicy="no-referrer">`:`<span>${e(g.emoji)}</span>`).join('')}</section>`,
    contact:()=>`<section class="section contact"><h2>Kontakt</h2><p>${e(p.address)}</p><p>${e(p.hours)}</p></section>`,
  }
  const style=Object.hasOwn(orders,site.templateId)?site.templateId:'restaurant'
  return `<div class="draft-layout draft-layout-${style}" style="--accent:${color(site.accent)};--accent2:${color(site.accent2)}">${(p.sections||[]).filter(s=>s.enabled).map(s=>Object.hasOwn(sections,s.id)?sections[s.id]():`<section class="section"><p>${e(s.name)}: Denne eldre seksjonstypen har ikke redigerbart innhold her.</p></section>`).join('')||'<p>Legg til en seksjon for å vise innhold på denne siden.</p>'}</div>`
}
