# NotesBridge restoration and local index — 2026-10-24

## Verified runtime

- Production health responds HTTP 200 with storage and JWT checks passing.
- The existing owner account is recovered; its new 32-character password passes a real production login. It is stored in the existing encrypted credential vault. No credentials are in this report or Git.
- The account's fresh verification email was matched through its existing authenticated Gmail route and the exact NotesBridge verification link was consumed. Production account info reports verified=true and demo=false.
- The existing paired Mac agent is online and configured to start at login. No reviewer/demo account was paired to real notes.
- Apple Notes initially answered version queries but timed out on note, folder and account queries. A clean Notes quit/reopen restored those Apple Events. Existing Node-to-Notes permissions were used without changing TCC grants.
- Local private storage configuration still pointed to the retired database. It was synchronized with the existing production deployment on the required shared project. No schema or production deployment change was needed.

## Index and search

- Added a private SQLite/FTS5 index, real JXA snapshot/read batches, CLI index/status/install commands, incremental refresh, and current-snapshot checks before cached keyword search. Live search remains the fallback for an unavailable or stale index.
- Initial indexing covered all 941 real note IDs: 912 readable notes and 29 password-protected exclusions. No attachment content or protected text was indexed.
- The index file is mode 600 inside a mode-700 directory outside Git. A bounded LaunchAgent checks for changes every 900 seconds and exits between runs.
- An initial validation overlapped installation/refresh and correctly refused an index marked unavailable. Unchanged refreshes now keep the completed index available. A subsequent full read-only integration passed: exact independent ID coverage, private permissions, three live text comparisons, 20 search pages, 274 expected matches, and all 29 protected exclusions.
- Production relay list_folders, paginated list_notes, and indexed search all returned successful real responses after the agent restart. The observed calls completed in approximately 2–3 seconds.
- All 16 existing agent tests, syntax checks and diff whitespace checks passed. The new live-index integration uses actual notes and SQLite; it prints only aggregate receipts.

## Installed ChatGPT connection — completed through JetKVM

- JetKVM's existing authenticated gateway, device, video, physical keyboard/mouse and exclusive input lease were verified. No gateway, firmware or security-protection changes were needed.
- Used the already authenticated ChatGPT session in Waterfox. A separate Safari automation was changing frontmost Safari pages, so its activity and data were preserved while this setup moved to the independent browser.
- Selected the existing NotesBridge account's Reconnect flow. The saved owner credential was entered into the observed masked field through the scoped encrypted-vault/JetKVM helper; no password appeared in tool arguments, receipts or Git.
- Sign-in succeeded, but consent exposed `unknown client_id`: ChatGPT's original OAuth client registration was absent from the repaired storage. Restored only that exact client and its exact HTTPS ChatGPT callback, after inspecting the current owner-initiated flow and verifying the owner login. Preserved the existing redirect validation, S256 PKCE and normal token exchange; no general unknown-client fallback was added.
- The normal consent/callback completed. ChatGPT settings no longer show Reconnect, and its tool definitions were refreshed.
- Verified the **installed ChatGPT plugin**, rather than only a direct relay token: list_folders returned both real folders and 941 notes; indexed search succeeded; fetch returned the exact selected note; another search followed next_cursor and advanced successfully. Private note titles and bodies were not included in this report.
- The 912-note local index remains ready, with 29 protected exclusions and the 15-minute incremental refresh installed. No further owner sign-in step is pending.

The source and local agent include indexing; no npm publication is claimed.
