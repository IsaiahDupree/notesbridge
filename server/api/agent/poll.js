import { requireAuth } from '../../lib/auth.js';
import { markAgentOnline, waitForJob } from '../../lib/relay.js';

// Long-poll job delivery. With ?wait=<sec> the server holds the request open and
// returns the moment a job is enqueued (push-like, low latency); the agent then
// reconnects immediately. Without ?wait, it returns right away (back-compat with
// older agents). The hang is capped below this function's maxDuration (vercel.json)
// and below the 75s online-marker TTL set here, so one mark per hang is enough.
const MAX_WAIT_SEC = 25;

export default async function handler(req, res) {
  const agent = requireAuth(req, res, 'agent');
  if (!agent) return;
  await markAgentOnline(agent.sub);
  const waitSec = Math.min(Math.max(Number(req.query.wait) || 0, 0), MAX_WAIT_SEC);
  const job = await waitForJob(agent.sub, waitSec);
  res.json({ job: job || null });
}
