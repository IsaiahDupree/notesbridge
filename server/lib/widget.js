// widget.js — the Apps SDK UI component ChatGPT renders for NotesBridge tools.
// One adaptive widget: switches on structuredContent.view (folders | notes |
// results | note). Reads data from window.openai.toolOutput and re-renders when
// ChatGPT updates globals. Self-contained; adapts to ChatGPT's light/dark theme.

export const WIDGET_URI = 'ui://widget/notes.html';
// Production ChatGPT's Apps SDK renderer uses the "skybridge" HTML profile.
// (The newer standardized "text/html;profile=mcp-app" is not yet live there.)
export const WIDGET_MIME = 'text/html+skybridge';

export const NOTES_WIDGET_HTML = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  :root {
    --bg: transparent; --fg: #1c1e24; --muted: #6b7280; --card: #ffffff;
    --border: #e5e7eb; --accent: #d99413; --accent-soft: #fdf3dd; --shadow: 0 1px 2px rgba(0,0,0,.06);
  }
  @media (prefers-color-scheme: dark) {
    :root { --fg:#e8eaf0; --muted:#9aa1af; --card:#181b22; --border:#2a2f3a; --accent:#f5b942; --accent-soft:#2a2416; --shadow:none; }
  }
  * { box-sizing: border-box; }
  body { margin: 0; font: 14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; color: var(--fg); background: var(--bg); }
  .wrap { padding: 4px 2px; }
  .hd { display:flex; align-items:center; gap:8px; margin:2px 4px 10px; font-weight:600; font-size:13px; color:var(--muted); }
  .hd .dot { width:8px; height:8px; border-radius:50%; background:var(--accent); }
  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:8px; }
  .folder { background:var(--card); border:1px solid var(--border); border-radius:12px; padding:12px 14px; box-shadow:var(--shadow); }
  .folder .n { font-weight:600; }
  .folder .c { color:var(--muted); font-size:12px; margin-top:2px; }
  ul { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:6px; }
  .row { background:var(--card); border:1px solid var(--border); border-radius:12px; padding:10px 14px; box-shadow:var(--shadow); display:flex; align-items:center; gap:10px; text-align:left; width:100%; font:inherit; color:inherit; cursor:default; }
  button.row { cursor:pointer; transition:border-color .12s; }
  button.row:hover { border-color:var(--accent); }
  .row .ic { flex:0 0 auto; width:22px; height:22px; color:var(--accent); }
  .row .body { min-width:0; flex:1; }
  .row .t { font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .row .meta { color:var(--muted); font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .note { background:var(--card); border:1px solid var(--border); border-radius:14px; padding:16px 18px; box-shadow:var(--shadow); }
  .note h2 { margin:0 0 4px; font-size:16px; }
  .note .sub { color:var(--muted); font-size:12px; margin-bottom:10px; }
  .note pre { margin:0; white-space:pre-wrap; word-wrap:break-word; font:inherit; }
  .empty { color:var(--muted); padding:16px 6px; }
  .pill { display:inline-block; background:var(--accent-soft); color:var(--accent); border-radius:999px; padding:1px 8px; font-size:11px; font-weight:600; }
</style>
</head>
<body>
<div class="wrap" id="root"><div class="empty">Loading your notes…</div></div>
<script>
  var FOLDER_IC = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/></svg>';
  var NOTE_IC = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6Z"/><path d="M14 3v6h6"/></svg>';
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]; }); };
  var fmtDate = function (iso) { if (!iso) return ''; try { return new Date(iso).toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' }); } catch (e) { return ''; } };

  function openNote(id) {
    try { if (window.openai && window.openai.callTool) window.openai.callTool('fetch', { id: id }); } catch (e) {}
  }

  function render() {
    var data = (window.openai && window.openai.toolOutput) || null;
    var root = document.getElementById('root');
    if (!data || typeof data !== 'object') return; // keep loading state until data arrives
    var view = data.view, html = '';

    if (view === 'folders') {
      var fs = data.folders || [];
      html = '<div class="hd"><span class="dot"></span>Folders · ' + fs.length + '</div>';
      html += fs.length ? '<div class="grid">' + fs.map(function (f) {
        var cnt = Number(f.count) || 0;
        return '<div class="folder"><div class="n">' + esc(f.name) + '</div><div class="c">' + cnt + ' note' + (cnt === 1 ? '' : 's') + '</div></div>';
      }).join('') + '</div>' : '<div class="empty">No folders.</div>';
    } else if (view === 'notes' || view === 'results') {
      var items = view === 'notes' ? (data.notes || []) : (data.results || []);
      var label = view === 'results' ? ('Results' + (data.query ? ' for "' + esc(data.query) + '"' : '')) : 'Notes';
      html = '<div class="hd"><span class="dot"></span>' + label + ' · ' + items.length + '</div>';
      html += items.length ? '<ul>' + items.map(function (n) {
        var meta = [n.folder, fmtDate(n.modified)].filter(Boolean).join(' · ');
        return '<button class="row" data-id="' + esc(n.id) + '">' + NOTE_IC +
          '<div class="body"><div class="t">' + esc(n.title) + '</div>' + (meta ? '<div class="meta">' + esc(meta) + '</div>' : '') + '</div></button>';
      }).join('') + '</ul>' : '<div class="empty">Nothing found.</div>';
    } else if (view === 'note') {
      var note = data.note || {};
      var sub = [note.folder, note.modified ? 'edited ' + fmtDate(note.modified) : ''].filter(Boolean).join(' · ');
      html = '<div class="note"><h2>' + esc(note.title) + '</h2>' +
        (sub ? '<div class="sub"><span class="pill">' + esc(note.folder || 'Notes') + '</span> ' + esc(note.modified ? 'edited ' + fmtDate(note.modified) : '') + '</div>' : '') +
        '<pre>' + esc(note.text != null ? note.text : '') + '</pre></div>';
    } else {
      return;
    }
    root.innerHTML = html;
  }

  // Delegated click handler (no inline JS): open a note when its row is tapped.
  // Attached once to #root, which persists across render() innerHTML swaps.
  document.getElementById('root').addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('button.row[data-id]') : null;
    if (b) openNote(b.getAttribute('data-id'));
  });

  window.addEventListener('openai:set_globals', render);
  document.addEventListener('DOMContentLoaded', render);
  render();
</script>
</body>
</html>`;
