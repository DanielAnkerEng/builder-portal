export function installMeasurements(root, request, signal, onVisit) {
const main=root.querySelector('main'),locked=root.getElementById('locked');
const reset=root.getElementById('reset'),status=root.getElementById('status'),warning=root.getElementById('warning');
const ad='instagram-bord-og-jord-torsk';
const links=[[root.getElementById('visit'),ad],...[...root.querySelectorAll('[data-source]')].map(a=>[a,a.dataset.source])];

let round=null,epoch=0,resetting=false,reading=false;
function clearPrivate(){
  main.hidden=true;locked.hidden=false;
  for(const n of root.querySelectorAll('.flow strong,[data-counter]'))n.textContent='–';
  for(const [a] of links){a.removeAttribute('href');a.setAttribute('aria-disabled','true')}
}
function incomplete(){warning.hidden=false;warning.textContent='Målingen er ufullstendig. En registrering kunne ikke bekreftes.'}
function render(data){
  if(round!==data.runde){warning.hidden=true}
  if(data.incomplete)incomplete();
  round=data.runde;locked.hidden=true;main.hidden=false;
  for(const name of ['click','opening','menu'])root.getElementById(name).textContent=data[ad][name];
  for(const cell of root.querySelectorAll('[data-counter]')){const [source,field]=cell.dataset.counter.split('.');cell.textContent=data[source][field]}
  for(const [a] of links){a.href='#resultat';a.removeAttribute('aria-disabled')}
  status.textContent='Viser bekreftede handlinger i prosjektets runde.';
}
async function refresh(){
  if(reading||resetting||document.hidden||signal.aborted)return;
  const gen=epoch;reading=true;
  try{const data=await request('round');if(gen===epoch&&!document.hidden)render(data)}
  catch(error){if(gen===epoch){clearPrivate();locked.textContent=error.message==='CLOSED'?'Runden er avsluttet. Gå tilbake til prosjektet for å åpne en ny visning.':'Prosjekttilgangen kunne ikke bekreftes.'}}
  finally{reading=false}
}
for(const [link,channel] of links)link.addEventListener('click',async event=>{
  event.preventDefault();if(!event.isTrusted||!round||resetting||main.hidden)return;
  const expected=round,gen=epoch,name='restaurant'+crypto.randomUUID();
  const popup=window.open('about:blank',name);
  if(!popup){incomplete();return}
  try{
    const {location:landing}=await request('launch',{channel,round:expected});
    if(gen!==epoch||round!==expected){popup.close();return}
    popup.location.replace(landing);
    if(channel===ad)onVisit();
  }catch{popup.close();incomplete()}
});
reset.disabled=false;
reset.addEventListener('click',async()=>{
  if(resetting)return;resetting=true;epoch++;reset.disabled=true;
  try{render(await request('reset',{round}))}catch{clearPrivate();locked.textContent='Ny runde kunne ikke bekreftes.'}
  finally{resetting=false;reset.disabled=false}
});
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearPrivate()}else refresh()},{signal});
window.addEventListener('pagehide',clearPrivate,{signal});
window.addEventListener('focus',refresh,{signal});
const timer=setInterval(refresh,2500);
signal.addEventListener('abort',()=>{epoch++;clearInterval(timer);clearPrivate()},{once:true});
refresh();
}
