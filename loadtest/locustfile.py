"""
Load test for Room Reservation API: 3 most frequent user actions, 80% read / 20% write.

  1. List    GET  /api/rooms                         (weight 4 -> 40%)
  2. Detail  GET  /api/rooms/:id + GET /api/bookings  (weight 4 -> 40%)
  3. Write   POST /api/bookings                      (weight 2 -> 20%)

Config (env vars):
  AUTH_MODE          dev | cognito   (default: dev)
                     dev     -> sends X-Dev-User header; only works against STAGE=local backend
                     cognito -> real ID token via Cognito USER_PASSWORD_AUTH
  LOADTEST_USERS     comma list of accounts
                     dev:     "loadtest-01,loadtest-02,..."
                     cognito: "loadtest-01:Passw0rd!,loadtest-02:Passw0rd!,..."
  LOADTEST_USERS_FILE  file with one "username:password" per line, used instead of LOADTEST_USERS
                     (copy users.example.txt to users.txt; users.txt is gitignored)
  COGNITO_CLIENT_ID  app client id (cognito mode)
  COGNITO_REGION     default ap-southeast-1

Run:
  locust -f loadtest/locustfile.py --host http://localhost:3000
  # open http://localhost:8089, or headless:
  locust -f loadtest/locustfile.py --host <url> --headless -u 20 -r 2 -t 2m --csv loadtest/out

Every booking this file creates has a title starting with "[LOADTEST]" so cleanup can find them.
"""

import itertools
import os
import random
import threading
import time
from datetime import datetime, timedelta, timezone

import requests
from locust import HttpUser, between, events, task
from locust.runners import WorkerRunner

import banner

AUTH_MODE = os.getenv("AUTH_MODE", "dev")
COGNITO_CLIENT_ID = os.getenv("COGNITO_CLIENT_ID", "")
COGNITO_REGION = os.getenv("COGNITO_REGION", "ap-southeast-1")
TITLE_PREFIX = "[LOADTEST]"
BKK = timezone(timedelta(hours=7))

ROOM_TYPES = ["LAB", "LECTURE", "MEETING", "COWORKING"]
FACILITIES = ["computers", "projector", "mic"]
SEARCH_WORDS = ["LC", "ห้อง", "Co-working", "10"]


def _parse_accounts():
    # LOADTEST_USERS_FILE wins: one "username:password" per line, # for comments (keeps passwords out of shell history)
    path = os.getenv("LOADTEST_USERS_FILE")
    if path:
        with open(path, encoding="utf-8") as f:
            items = [line.strip() for line in f if line.strip() and not line.lstrip().startswith("#")]
    else:
        items = [s.strip() for s in os.getenv("LOADTEST_USERS", "").split(",") if s.strip()]
    accounts = []
    for item in items:
        username, _, password = item.partition(":")
        accounts.append((username, password))
    if not accounts:
        raise SystemExit("No accounts: set LOADTEST_USERS or LOADTEST_USERS_FILE (see top of locustfile.py)")
    return accounts


ACCOUNTS = _parse_accounts()
# Hand accounts out in turn so 50 simulated users over 10 accounts = 5 each, not random clumps
_next_account = itertools.cycle(ACCOUNTS)
_account_lock = threading.Lock()


@events.init.add_listener
def _banner(environment, **_):
    # In distributed mode only the master shows it, not every worker
    if not isinstance(environment.runner, WorkerRunner):
        banner.show(f"host={environment.host}  auth={AUTH_MODE}  accounts={len(ACCOUNTS)}")

# --- Cognito token cache: many simulated users share a few accounts, so log in once per account ---
_token_lock = threading.Lock()
_tokens = {}  # username -> (id_token, fetched_at)
TOKEN_TTL = 50 * 60  # ID tokens last 60 min


def cognito_id_token(username, password):
    with _token_lock:
        cached = _tokens.get(username)
        if cached and time.time() - cached[1] < TOKEN_TTL:
            return cached[0]
        # Called outside self.client so login time does not pollute API stats
        res = requests.post(
            f"https://cognito-idp.{COGNITO_REGION}.amazonaws.com/",
            headers={
                "Content-Type": "application/x-amz-json-1.1",
                "X-Amz-Target": "AWSCognitoIdentityProviderService.InitiateAuth",
            },
            json={
                "AuthFlow": "USER_PASSWORD_AUTH",
                "ClientId": COGNITO_CLIENT_ID,
                "AuthParameters": {"USERNAME": username, "PASSWORD": password},
            },
            timeout=10,
        )
        res.raise_for_status()
        token = res.json()["AuthenticationResult"]["IdToken"]
        _tokens[username] = (token, time.time())
        return token


# --- 409 (slot already taken) is correct behaviour, count it apart from real failures ---
conflict_count = 0


@events.test_stop.add_listener
def _report(environment, **_):
    print(f"\n[loadtest] POST /api/bookings answered 409 (slot taken, expected): {conflict_count}")


class RoomUser(HttpUser):
    wait_time = between(1, 3)  # think time between actions, like a real person

    def on_start(self):
        with _account_lock:
            self.username, self.password = next(_next_account)
        me = self.client.get("/api/users/me", headers=self._auth(), name="[setup] GET /api/users/me")
        self.role = me.json()["data"]["role"] if me.status_code == 200 else "STUDENT"

        res = self.client.get("/api/rooms", name="[setup] GET /api/rooms")
        rooms = res.json()["data"] if res.status_code == 200 else []
        self.room_ids = [r["id"] for r in rooms]
        # Only rooms this account may book, so writes are not wasted on 403/400
        self.bookable = [
            r for r in rooms if r["status"] == "AVAILABLE" and self.role in r["allowed_roles"]
        ]

    def _auth(self):
        if AUTH_MODE == "cognito":
            return {"Authorization": f"Bearer {cognito_id_token(self.username, self.password)}"}
        return {"X-Dev-User": self.username}

    # ---------- 1. List: search / filter rooms ----------
    @task(4)
    def list_rooms(self):
        params = {}
        if random.random() < 0.5:
            params["room_type"] = random.choice(ROOM_TYPES)
        if random.random() < 0.3:
            params["facilities"] = ",".join(random.sample(FACILITIES, k=random.randint(1, 2)))
        if random.random() < 0.2:
            params["q"] = random.choice(SEARCH_WORDS)
        self.client.get("/api/rooms", params=params, name="GET /api/rooms")

    # ---------- 2. Detail: room page = room info + that week's schedule ----------
    @task(4)
    def room_detail(self):
        if not self.room_ids:
            return
        room_id = random.choice(self.room_ids)
        self.client.get(f"/api/rooms/{room_id}", name="GET /api/rooms/:id")

        day = datetime.now(BKK).date() + timedelta(days=random.randint(0, 30))
        self.client.get(
            "/api/bookings",
            params={"room_id": room_id, "from": day.isoformat(), "to": (day + timedelta(days=6)).isoformat()},
            name="GET /api/bookings?room_id",
        )

    # ---------- 3. Write: book a room ----------
    @task(2)
    def create_booking(self):
        global conflict_count
        if not self.bookable:
            return
        room = random.choice(self.bookable)
        # Spread over 7-90 days ahead, 08:00-19:00, so most slots are free
        day = datetime.now(BKK).date() + timedelta(days=random.randint(7, 90))
        hours = random.randint(1, min(room["max_hours"], 2))
        start = datetime(day.year, day.month, day.day, random.randint(8, 19 - hours), 0, tzinfo=BKK)
        end = start + timedelta(hours=hours)
        seats = room.get("seat_capacity") or 10

        body = {
            "room_id": room["id"],
            "start_time": start.isoformat(),
            "end_time": end.isoformat(),
            "title": f"{TITLE_PREFIX} {self.username} {random.randint(1000, 9999)}",
            "attendee_count": random.randint(1, min(seats, 10)),
            "purpose": "load test",
        }
        with self.client.post(
            "/api/bookings", json=body, headers=self._auth(), name="POST /api/bookings", catch_response=True
        ) as res:
            if res.status_code == 201:
                res.success()
            elif res.status_code == 409:
                conflict_count += 1
                res.success()
            else:
                res.failure(f"{res.status_code}: {res.text[:200]}")
