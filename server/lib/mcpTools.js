// mcpTools.js — the MCP server exposed to ChatGPT. Every tool forwards to the
// paired Mac agent through the relay; the agent does the actual Notes work.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { enqueueJob } from './relay.js';
import { demoExec } from './demoStore.js';
import { NOTES_WIDGET_HTML, WIDGET_URI, WIDGET_MIME } from './widget.js';

const asText = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] });
const asError = (err) => ({
  isError: true,
  content: [{ type: 'text', text: `Error: ${err.message || String(err)}` }],
});
const noteUrl = (id) => `applenotes://note/${encodeURIComponent(id)}`;

// Tool result that ALSO renders the notes widget as an Apps SDK component:
// keep the JSON text (the model reads it), attach structuredContent for the
// widget, and point at the widget template via both accepted _meta keys.
const withCard = (view, structured, textObj) => ({
  content: [{ type: 'text', text: JSON.stringify(textObj, null, 2) }],
  structuredContent: { view, ...structured },
  _meta: { 'openai/outputTemplate': WIDGET_URI, ui: { resourceUri: WIDGET_URI } },
});

export function buildServer(userId, { demo = false } = {}) {
  const server = new McpServer({ name: 'apple-notes-relay', version: '1.0.0' });

  // Register the UI component ChatGPT renders for the read tools.
  server.registerResource(
    'notes-widget',
    WIDGET_URI,
    { title: 'Apple Notes', description: 'Renders notes, folders, and search results as cards.' },
    async () => ({
      contents: [{ uri: WIDGET_URI, mimeType: WIDGET_MIME, text: NOTES_WIDGET_HTML, _meta: { ui: { prefersBorder: true } } }],
    })
  );

  // Demo accounts run against server-side sample notes (no Mac agent needed);
  // real accounts relay to the user's paired Mac.
  const exec = demo ? (tool, args) => demoExec(userId, tool, args) : (tool, args) => enqueueJob(userId, tool, args);
  const forward = (tool) => async (args) => {
    try {
      return asText(await exec(tool, args ?? {}));
    } catch (e) {
      return asError(e);
    }
  };

  // Declaring the widget on the tool definition (not just the result) is what
  // tells ChatGPT at tools/list time to render a component for this tool.
  const cardMeta = { 'openai/outputTemplate': WIDGET_URI, ui: { resourceUri: WIDGET_URI } };

  server.registerTool(
    'search',
    {
      title: 'Search Apple Notes',
      description: "Search the user's Apple Notes by keyword. Returns matching notes with ids; use fetch to read one.",
      inputSchema: { query: z.string() },
      annotations: { readOnlyHint: true },
      _meta: cardMeta,
    },
    async ({ query }) => {
      try {
        const { results } = await exec('searchNotes', { query, limit: 20 });
        const items = results.map((r) => ({ id: r.id, title: r.title, url: noteUrl(r.id) }));
        return withCard('results', { query, results: items }, { results: items });
      } catch (e) {
        return asError(e);
      }
    }
  );

  server.registerTool(
    'fetch',
    {
      title: 'Fetch a note',
      description: 'Fetch the full content of a note by id (from search results).',
      inputSchema: { id: z.string() },
      annotations: { readOnlyHint: true },
      _meta: cardMeta,
    },
    async ({ id }) => {
      try {
        const { note } = await exec('getNote', { id });
        const text = {
          id: note.id,
          title: note.title,
          text: note.plaintext,
          url: noteUrl(note.id),
          metadata: { folder: note.folder, created: note.created, modified: note.modified },
        };
        return withCard('note', { note: { id: note.id, title: note.title, text: note.plaintext, folder: note.folder, created: note.created, modified: note.modified } }, text);
      } catch (e) {
        return asError(e);
      }
    }
  );

  server.registerTool(
    'list_folders',
    { title: 'List Notes folders', description: 'List all Apple Notes folders with note counts.', inputSchema: {}, annotations: { readOnlyHint: true }, _meta: cardMeta },
    async () => {
      try {
        const res = await exec('listFolders', {});
        return withCard('folders', { folders: res.folders || [] }, res);
      } catch (e) {
        return asError(e);
      }
    }
  );

  server.registerTool(
    'list_notes',
    {
      title: 'List notes',
      description: 'List notes, optionally filtered to a folder.',
      inputSchema: {
        folder: z.string().optional(),
        limit: z.number().int().min(1).max(100).optional(),
      },
      annotations: { readOnlyHint: true },
      _meta: cardMeta,
    },
    async (args) => {
      try {
        const res = await exec('listNotes', args ?? {});
        return withCard('notes', { notes: res.notes || [] }, res);
      } catch (e) {
        return asError(e);
      }
    }
  );

  server.registerTool(
    'get_note',
    {
      title: 'Read a note',
      description: 'Read a note by id or (fuzzy) title.',
      inputSchema: { id: z.string().optional(), title: z.string().optional() },
      annotations: { readOnlyHint: true },
      _meta: cardMeta,
    },
    async (args) => {
      try {
        const { note } = await exec('getNote', args ?? {});
        return withCard('note', { note: { id: note.id, title: note.title, text: note.plaintext, folder: note.folder, created: note.created, modified: note.modified } }, { note });
      } catch (e) {
        return asError(e);
      }
    }
  );

  server.registerTool(
    'create_note',
    {
      title: 'Create a note',
      description: 'Create a new Apple Note. Title becomes the first line.',
      inputSchema: { title: z.string(), body: z.string(), folder: z.string().optional() },
    },
    forward('createNote')
  );

  server.registerTool(
    'append_to_note',
    {
      title: 'Append to a note',
      description: 'Append plain text to the end of an existing note.',
      inputSchema: { id: z.string(), text: z.string() },
    },
    forward('appendToNote')
  );

  server.registerTool(
    'update_note',
    {
      title: 'Rewrite a note',
      description: "Replace a note's entire content. WARNING: overwrites — read it first.",
      inputSchema: { id: z.string(), title: z.string(), body: z.string() },
      annotations: { destructiveHint: true },
    },
    forward('updateNote')
  );

  return server;
}
