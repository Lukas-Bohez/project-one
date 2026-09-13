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
| `create_squad` | `{name, missionType, planet, difficulty, region, language, squadSize, mode, maxPlayers, description?, objective?, steelPath?, nightmare?, voidFissure?}` | Create a new squad. `description` is a freeform strategy/notes line (max 240 chars). `objective` is `clear`, `farm` or `other`. `steelPath`/`nightmare`/`voidFissure` are boolean modifiers that stack on top of the mission type. |
| `join_squad` | `{squadId: string}` | Join an existing squad |
| `leave_squad` | `{squadId: string}` | Leave current squad |
| `toggle_ready` | `{squadId: string}` | Toggle ready status |
| `chat_message` | `{squadId, content: string}` | Send chat message |
| `kick_player` | `{squadId, playerId}` | Kick a player (leader only) |
| `update_squad` | `{squadId, name?, missionType?, planet?, difficulty?, region?, language?, squadSize?, mode?, description?, objective?, steelPath?, nightmare?, voidFissure?}` | Update squad settings. Modifier/objective fields use pointers: omit to leave unchanged, send `false`/`""` to clear. |
| `set_role` | `{squadId, role}` | Set your role in the squad (`dps`, `support`, `buffer`, `shield`, `arcane`, `resource`, `efficiency`, `any`) |
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
| `filter_options` | `{missions[], planets[], difficulties[], regions[], languages[], objectives[], modifiers[], roles[]}` | Available filter options. `missions` holds pure gamemodes + special activities only (32 entries incl. "Any"). `modifiers` are the stacking toggles (Steel Path, Nightmare, Void Fissure) that used to be mixed into missions. `objectives` = any/clear/farm/other. `roles` = dps/support/buffer/shield/arcane/resource/efficiency/any. |
| `kicked` | `{}` | You were kicked from a squad |
| `match_found` | `{squad: Squad, created: bool}` | Quick Match result (joined existing or auto-created) |
| `role_updated` | `{playerId, role}` | A player's role changed in your squad (not sent back to the player who changed it) |
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
  "trustScore": "float — 50 start, +0.5 per mission, -10 per report, no caps",
  "totalMissions": "int",
  "onlineStatus": "string (online | in_game | away | offline)",
  "lastActive": "string (ISO date)",
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
  "missionType": "string — pure gamemode or special activity (e.g. Survival, Defense, EDA (Deep Archimedea), Cascade (Level Cap), Perrita Rebellion). Modifiers are NOT listed here.",
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

## CHANGELOG (2026-09-13) — community-requested overhaul (description, objective, modifiers, roles, new mission types)

Based on feedback from the Warframe community (Reddit), the squad finder gets the features players actually asked for:

- **Freeform description field** when creating a squad. Leaders can write exactly what the run needs: "EDA Stella farm, Cyte-09 ad clear, need supports". Shows on the squad card and in the detail panel. Max 240 chars, sanitized server-side.
- **Objective selector** (Clear / Farm / Other) — tells people at a glance whether the run is to finish a mission or grind loot/points.
- **Mission modifiers are now separate checkboxes**, not entries in the mission list. Steel Path, Nightmare and Void Fissure are tick-box toggles that stack on top of any mission type — fixing the confusion where they were mixed in with gamemodes like Spy and Exterminate.
- **Role selection** per player (DPS, Support, Buffer, Shield, Arcane, Resource, Efficiency, Any). Pick your role once in a squad; it shows as a badge next to your name so leaders can see coverage at a glance — one-unique-Warframe-per-slot runs become possible to organize.
- **New mission types added**: Cascade (Level Cap), Descendia, EDA (Deep Archimedea), ETA (Temporal Archimedea), Perrita Rebellion. These were missing entirely.
- **Steel Path removed from the missions list** (it is a difficulty modifier, not a mission type) and **Void Fissure / Nightmare removed from missions** (they are modifiers now, not missions). All three remain selectable via the modifier checkboxes.
- **Mission list is now pure gamemodes + special activities only** (32 entries incl. "Any"), sorted alphabetically.
- **Fixed a critical backend crash**: `HandleSetRole`, `HandleSetDropTarget`, `HandleStartSession`, `HandleEndSession`, `HandleSubmitReport`, `HandleSetETA`, `HandleAddActivity`, `HandleVotePlayer`, `HandleGetPlayerStats`, `HandleGetSquadHistory` all asserted `data.([]byte)` on a `json.RawMessage` argument, panicking and killing the whole backend (restart counter hit 87). All ten handlers now take `json.RawMessage` directly. Added a `recover()` guard in `handleEvent` so a future panic only drops that one message instead of crashing the server.
- **Docs updated**: `create_squad` and `filter_options` payloads document the new fields; mission count corrected to 32 entries.

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
  filter_options (32 entries incl. Any, 18 planets, 6 difficulties, 7 regions,
  4 platforms, 10 languages) → squad_created, and the hub keeps serving
  clients after disconnects.

## CHANGELOG (2026-09-13) — simplified trust system

- **Unified reputation and trust into one simple system.** Removed the confusing dual reputation/trust system. Now there's just one trust score:
  - Everyone starts at **50**
  - Complete a mission with your squad: **+0.5**
  - Report from another player: **-10**
  - No caps, no floors — simple and transparent
- **Removed clan tag bonus** — clan membership no longer affects trust score
- **Removed mission count cap** — trust grows indefinitely with each mission
- **Simplified info modal** — the "Trust & reputation" section is now just "Trust score" with a clear 2-row table

## CHANGELOG (2026-09-13) — Dragon Key Vaults mission type + alphabetical sorting

- **Added "Dragon Key Vaults" to mission types** in the squad finder. This was a missing Warframe mission type — players can now create and filter squads specifically for Dragon Key Vault runs. The mission list grows from 30 to 31 entries; all dropdowns (filter, create squad, quick match) update automatically since they are populated dynamically from the backend's `filter_options` event.
- **All dropdown lists are now sorted alphabetically** — missions, planets, difficulties, regions, platforms, and languages are all in A→Z order (with "Any" always at the top) so players can quickly find what they're looking for.

## CHANGELOG (2026-09-12) — removed phantom premium/verified tiers

- **Removed "Verified account" (+20) and "Premium supporter" (+30) rows**
  from the info modal's trust score table and badge legend — the app has
  no account linking, no Warframe verification, and no premium tier, so
  these were fantasy features that misled users.
- **Removed dead verification-badge rendering** from squad cards, squad
  detail, and player list in `squad-client.js` (the backend always sets
  `VerificationLevel = VerificationNone`, so the `=== 'verified'` check
  was unreachable).
- **Removed the unreachable verification switch** in `CalculateTrustScore`.
- **Updated docs** (`WARFRAME_SQUAD_FINDER.md`, `squad/README.md`) to drop
  `verificationLevel` and `isPremium` from the player API contract and
  note that reputation can be negative.

## CHANGELOG (2026-09-12) — reputation: forgiving & uncapped

- **Reputation can now go negative** — the old floor at 0 is gone. Bad
  behavior is tracked, but there's no permanent punishment.
- **Reputation contributes to trust with no ceiling** — removed the old
  `min(20, reputation * 0.5)` cap. Each point now adds a flat 0.5 to
  trust, forever. A player with 100 reputation gets +50 trust from it.
- **Result:** redemption is always possible. Five failures followed by
  five clean missions puts you right back where you started, and from
  there every good run keeps climbing. The info modal text was updated
  to reflect this.

## CHANGELOG (2026-09-12) — header redesign

- **Replaced the generic `c-header` with a purpose-built `.squad-header`.**
  The page now shows a horizontal branded bar (logo + "Warframe Squad Finder"
  title with "Quiz The Spire" as a small subtitle that links home) and a
  clean row of icon buttons (info + theme toggle). The header uses the
  squad theme variables so it looks distinct from the main site, has a
  glowing accent line, and collapses gracefully on mobile.

## CHANGELOG (2026-09-12) — filter_options on connect + WebSocket origin fix

- **Dropdowns now populate on first connect.** The hub's register handler
  only sent `squad_list` and `player_count`, never `filter_options`, so the
  mission / planet / difficulty / region selects stayed blank. The register
  case now calls `sendFilterOptions(c)` before `sendSquadList(c)`, so a fresh
  client receives the full filter set immediately on connect.
- **WebSocket no longer 403s on direct / same-origin connections.**
  `isAllowedOrigin()` rejected empty Origin headers, which browsers don't send
  on document loads from links (Reddit, direct navigation). Empty origin now
  passes through; only explicitly disallowed origins are rejected.

## VERIFIED

18/18 end-to-end assertions pass over `ws://localhost:8081/api/v1/squad/ws`:
filter_options (32 entries incl. Any, 18 planets, 6 difficulties, 7 regions,
4 platforms, 10 languages) → squad_list → player_count → create_squad
(missionType / planet / difficulty / squadSize) → chat_message round-trip
→ find_match → leave_squad. Node syntax check on `squad-client.js` clean.
All static assets served with HTTP 200.
