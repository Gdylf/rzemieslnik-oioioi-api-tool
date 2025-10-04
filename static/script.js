// static/script.js

const API_URL = "http://127.0.0.1:5000"; 
let currentContest = ""; 
let problemsData = []; // Przechowuje dane z problemy.json
let tokensData = {}; // Przechowuje dane z tokeny.json

// Funkcja ładowania kontestów z pliku JSON
async function loadContests() {
    const select = document.getElementById('contest-select');
    try {
        const response = await fetch('/static/contesty.json'); 
        if (!response.ok) {
            throw new Error(`Błąd ładowania: ${response.status}`);
        }
        const contests = await response.json();

        select.innerHTML = ''; 

        contests.forEach(contestName => {
            const option = document.createElement('option');
            option.value = contestName;
            option.textContent = contestName;
            select.appendChild(option);
        });

        if (contests.length > 0) {
            currentContest = contests[0];
        }

        select.addEventListener('change', (event) => {
            currentContest = event.target.value;
            console.log(`Wybrano kontest: ${currentContest}`);
        });

    } catch (error) {
        console.error("Nie udało się załadować listy kontestów:", error);
        select.innerHTML = '<option value="">Błąd ładowania kontestów</option>';
    }
}

// Funkcja ładowania tokenów z GitHub
async function loadTokens() {
    const tbody = document.getElementById('token-db-body');
    try {
        const response = await fetch('https://github.com/SliverGithub/alllahuakbar/blob/47ce0c0acb9ee453a4b98754857017616f0e5cfb/tokeny.json');
        if (!response.ok) {
            throw new Error(`Błąd ładowania: ${response.status}`);
        }
        tokensData = await response.json();
        
        tbody.innerHTML = '';
        
        if (Object.keys(tokensData).length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="logs-empty">Brak tokenów w bazie</td></tr>';
            return;
        }
        
        Object.entries(tokensData).forEach(([contestName, token]) => {
            const row = tbody.insertRow();
            
            // Kolumna z nazwą kontestu
            const cellName = row.insertCell(0);
            cellName.textContent = contestName;
            cellName.className = 'token-contest-name';
            
            // Kolumna z tokenem (ukrytym)
            const cellToken = row.insertCell(1);
            cellToken.className = 'token-value';
            cellToken.innerHTML = `<span class="token-hidden">••••••••••••••••</span>`;
            
            // Kolumna z akcjami
            const cellActions = row.insertCell(2);
            cellActions.className = 'token-actions';
            
            const copyBtn = document.createElement('button');
            copyBtn.className = 'btn-mini btn-copy';
            copyBtn.textContent = '📋 Kopiuj';
            copyBtn.onclick = () => copyToken(token, copyBtn);
            
            const useBtn = document.createElement('button');
            useBtn.className = 'btn-mini btn-use';
            useBtn.textContent = '✓ Użyj';
            useBtn.onclick = () => useToken(token, contestName);
            
            cellActions.appendChild(copyBtn);
            cellActions.appendChild(useBtn);
        });
        
    } catch (error) {
        console.error("Nie udało się załadować tokenów:", error);
        tbody.innerHTML = '<tr><td colspan="3" class="logs-empty status-fail">Błąd ładowania bazy tokenów</td></tr>';
    }
}

// Funkcja kopiowania tokena do schowka
async function copyToken(token, button) {
    try {
        await navigator.clipboard.writeText(token);
        const originalText = button.textContent;
        button.textContent = '✓ Skopiowano!';
        button.style.background = '#388e3c';
        
        setTimeout(() => {
            button.textContent = originalText;
            button.style.background = '';
        }, 2000);
    } catch (error) {
        alert('Nie udało się skopiować tokena do schowka');
        console.error('Błąd kopiowania:', error);
    }
}

// Funkcja użycia tokena (wklejenie do pola i ustawienie kontestu)
function useToken(token, contestName) {
    document.getElementById('token').value = token;
    
    // Ustaw kontest jeśli pasuje
    const contestSelect = document.getElementById('contest-select');
    const options = Array.from(contestSelect.options);
    const matchingOption = options.find(opt => opt.value === contestName);
    
    if (matchingOption) {
        contestSelect.value = contestName;
        currentContest = contestName;
    }
    
    // Pokaż komunikat
    const statusDiv = document.getElementById('token-status');
    statusDiv.textContent = `Token dla ${contestName} został wklejony!`;
    statusDiv.className = 'status-message status-ok';
    
    // Scroll do góry
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Funkcja ładowania problemów z pliku JSON
async function loadProblems() {
    try {
        const response = await fetch('/static/problemy.json');
        if (!response.ok) {
            throw new Error(`Błąd ładowania: ${response.status}`);
        }
        problemsData = await response.json();
        
        // Załaduj do wszystkich normalnych select'ów
        loadProblemsToSelect('single-problem-select');
        loadProblemsToSelect('sybau-problem-select');
        
        // Załaduj do checkbox dropdownów
        loadProblemsToCheckboxDropdown('multi-problems-list', 'multi-problems-label');
        loadProblemsToCheckboxDropdown('multi-sybau-problems-list', 'multi-sybau-problems-label');
        
    } catch (error) {
        console.error("Nie udało się załadować listy problemów:", error);
    }
}

// Ładowanie do zwykłego select
function loadProblemsToSelect(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    
    select.innerHTML = '<option value="">-- Wybierz zadanie --</option>';
    
    problemsData.forEach(problem => {
        const option = document.createElement('option');
        option.value = problem.short_name;
        option.textContent = `${problem.short_name} - ${problem.full_name}`;
        select.appendChild(option);
    });
}

// Ładowanie do checkbox dropdown
function loadProblemsToCheckboxDropdown(listId, labelId) {
    const list = document.getElementById(listId);
    if (!list) return;
    
    list.innerHTML = '';
    
    problemsData.forEach(problem => {
        const item = document.createElement('div');
        item.className = 'checkbox-item';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `${listId}-${problem.short_name}`;
        checkbox.value = problem.short_name;
        checkbox.onchange = () => updateCheckboxLabel(listId, labelId);
        
        const label = document.createElement('label');
        label.htmlFor = checkbox.id;
        label.textContent = `${problem.short_name} - ${problem.full_name}`;
        
        // Kliknięcie w cały element toggleuje checkbox
        item.onclick = (e) => {
            // Jeśli kliknięto w checkbox lub label, pozwól na domyślną akcję
            if (e.target === checkbox || e.target === label) return;
            // W przeciwnym razie toggle checkbox ręcznie
            checkbox.checked = !checkbox.checked;
            updateCheckboxLabel(listId, labelId);
        };
        
        item.appendChild(checkbox);
        item.appendChild(label);
        list.appendChild(item);
    });
}

// Aktualizacja labela checkboxowego dropdown
function updateCheckboxLabel(listId, labelId) {
    const list = document.getElementById(listId);
    const label = document.getElementById(labelId);
    const checkboxes = list.querySelectorAll('input[type="checkbox"]:checked');
    
    if (checkboxes.length === 0) {
        label.textContent = 'Wybierz zadania...';
    } else if (checkboxes.length === 1) {
        label.textContent = checkboxes[0].value;
    } else {
        label.textContent = `Wybrano: ${checkboxes.length} zadań`;
    }
}

// Toggle dropdown z checkboxami
function toggleDropdown(dropdownId) {
    const dropdown = document.getElementById(dropdownId);
    dropdown.classList.toggle('active');
    
    // Zamknij inne dropdowny
    document.querySelectorAll('.checkbox-dropdown').forEach(dd => {
        if (dd.id !== dropdownId) {
            dd.classList.remove('active');
        }
    });
}

// Zamknij dropdown po kliknięciu poza nim
document.addEventListener('click', function(event) {
    if (!event.target.closest('.checkbox-dropdown')) {
        document.querySelectorAll('.checkbox-dropdown').forEach(dd => {
            dd.classList.remove('active');
        });
    }
});

// Funkcje toggle dla trybów
function toggleSingleMode() {
    const mode = document.querySelector('input[name="single-mode"]:checked').value;
    document.getElementById('single-manual-input').style.display = mode === 'manual' ? 'block' : 'none';
    document.getElementById('single-dropdown-input').style.display = mode === 'dropdown' ? 'block' : 'none';
}

function toggleMultiMode() {
    const mode = document.querySelector('input[name="multi-mode"]:checked').value;
    document.getElementById('multi-manual-input').style.display = mode === 'manual' ? 'block' : 'none';
    document.getElementById('multi-dropdown-input').style.display = mode === 'dropdown' ? 'block' : 'none';
}

function toggleSybauMode() {
    const mode = document.querySelector('input[name="sybau-mode"]:checked').value;
    document.getElementById('sybau-manual-input').style.display = mode === 'manual' ? 'block' : 'none';
    document.getElementById('sybau-dropdown-input').style.display = mode === 'dropdown' ? 'block' : 'none';
}

function toggleMultiSybauMode() {
    const mode = document.querySelector('input[name="multi-sybau-mode"]:checked').value;
    document.getElementById('multi-sybau-manual-input').style.display = mode === 'manual' ? 'block' : 'none';
    document.getElementById('multi-sybau-dropdown-input').style.display = mode === 'dropdown' ? 'block' : 'none';
}

// Wywołaj ładowanie po załadowaniu strony
window.onload = function() {
    loadContests();
    loadProblems();
    loadTokens();
    refreshLogs();
};

// Funkcja do wczytywania zawartości pliku
function readFileContent(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target.result);
        reader.onerror = (error) => reject(error);
        reader.readAsText(file);
    });
}

// Funkcja pomocnicza do wysyłania submitu
async function sendSubmit(endpoint, payload) {
    if (!payload.token || (!payload.problem && !payload.problems)) {
        alert("Wprowadź token API i Short Name Zadania.");
        return;
    }
    
    if (!currentContest) {
        alert("Wybierz kontest.");
        return;
    }

    payload.contest = currentContest;

    try {
        const response = await fetch(`${API_URL}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });
        
        const data = await response.json();

        if (response.ok) {
            console.log("Submit pomyślnie wysłany. Logi zostaną odświeżone.");
            alert(data.message || "Submit wysłany pomyślnie!");
            refreshLogs();
        } else {
            alert(`Błąd: ${data.error || data.message}`);
        }

    } catch (error) {
        console.error('Błąd sieci lub serwera:', error);
        alert('Błąd: Nie udało się połączyć z serwerem Flask. Sprawdź, czy serwer działa i ma włączony CORS.');
    }
}

// Pomocnicza funkcja do pobierania wybranych zadań
function getSelectedProblems(listId, manualInputId, mode) {
    if (mode === 'manual') {
        const input = document.getElementById(manualInputId).value;
        return input.split(',').map(p => p.trim()).filter(p => p.length > 0);
    } else {
        const list = document.getElementById(listId);
        const checkboxes = list.querySelectorAll('input[type="checkbox"]:checked');
        return Array.from(checkboxes).map(cb => cb.value);
    }
}

// -----------------------------------------------------------
// IMPLEMENTACJA FUNKCJI INTERFEJSU
// -----------------------------------------------------------

async function singleSubmit() {
    const token = document.getElementById('token').value;
    const mode = document.querySelector('input[name="single-mode"]:checked').value;
    
    let problem;
    if (mode === 'manual') {
        problem = document.getElementById('single-problem-text').value;
    } else {
        problem = document.getElementById('single-problem-select').value;
    }
    
    const repeat = document.getElementById('single-repeat').value;
    const concurrency = document.getElementById('single-concurrency').value;
    const fileInput = document.getElementById('single-file');
    const codeArea = document.getElementById('single-code');

    if (!problem) {
        alert("Wybierz lub wpisz zadanie!");
        return;
    }

    let codeContent = codeArea.value;

    if (fileInput.files.length > 0) {
        codeContent = await readFileContent(fileInput.files[0]);
    }
    
    if (!codeContent) {
        alert("Wprowadź kod źródłowy lub wybierz plik.");
        return;
    }
    
    const payload = {
        token: token,
        problem: problem,
        code: codeContent,
        repeat: repeat,
        concurrency: concurrency
    };
    
    sendSubmit('/single_submit', payload); 
}

async function multiSubmit() {
    const token = document.getElementById('token').value;
    const mode = document.querySelector('input[name="multi-mode"]:checked').value;
    
    const problems = getSelectedProblems('multi-problems-list', 'multi-problems-text', mode);
    
    if (problems.length === 0) {
        alert("Wybierz przynajmniej jedno zadanie!");
        return;
    }
    
    const repeat = document.getElementById('multi-repeat').value;
    const concurrency = document.getElementById('multi-concurrency').value;
    const fileInput = document.getElementById('multi-file');
    const codeArea = document.getElementById('multi-code');

    let codeContent = codeArea.value;
    if (fileInput.files.length > 0) {
        codeContent = await readFileContent(fileInput.files[0]);
    }
    
    if (!codeContent) {
        alert("Wprowadź kod źródłowy lub wybierz plik.");
        return;
    }

    const payload = {
        token: token,
        problems: problems.join(','), 
        code: codeContent,
        repeat: repeat,
        concurrency: concurrency
    };
    
    sendSubmit('/multi_submit', payload);
}

function sybauSubmit() {
    const token = document.getElementById('token').value;
    const mode = document.querySelector('input[name="sybau-mode"]:checked').value;
    
    let problem;
    if (mode === 'manual') {
        problem = document.getElementById('sybau-problem-text').value;
    } else {
        problem = document.getElementById('sybau-problem-select').value;
    }
    
    if (!problem) {
        alert("Wybierz lub wpisz zadanie!");
        return;
    }
    
    const repeat = document.getElementById('sybau-repeat').value;
    const concurrency = document.getElementById('sybau-concurrency').value;
    
    const payload = {
        token: token,
        problem: problem,
        repeat: repeat,
        concurrency: concurrency
    };
    
    sendSubmit('/sybau_submit', payload);
}

function multiSybauSubmit() {
    const token = document.getElementById('token').value;
    const mode = document.querySelector('input[name="multi-sybau-mode"]:checked').value;
    
    const problems = getSelectedProblems('multi-sybau-problems-list', 'multi-sybau-problems-text', mode);
    
    if (problems.length === 0) {
        alert("Wybierz przynajmniej jedno zadanie!");
        return;
    }
    
    if (!token) {
        alert("Wprowadź token API!");
        return;
    }
    
    const repeat = document.getElementById('multi-sybau-repeat').value;
    const concurrency = document.getElementById('multi-sybau-concurrency').value;
    
    const payload = {
        token: token,
        problems: problems.join(','),
        repeat: repeat,
        concurrency: concurrency
    };
    
    sendSubmit('/multi_sybau_submit', payload);
}

async function checkToken() {
    const token = document.getElementById('token').value;
    const statusDiv = document.getElementById('token-status');
    statusDiv.textContent = 'Sprawdzanie...';
    statusDiv.className = 'status-message';
    
    if (!token) {
        statusDiv.textContent = 'Token jest pusty.';
        statusDiv.className = 'status-message status-fail';
        return;
    }

    try {
        const response = await fetch(`${API_URL}/check_token`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({token: token})
        });

        const data = await response.json();

        if (response.ok && data.valid) {
            statusDiv.textContent = `Token poprawny! Zalogowano jako: ${data.username}`;
            statusDiv.className = 'status-message status-ok';
        } else {
            statusDiv.textContent = `Token NIEPRAWIDŁOWY: ${data.error || 'Nieznany błąd'}`;
            statusDiv.className = 'status-message status-fail';
        }
    } catch (error) {
        console.error('Błąd sprawdzania tokena:', error);
        statusDiv.textContent = 'Błąd: Nie udało się połączyć z serwerem Flask.';
        statusDiv.className = 'status-message status-fail';
    }
}

async function refreshLogs() {
    const logsBody = document.getElementById('logs-body');
    logsBody.innerHTML = `<tr><td colspan="4" class="logs-empty">Ładowanie logów...</td></tr>`;

    try {
        const response = await fetch(`${API_URL}/get_logs`);
        if (!response.ok) {
             throw new Error(`Błąd HTTP: ${response.status}`);
        }
        const logsData = await response.json();
        
        logsBody.innerHTML = '';
        
        if (logsData.length === 0) {
            logsBody.innerHTML = `
                <tr>
                    <td colspan="4" class="logs-empty">Brak zakończonych zleceń. Wyślij pierwszy submit!</td>
                </tr>
            `;
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
    } catch (error) {
        console.error('Błąd ładowania logów:', error);
        logsBody.innerHTML = `
            <tr>
                <td colspan="4" class="logs-empty status-fail">Nie udało się załadować logów z serwera.</td>
            </tr>
        `;
    }
}

async function clearLogs() {
    try {
        const response = await fetch(`${API_URL}/clear_logs`, {method: 'POST'});
        if (response.ok) {
            refreshLogs();
        } else {
            alert('Błąd czyszczenia logów na serwerze.');
        }
    } catch (error) {
        alert('Błąd komunikacji z serwerem podczas czyszczenia logów.');
    }
}