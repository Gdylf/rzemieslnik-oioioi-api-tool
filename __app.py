# app.py
'''———————————No commits?———————————
⠀⣞⢽⢪⢣⢣⢣⢫⡺⡵⣝⡮⣗⢷⢽⢽⢽⣮⡷⡽⣜⣜⢮⢺⣜⢷⢽⢝⡽⣝
⠸⡸⠜⠕⠕⠁⢁⢇⢏⢽⢺⣪⡳⡝⣎⣏⢯⢞⡿⣟⣷⣳⢯⡷⣽⢽⢯⣳⣫⠇
⠀⠀⢀⢀⢄⢬⢪⡪⡎⣆⡈⠚⠜⠕⠇⠗⠝⢕⢯⢫⣞⣯⣿⣻⡽⣏⢗⣗⠏⠀
⠀⠪⡪⡪⣪⢪⢺⢸⢢⢓⢆⢤⢀⠀⠀⠀⠀⠈⢊⢞⡾⣿⡯⣏⢮⠷⠁⠀⠀
⠀⠀⠀⠈⠊⠆⡃⠕⢕⢇⢇⢇⢇⢇⢏⢎⢎⢆⢄⠀⢑⣽⣿⢝⠲⠉⠀⠀⠀⠀
⠀⠀⠀⠀⠀⡿⠂⠠⠀⡇⢇⠕⢈⣀⠀⠁⠡⠣⡣⡫⣂⣿⠯⢪⠰⠂⠀⠀⠀⠀
⠀⠀⠀⠀⡦⡙⡂⢀⢤⢣⠣⡈⣾⡃⠠⠄⠀⡄⢱⣌⣶⢏⢊⠂⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⢝⡲⣜⡮⡏⢎⢌⢂⠙⠢⠐⢀⢘⢵⣽⣿⡿⠁⠁⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠨⣺⡺⡕⡕⡱⡑⡆⡕⡅⡕⡜⡼⢽⡻⠏⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⣼⣳⣫⣾⣵⣗⡵⡱⡡⢣⢑⢕⢜⢕⡝⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⣴⣿⣾⣿⣿⣿⡿⡽⡑⢌⠪⡢⡣⣣⡟⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⡟⡾⣿⢿⢿⢵⣽⣾⣼⣘⢸⢸⣞⡟⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠁⠇⠡⠩⡫⢿⣝⡻⡮⣒⢽⠋⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
—————————————————————————————'''
from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
import threading
import json
import os
app = Flask(__name__)
CORS(app)

# Lock dla bezpiecznego dodawania logów
logs_lock = threading.Lock()
logs = [] 

BASE_URL = "https://wyzwania.programuj.edu.pl"
# Ścieżka do pliku z kodem Spam (w tym samym katalogu co app.py)
Spam_CODE_PATH = os.path.join(os.path.dirname(__file__), 'Spam.cpp') 


def add_log(contest, problem, status, response_text):
    """Dodaje wpis do logów w sposób bezpieczny wątkowo, uwzględniając contest."""
    with logs_lock:
        logs.append({
            'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'contest': contest, 
            'problem': problem,
            'status': status,
            'response': response_text[:200]
        })

def submit_solution(token, contest_id, problem, code):
    """Wysyła pojedynczy submit do API, używając dynamicznego contest_id."""
    url = f"{BASE_URL}/api/c/{contest_id}/submit/{problem}" 
    
    headers = {
        'Authorization': f'Token {token}'
    }
    
    files = {'file': ('solution.cpp', code, 'text/x-c++src')}
    
    try:
        response = requests.post(url, files=files, headers=headers, timeout=30)
        
        content_type = response.headers.get('Content-Type', '')
        
        if 'application/json' in content_type:
            try:
                json_response = response.json()
                status = 'OK' if response.status_code == 200 else 'FAIL'
                response_text = json.dumps(json_response, ensure_ascii=False) 
            except json.JSONDecodeError:
                status = 'FAIL'
                response_text = f"Błąd JSON: {response.text[:100]}"
        else:
            status = 'FAIL' if response.status_code >= 400 else 'OK'
            response_text = f"HTML Response [{response.status_code}]: {response.text[:100]}"
        
        add_log(contest_id, problem, status, response_text)
        return True
        
    except requests.exceptions.RequestException as e:
        add_log(contest_id, problem, 'FAIL', f"Exception: {str(e)}")
        return False

# --- Routing ---

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/check_token', methods=['POST'])
def check_token():
    """Sprawdza poprawność tokena przez endpoint /api/auth_ping"""
    data = request.json
    token = data.get('token', '')
    
    if not token:
        return jsonify({'valid': False, 'error': 'Brak tokena'})
    
    try:
        url = f"{BASE_URL}/api/auth_ping"
        headers = {'Authorization': f'Token {token}'} 
        response = requests.get(url, headers=headers, timeout=10)
        
        if response.status_code == 200:
            try:
                user_data = response.json()
                username = user_data.get('username', user_data.get('user', {}).get('username', 'zalogowany'))
                return jsonify({'valid': True, 'username': username})
            except:
                return jsonify({'valid': True, 'username': f'zalogowany {user_data[5:]}'})
        else:
            error_msg = f'Status: {response.status_code}'
            try:
                error_data = response.json()
                error_msg += f' - {error_data}'
            except:
                error_msg += f' - {response.text[:100]}'
            return jsonify({'valid': False, 'error': error_msg})
            
    except Exception as e:
        return jsonify({'valid': False, 'error': str(e)})

@app.route('/single_submit', methods=['POST'])
def single_submit():
    """Wysyła pojedynczy submit X razy"""
    data = request.json
    token = data.get('token')
    contest_id = data.get('contest')
    problem = data.get('problem')
    code = data.get('code')
    repeat = int(data.get('repeat', 1))
    concurrency = int(data.get('concurrency', 5))
    
    if not all([token, contest_id, problem, code]):
        return jsonify({'success': False, 'error': 'Brak wymaganych danych: token, contest, problem lub kod'}), 400
    
    with ThreadPoolExecutor(max_workers=concurrency) as executor:
        futures = [executor.submit(submit_solution, token, contest_id, problem, code) for _ in range(repeat)]
        results = [f.result() for f in as_completed(futures)] 
    
    success_count = sum(results)
    return jsonify({
        'success': True,
        'message': f'Wysłano {repeat} submitów do {problem} w kontście {contest_id}. Sukces: {success_count}/{repeat}'
    })

@app.route('/multi_submit', methods=['POST'])
def multi_submit():
    """Wysyła submity do wielu zadań równocześnie"""
    data = request.json
    token = data.get('token')
    contest_id = data.get('contest')
    problems_str = data.get('problems', '')
    code = data.get('code')
    repeat = int(data.get('repeat', 1))
    concurrency = int(data.get('concurrency', 10))
    
    if not all([token, contest_id, problems_str, code]):
        return jsonify({'success': False, 'error': 'Brak wymaganych danych: token, contest, problemy lub kod'}), 400
    
    problems = [p.strip() for p in problems_str.split(',') if p.strip()]
    
    if not problems:
        return jsonify({'success': False, 'error': 'Nie podano zadań'}), 400
    
    tasks = [(token, contest_id, problem, code) for problem in problems for _ in range(repeat)]
    
    with ThreadPoolExecutor(max_workers=concurrency) as executor:
        futures = [executor.submit(submit_solution, *task) for task in tasks]
        results = [f.result() for f in as_completed(futures)]
    
    success_count = sum(results)
    total = len(tasks)
    
    return jsonify({
        'success': True,
        'message': f'Wysłano {total} submitów do {len(problems)} zadań w kontście {contest_id}. Sukces: {success_count}/{total}'
    })

@app.route('/Spam_submit', methods=['POST'])
def Spam_submit():
    """Wysyła Spam submit, kod ładowany z pliku Spam.cpp"""
    data = request.json
    token = data.get('token')
    contest_id = data.get('contest')
    problem = data.get('problem')
    repeat = int(data.get('repeat', 1))
    concurrency = int(data.get('concurrency', 5))
    
    if not all([token, contest_id, problem]):
        return jsonify({'success': False, 'error': 'Brak wymaganych danych: token, contest lub problem'}), 400
    
    # Wczytanie kodu z pliku Spam.cpp
    try:
        with open(Spam_CODE_PATH, 'r') as f:
            Spam_code = f.read()
    except FileNotFoundError:
        return jsonify({'success': False, 'error': f'Błąd: Nie znaleziono pliku {os.path.basename(Spam_CODE_PATH)} w katalogu aplikacji.'}), 500
    except Exception as e:
        return jsonify({'success': False, 'error': f'Błąd odczytu pliku {os.path.basename(Spam_CODE_PATH)}: {str(e)}'}), 500
    
    with ThreadPoolExecutor(max_workers=concurrency) as executor:
        futures = [executor.submit(submit_solution, token, contest_id, problem, Spam_code) for _ in range(repeat)]
        results = [f.result() for f in as_completed(futures)]
    
    success_count = sum(results)
    return jsonify({
        'success': True,
        'message': f'Wysłano {repeat} spam submitów do {problem} w kontście {contest_id}. Sukces: {success_count}/{repeat}'
    })

@app.route('/multi_Spam_submit', methods=['POST'])
def multi_Spam_submit():
    """Wysyła Spam submity do wielu zadań równocześnie"""
    data = request.json
    token = data.get('token')
    contest_id = data.get('contest')
    problems_str = data.get('problems', '')
    repeat = int(data.get('repeat', 1))
    concurrency = int(data.get('concurrency', 10))
    
    if not all([token, contest_id, problems_str]):
        return jsonify({'success': False, 'error': 'Brak wymaganych danych: token, contest lub problemy'}), 400
    
    problems = [p.strip() for p in problems_str.split(',') if p.strip()]
    
    if not problems:
        return jsonify({'success': False, 'error': 'Nie podano zadań'}), 400
    
    # Wczytanie kodu Spam z pliku
    try:
        with open(Spam_CODE_PATH, 'r') as f:
            Spam_code = f.read()
    except FileNotFoundError:
        return jsonify({'success': False, 'error': f'Błąd: Nie znaleziono pliku {os.path.basename(Spam_CODE_PATH)} w katalogu aplikacji.'}), 500
    except Exception as e:
        return jsonify({'success': False, 'error': f'Błąd odczytu pliku {os.path.basename(Spam_CODE_PATH)}: {str(e)}'}), 500
    
    tasks = [(token, contest_id, problem, Spam_code) for problem in problems for _ in range(repeat)]
    
    with ThreadPoolExecutor(max_workers=concurrency) as executor:
        futures = [executor.submit(submit_solution, *task) for task in tasks]
        results = [f.result() for f in as_completed(futures)]
    
    success_count = sum(results)
    total = len(tasks)
    
    return jsonify({
        'success': True,
        'message': f'🔥 Wysłano {total} spam submitów do {len(problems)} zadań w kontście {contest_id}. Sukces: {success_count}/{total}'
    })

@app.route('/get_logs', methods=['GET'])
def get_logs():
    """Zwraca logi w formacie JSON"""
    with logs_lock:
        return jsonify(logs[-100:][::-1]) 

@app.route('/clear_logs', methods=['POST'])
def clear_logs():
    """Czyści logi"""
    with logs_lock:
        logs.clear()
    return jsonify({'success': True})

if __name__ == '__main__':
    print("🛠️ Uruchamianie Rzemieślnik OIOIOI API Server (Flask)...")
    print("🌐 Otwórz: http://127.0.0.1:4000")
    app.run(debug=True, host='0.0.0.0', port=4000)
    