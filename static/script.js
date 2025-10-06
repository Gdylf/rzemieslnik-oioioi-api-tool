const API_URL = "http://127.0.0.1:4000";
let problemsData = [];
let tokensData = {};

// ================== Wybór kontestu (custom dropdown) ==================
async function loadContests() {
    const list = document.getElementById("contest-list");
    const label = document.getElementById("contest-label");

    try {
        const response = await fetch("static/contesty.json");
        if (!response.ok) {
            throw new Error(`Błąd ładowania: ${response.status}`);
        }
        const contests = await response.json();

        const parsed = contests.map(c =>
            typeof c === "string" ? { id: c, name: c } : c
        );

        list.innerHTML = "";
        parsed.forEach(c => {
            const div = document.createElement("div");
            div.classList.add("checkbox-item");
            div.textContent = c.name;
            div.dataset.value = c.id;
            div.onclick = () => {
                label.textContent = c.name;
                label.dataset.value = c.id;
                document.getElementById("contest-dropdown").classList.remove("active");
            };
            list.appendChild(div);
        });

        if (parsed.length > 0) {
            label.textContent = parsed[0].name;
            label.dataset.value = parsed[0].id;
        } else {
            label.textContent = "Brak kontestów";
            label.dataset.value = "";
        }
    } catch (error) {
        console.error("Nie udało się załadować listy kontestów:", error);
        list.innerHTML = `<div class="checkbox-item status-fail">Błąd ładowania kontestów</div>`;
        label.textContent = "Błąd ładowania";
        label.dataset.value = "";
    }
}

function getSelectedContestId() {
    const label = document.getElementById("contest-label");
    return label && label.dataset.value ? label.dataset.value : "";
}

// ================== Tokeny ==================
async function loadTokens() {
    const tbody = document.getElementById('token-db-body');
    try {
        const response = await fetch('/static/tokeny.json');
        if (!response.ok) {
            throw new Error(`Błąd HTTP: ${response.status}`);
        }
        const rawTokens = await response.json();

        tbody.innerHTML = '';
        if (rawTokens.length === 0) {
            tbody.innerHTML = `<tr><td colspan="3" class="logs-empty">Brak zapisanych tokenów.</td></tr>`;
            return;
        }

        rawTokens.forEach(entry => {
            // entry wygląda tak: { "Tomasz Milkowski": "token" }
            const contestName = Object.keys(entry)[0];
            const tokenValue = entry[contestName];

            const newRow = tbody.insertRow(-1);
            newRow.innerHTML = `
                <td class="token-contest-name">${contestName}</td>
                <td class="token-value" title="${tokenValue}">${tokenValue.substring(0, 8)}...</td>
                <td class="token-actions">
                    <button class="btn-mini btn-copy" onclick="copyToken('${tokenValue}')">Kopiuj</button>
                    <button class="btn-mini btn-use" onclick="useToken('${tokenValue}')">Użyj</button>
                </td>
            `;
        });

    } catch (error) {
        console.error("Błąd ładowania bazy tokenów:", error);
        tbody.innerHTML = `<tr><td colspan="3" class="logs-empty status-fail">Nie udało się załadować bazy tokenów.</td></tr>`;
    }
}
// ================== Problemy ==================
function setupDropZone() {
    const dropZone = document.getElementById('problemy-drop');
    const fileInput = document.getElementById('problemy-file');

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.add('drag-over'), false);
    });
    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.remove('drag-over'), false);
    });

    dropZone.addEventListener('drop', handleDrop, false);
    dropZone.addEventListener('click', () => fileInput.click(), false);

    fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

    function handleDrop(e) {
        const dt = e.dataTransfer;
        handleFiles(dt.files);
    }

    function handleFiles(files) {
        if (files.length === 0) return;
        const file = files[0];
        if (file.name.endsWith('.json')) {
            const reader = new FileReader();
            reader.onload = function(event) {
                try {
                    const data = JSON.parse(event.target.result);
                    loadProblemsData(data);
                    dropZone.classList.add('loaded');
                } catch {
                    document.getElementById('problemy-status').textContent = 'Błąd: Niepoprawny format JSON.';
                    dropZone.classList.remove('loaded');
                }
            };
            reader.readAsText(file);
        } else {
            document.getElementById('problemy-status').textContent = 'Błąd: Wymagany plik problemy.json.';
            dropZone.classList.remove('loaded');
        }
    }
}

// ================== Generowanie dropdownów ==================
async function loadProblemsData(data) {
    problemsData = data;
    const listSingle = document.getElementById('single-problems-list');
    const listMulti = document.getElementById('multi-problems-list');
    const listSybau = document.getElementById('multi-sybau-problems-list');

    listSingle.innerHTML = '';
    listMulti.innerHTML = '';
    listSybau.innerHTML = '';

    data.forEach(problem => {
        // SINGLE
        const itemSingle = document.createElement('div');
        itemSingle.classList.add('checkbox-item');
        const inputSingle = document.createElement('input');
        inputSingle.type = "radio";
        inputSingle.name = "single_problem_radio";
        inputSingle.value = problem.short_name;
        inputSingle.id = "p-" + problem.short_name;
        const labelSingle = document.createElement('label');
        labelSingle.setAttribute("for", inputSingle.id);
        labelSingle.textContent = `${problem.short_name} (${problem.full_name})`;

        inputSingle.addEventListener("change", () => {
            listSingle.querySelectorAll(".checkbox-item").forEach(el => el.classList.remove("selected"));
            if (inputSingle.checked) itemSingle.classList.add("selected");
            updateSingleProblemLabel();
            document.getElementById("single-problems-dropdown").classList.remove("active");
        });

        itemSingle.appendChild(inputSingle);
        itemSingle.appendChild(labelSingle);
        listSingle.appendChild(itemSingle);

        // MULTI
        const itemMulti = document.createElement('div');
        itemMulti.classList.add('checkbox-item');
        const inputMulti = document.createElement('input');
        inputMulti.type = "checkbox";
        inputMulti.value = problem.short_name;
        inputMulti.id = "m-" + problem.short_name;
        const labelMulti = document.createElement('label');
        labelMulti.setAttribute("for", inputMulti.id);
        labelMulti.textContent = `${problem.short_name} (${problem.full_name})`;

        inputMulti.addEventListener("change", () => {
            if (inputMulti.checked) itemMulti.classList.add("selected");
            else itemMulti.classList.remove("selected");
            updateMultiLabel("multi");
        });

        itemMulti.appendChild(inputMulti);
        itemMulti.appendChild(labelMulti);
        listMulti.appendChild(itemMulti);

        // SYBAU
        const itemSybau = document.createElement('div');
        itemSybau.classList.add('checkbox-item');
        const inputSybau = document.createElement('input');
        inputSybau.type = "checkbox";
        inputSybau.value = problem.short_name;
        inputSybau.id = "s-" + problem.short_name;
        const labelSybau = document.createElement('label');
        labelSybau.setAttribute("for", inputSybau.id);
        labelSybau.textContent = `${problem.short_name} (${problem.full_name})`;

        inputSybau.addEventListener("change", () => {
            if (inputSybau.checked) itemSybau.classList.add("selected");
            else itemSybau.classList.remove("selected");
            updateMultiLabel("sybau");
        });

        itemSybau.appendChild(inputSybau);
        itemSybau.appendChild(labelSybau);
        listSybau.appendChild(itemSybau);
    });

    document.getElementById('problemy-status').textContent = `Załadowano ${data.length} zadań.`;
    updateMultiLabel('multi');
    updateMultiLabel('sybau');
    updateSingleProblemLabel();
}
// ================== Tryby inputów ==================
function toggleSingleMode() {
    const isDropdown = document.querySelector('input[name="single-mode"]:checked').value === 'dropdown';
    document.getElementById('single-manual-input').style.display = isDropdown ? 'none' : 'block';
    document.getElementById('single-dropdown-input').style.display = isDropdown ? 'block' : 'none';
    if (isDropdown) updateSingleProblemLabel();
}

function toggleMultiMode() {
    const isDropdown = document.querySelector('input[name="multi-mode"]:checked').value === 'dropdown';
    document.getElementById('multi-manual-input').style.display = isDropdown ? 'none' : 'block';
    document.getElementById('multi-dropdown-input').style.display = isDropdown ? 'block' : 'none';
}

function toggleMultiSybauMode() {
    const isDropdown = document.querySelector('input[name="multi-sybau-mode"]:checked').value === 'dropdown';
    document.getElementById('multi-sybau-manual-input').style.display = isDropdown ? 'none' : 'block';
    document.getElementById('multi-sybau-dropdown-input').style.display = isDropdown ? 'block' : 'none';
}

// ================== Dropdown UI ==================
function toggleDropdown(dropdownId, isSingleSelection = false) {
    const dropdown = document.getElementById(dropdownId);
    if (!dropdown) return;

    if (dropdownId === 'single-problems-dropdown' && problemsData.length === 0 && !dropdown.classList.contains('active')) {
        alert('Najpierw załaduj plik problemy.json!');
        return;
    }

    dropdown.classList.toggle('active');

    if (isSingleSelection && event && event.target.type === 'radio') {
        dropdown.classList.remove('active');
    }
}

function updateSingleProblemLabel() {
    const label = document.getElementById('single-problems-label');
    const checked = document.querySelector('input[name="single_problem_radio"]:checked');
    if (checked) {
        label.textContent = checked.nextElementSibling.textContent.trim();
    } else {
        label.textContent = problemsData.length === 0 ? 'Załaduj problemy.json' : 'Wybierz zadanie...';
    }
}

function updateMultiLabel(type) {
    const list = document.getElementById(`${type}-problems-list`);
    const label = document.getElementById(`${type}-problems-label`);
    const checkedItems = list.querySelectorAll('input[type="checkbox"]:checked');
    const count = checkedItems.length;

    if (count === 0) {
        label.textContent = problemsData.length === 0 ? 'Załaduj problemy.json' : 'Wybierz zadania...';
    } else if (count === 1) {
        label.textContent = checkedItems[0].value;
    } else {
        label.textContent = `Wybrano ${count} zadań`;
    }
}

// ================== Helpers ==================
async function getCode(codeId, fileId) {
    const code = document.getElementById(codeId).value;
    const file = document.getElementById(fileId).files[0];
    if (code) return code;
    if (file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error('Błąd odczytu pliku'));
            reader.readAsText(file);
        });
    }
    return null;
}

function getProblemsFromDropdown(type) {
    const list = document.getElementById(`${type}-problems-list`);
    if (type === 'single') {
        const checkedRadio = list.querySelector('input[name="single_problem_radio"]:checked');
        return checkedRadio ? [checkedRadio.value] : [];
    }
    const checkedCheckboxes = list.querySelectorAll('input[type="checkbox"]:checked');
    return Array.from(checkedCheckboxes).map(cb => cb.value);
}

// ================== Submisje ==================
async function performSubmit(endpoint, payload) {
    try {
        const response = await fetch(`${API_URL}/${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (data.success) {
            alert(`Sukces! ${data.message}`);
        } else {
            alert(`Błąd: ${data.error}`);
        }
        refreshLogs();
    } catch (error) {
        alert('Błąd komunikacji z serwerem API.');
        console.error('Błąd submita:', error);
    }
}

async function singleSubmit() {
    const token = document.getElementById('token').value;
    const contest = getSelectedContestId();
    const repeat = document.getElementById('single-repeat').value;
    const concurrency = document.getElementById('single-concurrency').value;
    let problem = document.getElementById('single-problem-text').value;

    const isDropdown = document.querySelector('input[name="single-mode"]:checked').value === 'dropdown';
    if (isDropdown) {
        const selected = getProblemsFromDropdown('single');
        problem = selected.length > 0 ? selected[0] : '';
    }

    if (!token || !contest || !problem) {
        alert('Wypełnij pola Token API, Kontest i Short Name Zadania.');
        return;
    }

    try {
        const code = await getCode('single-code', 'single-file');
        if (!code) {
            alert('Wklej kod lub wybierz plik.');
            return;
        }
        const payload = {
            token, contest, problem, code,
            repeat: parseInt(repeat), concurrency: parseInt(concurrency)
        };
        performSubmit('single_submit', payload);
    } catch (error) {
        alert(`Błąd odczytu kodu: ${error.message}`);
    }
}

async function multiSubmit() {
    const token = document.getElementById('token').value;
    const contest = getSelectedContestId();
    const repeat = document.getElementById('multi-repeat').value;
    const concurrency = document.getElementById('multi-concurrency').value;
    let problemsStr = document.getElementById('multi-problems-text').value;

    const isDropdown = document.querySelector('input[name="multi-mode"]:checked').value === 'dropdown';
    if (isDropdown) problemsStr = getProblemsFromDropdown('multi').join(',');

    if (!token || !contest || !problemsStr) {
        alert('Wypełnij pola Token API, Kontest i Short Names zadań.');
        return;
    }

    try {
        const code = await getCode('multi-code', 'multi-file');
        if (!code) {
            alert('Wklej kod lub wybierz plik.');
            return;
        }
        const payload = {
            token, contest, problems: problemsStr, code,
            repeat: parseInt(repeat), concurrency: parseInt(concurrency)
        };
        performSubmit('multi_submit', payload);
    } catch (error) {
        alert(`Błąd odczytu kodu: ${error.message}`);
    }
}

async function multiSybauSubmit() {
    const token = document.getElementById('token').value;
    const contest = getSelectedContestId();
    const repeat = document.getElementById('multi-sybau-repeat').value;
    const concurrency = document.getElementById('multi-sybau-concurrency').value;
    let problemsStr = document.getElementById('multi-sybau-problems-text').value;

    const isDropdown = document.querySelector('input[name="multi-sybau-mode"]:checked').value === 'dropdown';
    if (isDropdown) problemsStr = getProblemsFromDropdown('sybau').join(',');

    if (!token || !contest || !problemsStr) {
        alert('Wypełnij pola Token API, Kontest i Short Names zadań.');
        return;
    }

    const payload = {
        token, contest, problems: problemsStr,
        repeat: parseInt(repeat), concurrency: parseInt(concurrency)
    };
    performSubmit('multi_sybau_submit', payload);
}

// ================== Tokeny i logi ==================
function useToken(token) {
    document.getElementById('token').value = token;
    checkToken();
}

function copyToken(token) {
    navigator.clipboard.writeText(token).then(() => {
        alert('Token skopiowany do schowka!');
    }, () => {
        alert('Błąd kopiowania tokena.');
    });
}

async function checkToken() {
    const token = document.getElementById('token').value;
    const statusDiv = document.getElementById('token-status');
    statusDiv.textContent = 'Sprawdzanie...';
    statusDiv.className = 'status-message';

    if (!token) {
        statusDiv.textContent = 'Wklej token API.';
        statusDiv.classList.add('status-fail');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/check_token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
        });
        const data = await response.json();
        if (data.valid) {
            statusDiv.textContent = `Zalogowano jako: ${data.username}`;
            statusDiv.classList.add('status-ok');
        } else {
            statusDiv.textContent = `Błąd tokena: ${data.error}`;
            statusDiv.classList.add('status-fail');
        }
    } catch {
        statusDiv.textContent = 'Błąd komunikacji z serwerem API.';
        statusDiv.classList.add('status-fail');
    }
}

async function refreshLogs() {
    const logsBody = document.getElementById('logs-body');
    try {
        const response = await fetch(`${API_URL}/get_logs`);
        if (!response.ok) throw new Error(`Błąd HTTP: ${response.status}`);
        const logsData = await response.json();

        logsBody.innerHTML = '';
        if (logsData.length === 0) {
            logsBody.innerHTML = `<tr><td colspan="4" class="logs-empty">Brak zakończonych zleceń. Wyślij pierwszy submit!</td></tr>`;
            return;
        }

        logsData.forEach(log => {
            const statusClass = log.status === 'OK' ? 'status-ok' : 'status-fail';
            const newRow = logsBody.insertRow(-1);
            newRow.innerHTML = `
                <td>${log.timestamp}</td>
                <td>${log.problem} (${log.contest})</td>
                <td class="${statusClass}">${log.status}</td>
                <td class="response-text">${log.response}</td>
            `;
        });
    } catch {
        logsBody.innerHTML = `<tr><td colspan="4" class="logs-empty status-fail">Nie udało się załadować logów z serwera.</td></tr>`;
    }
}

async function clearLogs() {
    try {
        const response = await fetch(`${API_URL}/clear_logs`, { method: 'POST' });
        if (response.ok) refreshLogs();
        else alert('Błąd czyszczenia logów na serwerze.');
    } catch {
        alert('Błąd komunikacji z serwerem API.');
    }
}

// ================== Start ==================
document.addEventListener('DOMContentLoaded', () => {
    loadContests();
    loadTokens();
    setupDropZone();
    refreshLogs();
    updateSingleProblemLabel();
    updateMultiLabel('multi');
    updateMultiLabel('sybau');
});
