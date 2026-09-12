package squad

import (
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"
)

// handleEvent routes incoming WebSocket events to their handlers
func (h *Hub) handleEvent(c *client, msg *message) {
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
	default:
		log.Printf("squad: unknown event: %s", msg.Event)
	}
}

// handleCreateSquad creates a new squad
func (h *Hub) handleCreateSquad(c *client, data json.RawMessage) {
	var req struct {
		Name        string   `json:"name"`
		Mission     string   `json:"mission"`
		MissionType string   `json:"missionType"`
		Planet      string   `json:"planet"`
		Difficulty  string   `json:"difficulty"`
		Region      string   `json:"region"`
		Language    string   `json:"language"`
		Tags        []string `json:"tags"`
		SquadSize   int      `json:"squadSize"` // 4 or 6 players
		Mode        string   `json:"mode"`     // "casual" or "serious"
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

	squad := &Squad{
		ID:         uuid.New().String(),
		Name:       req.Name,
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
		SquadSize:    req.SquadSize,
		MaxPlayers:  func() int {
			if req.SquadSize == 4 {
				return 4
			}
			return 6
		}(),
		CreatedAt:  time.Now(),
		Tags:       req.Tags,
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

	h.mu.RLock()
	if squadID, ok := h.playerSquad[c.player.ID]; ok {
		h.mu.RUnlock()
		c.sendEvent("error", map[string]string{"message": "Already in a squad", "squadId": squadID})
		return
	}
	h.mu.RUnlock()

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
