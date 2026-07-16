import { requireAuth } from '../../lib/auth.js';
import { pushResult } from '../../lib/relay.js';
import { readBody, methodGuard } from '../../lib/http.js';

export default async function handler(req, res) {
  if (!methodGuard(req, res, 'POST')) return;
  const agent = requireAuth(req, res, 'agent');
  if (!agent) return;
  const { jobId, ok, result, error } = readBody(req);
  if (!jobId) return res.status(400).json({ error: 'jobId required' });
  await pushResult(jobId, { ok: !!ok, result, error });
  res.json({ received: true });
}
