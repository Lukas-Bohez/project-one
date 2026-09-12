# Warframe Squad Finder

**Location**: `https://quizthespire.com/pages/squad/`

## Project Structure

```
project-one/
├── backend-go/
│   └── internal/squad/
│       ├── models.go          (180+ lines) - Data structures
│       ├── hub.go            (190+ lines) - WebSocket hub
│       ├── handlers.go       (~80 lines)  - Event routing
│       ├── handlers_extra.go (280+ lines) - Extra handlers
│       ├── handlers_squad.go (145 lines)  - Squad CRUD
│       └── README.md         - Protocol documentation
├── frontend/
│   ├── pages/squad/
│   │   └── index.html          (370+ lines) - Main UI
│   ├── css/pages/squad/
│   │   ├── squad.css           (500+ lines) - Core styles
│   │   ├── squad-panels.css    (335 lines)  - Panel layouts
│   │   └── squad-chat.css      (217 lines)  - Chat styles
│   └── js/pages/squad/
│       └── squad-client.js     (680+ lines) - WebSocket client
└── cmd/server/main.go         (255 lines)  - Server entry point
```

---

## QUICK START - How to Run

```bash
cd /home/student/Project/project-one/backend-go
export PATH=/usr/local/go/bin:$PATH

go build -o bin/quizthespire-server ./cmd/server

# Run (serves on port 8081):
PORT=8081 CORS_ALLOWED_ORIGINS='https://quizthespire.com,http://localhost:8081' ./bin/quizthespire-server
```

---

## BACKEND - WebSocket API

### Connection
- **URL**: `ws://your-host/api/v1/squad/ws`
- **Protocol**: Standard WebSocket, messages are JSON `{event, data}`

### Events to Send (Client → Server)

| Event | Data Shape | Description |
|-------|------------|-------------|
| `join_finder` | `{player: Player}` | Register player when connecting |
| `get_squad_list` | `{filters?: FilterState}` | Request filtered squad list |
| `create_squad` | `{name, missionType, planet, difficulty, region, language, squadSize, mode, maxPlayers}` | Create a new squad |
| `join_squad` | `{squadId: string}` | Join an existing squad |
| `leave_squad` | `{squadId: string}` | Leave current squad |
| `toggle_ready` | `{squadId: string}` | Toggle ready status |
| `chat_message` | `{squadId, content: string}` | Send chat message |
| `kick_player` | `{squadId, playerId}` | Kick a player (leader only) |
| `update_squad` | `{squadId, name?, missionType?, planet?, difficulty?, region?, language?, squadSize?, mode?}` | Update squad settings |
| `get_filter_options` | `{}` | Request available filter options |
| `set_activity` | `{status: string, game?: string}` | Update online status |
| `recent_played` | `{missionType?, planet?, difficulty?}` | Report recent mission |
| `find_match` | `{mode?, squadSize?, mission?, planet?, difficulty?, region?, language?}` | Quick Match: join random open squad or auto-create |

### Events Received (Server → Client)

| Event | Data Shape | Description |
|-------|------------|-------------|
| `squad_list` | `{squads: Squad[]}` | List of available squads |
| `squad_created` | `{squad: Squad}` | Squad created confirmation |
| `squad_joined` | `{squad: Squad}` | Joined squad confirmation |
| `squad_left` | `{}` | Left squad |
| `player_joined` | `{player: Player}` | New player joined your squad |
| `player_left` | `{playerId: string}` | Player left your squad |
| `player_kicked` | `{kickedUsername: string}` | A player was kicked |
| `ready_update` | `{squad: Squad}` | Ready status changed |
| `squad_updated` | `{squad: Squad}` | Squad settings updated |
| `chat_message` | `{message: {senderName, content, timestamp, type}}` | Chat message received |
| `player_count` | `{online: int}` | Online player count updated |
| `filter_options` | `{missions[], planets[], difficulties[], regions[], languages[]}` | Available filter options |
| `kicked` | `{}` | You were kicked from a squad |
| `match_found` | `{squad: Squad, created: bool}` | Quick Match result (joined existing or auto-created) |
| `error` | `{message: string}` | Error occurred |

---

## DATA MODELS

### Player
```json
{
  "id": "string",
  "username": "string (2-20 chars, alphanumeric + _-[])",
  "masteryRank": "int (0-30)",
  "platform": "string (PC | PlayStation | Xbox | Switch)",
  "region": "string (EU | NA | OC | ASIA)",
  "language": "string (e.g. English)",
  "clanTag": "string (optional, max 10)",
  "verificationLevel": "string (none | pending | verified | premium)",
  "trustScore": "int (0-100)",
  "reputation": "int",
  "totalMissions": "int",
  "onlineStatus": "string (online | in_game | away | offline)",
  "lastActive": "string (ISO date)",
  "isPremium": "bool",
  "reports": "int",
  "banned": "bool",
  "matchPref": "object (preferredMission, preferredPlanet, preferredDifficulty)",
  "recentActivity": "array of recent activity entries"
}
```

### Squad
```json
{
  "id": "string",
  "name": "string (custom lobby name, max 40)",
  "missionType": "string (e.g. Survival, Defense, Capture, Interception, Excavation, Rally, Archwing, Orb, Sortie, Steel Path)",
  "planet": "string (e.g. Earth, Venus, Mercury, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto, Sedna, Lua, Phobos, Eris, Stalker,clo...
---

## DEPLOYMENT NOTES (IMPORTANT - 2026-09-12)

The Go backend runs on **port 8081** (systemd unit `quizthespire.service`). Apache
fronts the site and MUST proxy the squad WebSocket to the Go server **BEFORE** the
generic `/api` → Python (:8001) catch-all, or players get `404` → "Connecting..."
forever + "0 online".

In `/etc/apache2/sites-enabled/quizthespire.com-le-ssl.conf` (and the :80 vhost):

```apache
    # Squad finder: in-memory WebSocket + API on the Go backend (:8081).
    # These MUST come before the generic /api -> Python (:8001) catch-all.
    ProxyPass /api/v1/squad/ws ws://127.0.0.1:8081/api/v1/squad/ws
    ProxyPassReverse /api/v1/squad/ws ws://127.0.0.1:8081/api/v1/squad/ws
    ProxyPass /api/v1/squad http://127.0.0.1:8081/api/v1/squad
    ProxyPassReverse /api/v1/squad http://127.0.0.1:8081/api/v1/squad
```

Then `sudo apache2ctl configtest && sudo systemctl reload apache2`.

The squad finder is **in-memory only** and does NOT require MySQL — it is
registered outside the `if mysqlDB != nil` gate in `cmd/server/main.go`.

---

## CHANGELOG (2026-09-12) — made playable

- **Server now assigns each player a UUID** on `join_finder`. Previously every
  client kept `id=""`, so all players collided in the `clients`/`playerSquad`
  maps → "Already in a squad" errors and broken rosters.
- **`join_finder` accepts the documented `{player: Player}` payload** (wrapped),
  with a fallback for a bare Player. Previously the server only tried to parse a
  bare Player, so every handshake failed → "Connecting..." / "0 online".
- **`chat_message` is now routed** (the docs call it `chat_message`; the server
  only listened for `send_chat`). `send_chat` still works.
- **`missionType` is used everywhere** (client + docs). `create_squad` and
  `update_squad` accept `missionType` (with legacy `mission` fallback) and the
  `Squad` JSON field is emitted as `missionType`.
- **Frontend `filterRegion`** is initialized (was `undefined`, throwing when the
  region filter options arrived).
- **Fixed compile errors** that blocked rebuilding the server (duplicate
  `ActivityEntry`/`MatchPreference` types, duplicate `HandleSetMatchPref`,
  `*Client` typo, `player.*` fields looked up on `*client`, `broadcastToHub`
  → `broadcastEvent`).
- **`isAllowedOrigin`** now also accepts `https://www.quizthespire.com`.
- The squad finder starts even when MySQL is unavailable.

## CHANGELOG (2026-09-12) — remember me & quick-match polish

- **Auto-login / remember me**: the client persists the Tenno profile (name,
  MR, platform, region, clan) in `localStorage` under `squad_finder_profile`
  after a successful `join_finder`, and auto-connects with it on the next page
  load (the Go hub honors a non-empty client `id`, and wipes squad membership
  on disconnect, so replaying the profile is safe). A "Switch" button in the
  status bar clears the saved profile and returns to the setup screen.
  Reconnects now reuse the remembered profile instead of reading the (empty)
  form, and no longer flash the setup panel mid-reconnect — the main panel
  stays up with a "Reconnecting…" status, falling back to the prefilled setup
  screen only when all attempts are exhausted.

## CHANGELOG (2026-09-12) — hub deadlock fix (dropdowns empty, quick match stuck)

- **Fixed a fatal re-entrant lock deadlock in `Hub.Run()`'s unregister path.**
  The unregister case acquires `h.mu` and then called
  `removePlayerFromSquad`, which locks `h.mu` again. Go mutexes are not
  re-entrant, so the hub's single event-loop goroutine deadlocked the first
  time any player disconnected (tab close, refresh, network drop). From that
  point the hub processed nothing: `filter_options` was never sent (mission /
  planet / difficulty / region dropdowns stayed empty with only "Select…"),
  `find_match` never responded (Quick Match stuck on "Searching…"), and
  `create_squad` was ignored. The unregister case now calls
  `removePlayerFromSquadLocked` (lock already held). Rebuilt the server and
  verified end-to-end: registration → squad_list/player_count →
  filter_options (30 missions, 18 planets, 6 difficulties, 7 regions,
  4 platforms, 10 languages) → squad_created, and the hub keeps serving
  clients after disconnects.

## VERIFIED

Full scripted flow passes over `wss://quizthespire.com/api/v1/squad/ws`:
join_finder → player_count, get_filter_options, create_squad (missionType),
join_squad by a 2nd player, chat_message round-trip, toggle_ready, leave_squad.
