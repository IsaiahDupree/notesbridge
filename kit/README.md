# NotesBridge automation kit

Browser automations that register and submit the NotesBridge connector to
ChatGPT, so you don't have to click through the flows by hand. Both drive the
persistent **chrome-bridge** agent Chrome over CDP (`127.0.0.1:9222`) using
`puppeteer-core`, and both are **defensive**: every step screenshots to
`screenshots/`, and anything that can't be automated is printed as an explicit
"do this" instruction while the script waits or exits cleanly.

| Script | What it does |
|--------|--------------|
| [`register-connector.mjs`](./register-connector.mjs) | Adds NotesBridge as a **developer-mode connector** in your own ChatGPT (Settings → Plugins → Create → OAuth → Allow). Idempotent. Use this to try the connector yourself today — no review needed. |
| [`submit-plugin.mjs`](./submit-plugin.mjs) | Fills the **public directory submission** at platform.openai.com (Create plugin → With MCP → the multi-section form) from [`submission.config.json`](./submission.config.json). Stops before "Submit for review". |
| [`lib/openai-form.mjs`](./lib/openai-form.mjs) | **Reusable primitives** for driving the submission form (Radix-select auth, React inputs, the OAuth Scan-Tools flow, domain verification, tool-justification fills, stale-session reload). Import these to submit **any** MCP plugin, not just NotesBridge. |
| [`SUBMIT-FLOW.md`](./SUBMIT-FLOW.md) | The **field-by-field map** of the real 7-section form + every gotcha, verified by actually submitting NotesBridge v1.0.0. Read this first when submitting a new plugin. |

**Reusing this for another plugin (e.g. MediaPoster):** point
[`submission.config.json`](./submission.config.json) at the new MCP URL + listing
copy + prompts + 5 positive / 3 negative test cases + release notes, make sure the
server meets the checklist in [`SUBMIT-FLOW.md`](./SUBMIT-FLOW.md#reuse-checklist-for-the-next-plugin-eg-mediaposter),
then drive the form with the `lib/openai-form.mjs` helpers.

## Setup

```bash
cd kit
npm install            # puppeteer-core only
```

Prerequisites for both:
- macOS with the chrome-bridge agent Chrome. If CDP isn't up on `:9222`, the
  scripts launch `chrome-launcher.sh agent` automatically.
- That Chrome logged in to the relevant site (ChatGPT and/or platform.openai.com).
  If not, the scripts print instructions and poll until you log in.

Config/secrets: `submission.config.json` holds the listing values (edit to reuse
for another plugin). The reviewer demo **password is never stored here** — it's
read from `../.env.local` by the env-var name in the config (`DEMO_PASSWORD`).

## 1. Register the dev-mode connector

```bash
node register-connector.mjs                 # create the connector via OAuth
PREFLIGHT_ONLY=1 node register-connector.mjs # health + login check only
CHAT_TEST=1 node register-connector.mjs      # then run a live "list my folders" prompt
```

Idempotent — if NotesBridge is already in your Plugins list it verifies and
exits. See screenshots `01…`–`19…`.

## 2. Submit to the OpenAI directory

```bash
node submit-plugin.mjs                        # fill the form, STOP before submit
DRAFT_URL="https://platform.openai.com/plugins/edit/…" node submit-plugin.mjs  # resume a draft
SUBMIT=1 node submit-plugin.mjs               # also click "Submit for review"
```

It walks the form: **Create plugin → "With MCP" → the "Create new plugin" dialog
(Standard = same MCP URL for every user) → Continue →** an editor with sections
**Info · MCP · Skills · Prompts · Testing · Global · Submit**. You advance with
the **Continue** button at the bottom of each section (the top tabs don't switch).
The App Info section is fully automated (name, subtitle [≤30 chars], description,
Category and Developer Identity comboboxes, author, all four URLs, icon uploads);
later sections are filled best-effort — watch the first run.

### Two things only you can do (the script flags both)

1. **Developer identity verification.** platform.openai.com → Plugins → Create
   plugin → With MCP → Continue on the identity dialog → finish (business/developer
   tier). Until then the create form is gated and the script exits with instructions.
2. **A demo recording.** OpenAI marks "Demo Recording URL" required. Record a
   screen video of the plugin working, host it (YouTube/Loom/…), and put the URL
   in `submission.config.json` → `info.demoRecordingUrl`.

The reviewer demo credentials (`reviewer@notesbridge.demo` + `DEMO_PASSWORD`) are
the important field — reviewers use them to exercise all tools 24/7 with no Mac
(the server's demo mode). Paste-ready listing copy also lives in
[`../LISTING.md`](../LISTING.md); the end-to-end walkthrough is in
[`../SUBMISSION.md`](../SUBMISSION.md).

## Notes

- Screenshots for every step are written to `screenshots/` — send them along if a
  step needed manual help so the selectors can be tightened.
- ChatGPT / platform.openai.com DOM churns; the scripts use text/label matching
  and print exactly what to set for anything they can't find, so a partial run is
  still useful.
