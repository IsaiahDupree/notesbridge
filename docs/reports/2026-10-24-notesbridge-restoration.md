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

## Remaining client action

The installed ChatGPT plugin reports UNAUTHORIZED and explicitly requires
reauthentication. Server/agent health and a direct authenticated relay test do
not establish that this installed plugin has reconnected. Native ChatGPT app
control was refused by the computer-use tool, and the isolated browser's
ChatGPT sign-in failed. Owner reconnection through ChatGPT Plugins is still
required unless a subsequent installed-plugin call succeeds.

The source and local agent include indexing; no npm publication is claimed.
