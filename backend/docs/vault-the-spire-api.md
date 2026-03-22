# VaultTheSpire API Documentation

This document describes the VaultTheSpire endpoints implemented in `backend/api/routers/vault.py`.

## Main endpoints

- `/vault/api/version` (GET): API version + minimum supported app version.
- `/vault/api/config` (GET): protocol versions, tracker whitelist + limits, hub status.
- `/vault/api/dht/bootstrap` (GET): array of `host:port` strings for DHT bootstrapping.
- `/vault/api/vault/peers` (GET): query by `infohash`; returns peer list.
- `/vault/api/vault/announce` (POST): announce peer; requires `Authorization: Bearer` token.
- `/vault/api/vault/resolve/{infohash}` (GET): metadata + tracker list + public anchor.
- `/vault/api/vault/stats/{infohash}` (GET): swarm stats.
- `/vault/api/notify/poll` (GET): poll user wake notices.
- `/vault/api/notify/wake` (POST): send wake notice; requires `Authorization: Bearer` token.

## Security and limits

- Auth token is configured via `VAULT_API_TOKEN`.
- Global rate limiting via SlowAPI in `backend/app.py`.
- Token revocation and admin guard built into Admin endpoints (not part of VaultTheSpire API but available).

## Policy

- No user content is persisted beyond short-lived metadata.
- Peer and wake notice entries have a 5-minute TTL.
- API responses include CORS header `Access-Control-Allow-Origin: *`.
