const versions = [
  { key: 'before', label: 'Før', path: 'demo.html?site=restaurant' },
  { key: 'after', label: 'Etter', path: 'bord-og-jord.html' },
];
const fields = [
  ['title', 'Sidetittel i levert HTML', 'Navn og type restaurant hjelper gjesten å kjenne igjen stedet i en treffliste.'],
  ['description', 'Metabeskrivelse i levert HTML', 'Et eksempel fra menyen gir gjesten et grunnlag for å vurdere kjøkkenet.'],
  ['h1', 'Hovedoverskrift i levert HTML', 'En overskrift i selve svaret kan leses før nettleseren starter JavaScript.'],
];
export function installSeo(root) {
const button = root.getElementById('rerun');
const status = root.querySelector('[data-seo-status]') || root.getElementById('status');
const measurements = root.getElementById('measurements');
const cells = new Map();

function make(tag, text) {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}

for (const [key, label, explanation] of fields) {
  const section = document.createElement('section');
  section.className = 'field';
  const pair = document.createElement('div');
  pair.className = 'pair';
  for (const version of versions) {
    const column = document.createElement('div');
    column.className = version.key;
    const value = make('p', 'Leser …');
    cells.set(version.key + '-' + key, value);
    column.append(make('strong', version.label), value);
    pair.append(column);
  }
  section.append(make('h3', label), make('p', explanation), pair);
  measurements.append(section);
}

async function readPage(path) {
  const response = await fetch(path, {
    cache: 'no-store', credentials: 'omit', mode: 'same-origin', redirect: 'error',
    signal: AbortSignal.timeout(9000),
  });
  if (!response.ok) throw Error('HTTP ' + response.status);
  if (!/^text\/html\b/i.test(response.headers.get('Content-Type') || '')) throw Error('Svaret var ikke HTML');
  const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
  return {
    title: doc.querySelector('title')?.textContent.trim(),
    description: doc.querySelector('meta[name="description" i]')?.content.trim(),
    h1: [...doc.querySelectorAll('h1')].map(node => node.textContent.trim()).join(' · '),
  };
}

function display(version, data, fallback) {
  for (const [key] of fields) {
    const id = version.key + '-' + key;
    const text = data?.[key] || fallback;
    cells.get(id).textContent = text;
    const preview = root.querySelector('[data-value="' + id + '"]');
    if (preview) preview.textContent = text;
  }
}

let busy = false;
async function analyse() {
  if (busy) return;
  busy = true;
  button.setAttribute('aria-disabled', 'true');
  button.disabled = false;
  status.textContent = 'Leser begge sidene på nytt …';
  for (const version of versions) display(version, null, 'Leser …');
  try {
    const results = await Promise.allSettled(versions.map(v => readPage(v.path)));
    const problems = [];
    for (const [i, result] of results.entries()) {
      const v = versions[i];
      if (result.status === 'fulfilled') {
        display(v, result.value, 'Mangler i levert HTML');
      } else {
        const reason = result.reason?.message || '';
        const detail = /^HTTP [0-9]{3}$/.test(reason) ? reason : 'Fikk ikke et lesbart HTML-svar';
        display(v, null, 'Kunne ikke leses · ' + detail);
        problems.push((v.key === 'before' ? 'Førversjonen' : 'Etterversjonen') + ' kunne ikke leses (' + detail + ').');
      }
    }
    status.textContent = problems.length ? problems.join(' ') + ' Prøv analysen igjen.' :
      'Begge sidene lest kl. ' + new Date().toLocaleTimeString('nb-NO', {hour12:false}) + '.';
  } finally {
    busy = false;
    button.removeAttribute('aria-disabled');
  }
}
button.addEventListener('click', analyse);
analyse();
}
