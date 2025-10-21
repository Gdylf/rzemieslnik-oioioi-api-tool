// static/script.js - unified, self-contained
const API_URL = window.location.origin;
let problemsData = [];

// ---------- utilities ----------
function id(sel) { return document.getElementById(sel); }
function logv(...args) { console.log("[rzm]", ...args); }

// ---------- contests ----------
let contestsCache = [];
async function loadContests(){
  try{
    const r = await fetch("static/contesty.json");
    const j = await r.json();
    contestsCache = j.map(c => typeof c === "string" ? {id:c,name:c} : (c.id ? c : {id:c,name:c}));
    renderContestList(contestsCache);
    logv("Contests loaded", contestsCache.length);
  }catch(e){
    console.error("loadContests:", e);
    id("contest-list").innerHTML = `<div class="p-2 text-red-400">Błąd ładowania kontestów</div>`;
  }
}
function renderContestList(items){
  const list = id("contest-list");
  list.innerHTML = "";
  items.forEach(c=>{
    const div = document.createElement("div");
    div.className = "px-4 py-2 text-gray-200 hover:bg-violet-600 hover:text-white cursor-pointer";
    div.textContent = c.name || c.id;
    div.onclick = async () => {
      id("contest-input").value = c.id || c.name;
      toggleContestList(false);
      await loadProblemsForSelectedContest();
    };
    list.appendChild(div);
  });
}
function filterContests(){
  const q = (id("contest-input").value || "").toLowerCase();
  const filtered = contestsCache.filter(c => (c.name||"").toLowerCase().includes(q) || (c.id||"").toLowerCase().includes(q));
  renderContestList(filtered);
  toggleContestList(true);
}
function toggleContestList(show){
  id("contest-list").classList.toggle("hidden", !show);
}
document.addEventListener("click", e=>{
  if(!e.target.closest("#contest-list") && !e.target.closest("#contest-input")) toggleContestList(false);
});

// ---------- tokens ----------
async function loadTokens(){
  try{
    const r = await fetch("/static/tokeny.json");
    const tokens = await r.json();
    const tbody = id("token-db-body");
    tbody.innerHTML = "";
    if(!tokens || tokens.length === 0){
      tbody.innerHTML = `<tr><td colspan="4" class="logs-empty">Brak zapisanych tokenów.</td></tr>`;
      return;
    }
    tokens.forEach(entry=>{
      const name = Object.keys(entry)[0];
      const token = entry[name];
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="px-4 py-2">${name}</td>
        <td class="px-4 py-2" title="${token}">${token.substring(0,8)}...</td>
        <td class="px-4 py-2" data-token="${token}"><span class="status-text">-</span></td>
        <td class="px-4 py-2">
          <button class="btn-mini bg-sky-500/50" onclick="copyToken('${token}')">Kopiuj</button>
          <button class="btn-mini bg-sky-500/50" onclick="useToken('${token}')">Użyj</button>
        </td>`;
      tbody.appendChild(tr);
    });
    logv("Tokens loaded");
  }catch(e){
    console.error("loadTokens:", e);
    id("token-db-body").innerHTML = `<tr><td colspan="4" class="logs-empty status-fail">Nie udało się załadować bazy tokenów.</td></tr>`;
  }
}

async function checkAllTokens(){
  const tbody = id("token-db-body");
  const statusCells = tbody.querySelectorAll("[data-token]");
  if(statusCells.length === 0){ alert("Brak tokenów do sprawdzenia."); return; }
  statusCells.forEach(cell=>{
    const span = cell.querySelector(".status-text");
    span.innerHTML = '<i data-feather="loader" class="animate-spin"></i>';
    cell.title = "Sprawdzanie...";
  });
  feather.replace();
  await Promise.all(Array.from(statusCells).map(async cell=>{
    const token = cell.dataset.token;
    const span = cell.querySelector(".status-text");
    try{
      const res = await fetch(`${API_URL}/check_token`, {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({token})});
      const data = await res.json();
      if(data.valid){ span.innerHTML = '<i data-feather="check-circle"></i>'; cell.title = data.username || "OK"; }
      else { span.innerHTML = '<i data-feather="x-circle"></i>'; cell.title = data.error || "Niepoprawny"; }
    }catch(e){
      span.innerHTML = '<i data-feather="alert-circle"></i>'; cell.title = "Błąd komunikacji";
    }
    feather.replace();
  }));
}

// ---------- dropzone & problems loading ----------
function setupDropZone(){
  const drop = id("problemy-drop");
  const file = id("problemy-file");
  if(!drop || !file){ console.warn("No dropzone elements"); return; }
  ["dragenter","dragover","dragleave","drop"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); }));
  ["dragenter","dragover"].forEach(ev => drop.addEventListener(ev, ()=>drop.classList.add("drag-over")));
  ["dragleave","drop"].forEach(ev => drop.addEventListener(ev, ()=>drop.classList.remove("drag-over")));
  drop.addEventListener("drop", e => readFiles(e.dataTransfer.files));
  drop.addEventListener("click", ()=>file.click());
  file.addEventListener("change", e => readFiles(e.target.files));

  function readFiles(files){
    if(!files || files.length === 0) return;
    const f = files[0];
    if(!f.name.endsWith(".json")) { id("problemy-status").textContent = "Wymagany plik .json"; return; }
    const r = new FileReader();
    r.onload = ev => {
      try{
        const parsed = JSON.parse(ev.target.result);
        problemsData = parsed;
        id("problemy-status").textContent = `Załadowano ${problemsData.length} z problemów z pliku`;
        rebuildProblemDropdowns(problemsData);
      }catch(e){
        console.error("parse problems.json", e);
        id("problemy-status").textContent = "Błąd: nieprawidłowy JSON";
      }
    };
    r.readAsText(f);
  }
}

// load contest-specific file
async function loadProblemsForSelectedContest(){
  const contest = (id("contest-input")?.value || "").trim();
  if(!contest){ id("problemy-status").textContent = "Najpierw wybierz kontest."; return; }
  const url = `static/problemy/problemy-${contest}.json`;
  try{
    const r = await fetch(url);
    if(!r.ok) throw new Error("not found");
    const j = await r.json();
    problemsData = j;
    id("problemy-status").textContent = `Załadowano ${j.length} zadań dla ${contest}`;
    rebuildProblemDropdowns(problemsData);
  }catch(e){
    console.warn("loadProblemsForSelectedContest:", e);
    id("problemy-status").textContent = `Nie znaleziono pliku dla ${contest}`;
  }
}

// ---------- rebuild unified dropdown lists ----------
function rebuildProblemDropdowns(data){
  if(!Array.isArray(data)) data = [];
  // ensure elements exist
  const pairs = [
    { kind: "multi", inputId: "multi-problems-text", listId: "multi-problems-list" },
    { kind: "sybau", inputId: "multi-sybau-problems-text", listId: "multi-sybau-problems-list" }
  ];

  pairs.forEach(({kind,inputId,listId})=>{
    const input = id(inputId);
    const list = id(listId);
    if(!input || !list){ console.warn("Missing", inputId, listId); return; }

    // build header with filter + select all + clear button
    // build header (no internal filter input)
    list.innerHTML = `
      <div class="p-2 border-b border-gray-700 sticky top-0 bg-gray-800">
        <div class="flex gap-2 items-center">
          <button class="select-all-btn" data-kind="${kind}" onclick="selectAllVisible('${kind}'); event.stopPropagation();">Zaznacz wszystkie</button>
          <button class="select-all-btn" style="background:#374151" data-kind="${kind}" onclick="clearSelection('${kind}'); event.stopPropagation();">✕ Wyczyść</button>
        </div>
      </div>
    `;


    const container = document.createElement("div");
    container.className = "p-1";
    data.forEach(item=>{
      const short = item.short_name || item.short || item.id || "";
      const full = item.full_name || item.full || "";
      const row = document.createElement("div");
      row.className = "checkbox-item hover:bg-gray-700 rounded-md";
      row.dataset.short = (short || "").toLowerCase();
      row.dataset.full = (full || "").toLowerCase();

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.value = short;
      cb.style.marginRight = "0.5rem";

      const lbl = document.createElement("span");
      lbl.textContent = `${short} (${full})`;

      row.appendChild(cb);
      row.appendChild(lbl);

      // clicking row toggles
      row.addEventListener("click", (ev) => {
        // if clicked input, default toggles; otherwise toggle programmatically
        if(ev.target === cb) { /* input toggled already */ }
        else cb.checked = !cb.checked;
        row.classList.toggle("selected", cb.checked);
        updateSelectedToInput(kind);
      });

      cb.addEventListener("change", () => {
        row.classList.toggle("selected", cb.checked);
        updateSelectedToInput(kind);
      });

      container.appendChild(row);
    });

    list.appendChild(container);

    // enhanced filtering & auto-selection based on typed text
    input.addEventListener("input", () => {
      const raw = input.value || "";
      const parts = raw.split(/[, ]+/).map(s => s.trim().toLowerCase()).filter(Boolean);
    
      // filter visible rows
      container.querySelectorAll(".checkbox-item").forEach(r => {
        const short = r.dataset.short;
        const full = r.dataset.full;
        const visible = parts.length === 0 ||
          parts.some(p => short.includes(p) || full.includes(p));
        r.style.display = visible ? "" : "none";
      
        // auto-select if exact short match typed
        const cb = r.querySelector("input[type='checkbox']");
        if (cb) {
          const shouldCheck = parts.includes(short);
          if (shouldCheck !== cb.checked) {
            cb.checked = shouldCheck;
            r.classList.toggle("selected", cb.checked);
          }
        }
        r.dataset.matched = parts.includes(short) ? "1" : "";
      });
    // preserve unknown custom entries
    const knownShorts = Array.from(container.querySelectorAll(".checkbox-item"))
      .filter(r => r.dataset.matched === "1")
      .map(r => r.dataset.short);
        
    const unknown = parts.filter(p => !knownShorts.includes(p));
    if (unknown.length) {
      // append unknowns to input text (so they stay visible)
      const checkedKnown = Array.from(container.querySelectorAll("input[type='checkbox']:checked"))
        .map(cb => cb.value);
      input.value = [...checkedKnown, ...unknown].join(", ");
    }

      updateSelectedToInput(kind); // keep text normalized (comma+space)
      list.classList.remove("hidden");
    });



    // show/hide behaviour
    input.addEventListener("focus", () => list.classList.remove("hidden"));
    input.addEventListener("click", () => list.classList.toggle("hidden"));
    document.addEventListener("click", (e) => {
      if(!e.target.closest(`#${listId}`) && e.target !== input) list.classList.add("hidden");
    });

    // ensure feather icons replaced if any
    feather.replace();
  });

  // set initial inputs from any existing checked state
  updateSelectedToInput("multi");
  updateSelectedToInput("sybau");
  logv("Rebuilt dropdowns with", data.length, "items");
}

// helper: select all visible checkboxes in list
function selectAllVisible(kind){
  const listId = kind === "multi" ? "multi-problems-list" : "multi-sybau-problems-list";
  const list = id(listId);
  if(!list) return;
  const rows = Array.from(list.querySelectorAll(".checkbox-item")).filter(r => r.style.display !== "none");
  rows.forEach(r => {
    const cb = r.querySelector("input[type='checkbox']");
    if(cb){ cb.checked = true; r.classList.add("selected"); }
  });
  updateSelectedToInput(kind);
}
function clearSelection(kind){
  const listId = kind === "multi" ? "multi-problems-list" : "multi-sybau-problems-list";
  const list = id(listId);
  if(!list) return;
  list.querySelectorAll(".checkbox-item").forEach(r => {
    const cb = r.querySelector("input[type='checkbox']");
    if(cb){ cb.checked = false; r.classList.remove("selected"); }
  });
  updateSelectedToInput(kind);
}

// update visible input value based on checked boxes
function updateSelectedToInput(kind){
  const listId = kind === "multi" ? "multi-problems-list" : "multi-sybau-problems-list";
  const inputId = kind === "multi" ? "multi-problems-text" : "multi-sybau-problems-text";
  const checks = Array.from(document.querySelectorAll(`#${listId} input[type='checkbox']:checked`)).map(cb => cb.value);
  const input = id(inputId);
  if (input) {
  input.value = checks.join(", ");
}
}

// ---------- get code / file ----------
async function getCode(codeId, fileId){
  const code = id(codeId)?.value || "";
  const fileInput = id(fileId);
  const file = fileInput?.files?.[0] || null;
  if(code) return code;
  if(file){
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = e => resolve(e.target.result);
      r.onerror = () => reject(new Error("Błąd odczytu pliku"));
      r.readAsText(file);
    });
  }
  return null;
}

// ---------- submissions ----------
async function performSubmit(endpoint, payload){
  try{
    const r = await fetch(`${API_URL}/${endpoint}`, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify(payload)
    });
    const j = await r.json();
    if(j.success) alert("Sukces: "+(j.message||""));
    else alert("Błąd: "+(j.error||j.message||JSON.stringify(j)));
    refreshLogs();
  }catch(e){
    console.error("performSubmit", e);
    alert("Błąd komunikacji z serwerem API.");
  }
}

async function multiSubmit(){
  const token = (id("token")?.value || "").trim();
  const contest = (id("contest-input")?.value || "").trim();
  const repeat = parseInt(id("multi-repeat")?.value || "1");
  const concurrency = parseInt(id("multi-concurrency")?.value || "5");
  const problems = (id("multi-problems-text")?.value || "").trim(); // comma-space separated
  if(!token || !contest || !problems){ alert("Wypełnij Token, Contest i wybierz zadania."); return; }
  const code = await getCode("multi-code", "multi-file");
  if(!code){ alert("Wklej kod lub wybierz plik."); return; }
  const payload = { token, contest, problems, code, repeat, concurrency };
  performSubmit("multi_submit", payload);
}

async function multiSybauSubmit(){
  const token = (id("token")?.value || "").trim();
  const contest = (id("contest-input")?.value || "").trim();
  const repeat = parseInt(id("multi-sybau-repeat")?.value || "1");
  const concurrency = parseInt(id("multi-sybau-concurrency")?.value || "5");
  const problems = (id("multi-sybau-problems-text")?.value || "").trim();
  if(!token || !contest || !problems){ alert("Wypełnij Token, Contest i wybierz zadania."); return; }
  const payload = { token, contest, problems, repeat, concurrency };
  performSubmit("spam_submit", payload);
}

// ---------- token helpers ----------
function useToken(t){ if(id("token")) id("token").value = t; checkToken(); }
function copyToken(t){ navigator.clipboard.writeText(t).then(()=>alert("Token skopiowany"), ()=>alert("Błąd kopiowania")); }

// ---------- check token (robust) ----------
let _tokenCheck = { controller: null, inProgress: false };
async function checkToken(){
  const token = (id("token")?.value || "").trim();
  const status = id("token-status");
  const uname = id("token-username");
  if(!status) return;
  status.className = "status-message";
  status.textContent = "Sprawdzanie...";
  if(!token){ status.textContent = "Wklej token API."; status.className = "status-fail"; return; }

  if(_tokenCheck.inProgress && _tokenCheck.controller){ try{ _tokenCheck.controller.abort(); }catch{} }
  const controller = new AbortController();
  _tokenCheck.controller = controller; _tokenCheck.inProgress = true;
  const timeout = setTimeout(()=>controller.abort(), 7000);
  try{
    const resp = await fetch(`${API_URL}/check_token`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({token}), signal: controller.signal });
    _tokenCheck.inProgress = false; clearTimeout(timeout); _tokenCheck.controller = null;
    const raw = await resp.text();
    let data = null;
    const t = raw.trim();
    if(t.startsWith("{")||t.startsWith("[")){ try{ data = JSON.parse(t); }catch(e){ data = { valid:false, error: "Invalid JSON", raw: t }; } }
    else {
      data = { valid:false, error: t };
      const m = t.match(/pong\s+(.+)/i);
      if(m) data = { valid:true, username: m[1].trim() };
      else if(["ok","success","valid","pong"].includes(t.toLowerCase())) data = { valid:true, username: "zalogowany" };
    }
    if(data && data.valid){ status.textContent = "✅ Token poprawny"; status.className = "status-ok"; uname.textContent = `Zalogowano jako: ${data.username||"?"}`; }
    else { status.textContent = `❌ Błąd tokena: ${data.error || data.message || "Nieznany"}`; status.className = "status-fail"; uname.textContent = ""; }
  }catch(err){
    clearTimeout(timeout); _tokenCheck.inProgress = false; _tokenCheck.controller = null;
    console.error("checkToken error", err);
    if(err.name === "AbortError") status.textContent = "⏱️ Przekroczono czas (frontend).";
    else status.textContent = `❌ Błąd komunikacji: ${err.message||err}`;
    status.className = "status-fail";
    uname.textContent = "";
  }
}

// ---------- logs ----------
async function refreshLogs(){
  const body = id("logs-body");
  try{
    const r = await fetch(`${API_URL}/get_logs`);
    if(!r.ok) throw new Error("http:"+r.status);
    const logs = await r.json();
    body.innerHTML = "";
    if(!logs || logs.length===0){ body.innerHTML = `<tr><td colspan="4" class="logs-empty">Brak zakończonych zleceń. Wyślij pierwszy submit!</td></tr>`; return; }
    logs.forEach(l=>{
      const tr = document.createElement("tr");
      tr.innerHTML = `<td class="px-4 py-2">${l.timestamp}</td><td class="px-4 py-2">${l.problem} (${l.contest})</td><td class="px-4 py-2 ${l.status==="OK" ? "status-ok" : "status-fail"}">${l.status}</td><td class="px-4 py-2 response-text">${l.response}</td>`;
      body.appendChild(tr);
    });
  }catch(e){
    console.error("refreshLogs", e);
    body.innerHTML = `<tr><td colspan="4" class="logs-empty status-fail">Nie udało się załadować logów z serwera.</td></tr>`;
  }
}
async function clearLogs(){
  try{
    const r = await fetch(`${API_URL}/clear_logs`, { method:"POST" });
    if(r.ok) refreshLogs(); else alert("Błąd czyszczenia logów");
  }catch(e){ alert("Błąd komunikacji z serwerem API."); }
}

// ---------- start ----------
document.addEventListener("DOMContentLoaded", ()=>{
  logv("DOM ready");
  loadContests();
  loadTokens();
  setupDropZone();
  refreshLogs();

  // If you already have a static problems file 'problemy.json' in root, you could auto-load it:
  // fetch('static/problemy/problemy.json').then(r=>r.json()).then(j=>{problemsData=j; rebuildProblemDropdowns(j);}).catch(()=>{});
});
