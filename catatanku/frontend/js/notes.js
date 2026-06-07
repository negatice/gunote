// ══════════════════════════════════════════════════════════════
//  CatatanKu – Notes App (API-backed)
// ══════════════════════════════════════════════════════════════

const EMOJIS = ['📝','📌','💡','🎯','🔥','💼','👤','📚','🛒','💰','🏋️','🎨','🧠','📅','⚡','🌟','🎵','🏠','✈️','🔑'];
const REPEAT_LABELS = { none:'', daily:'🔁 Harian', weekly:'🔁 Mingguan', monthly:'🔁 Bulanan' };

// ─── State ────────────────────────────────────────────────────
const state = {
  notes: [], reminders: [], activeId: null, filter: 'all',
  editMode: false, editId: null, selectedEmoji: '📝',
  selectedTags: [], pendingDeleteId: null, reminderNoteId: null,
  firedReminders: new Set(),
};

// ─── Theme ────────────────────────────────────────────────────
function toggleTheme() {
  const d = document.body;
  d.dataset.theme = d.dataset.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('ck_theme', d.dataset.theme);
}
function initTheme() {
  document.body.dataset.theme = localStorage.getItem('ck_theme') || 'light';
}

// ─── Loading overlay ──────────────────────────────────────────
function showLoading(show) {
  document.getElementById('loadingOverlay').classList.toggle('hidden', !show);
}

// ─── Helpers ─────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
function fmtTime(ts) {
  const d = new Date(ts), now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});
  const diff = Math.floor((now - d) / 86400000);
  if (diff === 1) return 'Kemarin';
  if (diff < 7) return d.toLocaleDateString('id-ID',{weekday:'short'});
  return d.toLocaleDateString('id-ID',{day:'numeric',month:'short'});
}
function fmtDate(ts) {
  const d = new Date(ts), now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Hari Ini';
  const diff = Math.floor((now - d) / 86400000);
  if (diff === 1) return 'Kemarin';
  return d.toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long'});
}
function fmtReminderTime(ts) {
  const d = new Date(ts), diff = ts - Date.now();
  const now = new Date();
  if (diff < 0) return '⚠️ ' + d.toLocaleDateString('id-ID',{day:'numeric',month:'short'}) + ' ' + d.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});
  if (diff < 3600000) return '⏳ ' + Math.round(diff/60000) + ' menit lagi';
  if (d.toDateString() === now.toDateString()) return '📅 Hari ini ' + d.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});
  const tom = new Date(now); tom.setDate(tom.getDate()+1);
  if (d.toDateString() === tom.toDateString()) return '📅 Besok ' + d.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});
  return '📅 ' + d.toLocaleDateString('id-ID',{weekday:'short',day:'numeric',month:'short'}) + ' ' + d.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});
}
function fmtReminderShort(ts) {
  const diff = ts - Date.now();
  if (diff < 0) return 'terlewat';
  if (diff < 3600000) return Math.round(diff/60000) + ' mnt';
  const d = new Date(ts), now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});
  return d.toLocaleDateString('id-ID',{day:'numeric',month:'short'});
}
function getTodoProgress(note) {
  const todos = note.messages.filter(m=>m.type==='todo').flatMap(m=>m.items||[]);
  if (!todos.length) return null;
  return { done: todos.filter(t=>t.done).length, total: todos.length };
}
function getNoteReminders(noteId) { return state.reminders.filter(r=>r.noteId===noteId); }
function getNextReminder(noteId) {
  const now = Date.now();
  return getNoteReminders(noteId).filter(r=>r.datetime>now-60000).sort((a,b)=>a.datetime-b.datetime)[0]||null;
}
function escHtml(s) {
  return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
}

// ─── API sync helpers ─────────────────────────────────────────
async function syncNote(note) {
  try {
    if (note._new) {
      const created = await API.notes.create({ emoji:note.emoji, title:note.title, desc:note.desc, type:note.type, tags:note.tags, pinned:note.pinned, messages:note.messages });
      const idx = state.notes.findIndex(n=>n.id===note.id);
      if (idx!==-1) state.notes[idx] = { ...created };
      if (state.activeId === note.id) state.activeId = created.id;
      return created;
    } else {
      const updated = await API.notes.update(note.id, { emoji:note.emoji, title:note.title, desc:note.desc, type:note.type, tags:note.tags, pinned:note.pinned, messages:note.messages, updatedAt:note.updatedAt });
      const idx = state.notes.findIndex(n=>n.id===note.id||n.id===updated.id);
      if (idx!==-1) state.notes[idx] = updated;
      return updated;
    }
  } catch(e) {
    showToast('❌','Gagal sinkronisasi',e.message,true);
    return note;
  }
}

// ─── Load data ────────────────────────────────────────────────
async function loadData() {
  showLoading(true);
  try {
    const [notes, reminders] = await Promise.all([API.notes.getAll(), API.reminders.getAll()]);
    state.notes = notes;
    state.reminders = reminders;
  } catch(e) {
    showToast('❌','Gagal memuat data',e.message,true);
  } finally {
    showLoading(false);
  }
}

// ─── Logout ──────────────────────────────────────────────────
function logout() {
  Auth.clear();
  window.location.href = '/login.html';
}

// ─── Filter ──────────────────────────────────────────────────
function setFilter(f, el) {
  state.filter = f;
  document.querySelectorAll('.filter-tab').forEach(t=>t.classList.remove('active'));
  if (el) el.classList.add('active');
  renderList();
}
function getFiltered() {
  let list = [...state.notes];
  const q = (document.getElementById('searchInput')?.value||'').toLowerCase();
  if (q) list = list.filter(n=>n.title.toLowerCase().includes(q)||(n.desc||'').toLowerCase().includes(q)||n.messages.some(m=>(m.text||'').toLowerCase().includes(q)||(m.items||[]).some(i=>i.text.toLowerCase().includes(q))));
  if (state.filter==='pinned') list=list.filter(n=>n.pinned);
  else if (state.filter==='todo') list=list.filter(n=>n.type==='todo');
  else if (state.filter==='note') list=list.filter(n=>n.type==='note');
  else if (['work','personal','idea','urgent'].includes(state.filter)) list=list.filter(n=>n.tags.includes(state.filter));
  list.sort((a,b)=>(b.pinned?1:0)-(a.pinned?1:0)||(b.updatedAt||0)-(a.updatedAt||0));
  return list;
}

// ─── Stats ────────────────────────────────────────────────────
function renderStats() {
  const notes = state.notes;
  const allItems = notes.filter(n=>n.type==='todo').flatMap(n=>n.messages.flatMap(m=>m.items||[]));
  const pct = allItems.length?Math.round(allItems.filter(t=>t.done).length/allItems.length*100):0;
  const upcoming = state.reminders.filter(r=>r.datetime>Date.now()-60000).length;
  document.getElementById('statsBar').innerHTML=`
    <div class="stat"><div class="num">${notes.length}</div><div class="lbl">Catatan</div></div>
    <div class="stat"><div class="num">${notes.filter(n=>n.type==='todo').length}</div><div class="lbl">Todo</div></div>
    <div class="stat"><div class="num">${pct}%</div><div class="lbl">Selesai</div></div>
    <div class="stat" onclick="setFilter('schedule',document.querySelector('[data-filter=schedule]'))" style="cursor:pointer">
      <div class="num orange">${upcoming}</div><div class="lbl">Jadwal</div>
    </div>`;
  document.getElementById('reminderDot').style.display = upcoming>0?'block':'none';
}

// ─── List ─────────────────────────────────────────────────────
function renderList() {
  renderStats();
  const el = document.getElementById('noteList');
  if (state.filter==='schedule') { renderScheduleView(el); return; }
  const list = getFiltered();
  if (!list.length) { el.innerHTML=`<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg><p>Tidak ada catatan</p></div>`; return; }
  el.innerHTML = list.map(n=>{
    const last=n.messages[n.messages.length-1];
    const preview=last?(last.type==='todo'?`${last.items?.length||0} item todo`:(last.text||'').slice(0,50)):n.desc||'–';
    const prog=getTodoProgress(n);
    const progBar=prog?`<div class="progress-bar" style="margin-top:4px"><div class="progress-fill" style="width:${Math.round(prog.done/prog.total*100)}%"></div></div>`:'';
    const badges=n.tags.map(t=>`<span class="badge badge-${t}">${{work:'💼',personal:'👤',idea:'💡',urgent:'🔥'}[t]} ${{work:'Kerja',personal:'Personal',idea:'Ide',urgent:'Penting'}[t]}</span>`).join('');
    const nextRem=getNextReminder(n.id);
    const remBadge=nextRem?`<span class="badge-reminder">⏰ ${fmtReminderShort(nextRem.datetime)}</span>`:'';
    return `<div class="note-item ${state.activeId===n.id?'active':''}" onclick="openNote('${n.id}')" oncontextmenu="showCtx(event,'${n.id}')">
      <div class="note-avatar">${n.emoji}</div>
      <div class="note-info">
        <div class="note-title-row"><span class="note-title">${n.title}</span><span class="note-time">${fmtTime(n.updatedAt||Date.now())}</span></div>
        <div class="note-preview">${preview}</div>
        <div class="note-badges">${badges}${remBadge}</div>${progBar}
      </div>
      ${n.pinned?'<div style="position:absolute;top:10px;right:10px;font-size:12px">📌</div>':''}
    </div>`;
  }).join('');
}

// ─── Schedule view ────────────────────────────────────────────
function renderScheduleView(el) {
  const now = Date.now();
  const sorted = [...state.reminders].sort((a,b)=>a.datetime-b.datetime);
  if (!sorted.length) { el.innerHTML=`<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg><p>Belum ada jadwal</p><p style="margin-top:8px;font-size:12px">Buka catatan lalu klik 🔔</p></div>`; return; }
  const groups={};
  sorted.forEach(r=>{ const k=new Date(r.datetime).toDateString(); if(!groups[k])groups[k]=[]; groups[k].push(r); });
  let html='';
  Object.entries(groups).forEach(([key,rems])=>{
    html+=`<div class="schedule-section-title">${fmtDate(new Date(key).getTime())}</div>`;
    rems.forEach(r=>{
      const note=state.notes.find(n=>n.id===r.noteId);
      const isOverdue=r.datetime<now, isSoon=!isOverdue&&r.datetime-now<3600000;
      html+=`<div class="schedule-item ${isOverdue?'schedule-overdue':''} ${isSoon?'schedule-soon':''}" onclick="openNote('${r.noteId}')">
        <div class="s-avatar">${note?.emoji||'⏰'}</div>
        <div class="s-info"><div class="s-label">${r.label}</div><div class="s-note">${note?.title||'–'}</div>
          <div class="s-time">${fmtReminderTime(r.datetime)}</div>
          ${r.repeat!=='none'?`<div style="font-size:10px;color:var(--text-sub)">${REPEAT_LABELS[r.repeat]}</div>`:''}
        </div>
        <button class="s-del" onclick="event.stopPropagation();deleteReminderById('${r.id}')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6m5 0V4h4v2"/></svg>
        </button>
      </div>`;
    });
  });
  el.innerHTML=html;
}

// ─── Open note ────────────────────────────────────────────────
function openNote(id) {
  const note = state.notes.find(n=>n.id===id);
  if (!note) return;
  state.activeId = id;
  if (state.filter==='schedule') setFilter('all',document.querySelector('[data-filter=all]'));
  renderList();
  document.getElementById('welcomeScreen').style.display='none';
  document.getElementById('chatView').style.display='flex';
  document.getElementById('noteHeaderAvatar').textContent=note.emoji;
  document.getElementById('noteHeaderTitle').textContent=note.title;
  const prog=getTodoProgress(note);
  const nextRem=getNextReminder(id);
  let sub=prog?`${prog.done}/${prog.total} selesai`:(note.desc||(note.type==='todo'?'Todo List':'Catatan'));
  if (nextRem) sub+=` · ⏰ ${fmtReminderShort(nextRem.datetime)}`;
  document.getElementById('noteHeaderSub').textContent=sub;
  document.getElementById('pinBtn').style.opacity=note.pinned?'1':'.5';
  document.getElementById('noteReminderDot').style.display=getNoteReminders(id).length>0?'block':'none';
  if (window.innerWidth<=768) document.getElementById('sidebar').classList.add('hidden');
  renderMessages(note);
}

function showSidebar() {
  document.getElementById('sidebar').classList.remove('hidden');
  document.getElementById('chatView').style.display='none';
  document.getElementById('welcomeScreen').style.display='flex';
  state.activeId=null;
}

// ─── Messages ─────────────────────────────────────────────────
function renderMessages(note) {
  const wrap=document.getElementById('messagesWrap');
  if (!note.messages.length) { wrap.innerHTML=`<div style="text-align:center;color:var(--text-sub);font-size:13px;margin:auto">Belum ada pesan. Ketik di bawah!</div>`; return; }
  let html='', lastDate='';
  note.messages.forEach(msg=>{
    const d=fmtDate(msg.ts);
    if (d!==lastDate) { html+=`<div class="date-divider"><span>${d}</span></div>`; lastDate=d; }
    if (msg.type==='note') {
      html+=`<div class="message out"><div class="message-bubble" oncontextmenu="showMsgCtx(event,'${note.id}','${msg.id}')">
        <div class="message-text">${escHtml(msg.text)}</div>
        <div class="message-footer"><span class="message-time">${fmtTime(msg.ts)}</span></div>
      </div></div>`;
    } else if (msg.type==='todo') {
      const items=(msg.items||[]).map(item=>`<div class="todo-item">
        <div class="todo-check ${item.done?'done':''}" onclick="toggleTodo('${note.id}','${msg.id}','${item.id}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <span class="todo-text ${item.done?'done':''}">${escHtml(item.text)}</span>
      </div>`).join('');
      const prog=msg.items?.length?Math.round(msg.items.filter(i=>i.done).length/msg.items.length*100):0;
      html+=`<div class="message out"><div class="message-bubble" oncontextmenu="showMsgCtx(event,'${note.id}','${msg.id}')">
        <div style="font-size:12px;font-weight:600;color:var(--wa-dark);margin-bottom:6px">✅ Todo · ${msg.items?.filter(i=>i.done).length||0}/${msg.items?.length||0} selesai</div>
        ${items}
        <div class="progress-bar" style="margin-top:8px"><div class="progress-fill" style="width:${prog}%"></div></div>
        <div class="message-footer"><span class="message-time">${fmtTime(msg.ts)}</span></div>
      </div></div>`;
    } else if (msg.type==='reminder') {
      html+=`<div class="message in reminder-msg"><div class="message-bubble" oncontextmenu="showMsgCtx(event,'${note.id}','${msg.id}')">
        <div style="font-size:12px;font-weight:700;color:var(--reminder-color);margin-bottom:4px">⏰ Pengingat Dibuat</div>
        <div class="message-text">${escHtml(msg.text)}</div>
        <div class="message-footer"><span class="message-time">${fmtTime(msg.ts)}</span></div>
      </div></div>`;
    }
  });
  wrap.innerHTML=html; wrap.scrollTop=wrap.scrollHeight;
}

// ─── Toggle todo ──────────────────────────────────────────────
async function toggleTodo(noteId, msgId, itemId) {
  const note=state.notes.find(n=>n.id===noteId); if(!note) return;
  const msg=note.messages.find(m=>m.id===msgId); if(!msg) return;
  const item=msg.items.find(i=>i.id===itemId); if(!item) return;
  item.done=!item.done;
  note.updatedAt=Date.now();
  renderMessages(note); renderList();
  await syncNote(note);
  const prog=getTodoProgress(note);
  if (prog) document.getElementById('noteHeaderSub').textContent=`${prog.done}/${prog.total} selesai`;
}

// ─── Compose ──────────────────────────────────────────────────
let isTodoMode=false;
function toggleTodoMode() {
  isTodoMode=!isTodoMode;
  document.getElementById('todoModeBtn').style.color=isTodoMode?'var(--wa-green)':'var(--text-sub)';
  document.getElementById('composeInput').placeholder=isTodoMode?'Tulis item todo, satu per baris...':'Ketik pesan atau todo...';
}
function autoResize(el) { el.style.height='auto'; el.style.height=Math.min(el.scrollHeight,140)+'px'; }
function handleCompose(e) { if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage();} }

async function sendMessage() {
  const note=state.notes.find(n=>n.id===state.activeId); if(!note) return;
  const val=document.getElementById('composeInput').value.trim(); if(!val) return;
  if (isTodoMode) {
    const items=val.split('\n').filter(l=>l.trim()).map(l=>({id:uid(),text:l.trim(),done:false}));
    note.messages.push({id:uid(),type:'todo',ts:Date.now(),items});
  } else {
    note.messages.push({id:uid(),type:'note',text:val,ts:Date.now()});
  }
  note.updatedAt=Date.now();
  document.getElementById('composeInput').value=''; document.getElementById('composeInput').style.height='auto';
  renderMessages(note); renderList();
  await syncNote(note);
}

// ─── New / Edit note dialog ───────────────────────────────────
function openNewNote() {
  state.editMode=false; state.editId=null;
  state.selectedEmoji='📝'; state.selectedTags=[];
  document.getElementById('sheetTitle').textContent='📝 Catatan Baru';
  document.getElementById('noteTitleInput').value='';
  document.getElementById('noteDescInput').value='';
  document.getElementById('noteTypeInput').value='note';
  renderEmojiRow(); renderTagSelector();
  document.getElementById('newNoteOverlay').style.display='flex';
  setTimeout(()=>document.getElementById('noteTitleInput').focus(),200);
}
function editCurrentNote() {
  const note=state.notes.find(n=>n.id===state.activeId); if(!note) return;
  state.editMode=true; state.editId=note.id;
  state.selectedEmoji=note.emoji; state.selectedTags=[...note.tags];
  document.getElementById('sheetTitle').textContent='✏️ Edit Catatan';
  document.getElementById('noteTitleInput').value=note.title;
  document.getElementById('noteDescInput').value=note.desc||'';
  document.getElementById('noteTypeInput').value=note.type;
  renderEmojiRow(); renderTagSelector();
  document.getElementById('newNoteOverlay').style.display='flex';
}
function closeNewNote() { document.getElementById('newNoteOverlay').style.display='none'; }

async function saveNote() {
  const title=document.getElementById('noteTitleInput').value.trim();
  if (!title) { document.getElementById('noteTitleInput').focus(); return; }
  const desc=document.getElementById('noteDescInput').value.trim();
  const type=document.getElementById('noteTypeInput').value;
  const now=Date.now();
  if (state.editMode&&state.editId) {
    const note=state.notes.find(n=>n.id===state.editId);
    if (note) { note.title=title; note.desc=desc; note.type=type; note.emoji=state.selectedEmoji; note.tags=[...state.selectedTags]; note.updatedAt=now; }
    closeNewNote();
    await syncNote(note);
    openNote(state.editId);
  } else {
    const tempId='tmp_'+uid();
    const note={ id:tempId, emoji:state.selectedEmoji, title, desc, type, tags:[...state.selectedTags], pinned:false, messages:[], createdAt:now, updatedAt:now, _new:true };
    state.notes.unshift(note);
    renderList(); closeNewNote();
    const saved=await syncNote(note);
    openNote(saved?.id||tempId);
  }
}

// ─── Emoji & Tags ─────────────────────────────────────────────
function renderEmojiRow() {
  document.getElementById('emojiRow').innerHTML=EMOJIS.map(e=>`<span class="emoji-opt ${e===state.selectedEmoji?'selected':''}" onclick="selectEmoji('${e}')">${e}</span>`).join('');
}
function selectEmoji(e){state.selectedEmoji=e;renderEmojiRow();}
function renderTagSelector(){
  document.querySelectorAll('#tagSelector .tag-option').forEach(el=>el.classList.toggle('selected',state.selectedTags.includes(el.dataset.tag)));
}
function toggleTag(el){
  const t=el.dataset.tag;
  state.selectedTags=state.selectedTags.includes(t)?state.selectedTags.filter(x=>x!==t):[...state.selectedTags,t];
  renderTagSelector();
}

// ─── Pin & Delete ─────────────────────────────────────────────
async function togglePin() {
  const note=state.notes.find(n=>n.id===state.activeId); if(!note) return;
  note.pinned=!note.pinned;
  document.getElementById('pinBtn').style.opacity=note.pinned?'1':'.5';
  renderList();
  await syncNote(note);
}
function deleteCurrentNote() { state.pendingDeleteId=state.activeId; document.getElementById('confirmOverlay').style.display='flex'; }
function closeConfirm() { document.getElementById('confirmOverlay').style.display='none'; }
async function confirmDelete() {
  const id=state.pendingDeleteId;
  closeConfirm();
  try { await API.notes.remove(id); } catch(e) { showToast('❌','Gagal hapus',e.message,true); return; }
  state.notes=state.notes.filter(n=>n.id!==id);
  state.reminders=state.reminders.filter(r=>r.noteId!==id);
  state.activeId=null;
  renderList();
  document.getElementById('chatView').style.display='none';
  document.getElementById('welcomeScreen').style.display='flex';
  if (window.innerWidth<=768) document.getElementById('sidebar').classList.remove('hidden');
  showToast('🗑️','Catatan dihapus','');
}

// ─── Reminder dialog ──────────────────────────────────────────
function openReminderDialog(noteId) {
  const id=noteId||state.activeId; if(!id) return;
  state.reminderNoteId=id;
  const note=state.notes.find(n=>n.id===id);
  document.getElementById('reminderLabel').value=note?.title||'';
  const tom=new Date(); tom.setDate(tom.getDate()+1); tom.setHours(9,0,0,0);
  document.getElementById('reminderDate').value=tom.toISOString().slice(0,10);
  document.getElementById('reminderTime').value='09:00';
  document.getElementById('reminderRepeat').value='none';
  renderExistingReminders(id);
  document.getElementById('reminderOverlay').style.display='flex';
  if (Notification.permission==='default') document.getElementById('notifBanner').style.display='flex';
}
function closeReminderDialog() { document.getElementById('reminderOverlay').style.display='none'; }
function renderExistingReminders(noteId) {
  const rems=getNoteReminders(noteId);
  const el=document.getElementById('existingReminders');
  if (!rems.length) { el.innerHTML=''; return; }
  el.innerHTML=`<div class="reminder-list-title">⏰ Aktif (${rems.length})</div>`+
    rems.map(r=>`<div class="reminder-item-row ${r.datetime<Date.now()?'reminder-overdue':'reminder-soon'}">
      <div class="r-info"><div class="r-label">${r.label}</div><div class="r-time">${fmtReminderTime(r.datetime)}</div>
        ${r.repeat!=='none'?`<div class="r-repeat">${REPEAT_LABELS[r.repeat]}</div>`:''}
      </div>
      <button class="r-del" onclick="deleteReminderById('${r.id}')">🗑️</button>
    </div>`).join('');
}

async function saveReminder() {
  const label=document.getElementById('reminderLabel').value.trim();
  const dateVal=document.getElementById('reminderDate').value;
  const timeVal=document.getElementById('reminderTime').value;
  const repeat=document.getElementById('reminderRepeat').value;
  if (!label) { document.getElementById('reminderLabel').focus(); return; }
  if (!dateVal||!timeVal) { showToast('⚠️','Pilih tanggal & waktu','',true); return; }
  const dt=new Date(`${dateVal}T${timeVal}`);
  if (isNaN(dt.getTime())) { showToast('⚠️','Tanggal tidak valid','',true); return; }
  try {
    const note=state.notes.find(n=>n.id===state.reminderNoteId);
    const created=await API.reminders.create({ noteId:state.reminderNoteId, label, datetime:dt.getTime(), repeat });
    state.reminders.push(created);
    // Add reminder message to note
    if (note) {
      const timeStr=dt.toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'})+' pukul '+dt.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});
      note.messages.push({id:uid(),type:'reminder',text:`${label}\n📅 ${timeStr}${repeat!=='none'?' · '+REPEAT_LABELS[repeat]:''}`,ts:Date.now()});
      note.updatedAt=Date.now();
      await syncNote(note);
      if (state.activeId===note.id) renderMessages(note);
    }
    renderStats(); renderList(); renderExistingReminders(state.reminderNoteId);
    document.getElementById('noteReminderDot').style.display='block';
    showToast('⏰','Pengingat disimpan!',`${label} – ${fmtReminderShort(dt.getTime())}`);
  } catch(e) { showToast('❌','Gagal simpan reminder',e.message,true); }
}

async function deleteReminderById(id) {
  try { await API.reminders.remove(id); } catch(e) { showToast('❌','Gagal hapus reminder',e.message,true); return; }
  state.reminders=state.reminders.filter(r=>r.id!==id);
  renderStats(); renderList();
  if (document.getElementById('reminderOverlay').style.display!=='none') renderExistingReminders(state.reminderNoteId);
  if (state.activeId) document.getElementById('noteReminderDot').style.display=getNoteReminders(state.activeId).length>0?'block':'none';
}

// ─── Notifications ────────────────────────────────────────────
function requestNotifPermission() {
  Notification.requestPermission().then(p=>{ if(p==='granted') document.getElementById('notifBanner').style.display='none'; });
}
function checkReminders() {
  const now=Date.now();
  state.reminders.forEach(r=>{
    if (state.firedReminders.has(r.id)) return;
    const diff=r.datetime-now;
    if (diff<=0&&diff>-120000) {
      state.firedReminders.add(r.id);
      fireReminder(r);
      if (r.repeat!=='none') advanceReminder(r);
    }
  });
}
function fireReminder(r) {
  const note=state.notes.find(n=>n.id===r.noteId);
  if (Notification.permission==='granted') {
    const n=new Notification('⏰ '+r.label,{body:note?`📝 ${note.emoji} ${note.title}`:'Buka CatatanKu'});
    n.onclick=()=>{ window.focus(); if(note) openNote(note.id); n.close(); };
    setTimeout(()=>n.close(),10000);
  }
  showToast('⏰',r.label,note?`${note.emoji} ${note.title}`:'',false,r.id);
}
async function advanceReminder(r) {
  const d=new Date(r.datetime);
  if (r.repeat==='daily') d.setDate(d.getDate()+1);
  else if (r.repeat==='weekly') d.setDate(d.getDate()+7);
  else if (r.repeat==='monthly') d.setMonth(d.getMonth()+1);
  r.datetime=d.getTime();
  state.firedReminders.delete(r.id);
  try { await API.reminders.update(r.id,{datetime:r.datetime}); } catch {}
}

// ─── Toast ────────────────────────────────────────────────────
function showToast(icon,title,msg,isError=false,reminderId=null) {
  const id='t_'+uid();
  const el=document.createElement('div');
  el.className='toast'+(isError?' error':''); el.id=id;
  el.innerHTML=`<div class="toast-icon">${icon}</div>
    <div class="toast-body">
      <div class="toast-title">${title}</div>
      ${msg?`<div class="toast-msg">${msg}</div>`:''}
      ${reminderId?`<div class="toast-actions">
        <button class="toast-btn snooze" onclick="snoozeReminder('${reminderId}',10);removeToast('${id}')">⏳ Tunda 10 mnt</button>
        <button class="toast-btn dismiss" onclick="removeToast('${id}')">✓ Oke</button>
      </div>`:''}
    </div>
    <button class="toast-close" onclick="removeToast('${id}')">×</button>`;
  el.onclick=e=>{ if(e.target.tagName!=='BUTTON') removeToast(id); };
  document.getElementById('toastContainer').appendChild(el);
  if (!reminderId) setTimeout(()=>removeToast(id),4500);
}
function removeToast(id) {
  const el=document.getElementById(id); if(!el) return;
  el.style.cssText+='transition:all .3s;opacity:0;transform:translateX(120%)';
  setTimeout(()=>el.remove(),300);
}
async function snoozeReminder(remId,minutes) {
  const r=state.reminders.find(x=>x.id===remId); if(!r) return;
  r.datetime=Date.now()+minutes*60000;
  state.firedReminders.delete(remId);
  try { await API.reminders.update(remId,{datetime:r.datetime}); } catch {}
  renderStats(); renderList();
  showToast('💤','Ditunda',`Pengingat ditunda ${minutes} menit`);
}

// ─── Message delete ───────────────────────────────────────────
async function deleteMsg(noteId,msgId) {
  const note=state.notes.find(n=>n.id===noteId); if(!note) return;
  note.messages=note.messages.filter(m=>m.id!==msgId);
  note.updatedAt=Date.now();
  renderMessages(note); renderList();
  await syncNote(note);
}

// ─── Context menus ────────────────────────────────────────────
function showCtx(e,noteId) {
  e.preventDefault();
  const note=state.notes.find(n=>n.id===noteId);
  const menu=document.getElementById('ctxMenu');
  menu.innerHTML=`
    <div class="ctx-item" onclick="openNote('${noteId}');hideCtx()">📂 Buka</div>
    <div class="ctx-item" onclick="state.activeId='${noteId}';editCurrentNote();hideCtx()">✏️ Edit</div>
    <div class="ctx-item" onclick="openReminderDialog('${noteId}');hideCtx()">⏰ Set Reminder</div>
    <div class="ctx-item" onclick="(()=>{const n=state.notes.find(x=>x.id==='${noteId}');if(n){n.pinned=!n.pinned;syncNote(n);renderList();}})();hideCtx()">${note?.pinned?'📌 Unpin':'📌 Pin'}</div>
    <div class="ctx-item danger" onclick="state.pendingDeleteId='${noteId}';document.getElementById('confirmOverlay').style.display='flex';hideCtx()">🗑️ Hapus</div>`;
  posCtx(e,menu);
}
function showMsgCtx(e,noteId,msgId) {
  e.preventDefault();
  const menu=document.getElementById('ctxMenu');
  menu.innerHTML=`<div class="ctx-item danger" onclick="deleteMsg('${noteId}','${msgId}');hideCtx()">🗑️ Hapus Pesan</div>`;
  posCtx(e,menu);
}
function posCtx(e,menu) {
  menu.style.display='block';
  const x=Math.min(e.clientX,window.innerWidth-200), y=Math.min(e.clientY,window.innerHeight-200);
  menu.style.left=x+'px'; menu.style.top=y+'px';
}
function hideCtx() { document.getElementById('ctxMenu').style.display='none'; }
document.addEventListener('click',hideCtx);
document.addEventListener('keydown',e=>{if(e.key==='Escape'){hideCtx();closeNewNote();closeReminderDialog();closeConfirm();}});

// ─── Init ─────────────────────────────────────────────────────
async function init() {
  initTheme();
  const user = await requireAuth();
  if (!user) return;
  // Show user info
  const chip = document.getElementById('userChip');
  if (chip) chip.textContent = `👋 Halo, ${user.name}`;
  await loadData();
  renderList();
  if (Notification.permission==='default') setTimeout(()=>{document.getElementById('notifBanner').style.display='flex';},3000);
  setInterval(checkReminders,30000);
  checkReminders();
}

init();
