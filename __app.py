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
import argparse
import base64
import subprocess
import tempfile
import pandas as pd
import re
import time
import sys
import atexit
from requests.adapters import HTTPAdapter
from requests.packages.urllib3.util.retry import Retry


app = Flask(__name__, static_folder='static')
CORS(app)

# Lock dla bezpiecznego dodawania logów
logs_lock = threading.Lock()
logs = [] 

# Domyślny adres serwera OIOIOI (można nadpisać przez --domain)
DEFAULT_BASE_URL = "https://wyzwania.programuj.edu.pl"
app.config['BASE_URL'] = DEFAULT_BASE_URL

# Ścieżka do pliku z kodem Spam (w tym samym katalogu co app.py)
Spam_CODE_PATH = os.path.join(os.path.dirname(__file__), 'spam.cpp') 


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
    """Send a single submission to OIOIOI API."""
    url = f"{app.config['BASE_URL']}/api/c/{contest_id}/submit/{problem}"

    headers = {
        'Authorization': f'Token {token}'
    }

    files = {'file': ('solution.cpp', code, 'text/x-c++src')}

    try:
        response = requests.post(url, files=files, headers=headers, timeout=30)
        content_type = response.headers.get('Content-Type', '')

        if 'application/json' in content_type:
            json_response = response.json()
            status = 'OK' if response.status_code == 200 else 'FAIL'
            response_text = json.dumps(json_response, ensure_ascii=False)
        else:
            status = 'FAIL' if response.status_code >= 400 else 'OK'
            response_text = f"HTML [{response.status_code}]: {response.text[:100]}"

        add_log(contest_id, problem, status, response_text)
        return response.status_code == 200

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


@app.route('/spam_submit', methods=['POST'])
def Spam_submit():
    """Wysyła Spam submit, kod ładowany z pliku Spam.cpp"""
    data = request.get_json(force=True)
    token = data.get('token')
    contest_id = data.get('contest')
    problem = data.get('problem') or data.get('problems')
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

def connect_fastest_vpngate(country_code=None):
    LIVE_URL = "https://www.vpngate.net/api/iphone/"
    CACHE_PATH = os.path.join(os.path.dirname(__file__), "vpngate_cache.csv")

    data = None
    try:
        # --- Try live fetch ---
        print("🌍 Fetching VPN Gate server list (HTTPS, auto-refresh cache)...")
        session = requests.Session()
        session.headers.update({'User-Agent': 'Python VPN Client'})
        response = session.get(LIVE_URL, timeout=20)
        response.raise_for_status()
        data = response.text.splitlines()
        print(f"✅ Fetched {len(data)} lines from live VPN Gate API")

        # --- Save/update cache ---
        with open(CACHE_PATH, 'w') as f:
            f.write(response.text)
        print(f"💾 VPN Gate list cached/updated at {CACHE_PATH}")

    except Exception as e:
        print(f"⚠️ Could not fetch live VPN Gate list: {e}")
        if os.path.exists(CACHE_PATH):
            print(f"ℹ️ Falling back to cached VPN Gate list ({CACHE_PATH})")
            with open(CACHE_PATH, 'r') as f:
                data = f.read().splitlines()
            print(f"✅ Loaded {len(data)} lines from cache")
        else:
            print("❌ No cached VPN Gate list available. Aborting VPN connection.")
            return None

    # --- Parse CSV data ---
    lines = [line for line in data if line and not line.startswith('*')]
    if not lines:
        print("❌ No usable VPN server data available.")
        return None

    header = lines[0].strip().split(',')
    records = [line.split(',') for line in lines[1:] if line.strip()]
    df = pd.DataFrame(records, columns=[h.strip().replace('\ufeff', '') for h in header])

    # --- Identify hostname/IP column ---
    hostname_col = next((c for c in ["HostName", "IP", "IP Address"] if c in df.columns), None)
    if not hostname_col:
        print(f"❌ Could not find HostName/IP column. Columns: {df.columns.tolist()}")
        return None

    # --- Filter by country if provided ---
    if country_code:
        df = df[df["CountryShortName"].str.upper() == country_code.upper()]
        if df.empty:
            print("⚠️ No servers found for that country; using global list")
            df = pd.DataFrame(records, columns=header)

    # --- Sort by Score ---
    df["Score"] = pd.to_numeric(df.get("Score", 0), errors="coerce").fillna(0)
    df = df.sort_values(by="Score", ascending=False)
    server = df.iloc[0]

    hostname = server[hostname_col]
    country = server.get("CountryLong", "?")
    print(f"🚀 Connecting to fastest VPN Gate server: {hostname} ({country})")

    # --- Decode and patch .ovpn config ---
    try:
        ovpn_data = base64.b64decode(server["OpenVPN_ConfigData_Base64"])
        ovpn_text = ovpn_data.decode(errors="ignore")
        if "data-ciphers" not in ovpn_text:
            ovpn_text += "\n# Patch: add data-ciphers for OpenVPN 2.6+\ndata-ciphers AES-256-GCM:AES-128-GCM:CHACHA20-POLY1305:AES-128-CBC\n"
    except Exception as e:
        print(f"❌ Could not decode OpenVPN config: {e}")
        return None

    tmpfile = tempfile.NamedTemporaryFile(delete=False, suffix=".ovpn")
    tmpfile.write(ovpn_text.encode())
    tmpfile.close()

    # --- Start OpenVPN ---
    cmd = ["sudo", "openvpn", "--config", tmpfile.name]
    vpn_process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)

    print("🔗 OpenVPN process started, waiting for connection...")
    connected = False
    for line in vpn_process.stdout:
        print(line, end="")
        if "Initialization Sequence Completed" in line:
            connected = True
            break
        if re.search(r"AUTH_FAILED|TLS Error|Connection reset|SIGTERM", line):
            print("❌ VPN connection failed early.")
            vpn_process.terminate()
            break

    if connected:
        time.sleep(3)
        try:
            ip = requests.get("https://api.ipify.org", timeout=10).text
            print(f"✅ VPN connected. External IP: {ip}")
        except Exception:
            print("⚠️ Could not verify external IP (VPN may still be active).")
    else:
        print("⚠️ VPN did not connect successfully.")

    return vpn_process

def main():
    """Entry point for running the Rzemieślnik OIOIOI API Server."""
    parser = argparse.ArgumentParser(description="Rzemieślnik OIOIOI API Server")
    parser.add_argument('--target', type=str, default="https://wyzwania.programuj.edu.pl")
    parser.add_argument('--port', type=int, default=4000)
    parser.add_argument('--country', type=str, help="Optional country code for VPN (e.g., JP, US, KR)")
    args = parser.parse_args()

    global BASE_URL
    BASE_URL = args.target
    app.config['BASE_URL'] = BASE_URL

    print("——————————————————————————————————————————————")
    print("🛠️ Starting Rzemieślnik OIOIOI API Server")
    print(f"🌐 Cel: {BASE_URL}")
    print(f"🚪 Port: {args.port}")
    print("——————————————————————————————————————————————")

    # 🚀 Connect to VPN Gate before starting the Flask server
    vpn_process = connect_fastest_vpngate(args.vpn_country)

    try:
        app.run(host='0.0.0.0', port=args.port, ssl_context='adhoc')
    except KeyboardInterrupt:
        print("\n🛑 Server Stopped (Ctrl+C).")
        if vpn_process:
            print("🔌 Disconnecting VPN...")
            vpn_process.terminate()
        sys.exit(0)



if __name__ == "__main__":
    main()
