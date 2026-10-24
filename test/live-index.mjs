// Read-only integration against the owner's actual Notes library and local index.
// No note titles, bodies, IDs, search words or credentials are printed.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { statSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { runTool } from '../agent/notes-jxa.mjs';
import { INDEX_PATH, indexStatus, searchIndex } from '../agent/notes-index.mjs';

const status = await indexStatus();
assert(status.ready, 'Build the real Notes index before running this check');
assert.equal(statSync(INDEX_PATH).mode & 0o777, 0o600);
const exec = promisify(execFile);
const directIds = JSON.parse((await exec('/usr/bin/osascript', ['-l', 'JavaScript', '-e', "JSON.stringify(Application('Notes').notes.id().sort())"], { timeout: 40000, maxBuffer: 8 * 1024 * 1024 })).stdout);
const db = new DatabaseSync(INDEX_PATH, { readOnly: true });
try {
  const rows = db.prepare('SELECT * FROM notes ORDER BY id').all();
  assert.deepEqual(rows.map(n => n.id), directIds, 'Index must cover every live note ID');
  assert.equal(rows.filter(n => n.locked).length, status.password_protected_excluded);
  assert(rows.filter(n => n.locked).every(n => n.plaintext === ''), 'Protected text must be absent');
  const readable = rows.filter(n => !n.locked);
  assert.equal(Number(db.prepare('SELECT COUNT(*) AS n FROM notes_fts').get().n), readable.length);
  const samples = [...new Set([0, Math.floor(readable.length / 2), readable.length - 1])].map(i => readable[i]).filter(Boolean);
  for (const sample of samples) {
    const { note } = await runTool('getNote', { id: sample.id });
    assert.equal(note.plaintext, sample.plaintext, 'Indexed text must match the actual note');
    assert.equal(note.modified, sample.modified);
  }
  const protectedNote = rows.find(n => n.locked);
  if (protectedNote) await assert.rejects(runTool('getNote', { id: protectedNote.id }), /password protected/);
  const words = new Map();
  for (const n of readable) for (const word of new Set((n.title+'\n'+n.plaintext).toLowerCase().match(/[a-z]{4,}/g) || [])) words.set(word, (words.get(word) || 0) + 1);
  assert(words.size, 'Actual notes must contain searchable text');
  const query = [...words].sort((a,b) => b[1]-a[1])[0][0];
  assert(Number(db.prepare('SELECT COUNT(*) AS n FROM notes_fts WHERE notes_fts MATCH ?').get('"'+query+'"').n) > 0, 'Real full-text lookup must return a match');
  const expected = new Set(readable.filter(n => (n.title+'\n'+n.plaintext).toLowerCase().includes(query)).map(n => n.id));
  const found = new Set(), skipped = new Set();
  let cursor, pages = 0, scanned = 0;
  do {
    const result = await searchIndex({ query, limit: 17, ...(cursor ? { cursor } : {}) }, runTool);
    assert(result?.indexed, 'Index must match the current library snapshot');
    for (const note of result.results) { assert(expected.has(note.id)); assert(!found.has(note.id)); found.add(note.id); }
    for (const note of result.skipped) skipped.add(note.id);
    scanned += result.scanned_notes;
    if (result.next_cursor) assert(!cursor || result.next_cursor > cursor);
    cursor = result.next_cursor;
    assert(++pages <= rows.length + 1);
  } while (cursor);
  assert.deepEqual([...found].sort(), [...expected].sort());
  assert.equal(scanned, rows.length);
  assert.equal(skipped.size, status.password_protected_excluded);
  console.log(JSON.stringify({ ok: true, total_notes: rows.length, indexed_notes: readable.length, password_protected_excluded: skipped.size, direct_id_coverage: true, private_file_permissions: true, live_text_samples: samples.length, search_pages: pages, search_matches: found.size }));
} finally { db.close(); }
