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
from pathlib import Path
import platform

# -------------------------------
# Flask setup
# -------------------------------
BASE_DIR = Path(__file__).resolve().parent
app = Flask(
    __name__,
    static_folder=str(BASE_DIR / "static"),
    template_folder=str(BASE_DIR / "templates")
)
CORS(app)

# -------------------------------
# Global variables
# -------------------------------
logs_lock = threading.Lock()
logs = []
DEFAULT_BASE_URL = "https://wyzwania.programuj.edu.pl"
app.config["BASE_URL"] = DEFAULT_BASE_URL
SPAM_CODE_PATH = BASE_DIR / "spam.cpp"

# -------------------------------
# Utility: add log entries
# -------------------------------
def add_log(contest, problem, status, response_text):
    with logs_lock:
        logs.append({
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "contest": contest,
            "problem": problem,
            "status": status,
            "response": response_text[:200],
        })

# -------------------------------
# 🏠 Home route — serves index.html
# -------------------------------
@app.route("/")
def index():
    return render_template("index.html")

# -------------------------------
# 🔐 Token check
# -------------------------------
# Replace your existing check_token route with this code
@app.route("/check_token", methods=["POST"])
def check_token():
    data = request.json or {}
    token = data.get("token", "")
    if not token:
        return jsonify({"valid": False, "error": "Brak tokena"}), 200

    url = f"{app.config.get('BASE_URL')}/api/auth_ping"
    headers = {"Authorization": f"Token {token}"}

    try:
        # short timeout to avoid hanging the Flask worker
        response = requests.get(url, headers=headers, timeout=5)
    except requests.Timeout:
        print("[check_token] Timeout contacting auth_ping")
        return jsonify({"valid": False, "error": "⏱️ Przekroczono limit czasu (timeout)"}), 200
    except requests.ConnectionError as e:
        print(f"[check_token] ConnectionError: {e}")
        return jsonify({"valid": False, "error": "❌ Brak połączenia z serwerem (sprawdź VPN/DNS)"}), 200
    except Exception as e:
        print(f"[check_token] Unexpected exception: {e}")
        return jsonify({"valid": False, "error": f"💥 Błąd: {str(e)}"}), 200

    # If we got here, we have a response object
    text = (response.text or "").strip()

    # Non-200 status: include body preview
    if response.status_code != 200:
        print(f"[check_token] auth_ping returned status {response.status_code}: {text[:200]}")
        return jsonify({"valid": False, "error": f"Status {response.status_code}: {text[:200]}"}), 200

    # Try "pong username" pattern first
    lower = text.lower()
    if lower.startswith("pong "):
        username = text.split(" ", 1)[1].strip()
        print(f"[check_token] Detected pong username -> {username}")
        return jsonify({"valid": True, "username": username}), 200

    if lower == "pong":
        print("[check_token] auth_ping returned 'pong' without username")
        return jsonify({"valid": True, "username": "Nieznany użytkownik"}), 200

    # Try to parse JSON safely
    try:
        payload = response.json()
        if isinstance(payload, dict):
            username = (
                payload.get("username")
                or payload.get("user", {}).get("username")
                or payload.get("name")
            )
            username = username or "Nieznany użytkownik"
            print(f"[check_token] JSON username -> {username}")
            return jsonify({"valid": True, "username": username}), 200
        elif isinstance(payload, str):
            # sometimes API returns a quoted string via response.json()
            if payload.lower().startswith("pong "):
                username = payload.split(" ", 1)[1].strip()
                return jsonify({"valid": True, "username": username}), 200
            return jsonify({"valid": True, "username": payload}), 200
    except ValueError:
        # not JSON — fallback to text
        print("[check_token] auth_ping returned non-JSON text:", text[:200])

    # Final fallback: return text as username if not empty, otherwise error
    if text:
        return jsonify({"valid": True, "username": text}), 200

    return jsonify({"valid": False, "error": "Nieoczekiwany format odpowiedzi z serwera"}), 200


# -------------------------------
# 📤 Submit single solution
# -------------------------------
@app.route("/single_submit", methods=["POST"])
def single_submit():
    data = request.json
    token = data.get("token")
    contest_id = data.get("contest")
    problem = data.get("problem")
    code = data.get("code")
    repeat = int(data.get("repeat", 1))
    concurrency = int(data.get("concurrency", 5))

    if not all([token, contest_id, problem, code]):
        return jsonify({"success": False, "error": "Missing token/contest/problem/code"}), 400

    with ThreadPoolExecutor(max_workers=concurrency) as ex:
        futures = [ex.submit(submit_solution, token, contest_id, problem, code) for _ in range(repeat)]
        results = [f.result() for f in as_completed(futures)]

    success = sum(results)
    return jsonify({"success": True, "message": f"{success}/{repeat} submissions successful"})

# -------------------------------
# 🧾 Logs
# -------------------------------
@app.route("/get_logs", methods=["GET"])
def get_logs():
    with logs_lock:
        return jsonify(logs[-100:][::-1])

@app.route("/clear_logs", methods=["POST"])
def clear_logs():
    with logs_lock:
        logs.clear()
    return jsonify({"success": True})

# -------------------------------
# 🌍 VPN connection helper
# -------------------------------
def connect_fastest_vpngate(country_code=None):
    """Fetch fastest VPN config from VPNGate and auto-connect (Linux only)."""
    LIVE_URL = "https://www.vpngate.net/api/iphone/"
    CACHE_PATH = BASE_DIR / "vpngate_cache.csv"
    OVPN_CONFIG_PATH = BASE_DIR / "fastest_vpn.ovpn"

    try:
        print("🌍 Fetching VPN Gate server list...")
        r = requests.get(LIVE_URL, timeout=20)
        r.raise_for_status()
        with open(CACHE_PATH, "w", encoding="utf-8") as f:
            f.write(r.text)
        data = r.text.splitlines()
    except Exception as e:
        print(f"⚠️ Could not fetch VPN list: {e}")
        if not CACHE_PATH.exists():
            print("❌ No local cache of VPN list found. Cannot proceed.")
            return None
        print("ℹ️ Using cached VPN list.")
        data = CACHE_PATH.read_text(encoding="utf-8").splitlines()

    lines = [l for l in data if l and not l.startswith("*")]
    if not lines:
        print("❌ No VPN servers found.")
        return None

    header = lines[0].split(",")
    records = [l.split(",") for l in lines[1:]]
    df = pd.DataFrame(records, columns=[h.strip().replace("\ufeff", "") for h in header])

    if country_code:
        filtered_df = df[df["CountryShortName"].str.upper() == country_code.upper()]
        if not filtered_df.empty:
            df = filtered_df
        else:
            print(f"⚠️ No VPNs found for '{country_code}', using any country.")

    df["Score"] = pd.to_numeric(df["Score"], errors="coerce").fillna(0)
    df = df.sort_values("Score", ascending=False)

    if df.empty:
        print("❌ No suitable VPN servers found.")
        return None

    s = df.iloc[0]
    try:
        ovpn_data = base64.b64decode(s["OpenVPN_ConfigData_Base64"])
    except Exception:
        print("❌ Failed to decode VPN configuration.")
        return None

    with open(OVPN_CONFIG_PATH, "wb") as f:
        f.write(ovpn_data)

    print(f"✅ VPN configuration saved to: {OVPN_CONFIG_PATH}")

    system = platform.system().lower()
    if system == "linux":
        print("🐧 Linux detected — connecting automatically...")
        cmd = ["sudo", "openvpn", "--config", str(OVPN_CONFIG_PATH)]
        try:
            vpn_proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
            for line in vpn_proc.stdout:
                print(line, end="")
                if "Initialization Sequence Completed" in line:
                    print("✅ VPN connected successfully!")
                    return vpn_proc
                if re.search(r"AUTH_FAILED|TLS Error|Connection reset|SIGTERM", line):
                    print("❌ VPN connection failed.")
                    vpn_proc.terminate()
                    return None
        except Exception as e:
            print(f"⚠️ Could not start OpenVPN: {e}")
        return None
    else:
        print("\n--- Manual VPN Connection Required ---")
        if system.startswith("win"):
            print("🪟 Windows:")
            print("  1. Install OpenVPN Connect: https://openvpn.net/client-connect-vpn-for-windows/")
        elif "android" in system:
            print("🤖 Android:")
            print("  1. Install 'OpenVPN for Android'.")
        elif system == "darwin":
            print("🍎 macOS:")
            print("  1. Install Tunnelblick: https://tunnelblick.net/")
        print(f"  2. Import and connect using: {OVPN_CONFIG_PATH}")
        print("--------------------------------------\n")
        input("Press Enter once VPN is connected...")
        return None

# -------------------------------
# 🚀 Main entrypoint
# -------------------------------
def main():
    parser = argparse.ArgumentParser(description="OIOIOI API Server")
    parser.add_argument("--target", type=str, default=DEFAULT_BASE_URL)
    parser.add_argument("--port", type=int, default=4000)
    parser.add_argument("--country", type=str, help="VPN country code")
    parser.add_argument("--no_vpn", action="store_true", help="Run without VPN")
    args = parser.parse_args()

    app.config["BASE_URL"] = args.target

    vpn_proc = None
    if not args.no_vpn:
        vpn_proc = connect_fastest_vpngate(args.country)

    print("——————————————————————————————————————————————")
    print("🛠️ Starting OIOIOI API Server")
    print(f"🌐 Target: {args.target}")
    print(f"🚪 Port: {args.port}")
    print(f"🖥️ Platform: {platform.system()}")
    print("🔐 VPN: " + ("Enabled" if not args.no_vpn else "Disabled"))
    print("——————————————————————————————————————————————")

    try:
        app.run(host="0.0.0.0", port=args.port, ssl_context="adhoc")
    except KeyboardInterrupt:
        print("\n🛑 Server stopped (Ctrl+C).")
        if vpn_proc:
            print("🔌 Disconnecting VPN...")
            vpn_proc.terminate()
        sys.exit(0)

if __name__ == "__main__":
    main()
