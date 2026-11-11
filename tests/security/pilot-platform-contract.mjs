// Reviewed 2026-11-03: exact local-pilot deltas, not a file allowlist.
// Every other byte still comes from the unchanged portal-design baseline.
// Runtime tests cover link identity, environment selection, CORS and access.
const patches={
  'js/admin-dashboard.mjs':[[
    '  actions.append(edit)\n',
    "  actions.append(edit)\n  // Commerce is available only on the isolated pilot portal, not Wreach production.\n  if (document.location?.origin === 'http://127.0.0.1:4307') {\n    const commerce = el('a', 'btn btn-outline btn-small', 'Butikk og ordre')\n    commerce.href = `commerce-admin.html?website=${encodeURIComponent(site.id)}`\n    actions.append(commerce)\n  }\n"
  ]],
  'supabase/functions/admin-create-company/index.ts':[[
    "const origins = new Set(['https://wreach.no', 'http://127.0.0.1:4175', 'http://localhost:4175'])\n",
    "const origins = new Set(['https://wreach.no', 'http://127.0.0.1:4175', 'http://localhost:4175'])\n// Both CLI-local Kong and an explicit pilot env file are required; never request data.\nif (Deno.env.get('SUPABASE_URL') === 'http://kong:8000' && Deno.env.get('WREACH_LOCAL_PILOT') === 'bli-stogg-pilot:56321') {\n  origins.add('http://127.0.0.1:4307')\n}\n"
  ]],
  'supabase/config.toml':[
    ['project_id = "webbyra-demo-github"','project_id = "bli-stogg-pilot"'],
    ...[[54321,56321],[54322,56322],[54320,56320],[54329,56329],[54323,56323],[54324,56324],[54325,56325],[54326,56326],[54327,56327]].map(([a,b])=>['port = '+a,'port = '+b]),
    ['inspector_port = 8083','inspector_port = 5683'],
    ['site_url = "http://127.0.0.1:4175"','site_url = "http://127.0.0.1:4307"'],
    ['additional_redirect_urls = ["http://127.0.0.1:4175", "http://localhost:4175"]','additional_redirect_urls = ["http://127.0.0.1:4307", "http://127.0.0.1:4308/", "http://127.0.0.1:4308/#account"]'],
  ]
};
export function expectedPilotFile(file,original) {
  if(!patches[file])return original;
  let source=original.toString('utf8');
  for(const [before,after] of patches[file]) {
    if(source.split(before).length!==2)throw Error('BASELINE_CONTEXT_CHANGED: '+file);
    source=source.replace(before,after);
  }
  return Buffer.from(source);
}
