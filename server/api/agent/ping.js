import { requireAuth } from '../../lib/auth.js';

// Non-mutating agent reachability/pairing check for `apple-notes-agent status`.
// Unlike /api/agent/poll it does NOT markAgentOnline (which would make the relay
// report the Mac online for ~75s with no run-loop serving jobs) and does NOT
// popJob (which would steal/force-fail a real queued job). It only validates the
// agent bearer token.
export default async function handler(req, res) {
  const agent = requireAuth(req, res, 'agent');
  if (!agent) return;
  res.json({ ok: true });
}
