import os
import re
import time
import uuid
from datetime import datetime, timedelta
from threading import Lock

import httpx
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr

router = APIRouter()

SIGNAL_LOCK = Lock()
DHT_LOCK = Lock()
WAITLIST_LOCK = Lock()

signal_store = {}
# {room_code: {offer_sdp, answer_sdp, ice_a, ice_b, expires_at}}

group_signals = {}
# {group_code: {member_index: {sdp_blob, ice_blob, created_at, expires_at}}}

dht_nodes = {}
# {node_id: {username, last_seen}}

vault_waitlist = set()


def _now():
    return datetime.utcnow()


def _cleanup_expired():
    now = _now()
    with SIGNAL_LOCK:
        expired = [k for k, v in signal_store.items() if v["expires_at"] < now]
        for k in expired:
            del signal_store[k]
    with SIGNAL_LOCK:
        for group_code, members in list(group_signals.items()):
            to_remove = [i for i, v in members.items() if v["expires_at"] < now]
            for i in to_remove:
                del members[i]
            if not members:
                del group_signals[group_code]
    with DHT_LOCK:
        if len(dht_nodes) > 200:
            sorted_nodes = sorted(dht_nodes.items(), key=lambda item: item[1]["last_seen"])
            for node_id, _ in sorted_nodes[:-200]:
                del dht_nodes[node_id]


class SignalCreateRequest(BaseModel):
    offer_sdp: str
    ice_a: str


class SignalJoinRequest(BaseModel):
    answer_sdp: str
    ice_b: str


class SignalGroupSlotRequest(BaseModel):
    group_code: str
    member_index: int
    sdp_blob: str
    ice_blob: str


class DHTAnnounceRequest(BaseModel):
    node_id: str
    username: str


class UserRegisterRequest(BaseModel):
    username: str
    public_key: str
    avatar_seed: str


class WaitlistRequest(BaseModel):
    email: EmailStr


@router.get("/vault")
async def vault_home():
    return {"message": "VaultTheSpire landing API is online"}


@router.post("/vault/api/signal/create")
async def signal_create(body: SignalCreateRequest):
    _cleanup_expired()
    room_code = f"{uuid.uuid4().hex[:4].upper()}-{int(time.time()) % 10000:04d}"
    expires_at = _now() + timedelta(minutes=10)
    with SIGNAL_LOCK:
        signal_store[room_code] = {
            "offer_sdp": body.offer_sdp,
            "answer_sdp": None,
            "ice_a": body.ice_a,
            "ice_b": None,
            "created_at": _now(),
            "expires_at": expires_at,
            "answered_at": None,
        }
    return {"room_code": room_code}


@router.post("/vault/api/signal/join/{room_code}")
async def signal_join(room_code: str, body: SignalJoinRequest):
    with SIGNAL_LOCK:
        rec = signal_store.get(room_code)
        if not rec or rec["expires_at"] < _now():
            raise HTTPException(status_code=404, detail="Room not found or expired")
        rec["answer_sdp"] = body.answer_sdp
        rec["ice_b"] = body.ice_b
        rec["answered_at"] = _now()
    return {"ok": True}


@router.get("/vault/api/signal/poll/{room_code}")
async def signal_poll(room_code: str):
    with SIGNAL_LOCK:
        rec = signal_store.get(room_code)
        if not rec or rec["expires_at"] < _now():
            raise HTTPException(status_code=404, detail="Room not found or expired")
        return {
            "offer_sdp": rec["offer_sdp"],
            "answer_sdp": rec["answer_sdp"],
            "ice_a": rec["ice_a"],
            "ice_b": rec["ice_b"],
            "created_at": rec["created_at"].isoformat(),
            "answered_at": rec["answered_at"].isoformat() if rec["answered_at"] else None,
        }


@router.delete("/vault/api/signal/{room_code}")
async def signal_delete(room_code: str):
    with SIGNAL_LOCK:
        if room_code in signal_store:
            del signal_store[room_code]
            return {"ok": True}
    raise HTTPException(status_code=404, detail="Room not found")


@router.post("/vault/api/signal/group/slot")
async def signal_group_slot(body: SignalGroupSlotRequest):
    _cleanup_expired()
    with SIGNAL_LOCK:
        group = group_signals.setdefault(body.group_code, {})
        group[body.member_index] = {
            "sdp_blob": body.sdp_blob,
            "ice_blob": body.ice_blob,
            "created_at": _now(),
            "expires_at": _now() + timedelta(minutes=10),
        }
    return {"ok": True}


@router.get("/vault/api/signal/group/{group_code}")
async def signal_group(group_code: str):
    _cleanup_expired()
    with SIGNAL_LOCK:
        group = group_signals.get(group_code, {})
        return {"slots": [{"member_index": k, **v} for k, v in group.items()]}


@router.post("/vault/api/dht/announce")
async def dht_announce(body: DHTAnnounceRequest):
    if not re.fullmatch(r"[0-9A-Fa-f]{40}", body.node_id):
        raise HTTPException(status_code=400, detail="node_id must be 160-bit hex")
    with DHT_LOCK:
        dht_nodes[body.node_id] = {
            "username": body.username,
            "last_seen": _now(),
        }
        if len(dht_nodes) > 200:
            sorted_items = sorted(dht_nodes.items(), key=lambda x: x[1]["last_seen"])
            for node_id, _ in sorted_items[:-200]:
                del dht_nodes[node_id]
    return {"ok": True}


@router.get("/vault/api/dht/bootstrap")
async def dht_bootstrap():
    _cleanup_expired()
    with DHT_LOCK:
        nodes = list(dht_nodes.items())
    nodes.sort(key=lambda x: x[1]["last_seen"], reverse=True)
    return {
        "nodes": [
            {"node_id": nid, "username": data["username"]}
            for nid, data in nodes[:20]
        ]
    }


@router.post("/vault/api/user/register")
async def user_register(body: UserRegisterRequest):
    if not 1 <= len(body.username) <= 40:
        raise HTTPException(status_code=400, detail="username length invalid")
    # For now, this endpoint does not persist in DB; it returns success.
    return {"ok": True, "username": body.username}


@router.get("/vault/api/user/{username}")
async def user_get(username: str):
    return {"username": username, "public_key": "", "avatar_seed": ""}


@router.get("/vault/api/user/search")
async def user_search(q: str):
    return {"results": [{"username": q, "avatar_seed": "seed"} for _ in range(1)]}


@router.get("/vault/api/telegram/channel/{channel_username}")
async def telegram_channel(channel_username: str):
    token = os.getenv("VAULT_TELEGRAM_BOT_TOKEN")
    if not token:
        raise HTTPException(status_code=500, detail="Telegram bot token not configured")
    async with httpx.AsyncClient(timeout=10) as client:
        chat_resp = await client.get(
            f"https://api.telegram.org/bot{token}/getChat?chat_id=@{channel_username}"
        )
        if chat_resp.status_code != 200:
            raise HTTPException(status_code=chat_resp.status_code, detail="Telegrm API error")
        chat_data = chat_resp.json()
        if not chat_data.get("ok"):
            raise HTTPException(status_code=404, detail="Channel not found")

        # Minimal public posts simulation - do not  store user data.
        return {
            "name": chat_data["result"].get("title", channel_username),
            "description": chat_data["result"].get("description", ""),
            "member_count": chat_data["result"].get("members_count", 0),
            "posts": [],
        }


@router.get("/vault/version")
async def vault_version():
    return {
        "latest": "1.0.0",
        "platforms": {
            "android": {"version": "1.0.0", "url": "/vault/downloads/vaultthespire-1.0.0-android.apk", "size_mb": 60},
            "ios": {"version": "1.0.0", "url": "https://quizthespire.com/vault/downloads/vaultthespire-1.0.0-ios.ipa", "size_mb": 70},
            "windows": {"version": "1.0.0", "url": "/vault/downloads/vaultthespire-1.0.0-windows.exe", "size_mb": 85},
            "macos": {"version": "1.0.0", "url": "/vault/downloads/vaultthespire-1.0.0-macos.dmg", "size_mb": 90},
            "linux": {"version": "1.0.0", "url": "/vault/downloads/vaultthespire-1.0.0-linux.AppImage", "size_mb": 95},
        },
    }


@router.post("/vault/api/waitlist")
async def waitlist(body: WaitlistRequest):
    with WAITLIST_LOCK:
        vault_waitlist.add(body.email)
    return {"ok": True}
