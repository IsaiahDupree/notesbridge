<div align="center">

# 📝 NotesBridge

**Use your Apple Notes from ChatGPT — search, read, and write, powered by your own Mac.**

[![License: MIT](https://img.shields.io/badge/License-MIT-f5b942.svg)](./LICENSE)
[![npm](https://img.shields.io/npm/v/apple-notes-agent.svg?color=4ade80&label=apple-notes-agent)](https://www.npmjs.com/package/apple-notes-agent)

</div>

NotesBridge is a [Model Context Protocol](https://modelcontextprotocol.io) (MCP) connector that lets ChatGPT work with your **Apple Notes**. It never uploads your notes to a third party — every action runs on **your own Mac** through a tiny local agent. The cloud piece is only a stateless relay that shuttles requests between ChatGPT and your Mac.

```
  ChatGPT  ──OAuth──►  NotesBridge relay  ──job queue──►  apple-notes-agent  ──►  Apple Notes.app
 (connector)          (Vercel, stateless)   (your Mac, polls & executes)         (on your Mac)
```

Your Mac is the only place your notes are ever read or written. The relay stores only short-lived job payloads and your account record; it never sees a note unless a job is in flight, and jobs expire in seconds.

---

## For users — 3 steps

**1. Create your account** at **[notesbridge.vercel.app](https://notesbridge.vercel.app)** and generate a pairing code.

**2. Install the Mac agent** (needs [Node 18+](https://nodejs.org)):

```bash
npx apple-notes-agent pair <YOUR-CODE>   # link this Mac to your account
npx apple-notes-agent install            # keep it running on every restart
```

The first time it touches Notes, macOS asks **"Terminal wants to control Notes"** — click **OK** (one time).

**3. Connect ChatGPT:** Settings → **Plugins** → turn on **Developer mode** (Security & login) → **Create** a custom plugin → paste the MCP Server URL **`https://notesbridge.vercel.app/mcp`** → Authentication **OAuth** → sign in & **Allow**.

That's it. In a new chat: *"Search my Apple Notes for the Q3 planning note"* or *"Create a note titled Groceries with milk, eggs, coffee."*

> Your Mac must be awake with the agent running. `npx apple-notes-agent install` makes it start automatically at login and restart if it ever crashes.

### Managing the agent

```bash
npx apple-notes-agent status      # is it paired & reachable?
npx apple-notes-agent logs        # recent activity
npx apple-notes-agent uninstall   # stop auto-start
```

---

## What ChatGPT can do

| Tool | Action |
|------|--------|
| `search` | Search notes by keyword |
| `fetch` / `get_note` | Read a note's full content |
| `list_folders` | List folders with note counts |
| `list_notes` | List notes (optionally by folder) |
| `create_note` | Create a new note |
| `append_to_note` | Append text to a note |
| `update_note` | Rewrite a note (destructive — ChatGPT confirms first) |

---

## Self-hosting

You can run your own relay so nothing depends on the hosted instance.

**Prereqs:** a [Vercel](https://vercel.com) account and a [Supabase](https://supabase.com) project (free tiers are fine).

1. **Storage** — in your Supabase project's SQL editor, run [`supabase/schema.sql`](./supabase/schema.sql). It creates a tiny Redis-shaped KV + queue surface (`nb_*` functions) with RLS on.
2. **Deploy** the `server/` directory to Vercel.
3. **Set env vars** (see [`server/.env.example`](./server/.env.example)):
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — your project + service-role key
   - `JWT_SECRET` — `openssl rand -hex 32`
4. **Verify:** `curl https://YOUR-APP.vercel.app/api/health` → `redisConfigured`, `redisOk`, `jwtSecretSet` all `true`.
5. Point the agent at it: `npx apple-notes-agent pair <CODE> --server https://YOUR-APP.vercel.app`.

---

## How it works

- **Auth** — OAuth 2.1 with PKCE and Dynamic Client Registration (RFC 7591). ChatGPT registers itself, the user signs in on the NotesBridge consent page, and ChatGPT gets a scoped MCP access token. JWTs are HMAC-signed; three kinds (`session`, `agent`, `mcp`) with distinct privileges.
- **Relay** — MCP tool call → job pushed to `jobs:<user>` (TTL ≤ the caller's wait window, so an abandoned job can't run late) → the Mac agent (holding a hanging long-poll) is handed the job within ~200ms, executes it, pushes the result → the MCP handler returns it. The long-poll means jobs are delivered on arrival rather than on a fixed interval, so relay overhead is ~300ms instead of ~1s. The agent is considered "online" only while it's actively connected.
- **Agent** — a dependency-free Node CLI. Tools run via JXA (`osascript -l JavaScript`) against Notes.app; arguments are passed as JSON over argv (never shell-interpolated). A macOS LaunchAgent keeps it alive across logins and crashes.

## Repository layout

```
server/    Vercel functions: OAuth + MCP endpoint + relay        (deploy this)
agent/     apple-notes-agent — the npm-published Mac CLI          (users npx this)
kit/       Puppeteer script that registers the ChatGPT connector  (optional automation)
supabase/  schema.sql for self-hosting the storage
test/      end-to-end OAuth + MCP integration test
```

## Development

```bash
# server
cd server && cp .env.example .env.local   # fill in, then: vercel dev
# end-to-end test against a live deployment (reads ../.env.local)
node test/e2e-oauth.mjs
# agent unit tests
node --test agent/test-agent-unit.mjs
```

## Security & privacy

- Notes are read/written **only on your Mac**. The relay never persists note content — job payloads live in Redis-shaped storage with a short TTL and are deleted on delivery.
- The agent token is stored at `~/.notesbridge-agent.json` (mode `600`).
- No secrets are committed; see [`.gitignore`](./.gitignore) and the `.env.example` files.
- Write tools are marked destructive so ChatGPT asks before overwriting.

## License

[MIT](./LICENSE) © Isaiah Dupree
