// Real read-only integration; private note text stays in memory.
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {runTool} from '../agent/notes-jxa.mjs';
const exec=promisify(execFile);
const baseline=async()=>JSON.parse((await exec('/usr/bin/osascript',['-l','JavaScript','-e',`var a=Application('Notes'); JSON.stringify({ids:a.notes.id(),locked:a.notes.passwordProtected(),modified:a.notes.modificationDate().map(function(d){return d.toISOString();})})`],{timeout:40000,maxBuffer:32*1024*1024})).stdout);
const before=await baseline(), expected=new Set(before.ids), locked=new Set(before.ids.filter((id,i)=>before.locked[i]));
const folders=await runTool('listFolders');
const listed=new Set();let cursor,listPages=0;
do{const r=await runTool('listNotes',{limit:37,...(cursor?{cursor}:{})});for(const n of r.notes){assert(expected.has(n.id),'Unexpected note');assert(!listed.has(n.id),'Duplicate note');listed.add(n.id);}if(r.next_cursor)assert(!cursor||r.next_cursor>cursor,'List cursor did not advance');cursor=r.next_cursor;assert(++listPages<=expected.size+1);}while(cursor);
assert.equal(listed.size,expected.size,'Missing listed notes');
const notes=new Map();let completed=0;
for(const id of listed){if(locked.has(id)){await assert.rejects(runTool('getNote',{id}),/password protected/);continue;}const {note}=await runTool('getNote',{id});assert.equal(note.id,id);assert.equal(typeof note.plaintext,'string');notes.set(id,note);if(++completed%50===0)console.log(JSON.stringify({notes_read:completed,total_notes:expected.size}));}
const words=new Map();for(const n of notes.values())for(const w of new Set((n.title+'\n'+n.plaintext).toLowerCase().match(/[a-z]{4,}/g)||[]))words.set(w,(words.get(w)||0)+1);
assert(words.size,'No searchable text');const query=[...words].sort((a,b)=>b[1]-a[1])[0][0];
const wanted=new Set([...notes].filter(([,n])=>(n.title+'\n'+n.plaintext).toLowerCase().includes(query)).map(([id])=>id));
const found=new Set(),skipped=new Set();cursor=undefined;let searchPages=0,scanned=0;
do{const r=await runTool('searchNotes',{query,limit:17,...(cursor?{cursor}:{})});scanned+=r.scanned_notes;for(const n of r.results){assert(wanted.has(n.id),'Search false positive');assert(!found.has(n.id),'Duplicate search match');found.add(n.id);}for(const n of r.skipped){assert(locked.has(n.id));skipped.add(n.id);}if(r.next_cursor)assert(!cursor||r.next_cursor>cursor,'Search cursor did not advance');cursor=r.next_cursor;assert(++searchPages<=expected.size+1);}while(cursor);
assert.equal(found.size,wanted.size,'Missing search matches');assert.equal(scanned,expected.size);assert.equal(skipped.size,locked.size);
assert.deepEqual(await baseline(),before,'Notes changed during test; rerun');
for(const limit of [0,-1,101,1.5])await assert.rejects(runTool('listNotes',{limit}),/limit/);
await assert.rejects(runTool('searchNotes',{query:''}),/query/);
await assert.rejects(runTool('listNotes',{cursor:'invalid'}),/cursor/);
console.log(JSON.stringify({ok:true,notes_total:expected.size,notes_read:notes.size,password_protected_excluded:locked.size,folders:folders.folders.length,list_pages:listPages,search_pages:searchPages,search_matches:found.size,baseline_stable:true},null,2));
