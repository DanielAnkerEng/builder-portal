import {installSeo} from './seo-demo.mjs';
import {installMeasurements} from './project-measurement.mjs';

export async function mountJourney(root,request,signal){
  const response=await fetch('/kundereisen.html',{signal,cache:'no-store'});
  if(!response.ok)throw Error('Presentation unavailable');
  const template=new DOMParser().parseFromString(await response.text(),'text/html');
  if(signal.aborted)return;
  const staticNodes=['link[href="css/annonse.css"]','link[href="css/kundereisen.css"]','header','main','#locked'];
  root.replaceChildren(...staticNodes.map(selector=>document.importNode(template.querySelector(selector),true)));
  const panels=[...root.querySelectorAll('[data-panel]')];
  const steps=[...root.querySelectorAll('[data-step]')];
  function show(id,focus=false){
    const selected=panels.find(p=>p.id===id);
    if(!selected)return;
    for(const panel of panels)panel.hidden=panel!==selected;
    for(const step of steps){
      if(step.dataset.step===id)step.setAttribute('aria-current','step');
      else step.removeAttribute('aria-current');
    }
    if(focus){
      root.getElementById(selected.getAttribute('aria-labelledby')).focus({preventScroll:true});
      root.host.scrollTop=0;
    }
  }
  for(const link of root.querySelectorAll('[data-step],a.next'))link.addEventListener('click',e=>{
    e.preventDefault();show(link.hash.slice(1),true);
  },{signal});
  installSeo(root);
  show('sok');
  installMeasurements(root,request,signal,()=>show('resultat'));
}
