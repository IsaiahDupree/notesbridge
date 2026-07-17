// demoStore.js — server-side sample notes for the reviewer/demo account.
// Lets app reviewers exercise every tool 24/7 with no Mac agent involved.
// Notes persist in storage under demoNotes:<userId>.
// Result shapes mirror the real apple-notes-agent exactly, so ChatGPT sees the
// same formats whether a call was served by the demo store or a paired Mac.

import { redis } from './redis.js';

export const DEMO_EMAIL = (process.env.DEMO_EMAIL || 'reviewer@notesbridge.demo').toLowerCase();

const KEY = (userId) => `demoNotes:${userId}`;

function seed() {
  const now = new Date('2026-07-01T12:00:00Z').toISOString();
  return {
    nextId: 5,
    notes: {
      'demo-1': { id: 'demo-1', title: 'Welcome to NotesBridge', folder: 'Notes', plaintext: 'Welcome to NotesBridge\nThis demo account uses sample notes so you can try every tool. Real accounts operate on the user\'s own Apple Notes via their paired Mac.', created: now, modified: now },
      'demo-2': { id: 'demo-2', title: 'Grocery list', folder: 'Notes', plaintext: 'Grocery list\nmilk\neggs\ncoffee beans\nblueberries', created: now, modified: now },
      'demo-3': { id: 'demo-3', title: 'Q3 planning', folder: 'Work', plaintext: 'Q3 planning\nShip connector review\nFollow up with design on icon\nBook offsite venue', created: now, modified: now },
      'demo-4': { id: 'demo-4', title: 'Sourdough recipe', folder: 'Recipes', plaintext: 'Sourdough recipe\n500g bread flour\n375g water\n100g starter\n10g salt\nBulk ferment 5h, shape, cold proof overnight, bake 45m at 245C.', created: now, modified: now },
    },
  };
}

async function load(userId) {
  const raw = await redis.get(KEY(userId));
  if (!raw) {
    const db = seed();
    await redis.set(KEY(userId), JSON.stringify(db));
    return db;
  }
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}

const save = (userId, db) => redis.set(KEY(userId), JSON.stringify(db));

export async function demoExec(userId, tool, args = {}) {
  const db = await load(userId);
  const all = () => Object.values(db.notes);

  switch (tool) {
    case 'listFolders': {
      const names = [...new Set(all().map((n) => n.folder))];
      return { folders: names.map((name) => ({ name, count: all().filter((n) => n.folder === name).length })) };
    }
    case 'listNotes': {
      let list = all();
      if (args.folder) {
        list = list.filter((n) => n.folder.toLowerCase() === String(args.folder).toLowerCase());
        if (!list.length) throw new Error(`Folder not found: ${args.folder}`);
      }
      list.sort((a, b) => (a.modified < b.modified ? 1 : -1));
      return { notes: list.slice(0, Math.min(args.limit || 30, 100)).map((n) => ({ id: n.id, title: n.title, folder: n.folder, modified: n.modified })) };
    }
    case 'searchNotes': {
      const q = String(args.query || '').toLowerCase();
      const hits = all().filter((n) => n.title.toLowerCase().includes(q) || n.plaintext.toLowerCase().includes(q));
      return { results: hits.slice(0, args.limit || 20).map((n) => ({ id: n.id, title: n.title })) };
    }
    case 'getNote': {
      let note = args.id ? db.notes[args.id] : null;
      if (!note && args.title) {
        const t = String(args.title).toLowerCase();
        note = all().find((n) => n.title.toLowerCase() === t) || all().find((n) => n.title.toLowerCase().includes(t));
      }
      if (!note) throw new Error(`Note not found: ${args.id || args.title || ''}`);
      return { note: { id: note.id, title: note.title, plaintext: note.plaintext, folder: note.folder, created: note.created, modified: note.modified } };
    }
    case 'createNote': {
      const id = `demo-${db.nextId++}`;
      const now = new Date().toISOString();
      db.notes[id] = { id, title: args.title, folder: args.folder || 'Notes', plaintext: `${args.title}\n${args.body ?? ''}`, created: now, modified: now };
      await save(userId, db);
      return { note: { id, title: args.title, folder: db.notes[id].folder } };
    }
    case 'appendToNote': {
      const note = db.notes[args.id];
      if (!note) throw new Error(`Note not found: ${args.id}`);
      note.plaintext += `\n${args.text}`;
      note.modified = new Date().toISOString();
      await save(userId, db);
      return { note: { id: note.id, title: note.title } };
    }
    case 'updateNote': {
      const note = db.notes[args.id];
      if (!note) throw new Error(`Note not found: ${args.id}`);
      note.title = args.title;
      note.plaintext = `${args.title}\n${args.body ?? ''}`;
      note.modified = new Date().toISOString();
      await save(userId, db);
      return { note: { id: note.id, title: note.title } };
    }
    default:
      throw new Error(`Unknown tool: ${tool}`);
  }
}
