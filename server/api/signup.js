import { redis } from '../lib/redis.js';
import { hashPassword, signJwt, randomId } from '../lib/auth.js';
import { readBody, methodGuard } from '../lib/http.js';
import { rateLimit } from '../lib/ratelimit.js';
import { DEMO_EMAIL } from '../lib/demoStore.js';

export default async function handler(req, res) {
  if (!methodGuard(req, res, 'POST')) return;
  if (!(await rateLimit(req, res, { name: 'signup', limit: 5, windowSec: 600 }))) return;
  const { email, password } = readBody(req);
  if (!email || !password || password.length < 8) {
    return res.status(400).json({ error: 'Valid email and a password of 8+ characters required' });
  }
  const normalized = String(email).trim().toLowerCase();
  const key = `user:email:${normalized}`;
  if (await redis.get(key)) {
    return res.status(409).json({ error: 'An account with that email already exists' });
  }
  const id = randomId('usr');
  await redis.set(key, JSON.stringify({ id, pw: hashPassword(password) }));
  if (normalized === DEMO_EMAIL) {
    await redis.set(`demo:${id}`, '1'); // reviewer demo account: MCP tools use sample notes
  }
  const session = signJwt({ kind: 'session', sub: id, email }, 60 * 60 * 24 * 30);
  res.json({ token: session, userId: id });
}
