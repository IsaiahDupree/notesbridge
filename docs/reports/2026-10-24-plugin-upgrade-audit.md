# Installed plugin restoration and upgrade audit — October 24, 2026

Scope: save the NotesBridge restoration to GitHub, refresh/repair installed ChatGPT integrations, and carry the owner account/password/indexing improvements into the other custom bridge apps. The installed Settings list contains 23 entries.

## Verified service access

| Installed entry | Observed outcome |
|---|---|
| CalendarBridge | Restored 1.4 relay, isolated persistence, encrypted owner login and paired launch agent. ChatGPT OAuth/tool refresh completed; installed read returned seven real calendars. |
| Capability Radar | Existing read_radar tool succeeds. |
| Codex Security Cloud | Listed as installed and its tools are registered. Security workflows were not invoked during this integration-maintenance task. |
| Data | Listed as installed. No separate account/profile health action was exercised. |
| EtsyOps | Restored 1.4 isolated persistence and encrypted owner login; ChatGPT OAuth/tool refresh and installed get_plan pass. Etsy application key is absent from known private configurations, so real-shop access remains unverified. |
| GapRadar | Restored 1.4 isolated persistence and encrypted owner login. Health and both OAuth discovery documents return HTTP 200. ChatGPT Reconnect/Connect another account report no browser setup URL; no OAuth registration reaches the server during those attempts. Installed connection remains incomplete. |
| GitHub | Live get_profile succeeds for IsaiahDupree. |
| Gmail | Live get_profile succeeds for the owner mailbox. |
| Google Calendar | Live get_profile succeeds for the owner account. |
| Google Drive | Live get_profile succeeds for the owner account. |
| HeyGen | Live current-user read succeeds. |
| JetKVM | Local and installed cloud health pass. Real device/USB/video capture and leased physical input were used for the authorized bridge logins. Installed tool refresh completed. No firmware, power or general shell capability was added. |
| MediaSuite Demo | Installed URL points to a retired Railway application. Health, OAuth discovery and account config return HTTP 404 Application not found. Existing Railway CLI is unauthorized. No replacement project or subscription was purchased. |
| MediaSuite Vercel | Canonical Supabase schema/runtime/proxy restored. Actual owner Google SSO, exact callback, PKCE and signed-in-account consent verified. Installed ChatGPT OAuth/tool refresh and real list_accounts read pass; connected social-account inventory is currently empty. |
| MessagesBridge | Existing 1.4 mb_* isolated storage and owner pairing verified. Paired subject matches the verified owner account; installed status reports 3,360 indexed messages across 214 conversations. This is index coverage, not proof of complete phone history. |
| Muse Insights - Isaiah | Private tunnel/API work. Restored explicit Safari executor configuration and fixed the runtime builder so it preserves enable/disable choices. Five real environment-builder tests pass. Replaced stale nonsecret browser-target metadata under the query mutex; live read reaches the actual Muse login page. Current Meta email/authenticator verification remains pending; historical October 13 identity/time are not fresh login evidence. No Muse question was sent. |
| NotesBridge | Owner account, encrypted password, paired relay and ChatGPT reconnect verified. 941 notes enumerated: 912 readable notes indexed; 29 protected notes excluded. Search/fetch/pagination, live content comparisons and private SQLite permissions passed. |
| PostHog | Live user-get succeeds for isaiahdupree33@gmail.com, with email verified. Existing OAuth scopes retained. |
| RemindersBridge | Restored 1.4 isolated persistence and encrypted owner login. Native access and ChatGPT reconnect/tool refresh verified; installed read returns the real Reminders list with one reminder. |
| SecondBrainBridge | Restored 1.4 isolated persistence and encrypted owner login. Private incremental SQLite index covers 2,578 actual vault files with a 15-minute refresh. Independent file coverage/content checks and installed list/search/fetch pass. |
| ShortcutsBridge | Restored 1.4 isolated persistence and encrypted owner login. ChatGPT reconnect/tool refresh and actual empty native folder inventory pass. No Shortcut was run. |
| Supabase | Shared project SQL, migrations, real storage checks and security advisor reads work. |
| Windsor.ai | Live current-user read succeeds. Loaded installed settings show version 4.0.0 and no Update control. |

The installed list offered no bulk version-update action. Vendor connection checks passed; no vendor package-version change was applied. Custom service changes and their verified runtime deployments are recorded separately from remaining provider authentication or legacy app-entry failures.

## Source checkpoints

- NotesBridge: b13fcbd and 57082e9, saved to main before the other upgrades.
- Calendar: 62d7857 and 71d0ea9; Reminders: b05f2c0 and f79bc07; Shortcuts: 6bb4bac and 709b687; SecondBrain: dfec7d4 and fe4df53. Each deployed and pushed.
- EtsyOps: mergeable restoration branch 97440be; draft PR https://github.com/IsaiahDupree/etsyops/pull/1. Its unrelated original local Git history was preserved.
- GapRadar: baf795b and bc1510b pushed to main. Pre-existing kit changes/screenshots were preserved.
- MediaSuite: existing health fix brought forward as 5b521ec, restoration b8aa559 and final endpoint receipt 20dd7af pushed to fix/mediasuite-watchdog-runtime-20260815.
- Content Creation Suite: Muse runtime preservation 2704a33f and authentication-boundary receipt 9930807c pushed to the existing work branch. Unrelated ongoing source edits were excluded.

## Validation and credential handling

Existing bridge unit suites, real Supabase value/FIFO/expiry/counter checks and actual vault-index checks passed. MediaSuite typecheck and 13 focused account/OAuth/health tests passed. Five Muse runtime-builder tests use real subprocesses and temporary files. Native calendar/reminder reads were verified through the installed plugin after their observed access prompts.

Production relays refuse absent persistent storage and expose failing readiness honestly. Long-poll waits reserve time for authenticated database calls inside Vercel's request budget. Supabase logs also recorded intermittent internal Auth database-connection timeouts; final seven bridge health probes returned HTTP 200 with persistent storage ready, and MediaSuite's final dependency-readiness probe passed.

New owner passwords are generated and saved in the existing encrypted vault. Paired configurations, private session receipts, runtime databases and rollback environments remain outside Git. Completed masked password-entry captures were removed. No credential or note body is included in this report. During the initial MediaSuite callback diagnosis, an authorization URL appeared in diagnostic output; its test session was closed, the exact callback was added while preserving the shared default site, and the corrected PKCE flow was verified.

Remaining completion gates: Meta/Muse verification, repair/replacement of GapRadar's installed setup flow, the retired MediaSuite Demo endpoint, and an Etsy application key for real-shop features. The working MediaSuite Vercel connection remains separate from the retired Demo entry.
