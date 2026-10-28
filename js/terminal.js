"use strict";

const Term = (() => {
  const MAX = 2000;                       
  const host = document.getElementById("term");
  const screen = document.getElementById("screen");
  const DEF = Object.freeze({ fg: null, bg: null, b: 0, d: 0, i: 0, u: 0, r: 0, s: 0 });
  const BLANK = { c: " ", st: DEF };
  const PAL = ["#000000","#cc0000","#4e9a06","#c4a000","#3465a4","#75507b","#06989a","#d3d7cf",
               "#555753","#ef2929","#8ae234","#fce94f","#729fcf","#ad7fa8","#34e2e2","#eeeeee"];
  const hex = (r, g, b) => "#" + [r, g, b].map(x => Math.max(0, Math.min(255, x | 0)).toString(16).padStart(2, "0")).join("");
  const c256 = n => {
    n = n | 0;
    if (n < 16) return PAL[Math.max(0, n)];
    if (n < 232) { n -= 16; const f = v => v ? 55 + v * 40 : 0; return hex(f(Math.floor(n / 36)), f(Math.floor(n / 6) % 6), f(n % 6)); }
    const g = 8 + (Math.min(n, 255) - 232) * 10; return hex(g, g, g);
  };

  let cols = 80, rows = 24, lines, base, row, col, st, saved, mode, buf, cursorOn, raf = 0, anchor = null;
  const cssCache = new WeakMap();

  function cssOf(s) {
    let o = cssCache.get(s);
    if (o !== undefined) return o;
    let fg = s.fg, bg = s.bg;
    if (s.r) { const f = fg; fg = bg || "#000"; bg = f || "#c0c0c0"; }
    o = "";
    if (fg) o += "color:" + fg + ";";
    if (bg) o += "background:" + bg + ";";
    if (s.b) o += "font-weight:bold;";
    if (s.d) o += "opacity:.6;";
    if (s.i) o += "font-style:italic;";
    if (s.u || s.s) o += "text-decoration:" + [s.u ? "underline" : "", s.s ? "line-through" : ""].join(" ").trim() + ";";
    cssCache.set(s, o);
    return o;
  }

  function reset() {
    lines = [[]]; base = 0; row = 0; col = 0; st = DEF; saved = null; anchor = null; mode = 0; buf = ""; cursorOn = true;
    measure(); schedule();
  }
  function measure() {
    const p = document.createElement("span");
    p.style.cssText = "position:absolute;visibility:hidden;white-space:pre";
    p.textContent = "M".repeat(50); host.appendChild(p);
    const cw = p.getBoundingClientRect().width / 50; host.removeChild(p);
    if (!host.clientWidth || !cw) return;
    cols = Math.max(20, Math.floor((host.clientWidth - 8) / cw));
    rows = Math.max(5, Math.floor((host.clientHeight - 8) / 18));
  }
  const ensure = r => { while (lines.length <= r) lines.push([]); };
  function lf() {
    row++;
    if (row >= base + rows) base = row - rows + 1;
    ensure(row);
    if (lines.length > MAX) { const k = lines.length - MAX; lines.splice(0, k); base = Math.max(0, base - k); row -= k; if (saved) saved.r = Math.min(saved.r, rows - 1); if (anchor) anchor.row -= k; }
  }
  function put(ch) {
    if (col >= cols) { lf(); col = 0; }
    const L = lines[row];
    while (L.length < col) L.push(BLANK);
    L[col] = { c: ch, st }; col++;
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function sgr(ps) {
    if (!ps.length) ps = [0];
    const s = { ...st };
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      if (p === 0) Object.assign(s, DEF);
      else if (p === 1) s.b = 1; else if (p === 2) s.d = 1; else if (p === 3) s.i = 1;
      else if (p === 4) s.u = 1; else if (p === 7) s.r = 1; else if (p === 9) s.s = 1;
      else if (p === 22) s.b = s.d = 0; else if (p === 23) s.i = 0; else if (p === 24) s.u = 0;
      else if (p === 27) s.r = 0; else if (p === 29) s.s = 0;
      else if (p >= 30 && p <= 37) s.fg = PAL[p - 30]; else if (p >= 90 && p <= 97) s.fg = PAL[p - 82];
      else if (p === 39) s.fg = null;
      else if (p >= 40 && p <= 47) s.bg = PAL[p - 40]; else if (p >= 100 && p <= 107) s.bg = PAL[p - 92];
      else if (p === 49) s.bg = null;
      else if (p === 38 || p === 48) {
        let c = null;
        if (ps[i + 1] === 5) { c = c256(ps[i + 2]); i += 2; }
        else if (ps[i + 1] === 2) { c = hex(ps[i + 2], ps[i + 3], ps[i + 4]); i += 4; }
        if (p === 38) s.fg = c; else s.bg = c;
      }
    }
    st = s;
  }

  function csi(params, f) {
    const priv = /^[?<=>]/.test(params);
    const ps = params.replace(/^[?<=>]/, "").replace(/:/g, ";").split(";").map(x => parseInt(x, 10));
    const n = (i, d) => { const v = ps[i]; return Number.isNaN(v) || v === undefined ? d : v; };
    const mv = n(0, 1) || 1;
    const bottom = base + rows - 1;
    let L;
    switch (f) {
      case "A": row = Math.max(base, row - mv); break;
      case "B": row = Math.min(bottom, row + mv); ensure(row); break;
      case "C": col = Math.min(cols - 1, col + mv); break;
      case "D": col = Math.max(0, col - mv); break;
      case "E": row = Math.min(bottom, row + mv); ensure(row); col = 0; break;
      case "F": row = Math.max(base, row - mv); col = 0; break;
      case "G": col = clamp(n(0, 1) - 1, 0, cols - 1); break;
      case "d": row = base + clamp(n(0, 1) - 1, 0, rows - 1); ensure(row); break;
      case "H": case "f":
        row = base + clamp(n(0, 1) - 1, 0, rows - 1); ensure(row);
        col = clamp(n(1, 1) - 1, 0, cols - 1); break;
      case "J": {
        const m = n(0, 0); L = lines[row];
        if (m === 0) { L.length = Math.min(L.length, col); for (let r = row + 1; r < lines.length; r++) lines[r] = []; }
        else if (m === 1) { for (let r = base; r < row; r++) lines[r] = []; for (let i = 0; i <= Math.min(col, cols - 1); i++) L[i] = BLANK; }
        else if (m === 2) { for (let r = base; r < lines.length; r++) lines[r] = []; }
        else if (m === 3) { lines.splice(0, base); row -= base; base = 0; }
        break;
      }
      case "K": {
        const m = n(0, 0); L = lines[row];
        if (m === 0) L.length = Math.min(L.length, col);
        else if (m === 1) { for (let i = 0; i <= Math.min(col, cols - 1); i++) L[i] = BLANK; }
        else lines[row] = [];
        break;
      }
      case "P": L = lines[row]; if (col < L.length) L.splice(col, mv); break;
      case "@": L = lines[row]; while (L.length < col) L.push(BLANK); L.splice(col, 0, ...Array(mv).fill(BLANK)); L.length = Math.min(L.length, cols); break;
      case "X": L = lines[row]; for (let i = col; i < col + mv && i < L.length; i++) L[i] = BLANK; break;
      case "m": sgr(ps.map(x => x || 0)); break;
      case "s": saved = { r: row - base, c: col }; break;
      case "u": if (saved) { row = base + clamp(saved.r, 0, rows - 1); ensure(row); col = saved.c; } break;
      case "h": case "l": if (priv && ps.includes(25)) cursorOn = f === "h"; break;
    }
  }

  function feed(ch) {
    switch (mode) {
      case 0: {
        const c = ch.charCodeAt(0);
        if (ch === "\x1b") mode = 1;
        else if (ch === "\n" || ch === "\v" || ch === "\f") { lf(); col = 0; }
        else if (ch === "\r") col = 0;
        else if (ch === "\t") col = Math.min(cols - 1, (Math.floor(col / 8) + 1) * 8);
        else if (ch === "\b") col = Math.max(0, col - 1);
        else if (c < 32 || c === 127) {  }
        else put(ch);
        break;
      }
      case 1:
        mode = 0;
        if (ch === "[") { mode = 2; buf = ""; }
        else if (ch === "]") mode = 3;
        else if (ch === "c") { const keep = lines; reset(); void keep; }
        else if (ch === "7") saved = { r: row - base, c: col };
        else if (ch === "8") { if (saved) { row = base + clamp(saved.r, 0, rows - 1); ensure(row); col = saved.c; } }
        else if (ch === "D") lf();
        else if (ch === "E") { lf(); col = 0; }
        else if (ch === "M") { if (row > base) row--; }
        else if (ch === "(" || ch === ")") mode = 4;
        break;
      case 2:
        if (ch >= "@" && ch <= "~") { mode = 0; csi(buf, ch); }
        else if (ch === "\x1b") mode = 1;
        else buf += ch;
        break;
      case 3: if (ch === "\x07") mode = 0; else if (ch === "\x1b") mode = 4; break;   
      case 4: mode = 0; break;                                                         
    }
  }

  const esc = s => s.replace(/[&<>]/g, c => c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;");

  function render() {
    raf = 0;
    const atBottom = host.scrollHeight - host.scrollTop - host.clientHeight < 6;
    const cc = Math.min(col, cols - 1);
    const out = [];
    for (let r = 0; r < lines.length; r++) {
      const L = lines[r], cur = cursorOn && r === row;
      const n = cur ? Math.max(L.length, cc + 1) : L.length;
      let h = "", i = 0;
      while (i < n) {
        const cell = L[i] || BLANK, isC = cur && i === cc, css = cssOf(cell.st);
        let txt = cell.c, j = i + 1;
        if (!isC) {
          while (j < n && !(cur && j === cc)) {
            const c2 = L[j] || BLANK;
            if (cssOf(c2.st) !== css) break;
            txt += c2.c; j++;
          }
        }
        txt = esc(txt);
        if (isC) h += '<span style="' + css + 'background:#d0d0d0;color:#000;">' + txt + "</span>";
        else if (css) h += '<span style="' + css + '">' + txt + "</span>";
        else h += txt;
        i = j;
      }
      out.push(h);
    }
    screen.innerHTML = out.join("\n");
    if (atBottom) host.scrollTop = host.scrollHeight;
  }
  const schedule = () => { if (!raf) raf = requestAnimationFrame(render); };

  function write(s) { for (const ch of String(s)) feed(ch); schedule(); }

  
  
  const mark = () => { anchor = { row, col }; };
  const unmark = () => { anchor = null; };
  function edit(val, caret) {
    if (!anchor) return;
    const clean = x => x.replace(/[\x00-\x1f\x7f]/g, "");
    const before = clean(val.slice(0, caret)), after = clean(val.slice(caret));
    const keep = st; st = DEF; mode = 0;
    row = anchor.row; col = anchor.col; ensure(row);
    lines[row].length = Math.min(lines[row].length, col);
    for (let r = row + 1; r < lines.length; r++) lines[r] = [];
    write(before);
    const r2 = row, c2 = col;
    write(after);
    lines.length = Math.max(row, r2) + 1;
    row = r2; col = c2; st = keep; schedule();
  }
  return { reset, write, measure, mark, unmark, edit, atLineStart: () => col === 0 };
})();
