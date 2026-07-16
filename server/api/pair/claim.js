import { redis } from '../../lib/redis.js';
import { signJwt } from '../../lib/auth.js';
import { readBody, methodGuard } from '../../lib/http.js';

export default async function handler(req, res) {
  if (!methodGuard(req, res, 'POST')) return;
  const { code } = readBody(req);
  const userId = code && (await redis.get(`pair:${String(code).trim().toUpperCase()}`));
  if (!userId) return res.status(400).json({ error: 'Invalid or expired pairing code' });
  await redis.del(`pair:${String(code).trim().toUpperCase()}`);
  const token = signJwt({ kind: 'agent', sub: userId }, 60 * 60 * 24 * 365);
  res.json({ token });
}
