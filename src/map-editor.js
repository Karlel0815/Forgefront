/* Forgefront map editor AP1 – isolated from campaign saves and combat. */
(function () {
  'use strict';
  const WIDTH = 18, HEIGHT = 20, TILE = 40;
  const key = (x, y) => x + ',' + y;
  const inside = (x, y) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < WIDTH && y < HEIGHT;
  const border = (x, y) => x === 0 || y === 0 || x === WIDTH - 1 || y === HEIGHT - 1;
  const at = (a, x, y) => a.x === x && a.y === y;

  function makeState() {
    return { path: new Set(), ore: new Set(), spawn: { x: 0, y: 3 }, hq: { x: 16, y: 18 } };
  }
  function cloneState(s) {
    return {
      path: new Set(s.path), ore: new Set(s.ore),
      spawn: { x: s.spawn.x, y: s.spawn.y }, hq: { x: s.hq.x, y: s.hq.y }
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
      // The markers themselves are moved with their respective tools.
      const changed = s.ore.delete(k) || s.path.delete(k);
      return changed;
    }
    if (tool === 'spawn') {
      if (!border(x, y) || at(s.hq, x, y) || s.ore.has(k) || at(s.spawn, x, y)) return false;
      s.spawn = { x, y };
      s.path.add(k);
      return true;
    }
    if (tool === 'hq') {
      if (at(s.spawn, x, y) || s.ore.has(k) || at(s.hq, x, y)) return false;
      s.hq = { x, y };
      s.path.add(k);
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

  function validate(s) {
    const fail = reason => ({ valid: false, message: reason });
    if (!inside(s.spawn.x, s.spawn.y) || !border(s.spawn.x, s.spawn.y)) return fail('Start muss am Kartenrand liegen.');
    if (!inside(s.hq.x, s.hq.y) || at(s.spawn, s.hq.x, s.hq.y)) return fail('HQ und Start müssen getrennte Felder sein.');
    if (s.path.size < 6) return fail('Zeichne einen Gegnerweg mit mindestens sechs Feldern.');
    if (!s.path.has(key(s.spawn.x, s.spawn.y)) || !s.path.has(key(s.hq.x, s.hq.y))) {
      return fail('Der Gegnerweg muss Start und HQ erreichen.');
    }
    if (s.ore.size === 0) return fail('Platziere mindestens ein Erzfeld.');
    for (const k of s.ore) if (s.path.has(k)) return fail('Erz und Weg dürfen sich nicht überlappen.');
    const neighbours = k => {
      const [x, y] = k.split(',').map(Number);
      return [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]
        .map(p => key(p[0], p[1])).filter(n => s.path.has(n));
    };
    const first = key(s.spawn.x, s.spawn.y), last = key(s.hq.x, s.hq.y);
    for (const k of s.path) {
      const expected = k === first || k === last ? 1 : 2;
      if (neighbours(k).length !== expected) return fail('Weg enthält eine Verzweigung, Schleife oder ein offenes Ende.');
    }
    const visited = new Set([first]), queue = [first];
    for (let i = 0; i < queue.length; i++) {
      for (const n of neighbours(queue[i])) if (!visited.has(n)) {
        visited.add(n);
        queue.push(n);
      }
    }
    if (visited.size !== s.path.size || !visited.has(last)) return fail('Der Weg muss durchgehend von Start bis HQ führen.');
    return { valid: true, message: 'Geometrie gültig. Testspielen und Speichern folgen erst mit AP2.' };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { WIDTH, HEIGHT, makeState, cloneState, paintCell, paintLine, validate };
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
  }
  function chooseTool(name) {
    tool = name;
    buttons.forEach(b => {
      const selected = b.dataset.editorTool === tool;
      b.classList.toggle('selected', selected);
      b.setAttribute('aria-pressed', String(selected));
    });
    const hints = {
      path: 'Weg: mit dem Finger zeichnen. Berührte Rasterfelder verbinden sich.',
      ore: 'Erz: Felder einzeln oder durch Ziehen markieren.',
      erase: 'Radiergummi: über Weg oder Erz wischen, um einzelne Felder zu löschen.',
      spawn: 'Start: Feld am Kartenrand antippen.',
      hq: 'HQ: Zielposition antippen.',
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
    render();
    setMessage('Letzten Zeichenstrich rückgängig gemacht.');
  });
  document.getElementById('editor-check').addEventListener('click', () => {
    const result = validate(state);
    status.dataset.valid = String(result.valid);
    setMessage(result.message);
  });
  document.getElementById('editor-zoom-in').addEventListener('click', () => applyZoom(zoom + 0.2));
  document.getElementById('editor-zoom-out').addEventListener('click', () => applyZoom(zoom - 0.2));
  document.getElementById('editor-fit').addEventListener('click', () => {
    applyZoom((viewport.clientWidth - 4) / (WIDTH * TILE));
    viewport.scrollLeft = 0; viewport.scrollTop = 0;
  });
  document.getElementById('editor-clear').addEventListener('click', () => {
    if (!window.confirm('Die aktuelle, nicht gespeicherte Karte verwerfen?')) return;
    state = makeState(); history = [];
    render(); setMessage('Neue leere Karte.');
  });
  openButton.addEventListener('click', () => {
    if (!document.getElementById('game-shell').hidden) return;
    state = makeState(); history = [];
    campaign.hidden = true;
    section.hidden = false;
    applyZoom(0.75);
    viewport.scrollLeft = 0; viewport.scrollTop = 0;
    render(); chooseTool('path');
  });
  document.getElementById('editor-back').addEventListener('click', () => {
    if ((state.path.size || state.ore.size) && !window.confirm('Nicht gespeicherte Karte verwerfen und zur Kampagne zurück?')) return;
    if (pointer) endStroke(true);
    section.hidden = true;
    campaign.hidden = false;
    state = makeState(); history = [];
  });
})();
