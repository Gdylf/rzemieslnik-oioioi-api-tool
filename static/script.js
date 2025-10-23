// static/script.js — unified version (manual typing + filtering + custom items + backspace remove)
const API_URL = window.location.origin;
let problemsData = [];

// ---------- utilities ----------
function id(sel) { return document.getElementById(sel); }
function logv(...args) { console.log("[rzm]", ...args); }

// ---------- contests ----------
let contestsCache = [];
async function loadContests() {
  try {
    const r = await fetch("static/contesty.json");
    const j = await r.json();
    contestsCache = j.map(c => typeof c === "string" ? { id: c, name: c } : (c.id ? c : { id: c, name: c }));
    renderContestList(contestsCache);
  } catch (e) {
    console.error("loadContests:", e);
    id("contest-list").innerHTML = `<div class="p-2 text-red-400">Błąd ładowania kontestów</div>`;
  }
}

function renderContestList(items) {
  const list = id("contest-list");
  list.innerHTML = "";
  items.forEach(c => {
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

function filterContests() {
  const q = (id("contest-input").value || "").toLowerCase();
  const filtered = contestsCache.filter(c =>
    (c.name || "").toLowerCase().includes(q) || (c.id || "").toLowerCase().includes(q)
  );
  renderContestList(filtered);
  toggleContestList(true);
}
function toggleContestList(show) {
  id("contest-list").classList.toggle("hidden", !show);
}
document.addEventListener("click", e => {
  if (!e.target.closest("#contest-list") && !e.target.closest("#contest-input")) toggleContestList(false);
});

// ---------- tokens ----------
async function loadTokens() {
  try {
    const r = await fetch("/static/tokeny.json");
    const tokens = await r.json();
    const tbody = id("token-db-body");
    tbody.innerHTML = "";
    if (!tokens || tokens.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="logs-empty">Brak zapisanych tokenów.</td></tr>`;
      return;
    }
    tokens.forEach(entry => {
      const name = Object.keys(entry)[0];
      const token = entry[name];
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="px-4 py-2">${name}</td>
        <td class="px-4 py-2" title="${token}">${token.substring(0, 8)}...</td>
        <td class="px-4 py-2" data-token="${token}"><span class="status-text">-</span></td>
        <td class="px-4 py-2">
          <button class="btn-mini bg-sky-500/50" onclick="copyToken('${token}')">Kopiuj</button>
          <button class="btn-mini bg-sky-500/50" onclick="useToken('${token}')">Użyj</button>
        </td>`;
      tbody.appendChild(tr);
    });
  } catch {
    id("token-db-body").innerHTML =
      `<tr><td colspan="4" class="logs-empty status-fail">Nie udało się załadować bazy tokenów.</td></tr>`;
  }
}
// ---------- dropzone ----------
function setupDropZone() {
  const drop = id("problemy-drop");
  const file = id("problemy-file");
  if (!drop || !file) return;
  ["dragenter", "dragover", "dragleave", "drop"].forEach(ev =>
    drop.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); })
  );
  ["dragenter", "dragover"].forEach(ev => drop.addEventListener(ev, () => drop.classList.add("drag-over")));
  ["dragleave", "drop"].forEach(ev => drop.addEventListener(ev, () => drop.classList.remove("drag-over")));
  drop.addEventListener("drop", e => readFiles(e.dataTransfer.files));
  drop.addEventListener("click", () => file.click());
  file.addEventListener("change", e => readFiles(e.target.files));

  function readFiles(files) {
    if (!files || files.length === 0) return;
    const f = files[0];
    if (!f.name.endsWith(".json")) { id("problemy-status").textContent = "Wymagany plik .json"; return; }
    const r = new FileReader();
    r.onload = ev => {
      try {
        const parsed = JSON.parse(ev.target.result);
        problemsData = parsed;
        id("problemy-status").textContent = `Załadowano ${problemsData.length} problemów z pliku`;
        rebuildProblemDropdowns(problemsData);
      } catch {
        id("problemy-status").textContent = "Błąd: nieprawidłowy JSON";
      }
    };
    r.readAsText(f);
  }
}

// ---------- load problems ----------
async function loadProblemsForSelectedContest() {
  const contest = (id("contest-input")?.value || "").trim();
  if (!contest) { id("problemy-status").textContent = "Najpierw wybierz kontest."; return; }
  try {
    const r = await fetch(`static/problemy/problemy-${contest}.json`);
    if (!r.ok) throw new Error("not found");
    const j = await r.json();
    problemsData = j;
    id("problemy-status").textContent = `Załadowano ${j.length} zadań dla ${contest}`;
    rebuildProblemDropdowns(problemsData);
  } catch {
    id("problemy-status").textContent = `Nie znaleziono pliku dla ${contest}`;
  }
}
// ---------- dropdowns ----------
function rebuildProblemDropdowns(data) {
  if (!Array.isArray(data)) data = [];
  const pairs = [
    { kind: "multi", inputId: "multi-problems-text", listId: "multi-problems-list" },
    { kind: "sybau", inputId: "multi-sybau-problems-text", listId: "multi-sybau-problems-list" }
  ];

  pairs.forEach(({ kind, inputId, listId }) => {
    const input = id(inputId);
    const list = id(listId);
    if (!input || !list) return;

    list.innerHTML = `
      <div class="p-2 border-b border-gray-700 sticky top-0 bg-gray-800">
        <div class="flex gap-2 items-center">
          <button class="select-all-btn" onclick="selectAllVisible('${kind}');event.stopPropagation();">Zaznacz wszystkie</button>
          <button class="select-all-btn" style="background:#374151" onclick="clearSelection('${kind}');event.stopPropagation();">✕ Wyczyść</button>
        </div>
      </div>
    `;

    const container = document.createElement("div");
    container.className = "p-1";

    data.forEach(item => {
      const short = (item.short_name || item.short || item.id || "").toString();
      const full  = (item.full_name  || item.full  || "").toString();
      const row   = document.createElement("div");
      row.className = "checkbox-item hover:bg-gray-700 rounded-md";
      row.dataset.short = short.toLowerCase();
      row.dataset.full  = full.toLowerCase();

      const cb = document.createElement("input");
      cb.type  = "checkbox";
      cb.value = short;
      cb.style.marginRight = "0.5rem";

      const lbl = document.createElement("span");
      lbl.textContent = `${short} (${full})`;

      row.append(cb, lbl);

      const toggle = () => {
        row.classList.toggle("selected", cb.checked);
        updateSelectedToInput(kind);
      };
      row.addEventListener("click", e => { if (e.target !== cb) cb.checked = !cb.checked; toggle(); });
      cb.addEventListener("change", toggle);
      container.appendChild(row);
    });
    list.appendChild(container);

    // --- typing & filter ---
    input.addEventListener("input", () => {
      const q = input.value.toLowerCase();
      container.querySelectorAll(".checkbox-item").forEach(r => {
        const vis = (!q) || r.dataset.short.includes(q) || r.dataset.full.includes(q);
        r.style.display = vis ? "" : "none";
      });

      // when typing comma-space, add custom and reopen list
      if (input.value.endsWith(", ")) {
        addCustomTokensFromInput(kind);
        container.querySelectorAll(".checkbox-item").forEach(r => r.style.display = "");
        list.classList.remove("hidden");
      } else list.classList.remove("hidden");
    });

    // --- keyboard ---
    input.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        e.preventDefault();
        syncTypedProblems(kind);
        list.classList.add("hidden");
      } else if (e.key === "Backspace" && input.value.trim() === "") {
        // remove last selected tag
        const sel = container.querySelectorAll(".checkbox-item.selected input[type='checkbox']");
        if (sel.length) {
          const last = sel[sel.length - 1];
          last.checked = false;
          last.closest(".checkbox-item").classList.remove("selected");
          updateSelectedToInput(kind);
          e.preventDefault();
        }
      }
    });

    input.addEventListener("blur", () => syncTypedProblems(kind));
    input.addEventListener("focus", () => list.classList.remove("hidden"));
    document.addEventListener("click", e => {
      if (!e.target.closest(`#${listId}`) && e.target !== input) list.classList.add("hidden");
    });

    feather.replace();
  });

  updateSelectedToInput("multi");
  updateSelectedToInput("sybau");
}

// ---------- add custom ----------
function addCustomTokensFromInput(kind) {
  const inputId = kind === "multi" ? "multi-problems-text" : "multi-sybau-problems-text";
  const listId  = kind === "multi" ? "multi-problems-list"  : "multi-sybau-problems-list";
  const input = id(inputId), list = id(listId);
  if (!input || !list) return;
  const container = list.querySelector(".p-1");
  if (!container) return;

  const tokens = input.value.split(",").map(s => s.trim()).filter(Boolean);
  tokens.forEach(token => {
    const low = token.toLowerCase();
    let row = [...container.querySelectorAll(".checkbox-item")].find(r => r.dataset.short === low);
    if (!row) {
      row = document.createElement("div");
      row.className = "checkbox-item hover:bg-gray-700 rounded-md custom-item selected";
      row.dataset.short = low;
      row.dataset.full  = "custom";

      const cb = document.createElement("input");
      cb.type = "checkbox"; cb.value = token; cb.checked = true; cb.style.marginRight = "0.5rem";
      const lbl = document.createElement("span"); lbl.textContent = `${token} (custom)`;
      row.append(cb, lbl);
      row.addEventListener("click", e => { if (e.target !== cb) cb.checked = !cb.checked; row.classList.toggle("selected", cb.checked); updateSelectedToInput(kind); });
      cb.addEventListener("change", () => { row.classList.toggle("selected", cb.checked); updateSelectedToInput(kind); });
      container.appendChild(row);
    } else {
      const cb = row.querySelector("input");
      if (cb) { cb.checked = true; row.classList.add("selected"); }
    }
  });

  updateSelectedToInput(kind);
  const checked = [...container.querySelectorAll("input:checked")].map(cb => cb.value);
  input.value = checked.join(", ") + (checked.length ? ", " : "");
}
// ---------- sync typed ----------
function syncTypedProblems(kind) {
  const listId  = kind === "multi" ? "multi-problems-list"  : "multi-sybau-problems-list";
  const list    = id(listId);
  const inputId = kind === "multi" ? "multi-problems-text" : "multi-sybau-problems-text";
  const input   = id(inputId);
  if (!list || !input) return;
  const container = list.querySelector(".p-1");
  if (!container) return;

  const parts = input.value.split(",").map(p => p.trim()).filter(Boolean);
  const existing = [...container.querySelectorAll(".checkbox-item")].map(r => r.dataset.short);

  // add missing custom
  parts.forEach(p => {
    const short = p.toLowerCase();
    if (!existing.includes(short)) {
      const row = document.createElement("div");
      row.className = "checkbox-item hover:bg-gray-700 rounded-md custom-item selected";
      row.dataset.short = short;
      row.dataset.full  = "custom";

      const cb = document.createElement("input");
      cb.type = "checkbox"; cb.value = p; cb.checked = true; cb.style.marginRight = "0.5rem";
      const lbl = document.createElement("span"); lbl.textContent = `${p} (custom)`;
      row.append(cb, lbl);
      row.addEventListener("click", e => { if (e.target !== cb) cb.checked = !cb.checked; row.classList.toggle("selected", cb.checked); updateSelectedToInput(kind); });
      cb.addEventListener("change", () => { row.classList.toggle("selected", cb.checked); updateSelectedToInput(kind); });
      container.appendChild(row);
    }
  });

  // update checkboxes
  container.querySelectorAll(".checkbox-item").forEach(r => {
    const cb = r.querySelector("input");
    const short = r.dataset.short;
    const should = parts.includes(short);
    if (cb) { cb.checked = should; r.classList.toggle("selected", should); }
  });

  const checked = [...container.querySelectorAll("input:checked")].map(cb => cb.value);
  input.value = checked.join(", ");
}

// ---------- helpers ----------
function selectAllVisible(kind) {
  const listId = kind === "multi" ? "multi-problems-list" : "multi-sybau-problems-list";
  const list = id(listId);
  if (!list) return;
  list.querySelectorAll(".checkbox-item").forEach(r => {
    if (r.style.display !== "none") {
      const cb = r.querySelector("input");
      cb.checked = true;
      r.classList.add("selected");
    }
  });
  updateSelectedToInput(kind);
}

function clearSelection(kind) {
  const listId = kind === "multi" ? "multi-problems-list" : "multi-sybau-problems-list";
  const list = id(listId);
  if (!list) return;
  list.querySelectorAll(".checkbox-item").forEach(r => {
    const cb = r.querySelector("input");
    cb.checked = false;
    r.classList.remove("selected");
  });
  updateSelectedToInput(kind);
}

function updateSelectedToInput(kind) {
  const listId = kind === "multi" ? "multi-problems-list" : "multi-sybau-problems-list";
  const inputId = kind === "multi" ? "multi-problems-text" : "multi-sybau-problems-text";
  const checks = [...document.querySelectorAll(`#${listId} input:checked`)].map(cb => cb.value);
  const input = id(inputId);
  if (input) input.value = checks.join(", ");
}

// ---------- submissions ----------
async function getCode(codeId, fileId) {
  const code = id(codeId)?.value || "";
  const fileInput = id(fileId);
  const file = fileInput?.files?.[0];
  if (code) return code;
  if (file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = e => resolve(e.target.result);
      r.onerror = () => reject(new Error("Błąd odczytu pliku"));
      r.readAsText(file);
    });
  }
  return null;
}

async function performSubmit(endpoint, payload) {
  try {
    const r = await fetch(`${API_URL}/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const j = await r.json();
    if (j.success) alert("✅ Sukces: " + (j.message || ""));
    else alert("❌ Błąd: " + (j.error || j.message || JSON.stringify(j)));
    refreshLogs();
  } catch {
    alert("Błąd komunikacji z serwerem API.");
  }
}

async function multiSubmit() {
  const token = id("token").value.trim();
  const contest = id("contest-input").value.trim();
  const repeat = parseInt(id("multi-repeat").value || "1");
  const concurrency = parseInt(id("multi-concurrency").value || "5");
  const problems = id("multi-problems-text").value.trim();
  if (!token || !contest || !problems) return alert("⚠️ Wypełnij Token, Contest i wybierz zadania.");
  const code = await getCode("multi-code", "multi-file");
  if (!code) return alert("⚠️ Wklej kod lub wybierz plik.");
  performSubmit("multi_submit", { token, contest, problems, code, repeat, concurrency });
}

async function multiSybauSubmit() {
  const token = id("token").value.trim();
  const contest = id("contest-input").value.trim();
  const repeat = parseInt(id("multi-sybau-repeat").value || "1");
  const concurrency = parseInt(id("multi-sybau-concurrency").value || "5");
  const problems = id("multi-sybau-problems-text").value.trim();
  if (!token || !contest || !problems) return alert("⚠️ Wypełnij Token, Contest i wybierz zadania.");
  performSubmit("spam_submit", { token, contest, problems, repeat, concurrency });
}

// ---------- logs ----------
async function refreshLogs() {
  const body = id("logs-body");
  try {
    const r = await fetch(`${API_URL}/get_logs`);
    const logs = await r.json();
    body.innerHTML = "";
    if (!logs?.length) {
      body.innerHTML = `<tr><td colspan="4" class="logs-empty">Brak zakończonych zleceń.</td></tr>`;
      return;
    }
    logs.forEach(l => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="px-4 py-2">${l.timestamp}</td>
        <td class="px-4 py-2">${l.problem} (${l.contest})</td>
        <td class="px-4 py-2 ${l.status === "OK" ? "status-ok" : "status-fail"}">${l.status}</td>
        <td class="px-4 py-2 response-text">${l.response}</td>`;
      body.appendChild(tr);
    });
  } catch {
    body.innerHTML = `<tr><td colspan="4" class="logs-empty status-fail">Nie udało się załadować logów.</td></tr>`;
  }
}

async function clearLogs() {
  try {
    const r = await fetch(`${API_URL}/clear_logs`, { method: "POST" });
    if (r.ok) refreshLogs();
    else alert("Błąd czyszczenia logów");
  } catch {
    alert("Błąd komunikacji z serwerem API.");
  }
}

// ---------- token helpers ----------
function useToken(t) {
  if (id("token")) id("token").value = t;
  checkToken();
}
function copyToken(t) {
  navigator.clipboard.writeText(t)
    .then(() => alert("📋 Token skopiowany"))
    .catch(() => alert("❌ Błąd kopiowania"));
}

// ---------- token check ----------
let _tokenCheck = { controller: null, inProgress: false };
async function checkToken() {
  const token = id("token")?.value.trim();
  const status = id("token-status");
  const uname = id("token-username");
  if (!status) return;
  status.className = "status-message";
  status.textContent = "⏳ Sprawdzanie...";
  if (!token) {
    status.textContent = "⚠️ Wklej token API.";
    status.className = "status-fail";
    return;
  }

  try {
    const resp = await fetch(`${API_URL}/check_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token })
    });
    const data = await resp.json();
    if (data.valid) {
      status.textContent = "✅ Token poprawny";
      status.className = "status-ok";
      uname.textContent = `Zalogowano jako: ${data.username || "?"}`;
    } else {
      status.textContent = `❌ ${data.error || "Błąd tokena"}`;
      status.className = "status-fail";
      uname.textContent = "";
    }
  } catch {
    status.textContent = "❌ Błąd komunikacji z API.";
    status.className = "status-fail";
    uname.textContent = "";
  }
}

// ---------- FIX: Contest filtering visibility + event ------------
const contestInput = id("contest-input");
if (contestInput) {
  contestInput.addEventListener("input", () => {
    filterContests();
    toggleContestList(true);
  });
  contestInput.addEventListener("focus", () => {
    filterContests();
    toggleContestList(true);
  });
}

// ---------- FIX: Check all tokens handler ------------
async function checkAllTokens() {
  const tbody = id("token-db-body");
  const rows = tbody ? tbody.querySelectorAll("[data-token]") : [];
  if (rows.length === 0) {
    alert("Brak tokenów do sprawdzenia.");
    return;
  }

  for (const row of rows) {
    const span = row.querySelector(".status-text");
    const token = row.dataset.token;
    span.innerHTML = '<i data-feather="loader" class="animate-spin"></i>';
    feather.replace();

    try {
      const res = await fetch(`${API_URL}/check_token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token })
      });
      const data = await res.json();

      if (data.valid) {
        span.innerHTML = '<i data-feather="check-circle"></i>';
        row.title = data.username || "OK";
      } else {
        span.innerHTML = '<i data-feather="x-circle"></i>';
        row.title = data.error || "Niepoprawny";
      }
    } catch (e) {
      span.innerHTML = '<i data-feather="alert-circle"></i>';
      row.title = "Błąd komunikacji";
    }

    feather.replace();
  }
}

// ---------- init ----------
document.addEventListener("DOMContentLoaded", () => {
  loadContests();
  loadTokens();
  setupDropZone();
  refreshLogs();
});
