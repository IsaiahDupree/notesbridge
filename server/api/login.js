import { redis } from '../lib/redis.js';
import { checkPassword, signJwt } from '../lib/auth.js';
import { readBody, methodGuard } from '../lib/http.js';

export default async function handler(req, res) {
  if (!methodGuard(req, res, 'POST')) return;
  const { email, password } = readBody(req);
  const raw = await redis.get(`user:email:${String(email || '').trim().toLowerCase()}`);
  const user = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : null;
  if (!user || !checkPassword(password || '', user.pw)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const session = signJwt({ kind: 'session', sub: user.id, email }, 60 * 60 * 24 * 30);
  res.json({ token: session, userId: user.id });
}
