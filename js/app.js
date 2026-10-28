"use strict";

const $ = id => document.getElementById(id);
const inp = $("inp"), statusEl = $("status");
let worker = null, workerUrl = null, running = false, keysOn = 0, curInput = null;
let canvasReady = false, canvasCtx = null, returnViewAfterInput = null;
const down = new Map();

function setStatus(t, cls) { statusEl.textContent = t; statusEl.className = cls || "dim"; }
function showTerm() { $("editorView").hidden = true; $("termView").hidden = false; $("canvasView").hidden = true; }
function showCanvas() {
  $("editorView").hidden = true; $("termView").hidden = true; $("canvasView").hidden = false;
  $("canvasStatus").textContent = canvasReady ? ($("canvasSurface").width + " × " + $("canvasSurface").height) : "canvas not initialized";
}
function showEditor() { $("termView").hidden = true; $("canvasView").hidden = true; $("editorView").hidden = false; Editor.refresh(); Editor.focus(); }
function ensureCanvas() {
  const c = $("canvasSurface");
  if (!canvasCtx) {
    canvasCtx = c.getContext("2d");
    const forward = e => {
      if (!running || !worker) return;
      const rect = c.getBoundingClientRect();
      worker.postMessage({ t: "canvas-event", event: { type: e.type,
        offsetX: (e.clientX - rect.left) * (c.width / (rect.width || 1)),
        offsetY: (e.clientY - rect.top) * (c.height / (rect.height || 1)),
        clientX: e.clientX, clientY: e.clientY, button: e.button, buttons: e.buttons,
        deltaX: e.deltaX || 0, deltaY: e.deltaY || 0, altKey: e.altKey, ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey, key: e.key, code: e.code } });
    };
    for (const type of ["click", "dblclick", "pointerdown", "pointerup", "pointermove", "mousedown", "mouseup", "mousemove", "wheel", "contextmenu"]) {
      c.addEventListener(type, e => { if (type === "wheel" || type === "contextmenu") e.preventDefault(); forward(e); });
    }
  }
  return c;
}
function handleCanvasRequest(m) {
  try {
    const c = ensureCanvas();
    if (m.action === "create") {
      c.width = Math.max(1, Math.min(8192, Math.floor(Number(m.width) || 800)));
      c.height = Math.max(1, Math.min(8192, Math.floor(Number(m.height) || 600)));
      canvasCtx = c.getContext("2d"); canvasCtx.clearRect(0, 0, c.width, c.height); canvasReady = true;
      $("canvasBtn").hidden = false; showCanvas();
      worker && worker.postMessage({ t: "canvas-response", id: m.id, ok: true, value: { width: c.width, height: c.height } });
      return;
    }
    worker && worker.postMessage({ t: "canvas-response", id: m.id, ok: false, error: "Unknown canvas request: " + m.action });
  } catch (err) {
    worker && worker.postMessage({ t: "canvas-response", id: m.id, ok: false, error: err.message || String(err) });
  }
}
function applyCanvasOp(op) {
  try {
    const c = ensureCanvas();
    if (op.kind === "resize") {
      c.width = Math.max(1, Math.min(8192, Math.floor(Number(op.width) || 1)));
      c.height = Math.max(1, Math.min(8192, Math.floor(Number(op.height) || 1)));
      canvasCtx = c.getContext("2d"); $("canvasStatus").textContent = c.width + " × " + c.height; return;
    }
    if (op.kind === "set") { canvasCtx[op.key] = op.value; return; }
    if (op.kind === "call" && typeof canvasCtx[op.method] === "function") canvasCtx[op.method](...(op.args || []));
  } catch (err) { console.error("Canvas operation failed:", err); }
}
function lineBreakIfNeeded() { if (!Term.atLineStart()) Term.write("\n"); }
function start() {
  const code = Editor.getValue(); Term.reset();
  try {
    const blob = new Blob(["(" + workerMain.toString() + ")()"], { type: "text/javascript" });
    workerUrl = URL.createObjectURL(blob);
    const w = worker = new Worker(workerUrl);
    w.onmessage = e => { if (w === worker) onMsg(e.data); };
    w.onerror = e => { e.preventDefault(); if (w === worker) { Term.write("\x1b[31;1m" + (e.message || "Worker error") + "\x1b[0m\n"); finish("error"); } };
    running = true; keysOn = 0; down.clear(); setStatus("running", "g");
    w.postMessage({ t: "start", code });
  } catch (err) {
    Term.write("\x1b[31;1mCannot start worker: " + err.message + "\x1b[0m\n");
    worker = null; running = false; setStatus("error");
  }
}
function onMsg(m) {
  switch (m.t) {
    case "out": Term.write(m.s); break;
    case "input": askInput(m.id, m.prompt); break;
    case "keys": keysOn = m.n; setStatus(m.n ? "running (listening for keys)" : "running", "g"); break;
    case "canvas-request": handleCanvasRequest(m); break;
    case "canvas-op": applyCanvasOp(m.op); break;
    case "done": finish("done"); break;
    case "error": showError(m); finish("error"); break;
  }
}
function showError(m) {
  let line = "";
  const mt = /(?:<anonymous>|AsyncFunction):(\d+):(\d+)/.exec(m.stack || "");
  if (mt) line = " (~line " + Math.max(1, mt[1] - 2) + ")";
  lineBreakIfNeeded(); Term.write("\x1b[0m\x1b[31;1mUncaught " + m.name + ": " + m.message + line + "\x1b[0m\n");
}
function finish(kind) {
  if (!running) return;
  running = false; removeKeyListeners();
  worker.terminate(); worker = null;
  if (workerUrl) { URL.revokeObjectURL(workerUrl); workerUrl = null; }
  keysOn = 0; curInput = null; returnViewAfterInput = null; down.clear();
  Term.unmark(); inp.value = ""; inp.disabled = true;
  const label = { done: "Program finished", stopped: "Program stopped", error: "Program exited with an error" }[kind];
  lineBreakIfNeeded(); Term.write("\x1b[0m\x1b[90m[" + label + "]\x1b[0m\n");
  setStatus(kind === "done" ? "finished" : kind === "stopped" ? "stopped" : "error", kind === "error" ? "" : "dim");
  if (kind === "error") statusEl.style.color = "#cc0000"; else statusEl.style.color = "";
}
function askInput(id, prompt) {
  returnViewAfterInput = !$("canvasView").hidden ? "canvas" : null;
  showTerm(); Term.write(prompt); Term.mark();
  curInput = id; inp.value = ""; inp.disabled = false; inp.focus();
}
const refresh = () => { if (curInput !== null) Term.edit(inp.value, inp.selectionStart); };
inp.addEventListener("input", refresh); inp.addEventListener("keyup", refresh); inp.addEventListener("click", refresh);
inp.addEventListener("keydown", e => {
  if (curInput === null || !running) return;
  if (e.key !== "Enter") { setTimeout(refresh, 0); return; }
  const v = inp.value, id = curInput;
  Term.edit(v, v.length); Term.unmark(); Term.write("\n");
  curInput = null; inp.value = ""; inp.disabled = true;
  worker.postMessage({ t: "inputResult", id, value: v });
  if (returnViewAfterInput === "canvas") { returnViewAfterInput = null; showCanvas(); } else returnViewAfterInput = null;
});
function sendKey(e, pressed) {
  if (!running) return;
  if (pressed) down.set(e.code, e.key); else { if (!down.has(e.code)) return; down.delete(e.code); }
  worker.postMessage({ t: "key", pressed, key: e.key, code: e.code, repeat: e.repeat,
    ctrlKey: e.ctrlKey, shiftKey: e.shiftKey, altKey: e.altKey, metaKey: e.metaKey });
  const typing = document.activeElement === inp && !inp.disabled;
  if (keysOn > 0 && !typing && !e.ctrlKey && !e.metaKey && !/^F\d+$/.test(e.key)) e.preventDefault();
}
const onDown = e => sendKey(e, true), onUp = e => sendKey(e, false);
function onBlur() {
  if (!running) return;
  for (const [code, key] of down) worker.postMessage({ t: "key", pressed: false, key, code, repeat: false });
  down.clear();
}
function addKeyListeners() { window.addEventListener("keydown", onDown); window.addEventListener("keyup", onUp); window.addEventListener("blur", onBlur); }
function removeKeyListeners() { window.removeEventListener("keydown", onDown); window.removeEventListener("keyup", onUp); window.removeEventListener("blur", onBlur); }


function run() {
  if (running) finish("stopped");
  removeKeyListeners(); canvasReady = false; $("canvasBtn").hidden = true; $("canvasStatus").textContent = "canvas not initialized";
  if (canvasCtx) { const c = $("canvasSurface"); canvasCtx.clearRect(0, 0, c.width, c.height); }
  showTerm(); addKeyListeners(); start();
}
$("run").onclick = run; $("restart").onclick = run; $("canvasRestart").onclick = run;
$("stop").onclick = () => finish("stopped"); $("canvasStop").onclick = () => finish("stopped");
$("clr").onclick = () => {
  Term.write("\x1b[2J\x1b[3J\x1b[H");
  if (curInput !== null) { Term.mark(); refresh(); inp.focus(); }
};
$("back").onclick = () => { if (running) finish("stopped"); removeKeyListeners(); showEditor(); };
$("canvasEditorBtn").onclick = () => { if (running) finish("stopped"); removeKeyListeners(); showEditor(); };
$("canvasBtn").onclick = showCanvas; $("canvasTerminalBtn").onclick = showTerm;
$("term").addEventListener("click", () => { if (!inp.disabled && !getSelection().toString()) inp.focus(); });
window.addEventListener("resize", () => { if (!$("termView").hidden) Term.measure(); });

$("foldall").onclick = () => { Editor.foldAll(); Editor.focus(); };
$("unfoldall").onclick = () => { Editor.unfoldAll(); Editor.focus(); };
let saveTimer = 0;
const KEY = "jsterm.code";
const FILE_NAME_KEY = "jsterm.filename.v1";
let currentFileName = "program.js";
let savedSnapshot = null;
let fileNotice = "Ready";

function cleanFileName(value) {
  let name = String(value || "").trim().replace(/[\\/:*?"<>|\x00-\x1f]/g, "-");
  name = name.replace(/^\.+$/, "");
  if (!name) name = "program.js";
  if (!/\.[a-z0-9]{1,12}$/i.test(name)) name += ".js";
  return name.slice(0, 180);
}
function isFileDirty() {
  return savedSnapshot !== null && Editor.getValue() !== savedSnapshot;
}
function updateFileUi() {
  const dirty = isFileDirty();
  const label = $("activeFileLabel");
  if (label) label.textContent = currentFileName + (dirty ? " *" : "");
  const nameInput = $("fileNameInput");
  if (nameInput && document.activeElement !== nameInput) nameInput.value = currentFileName;
  const current = $("fileCurrentLabel"); if (current) current.textContent = currentFileName + (dirty ? " *" : "");
  const state = $("fileState");
  if (state) state.textContent = fileNotice + (dirty ? " · modified (browser recovery autosave is on)" : " · no pending edits");
  document.title = currentFileName + " — js-term";
}
function storeCurrentToBrowser(markClean = false) {
  const code = Editor.getValue();
  try {
    localStorage.setItem(KEY, code);
    localStorage.setItem("jsterm.code.v3", code);
    localStorage.setItem(FILE_NAME_KEY, currentFileName);
    if (markClean) savedSnapshot = code;
    fileNotice = markClean ? "Saved in this browser" : "Auto-saved for recovery";
  } catch (e) {
    fileNotice = "Browser storage unavailable";
    if (markClean) savedSnapshot = code;
  }
  updateFileUi();
}
function mayReplaceCurrent(action) {
  const dirty = isFileDirty();
  const message = dirty
    ? action + "? Your current edits differ from the saved snapshot. Replace them anyway?"
    : action + "? This replaces the current editor contents.";
  return window.confirm(message);
}
function placePopup(panel, anchor, alignRight = false) {
  panel.hidden = false;
  const r = anchor.getBoundingClientRect();
  const w = panel.offsetWidth || 320;
  const left = Math.max(6, Math.min(alignRight ? r.right - w : r.left, window.innerWidth - w - 6));
  const top = Math.max(6, Math.min(r.bottom + 2, window.innerHeight - panel.offsetHeight - 6));
  panel.style.left = left + "px"; panel.style.top = top + "px";
}
function closeFileMenu(returnFocus = false) {
  $("fileMenu").hidden = true; $("fileMenuBtn").setAttribute("aria-expanded", "false");
  if (returnFocus) Editor.focus();
}
function openFileMenu() {
  if (!$("fileMenu").hidden) { closeFileMenu(false); return; }
  $("controlsPanel").hidden = true; $("controlsBtn").setAttribute("aria-expanded", "false");
  updateFileUi(); placePopup($("fileMenu"), $("fileMenuBtn"));
  $("fileMenuBtn").setAttribute("aria-expanded", "true");
}
function openControlsPanel() {
  if (!$("controlsPanel").hidden) { $("controlsPanel").hidden = true; $("controlsBtn").setAttribute("aria-expanded", "false"); return; }
  closeFileMenu(false); placePopup($("controlsPanel"), $("controlsBtn"), true);
  $("controlsBtn").setAttribute("aria-expanded", "true");
}
function downloadCurrentFile() {
  const code = Editor.getValue();
  const ext = (currentFileName.split(".").pop() || "js").toLowerCase();
  const type = ext === "json" ? "application/json;charset=utf-8"
    : ["html", "htm"].includes(ext) ? "text/html;charset=utf-8"
    : ext === "css" ? "text/css;charset=utf-8"
    : "text/javascript;charset=utf-8";
  const blob = new Blob([code], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = currentFileName; a.style.display = "none";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  fileNotice = "Exported " + currentFileName;
  updateFileUi();
}
async function copyCurrentSource() {
  const code = Editor.getValue();
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(code);
    } else {
      const temp = document.createElement("textarea");
      temp.value = code; temp.setAttribute("readonly", "");
      temp.style.position = "fixed"; temp.style.opacity = "0"; temp.style.left = "-9999px";
      document.body.appendChild(temp); temp.select();
      const ok = document.execCommand("copy"); temp.remove();
      if (!ok) throw new Error("Copy command was blocked");
    }
    fileNotice = "Source copied to clipboard";
  } catch (e) {
    fileNotice = "Clipboard access blocked by the browser";
    window.alert("The browser blocked clipboard access. You can still use Export / Download.");
  }
  updateFileUi();
}

Editor.init({ onRun: run, onChange: () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      const code = Editor.getValue();
      localStorage.setItem(KEY, code);
      localStorage.setItem("jsterm.code.v3", code);
      localStorage.setItem(FILE_NAME_KEY, currentFileName);
      fileNotice = "Auto-saved for recovery";
    } catch (e) { fileNotice = "Browser storage unavailable"; }
    updateFileUi();
  }, 400);
  updateFileUi();
} });
let initial = null;
try {
  initial = localStorage.getItem(KEY);
  if (initial === null) initial = localStorage.getItem("jsterm.code.v3");
  currentFileName = cleanFileName(localStorage.getItem(FILE_NAME_KEY) || "program.js");
} catch (e) {}
Editor.setValue(initial !== null ? initial : STARTER_SAMPLE);
savedSnapshot = Editor.getValue();
updateFileUi();
Editor.focus();

$("fileMenuBtn").addEventListener("click", openFileMenu);
$("fileClose").addEventListener("click", () => closeFileMenu(false));
$("controlsBtn").addEventListener("click", openControlsPanel);
$("controlsClose").addEventListener("click", () => { $("controlsPanel").hidden = true; $("controlsBtn").setAttribute("aria-expanded", "false"); });
window.addEventListener("pointerdown", e => {
  if (!$("fileMenu").hidden && !$("fileMenu").contains(e.target) && e.target !== $("fileMenuBtn")) closeFileMenu(false);
  if (!$("controlsPanel").hidden && !$("controlsPanel").contains(e.target) && e.target !== $("controlsBtn")) {
    $("controlsPanel").hidden = true; $("controlsBtn").setAttribute("aria-expanded", "false");
  }
});
window.addEventListener("keydown", e => {
  if (!e.defaultPrevented && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "g" &&
      !$("editorView").hidden && !(e.target instanceof Element && e.target.closest("#fileMenu, #controlsPanel"))) {
    e.preventDefault(); Editor.openGoToLine(); return;
  }
  if (e.key === "Escape") {
    if (!$("fileMenu").hidden) { closeFileMenu(false); e.preventDefault(); }
    if (!$("controlsPanel").hidden) { $("controlsPanel").hidden = true; $("controlsBtn").setAttribute("aria-expanded", "false"); e.preventDefault(); }
  }
});
$("fileNew").addEventListener("click", () => {
  if (!mayReplaceCurrent("Create a new empty file")) return;
  currentFileName = "untitled.js";
  savedSnapshot = "";
  Editor.setValue("");
  storeCurrentToBrowser(true);
  closeFileMenu(true);
});
$("fileImportBtn").addEventListener("click", () => { closeFileMenu(false); $("fileImportInput").click(); });
$("fileImportInput").addEventListener("change", async e => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  if (!mayReplaceCurrent("Import " + file.name)) { e.target.value = ""; return; }
  try {
    const code = await file.text();
    currentFileName = cleanFileName(file.name);
    savedSnapshot = null;
    Editor.setValue(code);
    savedSnapshot = Editor.getValue();
    storeCurrentToBrowser(true);
    fileNotice = "Imported " + file.name;
    updateFileUi();
    closeFileMenu(true);
  } catch (err) {
    window.alert("Could not read that file: " + (err && err.message || err));
  } finally { e.target.value = ""; }
});
$("fileExport").addEventListener("click", () => { downloadCurrentFile(); closeFileMenu(false); });
$("fileSave").addEventListener("click", () => { storeCurrentToBrowser(true); closeFileMenu(false); });
$("fileCopy").addEventListener("click", () => { copyCurrentSource(); closeFileMenu(false); });
$("fileRename").addEventListener("click", () => {
  currentFileName = cleanFileName($("fileNameInput").value);
  $("fileNameInput").value = currentFileName;
  try { localStorage.setItem(FILE_NAME_KEY, currentFileName); } catch (e) {}
  fileNotice = "Filename updated";
  updateFileUi();
});
$("fileNameInput").addEventListener("keydown", e => {
  if (e.key === "Enter") { e.preventDefault(); $("fileRename").click(); }
  if (e.key === "Escape") closeFileMenu(false);
});
$("fileStarter").addEventListener("click", () => {
  if (!mayReplaceCurrent("Restore the starter sample")) return;
  currentFileName = "program.js";
  const code = STARTER_SAMPLE;
  savedSnapshot = null;
  Editor.setValue(code);
  savedSnapshot = Editor.getValue();
  storeCurrentToBrowser(true);
  fileNotice = "Starter sample restored";
  updateFileUi();
  closeFileMenu(true);
});
