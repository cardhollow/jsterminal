"use strict";

function workerMain() {
  const rawPost = m => self.postMessage(m);
  const CLR = "\x1b[2J\x1b[3J\x1b[H", KEEP = /\x1b\[(?:[0-9;:]*m|\?25[hl])/g;
  let buf = "", last = 0, sched = false;
  const flush = () => { if (buf) { rawPost({ t: "out", s: buf }); buf = ""; } last = performance.now(); };
  const later = () => { if (!sched) { sched = true; _st(() => { sched = false; flush(); }, 0); } };
  const out = s => { buf += s; if ((!buf.startsWith(CLR) || buf.length > 1e5) && performance.now() - last >= 16) flush(); else later(); };
  const post = m => { if (m.t !== "out") flush(); rawPost(m); };
  const keyHandlers = [], pending = new Map(), live = new Set();
  let nextId = 1, mainDone = false, dead = false;
  const stringify = v => {
    if (typeof v === "string") return v;
    if (v instanceof Error) return v.stack || String(v);
    if (typeof v === "object" && v !== null) { try { return JSON.stringify(v, null, 2); } catch (e) {} }
    return String(v);
  };
  const fail = e => { if (dead) return; dead = true; post({ t: "error", name: (e && e.name) || "Error", message: (e && e.message !== undefined) ? e.message : String(e), stack: (e && e.stack) || "" }); };
  const check = () => { if (mainDone && !dead && !pending.size && !keyHandlers.length && !live.size) { dead = true; post({ t: "done" }); } };
  const guard = (fn, args) => { try { const r = fn(...args); if (r && typeof r.then === "function") r.then(null, fail); } catch (e) { fail(e); } };
  const print = (...a) => out(a.map(stringify).join(" "));
  const println = (...a) => out(a.map(stringify).join(" ") + "\n");
  const write = print;
  const clear = () => { if (performance.now() - last >= 16) flush(); else buf = (buf.match(KEEP) || []).join(""); buf += CLR; later(); };
  const input = (p = "") => new Promise(res => { const id = nextId++; pending.set(id, res); post({ t: "input", id, prompt: stringify(p) }); });
  const keySites = new Map();
  const onKey = cb => {
    if (typeof cb !== "function") throw new TypeError("onKey() needs a function");
    const frames = (new Error().stack || "").split("\n");
    const site = frames.find(line => /(?:<anonymous>|AsyncFunction):\d+:\d+/.test(line)) || "";
    if (site && keySites.has(site)) return () => {};
    if (site) keySites.set(site, cb);
    keyHandlers.push(cb); post({ t: "keys", n: keyHandlers.length });
    return () => {
      const i = keyHandlers.indexOf(cb);
      if (i >= 0) { keyHandlers.splice(i, 1); if (site && keySites.get(site) === cb) keySites.delete(site); post({ t: "keys", n: keyHandlers.length }); check(); }
    };
  };
  const exit = () => { if (!dead) { dead = true; post({ t: "done" }); } };
  const _st = self.setTimeout.bind(self), _si = self.setInterval.bind(self), _ct = self.clearTimeout.bind(self), _ci = self.clearInterval.bind(self);
  self.setTimeout = (fn, ms, ...a) => { const id = _st(() => { live.delete(id); guard(fn, a); check(); }, ms); live.add(id); return id; };
  self.setInterval = (fn, ms, ...a) => { const id = _si(() => guard(fn, a), ms); live.add(id); return id; };
  self.clearTimeout = self.clearInterval = id => { live.delete(id); _ct(id); _ci(id); check(); };
  const sleep = ms => new Promise(r => self.setTimeout(r, ms));

  
  
  const __canvasBridgePending = new Map();
  const __canvasEventHandlers = new Map();
  let __canvasBridgeId = 1, __canvasLibraryPromise = null;
  const __canvasRequest = (action, data = {}) => new Promise((resolve, reject) => {
    const id = __canvasBridgeId++;
    __canvasBridgePending.set(id, { resolve, reject });
    rawPost({ t: "canvas-request", id, action, ...data });
  });
  const __importLibrary = name => {
    if (name !== "canvas" && name !== "./canvas" && name !== "canvas.js")
      return Promise.reject(new Error('Unknown built-in library "' + name + '". Available library: "canvas".'));
    if (__canvasLibraryPromise) return __canvasLibraryPromise;
    __canvasLibraryPromise = (async () => {
      let width = 800, height = 600;
      await __canvasRequest("create", { width, height });
      const state = {
        fillStyle: "#000000", strokeStyle: "#000000", lineWidth: 1, lineCap: "butt", lineJoin: "miter",
        miterLimit: 10, font: "10px sans-serif", textAlign: "start", textBaseline: "alphabetic", direction: "inherit",
        globalAlpha: 1, globalCompositeOperation: "source-over", shadowBlur: 0, shadowColor: "rgba(0,0,0,0)",
        shadowOffsetX: 0, shadowOffsetY: 0, imageSmoothingEnabled: true, lineDashOffset: 0
      };
      let dash = [], handle;
      const methods = new Set(["clearRect","fillRect","strokeRect","beginPath","closePath","moveTo","lineTo","rect","roundRect","arc","arcTo","ellipse","quadraticCurveTo","bezierCurveTo","stroke","fill","clip","save","restore","translate","rotate","scale","transform","setTransform","resetTransform","fillText","strokeText","setLineDash"]);
      const syncContextState = () => { for (const [key, value] of Object.entries(state)) rawPost({ t: "canvas-op", op: { kind: "set", key, value } }); rawPost({ t: "canvas-op", op: { kind: "call", method: "setLineDash", args: [dash] } }); };
      const context = new Proxy({}, {
        get(_target, key) {
          if (key === "canvas") return handle;
          if (key === "setLineDash") return values => { dash = Array.from(values || []); rawPost({ t: "canvas-op", op: { kind: "call", method: "setLineDash", args: [dash] } }); };
          if (key === "getLineDash") return () => dash.slice();
          if (key === "measureText") return text => { const px = parseFloat(state.font) || 10; return { width: String(text).length * px * 0.58, actualBoundingBoxAscent: px * 0.8, actualBoundingBoxDescent: px * 0.2 }; };
          if (Object.prototype.hasOwnProperty.call(state, key)) return state[key];
          if (methods.has(key)) return (...args) => { rawPost({ t: "canvas-op", op: { kind: "call", method: key, args } }); };
          return undefined;
        },
        set(_target, key, value) {
          if (typeof key !== "string") return true;
          state[key] = value;
          rawPost({ t: "canvas-op", op: { kind: "set", key, value } });
          return true;
        }
      });
      const rafIds = new Set();
      handle = {
        get width() { return width; },
        set width(v) { width = Math.max(1, Math.min(8192, Math.floor(Number(v) || 1))); rawPost({ t: "canvas-op", op: { kind: "resize", width, height } }); syncContextState(); },
        get height() { return height; },
        set height(v) { height = Math.max(1, Math.min(8192, Math.floor(Number(v) || 1))); rawPost({ t: "canvas-op", op: { kind: "resize", width, height } }); syncContextState(); },
        getContext(type = "2d") { if (type !== "2d") throw new Error('canvas supports getContext("2d") only.'); return context; },
        clear() { context.clearRect(0, 0, width, height); },
        createCanvas(w = width, h = height) { this.width = w; this.height = h; return this; },
        create(w = width, h = height) { return this.createCanvas(w, h); },
        requestAnimationFrame(callback) {
          if (typeof callback !== "function") throw new TypeError("requestAnimationFrame expects a callback");
          const id = self.setTimeout(() => { rafIds.delete(id); callback(performance.now()); }, 16); rafIds.add(id); return id;
        },
        cancelAnimationFrame(id) { rafIds.delete(id); self.clearTimeout(id); },
        addEventListener(type, callback) {
          if (typeof callback !== "function") throw new TypeError("Canvas event listener must be a function");
          if (!__canvasEventHandlers.has(type)) __canvasEventHandlers.set(type, new Set());
          __canvasEventHandlers.get(type).add(callback);
        },
        removeEventListener(type, callback) { const set = __canvasEventHandlers.get(type); if (set) set.delete(callback); },
        getBoundingClientRect() { return { x: 0, y: 0, left: 0, top: 0, right: width, bottom: height, width, height }; },
        toString() { return "[HTMLCanvasElement facade]"; }
      };
      Object.defineProperties(handle, {
        default: { enumerable: true, get: () => handle },
        canvas: { enumerable: true, get: () => handle },
        createCanvas: { enumerable: true, value: handle.createCanvas.bind(handle) },
        create: { enumerable: true, value: handle.create.bind(handle) },
        getContext: { enumerable: true, value: handle.getContext.bind(handle) }
      });
      return handle;
    })();
    return __canvasLibraryPromise;
  };
  function __transformCanvasImports(source) {
    let serial = 0;
    source = source.split("\n").map(line => {
      let m, replacement, tail = "";
      const appendTail = value => value + (tail && !/^\s/.test(tail) ? " " : "") + tail;
      if ((m = /^(\s*)import\s+([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)\s*;?([\s\S]*)$/.exec(line))) {
        tail = m[4]; return appendTail(m[1] + "const " + m[3] + ' = await __importLibrary("canvas");');
      }
      if ((m = /^(\s*)import\s+(['"])([^'"]+)\2\s*;?([\s\S]*)$/.exec(line))) {
        if (["canvas", "./canvas", "canvas.js"].includes(m[3])) { tail = m[4]; return appendTail(m[1] + 'await __importLibrary("canvas");'); }
        return line;
      }
      if ((m = /^(\s*)import\s+(.+?)\s+from\s+(['"])([^'"]+)\3\s*;?([\s\S]*)$/.exec(line))) {
        const indent = m[1], spec = m[2].trim(), lib = m[4]; tail = m[5];
        if (!["canvas", "./canvas", "canvas.js"].includes(lib)) return line;
        const get = name => appendTail(indent + "const " + name + ' = await __importLibrary("canvas");');
        const destructure = body => body.split(",").map(part => { const bits = part.trim().split(/\s+as\s+/); return bits.length > 1 ? bits[0] + ": " + bits[1] : bits[0]; }).join(", ");
        if (/^\*\s+as\s+[A-Za-z_$][\w$]*$/.test(spec)) return get(spec.replace(/^\*\s+as\s+/, ""));
        if (/^[A-Za-z_$][\w$]*$/.test(spec)) return get(spec);
        if (/^\{[\s\S]*\}$/.test(spec)) return appendTail(indent + "const { " + destructure(spec.slice(1, -1)) + ' } = await __importLibrary("canvas");');
        const combo = spec.match(/^([A-Za-z_$][\w$]*)\s*,\s*(\{[\s\S]*\})$/);
        if (combo) {
          const temp = "__canvasImport" + (++serial);
          replacement = indent + "const " + temp + ' = await __importLibrary("canvas");\n' + indent + "const " + combo[1] + " = " + temp + ";\n" + indent + "const { " + destructure(combo[2].slice(1, -1)) + " } = " + temp + ";";
          return appendTail(replacement);
        }
        return line;
      }
      return line;
    }).join("\n");
    
    let out = "", i = 0;
    while (i < source.length) {
      const c = source[i], n = source[i + 1];
      if (c === "'" || c === '"' || c === "`") { const q = c, start = i++; while (i < source.length) { if (source[i] === "\\") i += 2; else if (source[i++] === q) break; } out += source.slice(start, i); continue; }
      if (c === "/" && n === "/") { const start = i; while (i < source.length && source[i] !== "\n") i++; out += source.slice(start, i); continue; }
      if (c === "/" && n === "*") { const start = i; i += 2; while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) i++; i = Math.min(source.length, i + 2); out += source.slice(start, i); continue; }
      const previous = source[i - 1] || "";
      const match = /^import\s*\(\s*(['"])(canvas|\.\/canvas|canvas\.js)\1\s*\)/.exec(source.slice(i));
      if (match && !/[\w$.]/.test(previous)) { out += '__importLibrary("canvas")'; i += match[0].length; continue; }
      out += c; i++;
    }
    return out;
  }

  const col = c => (...a) => println(c + a.map(stringify).join(" ") + "\x1b[0m");
  console.log = console.info = console.debug = println; console.warn = col("\x1b[33m"); console.error = col("\x1b[31m");
  (function () {
    const M = Math, def = (n, v) => { if (!(n in M)) Object.defineProperty(M, n, { value: v, writable: true, configurable: true }); }, nums = a => (a.length === 1 && Array.isArray(a[0])) ? a[0] : a;
    const nativeRandom = M.random.bind(M); let rng = nativeRandom; M.random = () => rng();
    def("seed", s => { if (s === undefined || s === null) { rng = nativeRandom; return; } let t = typeof s === "number" ? s >>> 0 : [...String(s)].reduce((h,c)=>(Math.imul(h,31)+c.charCodeAt(0))|0,7)>>>0; rng = () => { t=(t+0x6D2B79F5)>>>0; let r=Math.imul(t^(t>>>15),1|t); r=(r+Math.imul(r^(r>>>7),61|r))^r; return ((r^(r>>>14))>>>0)/4294967296; }; });
    def("TAU",2*M.PI); def("PHI",(1+M.sqrt(5))/2); def("SQRT3",M.sqrt(3)); def("DEG2RAD",M.PI/180); def("RAD2DEG",180/M.PI); def("EPSILON",Number.EPSILON);
    const clamp = (x,a,b) => { if(a>b)[a,b]=[b,a]; return x<a?a:x>b?b:x; }, clamp01=x=>clamp(x,0,1);
    def("clamp",clamp); def("clamp01",clamp01); def("saturate",clamp01); def("inRange",(x,a,b)=>x>=M.min(a,b)&&x<=M.max(a,b)); def("between",M.inRange); def("wrap",(x,a,b)=>{if(a>b)[a,b]=[b,a];const r=b-a;return r===0?a:a+(((x-a)%r)+r)%r;}); def("mod",(a,n)=>((a%n)+n)%n); def("pingPong",(t,len)=>{const m=((t%(2*len))+(2*len))%(2*len);return len-M.abs(m-len);}); def("moveToward",(c,t,d)=>M.abs(t-c)<=d?t:c+M.sign(t-c)*d); def("approx",(a,b,eps=1e-9)=>M.abs(a-b)<=eps);
    const lerp=(a,b,t)=>a+(b-a)*t, invLerp=(a,b,v)=>a===b?0:(v-a)/(b-a), remap=(v,a,b,c,d)=>lerp(c,d,invLerp(a,b,v)); def("lerp",lerp); def("invLerp",invLerp); def("remap",remap); def("map",remap); def("step",(e,x)=>x<e?0:1); def("smoothstep",(a,b,x)=>{const t=clamp01(invLerp(a,b,x));return t*t*(3-2*t);}); def("smootherstep",(a,b,x)=>{const t=clamp01(invLerp(a,b,x));return t*t*t*(t*(t*6-15)+10);}); def("sigmoid",x=>1/(1+M.exp(-x)));
    const E={easeInQuad:t=>t*t,easeOutQuad:t=>t*(2-t),easeInOutQuad:t=>t<.5?2*t*t:-1+(4-2*t)*t,easeInCubic:t=>t*t*t,easeOutCubic:t=>(t-1)**3+1,easeInOutCubic:t=>t<.5?4*t*t*t:(t-1)*(2*t-2)*(2*t-2)+1}; for(const k in E) def(k,E[k]);
    def("ceiling",M.ceil); def("truncate",M.trunc); def("roundTo",(x,d=0)=>{const f=10**d;return M.round(x*f)/f;}); def("floorTo",(x,d=0)=>{const f=10**d;return M.floor(x*f)/f;}); def("ceilTo",(x,d=0)=>{const f=10**d;return M.ceil(x*f)/f;}); def("snap",(x,s)=>s?M.round(x/s)*s:x); def("fract",x=>x-M.trunc(x)); def("frac",M.fract); def("floorDiv",(a,b)=>M.floor(a/b)); def("intDiv",(a,b)=>M.trunc(a/b));
    def("square",x=>x*x); def("cube",x=>x*x*x); def("root",(x,n)=>n%2===1&&x<0?-((-x)**(1/n)):x**(1/n)); def("toRadians",d=>d*M.PI/180); def("toDegrees",r=>r*180/M.PI); def("deg2rad",M.toRadians); def("rad2deg",M.toDegrees); def("sinDeg",d=>M.sin(d*M.PI/180)); def("cosDeg",d=>M.cos(d*M.PI/180)); def("tanDeg",d=>M.tan(d*M.PI/180)); def("cot",x=>1/M.tan(x)); def("sec",x=>1/M.cos(x)); def("csc",x=>1/M.sin(x));
    def("dist",(x1,y1,x2,y2)=>M.hypot(x2-x1,y2-y1)); def("distSq",(x1,y1,x2,y2)=>(x2-x1)**2+(y2-y1)**2); def("manhattan",(x1,y1,x2,y2)=>M.abs(x2-x1)+M.abs(y2-y1)); def("angleTo",(x1,y1,x2,y2)=>M.atan2(y2-y1,x2-x1));
    def("randFloat",(a=0,b=1)=>a+M.random()*(b-a)); def("randInt",(a,b)=>{if(b===undefined){b=a;a=0;}const lo=M.ceil(M.min(a,b)),hi=M.floor(M.max(a,b));return lo+M.floor(M.random()*(hi-lo+1));}); def("randBool",p=>M.random()<(p===undefined?.5:p)); def("randSign",()=>M.random()<.5?-1:1); def("randNormal",(mean=0,sd=1)=>mean+sd*M.sqrt(-2*M.log(1-M.random()))*M.cos(2*M.PI*M.random())); def("choice",a=>a[M.floor(M.random()*a.length)]); def("weighted",(a,w)=>{let r=M.random()*w.reduce((s,x)=>s+x,0);for(let i=0;i<a.length;i++){r-=w[i];if(r<0)return a[i];}return a[a.length-1];}); def("shuffle",arr=>{const a=Array.from(arr);for(let i=a.length-1;i>0;i--){const j=M.floor(M.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;});
    def("sum",(...a)=>nums(a).reduce((s,x)=>s+x,0)); def("product",(...a)=>nums(a).reduce((s,x)=>s*x,1)); def("mean",(...a)=>{const n=nums(a);return n.length?M.sum(n)/n.length:NaN;}); def("avg",M.mean); def("median",(...a)=>{const n=[...nums(a)].sort((x,y)=>x-y),m=n.length>>1;return n.length?(n.length%2?n[m]:(n[m-1]+n[m])/2):NaN;}); def("mode",(...a)=>{const c=new Map();let best,bc=0;for(const x of nums(a)){const v=(c.get(x)||0)+1;c.set(x,v);if(v>bc){bc=v;best=x;}}return best;}); def("variance",(...a)=>{const n=nums(a),m=M.mean(n);return n.length?M.sum(n.map(x=>(x-m)**2))/n.length:NaN;}); def("stdDev",(...a)=>M.sqrt(M.variance(nums(a))));
    def("isEven",n=>n%2===0); def("isOdd",n=>M.abs(n%2)===1); def("isPrime",n=>{if(!Number.isInteger(n)||n<2)return false;if(n<4)return true;if(n%2===0||n%3===0)return false;for(let i=5;i*i<=n;i+=6)if(n%i===0||n%(i+2)===0)return false;return true;}); const gcd2=(a,b)=>{a=M.abs(a);b=M.abs(b);while(b)[a,b]=[b,a%b];return a;}; def("gcd",(...a)=>nums(a).reduce(gcd2)); def("lcm",(...a)=>nums(a).reduce((x,y)=>x&&y?M.abs(x*y)/gcd2(x,y):0)); def("factorial",n=>{if(!Number.isInteger(n)||n<0)return NaN;let r=1;for(let i=2;i<=n;i++)r*=i;return r;}); def("fib",n=>{let a=0,b=1;for(let i=0;i<n;i++)[a,b]=[b,a+b];return a;}); def("nCr",(n,k)=>{if(k<0||k>n)return 0;k=M.min(k,n-k);let r=1;for(let i=1;i<=k;i++)r=r*(n-k+i)/i;return M.round(r);}); def("nPr",(n,k)=>{if(k<0||k>n)return 0;let r=1;for(let i=0;i<k;i++)r*=n-i;return r;}); def("digitSum",n=>[...String(M.abs(M.trunc(n)))].reduce((s,d)=>s+(+d),0)); def("isPowerOfTwo",n=>Number.isInteger(n)&&n>0&&(n&(n-1))===0); def("percent",(p,t)=>t?p/t*100:0);
  })();

  
  
  
  
  
  
  
  let __yieldVisits = 0;
  const __runtimeYield = () => (++__yieldVisits % 16 === 0)
    ? new Promise(resolve => _st(resolve, 0)) : Promise.resolve();

  function __instrumentLoops(source) {
    
    
    
    const ts = []; let i = 0;
    while (i < source.length) {
      const c = source[i], n = source[i + 1];
      if (/\s/.test(c)) { i++; continue; }
      if (c === "'" || c === '"' || c === '`') {
        const q = c; i++;
        while (i < source.length) {
          if (source[i] === "\\") i += 2;
          else if (source[i++] === q) break;
        }
        continue;
      }
      if (c === "/" && n === "/") { i += 2; while (i < source.length && source[i] !== "\n") i++; continue; }
      if (c === "/" && n === "*") { i += 2; while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) i++; i = Math.min(source.length, i + 2); continue; }
      if (/[A-Za-z_$]/.test(c)) { const s = i++; while (i < source.length && /[\w$]/.test(source[i])) i++; ts.push({ v: source.slice(s, i), s, e: i }); continue; }
      if (source.slice(i, i + 2) === "=>") { ts.push({ v: "=>", s: i, e: i + 2 }); i += 2; continue; }
      ts.push({ v: c, s: i, e: i + 1 }); i++;
    }

    const pairs = new Map(), stack = [];
    for (let k = 0; k < ts.length; k++) {
      const v = ts[k].v;
      if (v === "(" || v === "{" || v === "[") stack.push(k);
      else if (v === ")" || v === "}" || v === "]") {
        const top = stack[stack.length - 1];
        const expected = v === ")" ? "(" : v === "}" ? "{" : "[";
        if (top !== undefined && ts[top].v === expected) { stack.pop(); pairs.set(top, k); pairs.set(k, top); }
      }
    }

    const scopes = [];
    const addScope = (open, close, isAsync, extra = {}) => {
      if (close !== undefined && close > open) scopes.push({
        open, close, async: !!isAsync, span: close - open,
        prefixToken: null, canAutoAsync: false, kind: "function", ...extra
      });
    };

    
    for (let k = 0; k < ts.length; k++) {
      if (ts[k].v !== "function") continue;
      let p = k + 1;
      const generator = !!(ts[p] && ts[p].v === "*");
      if (generator) p++;
      while (p < ts.length && ts[p].v !== "(" && ![";", "{", "=>"].includes(ts[p].v)) p++;
      if (!ts[p] || ts[p].v !== "(") continue;
      const pe = pairs.get(p), bo = pe === undefined ? undefined : pe + 1;
      if (bo === undefined || !ts[bo] || ts[bo].v !== "{") continue;
      const isAsync = k > 0 && ts[k - 1].v === "async";
      addScope(bo, pairs.get(bo), isAsync, {
        kind: "function", prefixToken: k,
        canAutoAsync: !isAsync && !generator,
        name: ts[p - 1] && /^[A-Za-z_$][\w$]*$/.test(ts[p - 1].v) ? ts[p - 1].v : ""
      });
    }

    
    for (let k = 0; k < ts.length; k++) {
      if (ts[k].v !== "=>") continue;
      const bo = k + 1;
      if (!ts[bo] || ts[bo].v !== "{") continue;
      let isAsync = false, prefixToken = null;
      if (k > 0 && ts[k - 1].v === ")") {
        const po = pairs.get(k - 1);
        if (po !== undefined) {
          isAsync = po > 0 && ts[po - 1].v === "async";
          prefixToken = po;
        }
      } else if (k > 0) {
        prefixToken = k - 1;
        isAsync = k > 1 && ts[k - 2].v === "async";
      }
      addScope(bo, pairs.get(bo), isAsync, {
        kind: "arrow", prefixToken,
        canAutoAsync: !isAsync && prefixToken !== null
      });
    }

    
    const notMethod = new Set(["if", "for", "while", "switch", "catch", "with", "function", "return", "throw", "new", "typeof", "delete", "void", "await", "yield", "do"]);
    for (let k = 0; k < ts.length; k++) {
      if (ts[k].v !== ")") continue;
      const po = pairs.get(k), bo = k + 1;
      if (po === undefined || !ts[bo] || ts[bo].v !== "{" || po < 1) continue;
      const ni = po - 1, name = ts[ni].v;
      if (!/^[A-Za-z_$][\w$]*$/.test(name) || notMethod.has(name)) continue;
      if (ni > 0 && ts[ni - 1].v === "function") continue;
      if (ni > 1 && ts[ni - 1].v === "function" && ts[ni - 2].v === "async") continue;
      const asyncMethod = ni > 0 && ts[ni - 1].v === "async";
      const accessor = ni > 0 && (ts[ni - 1].v === "get" || ts[ni - 1].v === "set");
      addScope(bo, pairs.get(bo), asyncMethod, {
        kind: "method", prefixToken: ni,
        canAutoAsync: !asyncMethod && !accessor && name !== "constructor",
        name
      });
    }

    const nearestScope = (open, close) => scopes
      .filter(s => s.open < open && s.close > close)
      .sort((a, b) => a.span - b.span)[0] || null;

    const hasValueReturn = scope => {
      for (let q = scope.open + 1; q < scope.close; q++) {
        if (ts[q].v !== "return" || nearestScope(q, q) !== scope) continue;
        const next = ts[q + 1];
        if (!next || next.v === ";" || next.v === "}") continue;
        
        if (/\r|\n/.test(source.slice(ts[q].e, next.s))) continue;
        return true;
      }
      return false;
    };

    const isTrueCondition = (open, close) => {
      let a = open + 1, b = close;
      while (ts[a] && ts[a].v === "(" && pairs.get(a) === b - 1) { a++; b--; }
      return b - a === 1 && ts[a] && ts[a].v === "true";
    };

    const emptyForCondition = (open, close) => {
      const semis = []; let depth = 0;
      for (let q = open + 1; q < close; q++) {
        const v = ts[q].v;
        if (v === "(" || v === "[" || v === "{") depth++;
        else if (v === ")" || v === "]" || v === "}") depth--;
        else if (v === ";" && depth === 0) semis.push(q);
      }
      return semis.length >= 2 && semis[1] === semis[0] + 1;
    };

    const loops = [];
    for (let k = 0; k < ts.length; k++) {
      let head = k + 1, bodyOpen = -1, infinite = false, endHead = -1;
      if (ts[k].v === "for" && ts[head] && ts[head].v === "await") head++;
      if (ts[k].v === "while" || ts[k].v === "for") {
        if (!ts[head] || ts[head].v !== "(") continue;
        endHead = pairs.get(head);
        if (endHead === undefined || !ts[endHead + 1] || ts[endHead + 1].v !== "{") continue;
        bodyOpen = endHead + 1;
        infinite = ts[k].v === "while" ? isTrueCondition(head, endHead) : emptyForCondition(head, endHead);
      } else if (ts[k].v === "do" && ts[k + 1] && ts[k + 1].v === "{") {
        bodyOpen = k + 1;
        const bodyEnd = pairs.get(bodyOpen);
        if (bodyEnd !== undefined && ts[bodyEnd + 1] && ts[bodyEnd + 1].v === "while" && ts[bodyEnd + 2] && ts[bodyEnd + 2].v === "(") {
          const condEnd = pairs.get(bodyEnd + 2);
          infinite = condEnd !== undefined && isTrueCondition(bodyEnd + 2, condEnd);
        }
      } else continue;
      const close = pairs.get(bodyOpen);
      if (close === undefined) continue;
      loops.push({ bodyOpen, close, infinite });
    }

    
    
    
    const prefixes = new Map();
    for (const loop of loops) {
      if (!loop.infinite) continue;
      const scope = nearestScope(loop.bodyOpen, loop.close);
      if (!scope || scope.async || !scope.canAutoAsync || hasValueReturn(scope)) continue;
      scope.async = true;
      scope.autoAsync = true;
      const token = scope.prefixToken;
      if (token !== null && token !== undefined) {
        const pos = ts[token].s;
        
        prefixes.set(pos, "async ");
      }
    }

    const inserts = new Map();
    const addInsert = (pos, str) => inserts.set(pos, (inserts.get(pos) || "") + str);
    for (const [pos, str] of prefixes) addInsert(pos, str);

    
    for (const loop of loops) {
      const scope = nearestScope(loop.bodyOpen, loop.close);
      if (scope && !scope.async) continue;
      addInsert(ts[loop.close].s, " await __runtimeYield(); ");
      
      for (let q = loop.bodyOpen + 1; q < loop.close; q++) {
        if (ts[q].v !== "continue") continue;
        const inScope = nearestScope(q, q);
        if (!inScope || inScope.async) addInsert(ts[q].s, " await __runtimeYield(); ");
      }
    }

    let out = source;
    for (const [pos, str] of [...inserts.entries()].sort((a, b) => b[0] - a[0])) {
      out = out.slice(0, pos) + str + out.slice(pos);
    }
    return out;
  }

  self.addEventListener("unhandledrejection", ev => { ev.preventDefault(); fail(ev.reason); });
  self.addEventListener("error", ev => { ev.preventDefault(); fail(ev.error || new Error(ev.message)); });
  self.onmessage = async e => {
    const m=e.data;
    if(m.t==="start") { try { const AF=Object.getPrototypeOf(async function(){}).constructor; const prepared=__transformCanvasImports(m.code); const transformed=__instrumentLoops(prepared); const fn=new AF("print","println","input","clear","onKey","write","sleep","exit","__runtimeYield","__importLibrary",transformed); await fn(print,println,input,clear,onKey,write,sleep,exit,__runtimeYield,__importLibrary); } catch(err){fail(err);return;} mainDone=true;check(); }
    else if(m.t==="inputResult"){const r=pending.get(m.id);if(r){pending.delete(m.id);r(m.value);}}
    else if(m.t==="canvas-response"){const p=__canvasBridgePending.get(m.id);if(p){__canvasBridgePending.delete(m.id);if(m.ok)p.resolve(m.value);else p.reject(new Error(m.error||"Canvas bridge failed"));}}
    else if(m.t==="canvas-event"){const set=__canvasEventHandlers.get(m.event&&m.event.type);if(set){const ev={...m.event,preventDefault(){this.defaultPrevented=true;}};for(const h of [...set])guard(h,[ev]);}}
    else if(m.t==="key"){const ev={type:m.pressed?"keydown":"keyup",key:m.key,code:m.code,repeat:m.repeat,ctrlKey:m.ctrlKey,shiftKey:m.shiftKey,altKey:m.altKey,metaKey:m.metaKey,actions:{onPressed:m.pressed,onReleased:!m.pressed},defaultPrevented:false,preventDefault(){this.defaultPrevented=true;}};for(const h of keyHandlers.slice())guard(h,[ev]);}
  };
}
