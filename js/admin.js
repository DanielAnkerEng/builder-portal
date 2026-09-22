import { supabase } from './supabase.js'; import { requireAal2, signOut } from './auth.js'
import { mountDashboard, loadDashboardWebsites } from './admin-dashboard.mjs'
import { mountAdminShell, containAdminFocus } from './admin-shell.mjs'
const ctx=await requireAal2({platformAdmin:true});
const shell = mountAdminShell({ document, window, host: document.getElementById('adminShell'), content: document.getElementById('adminLegacyContent'), profile: ctx.profile, platformRole: ctx.admin.admin_role })
shell.logout.addEventListener('click',signOut)
const projectDialog = document.getElementById('newAccountModal')
const projectTrigger = document.getElementById('newAccountBtn')
const dashboard = mountDashboard({ document, host: document.getElementById('adminDashboard'), projectAction: projectTrigger })
function closeProjectDialog() {
  projectDialog.classList.remove('open')
  document.getElementById('adminShell').inert = false
  projectTrigger.focus()
}
projectTrigger.addEventListener('click', () => {
  document.getElementById('adminShell').inert = true
  queueMicrotask(() => document.getElementById('na-displayname').focus())
})
document.getElementById('closeNewAccountModal').addEventListener('click', closeProjectDialog)
projectDialog.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeProjectDialog()
  else containAdminFocus(event, projectDialog)
})
// The existing provisioning handler closes the dialog after success.
new MutationObserver(() => {
  if (!projectDialog.classList.contains('open') && document.getElementById('adminShell').inert) closeProjectDialog()
}).observe(projectDialog, { attributes: true, attributeFilter: ['class'] })
const template=document.getElementById('na-template');BUILDER_TEMPLATES.forEach(t=>{const option=document.createElement('option');option.value=t.id;option.textContent=`${t.icon} ${t.label}`;template.append(option)})
async function render() {
  await loadDashboardWebsites(dashboard, () => supabase.from('websites').select('id,name,public_slug,status,current_publication_id,companies(name)'))
}
const modal=document.getElementById('newAccountModal'),form=document.getElementById('newAccountForm'),errorEl=document.getElementById('newAccountError');document.getElementById('newAccountBtn').addEventListener('click',()=>modal.classList.add('open'));document.getElementById('closeNewAccountModal').addEventListener('click',()=>modal.classList.remove('open'));form.addEventListener('submit',async e=>{e.preventDefault();errorEl.classList.remove('show');const body={companyName:document.getElementById('na-projectname').value.trim(),displayName:document.getElementById('na-displayname').value.trim(),email:document.getElementById('na-email').value.trim(),publicSlug:document.getElementById('na-public-slug').value.trim(),templateId:template.value,correlationId:crypto.randomUUID()};const{data,error}=await supabase.functions.invoke('admin-provision-company',{body});if(error||!data?.ok){errorEl.textContent=data?.error||'Opprettelsen mislyktes.';errorEl.classList.add('show');return}modal.classList.remove('open');form.reset();await render()});await render()
