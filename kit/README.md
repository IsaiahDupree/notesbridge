# NotesBridge → ChatGPT Connector Registration Kit

Registers the NotesBridge custom MCP connector in ChatGPT using the persistent
agent Chrome profile (chrome-bridge, CDP on `127.0.0.1:9222`).

ChatGPT renamed **Connectors → Plugins** (2026). Custom MCP servers are added
through the developer-mode "New App" form. This kit reaches that form directly
via a deep link (`.../plugins#settings/Connectors?create-connector=true`), fills
Name / Description / Server URL, lets ChatGPT auto-discover the OAuth settings
from the server's `/.well-known` metadata, submits, then clicks
**"Sign in with NotesBridge"** and completes the OAuth popup (sign in + Allow).
Finally it verifies **NotesBridge** appears in the Plugins list and screenshots
the proof.

Developer mode is an **account-level** setting (Settings → Security and login →
"Developer mode") and is assumed already ON — the deep link needs it. The kit no
longer navigates settings or toggles anything.

The run is **idempotent**: if NotesBridge is already in the Plugins list, it
verifies and exits without creating a duplicate.

## Prerequisites

- macOS with Google Chrome and the chrome-bridge agent profile
  (`/Users/isaiahdupree/Documents/Chrome/chrome-bridge/`). The script
  auto-launches `chrome-launcher.sh agent` if port 9222 is not responding.
- The Chrome agent profile logged in to ChatGPT (Plus, developer mode ON). If
  not logged in, the script prints instructions and polls until you do.
- NotesBridge server deployed and healthy: `GET {NB_SERVER}/api/health` must
  return `redisConfigured: true`, `redisOk: true`, `jwtSecretSet: true`.
- Node 18+ (built-in `fetch`).

Install:

```bash
cd /Users/isaiahdupree/Software/notesbridge/kit
npm install          # puppeteer-core only
```

## Env vars

Read from the environment first, falling back to
`/Users/isaiahdupree/Software/notesbridge/.env.local`:

| Var | Meaning |
|-----|---------|
| `NB_SERVER` | NotesBridge server base URL (e.g. `https://notesbridge.vercel.app`) |
| `NB_EMAIL` | NotesBridge account email (used in the OAuth popup) |
| `NB_PASSWORD` | NotesBridge account password |

Flags:

| Flag | Effect |
|------|--------|
| `PREFLIGHT_ONLY=1` | Health check + CDP connect + ChatGPT login-state detection + `01-chatgpt-state.png`, then exit. Never touches settings. |
| `CHAT_TEST=1` | After registration, open a chat, ask "Use NotesBridge to list my Apple Notes folders", screenshot the reply. **Requires the Mac agent running AND Apple Notes automation approved** (see below). |

## How to run

```bash
cd /Users/isaiahdupree/Software/notesbridge/kit

# 1. Safe dry run (recommended first)
PREFLIGHT_ONLY=1 node register-connector.mjs

# 2. Full registration (idempotent — safe to re-run)
node register-connector.mjs

# 3. Full registration + end-to-end chat test
CHAT_TEST=1 node register-connector.mjs
```

Whenever a UI step cannot be automated (ChatGPT's DOM churns), the script
screenshots `NN-<step>-FAILED.png`, prints exactly what to click manually, then
polls every 5s for the expected result and resumes automatically.

## The Mac agent (the other half)

The connector only does something when your Mac agent is paired and running —
it's what actually touches Apple Notes.

```bash
cd /Users/isaiahdupree/Software/notesbridge
# one-time pairing (generate a code on the NotesBridge site or via the API):
node agent/cli.mjs pair <CODE>
# then leave this running:
node agent/cli.mjs run
```

**Apple Notes permission (one-time):** the first time the agent runs a Notes
action, macOS shows a "Terminal wants to control Notes" prompt — click **OK**.
Until you approve it, note operations from ChatGPT time out with
"timed out on the Mac". Grant/verify at:
System Settings → Privacy & Security → Automation → (your terminal) → Notes.

## Expected screenshots (`kit/screenshots/`)

Numbered in run order; exact numbers shift if fallback shots occur.

| Screenshot | Shows |
|------------|-------|
| `01-chatgpt-state.png` | chatgpt.com after load (login-state evidence) |
| `NN-create-form.png` | Empty "New App" create form |
| `NN-create-form-filled.png` | Name / Description / Server URL filled, OAuth discovered |
| `NN-after-create.png` | "Add NotesBridge to ChatGPT" modal (Sign in button) |
| `NN-oauth-page.png` | NotesBridge OAuth popup (login view) |
| `NN-oauth-consent.png` | Consent view before clicking Allow |
| `NN-connector-verified.png` | Plugins list showing NotesBridge (proof) |
| `NN-chat-test-reply.png` | (CHAT_TEST=1) assistant reply in the chat |
| `NN-<step>-FAILED.png` | Any step that needed manual help |

## Troubleshooting

- **Preflight fails** — the script prints which flag is false.
  `redisConfigured`/`redisOk` → the server's storage env vars
  (`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`) are missing/wrong;
  `jwtSecretSet` → set `JWT_SECRET`; then `npx vercel --yes --prod` and re-run.
- **CDP not responding / Chrome won't start** — run
  `bash /Users/isaiahdupree/Documents/Chrome/chrome-bridge/chrome-launcher.sh agent`
  yourself, then `curl http://127.0.0.1:9222/json/version`.
- **Stuck on "not logged in"** — the script first tries the "Welcome back"
  one-click account tile; if that fails, log in to ChatGPT inside the agent
  Chrome window. It polls every 5s with no timeout and resumes.
- **Create form doesn't open** — Developer mode must be ON at the account level
  (Settings → Security and login → Developer mode). Then re-run, or open the
  deep link printed in the manual instructions.
- **OAuth window never opens** — allow popups for chatgpt.com; the script polls
  `browser.targets()` for a page on the `NB_SERVER` origin, then resumes.
- **Sign-in error in OAuth popup** — the script retries with "Create account &
  continue". If both fail, check `NB_EMAIL`/`NB_PASSWORD` and the server logs.
- **Connector missing at verification** — the script polls up to 5 extra
  minutes, then exits 1. Check Settings → Plugins manually and re-run;
  the run is idempotent so re-running is safe.
