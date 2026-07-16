// relay.js — job queue between the MCP endpoint and each user's Mac agent.
//
// MCP tool call → lpush jobs:<userId> → agent polls (rpop) → executes on Mac
// → posts result → lpush result:<jobId> → MCP handler picks it up (rpop poll).

import { redis } from './redis.js';
import { randomId } from './auth.js';

// JOB_TTL must stay <= RESULT_WAIT_MS: once the MCP caller has given up waiting,
// the job must expire out of the queue before a briefly-asleep/lagging agent can
// wake, pop it, and run it (an orphan write on the destructive tools).
const JOB_TTL = 45; // seconds
const RESULT_WAIT_MS = 50_000;
const RESULT_POLL_MS = 400;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function agentOnline(userId) {
  return !!(await redis.get(`online:${userId}`));
}

export async function markAgentOnline(userId) {
  await redis.set(`online:${userId}`, '1', 75);
}

export async function enqueueJob(userId, tool, args) {
  if (!(await agentOnline(userId))) {
    throw new Error(
      'Your Mac agent is offline. Start it on your Mac with: npx apple-notes-agent run (and make sure the Mac is awake).'
    );
  }
  const jobId = randomId('job');
  // Stamp enqueuedAt so the agent can skip any job it pops after the caller's
  // RESULT_WAIT_MS window has already elapsed (belt-and-suspenders with JOB_TTL).
  await redis.lpush(`jobs:${userId}`, JSON.stringify({ jobId, tool, args, enqueuedAt: Date.now() }));
  await redis.expire(`jobs:${userId}`, JOB_TTL);

  const deadline = Date.now() + RESULT_WAIT_MS;
  while (Date.now() < deadline) {
    const raw = await redis.rpop(`result:${jobId}`);
    if (raw) {
      const { ok, result, error } = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!ok) throw new Error(error || 'Agent reported an error');
      return result;
    }
    await sleep(RESULT_POLL_MS);
  }
  throw new Error('Timed out waiting for the Mac agent to respond (is the Mac asleep?).');
}

export async function popJob(userId) {
  const raw = await redis.rpop(`jobs:${userId}`);
  return raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : null;
}

export async function pushResult(jobId, payload) {
  await redis.lpush(`result:${jobId}`, JSON.stringify(payload));
  await redis.expire(`result:${jobId}`, 60);
}
