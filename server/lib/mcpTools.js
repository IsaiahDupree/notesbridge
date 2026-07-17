// mcpTools.js — the MCP server exposed to ChatGPT. Every tool forwards to the
// paired Mac agent through the relay; the agent does the actual Notes work.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { enqueueJob } from './relay.js';
import { demoExec } from './demoStore.js';

const asText = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] });
const asError = (err) => ({
  isError: true,
  content: [{ type: 'text', text: `Error: ${err.message || String(err)}` }],
});
const noteUrl = (id) => `applenotes://note/${encodeURIComponent(id)}`;

export function buildServer(userId, { demo = false } = {}) {
  const server = new McpServer({ name: 'apple-notes-relay', version: '1.0.0' });
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

  server.registerTool(
    'search',
    {
      title: 'Search Apple Notes',
      description: "Search the user's Apple Notes by keyword. Returns matching notes with ids; use fetch to read one.",
      inputSchema: { query: z.string() },
      annotations: { readOnlyHint: true },
    },
    async ({ query }) => {
      try {
        const { results } = await exec('searchNotes', { query, limit: 20 });
        return asText({ results: results.map((r) => ({ id: r.id, title: r.title, url: noteUrl(r.id) })) });
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
    },
    async ({ id }) => {
      try {
        const { note } = await exec('getNote', { id });
        return asText({
          id: note.id,
          title: note.title,
          text: note.plaintext,
          url: noteUrl(note.id),
          metadata: { folder: note.folder, created: note.created, modified: note.modified },
        });
      } catch (e) {
        return asError(e);
      }
    }
  );

  server.registerTool(
    'list_folders',
    { title: 'List Notes folders', description: 'List all Apple Notes folders with note counts.', inputSchema: {}, annotations: { readOnlyHint: true } },
    forward('listFolders')
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
    },
    forward('listNotes')
  );

  server.registerTool(
    'get_note',
    {
      title: 'Read a note',
      description: 'Read a note by id or (fuzzy) title.',
      inputSchema: { id: z.string().optional(), title: z.string().optional() },
      annotations: { readOnlyHint: true },
    },
    forward('getNote')
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
