"use strict";

const Editor = (() => {
  const g = id => document.getElementById(id);
  const ed = g("ed"), box = g("lines"), rowsEl = g("rows"), taEl = g("ta"), curEl = g("cur"),
        clEl = g("curline"), selBox = g("selbox"), pairEl = g("pairbox"), multiEl = g("multi"),
        pop = g("pop"), sigEl = g("sig"), posEl = g("pos");
  const searchBar = g("searchbar"), findInput = g("findq"), replaceInput = g("replaceq"),
        replaceRow = g("replaceRow"), findCase = g("findCase"), findRegex = g("findRegex"), findStatus = g("findStatus");
  const gotoBar = g("gotoBar"), gotoInput = g("gotoLine"), gotoStatus = g("gotoStatus");
  let findMatches = [], activeFindIndex = -1;
  const LH = 18, PAD = 6;
  const W = s => s.split(" ");
  const KW = new Set(W("async await break case catch class const continue debugger default delete do else export extends finally for function if import in instanceof let new of return static super switch this throw try typeof var void while with yield"));
  const LIT = new Set(W("true false null undefined NaN Infinity"));
  const BIF = W("print() println() write() input() clear() onKey() sleep() exit() setTimeout() setInterval() clearTimeout() clearInterval() parseInt() parseFloat() isNaN() isFinite() structuredClone()");
  const BIO = W("console Math JSON Object Array String Number Boolean Date Promise Map Set Symbol RegExp Error BigInt Intl");
  const BI = new Set([...BIF.map(x => x.replace("()", "")), ...BIO]);
  const EV = "key code repeat ctrlKey shiftKey altKey metaKey actions type preventDefault()";
  const MEM = {
    console: "log() warn() error() info() debug()",
    Math: "PI E LN2 LN10 LOG2E LOG10E SQRT2 SQRT1_2 abs() floor() ceil() round() trunc() sign() min() max() pow() sqrt() cbrt() random() sin() cos() tan() asin() acos() atan() atan2() sinh() cosh() tanh() log() log2() log10() log1p() exp() expm1() hypot() fround() clz32() imul() TAU PHI SQRT3 DEG2RAD RAD2DEG EPSILON seed() clamp() clamp01() saturate() inRange() between() wrap() mod() pingPong() moveToward() approx() lerp() invLerp() remap() map() step() smoothstep() smootherstep() sigmoid() easeInQuad() easeOutQuad() easeInOutQuad() easeInCubic() easeOutCubic() easeInOutCubic() ceiling() truncate() roundTo() floorTo() ceilTo() snap() fract() frac() floorDiv() intDiv() square() cube() root() toRadians() toDegrees() deg2rad() rad2deg() sinDeg() cosDeg() tanDeg() cot() sec() csc() dist() distSq() manhattan() angleTo() randFloat() randInt() randBool() randSign() randNormal() choice() weighted() shuffle() sum() product() mean() avg() median() mode() variance() stdDev() isEven() isOdd() isPrime() gcd() lcm() factorial() fib() nCr() nPr() digitSum() isPowerOfTwo() percent()",
    JSON: "stringify() parse()",
    Object: "keys() values() entries() assign() freeze() fromEntries() create() getPrototypeOf()",
    Array: "isArray() from() of()",
    Number: "isInteger() isFinite() isNaN() parseFloat() parseInt() MAX_SAFE_INTEGER MIN_SAFE_INTEGER EPSILON",
    Promise: "all() race() resolve() reject() allSettled()",
    Date: "now() parse() UTC()",
    String: "fromCharCode() raw()",
    e: EV, ev: EV, event: EV, actions: "onPressed onReleased"
  };
  const GEN = "length push() pop() shift() unshift() slice() splice() map() filter() reduce() forEach() find() findIndex() includes() indexOf() join() sort() reverse() concat() some() every() flat() fill() at() split() trim() padStart() padEnd() repeat() replace() replaceAll() startsWith() endsWith() toUpperCase() toLowerCase() charAt() charCodeAt() substring() toString() toFixed() keys() values() entries() has() get() set() add() delete() clear() size";

  
  const SIG = Object.create(null);
  (function () {
    const add = (prefix, groups) => { for (const [names, p] of groups) for (const n of names.split(" ")) SIG[prefix + n] = p; };
    add("", [
      ["print println write", "...values"], ["input", 'prompt = ""'], ["clear exit", ""], ["onKey", "callback(event)"], ["sleep", "ms"],
      ["setTimeout setInterval", "callback, ms, ...args"], ["clearTimeout clearInterval", "id"],
      ["parseInt", "string, radix"], ["parseFloat", "string"], ["isNaN isFinite structuredClone", "value"],
      ["Map Set", "iterable"], ["Promise", "executor(resolve, reject)"], ["Date Number String Boolean Object", "value"],
      ["Array", "length"], ["Error", "message"], ["RegExp", "pattern, flags"]
    ]);
    add("Math.", [
      ["abs floor ceil round trunc sign sqrt cbrt sin cos tan asin acos atan sinh cosh tanh log log2 log10 log1p exp expm1 fround clz32 clamp01 saturate sigmoid ceiling truncate fract frac square cube cot sec csc", "x"],
      ["easeInQuad easeOutQuad easeInOutQuad easeInCubic easeOutCubic easeInOutCubic", "t"],
      ["atan2", "y, x"], ["min max hypot", "...values"], ["pow", "base, exponent"], ["imul floorDiv intDiv", "a, b"],
      ["random randSign", ""], ["seed", "seed?"], ["clamp wrap", "x, min, max"], ["inRange between", "x, a, b"],
      ["mod", "a, n"], ["pingPong", "t, length"], ["moveToward", "current, target, maxDelta"], ["approx", "a, b, eps = 1e-9"],
      ["lerp", "a, b, t"], ["invLerp", "a, b, value"], ["remap map", "value, inMin, inMax, outMin, outMax"],
      ["step", "edge, x"], ["smoothstep smootherstep", "edge0, edge1, x"], ["roundTo floorTo ceilTo", "x, decimals = 0"],
      ["snap", "x, step"], ["root", "x, n"], ["toRadians deg2rad sinDeg cosDeg tanDeg", "degrees"], ["toDegrees rad2deg", "radians"],
      ["dist distSq manhattan angleTo", "x1, y1, x2, y2"], ["randFloat", "min = 0, max = 1"], ["randInt", "min, max"],
      ["randBool", "p = 0.5"], ["randNormal", "mean = 0, sd = 1"], ["choice shuffle", "array"], ["weighted", "array, weights"],
      ["sum product mean avg median mode variance stdDev gcd lcm", "...numbers"],
      ["isEven isOdd isPrime factorial fib digitSum isPowerOfTwo", "n"], ["nCr nPr", "n, k"], ["percent", "part, total"]
    ]);
    add("console.", [["log warn error info debug", "...data"]]);
    add("JSON.", [["stringify", "value, replacer, space"], ["parse", "text, reviver"]]);
    add("Object.", [["keys values entries freeze getPrototypeOf", "obj"], ["assign", "target, ...sources"], ["fromEntries", "entries"], ["create", "proto, properties"]]);
    add("Array.", [["isArray", "value"], ["from", "iterable, mapFn"], ["of", "...items"]]);
    add("Number.", [["isInteger isFinite isNaN", "value"], ["parseFloat", "string"], ["parseInt", "string, radix"]]);
    add("Promise.", [["all race allSettled", "promises"], ["resolve", "value"], ["reject", "reason"]]);
    add("Date.", [["now", ""], ["parse", "dateString"], ["UTC", "year, month, day, hour, minute, second, ms"]]);
    add("String.", [["fromCharCode", "...codes"], ["raw", "strings, ...values"]]);
    add(".", [
      ["push unshift concat", "...items"], ["pop shift reverse trim toUpperCase toLowerCase keys values entries clear preventDefault", ""],
      ["slice substring", "start, end"], ["splice", "start, deleteCount, ...items"],
      ["map filter forEach find findIndex some every flatMap findLast", "callback(item, index, array)"],
      ["reduce", "callback(acc, item, index, array), initialValue"], ["includes indexOf lastIndexOf", "value, fromIndex"],
      ["join", 'separator = ","'], ["sort", "compareFn(a, b)"], ["flat", "depth = 1"], ["fill", "value, start, end"], ["at", "index"],
      ["split", "separator, limit"], ["padStart padEnd", "targetLength, padString"], ["repeat", "count"],
      ["replace replaceAll", "pattern, replacement"], ["startsWith endsWith", "search, position"], ["charAt charCodeAt", "index"],
      ["toString", "radix"], ["toFixed", "digits"], ["has get delete", "key"], ["set", "key, value"], ["add", "value"],
      ["then", "onFulfilled, onRejected"], ["catch", "onRejected"], ["finally", "onFinally"],
      ["bind call", "thisArg, ...args"], ["apply", "thisArg, args"], ["test exec match", "string"],
      ["localeCompare", "other"], ["toLocaleString", "locales, options"]
    ]);
  })();

  const SNIPS = [
    ["for", "for loop", "for (let i = 0; i < $0; i++) {\n  \n}"],
    ["forof", "for...of loop", "for (const item of $0) {\n  \n}"],
    ["while", "while loop", "while ($0) {\n  \n}"],
    ["loop", "game loop", "while (true) {\n  $0\n  await sleep(100);\n}"],
    ["if", "if block", "if ($0) {\n  \n}"],
    ["ifelse", "if / else", "if ($0) {\n  \n} else {\n  \n}"],
    ["func", "function", "function $0() {\n  \n}"],
    ["afunc", "async function", "async function $0() {\n  \n}"],
    ["arrow", "arrow function", "const $0 = () => {\n  \n};"],
    ["trycatch", "try / catch", "try {\n  $0\n} catch (err) {\n  println(err.message);\n}"],
    ["onKey", "key handler", "onKey((e) => {\n  if (e.actions.onPressed) {\n    $0\n  }\n});"]
  ];
  const GLOBALS = [
    ...[...KW, ...LIT].map(m => ({ m, k: "k" })),
    ...BIF.map(x => { const m = x.replace("()", ""); return { m, k: "f", fn: 1, p: SIG[m] }; }),
    ...BIO.map(m => ({ m, k: "v" })),
    ...SNIPS.map(([m, d, t]) => ({ m, d, t, k: "s" }))
  ];
  const mkMem = (list, obj) => W(list).map(x => {
    if (!x.endsWith("()")) return { m: x, k: "v" };
    const m = x.slice(0, -2);
    return { m, k: "f", fn: 1, p: (obj ? SIG[obj + "." + m] : undefined) ?? SIG["." + m] };
  });
  const MEMI = {}; for (const o in MEM) MEMI[o] = mkMem(MEM[o], o);
  const GENI = mkMem(GEN);

  let CW = 8.4, GW = 0, digits = 2;
  let lines = [""], cur = { l: 0, c: 0 }, anc = { l: 0, c: 0 }, want = -1;
  let extra = [], diagPairs = new Map(), diagUnused = new Set(), diagDead = [], diagStarts = [];
  let toks = [[]], ranges = new Map(), folded = new Set(), vis = [0], vmap = [0], lastOn = null;
  let defs = new Map(), sigHide = false;
  let dirty = true, undoS = [], redoS = [], lastKind = "", lastT = 0, comp = false, dragging = false, draggingExtra = -1;
  let onRun = () => {}, onChange = () => {};
  let items = [], sel = 0, popOpen = false, plen = 0;

  const esc = s => s.replace(/[&<>]/g, c => c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;");
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const isW = ch => /[\w$]/.test(ch || "");
  const hasSel = () => cur.l !== anc.l || cur.c !== anc.c;
  const before = (a, b) => a.l < b.l || (a.l === b.l && a.c <= b.c);
  const order = () => before(anc, cur) ? [anc, cur] : [cur, anc];
  const selText = () => {
    const [a, b] = order();
    return a.l === b.l ? lines[a.l].slice(a.c, b.c)
      : [lines[a.l].slice(a.c), ...lines.slice(a.l + 1, b.l), lines[b.l].slice(0, b.c)].join("\n");
  };
  const extraHasSel = p => !!p.a && (p.a.l !== p.l || p.a.c !== p.c);
  const extraSelText = p => {
    if (!extraHasSel(p)) return "";
    const a = offsetAt(p.a), b = offsetAt(p);
    const text = source(); return text.slice(Math.min(a, b), Math.max(a, b));
  };
  const norm = t => t.replace(/\r\n?/g, "\n").replace(/\t/g, "  ");
  const source = () => lines.join("\n");
  const offsetAt = p => lines.slice(0, p.l).reduce((n, s) => n + s.length + 1, 0) + p.c;
  function pointAt(n, text = source()) {
    n = clamp(n, 0, text.length);
    const part = text.slice(0, n), l = (part.match(/\n/g) || []).length, i = part.lastIndexOf("\n");
    return { l, c: n - (i + 1) };
  }

  
  const NUM = /(?:0[xX][\da-fA-F_]+|0[bBoO][\d_]+|(?:\d[\d_]*\.?[\d_]*|\.\d[\d_]*)(?:[eE][+-]?\d+)?)n?/y;
  const ID = /[A-Za-z_$][\w$]*/y;
  const MATCH = { "(": ")", "[": "]", "{": "}" };
  const scanTpl = (s, j) => { while (j < s.length) { if (s[j] === "\\") j += 2; else if (s[j] === "`") return j + 1; else j++; } return -1; };

  function tokenize() {
    toks = []; ranges = new Map();
    const stack = []; let state = 0, comStart = -1;
    const addRange = (start, from, to) => { const p = ranges.get(start); if (!p || to > p.to) ranges.set(start, { from, to }); };
    for (let l = 0; l < lines.length; l++) {
      const s = lines[l], t = []; let i = 0;
      while (i < s.length) {
        if (state === 1) {
          const j = s.indexOf("*/", i), e = j < 0 ? s.length : j + 2;
          t.push({ s: i, e, k: "com" }); i = e;
          if (j >= 0) { state = 0; if (l > comStart) addRange(comStart, comStart + 1, l); }
          continue;
        }
        if (state === 2) {
          const e = scanTpl(s, i);
          if (e < 0) { t.push({ s: i, e: s.length, k: "str" }); i = s.length; }
          else { t.push({ s: i, e, k: "str" }); state = 0; i = e; }
          continue;
        }
        const ch = s[i];
        if (ch === " ") { i++; continue; }
        if (ch === "/" && s[i + 1] === "/") { t.push({ s: i, e: s.length, k: "com" }); i = s.length; continue; }
        if (ch === "/" && s[i + 1] === "*") {
          const j = s.indexOf("*/", i + 2);
          if (j < 0) { t.push({ s: i, e: s.length, k: "com" }); state = 1; comStart = l; i = s.length; }
          else { t.push({ s: i, e: j + 2, k: "com" }); i = j + 2; }
          continue;
        }
        if (ch === "'" || ch === '"') {
          let j = i + 1;
          while (j < s.length && s[j] !== ch) { if (s[j] === "\\") j++; j++; }
          j = Math.min(j + 1, s.length);
          t.push({ s: i, e: j, k: "str" }); i = j; continue;
        }
        if (ch === "`") {
          const e = scanTpl(s, i + 1);
          if (e < 0) { t.push({ s: i, e: s.length, k: "str" }); state = 2; i = s.length; }
          else { t.push({ s: i, e, k: "str" }); i = e; }
          continue;
        }
        if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(s[i + 1] || ""))) {
          NUM.lastIndex = i; const m = NUM.exec(s);
          if (m && m[0]) { t.push({ s: i, e: i + m[0].length, k: "num" }); i += m[0].length; continue; }
        }
        ID.lastIndex = i;
        const m = ID.exec(s);
        if (m) {
          const w = m[0], e = i + w.length;
          let k = KW.has(w) ? "kw" : LIT.has(w) ? "lit" : BI.has(w) ? "bi" : /^\s*\(/.test(s.slice(e)) ? "fnc" : "";
          if (k) t.push({ s: i, e, k });
          i = e; continue;
        }
        if (ch in MATCH) stack.push({ ch, l });
        else if (ch === ")" || ch === "]" || ch === "}") {
          const o = stack.pop();
          if (o && MATCH[o.ch] === ch && l - o.l >= 2) addRange(o.l, o.l + 1, l - 1);
        }
        i++;
      }
      toks.push(t);
    }
    defs = parseDefs();
    analyseDiagnostics();
  }
  function analyseDiagnostics() {
    const text = source(), protectedChars = new Uint8Array(text.length);
    diagPairs = new Map(); diagUnused = new Set(); diagDead = []; diagStarts = [];
    let total = 0;
    for (let l = 0; l < lines.length; l++) {
      diagStarts[l] = total;
      for (const t of (toks[l] || [])) if (t.k === "str" || t.k === "com") {
        for (let p = total + t.s; p < Math.min(text.length, total + t.e); p++) protectedChars[p] = 1;
      }
      total += lines[l].length + 1;
    }
    const ts = [];
    for (let i = 0; i < text.length;) {
      if (protectedChars[i] || /\s/.test(text[i])) { i++; continue; }
      const s = i, c = text[i];
      if (/[A-Za-z_$]/.test(c)) {
        i++; while (i < text.length && !protectedChars[i] && /[\w$]/.test(text[i])) i++;
        ts.push({ v: text.slice(s, i), s, e: i, type: "id" });
      } else { ts.push({ v: c, s, e: ++i, type: "op" }); }
    }
    const stack = [], matchOpen = { "(": ")", "[": "]", "{": "}" };
    for (const t of ts) {
      if (matchOpen[t.v]) stack.push(t);
      else if ([")", "]", "}"].includes(t.v)) {
        const o = stack[stack.length - 1];
        if (o && matchOpen[o.v] === t.v) { stack.pop(); diagPairs.set(o.s, t.s); diagPairs.set(t.s, o.s); }
      }
    }
    const decl = [];
    for (let i = 0; i < ts.length; i++) {
      if (["let", "const", "var", "class", "function"].includes(ts[i].v)) {
        let j = i + 1;
        if (ts[i].v === "function" && ts[j] && ts[j].v === "*") j++;
        if (ts[j] && ts[j].type === "id" && !["if", "for", "while", "switch", "return", "throw"].includes(ts[j].v)) decl.push(ts[j]);
      }
    }
    const counts = new Map();
    for (const t of ts) if (t.type === "id") counts.set(t.v, (counts.get(t.v) || 0) + 1);
    for (const d of decl) if ((counts.get(d.v) || 0) <= 1) for (let p = d.s; p < d.e; p++) diagUnused.add(p);
    const blockPairs = [...diagPairs].filter(([a, b]) => a < b && text[a] === "{").map(([s, e]) => ({ s, e }));
    const isDirectConditional = i => {
      const prev = ts[i - 1]; if (!prev) return false;
      if (prev.v === ")") {
        const open = diagPairs.get(prev.s), oi = ts.findIndex(x => x.s === open), before = ts[oi - 1];
        if (before && ["if", "while", "for", "with", "catch", "switch"].includes(before.v)) return true;
      }
      return ["else", "do", "?", ":"].includes(prev.v);
    };
    for (let i = 0; i < ts.length; i++) {
      const t = ts[i]; if (!["return", "throw"].includes(t.v) || isDirectConditional(i)) continue;
      const block = blockPairs.filter(b => b.s < t.s && b.e > t.s).sort((a, b) => (a.e - a.s) - (b.e - b.s))[0];
      let end = block ? block.e : text.length;
      const nextSemi = ts.find(q => q.s >= t.e && q.v === ";"), nl = text.indexOf("\n", t.e);
      const begin = nextSemi && (nl < 0 || nextSemi.s < nl) ? nextSemi.e : nl >= 0 ? nl + 1 : t.e;
      if (begin < end) diagDead.push({ s: begin, e: end });
    }
  }
  function pointForOffset(n) { return pointAt(n, source()); }
  function isDeadOffset(n) { return diagDead.some(r => n >= r.s && n < r.e); }
  function makeSearchRegex(globalFlag = true) {
    const q = findInput.value;
    if (!q) return null;
    const pattern = findRegex.checked ? q : q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(pattern, (globalFlag ? "g" : "") + (findCase.checked ? "" : "i"));
  }
  function rebuildFindMatches(announce = false) {
    const text = source(), q = findInput.value;
    findMatches = [];
    findInput.classList.remove("invalid"); findStatus.classList.remove("error");
    if (!q || searchBar.hidden) {
      activeFindIndex = -1;
      if (announce && !searchBar.hidden) findStatus.textContent = "Enter text to find";
      return findMatches;
    }
    let re;
    try { re = makeSearchRegex(true); }
    catch (err) {
      activeFindIndex = -1;
      findInput.classList.add("invalid"); findStatus.classList.add("error");
      findStatus.textContent = "Invalid regex: " + (err && err.message ? err.message : "pattern");
      return findMatches;
    }
    let m;
    while ((m = re.exec(text)) !== null) {
      findMatches.push({ start: m.index, end: m.index + m[0].length, value: m[0] });
      if (!m[0].length) {
        if (re.lastIndex >= text.length) break;
        re.lastIndex++;
      }
    }
    if (activeFindIndex >= findMatches.length) activeFindIndex = -1;
    if (announce) {
      if (!findMatches.length) {
        findStatus.textContent = "No matches";
      } else if (activeFindIndex >= 0) {
        const p = pointAt(findMatches[activeFindIndex].start, text);
        findStatus.textContent = "Match " + (activeFindIndex + 1) + " of " + findMatches.length + " · line " + (p.l + 1);
      } else {
        findStatus.textContent = findMatches.length + " match" + (findMatches.length === 1 ? "" : "es");
      }
    }
    return findMatches;
  }
  function lowerFindIndex(offset) {
    let lo = 0, hi = findMatches.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (findMatches[mid].end <= offset) lo = mid + 1; else hi = mid; }
    return lo;
  }
  function lineHtml(l) {
    const s = lines[l], start = diagStarts[l] || 0, ts = toks[l] || [];
    let html = "", lastClass = null, chunk = "", ti = 0;
    let fi = lowerFindIndex(start);
    const flush = () => {
      if (!chunk) return;
      const out = esc(chunk);
      html += lastClass ? '<span class="' + lastClass + '">' + out + '</span>' : out;
      chunk = "";
    };
    for (let i = 0; i < s.length; i++) {
      while (ti < ts.length && ts[ti].e <= i) ti++;
      const token = ts[ti], cls = [];
      if (token && i >= token.s && i < token.e) cls.push(token.k);
      const global = start + i;
      while (fi < findMatches.length && findMatches[fi].end <= global) fi++;
      if (fi < findMatches.length && global >= findMatches[fi].start && global < findMatches[fi].end) {
        cls.push(fi === activeFindIndex ? "search-current" : "search-hit");
      }
      if (diagUnused.has(global)) cls.push("unused");
      if (isDeadOffset(global)) cls.push("deadspan");
      const mate = diagPairs.get(global);
      const key = cls.join(" ");
      if (lastClass !== key) { flush(); lastClass = key; }
      chunk += s[i];
    }
    flush();
    return html || " ";
  }
  const inStrCom = (l, c) => (toks[l] || []).some(t => c >= t.s && c < t.e && (t.k === "str" || t.k === "com"));

  
  const CTL = new Set(W("if for while switch catch function return with"));
  function parseDefs() {
    const out = new Map(), text = lines.join("\n");
    if (text.length > 300000) return out;
    const starts = []; let o = 0;
    for (const s of lines) { starts.push(o); o += s.length + 1; }
    const at = idx => {
      let lo = 0, hi = starts.length - 1;
      while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= idx) lo = mid; else hi = mid - 1; }
      return [lo, idx - starts[lo]];
    };
    const bad = idx => { const [l, c] = at(idx); return inStrCom(l, c); };
    const grab = open => {                              
      let d = 0, q = "";
      for (let i = open; i < text.length && i < open + 800; i++) {
        const ch = text[i];
        if (q) { if (ch === "\\") i++; else if (ch === q) q = ""; continue; }
        if (ch === '"' || ch === "'" || ch === "`") q = ch;
        else if (ch === "(" || ch === "[" || ch === "{") d++;
        else if (ch === ")" || ch === "]" || ch === "}") {
          d--;
          if (d === 0) return { p: text.slice(open + 1, i).replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, " ").trim(), end: i + 1 };
        }
      }
      return null;
    };
    const run = (re, fn) => {
      re.lastIndex = 0; let x;
      while ((x = re.exec(text))) { if (x[0].length === 0) { re.lastIndex++; continue; } if (!bad(x.index + x[0].length - 1)) fn(x); }
    };
    const direct = x => { const r = grab(x.index + x[0].length - 1); if (r) out.set(x[1], r.p); };
    
    run(/\bfunction\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(/g, direct);
    
    run(/([A-Za-z_$][\w$]*)\s*[=:]\s*(?:async\s+)?function\s*\*?\s*[\w$]*\s*\(/g, direct);
    
    run(/([A-Za-z_$][\w$]*)\s*[=:]\s*(?:async\s*)?\(/g, x => {
      const r = grab(x.index + x[0].length - 1);
      if (r && /^\s*=>/.test(text.slice(r.end, r.end + 40))) out.set(x[1], r.p);
    });
    
    run(/([A-Za-z_$][\w$]*)\s*[=:]\s*(?:async\s+)?([A-Za-z_$][\w$]*)\s*=>/g, x => out.set(x[1], x[2]));
    
    run(/^[ \t]*(?:(?:async|static|get|set)\s+)*\*?[ \t]*([A-Za-z_$][\w$]*)[ \t]*\(/gm, x => {
      if (CTL.has(x[1])) return;
      const r = grab(x.index + x[0].length - 1);
      if (r && /^\s*\{/.test(text.slice(r.end, r.end + 40))) out.set(x[1], r.p);
    });
    return out;
  }

  
  function callCtx() {
    
    const stack = []; let last = "";
    for (let l = 0; l <= cur.l; l++) {
      const s = lines[l], end = l === cur.l ? cur.c : s.length, t = toks[l] || []; let ti = 0;
      for (let i = 0; i < end; i++) {
        while (ti < t.length && t[ti].e <= i) ti++;
        const k = ti < t.length && i >= t[ti].s ? t[ti] : null;
        if (k && (k.k === "str" || k.k === "com")) {
          if (k.k === "com") { if (l === cur.l && end <= k.e) return null; }   
          else last = "s";
          i = k.e - 1; continue;
        }
        const c = s[i];
        if (c === " ") continue;
        if (c === "(" || c === "[" || c === "{") stack.push({ ch: c, l, c: i, n: 0, blk: c === "{" && !",([:=?|&".includes(last) });
        else if (c === ")" || c === "]" || c === "}") stack.pop();
        else if (c === "," && stack.length && stack[stack.length - 1].ch === "(") stack[stack.length - 1].n++;
        last = c;
      }
    }
    for (let j = stack.length - 1; j >= 0; j--) {
      const e = stack[j];
      if (e.ch === "{" && e.blk) return null;               
      if (e.ch !== "(") continue;
      const pre = lines[e.l].slice(0, e.c);
      if (/\bfunction\s*\*?\s*[\w$]*\s*$/.test(pre)) return null;   
      const m = /(?:([\w$]+)\s*\??\.\s*)?([\w$]+)\s*$/.exec(pre);
      if (!m) return null;
      if (!m[1] && KW.has(m[2])) return null;               
      return { obj: m[1] || "", name: m[2], l: e.l, nc: m.index, n: e.n };
    }
    return null;
  }
  function splitTop(p) {
    const out = []; let d = 0, q = "", acc = "";
    for (const ch of p) {
      if (q) { acc += ch; if (ch === q) q = ""; continue; }
      if (ch === '"' || ch === "'" || ch === "`") { q = ch; acc += ch; }
      else if ("([{".includes(ch)) { d++; acc += ch; }
      else if (")]}".includes(ch)) { d--; acc += ch; }
      else if (ch === "," && d === 0) { out.push(acc.trim()); acc = ""; }
      else acc += ch;
    }
    if (acc.trim()) out.push(acc.trim());
    return out;
  }
  function sigFor(ctx) {
    const { obj, name } = ctx;
    if (obj) return SIG[obj + "." + name] ?? defs.get(name) ?? SIG["." + name];
    return defs.has(name) ? defs.get(name) : SIG[name];
  }
  function updateSig() {
    sigEl.style.display = "none";
    if (sigHide || dirty || hasSel()) return;
    const ctx = callCtx();
    if (!ctx) return;
    const p = sigFor(ctx);
    if (p === undefined) return;
    const ps = splitTop(p);
    const act = ctx.n < ps.length ? ctx.n : (ps.length && ps[ps.length - 1].startsWith("...") ? ps.length - 1 : -1);
    sigEl.innerHTML = '<span class="sn">' + esc((ctx.obj ? ctx.obj + "." : "") + ctx.name) + "</span>(" +
      ps.map((x, i) => '<span class="' + (i === act ? "sa" : "sp") + '">' + esc(x) + "</span>").join(", ") + ")" +
      (ps.length ? "" : ' <span class="sp">no parameters</span>');
    sigEl.style.display = "block";
    const w = sigEl.offsetWidth, h = sigEl.offsetHeight;
    let row = visible(ctx.l) ? vmap[ctx.l] : vmap[cur.l];
    if (row * LH < ed.scrollTop) row = vmap[cur.l];
    let top = row * LH - h - 2;
    if (top < ed.scrollTop) {                                
      if (popOpen) { sigEl.style.display = "none"; return; }
      top = (row + 1) * LH + 2;
    }
    let left = GW + PAD + ctx.nc * CW;
    left = Math.min(left, ed.scrollLeft + ed.clientWidth - w - 6);
    left = Math.max(left, ed.scrollLeft + GW + 2);
    sigEl.style.left = left + "px"; sigEl.style.top = top + "px";
  }

  
  function measure() {
    if (!box.offsetParent) return false;
    const p = document.createElement("span");
    p.style.cssText = "position:absolute;visibility:hidden;white-space:pre"; p.textContent = "M".repeat(50);
    box.appendChild(p); const w = p.getBoundingClientRect().width / 50; box.removeChild(p);
    if (w) CW = w; return !!w;
  }
  function render() {
    if (!measure()) return;
    rebuildFindMatches(false);
    for (const f of [...folded]) if (!ranges.has(f)) folded.delete(f);
    vis = []; vmap = new Array(lines.length);
    for (let l = 0; l < lines.length;) {
      vis.push(l);
      const to = folded.has(l) ? ranges.get(l).to : l;
      for (let j = l; j <= to; j++) vmap[j] = vis.length - 1;
      l = to + 1;
    }
    digits = Math.max(2, String(lines.length).length); GW = (digits + 3) * CW;
    box.style.setProperty("--gw", GW + "px");
    let h = "";
    for (const l of vis) {
      const mark = ranges.has(l) ? (folded.has(l) ? "▸" : "▾") : " ";
      const lineStart = diagStarts[l] || 0, lineEnd = lineStart + lines[l].length;
      const lineDead = diagDead.some(r => r.s < lineEnd && r.e > lineStart);
      h += '<div class="ln' + (lineDead ? ' deadline' : '') + '"><span class="gut">' + String(l + 1).padStart(digits) + " " + mark + ' </span><span class="code">' +
        lineHtml(l) + (folded.has(l) ? '<span class="bdg">⋯</span>' : "") + "</span></div>";
    }
    rowsEl.innerHTML = h; lastOn = null;
  }
  const visible = l => vis[vmap[l]] === l;
  function overlays() {
    const x = GW + PAD + cur.c * CW, y = vmap[cur.l] * LH;
    curEl.style.left = x + "px"; curEl.style.top = y + "px";
    curEl.style.animation = "none"; void curEl.offsetWidth; curEl.style.animation = "";
    clEl.style.top = y + "px"; clEl.style.display = hasSel() ? "none" : "block";
    taEl.style.left = x + "px"; taEl.style.top = y + "px";
    let h = "";
    if (hasSel()) {
      const [a, b] = order();
      for (let l = a.l; l <= b.l; l++) {
        if (!visible(l)) continue;
        const s = l === a.l ? a.c : 0, e = l === b.l ? b.c : lines[l].length + 1;
        if (e <= s && l === b.l) continue;
        h += '<div style="left:' + (GW + PAD + s * CW) + "px;top:" + vmap[l] * LH + "px;width:" + (e - s) * CW + 'px"></div>';
      }
    }
    selBox.innerHTML = h;
    let multiHtml = "";
    for (const p of extra) {
      if (p.a && (p.a.l !== p.l || p.a.c !== p.c)) {
        const xPoint = { l: p.l, c: p.c }, [a, b] = before(p.a, xPoint) ? [p.a, xPoint] : [xPoint, p.a];
        for (let l = a.l; l <= b.l; l++) {
          if (!visible(l)) continue;
          const from = l === a.l ? a.c : 0, to = l === b.l ? b.c : lines[l].length + 1;
          if (to > from) multiHtml += '<div class="mcselection" style="left:' + (GW + PAD + from * CW) + 'px;top:' + (vmap[l] * LH) + 'px;width:' + ((to - from) * CW) + 'px"></div>';
        }
      }
      if (visible(p.l)) multiHtml += '<div class="mcursor" style="left:' + (GW + PAD + p.c * CW) + 'px;top:' + (vmap[p.l] * LH) + 'px"></div>';
    }
    multiEl.innerHTML = multiHtml;
    const caretOffset = offsetAt(cur), candidates = [caretOffset, caretOffset - 1];
    const bracketAt = candidates.find(p => diagPairs.has(p));
    let pairHtml = "";
    if (bracketAt !== undefined) {
      const mate = diagPairs.get(bracketAt);
      for (const off of [bracketAt, mate]) {
        const p = pointForOffset(off);
        if (p.l >= 0 && p.l < vmap.length && visible(p.l)) pairHtml += '<div class="pairhighlight" style="left:' + (GW + PAD + p.c * CW) + 'px;top:' + (vmap[p.l] * LH) + 'px;width:' + CW + 'px"></div>';
      }
    }
    pairEl.innerHTML = pairHtml;
    if (lastOn) lastOn.classList.remove("on");
    const r = rowsEl.children[vmap[cur.l]];
    if (r) { lastOn = r.firstChild; lastOn.classList.add("on"); }
    posEl.textContent = "Ln " + (cur.l + 1) + ", Col " + (cur.c + 1) + "  |  " + lines.length + " lines";
    
    if (y < ed.scrollTop) ed.scrollTop = y;
    else if (y + LH > ed.scrollTop + ed.clientHeight) ed.scrollTop = y + LH - ed.clientHeight;
    if (x - ed.scrollLeft < GW + PAD) ed.scrollLeft = Math.max(0, x - GW - PAD - 20);
    else if (x - ed.scrollLeft + CW > ed.clientWidth) ed.scrollLeft = x + CW - ed.clientWidth + 20;
    
    if (document.activeElement === taEl) {
      const t = hasSel() ? selText() : "";
      taEl.value = t.length < 100000 ? t : ""; if (taEl.value) taEl.select();
    }
    updateSig();
  }
  function sync(full) {
    if (dirty) { tokenize(); dirty = false; full = true; }
    if (full) render();
    overlays();
  }

  
  function hiddenBy(l) { for (const f of folded) { const r = ranges.get(f); if (r && l >= r.from && l <= r.to) return f; } return -1; }
  function reveal(l) { let ch = false, f; while ((f = hiddenBy(l)) >= 0) { folded.delete(f); ch = true; } return ch; }
  function foldFix() {
    let s, ch = false;
    while ((s = hiddenBy(cur.l)) >= 0) { cur = { l: s, c: lines[s].length }; ch = true; }
    if (ch) anc = { ...cur };
  }
  function toggleFold(l) {
    if (folded.has(l)) folded.delete(l); else if (ranges.has(l)) folded.add(l);
    foldFix(); sync(true);
  }
  function foldCurrent(fold) {
    let best = -1;
    for (const [s, r] of ranges) if (s <= cur.l && cur.l <= r.to + 1 && s > best && (fold ? !folded.has(s) : folded.has(s) && s === cur.l)) best = s;
    if (best >= 0) { if (fold) folded.add(best); else folded.delete(best); foldFix(); sync(true); }
  }

  
  function setSel(a, b, preserveExtra = false) {
    anc = { ...a }; cur = { ...b }; if (!preserveExtra) extra = []; want = -1; sigHide = false; closePop();
    sync(reveal(cur.l));
  }
  function moveTo(l, c, ext, keepWant, preserveExtra = false) {
    l = clamp(l, 0, lines.length - 1); c = clamp(c, 0, lines[l].length);
    setSel(ext ? anc : { l, c }, { l, c }, preserveExtra);
    if (keepWant !== undefined) want = keepWant;
  }
  function nextPoint(p, key, ctrl) {
    const l = p.l, c = p.c;
    if (key === "ArrowLeft") return ctrl ? wordLeft(l, c) : c > 0 ? { l, c: c - 1 } : l > 0 ? { l: l - 1, c: lines[l - 1].length } : { l, c };
    if (key === "ArrowRight") return ctrl ? wordRight(l, c) : c < lines[l].length ? { l, c: c + 1 } : l < lines.length - 1 ? { l: l + 1, c: 0 } : { l, c };
    if (key === "Home") return { l: ctrl ? 0 : l, c: ctrl ? 0 : (c !== /^ */.exec(lines[l])[0].length ? /^ */.exec(lines[l])[0].length : 0) };
    if (key === "End") return ctrl ? { l: lines.length - 1, c: lines[lines.length - 1].length } : { l, c: lines[l].length };
    if (["ArrowUp", "ArrowDown", "PageUp", "PageDown"].includes(key)) {
      const amount = key.startsWith("Page") ? Math.max(1, Math.floor(ed.clientHeight / LH) - 1) : 1;
      const idx = (vmap[l] || 0) + (key.endsWith("Up") ? -amount : amount);
      if (idx < 0) return { l: vis[0], c: Math.min(c, lines[vis[0]].length) };
      if (idx >= vis.length) { const last = vis[vis.length - 1]; return { l: last, c: Math.min(c, lines[last].length) }; }
      const targetL = vis[idx]; return { l: targetL, c: Math.min(c, lines[targetL].length) };
    }
    return { l, c };
  }
  function moveExtraCursors(key, ctrl, shift) {
    for (const p of extra) {
      const old = { l: p.l, c: p.c };
      if (shift && !p.a) p.a = { ...old };
      if (!shift) p.a = null;
      const n = nextPoint(old, key, ctrl);
      p.l = n.l; p.c = n.c;
    }
  }
  function wordLeft(l, c) {
    const s = lines[l];
    if (c === 0) return l > 0 ? { l: l - 1, c: lines[l - 1].length } : { l, c };
    while (c > 0 && s[c - 1] === " ") c--;
    if (c > 0) { const w = isW(s[c - 1]); while (c > 0 && s[c - 1] !== " " && isW(s[c - 1]) === w) c--; }
    return { l, c };
  }
  function wordRight(l, c) {
    const s = lines[l];
    if (c >= s.length) return l < lines.length - 1 ? { l: l + 1, c: 0 } : { l, c };
    while (c < s.length && s[c] === " ") c++;
    if (c < s.length) { const w = isW(s[c]); while (c < s.length && s[c] !== " " && isW(s[c]) === w) c++; }
    return { l, c };
  }

  
  const snapshot = () => ({ lines: lines.slice(), cur: { ...cur }, anc: { ...anc }, extra: extra.map(p => ({ ...p, a: p.a ? { ...p.a } : null })), folded: new Set(folded) });
  function snap(kind) {
    const now = Date.now();
    if (kind === "type" && lastKind === "type" && now - lastT < 800) { lastT = now; return; }
    undoS.push(snapshot()); if (undoS.length > 300) undoS.shift();
    redoS = []; lastKind = kind; lastT = now;
  }
  function restore(s) {
    lines = s.lines.slice(); cur = { ...s.cur }; anc = { ...s.anc }; extra = (s.extra || []).map(p => ({ ...p, a: p.a ? { ...p.a } : null })); folded = new Set(s.folded);
    dirty = true; lastKind = ""; want = -1; closePop(); sync(true); onChange();
  }
  const undo = () => { if (undoS.length) { redoS.push(snapshot()); restore(undoS.pop()); } };
  const redo = () => { if (redoS.length) { undoS.push(snapshot()); restore(redoS.pop()); } };

  function replaceRange(sl, sc, el, ec, text) {
    const pre = lines[sl].slice(0, sc), post = lines[el].slice(ec), parts = text.split("\n");
    const nl = parts.length === 1 ? [pre + parts[0] + post]
      : [pre + parts[0], ...parts.slice(1, -1), parts[parts.length - 1] + post];
    lines.splice(sl, el - sl + 1, ...nl);
    const delta = parts.length - 1 - (el - sl);
    if (delta !== 0 || el !== sl) {
      const nf = new Set();
      for (const f of folded) { if (f <= sl) nf.add(f); else if (f > el) nf.add(f + delta); }
      folded = nf;
    }
    cur = { l: sl + parts.length - 1, c: (parts.length === 1 ? sc : 0) + parts[parts.length - 1].length };
    anc = { ...cur };
  }
  function replaceSel(text) { const [a, b] = order(); replaceRange(a.l, a.c, b.l, b.c, text); }
  function commit() { want = -1; sigHide = false; dirty = true; reveal(cur.l); sync(true); onChange(); }

  const OPEN = { "(": ")", "[": "]", "{": "}", '"': '"', "'": "'", "`": "`" };
  const CLOSE = new Set([")", "]", "}", '"', "'", "`"]);

  function typeChar(ch) {
    const s = lines[cur.l], nx = s[cur.c] || "", pv = s[cur.c - 1] || "";
    if (hasSel() && OPEN[ch]) {
      snap("wrap"); const t = selText(), [a] = order();
      replaceSel(ch + t + OPEN[ch]);
      anc = { l: a.l, c: a.c + 1 }; cur = { l: cur.l, c: cur.c - 1 };
      commit(); closePop(); return;
    }
    if (!hasSel() && CLOSE.has(ch) && nx === ch) { cur.c++; anc = { ...cur }; sync(); closePop(); return; }
    snap("type");
    if (OPEN[ch] && !hasSel()) {
      const q = ch === OPEN[ch];
      const ok = q ? !isW(pv) && !isW(nx) && nx !== ch && pv !== "\\" : (nx === "" || /[\s)\]};,]/.test(nx));
      if (ok) { replaceSel(ch + OPEN[ch]); cur.c--; anc = { ...cur }; commit(); closePop(); return; }
    }
    if ((ch === "}" || ch === ")" || ch === "]") && !hasSel() && cur.c >= 2 && /^ +$/.test(s.slice(0, cur.c))) {
      replaceRange(cur.l, cur.c - 2, cur.l, cur.c, ch); commit(); closePop(); return;
    }
    replaceSel(ch); commit();
    if (isW(ch) || ch === ".") suggest(); else closePop();
  }
  function enter() {
    if (extra.length) return applyMulti("\n");
    snap("enter");
    if (hasSel()) replaceSel("");
    const s = lines[cur.l], pre = s.slice(0, cur.c), post = s.slice(cur.c);
    const ind = /^ */.exec(pre)[0], open = /[{\[(]$/.test(pre.trimEnd());
    if (open && /^\s*[}\])]/.test(post)) {
      replaceRange(cur.l, cur.c, cur.l, cur.c, "\n" + ind + "  \n" + ind);
      cur = { l: cur.l - 1, c: ind.length + 2 }; anc = { ...cur };
    } else replaceRange(cur.l, cur.c, cur.l, cur.c, "\n" + ind + (open ? "  " : ""));
    commit(); closePop();
  }
  function backspace(word) {
    if (extra.length) return applyMulti("", -1, word);
    if (hasSel()) { snap("del"); replaceSel(""); commit(); return; }
    const { l, c } = cur, s = lines[l];
    if (c === 0) { if (l === 0) return; snap("del"); replaceRange(l - 1, lines[l - 1].length, l, 0, ""); }
    else if (word) { const p = wordLeft(l, c); snap("del"); replaceRange(p.l, p.c, l, c, ""); }
    else {
      snap("type");
      if (OPEN[s[c - 1]] && OPEN[s[c - 1]] === s[c]) replaceRange(l, c - 1, l, c + 1, "");
      else if (c >= 2 && /^ +$/.test(s.slice(0, c))) replaceRange(l, c - (c % 2 || 2), l, c, "");
      else replaceRange(l, c - 1, l, c, "");
    }
    commit(); if (popOpen) suggest();
  }
  function del(word) {
    if (extra.length) return applyMulti("", 1, word);
    if (hasSel()) { snap("del"); replaceSel(""); commit(); return; }
    const { l, c } = cur;
    if (c < lines[l].length) { const p = word ? wordRight(l, c) : { l, c: c + 1 }; snap("del"); replaceRange(l, c, p.l, p.c, ""); }
    else if (l < lines.length - 1) { snap("del"); replaceRange(l, c, l + 1, 0, ""); }
    else return;
    commit(); closePop();
  }
  function lineRange() { const [a, b] = order(); let e = b.l; if (hasSel() && b.c === 0 && b.l > a.l) e--; return [a.l, e]; }
  const adj = (l, d) => { for (const p of [cur, anc]) if (p.l === l) p.c = Math.max(0, p.c + d); };
  function indent(dir) {
    snap("indent"); const [s, e] = lineRange();
    for (let l = s; l <= e; l++) {
      if (dir > 0) { if (lines[l].length || s === e) { lines[l] = "  " + lines[l]; adj(l, 2); } }
      else { const m = /^ {1,2}/.exec(lines[l]); if (m) { lines[l] = lines[l].slice(m[0].length); adj(l, -m[0].length); } }
    }
    commit(); closePop();
  }
  function toggleComment() {
    const [s, e] = lineRange(), ls = [];
    for (let l = s; l <= e; l++) if (lines[l].trim()) ls.push(l);
    if (!ls.length) return;
    snap("comment");
    if (ls.every(l => /^\s*\/\//.test(lines[l]))) {
      for (const l of ls) { const m = /^(\s*)\/\/ ?/.exec(lines[l]); lines[l] = m[1] + lines[l].slice(m[0].length); adj(l, -(m[0].length - m[1].length)); }
    } else {
      const ind = Math.min(...ls.map(l => /^ */.exec(lines[l])[0].length));
      for (const l of ls) { lines[l] = lines[l].slice(0, ind) + "// " + lines[l].slice(ind); adj(l, 3); }
    }
    commit(); closePop();
  }
  function applyMulti(insert, delDir = 0, word = false) {
    const text = source();
    const points = [{ p: { ...cur }, a: hasSel() ? { ...anc } : null, primary: true },
      ...extra.map(p => ({ p: { l: p.l, c: p.c }, a: p.a ? { ...p.a } : null, primary: false }))];
    const seen = new Set(), ops = [];
    for (const item of points) {
      const at = offsetAt(item.p), anchorAt = item.a ? offsetAt(item.a) : at;
      const key = Math.min(at, anchorAt) + ":" + Math.max(at, anchorAt);
      if (seen.has(key)) continue; seen.add(key);
      let a = Math.min(at, anchorAt), b = Math.max(at, anchorAt), rep = insert;
      if (a === b && delDir < 0) { a = word ? offsetAt(wordLeft(item.p.l, item.p.c)) : Math.max(0, at - 1); b = at; rep = ""; }
      else if (a === b && delDir > 0) { b = word ? offsetAt(wordRight(item.p.l, item.p.c)) : Math.min(text.length, at + 1); a = at; rep = ""; }
      ops.push({ a, b, rep, primary: item.primary, at });
    }
    if (!ops.length) return;
    
    const ordered = ops.slice().sort((a, b) => a.a - b.a || a.b - b.b);
    const valid = [];
    for (const op of ordered) {
      const prev = valid[valid.length - 1];
      if (prev && (op.a < prev.b || (op.a === prev.a && op.b === prev.b))) {
        if (op.primary) { valid[valid.length - 1] = op; }
        continue;
      }
      valid.push(op);
    }
    if (!valid.length) return;
    snap("multi");
    let result = text;
    for (const op of [...valid].sort((a, b) => b.a - a.a || b.b - a.b)) result = result.slice(0, op.a) + op.rep + result.slice(op.b);
    const finalPoint = op => {
      const shift = valid.reduce((n, x) => n + (x.a < op.a ? x.rep.length - (x.b - x.a) : 0), 0);
      return pointAt(Math.max(0, Math.min(result.length, op.a + shift + op.rep.length)), result);
    };
    const primary = valid.find(o => o.primary) || valid[0];
    const p = finalPoint(primary);
    lines = result.split("\n"); cur = p; anc = { ...p };
    extra = valid.filter(o => !o.primary).map(o => finalPoint(o));
    folded.clear(); commit(); closePop();
  }
  function typeText(v) {
    v = norm(v);
    if (extra.length) return applyMulti(v);
    if (v === "\n") return enter();
    if (v.length === 1) return typeChar(v);
    snap("paste"); replaceSel(v); commit(); closePop();
  }


  
  function findMatch(back = false, returnToEditor = true) {
    rebuildFindMatches(false);
    if (findInput.classList.contains("invalid")) return;
    if (!findInput.value) { findStatus.textContent = "Enter text to find"; return; }
    if (!findMatches.length) { findStatus.textContent = "No matches"; sync(true); return; }
    const text = source();
    const pos = back ? offsetAt(order()[0]) : (hasSel() ? offsetAt(order()[1]) : offsetAt(cur));
    let idx = -1;
    if (back) {
      for (let i = findMatches.length - 1; i >= 0; i--) if (findMatches[i].start < pos) { idx = i; break; }
      if (idx < 0) idx = findMatches.length - 1;
    } else {
      const active = activeFindIndex >= 0 ? findMatches[activeFindIndex] : null;
      const activeZeroAtCaret = active && active.start === active.end && active.start === pos && !hasSel();
      if (activeZeroAtCaret) idx = (activeFindIndex + 1) % findMatches.length;
      else idx = findMatches.findIndex(m => m.start >= pos);
      if (idx < 0) idx = 0;
    }
    activeFindIndex = idx;
    const match = findMatches[idx];
    setSel(pointAt(match.start, text), pointAt(match.end, text));
    findStatus.classList.remove("error");
    findStatus.textContent = "Match " + (idx + 1) + " of " + findMatches.length + " · line " + (pointAt(match.start, text).l + 1);
    sync(true);
    if (returnToEditor) focusEditor();
  }
  function focusEditor() { try { taEl.focus({ preventScroll: true }); } catch (_) { taEl.focus(); } overlays(); }
  function showGoToLine() {
    gotoBar.hidden = false;
    gotoInput.value = String(cur.l + 1);
    gotoStatus.textContent = lines.length + " lines";
    gotoInput.focus();
    gotoInput.select();
  }
  function hideGoToLine(returnToEditor = true) {
    gotoBar.hidden = true;
    if (returnToEditor) focusEditor();
  }
  function commitGoToLine() {
    const value = gotoInput.value.trim();
    const parsed = Number.parseInt(value, 10);
    if (!/^\d+$/.test(value) || !Number.isFinite(parsed)) {
      gotoStatus.textContent = "Enter a line number";
      gotoInput.focus();
      gotoInput.select();
      return;
    }
    const line = clamp(parsed, 1, lines.length) - 1;
    const point = { l: line, c: Math.min(cur.c, lines[line].length) };
    gotoBar.hidden = true;
    setSel(point, point);
    focusEditor();
  }
  function showSearch(replace, prefillSelection = false) {
    const selected = prefillSelection && hasSel() ? selText() : "";
    const selectedRange = selected ? [offsetAt(order()[0]), offsetAt(order()[1])] : null;
    searchBar.hidden = false; replaceRow.hidden = !replace;
    if (selected && selected.length <= 10000) findInput.value = selected;
    activeFindIndex = -1;
    rebuildFindMatches(false);
    if (selectedRange && selected.length <= 10000 && findMatches.length) {
      const exact = findMatches.findIndex(m => m.start === selectedRange[0] && m.end === selectedRange[1]);
      if (exact >= 0) { activeFindIndex = exact; sync(true); }
      else findMatch(false, false);
    } else {
      rebuildFindMatches(true); sync(true);
    }
    findInput.focus(); findInput.select();
  }
  function hideSearch() {
    searchBar.hidden = true; findMatches = []; activeFindIndex = -1;
    findInput.classList.remove("invalid"); findStatus.classList.remove("error"); findStatus.textContent = "";
    sync(true); focusEditor();
  }
  function replaceOneMatch() {
    const q = findInput.value; if (!q) return;
    rebuildFindMatches(false);
    if (findInput.classList.contains("invalid")) return;
    const [a, b] = order(), start = offsetAt(a), end = offsetAt(b);
    const idx = findMatches.findIndex(m => m.start === start && m.end === end);
    if (idx < 0) { findMatch(false); return; }
    const selected = selText(); let replacement = replaceInput.value;
    if (findRegex.checked) {
      try { replacement = selected.replace(new RegExp(q, findCase.checked ? "" : "i"), replaceInput.value); }
      catch (err) { findInput.classList.add("invalid"); findStatus.classList.add("error"); findStatus.textContent = "Invalid regex: " + err.message; return; }
    }
    snap("replace"); replaceSel(replacement); commit(); activeFindIndex = -1; rebuildFindMatches(false); findMatch(false);
  }
  function replaceAllMatches() {
    const q = findInput.value; if (!q) return;
    rebuildFindMatches(false);
    if (findInput.classList.contains("invalid")) return;
    if (!findMatches.length) { findStatus.textContent = "No matches"; return; }
    const text = source(); let re;
    try { re = makeSearchRegex(true); } catch (err) { findInput.classList.add("invalid"); findStatus.classList.add("error"); findStatus.textContent = "Invalid regex: " + err.message; return; }
    const count = findMatches.length, beforeOffset = offsetAt(cur), result = text.replace(re, replaceInput.value);
    snap("replace all"); lines = result.split("\n"); cur = pointAt(Math.min(beforeOffset, result.length), result); anc = { ...cur }; extra = []; folded.clear(); activeFindIndex = -1; commit();
    rebuildFindMatches(true); findStatus.textContent = "Replaced " + count + " occurrence(s)";
  }
  
  function closePop() { popOpen = false; pop.style.display = "none"; }
  function docWords() {
    const seen = new Set(), re = /[A-Za-z_$][\w$]*/g;
    for (let l = 0; l < lines.length; l++) {
      let m; re.lastIndex = 0;
      while ((m = re.exec(lines[l]))) {
        if (l === cur.l && m.index <= cur.c && m.index + m[0].length >= cur.c) continue;
        if (!KW.has(m[0]) && !LIT.has(m[0]) && !BI.has(m[0])) seen.add(m[0]);
      }
    }
    return [...seen].map(m => defs.has(m) ? { m, k: "f", fn: 1, p: defs.get(m) } : { m, k: "w" });
  }
  function suggest(force) {
    if (hasSel()) return closePop();
    const s = lines[cur.l]; let a = cur.c;
    while (a > 0 && isW(s[a - 1])) a--;
    const w = s.slice(a, cur.c), dot = a > 0 && s[a - 1] === ".";
    if (/^\d/.test(w) || (!w && !dot && !force)) return closePop();
    if (!force && cur.c > 0 && inStrCom(cur.l, cur.c - 1)) return closePop();
    let cands;
    if (dot) { const m = /([\w$]+)\s*$/.exec(s.slice(0, a - 1)); cands = (m && MEMI[m[1]]) || GENI; }
    else cands = [...GLOBALS, ...docWords()];
    const lw = w.toLowerCase(), KO = { f: 0, v: 1, w: 2, k: 3, s: 4 }, seen = new Set(), out = [];
    for (const c of cands) {
      const ml = c.m.toLowerCase();
      const sc = !w ? 0 : c.m.startsWith(w) ? 0 : ml.startsWith(lw) ? 1 : (w.length >= 2 && ml.includes(lw)) ? 2 : -1;
      const key = c.m + c.k;
      if (sc < 0 || seen.has(key)) continue;
      seen.add(key); out.push({ ...c, sc });
    }
    out.sort((x, y) => x.sc - y.sc || KO[x.k] - KO[y.k] || x.m.length - y.m.length || (x.m < y.m ? -1 : 1));
    if (!out.length || (out.length === 1 && out[0].m === w && out[0].k !== "s")) return closePop();
    items = out.slice(0, 60); sel = 0; plen = w.length; popOpen = true; drawPop();
  }
  function drawPop() {
    pop.innerHTML = items.map((it, i) => '<div class="it' + (i === sel ? " sel" : "") + '" data-i="' + i + '"><b>' + it.k + "</b>" +
      esc(it.m) + (it.p !== undefined ? " <i>(" + esc(it.p) + ")</i>" : "") + (it.d ? " <i>" + esc(it.d) + "</i>" : "") + "</div>").join("");
    pop.style.display = "block";
    const t = sel * LH;
    if (t < pop.scrollTop) pop.scrollTop = t; else if (t + LH > pop.scrollTop + pop.clientHeight) pop.scrollTop = t + LH - pop.clientHeight;
    const ph = Math.min(items.length, 8) * LH + 2, row = vmap[cur.l];
    let y = (row + 1) * LH;
    if (y - ed.scrollTop + ph > ed.clientHeight && row * LH - ed.scrollTop > ph) y = row * LH - ph;
    pop.style.left = GW + PAD + (cur.c - plen) * CW + "px"; pop.style.top = y + "px";
    updateSig();
  }
  function accept() {
    const it = items[sel]; closePop();
    if (!it) return;
    snap("complete");
    const l = cur.l, a = cur.c - plen;
    if (it.t) {
      const ind = /^ */.exec(lines[l])[0], txt = it.t.replace(/\n/g, "\n" + ind), i0 = txt.indexOf("$0");
      replaceRange(l, a, l, cur.c, txt.replace("$0", ""));
      if (i0 >= 0) {
        const parts = txt.slice(0, i0).split("\n");
        cur = { l: l + parts.length - 1, c: (parts.length === 1 ? a : 0) + parts[parts.length - 1].length }; anc = { ...cur };
      }
    } else if (it.fn) {
      const hasP = lines[l][cur.c] === "(";
      replaceRange(l, a, l, cur.c, it.m + (hasP ? "" : "()"));
      if (!hasP) { cur.c--; anc = { ...cur }; }
    } else replaceRange(l, a, l, cur.c, it.m);
    commit();
  }
  pop.addEventListener("mousedown", e => {
    e.preventDefault(); e.stopPropagation();
    const it = e.target.closest(".it");
    if (it) { sel = +it.dataset.i; accept(); }
  });

  
  taEl.addEventListener("keydown", e => {
    const k = e.key, ctrl = e.ctrlKey || e.metaKey, sh = e.shiftKey;
    if (popOpen) {
      if (k === "ArrowDown" || k === "ArrowUp") { e.preventDefault(); sel = (sel + (k === "ArrowDown" ? 1 : items.length - 1)) % items.length; drawPop(); return; }
      if (k === "Enter" || k === "Tab") { e.preventDefault(); accept(); return; }
      if (k === "Escape") { e.preventDefault(); closePop(); return; }
    }
    if (ctrl) {
      const lk = k.toLowerCase();
      if (k === "Enter") { e.preventDefault(); onRun(); return; }
      if (lk === "f") { e.preventDefault(); showSearch(false, true); return; }
      if (lk === "r") { e.preventDefault(); showSearch(true, true); return; }
      if (lk === "g") { e.preventDefault(); showGoToLine(); return; }
      if (lk === "z") { e.preventDefault(); sh ? redo() : undo(); return; }
      if (lk === "y") { e.preventDefault(); redo(); return; }
      if (lk === "a") { e.preventDefault(); setSel({ l: 0, c: 0 }, { l: lines.length - 1, c: lines[lines.length - 1].length }); return; }
      if (k === " ") { e.preventDefault(); suggest(true); return; }
      if (k === "/") { e.preventDefault(); toggleComment(); return; }
      if (sh && e.code === "BracketLeft") { e.preventDefault(); foldCurrent(true); return; }
      if (sh && e.code === "BracketRight") { e.preventDefault(); foldCurrent(false); return; }
      if (lk === "c" || lk === "x" || lk === "v") return;         
    }
    switch (k) {
      case "ArrowLeft": {
        e.preventDefault();
        if (e.altKey && extra.length) moveExtraCursors(k, ctrl, sh);
        if (hasSel() && !sh && !ctrl && !e.altKey) { const [a] = order(); moveTo(a.l, a.c, false, undefined, e.altKey); break; }
        const p = ctrl ? wordLeft(cur.l, cur.c) : cur.c > 0 ? { l: cur.l, c: cur.c - 1 }
          : cur.l > 0 ? { l: cur.l - 1, c: lines[cur.l - 1].length } : cur;
        moveTo(p.l, p.c, sh, undefined, e.altKey); break;
      }
      case "ArrowRight": {
        e.preventDefault();
        if (e.altKey && extra.length) moveExtraCursors(k, ctrl, sh);
        if (hasSel() && !sh && !ctrl && !e.altKey) { const [, b] = order(); moveTo(b.l, b.c, false, undefined, e.altKey); break; }
        const p = ctrl ? wordRight(cur.l, cur.c) : cur.c < lines[cur.l].length ? { l: cur.l, c: cur.c + 1 }
          : cur.l < lines.length - 1 ? { l: cur.l + 1, c: 0 } : cur;
        moveTo(p.l, p.c, sh, undefined, e.altKey); break;
      }
      case "ArrowUp": case "ArrowDown": case "PageUp": case "PageDown": {
        e.preventDefault();
        if (e.altKey && extra.length) moveExtraCursors(k, ctrl, sh);
        const n = k.startsWith("Page") ? Math.max(1, Math.floor(ed.clientHeight / LH) - 1) : 1;
        const vi = vmap[cur.l] + (k.endsWith("Up") ? -n : n), w = want < 0 ? cur.c : want;
        if (vi < 0) moveTo(0, 0, sh, undefined, e.altKey);
        else if (vi >= vis.length) moveTo(vis[vis.length - 1], lines[vis[vis.length - 1]].length, sh, undefined, e.altKey);
        else moveTo(vis[vi], Math.min(w, lines[vis[vi]].length), sh, w, e.altKey);
        break;
      }
      case "Home": {
        e.preventDefault();
        if (e.altKey && extra.length) moveExtraCursors(k, ctrl, sh);
        if (ctrl) { moveTo(0, 0, sh, undefined, e.altKey); break; }
        const ind = /^ */.exec(lines[cur.l])[0].length;
        moveTo(cur.l, cur.c !== ind ? ind : 0, sh, undefined, e.altKey); break;
      }
      case "End": {
        e.preventDefault(); if (e.altKey && extra.length) moveExtraCursors(k, ctrl, sh);
        ctrl ? moveTo(lines.length - 1, 1e9, sh, undefined, e.altKey) : moveTo(cur.l, 1e9, sh, undefined, e.altKey); break;
      }
      case "Backspace": e.preventDefault(); backspace(ctrl); break;
      case "Delete": e.preventDefault(); del(ctrl); break;
      case "Enter": e.preventDefault(); enter(); break;
      case "Escape": closePop(); sigHide = true; updateSig(); break;
      case "Tab":
        e.preventDefault();
        if (sh || (hasSel() && cur.l !== anc.l)) indent(sh ? -1 : 1);
        else { snap("type"); replaceSel(" ".repeat(2 - (cur.c % 2))); commit(); closePop(); }
        break;
    }
  });
  taEl.addEventListener("input", () => {
    if (comp) return;
    const v = taEl.value; taEl.value = "";
    if (v) typeText(v);
  });
  taEl.addEventListener("compositionstart", () => { comp = true; });
  taEl.addEventListener("compositionend", () => { comp = false; const v = taEl.value; taEl.value = ""; if (v) typeText(v); });
  taEl.addEventListener("copy", e => {
    const selections = [];
    if (hasSel()) selections.push(selText());
    for (const p of extra) if (extraHasSel(p)) selections.push(extraSelText(p));
    if (!selections.length) return;
    e.clipboardData.setData("text/plain", selections.join("\n")); e.preventDefault();
  });
  taEl.addEventListener("cut", e => {
    const selections = [];
    if (hasSel()) selections.push(selText());
    for (const p of extra) if (extraHasSel(p)) selections.push(extraSelText(p));
    if (!selections.length) return;
    e.clipboardData.setData("text/plain", selections.join("\n")); e.preventDefault();
    if (extra.length) applyMulti("", 0);
    else { snap("cut"); replaceSel(""); commit(); }
  });
  taEl.addEventListener("paste", e => {
    e.preventDefault(); const t = e.clipboardData.getData("text");
    if (t) {
      if (extra.length) applyMulti(norm(t));
      else { snap("paste"); replaceSel(norm(t)); commit(); closePop(); }
    }
  });
  taEl.addEventListener("blur", () => setTimeout(() => { if (document.activeElement !== taEl) closePop(); }, 100));

  
  function hit(e) {
    const r = box.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    const l = vis[clamp(Math.floor(y / LH), 0, vis.length - 1)];
    return { x, l, c: clamp(Math.round((x - GW - PAD) / CW), 0, lines[l].length) };
  }
  ed.addEventListener("mousedown", e => {
    if (e.button !== 0) return;
    if (e.target === ed && (e.offsetX > ed.clientWidth || e.offsetY > ed.clientHeight)) return;
    e.preventDefault(); taEl.focus({ preventScroll: true });
    const h = hit(e);
    if (e.altKey && e.shiftKey) {
      let i = extra.findIndex(p => p.l === h.l && p.c === h.c);
      if (i < 0) { extra.push({ l: h.l, c: h.c, a: { l: h.l, c: h.c } }); i = extra.length - 1; }
      else extra[i].a = { l: extra[i].l, c: extra[i].c };
      draggingExtra = i; dragging = false; closePop(); sync(false); return;
    }
    if (e.altKey) {
      const i = extra.findIndex(p => p.l === h.l && p.c === h.c);
      if (i >= 0) extra.splice(i, 1);
      else if (!(cur.l === h.l && cur.c === h.c)) extra.push({ l: h.l, c: h.c, a: null });
      closePop(); sync(false); return;
    }
    if (h.x < GW) {
      if (Math.floor(h.x / CW) > digits && ranges.has(h.l)) toggleFold(h.l);
      else setSel({ l: h.l, c: 0 }, { l: h.l, c: lines[h.l].length });
      return;
    }
    if (e.target.classList.contains("bdg")) { folded.delete(h.l); sync(true); return; }
    if (e.detail === 2) {
      const s = lines[h.l]; let a = h.c, b = h.c;
      while (a > 0 && isW(s[a - 1])) a--;
      while (b < s.length && isW(s[b])) b++;
      setSel({ l: h.l, c: a }, { l: h.l, c: b });
    } else if (e.detail >= 3) setSel({ l: h.l, c: 0 }, { l: h.l, c: lines[h.l].length });
    else { moveTo(h.l, h.c, e.shiftKey); dragging = true; }
  });
  window.addEventListener("mousemove", e => {
    if (draggingExtra >= 0) {
      const r = ed.getBoundingClientRect();
      if (e.clientY < r.top) ed.scrollTop = Math.max(0, ed.scrollTop - LH);
      else if (e.clientY > r.bottom) ed.scrollTop += LH;
      if (e.clientX < r.left + GW) ed.scrollLeft = Math.max(0, ed.scrollLeft - CW * 2);
      else if (e.clientX > r.right) ed.scrollLeft += CW * 2;
      const h = hit(e), p = extra[draggingExtra];
      if (p) { p.l = h.l; p.c = h.c; sync(false); }
      return;
    }
    if (!dragging) return;
    const r = ed.getBoundingClientRect();
    if (e.clientY < r.top) ed.scrollTop = Math.max(0, ed.scrollTop - LH);
    else if (e.clientY > r.bottom) ed.scrollTop += LH;
    if (e.clientX < r.left + GW) ed.scrollLeft = Math.max(0, ed.scrollLeft - CW * 2);
    else if (e.clientX > r.right) ed.scrollLeft += CW * 2;
    const h = hit(e); moveTo(h.l, h.c, true, undefined, e.altKey);
  });
  window.addEventListener("mouseup", () => { dragging = false; draggingExtra = -1; });
  g("findNext").onclick = () => findMatch();
  g("findPrev").onclick = () => findMatch(true);
  g("replaceOne").onclick = replaceOneMatch;
  g("replaceAll").onclick = replaceAllMatches;
  g("closeSearch").onclick = hideSearch;
  const refreshSearch = () => { activeFindIndex = -1; rebuildFindMatches(true); sync(true); };
  findInput.addEventListener("input", refreshSearch);
  findCase.addEventListener("change", refreshSearch);
  findRegex.addEventListener("change", refreshSearch);
  searchBar.addEventListener("keydown", e => { if (e.ctrlKey || e.metaKey) { const k = e.key.toLowerCase(); if (k === "f" || k === "r") { e.preventDefault(); showSearch(k === "r"); } } });
  findInput.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); findMatch(e.shiftKey); } if (e.key === "Escape") hideSearch(); });
  replaceInput.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); replaceOneMatch(); } if (e.key === "Escape") hideSearch(); });
  g("gotoGo").addEventListener("click", commitGoToLine);
  g("gotoClose").addEventListener("click", () => hideGoToLine(true));
  gotoInput.addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); commitGoToLine(); }
    if (e.key === "Escape") { e.preventDefault(); hideGoToLine(true); }
  });

  return {
    init(o) { onRun = o.onRun || onRun; onChange = o.onChange || onChange; },
    getValue: () => lines.join("\n"),
    setValue(t) {
      lines = norm(t).split("\n"); cur = { l: 0, c: 0 }; anc = { l: 0, c: 0 }; extra = [];
      folded.clear(); undoS = []; redoS = []; closePop(); dirty = true; sync(true);
    },
    focus() { taEl.focus({ preventScroll: true }); overlays(); },
    openGoToLine() { showGoToLine(); },
    refresh() { dirty = true; sync(true); },
    foldAll() { for (const s of ranges.keys()) folded.add(s); foldFix(); sync(true); },
    unfoldAll() { folded.clear(); sync(true); }
  };
})();
