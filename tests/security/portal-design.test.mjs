import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync, statSync} from 'node:fs';
import {execFileSync} from 'node:child_process';

const root = new URL('../../', import.meta.url);
const baseline = '85cb16a4156744c779b842d2bcbcf433f065a7d9';
const git = (...args) => execFileSync('git', args, {cwd: root});
const original = path => git('show', baseline + ':' + path);

const read = path => readFileSync(new URL('../../' + path, import.meta.url), 'utf8');
const pages = ['login.html','mfa.html','security-settings.html','admin.html','builder.html'];

test('sign-in uses a responsive web-design illustration with provenance and bounded assets', () => {
  const login=read('login.html');
  assert.match(login, /wreach-design-desk-1024.webp/);
  assert.match(login, /wreach-design-desk-640.webp 640w/);
  assert.doesNotMatch(login, /estate-house/);
  const credits=JSON.parse(read('assets/marketing/credits.json'));
  const images=credits.generatedImages.filter(item=>item.name==='wreach-design-desk');
  assert.equal(images.length,1);
  for(const item of images) {
    assert.equal(item.source,'OpenAI ImageGen (built-in)');
    assert.match(item.usage,/AI-generert illustrasjon/);
    for(const width of item.widths) {
      const file=new URL(`../../assets/marketing/${item.name}-${width}.webp`,import.meta.url);
      assert(existsSync(file));
      assert(statSync(file).size<600000);
    }
  }
});

test('portal design uses shared local fonts/theme without importing marketing behavior', () => {
  for (const path of pages) {
    const source = read(path);
    assert.match(source, /href="css\/public-fonts.css"/);
    assert.match(source, /href="css\/portal-theme.css"/);
    assert.doesNotMatch(source, /fonts.googleapis|marketing-scenes|marketing.css|demo-renderer/);
    assert.match(source, /href="css\/styles.css"/);
  }
});
test('auth page entry points and hidden activation controls remain intact', () => {
  for (const [page, script] of [['login.html','login.js?v=security2'],['mfa.html','mfa.js'],['security-settings.html','security-settings.js'],['admin.html','admin.js?v=security2'],['builder.html','builder.js?v=security2']]) {
    assert(read(page).includes(`type="module" src="js/${script}"`));
  }
  for (const [page, ids] of [['mfa.html',['mfaStart','enrollment','mfaForm','mfaCancel']]]) {
    for (const id of ids) assert.match(read(page), new RegExp(`<[^>]*id="${id}"[^>]*\\bhidden(?:\\s|>)`));
  }
  assert.match(read('login.html'), /id="remember"/);
  assert.doesNotMatch(read('login.html'), /id="remember"[^>]*checked/);
  assert.match(read('css/styles.css'), /\[hidden\]\s*\{\s*display:\s*none\s*!important/);
});
test('authorization, MFA and trusted write entry points remain required', () => {
  assert.match(read('js/admin.js'), /await requireAal2\(\{platformAdmin:true\}\)/);
  assert.match(read('js/builder.js'), /await requireAal2\(\)/);
  assert.match(read('js/builder.js'), /loadWebsiteDraft, publishSite, saveDraft/);
  assert.match(read('js/login.js'), /signInWithPassword/);
  assert.match(read('js/auth.js'), /supabase.auth.signOut/);
});
test('new theme has no remote dependencies, sensitive field concealment or behavior', () => {
  const css = read('css/portal-theme.css');
  assert.doesNotMatch(css, /https?:|@import|javascript:|expression\(|url\(/);
  assert.doesNotMatch(css, /#(?:mfa|onboarding|authError|publishError|settingsMfa|newKey|currentKey|confirmKey)/);
  const previewVisibility='.builder-body #mockupDesktop:not([hidden]),\n.builder-body #mockupMobile:not([hidden]) { display: block; }';
  assert(css.includes(previewVisibility));
  // Only non-hidden preview frames may override the old mobile CSS. The global
  // hidden rule and all security-sensitive controls must remain untouched.
  assert.doesNotMatch(css.replace(previewVisibility,''), /\[hidden\]|pointer-events:\s*none/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /:focus-visible/);
});
test('new portal palette has readable primary/secondary text and action colors', () => {
  const luminance = hex => hex.match(/../g).map(n => parseInt(n,16)/255).map(n => n<=.04045?n/12.92:((n+.055)/1.055)**2.4).reduce((s,n,i)=>s+n*[.2126,.7152,.0722][i],0);
  for (const [a,b] of [['171b1b','f3f0e8'],['171b1b','d3e59f'],['5d665b','fcfbf6'],['626b5d','f3f0e8'],['f3f0e8','171b1b'],['d3e59f','171b1b']]) assert((Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05)>=4.5);
});
test('actual Builder preview has a readable surface and does not inherit the full-page hero height', () => {
  const css=read('css/portal-theme.css');
  assert.match(css,/\.builder-body \.site-preview \{ background: #ffffff; color: #171b1b; overflow-wrap: anywhere;/);
  assert.match(css,/\.builder-body \.site-preview \.hero \{ min-height: 0; display: block;/);
  assert.match(css,/\.builder-body \.topbar-center \.view-toggle \{ display: flex; \}/);
});
test('builder visual fixture has no executable code, Auth or write actions', () => {
  const fixture = read('tests/fixtures/builder-design.html');
  assert.match(fixture, /DEMO DATA/);
  assert.doesNotMatch(fixture, /<script|<form|supabase|on(?:click|load|error)=|https?:/);
  for (const button of fixture.matchAll(/<button\b([^>]*)>/g)) assert.match(button[1], /\bdisabled\b/);
});
test('production allowlist includes only the shared stylesheet, never design fixtures', () => {
  assert.match(read('scripts/build-production.sh'), /css_files=\([^\n]*portal-theme.css/);
  assert.match(read('tests/security/static_production_artifact.sh'), /css\/portal-theme.css/);
  assert.doesNotMatch(read('scripts/build-production.sh'), /builder-design|tests\/fixtures/);
});

test('runtime outside approved login and Builder presentation, backend and security headers remain byte-identical', () => {
  const files = git('ls-tree','-r','--name-only',baseline,'js','supabase','deploy/cloudflare').toString().trim().split('\n');
  for (const file of files.filter(file=>!['js/login.js','js/builder.js'].includes(file))) assert.deepEqual(readFileSync(new URL(file,root)),original(file),file);
});

test('login retains Auth imports, call parameters and ordered MFA/destination path behind shared busy guard', () => {
  const before=original('js/login.js').toString(), after=read('js/login.js');
  assert.deepEqual(after.match(/^import .*$/gm),before.match(/^import .*$/gm));
  const calls=['await prepareAuthSignIn(remember)','await supabase.auth.signInWithPassword({email, password})','await supabase.auth.mfa.getAuthenticatorAssuranceLevel()',"classifyAssurance(assuranceResult.data) !== 'authenticated'","location.replace('mfa.html')",'location.replace(await resolvePostAuthDestination(supabase))'];
  let prior=-1;
  for(const call of calls) { const pos=after.indexOf(call);assert(pos>prior,call);prior=pos; }
  assert.equal((after.match(/if \(busy\) return/g)||[]).length,2);
  assert.match(after,/resetPasswordForEmail\(email\)/);
});

test('Builder separates product information from unverified infrastructure and initial save state', () => {
  for(const file of ['builder.html','tests/fixtures/builder-panels.html']) {
    const html=read(file);
    assert.match(html,/<span>Nettsideverktøy<\/span><strong>Wreach<\/strong>/);
    for(const label of ['SSL-sertifikat','Hosting','CDN','Backup'])
      assert(html.includes('<span>'+label+'</span><strong>Ikke verifisert her</strong>'));
    assert.match(html,/id="lastSavedInfo">Ingen lagring bekreftet i denne økten/);
  }
  assert.match(read('builder.html'),/id="saveStatus">Lagring ikke bekreftet/);
  const before=original('js/builder.js').toString(), after=read('js/builder.js');
  const previousEmpty=before.split('\n').find(line=>line.startsWith("if(!websiteId){document.body.innerHTML="));
  assert(previousEmpty);
  const wideDeclaration=before.match(/const wide=\[[^\n]+?\];/)?.[0];
  assert(wideDeclaration);
  const presentation=after.match(/\/\/ BEGIN BUILDER PRESENTATION CONTROLS[\s\S]*?\/\/ END BUILDER PRESENTATION CONTROLS\n/)?.[0];
  assert(presentation);
  assert.doesNotMatch(presentation,/saveDraft|persist\(|schedule\(|publishSite|supabase|fetch\(|localStorage|sessionStorage|innerHTML|eval\(/);
  // Normalize only approved presentation changes. The entire remaining runtime,
  // including project selection, draft writes and publish authorization, stays identical.
  const normalized=after.replace(presentation,'').replace(wideDeclaration+'\n','').replace('function page(){',wideDeclaration+'function page(){')
    .replace('function preview(){const p=state,','function preview(){const p=page(),').replace('--accent:${esc(state.accent)}','--accent:${esc(siteData.accent)}')
    .replaceAll('openPublishDialog()',"modal.classList.add('open')").replaceAll('closePublishDialog()',"modal.classList.remove('open')")
    .replace(/if\(!websiteId\)\{\n[\s\S]*?\n\}/,()=>previousEmpty);
  assert.equal(normalized,before);
  assert.match(read('js/builder.js'),/lastSavedInfo/);
});

test('public website, demos, fonts and pre-existing images are unchanged', () => {
  const files = ['index.html','demo.html','css/styles.css','css/builder.css','css/marketing.css','css/demo.css','css/public-fonts.css',
    ...git('ls-tree','-r','--name-only',baseline,'assets/marketing').toString().trim().split('\n').filter(f=>!f.endsWith('credits.json'))];
  for (const file of files) assert.deepEqual(readFileSync(new URL(file,root)),original(file),file);
});

test('published field contracts, IDs, scripts and control states survive presentation changes', () => {
  const ids = html => [...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]).sort();
  const controls = html => [...html.matchAll(/<(?:input|select|textarea|button|form|script)\b[^>]*>/g)].map(m=>m[0]).sort();
  for (const page of pages) {
    assert.deepEqual(ids(read(page)),ids(original(page).toString()),page);
    assert.deepEqual(controls(read(page)),controls(original(page).toString()),page);
  }
});

test('unpublished onboarding is not included in this production-based preview', () => {
  for (const file of ['onboarding.html','js/onboarding.js','js/customer-onboarding.mjs','js/admin-customer-invite.mjs']) {
    assert.equal(existsSync(new URL(file,root)),false,file);
    assert(!read('scripts/build-production.sh').includes(file.split('/').pop()));
  }
});

test('key confirmation is visible without changing error state semantics', () => {
  assert.match(read('css/login.css'), /#keyError:not\(:empty\):not\(\.show\)\s*\{\s*display: block/);
  assert.match(read('css/login.css'), /\.auth-error\.show\s*\{ display: block/);
  assert.match(read('css/portal-theme.css'), /\.builder-body \.auth-error\s*\{ display: none/);
  assert.match(read('css/portal-theme.css'), /\.builder-body \.auth-error\.show\s*\{ display: block/);
});

test('state fixtures cannot sign in, enroll, store keys or publish', () => {
  for (const file of ['mfa-design.html','security-settings-design.html','builder-panels.html','builder-empty.html']) {
    const html=read('tests/fixtures/'+file);
    assert.match(html,/DEMO DATA/);
    for(const control of html.matchAll(/<(?:input|select|textarea|button)\b([^>]*)>/g)) {
      if (!control[1].includes('class="sidebar-tab')) assert.match(control[1],/\bdisabled\b/);
    }
    const scripts=[...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map(m=>m[1]);
    assert.deepEqual(scripts,file==='builder-panels.html'?['builder-panels-fixture.mjs']:[]);
    assert.doesNotMatch(html,/<img[^>]+(?:mfaQr|settingsMfaQr)[^>]+src=/);
  }
  assert.doesNotMatch(read('tests/fixtures/builder-panels-fixture.mjs'),/import\s|fetch\(|supabase|localStorage|sessionStorage|innerHTML|eval\(/);
});
