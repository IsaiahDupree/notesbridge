// Private local text index. Note contents never leave the Mac during indexing.
import { createHash } from 'node:crypto';
import { chmodSync, existsSync, lstatSync, mkdirSync, openSync, closeSync, unlinkSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const DIRECTORY = join(homedir(), 'Library', 'Application Support', 'NotesBridge');
export const INDEX_PATH = join(DIRECTORY, 'notes-index.sqlite');
const LOCK_PATH = join(DIRECTORY, 'index.lock');
const fingerprint = (notes) => createHash('sha256').update(JSON.stringify(notes)).digest('hex');

async function openIndex({ create = false } = {}) {
  if (!create && !existsSync(INDEX_PATH)) return null;
  mkdirSync(DIRECTORY, { recursive: true, mode: 0o700 });
  if (lstatSync(DIRECTORY).isSymbolicLink()) throw new Error('Index directory must not be a symlink');
  chmodSync(DIRECTORY, 0o700);
  if (existsSync(INDEX_PATH) && lstatSync(INDEX_PATH).isSymbolicLink()) throw new Error('Index file must not be a symlink');
  let DatabaseSync;
  try { ({ DatabaseSync } = await import('node:sqlite')); }
  catch { throw new Error('Local indexing requires Node.js 22.13 or later; live Notes tools remain available'); }
  if (create && !existsSync(INDEX_PATH)) closeSync(openSync(INDEX_PATH, 'wx', 0o600));
  chmodSync(INDEX_PATH, 0o600);
  const db = new DatabaseSync(INDEX_PATH);
  db.exec('PRAGMA busy_timeout=5000; PRAGMA journal_mode=DELETE; PRAGMA secure_delete=ON;');
  if (create) db.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, folder TEXT NOT NULL,
      modified TEXT NOT NULL, locked INTEGER NOT NULL, plaintext TEXT NOT NULL
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(id UNINDEXED, title, plaintext);
    CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  `);
  return db;
}

export async function indexStatus() {
  const db = await openIndex();
  if (!db) return { ready: false, indexed_notes: 0, path: INDEX_PATH };
  try {
    const meta = Object.fromEntries(db.prepare('SELECT key,value FROM metadata').all().map(r => [r.key,r.value]));
    const count = db.prepare('SELECT COUNT(*) AS total, SUM(locked) AS locked FROM notes').get();
    return { ready: meta.ready === '1', indexed_notes: Number(count.total) - Number(count.locked || 0), total_notes: Number(count.total), password_protected_excluded: Number(count.locked || 0), indexed_at: meta.indexed_at || null, path: INDEX_PATH };
  } finally { db.close(); }
}

export async function refreshIndex(runLive, onProgress = () => {}) {
  mkdirSync(DIRECTORY, { recursive: true, mode: 0o700 });
  if (lstatSync(DIRECTORY).isSymbolicLink()) throw new Error('Index directory must not be a symlink');
  chmodSync(DIRECTORY, 0o700);
  let lock;
  try { lock = openSync(LOCK_PATH, 'wx', 0o600); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    if (lstatSync(LOCK_PATH).isSymbolicLink()) throw new Error('Index lock must not be a symlink');
    let old;
    try { old = JSON.parse(readFileSync(LOCK_PATH, 'utf8')); } catch {}
    if (!Number.isSafeInteger(old?.pid) || old.pid < 1) throw new Error('Index lock requires inspection before retrying');
    try { process.kill(old.pid, 0); throw new Error('An index refresh is already running'); }
    catch (check) {
      if (check.code !== 'ESRCH') throw check;
      unlinkSync(LOCK_PATH);
      lock = openSync(LOCK_PATH, 'wx', 0o600);
    }
  }
  writeFileSync(lock, JSON.stringify({ pid: process.pid, started_at: new Date().toISOString() }));
  let db;
  try {
    db = await openIndex({ create: true });
    const before = (await runLive('indexSnapshot')).notes;
    const prior = new Map(db.prepare('SELECT id,title,folder,modified,locked FROM notes ORDER BY id').all().map(r => [r.id,r]));
    const changed = before.filter(n => {
      const old = prior.get(n.id);
      return !old || old.title !== n.title || old.folder !== n.folder || old.modified !== n.modified || Boolean(old.locked) !== n.locked;
    });
    const meta = db.prepare('INSERT OR REPLACE INTO metadata (key,value) VALUES (?,?)');
    const priorRows = [...prior.values()].map(n => ({...n,locked:Boolean(n.locked)}));
    const ready = db.prepare("SELECT value FROM metadata WHERE key='ready'").get()?.value === '1';
    if (ready && fingerprint(priorRows) === fingerprint(before)) {
      const after = (await runLive('indexSnapshot')).notes;
      if (fingerprint(before) !== fingerprint(after)) throw new Error('Notes changed during refresh; retry');
      meta.run('checked_at',new Date().toISOString());
      const excluded = after.filter(n => n.locked).length;
      return { ok: true, indexed_notes: after.length - excluded, total_notes: after.length, changed_notes: 0, password_protected_excluded: excluded, baseline_stable: true, path: INDEX_PATH };
    }
    meta.run('ready', '0');
    // Remove deleted/locked text immediately, including text that was indexed before a note was locked.
    const current = new Map(before.map(n => [n.id,n]));
    const remove = db.prepare('DELETE FROM notes WHERE id=?');
    const removeFts = db.prepare('DELETE FROM notes_fts WHERE id=?');
    db.exec('BEGIN IMMEDIATE');
    try {
      for (const [id, old] of prior) {
        if (!current.has(id)) { remove.run(id); removeFts.run(id); }
        else if (current.get(id).locked && !old.locked) {
          db.prepare("UPDATE notes SET locked=1,plaintext='' WHERE id=?").run(id);
          removeFts.run(id);
        }
      }
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    const upsert = db.prepare('INSERT OR REPLACE INTO notes (id,title,folder,modified,locked,plaintext) VALUES (?,?,?,?,?,?)');
    const insertFts = db.prepare('INSERT INTO notes_fts (id,title,plaintext) VALUES (?,?,?)');
    for (let offset = 0; offset < changed.length; offset += 25) {
      const batch = changed.slice(offset, offset + 25);
      const response = await runLive('indexReadBatch', { ids: batch.map(n => n.id) });
      if (response.notes.length !== batch.length || response.notes.some((n,i) => n.id !== batch[i].id)) throw new Error('Index batch coverage changed; retry');
      db.exec('BEGIN IMMEDIATE');
      try {
        for (const n of response.notes) {
          upsert.run(n.id,n.title,n.folder,n.modified,Number(n.locked),n.locked ? '' : n.plaintext);
          removeFts.run(n.id);
          if (!n.locked) insertFts.run(n.id,n.title,n.plaintext);
        }
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
      onProgress({ indexed: Math.min(offset + 25, changed.length), changed_notes: changed.length, total_notes: before.length });
    }
    const after = (await runLive('indexSnapshot')).notes;
    if (fingerprint(before) !== fingerprint(after)) throw new Error('Notes changed during indexing; run index again to refresh changed notes');
    const rows = db.prepare('SELECT id,title,folder,modified,locked FROM notes ORDER BY id').all().map(n => ({...n,locked:Boolean(n.locked)}));
    if (fingerprint(rows) !== fingerprint(after)) throw new Error('Index metadata did not match the live library');
    meta.run('snapshot',fingerprint(after));
    meta.run('indexed_at',new Date().toISOString());
    meta.run('ready','1');
    const excluded = after.filter(n => n.locked).length;
    return { ok: true, indexed_notes: after.length - excluded, total_notes: after.length, changed_notes: changed.length, password_protected_excluded: excluded, baseline_stable: true, path: INDEX_PATH };
  } finally {
    if (db) db.close();
    closeSync(lock);
    unlinkSync(LOCK_PATH);
  }
}

// Preserve the live tool's case-insensitive substring semantics and cursor shape.
// Check live IDs, timestamps and lock flags before trusting any indexed text.
export async function searchIndex(args, runLive) {
  if (typeof args.query !== 'string' || !args.query.trim()) throw new Error('query must not be empty');
  if (!Number.isSafeInteger(args.limit) || args.limit < 1 || args.limit > 100) throw new Error('limit must be an integer from 1 to 100');
  if (args.cursor !== undefined && (typeof args.cursor !== 'string' || !args.cursor.startsWith('x-coredata://'))) throw new Error('Invalid cursor');
  const db = await openIndex();
  if (!db) return null;
  try {
    const meta = Object.fromEntries(db.prepare('SELECT key,value FROM metadata').all().map(r => [r.key,r.value]));
    if (meta.ready !== '1') return null;
    const snapshot = (await runLive('indexSnapshot')).notes;
    if (meta.snapshot !== fingerprint(snapshot)) return null;
    const candidates = db.prepare('SELECT id,title,plaintext,locked FROM notes WHERE id>? ORDER BY id').all(args.cursor || '');
    const results = [], skipped = [];
    let scanned = 0, last = null;
    const query = args.query.toLowerCase();
    for (const n of candidates) {
      if (scanned >= 50 || results.length >= args.limit) break;
      last = n.id; scanned++;
      if (n.locked) { skipped.push({id:n.id,reason:'password_protected'}); continue; }
      if ((n.title+'\n'+n.plaintext).toLowerCase().includes(query)) results.push({id:n.id,title:n.title});
    }
    return { results, scanned_notes: scanned, skipped, next_cursor: scanned < candidates.length ? last : null, indexed: true, coverage: 'Current Apple Notes snapshot verified against the private local index; password-protected notes excluded' };
  } finally { db.close(); }
}
