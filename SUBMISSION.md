# NotesBridge — App Directory Submission Playbook

Everything needed to submit NotesBridge to the OpenAI app directory (apps SDK /
connector review), what's already done, and what only the account owner can do.

## Status: what's built and verified

| Requirement | Status | Proof |
|---|---|---|
| MCP server, streamable HTTP, OAuth 2.1 + PKCE + DCR | ✅ live | `https://notesbridge.vercel.app/mcp`; e2e suite |
| Privacy policy | ✅ live | https://notesbridge.vercel.app/privacy (accurate: Supabase + Vercel subprocessors, transient job payloads, no note retention) |
| Support page | ✅ live | https://notesbridge.vercel.app/support |
| Rate limiting on auth + OAuth endpoints | ✅ live | signup 5/10min, login 10/10min, authorize 30/10min, token 60/min, register 20/hr, claim 10/10min — 429 verified in e2e |
| **Reviewer demo mode** | ✅ live | Any account with email `reviewer@notesbridge.demo` runs all 8 tools against server-side sample notes — works 24/7 with **no Mac agent**. Real accounts are unaffected. Verified in e2e (search/create/re-read with zero agents running). |
| Onboarding UX | ✅ live | 4-step wizard with live agent status at the root URL |
| 512×512 icon | ✅ | `assets/icon-512.png` |
| Full e2e suite | ✅ 22 green checks | `node test/e2e-oauth.mjs` |

## Steps only the account owner can do

1. **Developer / organization verification** at platform.openai.com (Settings →
   Organization → Verification). Identity check; requires the Owner role.
2. **Keep the demo credentials handy** for the submission form:
   - Email: `reviewer@notesbridge.demo`
   - Password: `DEMO_PASSWORD` in `.env.local` (already created and verified — do
     not rotate it after submitting, reviewers will use it)
3. **Submit** from the Platform dashboard (Apps → Submit):
   - MCP Server URL: `https://notesbridge.vercel.app/mcp`
   - Authentication: OAuth
   - Privacy policy: `https://notesbridge.vercel.app/privacy`
   - Support: `https://notesbridge.vercel.app/support`
   - Icon: `assets/icon-512.png`
   - Demo credentials: the reviewer account above
   - Listing copy: below

## Directory listing copy

**Name:** NotesBridge

**Tagline (short):** Your Apple Notes, in ChatGPT — search, read, and write, powered by your own Mac.

**Description (long):**
NotesBridge connects ChatGPT to the notes on your Mac. Search and read any
note, create new ones, append to lists, or rewrite drafts — all from a chat.
Your notes never live on our servers: every action is executed on your own
Mac by a small open-source agent you install with one command
(`npx apple-notes-agent`), and the relay only carries each request for the
seconds it's in flight. Write actions are always confirmed by you in ChatGPT
before they happen. Open source (MIT) and self-hostable.

**Categories:** Productivity, Notes

*(Copy refers to "the notes on your Mac" / Notes app descriptively; the product
name and branding contain no Apple marks.)*

## Review risks & mitigations

- **Novel architecture (desktop agent).** Most connectors are pure SaaS; ours
  relays to the user's machine. Mitigation: the reviewer demo account makes the
  app fully reviewable with no Mac. The listing copy and privacy policy explain
  the architecture honestly.
- **Latency.** A tool call round-trips through the queue to a polling agent
  (~1.5–4s typical). Within MCP norms; the relay caps waits at 50s and jobs
  expire at 45s so nothing runs stale.
- **Apple trademark.** Product is "NotesBridge"; copy says "your Apple Notes"
  descriptively only; the icon is generic (note + bridge). Do not use Apple's
  Notes app icon or "Apple" in the product name.
- **Destructive tools.** `update_note` is annotated `destructiveHint`; ChatGPT
  prompts for confirmation. Called out in the consent screen and privacy page.

## Fallback plan

If the directory review is rejected or slow: nothing is lost. The developer-mode
connector keeps working exactly as it does today for the owner and anyone who
creates an account on the dashboard and pairs their own Mac — the submission
only affects public discoverability.

## Re-verify before submitting

```bash
node test/e2e-oauth.mjs        # 22 checks, includes demo-mode + rate limits
curl -s https://notesbridge.vercel.app/api/health   # all flags true
```
