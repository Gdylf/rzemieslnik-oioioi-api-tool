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


app = Flask(__name__, static_folder="static")
CORS(app)

# Thread-safe logs
logs_lock = threading.Lock()
logs = []

DEFAULT_BASE_URL = "https://wyzwania.programuj.edu.pl"
app.config["BASE_URL"] = DEFAULT_BASE_URL

SPAM_CODE_PATH = Path(__file__).resolve().parent / "spam.cpp"


def add_log(contest, problem, status, response_text):
    with logs_lock:
        logs.append(
            {
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "contest": contest,
                "problem": problem,
                "status": status,
                "response": response_text[:200],
            }
        )


def submit_solution(token, contest_id, problem, code):
    url = f"{app.config['BASE_URL']}/api/c/{contest_id}/submit/{problem}"
    headers = {"Authorization": f"Token {token}"}
    files = {"file": ("solution.cpp", code, "text/x-c++src")}
    try:
        response = requests.post(url, files=files, headers=headers, timeout=30)
        if "application/json" in response.headers.get("Content-Type", ""):
            resp_json = response.json()
            status = "OK" if response.status_code == 200 else "FAIL"
            add_log(
                contest_id, problem, status, json.dumps(resp_json, ensure_ascii=False)
            )
        else:
            status = "FAIL" if response.status_code >= 400 else "OK"
            add_log(contest_id, problem, status, response.text[:100])
        return response.status_code == 200
    except requests.exceptions.RequestException as e:
        add_log(contest_id, problem, "FAIL", str(e))
        return False


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/check_token", methods=["POST"])
def check_token():
    data = request.json
    token = data.get("token", "")
    if not token:
        return jsonify({"valid": False, "error": "Brak tokena"})
    try:
        url = f"{app.config['BASE_URL']}/api/auth_ping"
        headers = {"Authorization": f"Token {token}"}
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code == 200:
            user_data = response.json()
            username = user_data.get(
                "username", user_data.get("user", {}).get("username", "zalogowany")
            )
            return jsonify({"valid": True, "username": username})
        else:
            return jsonify({"valid": False, "error": f"Status {response.status_code}"})
    except Exception as e:
        return jsonify({"valid": False, "error": str(e)})


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
        return jsonify(
            {"success": False, "error": "Missing token/contest/problem/code"}
        ), 400

    with ThreadPoolExecutor(max_workers=concurrency) as ex:
        futures = [
            ex.submit(submit_solution, token, contest_id, problem, code)
            for _ in range(repeat)
        ]
        results = [f.result() for f in as_completed(futures)]

    success = sum(results)
    return jsonify(
        {"success": True, "message": f"{success}/{repeat} submissions successful"}
    )


@app.route("/get_logs", methods=["GET"])
def get_logs():
    with logs_lock:
        return jsonify(logs[-100:][::-1])


@app.route("/clear_logs", methods=["POST"])
def clear_logs():
    with logs_lock:
        logs.clear()
    return jsonify({"success": True})


def connect_fastest_vpngate(country_code=None):
    LIVE_URL = "https://www.vpngate.net/api/iphone/"
    CACHE_PATH = Path(__file__).resolve().parent / "vpngate_cache.csv"
    OVPN_CONFIG_PATH = Path(__file__).resolve().parent / "fastest_vpn.ovpn"

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
            return
        print("ℹ️ Using cached VPN list.")
        data = CACHE_PATH.read_text(encoding="utf-8").splitlines()

    lines = [l for l in data if l and not l.startswith("*")]
    if not lines:
        print("❌ No VPN servers found in the list.")
        return
    header = lines[0].split(",")
    records = [l.split(",") for l in lines[1:]]
    df = pd.DataFrame(
        records, columns=[h.strip().replace("\ufeff", "") for h in header]
    )

    if country_code:
        filtered_df = df[df["CountryShortName"].str.upper() == country_code.upper()]
        if filtered_df.empty:
            print(f"⚠️ No VPNs found for country '{country_code}'. Using any country.")
        else:
            df = filtered_df

    df["Score"] = pd.to_numeric(df["Score"], errors="coerce").fillna(0)
    df = df.sort_values("Score", ascending=False)

    if df.empty:
        print("❌ No suitable VPN servers found.")
        return

    s = df.iloc[0]
    try:
        ovpn_data = base64.b64decode(s["OpenVPN_ConfigData_Base64"])
    except Exception:
        print("❌ Failed to decode VPN configuration.")
        return

    with open(OVPN_CONFIG_PATH, "wb") as f:
        f.write(ovpn_data)

    print(f"✅ VPN configuration saved to: {OVPN_CONFIG_PATH}")
    print("\n--- Platform Instructions ---")
    system = platform.system().lower()
    if system.startswith("win"):
        print("🪟 Windows:")
        print(
            f"   1. Install OpenVPN Connect: https://openvpn.net/client-connect-vpn-for-windows/"
        )
        print(
            f"   2. Import the downloaded file '{OVPN_CONFIG_PATH.name}' into the client."
        )
        print(f"   3. Connect to the VPN.")
    elif "ANDROID_ROOT" in os.environ or "ANDROID_DATA" in os.environ:
        print("🤖 Android (Termux/other):")
        print(
            f"   1. Install 'OpenVPN for Android': https://play.google.com/store/apps/details?id=de.blinkt.openvpn"
        )
        print(f"   2. Import the file '{OVPN_CONFIG_PATH.name}' into the app.")
        print(f"   3. The file is located at: {OVPN_CONFIG_PATH}")
    elif system.startswith("linux"):
        print("🐧 Linux:")
        print(
            f"   1. Install OpenVPN: `sudo apt-get install openvpn` or `sudo dnf install openvpn`"
        )
        print(f"   2. Connect using: `sudo openvpn --config {OVPN_CONFIG_PATH.name}`")
    else:  # Generic instructions for others (like macOS)
        print("🍎 macOS / Other:")
        print(
            f"   1. Install an OpenVPN client like Tunnelblick: https://tunnelblick.net/"
        )
        print(f"   2. Import the file '{OVPN_CONFIG_PATH.name}' and connect.")
    print("---------------------------\n")
    print("🚦 Please connect to the VPN manually before proceeding.")
    input("   Press Enter to continue once VPN is connected...")


def main():
    parser = argparse.ArgumentParser(description="OIOIOI API Server")
    parser.add_argument("--target", type=str, default=DEFAULT_BASE_URL)
    parser.add_argument("--port", type=int, default=4000)
    parser.add_argument("--country", type=str, help="VPN country code")
    parser.add_argument("--no_vpn", action="store_true", help="Run without VPN")
    args = parser.parse_args()

    app.config["BASE_URL"] = args.target

    if not args.no_vpn:
        connect_fastest_vpngate(args.country)

    print("——————————————————————————————————————————————")
    print("🛠️ Starting OIOIOI API Server")
    print(f"🌐 Target: {args.target}")
    print(f"🚪 Port: {args.port}")
    print(f"🖥️ Platform: {platform.system()}")
    if args.no_vpn:
        print("⚡ Running without VPN")
    else:
        print("🔐 Running with VPN")
    print("——————————————————————————————————————————————")

    app.run(host="0.0.0.0", port=args.port, ssl_context="adhoc")


if __name__ == "__main__":
    main()

