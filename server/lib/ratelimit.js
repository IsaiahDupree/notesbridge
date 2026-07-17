// ratelimit.js — fixed-window rate limiter backed by Redis.
// Returns true if the request may proceed; sends a 429 and returns false otherwise.

import { redis } from './redis.js';

export function clientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  return (Array.isArray(xf) ? xf[0] : (xf || '')).split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
}

export async function rateLimit(req, res, { name, limit, windowSec }) {
  const ip = clientIp(req);
  const window = Math.floor(Date.now() / (windowSec * 1000));
  const key = `rl:${name}:${ip}:${window}`;
  let count;
  try {
    count = await redis.incr(key);
    if (count === 1) await redis.expire(key, windowSec + 5);
  } catch {
    return true; // never let the limiter take the API down
  }
  if (count > limit) {
    res.setHeader('retry-after', String(windowSec));
    res.status(429).json({ error: 'rate_limited', error_description: `Too many requests — try again in up to ${windowSec}s` });
    return false;
  }
  return true;
}
