// script.js
// Relative API base -> empty string so endpoints become e.g. /check_token
const API_URL = "" ;
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
                // hide list
                document.getElementById("contest-list").classList.add("hidden");
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
        if (!rawTokens || rawTokens.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="logs-empty">Brak zapisanych tokenów.</td></tr>`;
            return;
        }

        rawTokens.forEach(entry => {
            // entry wygląda tak: { "Tomasz Milkowski": "token" }
            const contestName = Object.keys(entry)[0];
            const tokenValue = entry[contestName];

            const newRow = tbody.insertRow(-1);
            newRow.innerHTML = `
                <td class="token-contest-name px-4 py-2">${contestName}</td>
                <td class="token-value px-4 py-2" title="${tokenValue}">${tokenValue.substring(0, 8)}...</td>
                <td class="token-status px-4 py-2" data-token="${tokenValue}">
                    <span class="status-text">-</span>
                </td>
                <td class="token-actions px-4 py-2">
                    <button class="btn-mini btn-copy mr-2" onclick="copyToken('${tokenValue}')">Kopiuj</button>
                    <button class="btn-mini btn-use" onclick="useToken('${tokenValue}')">Użyj</button>
                </td>
            `;
        });

    } catch (error) {
        console.error("Błąd ładowania bazy tokenów:", error);
        tbody.innerHTML = `<tr><td colspan="4" class="logs-empty status-fail">Nie udało się załadować bazy tokenów.</td></tr>`;
    }
}

async function checkAllTokens() {
    const tbody = document.getElementById('token-db-body');
    const statusCells = tbody.querySelectorAll('.token-status');
    
    if (statusCells.length === 0) {
        alert('Brak tokenów do sprawdzenia.');
        return;
    }

    // Ustaw status "Sprawdzanie..." dla wszystkich
    statusCells.forEach(cell => {
        const statusText = cell.querySelector('.status-text');
        statusText.textContent = '⏳';
        statusText.className = 'status-text token-status-checking';
    });

    // Sprawdź każdy token
    const checkPromises = Array.from(statusCells).map(async (cell) => {
        const token = cell.dataset.token;
        const statusText = cell.querySelector('.status-text');
        
        try {
            const response = await fetch(`${API_URL}/check_token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token })
            });
            const data = await response.json();
            
            if (data.valid) {
                statusText.textContent = '✅';
                statusText.className = 'status-text token-status-valid';
            } else {
                statusText.textContent = '❌';
                statusText.className = 'status-text token-status-invalid';
            }
        } catch (error) {
            statusText.textContent = '❌';
            statusText.className = 'status-text token-status-invalid';
        }
    });

    await Promise.all(checkPromises);
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

    // Zachowaj guzik "Zaznacz wszystkie" dla multi i sybau
    const selectAllBtnMulti = '<div class="p-2 border-b border-gray-700"><button class="select-all-btn w-full" onclick="selectAllProblems(\'multi\'); event.stopPropagation();">Zaznacz wszystkie</button></div>';
    const selectAllBtnSybau = '<div class="p-2 border-b border-gray-700"><button class="select-all-btn w-full" onclick="selectAllProblems(\'sybau\'); event.stopPropagation();">Zaznacz wszystkie</button></div>';

    listSingle.innerHTML = '';
    listMulti.innerHTML = selectAllBtnMulti;
    listSybau.innerHTML = selectAllBtnSybau;

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
            document.getElementById("single-problems-list").classList.add("hidden");
        });

        // Kliknięcie w całą linię
        itemSingle.addEventListener("click", (e) => {
            if (e.target !== inputSingle) {
                inputSingle.checked = true;
                inputSingle.dispatchEvent(new Event('change'));
            }
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

        // Kliknięcie w całą linię
        itemMulti.addEventListener("click", (e) => {
            // Jeśli kliknięto w input lub label, nie rób nic (domyślna akcja zadziała)
            if (e.target === inputMulti || e.target === labelMulti) {
                return;
            }
            // W przeciwnym razie toggle checkbox
            inputMulti.checked = !inputMulti.checked;
            inputMulti.dispatchEvent(new Event('change'));
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

        // Kliknięcie w całą linię
        itemSybau.addEventListener("click", (e) => {
            // Jeśli kliknięto w input lub label, nie rób nic (domyślna akcja zadziała)
            if (e.target === inputSybau || e.target === labelSybau) {
                return;
            }
            // W przeciwnym razie toggle checkbox
            inputSybau.checked = !inputSybau.checked;
            inputSybau.dispatchEvent(new Event('change'));
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

    // for single-problems-dropdown, ensure problems loaded
    if (dropdownId === 'single-problems-dropdown' && problemsData.length === 0 && !dropdown.classList.contains('active')) {
        alert('Najpierw załaduj plik problemy.json!');
        return;
    }

    // toggle active class on the dropdown container
    const list = dropdown.querySelector('div[id$="-list"]') || dropdown.querySelector('#' + dropdownId.replace('-dropdown', '-list'));
    // toggle visibility of the list element:
    if (list) {
        const hidden = list.classList.contains('hidden');
        if (hidden) list.classList.remove('hidden');
        else list.classList.add('hidden');
    } else {
        dropdown.classList.toggle('active');
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
    const prefix = type === 'multi' ? 'multi' : 'multi-sybau';
    const list = document.getElementById(`${prefix}-problems-list`);
    const label = document.getElementById(`${prefix}-problems-label`);
    if (!list || !label) return;
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

// ================== Funkcja zaznaczania wszystkich ==================
function selectAllProblems(type) {
    const prefix = type === 'multi' ? 'multi' : 'multi-sybau';
    const list = document.getElementById(`${prefix}-problems-list`);
    if (!list) return;
    
    const checkboxes = list.querySelectorAll('input[type="checkbox"]');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    
    checkboxes.forEach(cb => {
        cb.checked = !allChecked;
        const item = cb.closest('.checkbox-item');
        if (item) {
            if (cb.checked) item.classList.add("selected");
            else item.classList.remove("selected");
        }
    });
    
    updateMultiLabel(type);
}

// ================== Helpers ==================
async function getCode(codeId, fileId) {
    const code = document.getElementById(codeId).value;
    const fileInput = document.getElementById(fileId);
    const file = fileInput ? fileInput.files[0] : null;
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
    const prefix = type === 'multi' ? 'multi' : (type === 'sybau' ? 'multi-sybau' : 'single');
    const list = document.getElementById(`${prefix}-problems-list`);
    if (!list) return [];
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
        const response = await fetch(`${API_URL}/${endpoint}`.replace('//', '/'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (data.success) {
            alert(`Sukces! ${data.message}`);
        } else {
            alert(`Błąd: ${data.error || data.message || JSON.stringify(data)}`);
        }
        refreshLogs();
    } catch (error) {
        alert('Błąd komunikacji z serwerem API.');
        console.error('Błąd submita:', error);
    }
}

async function singleSubmit() {
    const token = document.getElementById('token').value.trim();
    const contest = getSelectedContestId();
    const repeat = document.getElementById('single-repeat').value;
    const concurrency = document.getElementById('single-concurrency').value;
    let problem = document.getElementById('single-problem-text').value.trim();

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
    const token = document.getElementById('token').value.trim();
    const contest = getSelectedContestId();
    const repeat = document.getElementById('multi-repeat').value;
    const concurrency = document.getElementById('multi-concurrency').value;
    let problemsStr = document.getElementById('multi-problems-text').value.trim();

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
    const token = document.getElementById('token').value.trim();
    const contest = getSelectedContestId();
    const repeat = document.getElementById('multi-sybau-repeat').value;
    const concurrency = document.getElementById('multi-sybau-concurrency').value;
    let problemsStr = document.getElementById('multi-sybau-problems-text').value.trim();

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
    const token = document.getElementById('token').value.trim();
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
            statusDiv.textContent = `✅`;
            statusDiv.classList.remove('status-fail');
            statusDiv.classList.add('status-ok');
        } else {
            
            statusDiv.textContent = `❌`;

            statusDiv.classList.remove('status-ok');
            statusDiv.classList.add('status-fail');
        }
    } catch (e) {
        console.error(e);
        statusDiv.textContent = 'Błąd komunikacji z serwerem API.';
        statusDiv.classList.remove('status-ok');
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
        if (!logsData || logsData.length === 0) {
            logsBody.innerHTML = `<tr><td colspan="4" class="logs-empty">Brak zakończonych zleceń. Wyślij pierwszy submit!</td></tr>`;
            return;
        }

        logsData.forEach(log => {
            const statusClass = log.status === 'OK' ? 'status-ok' : 'status-fail';
            const newRow = logsBody.insertRow(-1);
            newRow.innerHTML = `
                <td class="px-4 py-2">${log.timestamp}</td>
                <td class="px-4 py-2">${log.problem} (${log.contest})</td>
                <td class="px-4 py-2 ${statusClass}">${log.status}</td>
                <td class="px-4 py-2 response-text">${log.response}</td>
            `;
        });
    } catch (e) {
        console.error(e);
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