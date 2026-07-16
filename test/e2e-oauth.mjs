// e2e-oauth.mjs — full-stack integration test against the LIVE NotesBridge server.
// Exercises: signup/login, RFC 7591 DCR, PKCE authorize, token exchange,
// authenticated MCP initialize + tools/list, and a relay-path probe.
// Usage: node test/e2e-oauth.mjs   (reads ../.env.local for NB_* values)

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const env = Object.fromEntries(
  fs.readFileSync(path.join(root, '.env.local'), 'utf8')
    .split('\n').filter((l) => l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)])
);

const BASE = env.NB_SERVER || 'https://notesbridge.vercel.app';
const EMAIL = env.NB_EMAIL;
const PASSWORD = env.NB_PASSWORD;

let failures = 0;
const ok = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
  if (!cond) failures++;
};

const json = async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) });
const post = (p, body, headers = {}) =>
  fetch(BASE + p, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) }).then(json);

// 1. health
const health = await fetch(BASE + '/api/health').then((r) => r.json());
ok('health: storage + jwt ready', health.redisConfigured && health.redisOk && health.jwtSecretSet, JSON.stringify(health));

// 2. session: signup, else login
let session = await post('/api/signup', { email: EMAIL, password: PASSWORD });
if (session.status === 409) session = await post('/api/login', { email: EMAIL, password: PASSWORD });
ok('signup/login returns session token', !!session.body.token, `status ${session.status}`);
const SESSION = session.body.token;

// 3. OAuth metadata discovery
const asMeta = await fetch(BASE + '/.well-known/oauth-authorization-server').then((r) => r.json());
ok('AS metadata: PKCE S256 + DCR', asMeta.code_challenge_methods_supported?.includes('S256') && !!asMeta.registration_endpoint);
const prMeta = await fetch(BASE + '/.well-known/oauth-protected-resource').then((r) => r.json());
ok('PR metadata points at /mcp', prMeta.resource === `${BASE}/mcp`);

// 4. DCR
const REDIRECT = 'https://chatgpt.com/connector_platform_oauth_redirect';
const reg = await post('/api/oauth/register', { redirect_uris: [REDIRECT], client_name: 'e2e-test' });
ok('DCR issues client_id', reg.status === 201 && !!reg.body.client_id);
const CLIENT = reg.body.client_id;

// 5. authorize with PKCE (simulating the consent page's Allow)
const verifier = crypto.randomBytes(32).toString('base64url');
const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
const auth = await post(
  '/api/oauth/authorize',
  { client_id: CLIENT, redirect_uri: REDIRECT, state: 'st_123', code_challenge: challenge, code_challenge_method: 'S256' },
  { authorization: `Bearer ${SESSION}` }
);
const redirectUrl = auth.body.redirect ? new URL(auth.body.redirect) : null;
const CODE = redirectUrl?.searchParams.get('code');
ok('authorize issues code + preserves state', !!CODE && redirectUrl?.searchParams.get('state') === 'st_123');

// 5b. wrong verifier must fail
const bad = await post('/api/oauth/token', { grant_type: 'authorization_code', code: CODE, code_verifier: 'wrong-verifier-wrong-verifier-wrong-verifier', redirect_uri: REDIRECT });
ok('token rejects bad PKCE verifier', bad.status === 400);

// 5c. code is single-use: re-authorize for the real exchange
const auth2 = await post(
  '/api/oauth/authorize',
  { client_id: CLIENT, redirect_uri: REDIRECT, code_challenge: challenge, code_challenge_method: 'S256' },
  { authorization: `Bearer ${SESSION}` }
);
const CODE2 = new URL(auth2.body.redirect).searchParams.get('code');

// 6. token exchange
const tok = await post('/api/oauth/token', { grant_type: 'authorization_code', code: CODE2, code_verifier: verifier, redirect_uri: REDIRECT });
ok('token exchange returns access + refresh', !!tok.body.access_token && !!tok.body.refresh_token);
const ACCESS = tok.body.access_token;

// 6b. refresh rotation
const ref = await post('/api/oauth/token', { grant_type: 'refresh_token', refresh_token: tok.body.refresh_token });
ok('refresh grant rotates tokens', !!ref.body.access_token && ref.body.refresh_token !== tok.body.refresh_token);

// 7. MCP: unauthenticated must 401 with resource metadata pointer
const noAuth = await fetch(BASE + '/mcp', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
ok('MCP 401 without token, advertises PR metadata', noAuth.status === 401 && String(noAuth.headers.get('www-authenticate')).includes('oauth-protected-resource'));

// 8. MCP initialize + tools/list with the OAuth token
async function mcp(body) {
  const r = await fetch(BASE + '/mcp', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', authorization: `Bearer ${ref.body.access_token || ACCESS}` },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  // streamable HTTP may answer as SSE; extract the data payload
  const m = text.match(/^data: (.*)$/m);
  return { status: r.status, body: JSON.parse(m ? m[1] : text || '{}') };
}

const init = await mcp({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'e2e', version: '1.0' } } });
ok('MCP initialize', init.body.result?.serverInfo?.name === 'apple-notes-relay', JSON.stringify(init.body.result?.serverInfo));

const tools = await mcp({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
const names = (tools.body.result?.tools || []).map((t) => t.name).sort();
ok('MCP lists all 8 tools', JSON.stringify(names) === JSON.stringify(['append_to_note', 'create_note', 'fetch', 'get_note', 'list_folders', 'list_notes', 'search', 'update_note']), names.join(','));

// 9. relay path: agent offline error proves the queue lookup ran end to end
const call = await mcp({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'list_folders', arguments: {} } });
const text = call.body.result?.content?.[0]?.text || '';
ok('relay probe (agent offline or online)', text.includes('agent is offline') || text.includes('folders'), text.slice(0, 80));

console.log(failures === 0 ? '\nALL GREEN' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
