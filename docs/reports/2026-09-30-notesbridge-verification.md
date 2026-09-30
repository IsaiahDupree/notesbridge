# NotesBridge verification — 2026-09-30

## Implemented and verified

- Initial installed connector call returned an internal error. Production health incorrectly reported ok=true while redisOk=false; the agent ping returned HTTP 500.
- Production storage pointed to the unavailable gqjgxltroyysjoxswbmn project. Applied isolated actp_notesbridge_kv/list storage and nb_* RPCs to the required ivhfuhxorppptyuofbgq project. RLS enabled; functions use SECURITY INVOKER with fixed search_path. Verified anon/authenticated cannot execute all seven RPCs.
- Updated production storage environment and deployed the relay. Public health now verifies storage and JWT configuration and returns HTTP 503 when unhealthy. Current deployed health passes.
- Real storage roundtrip, FIFO, expiry and counter tests passed; unique test keys cleaned up.
- Agent pagination and search now use stable note IDs. Search scans bounded pages and reports password-protected exclusions; listing no longer silently ignores failed folder reads. Server schemas accept cursors; callers must follow next_cursor, including empty search pages.
- Removed private note arguments from agent job logs and raw JXA output from parse-error messages; added bounded network deadlines.
- Installed updated local apple-notes-agent from the source checkout.
- 16 agent tests and 21 server tests passed. All seven JXA source programs compile. Existing server regression tests include demo-mode behavior; these are not evidence of real Notes access.

## Pending owner actions and runtime verification

- Notes UI showed 914 iCloud notes, but this is an observed UI count, not verified exhaustive connector coverage.
- Local listFolders timed out. System Settings shows ChatGPT -> Notes Automation disabled. Requested confirmation before enabling this security-sensitive access; it remains pending.
- Original agent token is rejected against repaired storage. Old owner account/OAuth records were not recovered. Opened https://notesbridge.vercel.app in Safari and requested owner signup; do not pair reviewer/demo accounts with real notes.
- test/live-all-notes.mjs is ready to verify every listed note against an independent Apple Notes ID/modified-time baseline, read every unprotected note, and compare all expected keyword matches with paginated search. It has NOT run to completion, and real pagination/reading/search remain unverified.
- After approval/signup: run the full local test, generate owner pairing code, pair/install the LaunchAgent, reconnect the installed ChatGPT plugin (refresh its tool schema for cursor arguments), and test actual list/fetch/search through the connector. Background process Notes permissions may need a separate grant.
- No notes created, edited or deleted. Password-protected content, attachment contents, handwriting OCR and complete iCloud sync are not established by these tests.
