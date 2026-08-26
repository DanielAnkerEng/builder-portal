import { supabase } from './supabase.js'
const form=document.getElementById('mfaForm'), errorEl=document.getElementById('mfaError'); let factorId=null
const { data:{session} }=await supabase.auth.getSession(); if(!session) location.replace('login.html')
const { data:factors }=await supabase.auth.mfa.listFactors(); const verified=factors?.totp?.find(f=>f.status==='verified')
if(verified) factorId=verified.id; else { const {data,error}=await supabase.auth.mfa.enroll({factorType:'totp',friendlyName:'Wreach authenticator'}); if(error) throw error; factorId=data.id; document.getElementById('enrollment').hidden=false; document.getElementById('mfaTitle').textContent='Aktiver tofaktor'; document.getElementById('mfaHelp').textContent='Skann QR-koden før du bekrefter.'; document.getElementById('mfaQr').src=data.totp.qr_code; document.getElementById('mfaSecret').textContent=data.totp.secret }
form.addEventListener('submit',async e=>{e.preventDefault(); const {data:challenge,error:ce}=await supabase.auth.mfa.challenge({factorId}); if(ce)return fail('Kunne ikke starte verifisering.'); const {error}=await supabase.auth.mfa.verify({factorId,challengeId:challenge.id,code:document.getElementById('mfaCode').value}); if(error)return fail('Koden er ugyldig eller utløpt.'); await supabase.auth.refreshSession(); location.replace('builder.html')})
document.getElementById('mfaLogout').addEventListener('click',async()=>{await supabase.auth.signOut();location.replace('login.html')}); function fail(m){errorEl.textContent=m;errorEl.classList.add('show')}

