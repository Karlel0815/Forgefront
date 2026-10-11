/* Forgefront map editor AP1 – isolated from campaign saves and combat. */
(function () {
  'use strict';
  const WIDTH = 18, HEIGHT = 20, TILE = 40;
  const key = (x, y) => x + ',' + y;
  const inside = (x, y) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < WIDTH && y < HEIGHT;
  const at = (a, x, y) => !!a && a.x === x && a.y === y;

  function makeState() {
    return { path: new Set(), ore: new Set(), spawn: null, hq: null };
  }
  function cloneState(s) {
    return {
      path: new Set(s.path), ore: new Set(s.ore),
      spawn: s.spawn ? { ...s.spawn } : null, hq: s.hq ? { ...s.hq } : null
    };
  }
  // A brush operation only changes a tile. No map is saved by AP1.
  function paintCell(s, tool, x, y) {
    if (!inside(x, y)) return false;
    const k = key(x, y);
    if (tool === 'path') {
      if (s.ore.has(k) || s.path.has(k)) return false;
      s.path.add(k);
      return true;
    }
    if (tool === 'ore') {
      if (s.path.has(k) || s.ore.has(k) || at(s.spawn, x, y) || at(s.hq, x, y)) return false;
      s.ore.add(k);
      return true;
    }
    if (tool === 'erase') {
      // Delete markers first, then path/ore on a second tap if needed.
      if (at(s.spawn, x, y)) { s.spawn = null; return true; }
      if (at(s.hq, x, y)) { s.hq = null; return true; }
      return s.ore.delete(k) || s.path.delete(k);
    }
    if (tool === 'spawn') {
      if (at(s.hq, x, y) || s.ore.has(k) || at(s.spawn, x, y)) return false;
      s.spawn = { x, y };
      return true;
    }
    if (tool === 'hq') {
      if (at(s.spawn, x, y) || s.ore.has(k) || at(s.hq, x, y)) return false;
      s.hq = { x, y };
      return true;
    }
    return false;
  }

  // Raster interpolation avoids gaps when a finger skips tiles between events.
  function paintLine(s, tool, from, to) {
    if (!inside(from.x, from.y) || !inside(to.x, to.y)) return false;
    let changed = paintCell(s, tool, from.x, from.y);
    if (tool !== 'path' && tool !== 'ore' && tool !== 'erase') return changed;
    let x = from.x, y = from.y;
    while (x !== to.x || y !== to.y) {
      if (x !== to.x) {
        x += Math.sign(to.x - x);
        changed = paintCell(s, tool, x, y) || changed;
      }
      if (y !== to.y) {
        y += Math.sign(to.y - y);
        changed = paintCell(s, tool, x, y) || changed;
      }
    }
    return changed;
  }

  function effectivePath(s) {
    const road=new Set(s.path);
    if(s.spawn)road.add(key(s.spawn.x,s.spawn.y));
    if(s.hq)road.add(key(s.hq.x,s.hq.y));
    return road;
  }
  const neighbours=(path,k)=>{
    const [x,y]=k.split(',').map(Number);
    return [[x-1,y],[x+1,y],[x,y-1],[x,y+1]].map(p=>key(p[0],p[1])).filter(p=>path.has(p));
  };
  function validate(s) {
    const fail=message=>({valid:false,message});
    if(!s.spawn||!inside(s.spawn.x,s.spawn.y))return fail('Setze zuerst einen Startpunkt (S).');
    if(!s.hq||!inside(s.hq.x,s.hq.y))return fail('Setze zuerst das Ziel/HQ (H).');
    if(at(s.spawn,s.hq.x,s.hq.y))return fail('Start und Ziel müssen getrennte Felder sein.');
    const road=effectivePath(s),first=key(s.spawn.x,s.spawn.y),last=key(s.hq.x,s.hq.y);
    if(road.size<6)return fail('Zeichne einen Weg mit mindestens sechs Feldern.');
    if(!s.ore.size)return fail('Platziere mindestens ein Erzfeld.');
    for(const k of s.ore)if(road.has(k))return fail('Erz und Weg dürfen sich nicht überlappen.');
    for(const k of road){
      const expected=k===first||k===last?1:2;
      if(neighbours(road,k).length!==expected)return fail('Der Gegnerweg muss ohne Verzweigung von Start bis HQ führen.');
    }
    const seen=new Set([first]),queue=[first];
    for(let i=0;i<queue.length;i++)for(const k of neighbours(road,queue[i]))if(!seen.has(k)){seen.add(k);queue.push(k);}
    if(seen.size!==road.size||!seen.has(last))return fail('Der Gegnerweg muss Start und HQ verbinden.');
    return {valid:true,message:'Geometrie gültig. Testspiel auf Schwer kann gestartet werden.'};
  }
  function mapSnapshot(s) {
    if(!validate(s).valid)return null;
    const road=effectivePath(s),ordered=[],last=key(s.hq.x,s.hq.y);
    let prev=null,current=key(s.spawn.x,s.spawn.y);
    while(current!==null){
      ordered.push(current.split(',').map(Number));
      if(current===last)break;
      const next=neighbours(road,current).filter(k=>k!==prev);
      if(next.length!==1)return null;
      prev=current;current=next[0];
    }
    if(ordered.length!==road.size)return null;
    return {path:ordered,ore:[...s.ore].sort(),hq:{...s.hq}};
  }
  function mapSignature(s) {
    const snapshot=mapSnapshot(s);
    return snapshot?JSON.stringify(snapshot):null;
  }
  function restoreSnapshot(snapshot) {
    if(!snapshot||!Array.isArray(snapshot.path)||!Array.isArray(snapshot.ore)||!snapshot.hq)return null;
    const state=makeState();
    for(const p of snapshot.path){
      if(!Array.isArray(p)||p.length!==2||!inside(p[0],p[1]))return null;
      if(!paintCell(state,'path',p[0],p[1]))return null;
    }
    for(const p of snapshot.ore){
      const m=/^(\d+),(\d+)$/.exec(p);
      if(!m||!paintCell(state,'ore',Number(m[1]),Number(m[2])))return null;
    }
    state.spawn={x:snapshot.path[0][0],y:snapshot.path[0][1]};
    state.hq={...snapshot.hq};
    return validate(state).valid?state:null;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { WIDTH, HEIGHT, makeState, cloneState, paintCell, paintLine, validate, mapSnapshot, mapSignature, restoreSnapshot };
  }
  if (typeof document === 'undefined') return;

  const section = document.getElementById('map-editor');
  const openButton = document.getElementById('editor-open');
  if (!section || !openButton) return;
  const campaign = document.getElementById('campaign');
  const canvas = document.getElementById('editor-canvas');
  const viewport = document.getElementById('editor-viewport');
  const ctx = canvas.getContext('2d');
  const status = document.getElementById('editor-status');
  const undoButton = document.getElementById('editor-undo');
  const buttons = Array.from(section.querySelectorAll('[data-editor-tool]'));
  let state = makeState(), history = [], tool = 'path', zoom = 0.75, pointer = null;
  let clearedSignature = null, testSignature = null, editingId = null, lastSavedSignature = null;
  const LOCAL_KEY = 'forgefront.editor.maps.v1';
  const testButton = document.getElementById('editor-test');
  const saveButton = document.getElementById('editor-save');
  const nameInput = document.getElementById('editor-name');
  const localList = document.getElementById('editor-local-list');
  const selection = document.getElementById('editor-map-selection');
  const workspace = document.getElementById('editor-workspace');
  const workTitle = document.getElementById('editor-work-title');

  function hasUnsavedChanges() {
    const occupied = state.path.size || state.ore.size || state.spawn || state.hq;
    return !!occupied && (lastSavedSignature === null || mapSignature(state) !== lastSavedSignature);
  }
  function mayLeaveEditor() {
    return !hasUnsavedChanges() || window.confirm('Nicht gespeicherte Änderungen an dieser Karte verwerfen?');
  }
  function newDraft() {
    state = makeState(); history = []; editingId = null;
    clearedSignature = null; testSignature = null; lastSavedSignature = null;
    nameInput.value = ''; workTitle.textContent = 'Neue Karte zeichnen';
    render(); chooseTool('path');
  }
  function showWorkspace() {
    selection.hidden = true; workspace.hidden = false;
    applyZoom(0.75);
    viewport.scrollLeft = 0; viewport.scrollTop = 0;
    render();
  }
  function showSelection() {
    workspace.hidden = true; selection.hidden = false;
    refreshSavedList();
  }



  function updateButtons(){const sig=mapSignature(state);testButton.disabled=!sig;saveButton.disabled=!sig||sig!==clearedSignature;}
  function setMessage(message) { status.textContent = message; }
  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#163349';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
      const k = key(x, y), px = x * TILE, py = y * TILE;
      if (state.path.has(k)) {
        ctx.fillStyle = '#a48e6b';
        ctx.fillRect(px + 1, py + 1, TILE - 2, TILE - 2);
      } else if (state.ore.has(k)) {
        ctx.fillStyle = '#bd864a';
        ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
        ctx.fillStyle = '#f7cd81';
        ctx.beginPath(); ctx.arc(px + TILE / 2, py + TILE / 2, 7, 0, 2 * Math.PI); ctx.fill();
      }
      ctx.strokeStyle = '#597083';
      ctx.lineWidth = 0.65;
      ctx.strokeRect(px + 0.5, py + 0.5, TILE, TILE);
    }
    function marker(pos, color, label) {
      if (!pos) return;
      ctx.fillStyle = color;
      ctx.fillRect(pos.x * TILE + 3, pos.y * TILE + 3, TILE - 6, TILE - 6);
      ctx.font = 'bold 19px system-ui';
      ctx.fillStyle = '#102235';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, pos.x * TILE + TILE / 2, pos.y * TILE + TILE / 2);
    }
    marker(state.spawn, '#8ad2ae', 'S');
    marker(state.hq, '#f7c781', 'H');
    undoButton.disabled = history.length === 0;
    updateButtons();
  }
  function chooseTool(name) {
    tool = name;
    buttons.forEach(b => {
      const selected = b.dataset.editorTool === tool;
      b.classList.toggle('selected', selected);
      b.setAttribute('aria-pressed', String(selected));
    });
    const hints = {
      path: 'Weg: Start und Ziel selbst festlegen und mit dem Finger verbinden.',
      ore: 'Erz: Felder einzeln oder durch Ziehen markieren.',
      erase: 'Radiergummi: Felder löschen. Start/HQ zuerst löschen, darunterliegenden Weg beim zweiten Tippen.',
      spawn: 'Start: beliebiges Rasterfeld antippen, um den Start zu setzen oder zu verschieben.',
      hq: 'Ziel/HQ: beliebiges Rasterfeld antippen, um das Ziel zu setzen oder zu verschieben.',
      pan: 'Verschieben: Spielfeld mit einem Finger bewegen.'
    };
    setMessage(hints[tool]);
  }
  function applyZoom(value) {
    zoom = Math.max(0.4, Math.min(1.5, value));
    canvas.style.width = (WIDTH * TILE * zoom) + 'px';
    canvas.style.height = (HEIGHT * TILE * zoom) + 'px';
    document.getElementById('editor-zoom').textContent = Math.round(zoom * 100) + ' %';
  }
  function tileAt(e) {
    const r = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - r.left) * WIDTH / r.width);
    const y = Math.floor((e.clientY - r.top) * HEIGHT / r.height);
    return inside(x, y) ? { x, y } : null;
  }
  function endStroke(cancelled) {
    if (!pointer) return;
    if (cancelled) state = pointer.before;
    else if (pointer.changed) {
      clearedSignature = null;
      history.push(pointer.before);
      if (history.length > 30) history.shift();
    }
    pointer = null;
    render();
  }

  canvas.addEventListener('pointerdown', e => {
    if (pointer || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const cell = tileAt(e);
    if (!cell && tool !== 'pan') return;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    pointer = { id: e.pointerId, last: cell, x: e.clientX, y: e.clientY, before: cloneState(state), changed: false };
    if (tool !== 'pan') {
      pointer.changed = paintCell(state, tool, cell.x, cell.y);
      render();
    }
  });
  canvas.addEventListener('pointermove', e => {
    if (!pointer || e.pointerId !== pointer.id) return;
    e.preventDefault();
    if (tool === 'pan') {
      viewport.scrollLeft -= e.clientX - pointer.x;
      viewport.scrollTop -= e.clientY - pointer.y;
      pointer.x = e.clientX; pointer.y = e.clientY;
      return;
    }
    if (tool === 'spawn' || tool === 'hq') return;
    const cell = tileAt(e);
    if (!cell) return;
    pointer.changed = paintLine(state, tool, pointer.last || cell, cell) || pointer.changed;
    pointer.last = cell;
    render();
  });
  canvas.addEventListener('pointerup', e => {
    if (!pointer || e.pointerId !== pointer.id) return;
    endStroke(false);
  });
  canvas.addEventListener('pointercancel', e => {
    if (pointer && e.pointerId === pointer.id) endStroke(true);
  });
  canvas.addEventListener('lostpointercapture', () => endStroke(false));

  buttons.forEach(b => b.addEventListener('click', () => chooseTool(b.dataset.editorTool)));
  undoButton.addEventListener('click', () => {
    if (!history.length) return;
    state = history.pop();
    clearedSignature = null;
    render();
    setMessage('Letzten Zeichenstrich rückgängig gemacht.');
  });
  document.getElementById('editor-check').addEventListener('click', () => {
    const result = validate(state);
    status.dataset.valid = String(result.valid);
    setMessage(result.message);
  });
  testButton.addEventListener('click',()=>{const snapshot=mapSnapshot(state);if(!snapshot){setMessage(validate(state).message);return;}testSignature=mapSignature(state);if(window.ForgefrontCustom?.start(snapshot)){section.hidden=true;}else{testSignature=null;setMessage('Testspiel konnte nicht gestartet werden.');}});
  function onTestResult(e){
    clearedSignature=e.detail?.won&&window.ForgefrontCustom?.verifiedWin?.()&&mapSignature(state)===testSignature?testSignature:null;
    updateButtons();
    setMessage(clearedSignature?'Boss auf Schwer besiegt! Karte jetzt benennen und speichern.':'Noch kein gültiger Schwer-Sieg. Karte weiter testen.');
  }
  window.addEventListener('forgefront-custom-result',onTestResult);
  function refreshSavedList(){localList.replaceChildren();try{showSavedEntries();}catch{}}
  function showSavedEntries(){
    const cards=JSON.parse(window.localStorage.getItem(LOCAL_KEY)||'[]');
    if(!Array.isArray(cards)||!cards.length){
      const empty=document.createElement('p');empty.className='editor-empty';
      empty.textContent='Noch keine gespeicherten Karten auf diesem Gerät.';localList.append(empty);return;
    }
    for(const card of cards){
      const row=document.createElement('div'),label=document.createElement('span'),btn=document.createElement('button');
      row.className='editor-local-item';
      label.textContent=String(card.name||'Karte');btn.textContent='Öffnen';
      btn.addEventListener('click',()=>loadSavedCard(card));
      row.append(label,btn);localList.append(row);
    }
  }

  function loadSavedCard(card){
    const draft=restoreSnapshot(card.snapshot);
    if(!draft)return;
    state=draft;history=[];editingId=card.id;nameInput.value=String(card.name||'');
    lastSavedSignature=mapSignature(state);clearedSignature=lastSavedSignature;testSignature=null;
    workTitle.textContent=nameInput.value||'Gespeicherte Karte';
    showWorkspace();
    setMessage('Karte geöffnet. Nach Änderungen ist ein neuer Schwer-Sieg erforderlich.');
  }
  function saveTestedMap(){
    const snapshot=mapSnapshot(state);
    if(!snapshot||mapSignature(state)!==clearedSignature)return;
    const name=nameInput.value.trim().slice(0,60);
    if(!name){setMessage('Bitte Karte benennen.');return;}
    try{
      const raw=JSON.parse(window.localStorage.getItem(LOCAL_KEY)||'[]');
      const cards=Array.isArray(raw)?raw:[];
      const id=editingId||('map-'+Date.now().toString(36));
      window.localStorage.setItem(LOCAL_KEY,JSON.stringify(cards.filter(c=>c.id!==id).concat([{id,name,snapshot}]).slice(-30)));
      editingId=id;lastSavedSignature=mapSignature(state);
      workTitle.textContent=name;
      setMessage('Nach Schwer-Sieg lokal gespeichert. Freigabe für alle folgt in AP3.');refreshSavedList();
    }catch{setMessage('Speichern im Browser fehlgeschlagen.');}
  }
  saveButton.addEventListener('click',saveTestedMap);
  document.getElementById('editor-zoom-in').addEventListener('click', () => applyZoom(zoom + 0.2));
  document.getElementById('editor-zoom-out').addEventListener('click', () => applyZoom(zoom - 0.2));
  document.getElementById('editor-fit').addEventListener('click', () => {
    applyZoom((viewport.clientWidth - 4) / (WIDTH * TILE));
    viewport.scrollLeft = 0; viewport.scrollTop = 0;
  });
  document.getElementById('editor-clear').addEventListener('click', () => {
    if (!window.confirm('Die aktuelle, nicht gespeicherte Karte verwerfen?')) return;
    newDraft();setMessage('Neue leere Karte.');
  });
  document.getElementById('editor-new').addEventListener('click', () => {
    newDraft();showWorkspace();
  });
  document.getElementById('editor-to-list').addEventListener('click', () => {
    if (!mayLeaveEditor()) return;
    if (pointer) endStroke(true);
    showSelection();
  });
  openButton.addEventListener('click', () => {
    if (!document.getElementById('game-shell').hidden) return;
    newDraft();
    campaign.hidden = true;section.hidden = false;
    showSelection();
  });
  document.getElementById('editor-back').addEventListener('click', () => {
    if (!workspace.hidden && !mayLeaveEditor()) return;
    if (pointer) endStroke(true);
    section.hidden = true;
    campaign.hidden = false;
    newDraft();
  });
})();
