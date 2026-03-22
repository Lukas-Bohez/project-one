# VaultTheSpire API (quizthespire.com)

This file documents the `/vault/api` endpoints implemented in `backend/api/routers/vault.py`.

## Auth

- `Authorization: Bearer <token>` is required for mutating endpoints:
  - `/vault/api/vault/announce`
  - `/vault/api/notify/wake`
- `VAULT_API_TOKEN` sets the expected token.

## Rate Limiting

- Global slowapi configured in `backend/app.py` to `60/minute` per IP.
- Additional auth endpoint limits are enforced by `_auth_endpoint_rate_limiter` in `backend/app.py`.

## Endpoints

### Public read endpoints

- `GET /vault/api/version`
  - Returns API version and app version metadata.

- `GET /vault/api/config`
  - Returns protocol versions, tracker lists, hub status, and recommended public trackers.

- `GET /vault/api/dht/bootstrap`
  - Returns an array of `host:port` strings for DHT bootstrap nodes.

- `GET /vault/api/vault/peers?infohash=<hash>`
  - Returns peers for the infohash.

- `GET /vault/api/vault/resolve/<infohash>`
  - Returns stub metadata (torrent metadata + trackers + public anchor).

- `GET /vault/api/vault/stats/<infohash>`
  - Returns seeders/leechers counts (seeders from active announce records).

- `GET /vault/api/telegram/channel/{channel_username}`
  - Proxy to Telegram Bot API.

- `GET /vault/api/notify/poll?username=<me>`
  - Returns pending wake notices for a username.

### Mutation endpoints

- `POST /vault/api/vault/announce`
  - Body: `infohash`, `ip`, `port`
  - Registers a peer for announcement; peers expire after ~5 minutes.

- `POST /vault/api/notify/wake`
  - Body: `username`, `sender`, `message`
  - Creates a wake notice for a user (expires after 5 minutes).

- `POST /vault/api/signal/create`, `POST /vault/api/signal/join/{room_code}`, `GET /vault/api/signal/poll/{room_code}`, etc.
  - STUN/TURN signaling support (existing API in router).

## Data retention policy

- Peer entries for vault announces expire after 300 seconds.
- Wake notices expire after 300 seconds.
- DHT nodes are trimmed to 200 by last_seen.

## Notes

- All responses are JSON and include `Access-Control-Allow-Origin: *`.
- This router is loaded in `backend/app.py` at startup.
