import { requireAuth } from '../../lib/auth.js';
import { markAgentOnline, popJob } from '../../lib/relay.js';

export default async function handler(req, res) {
  const agent = requireAuth(req, res, 'agent');
  if (!agent) return;
  await markAgentOnline(agent.sub);
  const job = await popJob(agent.sub);
  res.json({ job: job || null });
}
