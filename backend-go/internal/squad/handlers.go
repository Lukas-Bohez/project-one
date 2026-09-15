package squad

import (
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/google/uuid"
)

// handleEvent routes incoming WebSocket events to their handlers.
// The recover() guard means a panicking handler only drops the offending
// client's message instead of crashing the whole backend.
// Pre-auth sockets may only send join_finder; anything else is rejected so
// unauthenticated connections cannot touch squad state or fan out broadcasts.
func (h *Hub) handleEvent(c *client, msg *message) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("squad: recovered from panic in event %s: %v", msg.Event, r)
			c.sendEvent("error", map[string]string{"message": "Could not process that request"})
		}
	}()
	if !c.authed && msg.Event != "join_finder" {
		c.sendEvent("error", map[string]string{"message": "Join the finder first"})
		return
	}
	if msg.Event == "join_finder" {
		h.handleJoinFinder(c, msg.Data)
		return
	}
	switch msg.Event {
	case "create_squad":
		h.handleCreateSquad(c, msg.Data)
	case "join_squad":
		h.handleJoinSquad(c, msg.Data)
	case "leave_squad":
		h.handleLeaveSquad(c, msg.Data)
	case "toggle_ready":
		h.handleToggleReady(c, msg.Data)
	case "send_chat":
	case "chat_message":
		h.handleChatMessage(c, msg.Data)
	case "kick_player":
		h.handleKickPlayer(c, msg.Data)
	case "update_squad":
		h.handleUpdateSquad(c, msg.Data)
	case "get_squad_list":
		h.sendSquadList(c)
	case "get_filter_options":
		h.sendFilterOptions(c)
	case "set_role":
		h.HandleSetRole(c, msg.Data)
	case "set_drop_target":
		h.HandleSetDropTarget(c, msg.Data)
	case "start_session":
		h.HandleStartSession(c, msg.Data)
	case "end_session":
		h.HandleEndSession(c, msg.Data)
	case "submit_report":
		h.HandleSubmitReport(c, msg.Data)
	case "set_eta":
		h.HandleSetETA(c, msg.Data)
	case "set_activity":
		h.handleSetActivity(c, msg.Data)
	case "recent_played":
		h.handleRecentPlayed(c, msg.Data)
	case "find_match":
		h.HandleFindMatch(c, msg.Data)
	case "get_games":
		h.handleGetGames(c, msg.Data)
	case "add_game":
		h.handleAddGame(c, msg.Data)
	case "add_category":
		h.handleAddCategory(c, msg.Data)
	default:
		log.Printf("squad: unknown event: %s", msg.Event)
	}
}

// gameResp is the wire shape for a game sent to clients.
type gameResp struct {
	ID          string      `json:"id"`
	Name        string      `json:"name"`
	Slug        string      `json:"slug"`
	Description string      `json:"description"`
	Icon        string      `json:"icon"`
	IsCustom    bool        `json:"isCustom"`
	CreatedBy   string      `json:"createdBy"`
	CreatedAt   string      `json:"createdAt"`
	Categories  []categoryResp `json:"categories"`
}

// categoryResp is the wire shape for a category sent to clients.
type categoryResp struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Icon      string `json:"icon"`
	IsCustom  bool   `json:"isCustom"`
	CreatedBy string `json:"createdBy"`
}

// handleCreateSquad creates a new squad
func (h *Hub) handleCreateSquad(c *client, data json.RawMessage) {
	var req struct {
		Name        string   `json:"name"`
		GameID      string   `json:"gameId"`
		CategoryID  string   `json:"categoryId"`
		Mission     string   `json:"mission"`
		MissionType string   `json:"missionType"`
		Planet      string   `json:"planet"`
		Difficulty  string   `json:"difficulty"`
		Region      string   `json:"region"`
		Language    string   `json:"language"`
		Tags        []string `json:"tags"`
		SquadSize   int      `json:"squadSize"` // 4 or 6 players
		Mode        string   `json:"mode"`      // "casual" or "serious"
		Description string   `json:"description"`
		Objective   string   `json:"objective"` // "clear", "farm", "other"
		SteelPath   bool     `json:"steelPath"` // modifier toggles
		Nightmare   bool     `json:"nightmare"`
		VoidFissure bool     `json:"voidFissure"`
	}

	if err := json.Unmarshal(data, &req); err != nil {
		c.sendEvent("error", map[string]string{"message": "Invalid squad data"})
		return
	}

	// The frontend sends missionType; accept the legacy `mission` key too.
	mission := req.Mission
	if mission == "" {
		mission = req.MissionType
	}

	h.mu.RLock()
	if squadID, ok := h.playerSquad[c.player.ID]; ok {
		h.mu.RUnlock()
		c.sendEvent("error", map[string]string{"message": "Already in a squad", "squadId": squadID})
		return
	}
	h.mu.RUnlock()

	// Security: clamp and sanitize the freeform description
	description := SanitizeString(req.Description)
	if len(description) > MaxDescriptionLen {
		description = description[:MaxDescriptionLen]
	}
	// Objective: accept only known values
	objective := strings.ToLower(strings.TrimSpace(req.Objective))
	switch objective {
	case "clear", "farm", "other":
	default:
		objective = ""
	}

	squad := &Squad{
		ID:         uuid.New().String(),
		Name:       req.Name,
		GameID:     req.GameID,
		CategoryID: req.CategoryID,
		Mission:    mission,
		Planet:     req.Planet,
		Difficulty: req.Difficulty,
		Region:     req.Region,
		Language:   req.Language,
		Status:     SquadStatusOpen,
		LeaderID:   c.player.ID,
		LeaderName: c.player.Username,
		Mode:       SquadMode(req.Mode),
		Players:    []*Player{c.player},
		SquadSize:  req.SquadSize,
		MaxPlayers: func() int {
			if req.SquadSize == 4 {
				return 4
			}
			return 6
		}(),
		CreatedAt:   time.Now(),
		Tags:        req.Tags,
		Description: description,
		Objective:   objective,
		SteelPath:   req.SteelPath,
		Nightmare:   req.Nightmare,
		VoidFissure: req.VoidFissure,
	}

	h.mu.Lock()
	h.squads[squad.ID] = squad
	h.playerSquad[c.player.ID] = squad.ID
	h.mu.Unlock()

	c.sendEvent("squad_created", squad)
	h.broadcastSquadList()
	log.Printf("squad: %s created squad %s (%s)", c.player.Username, squad.Name, squad.ID)
}

// handleJoinSquad adds a player to an existing squad
func (h *Hub) handleJoinSquad(c *client, data json.RawMessage) {
	var req struct {
		SquadID string `json:"squadId"`
	}

	if err := json.Unmarshal(data, &req); err != nil {
		c.sendEvent("error", map[string]string{"message": "Invalid join request"})
		return
	}

	// Membership guard: joining a DIFFERENT squad while already in one is
	// still blocked. But re-requesting the squad you are already in is not
	// a join: the client's "back to list" only hides the detail view
	// (client-side currentSquad is nulled while server-side membership
	// persists), so re-clicking your own squad card lands here. Resend the
	// current squad state as squad_joined so the client re-opens it,
	// instead of failing with "Already in a squad".
	h.mu.RLock()
	squadID, inSquad := h.playerSquad[c.player.ID]
	var current *Squad
	if inSquad {
		current = h.squads[squadID]
	}
	h.mu.RUnlock()

	if inSquad {
		if current != nil && squadID == req.SquadID {
			c.sendEvent("squad_joined", current)
			return
		}
		c.sendEvent("error", map[string]string{"message": "Already in a squad", "squadId": squadID})
		return
	}

	h.mu.Lock()
	squad, ok := h.squads[req.SquadID]
	if !ok {
		h.mu.Unlock()
		c.sendEvent("error", map[string]string{"message": "Squad not found"})
		return
	}

	if len(squad.Players) >= squad.MaxPlayers {
		h.mu.Unlock()
		c.sendEvent("error", map[string]string{"message": "Squad is full"})
		return
	}

	if squad.Status != SquadStatusOpen {
		h.mu.Unlock()
		c.sendEvent("error", map[string]string{"message": "Squad is not open"})
		return
	}

	squad.Players = append(squad.Players, c.player)
	h.playerSquad[c.player.ID] = squad.ID

	if len(squad.Players) >= squad.MaxPlayers {
		squad.Status = SquadStatusFull
	}
	h.mu.Unlock()

	c.sendEvent("squad_joined", squad)

	joinMsg := ChatMessage{
		ID:         uuid.New().String(),
		SquadID:    squad.ID,
		SenderID:   "system",
		SenderName: "System",
		Content:    fmt.Sprintf("%s joined the squad!", c.player.Username),
		Timestamp:  time.Now(),
		Type:       "join",
	}
	h.broadcastToSquad(squad.ID, "player_joined", map[string]interface{}{
		"player":  c.player,
		"squad":   squad,
		"message": joinMsg,
	}, "")

	h.broadcastSquadList()
	log.Printf("squad: %s joined squad %s", c.player.Username, squad.ID)
}

// handleGetGames responds with the full list of games and their categories.
func (h *Hub) handleGetGames(c *client, data json.RawMessage) {
_ = data
games := h.GetGames()
result := make([]gameResp, 0, len(games))
for _, g := range games {
cr := make([]categoryResp, 0, len(g.Categories))
for _, cat := range g.Categories {
cr = append(cr, categoryResp{
ID:        cat.ID,
Name:      cat.Name,
Icon:      cat.Icon,
IsCustom:  cat.IsCustom,
CreatedBy: cat.CreatedBy,
})
}
result = append(result, gameResp{
ID:          g.ID,
Name:        g.Name,
Slug:        g.Slug,
Description: g.Description,
Icon:        g.Icon,
IsCustom:    g.IsCustom,
CreatedBy:   g.CreatedBy,
CreatedAt:   g.CreatedAt.Format(time.RFC3339),
Categories:  cr,
})
}
c.sendEvent("games_list", map[string]interface{}{"games": result})
}

// handleAddGame creates a new user-defined game.
func (h *Hub) handleAddGame(c *client, data json.RawMessage) {
defer func() {
if r := recover(); r != nil {
log.Printf("squad: recovered from panic in add_game: %v", r)
c.sendEvent("error", map[string]string{"message": "Could not create game"})
}
}()
var req struct {
Name        string `json:"name"`
Slug        string `json:"slug"`
Description string `json:"description"`
Icon        string `json:"icon"`
}
if err := json.Unmarshal(data, &req); err != nil {
c.sendEvent("error", map[string]string{"message": "Invalid game data"})
return
}
name := strings.TrimSpace(req.Name)
if name == "" || len(name) > 60 {
c.sendEvent("error", map[string]string{"message": "Game name must be 1-60 characters"})
return
}
desc := strings.TrimSpace(req.Description)
if len(desc) > 300 {
desc = desc[:300]
}
icon := strings.TrimSpace(req.Icon)
if icon == "" {
icon = "🎮"
}
if len(icon) > 4 {
icon = icon[:4]
}

g := h.AddGame(name, req.Slug, desc, icon, c.player.Username)
if g == nil {
c.sendEvent("error", map[string]string{"message": "Could not create game"})
return
}
cr := make([]categoryResp, 0, len(g.Categories))
for _, cat := range g.Categories {
cr = append(cr, categoryResp{
ID:        cat.ID,
Name:      cat.Name,
Icon:      cat.Icon,
IsCustom:  cat.IsCustom,
CreatedBy: cat.CreatedBy,
})
}
c.sendEvent("game_created", map[string]interface{}{
"game": gameResp{
ID:          g.ID,
Name:        g.Name,
Slug:        g.Slug,
Description: g.Description,
Icon:        g.Icon,
IsCustom:    g.IsCustom,
CreatedBy:   g.CreatedBy,
CreatedAt:   g.CreatedAt.Format(time.RFC3339),
Categories:  cr,
},
})
h.broadcastEvent("games_update", map[string]interface{}{
"action": "added_game",
"game": gameResp{
ID:          g.ID,
Name:        g.Name,
Slug:        g.Slug,
Description: g.Description,
Icon:        g.Icon,
IsCustom:    g.IsCustom,
CreatedBy:   g.CreatedBy,
CreatedAt:   g.CreatedAt.Format(time.RFC3339),
Categories:  cr,
},
})
log.Printf("squad: %s created game %s", c.player.Username, g.Name)
}

// handleAddCategory adds a new category to an existing game.
func (h *Hub) handleAddCategory(c *client, data json.RawMessage) {
defer func() {
if r := recover(); r != nil {
log.Printf("squad: recovered from panic in add_category: %v", r)
c.sendEvent("error", map[string]string{"message": "Could not add category"})
}
}()
var req struct {
GameID  string `json:"gameId"`
Name    string `json:"name"`
Icon    string `json:"icon"`
}
if err := json.Unmarshal(data, &req); err != nil {
c.sendEvent("error", map[string]string{"message": "Invalid category data"})
return
}
name := strings.TrimSpace(req.Name)
if name == "" || len(name) > 50 {
c.sendEvent("error", map[string]string{"message": "Category name must be 1-50 characters"})
return
}
gameID := strings.TrimSpace(req.GameID)
if gameID == "" {
c.sendEvent("error", map[string]string{"message": "Must specify a game"})
return
}
icon := strings.TrimSpace(req.Icon)
if icon == "" {
icon = "🎯"
}
if len(icon) > 4 {
icon = icon[:4]
}

cat := h.AddCategory(gameID, name, icon, c.player.Username)
if cat == nil {
c.sendEvent("error", map[string]string{"message": "Game not found or could not add category"})
return
}
c.sendEvent("category_added", map[string]interface{}{
"category": categoryResp{
ID:        cat.ID,
Name:      cat.Name,
Icon:      cat.Icon,
IsCustom:  cat.IsCustom,
CreatedBy: cat.CreatedBy,
},
"gameId": gameID,
})
h.broadcastEvent("games_update", map[string]interface{}{
"action":    "added_category",
"gameId":    gameID,
"category": categoryResp{
ID:        cat.ID,
Name:      cat.Name,
Icon:      cat.Icon,
IsCustom:  cat.IsCustom,
CreatedBy: cat.CreatedBy,
},
})
log.Printf("squad: %s added category %s to game %s", c.player.Username, cat.Name, gameID)
}
