package squad

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// handleKickPlayer allows the squad leader to kick a player (leader only)
func (h *Hub) handleKickPlayer(c *client, data json.RawMessage) {
	var req struct {
		PlayerID string `json:"playerId"`
	}

	if err := json.Unmarshal(data, &req); err != nil {
		return
	}

	h.mu.Lock()
	squadID, ok := h.playerSquad[c.player.ID]
	if !ok {
		h.mu.Unlock()
		return
	}

	squad, ok := h.squads[squadID]
	if !ok || squad.LeaderID != c.player.ID {
		h.mu.Unlock()
		c.sendEvent("error", map[string]string{"message": "Only the squad leader can kick players"})
		return
	}

	var kickedPlayer *Player
	for _, p := range squad.Players {
		if p.ID == req.PlayerID {
			kickedPlayer = p
			break
		}
	}

	if kickedPlayer == nil {
		h.mu.Unlock()
		c.sendEvent("error", map[string]string{"message": "Player not found in squad"})
		return
	}

	h.removePlayerFromSquadLocked(req.PlayerID)
	h.mu.Unlock()

	if kickedClient, ok := h.clients[req.PlayerID]; ok {
		kickedClient.sendEvent("kicked", map[string]string{"squadId": squadID})
	}

	kickMsg := ChatMessage{
		ID:         uuid.New().String(),
		SquadID:    squadID,
		SenderID:   "system",
		SenderName: "System",
		Content:    fmt.Sprintf("%s was kicked from the squad.", kickedPlayer.Username),
		Timestamp:  time.Now(),
		Type:       "system",
	}
	h.broadcastToSquad(squadID, "player_kicked", map[string]interface{}{
		"playerId": req.PlayerID,
		"username": kickedPlayer.Username,
		"squad":    squad,
		"message":  kickMsg,
	}, "")

	h.broadcastSquadList()
}

// handleUpdateSquad allows the leader to update squad settings
func (h *Hub) handleUpdateSquad(c *client, data json.RawMessage) {
	var req struct {
		Name        string   `json:"name"`
		Mission     string   `json:"mission"`
		MissionType string   `json:"missionType"`
		Planet      string   `json:"planet"`
		Difficulty  string   `json:"difficulty"`
		Region      string   `json:"region"`
		Language    string   `json:"language"`
		SquadSize  int      `json:"squadSize"`
		Mode       string   `json:"mode"`
		Tags       []string `json:"tags"`
	}

	if err := json.Unmarshal(data, &req); err != nil {
		return
	}

	h.mu.Lock()
	squadID, ok := h.playerSquad[c.player.ID]
	if !ok {
		h.mu.Unlock()
		return
	}

	squad, ok := h.squads[squadID]
	if !ok || squad.LeaderID != c.player.ID {
		h.mu.Unlock()
		c.sendEvent("error", map[string]string{"message": "Only the squad leader can update the squad"})
		return
	}

	if req.Name != "" {
		squad.Name = req.Name
	}
	if req.Mission != "" {
		squad.Mission = req.Mission
	} else if req.MissionType != "" {
		squad.Mission = req.MissionType
	}
	if req.Planet != "" {
		squad.Planet = req.Planet
	}
	if req.Difficulty != "" {
		squad.Difficulty = req.Difficulty
	}
	if req.Tags != nil {
		squad.Tags = req.Tags
	}
	if req.Region != "" {
		squad.Region = req.Region
	}
	if req.Language != "" {
		squad.Language = req.Language
	}
	if req.SquadSize > 0 {
		squad.SquadSize = req.SquadSize
		squad.MaxPlayers = func() int {
			if req.SquadSize == 4 {
				return 4
			}
			return 6
		}()
	}
	if req.Mode != "" {
		squad.Mode = SquadMode(req.Mode)
	}
	h.mu.Unlock()

	h.broadcastToSquad(squadID, "squad_updated", squad, "")
	h.broadcastSquadList()
}


