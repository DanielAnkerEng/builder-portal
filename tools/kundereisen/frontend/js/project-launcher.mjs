import {mountJourney} from './kundereisen.mjs';

export function installProjectJourney({website,ctx,supabase,beforeOpen,afterClose}) {
  const entry = document.getElementById('journeyEntry');
  const dialog = document.getElementById('journeyDialog');
  const root = document.getElementById('journeySurface').attachShadow({mode:'open'});
  const exit = document.getElementById('journeyReturn');
  const notice = document.getElementById('journeyAccessNotice');
  const retry = document.getElementById('journeyVerifyAccess');
  const actor = ctx.user.id;
  const api = '/api/projects/' + encodeURIComponent(website.id) + '/';
  let generation = 0, openedRound = null, lifetime = null;
  let available = false, paused = false;

  function pause() {
    paused = true;
    beforeOpen();
  }
  function clear() {
    generation++;
    lifetime?.abort();
    lifetime = null;
    openedRound = null;
    root.replaceChildren();
  }
  function lostAccess() {
    const wasInUse = paused || available;
    available = false;
    entry.hidden = true;
    clear();
    if (wasInUse) {
      pause();
      notice.hidden = false;
      retry.disabled = false;
    }
    if (dialog.open) dialog.close();
  }
  async function projectRequest(action, payload) {
    const version = generation;
    const {data:{session}} = await supabase.auth.getSession();
    if (version !== generation) throw Error('CLOSED');
    if (!session || session.user.id !== actor) {
      lostAccess();
      throw Error('ACCESS');
    }
    if (payload && (!openedRound || payload.round !== openedRound)) throw Error('CLOSED');
    const response = await fetch(api + action, {
      method: payload ? 'POST' : 'GET', cache:'no-store',
      headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},
      body: payload ? JSON.stringify(payload) : undefined
    });
    if (version !== generation) throw Error('CLOSED');
    if ([401,403,404].includes(response.status)) {
      lostAccess();
      throw Error('ACCESS');
    }
    if (!response.ok) throw Error(response.status === 409 ? 'CLOSED' : 'UNAVAILABLE');
    const data = await response.json();
    if (version !== generation) throw Error('CLOSED');
    if (action === 'round' && openedRound && data.runde !== openedRound) throw Error('CLOSED');
    if (action === 'round' || action === 'reset') openedRound = data.runde;
    return data;
  }
  async function verifyAccess() {
    const version = generation;
    retry.disabled = true;
    try {
      const result = await projectRequest('available');
      if (version !== generation || result.available !== true) return;
      available = true;
      entry.hidden = false;
      if (paused) {
        paused = false;
        notice.hidden = true;
        afterClose();
        entry.focus();
      }
    } catch {
      if (version === generation && paused) lostAccess();
    } finally {
      if (version === generation) retry.disabled = false;
    }
  }
  entry.addEventListener('click', async () => {
    if (!available || dialog.open || paused) return;
    pause();
    lifetime = new AbortController();
    const {signal} = lifetime;
    document.getElementById('journeyProject').textContent = website.name;
    dialog.showModal();
    exit.focus();
    root.textContent = 'Åpner Kundereisen …';
    try { await mountJourney(root,projectRequest,signal); }
    catch { if (!signal.aborted) root.textContent = 'Kundereisen kunne ikke åpnes.'; }
  });
  dialog.addEventListener('close', () => {
    clear();
    if (available) {
      entry.hidden = true;
      void verifyAccess();
    } else if (!notice.hidden) {
      retry.focus();
    }
  });
  exit.addEventListener('click', () => dialog.close());
  retry.addEventListener('click', verifyAccess);
  supabase.auth.onAuthStateChange((event,session) => {
    if (event === 'SIGNED_OUT' || (session && session.user.id !== actor)) lostAccess();
  });
  window.addEventListener('pagehide', () => { if (dialog.open) dialog.close(); });
  void verifyAccess();
}
