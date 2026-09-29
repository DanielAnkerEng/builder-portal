// LOCAL TEST ONLY. Existing runtime router; no new listener, gateway or auth path.
import { spawn } from 'node:child_process'
import { homedir } from 'node:os'

// Static process arguments contain no request values. Sensitive input travels only
// over stdin. stdout is a private response channel, never forwarded to test logs.
const program = `
const http = require('node:http');
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { input += chunk; if (Buffer.byteLength(input) > 131072) process.exit(1); });
process.stdin.on('end', () => {
  try {
    const { method, headers, body } = JSON.parse(input);
    const req = http.request('http://supabase_edge_runtime_webbyra-demo-github:8081/admin-create-company',
      { method, headers, timeout: 15000 }, res => {
        const chunks = []; let bytes = 0;
        res.on('data', chunk => { bytes += chunk.length; if (bytes > 1048576) { res.destroy(); process.exit(1); } chunks.push(chunk); });
        res.on('error', () => process.exit(1));
        res.on('end', () => process.stdout.write(JSON.stringify({ status: res.statusCode,
          headers: res.headers, body: Buffer.concat(chunks).toString('utf8') })));
      });
    req.on('timeout', () => req.destroy());
    req.on('error', () => process.exit(1));
    req.end(body);
  } catch { process.exit(1); }
});
`

export async function localEdgeHttp({ method = 'POST', headers = {}, body = '' } = {}) {
  if (process.env.WREACH_LOCAL_DIRECT_EDGE_TESTS !== '1') throw new Error('Direct local Edge test requires explicit opt-in')
  if (!['POST', 'OPTIONS', 'GET', 'PUT', 'PATCH', 'DELETE', 'HEAD'].includes(method) || typeof body !== 'string')
    throw new Error('Invalid local test request')
  const normalized = Object.fromEntries(new Headers(headers))
  // Do not let a caller redirect routing via host/forwarded/internal headers.
  const allowed = new Set(['authorization', 'apikey', 'content-type', 'idempotency-key', 'origin',
    'access-control-request-method', 'access-control-request-headers', 'x-client-info'])
  if (Object.keys(normalized).some(name => !allowed.has(name))) throw new Error('Unsupported local test header')
  const input = JSON.stringify({ method, headers: normalized, body })
  if (Buffer.byteLength(input) > 131072) throw new Error('Local test request too large')
  return new Promise((resolve, reject) => {
    const child = spawn('docker', ['--host', 'unix://' + homedir() + '/.docker/run/docker.sock',
      'exec', '-i', 'supabase_studio_webbyra-demo-github', 'node', '-e', program], { stdio: ['pipe', 'pipe', 'pipe'] })
    let output = '', failed = false
    const fail = () => { if (!failed) { failed = true; reject(new Error('Local direct Edge transport failed')) } }
    const timer = setTimeout(() => { child.kill(); fail() }, 25000)
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', chunk => { output += chunk; if (Buffer.byteLength(output) > 2097152) { child.kill(); fail() } })
    child.stderr.resume() // Never expose Docker/node diagnostics containing input.
    child.stdin.on('error', fail)
    child.on('error', () => { clearTimeout(timer); fail() })
    child.on('close', code => {
      clearTimeout(timer)
      if (failed) return
      if (code !== 0) { fail(); return }
      try {
        const result = JSON.parse(output)
        if (!Number.isInteger(result.status) || typeof result.body !== 'string') throw new Error()
        const responseHeaders = new Headers()
        for (const [name, value] of Object.entries(result.headers)) {
          if (Array.isArray(value)) for (const item of value) responseHeaders.append(name, item)
          else if (value !== undefined) responseHeaders.append(name, value)
        }
        resolve({ status: result.status, headers: responseHeaders, body: result.body })
      } catch { fail() }
    })
    child.stdin.end(input)
  })
}
