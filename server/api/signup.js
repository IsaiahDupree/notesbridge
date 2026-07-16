import { redis } from '../lib/redis.js';
import { hashPassword, signJwt, randomId } from '../lib/auth.js';
import { readBody, methodGuard } from '../lib/http.js';

export default async function handler(req, res) {
  if (!methodGuard(req, res, 'POST')) return;
  const { email, password } = readBody(req);
  if (!email || !password || password.length < 8) {
    return res.status(400).json({ error: 'Valid email and a password of 8+ characters required' });
  }
  const key = `user:email:${String(email).trim().toLowerCase()}`;
  if (await redis.get(key)) {
    return res.status(409).json({ error: 'An account with that email already exists' });
  }
  const id = randomId('usr');
  await redis.set(key, JSON.stringify({ id, pw: hashPassword(password) }));
  const session = signJwt({ kind: 'session', sub: id, email }, 60 * 60 * 24 * 30);
  res.json({ token: session, userId: id });
}
