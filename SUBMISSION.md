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
| Apps SDK UI component | ✅ built & wired | `ui://widget/notes.html` on the 5 read tools (folders/notes/search/note cards). Protocol-verified live. **Renders only once the app is approved** — developer-mode connectors display tool output as text (confirmed empirically with both `text/html+skybridge` and `text/html;profile=mcp-app`). No effect on the working connector; e2e stays green. |
| 512×512 icon | ✅ | `assets/icon-512.png` |
| Full e2e suite | ✅ 22 green checks | `node test/e2e-oauth.mjs` |

## Steps only the account owner can do

*(Portal flow verified live 2026-07-17: the submission form is at
`platform.openai.com/plugins` → **Create plugin** → **With MCP**. It is gated by
identity verification — clicking Create plugin shows "Complete identity
verification — you need a verified developer identity before you can create or
upload a plugin." That check requires a government ID / selfie and can only be
done by you.)*

1. **Complete developer identity verification.** platform.openai.com → **Plugins**
   → **Create plugin** → **With MCP** → **Continue** on the "Complete identity
   verification" dialog, and finish the ID check (or do it up front at Settings →
   Organization → **Verifications**). Requires the Owner role. *(Note: the org
   already shows a base "Verified" status, but plugin creation needs this
   developer-identity tier on top of it.)*
2. **Keep the demo credentials handy** for the form:
   - Email: `reviewer@notesbridge.demo`
   - Password: the `DEMO_PASSWORD` value in `.env.local` (already created &
     verified — do not rotate it after submitting; reviewers use it)
3. **Create the plugin & submit.** Back at Plugins → Create plugin → With MCP:
   - Enter MCP Server URL `https://notesbridge.vercel.app/mcp`, Authentication
     **OAuth**, then click **Scan Tools** (auto-discovers all 8).
   - Fill name, logo (`assets/icon-512.png`), description, company URL, privacy
     (`/privacy`) and support (`/support`) URLs, test prompts, demo credentials —
     all paste-ready in **LISTING.md**.
   - Click **Submit for review**.

## Directory listing copy

All paste-ready form values (name, tagline, description, URLs, demo credentials,
test prompts + expected responses, OAuth endpoints) live in **LISTING.md**.

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

## Automation

`kit/submit-plugin.mjs` drives the submission form in the agent Chrome (CDP :9222):
it opens Create plugin → With MCP, fills every field from the values above, runs
Scan Tools, and **stops before "Submit for review"** for you to eyeball. Re-run
with `SUBMIT=1` to also click submit.

```bash
cd kit && node submit-plugin.mjs        # fills the form, stops before submit
SUBMIT=1 node submit-plugin.mjs         # also clicks Submit for review
```

It requires the identity gate (step 1) to be cleared first — if it isn't, the
script prints instructions and waits, then continues automatically once you've
verified. (Field selectors are best-effort since the form is gated; watch the
first run — it prints exactly what to set for anything it can't fill.)

## Re-verify before submitting

```bash
node test/e2e-oauth.mjs        # 22 checks, includes demo-mode + rate limits
curl -s https://notesbridge.vercel.app/api/health   # all flags true
```
