// Applied only to responses from createPilot's validated, loopback-only portal.
// The shared Wreach files keep their original production SDK/local configuration.
function replaceOnce(source, before, after) {
  if (source.split(before).length !== 2) throw Error('PILOT_PLATFORM_SOURCE_CHANGED');
  return source.replace(before, after);
}

export function localPlatformResponse(path, bytes) {
  if (path === '/js/supabase.js') return Buffer.from(replaceOnce(bytes.toString('utf8'),
    "import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'",
    "import { createClient } from '/commerce-vendor/supabase.js'"));
  if (path === '/js/supabase.local.js') return Buffer.from(replaceOnce(bytes.toString('utf8'),
    "url: 'http://127.0.0.1:54321'", "url: 'http://127.0.0.1:56321'"));
  return bytes;
}
