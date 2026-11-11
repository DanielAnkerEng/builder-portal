const notice=document.createElement('p');notice.setAttribute('role','status');
async function record(type){
 try{
  const res=await fetch('event',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type})});
  if(res.ok)return;
  if(res.status!==409)throw Error();
  notice.textContent='Denne demorunden er avsluttet.';
 }catch{notice.textContent='Målingen er ufullstendig.';void fetch('incomplete',{method:'POST',keepalive:true}).catch(()=>{})}
 document.querySelector('.demo-toolbar').append(notice);
}
document.getElementById('demoRoot').addEventListener('click',e=>{
 if(e.isTrusted&&e.target.closest('.demo-hero a.demo-button[href="#meny"]'))record('menu');
});
record('opening');
