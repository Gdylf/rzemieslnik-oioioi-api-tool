#!/usr/bin/env python3
import argparse
import requests
import os
import json
from concurrent.futures import ThreadPoolExecutor, as_completed

BASE_URL = "https://wyzwania.programuj.edu.pl"
SPAM_CODE_PATH = os.path.join(os.path.dirname(__file__), "spam.cpp")


def check_token(token):
    """Check if a token is valid."""
    url = f"{BASE_URL}/api/auth_ping"
    headers = {"Authorization": f"Token {token}"}
    try:
        r = requests.get(url, headers=headers, timeout=10)
        if r.status_code == 200:
            try:
                data = r.json()
                user = data.get("username") or data.get("user", {}).get("username", "unknown")
            except:
                user = "unknown"
            print(f"[OK] Token valid for user: {user}")
        else:
            print(f"[FAIL] Invalid token ({r.status_code}) -> {r.text[:100]}")
    except Exception as e:
        print(f"[ERROR] {e}")


def submit_solution(token, contest, problem, code):
    """Send a single submission."""
    url = f"{BASE_URL}/api/c/{contest}/submit/{problem}"
    headers = {"Authorization": f"Token {token}"}
    files = {"file": ("solution.cpp", code, "text/x-c++src")}
    try:
        r = requests.post(url, headers=headers, files=files, timeout=30)
        if r.status_code == 200:
            print(f"[OK] {problem}")
            return True
        else:
            print(f"[FAIL] {problem} ({r.status_code})")
            return False
    except Exception as e:
        print(f"[ERR] {problem}: {e}")
        return False


def run_submissions(token, contest, problems, code, repeat, concurrency):
    """Run multiple submissions concurrently."""
    tasks = [(token, contest, p, code) for p in problems for _ in range(repeat)]
    total = len(tasks)
    success = 0
    with ThreadPoolExecutor(max_workers=concurrency) as pool:
        futures = [pool.submit(submit_solution, *t) for t in tasks]
        for f in as_completed(futures):
            if f.result():
                success += 1
    print(f"\nSummary: {success}/{total} successful submissions.")


def main():
    parser = argparse.ArgumentParser(
        description="Rzemieślnik OIOIOI CLI (minimal, requests-only)"
    )
    sub = parser.add_subparsers(dest="cmd", required=True)

    # --- check_token ---
    p = sub.add_parser("check_token", help="Check if token is valid")
    p.add_argument("--token", required=True)

    # --- single_submit ---
    p = sub.add_parser("single_submit", help="Submit code to one problem")
    p.add_argument("--token", required=True)
    p.add_argument("--contest", required=True)
    p.add_argument("--problem", required=True)
    p.add_argument("--code", required=True)
    p.add_argument("--repeat", type=int, default=1)
    p.add_argument("--concurrency", type=int, default=5)

    # --- multi_submit ---
    p = sub.add_parser("multi_submit", help="Submit code to multiple problems")
    p.add_argument("--token", required=True)
    p.add_argument("--contest", required=True)
    p.add_argument("--problems", required=True, help="Comma-separated problems (e.g. A,B,C)")
    p.add_argument("--code", required=True)
    p.add_argument("--repeat", type=int, default=1)
    p.add_argument("--concurrency", type=int, default=10)

    # --- spam_submit ---
    p = sub.add_parser("spam", help="Submit spam.cpp to multiple problems")
    p.add_argument("--token", required=True)
    p.add_argument("--contest", required=True)
    p.add_argument("--problems", required=True)
    p.add_argument("--repeat", type=int, default=1)
    p.add_argument("--concurrency", type=int, default=10)

    args = parser.parse_args()

    # --- Command Dispatcher ---
    if args.cmd == "check_token":
        check_token(args.token)
        return

    # Read code
    if "spam" in args.cmd:
        if not os.path.exists(SPAM_CODE_PATH):
            print(f"[ERROR] Missing file: {SPAM_CODE_PATH}")
            return
        with open(SPAM_CODE_PATH, "r") as f:
            code = f.read()
    else:
        if not os.path.exists(args.code):
            print(f"[ERROR] Missing code file: {args.code}")
            return
        with open(args.code, "r") as f:
            code = f.read()

    problems = [args.problem] if hasattr(args, "problem") else [
        p.strip() for p in args.problems.split(",") if p.strip()
    ]
    run_submissions(args.token, args.contest, problems, code, args.repeat, args.concurrency)


if __name__ == "__main__":
    main()
