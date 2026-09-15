package squad

import (
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"
)

// sendFilterOptions sends available filter options to a client
func (h *Hub) sendFilterOptions(c *client) {
	c.sendEvent("filter_options", map[string]interface{}{
		"missions":     AvailableMissions,
		"planets":      AvailablePlanets,
		"difficulties": AvailableDifficulties,
		"regions":      AvailableRegions,
		"platforms":    AvailablePlatforms,
		"languages":    AvailableLanguages,
		"objectives":   AvailableObjectives,
		"modifiers":    AvailableModifiers,
		"roles":        AllRoles,
	})
}

// broadcastSquadList sends the updated squad list to all clients
func (h *Hub) broadcastSquadList() {
	h.mu.RLock()
	squadList := make([]*Squad, 0, len(h.squads))
	for _, squad := range h.squads {
		if squad.Status == SquadStatusOpen || squad.Status == SquadStatusFull {
			squadList = append(squadList, squad)
		}
	}
	h.mu.RUnlock()

	h.broadcastEvent("squad_list", map[string]interface{}{
		"squads": squadList,
	})
}

// removePlayerFromSquad removes a player from their squad
func (h *Hub) removePlayerFromSquad(playerID string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.removePlayerFromSquadLocked(playerID)
}

// removePlayerFromSquadLocked removes a player from their squad (lock must be held)
func (h *Hub) removePlayerFromSquadLocked(playerID string) {
	squadID, ok := h.playerSquad[playerID]
	if !ok {
		return
	}

	delete(h.playerSquad, playerID)

	squad, ok := h.squads[squadID]
	if !ok {
		return
	}

	newPlayers := make([]*Player, 0, len(squad.Players))
	for _, p := range squad.Players {
		if p.ID != playerID {
			newPlayers = append(newPlayers, p)
		}
	}
	squad.Players = newPlayers

	if len(squad.Players) == 0 {
		delete(h.squads, squadID)
		return
	}

	if squad.LeaderID == playerID && len(squad.Players) > 0 {
		squad.LeaderID = squad.Players[0].ID
		squad.LeaderName = squad.Players[0].Username
	}

	if squad.Status == SquadStatusFull && len(squad.Players) < squad.MaxPlayers {
		squad.Status = SquadStatusOpen
	}
}

// handleLeaveSquad removes a player from their squad
func (h *Hub) handleLeaveSquad(c *client, data json.RawMessage) {
	h.mu.Lock()
	squadID, ok := h.playerSquad[c.player.ID]
	if !ok {
		h.mu.Unlock()
		c.sendEvent("error", map[string]string{"message": "Not in a squad"})
		return
	}

	squad, ok := h.squads[squadID]
	if !ok {
		delete(h.playerSquad, c.player.ID)
		h.mu.Unlock()
		c.sendEvent("squad_left", nil)
		return
	}

	h.removePlayerFromSquadLocked(c.player.ID)
	h.mu.Unlock()

	c.sendEvent("squad_left", nil)

	h.mu.RLock()
	squad, stillExists := h.squads[squadID]
	h.mu.RUnlock()

	if stillExists {
		leaveMsg := ChatMessage{
			ID:         uuid.New().String(),
			SquadID:    squadID,
			SenderID:   "system",
			SenderName: "System",
			Content:    fmt.Sprintf("%s left the squad.", c.player.Username),
			Timestamp:  time.Now(),
			Type:       "leave",
		}
		h.broadcastToSquad(squadID, "player_left", map[string]interface{}{
			"playerId": c.player.ID,
			"username": c.player.Username,
			"squad":    squad,
			"message":  leaveMsg,
		}, "")
	}

	h.broadcastSquadList()
	log.Printf("squad: %s left squad %s", c.player.Username, squadID)
}

// handleToggleReady toggles a player's ready status
func (h *Hub) handleToggleReady(c *client, data json.RawMessage) {
	h.mu.Lock()
	squadID, ok := h.playerSquad[c.player.ID]
	if !ok {
		h.mu.Unlock()
		return
	}

	squad, ok := h.squads[squadID]
	if !ok {
		h.mu.Unlock()
		return
	}

	for _, p := range squad.Players {
		if p.ID == c.player.ID {
			p.IsReady = !p.IsReady
			c.player.IsReady = p.IsReady
			break
		}
	}
	h.mu.Unlock()

	h.broadcastToSquad(squadID, "ready_update", map[string]interface{}{
		"playerId": c.player.ID,
		"username": c.player.Username,
		"isReady":  c.player.IsReady,
		"squad":    squad,
	}, "")
}

// handleChatMessage processes and broadcasts chat messages
func (h *Hub) handleChatMessage(c *client, data json.RawMessage) {
	var req struct {
		Content string `json:"content"`
	}

	if err := json.Unmarshal(data, &req); err != nil {
		return
	}

	if req.Content == "" {
		return
	}

	h.mu.RLock()
	squadID, ok := h.playerSquad[c.player.ID]
	h.mu.RUnlock()

	if !ok {
		return
	}

	chatMsg := ChatMessage{
		ID:         uuid.New().String(),
		SquadID:    squadID,
		SenderID:   c.player.ID,
		SenderName: c.player.Username,
		Content:    req.Content,
		Timestamp:  time.Now(),
		Type:       "message",
	}

	h.broadcastToSquad(squadID, "chat_message", chatMsg, "")
}

// HandleSetRole handles a player setting their role in the squad
func (h *Hub) HandleSetRole(c *client, data json.RawMessage) {
	req := struct {
		SquadID string     `json:"squadId"`
		Role    PlayerRole `json:"role"`
	}{}
	if err := json.Unmarshal(data, &req); err != nil {
		return
	}

	h.mu.Lock()
	squad, ok := h.squads[req.SquadID]
	if !ok {
		h.mu.Unlock()
		return
	}

	if squad.Roles == nil {
		squad.Roles = make(map[string]PlayerRole)
	}
	squad.Roles[c.player.ID] = req.Role
	playerID := c.player.ID
	h.mu.Unlock()

	h.broadcastToSquad(req.SquadID, "role_updated", map[string]interface{}{
		"playerId": playerID,
		"role":     req.Role,
	}, playerID)
}

// HandleSetDropTarget handles a player marking a drop target
func (h *Hub) HandleSetDropTarget(c *client, data json.RawMessage) {
	req := struct {
		SquadID string `json:"squadId"`
		Item    string `json:"item"`
		Want    bool   `json:"want"`
	}{}
	if err := json.Unmarshal(data, &req); err != nil {
		return
	}

	h.mu.Lock()
	squad, ok := h.squads[req.SquadID]
	if !ok {
		h.mu.Unlock()
		return
	}

	if squad.DropTargets == nil {
		squad.DropTargets = make(map[string][]string)
	}

	if req.Want {
		// Add to drop targets
		found := false
		for _, id := range squad.DropTargets[req.Item] {
			if id == c.player.ID {
				found = true
				break
			}
		}
		if !found {
			squad.DropTargets[req.Item] = append(squad.DropTargets[req.Item], c.player.ID)
		}
	} else {
		// Remove from drop targets
		filtered := []string{}
		for _, id := range squad.DropTargets[req.Item] {
			if id != c.player.ID {
				filtered = append(filtered, id)
			}
		}
		squad.DropTargets[req.Item] = filtered
		if len(filtered) == 0 {
			delete(squad.DropTargets, req.Item)
		}
	}

	dropTargets := squad.DropTargets
	h.mu.Unlock()

	h.broadcastToSquad(req.SquadID, "drop_targets_updated", dropTargets, "")
}

// HandleStartSession handles starting a mission session
func (h *Hub) HandleStartSession(c *client, data json.RawMessage) {
	req := struct {
		SquadID string `json:"squadId"`
	}{}
	if err := json.Unmarshal(data, &req); err != nil {
		return
	}

	h.mu.Lock()
	squad, ok := h.squads[req.SquadID]
	if !ok {
		h.mu.Unlock()
		return
	}

	if squad.LeaderID != c.player.ID {
		h.mu.Unlock()
		return // Only leader can start session
	}

	squad.SessionStarted = true
	squad.SessionStartedAt = time.Now()
	squad.Status = SquadStatusInGame
	startedAt := squad.SessionStartedAt.Unix()
	h.mu.Unlock()

	h.broadcastToSquad(req.SquadID, "session_started", map[string]interface{}{
		"startedAt": startedAt,
	}, "")
}

// HandleEndSession handles ending a mission session
func (h *Hub) HandleEndSession(c *client, data json.RawMessage) {
	req := struct {
		SquadID  string `json:"squadId"`
		Success  bool   `json:"success"`
		Duration int    `json:"duration"` // minutes
	}{}
	if err := json.Unmarshal(data, &req); err != nil {
		return
	}

	h.mu.Lock()
	squad, ok := h.squads[req.SquadID]
	if !ok {
		h.mu.Unlock()
		return
	}

	if squad.LeaderID != c.player.ID {
		h.mu.Unlock()
		return
	}

	squad.SessionEnded = true
	squad.SessionEndedAt = time.Now()
	squad.SessionDuration = req.Duration
	squad.SessionSuccess = req.Success
	squad.Status = SquadStatusOpen
	endedAt := squad.SessionEndedAt.Unix()
	h.mu.Unlock()

	h.broadcastToSquad(req.SquadID, "session_ended", map[string]interface{}{
		"success":  req.Success,
		"duration": req.Duration,
		"endedAt":  endedAt,
	}, "")
}

// HandleSubmitReport records a post-mission report.
//
// DELIBERATE TRUST DECISION (abuse-resistant): a report NEVER changes
// anyone's trust score automatically. It is stored on the squad record and
// the reportee's Reports counter is incremented for moderator review, so a
// coordinated/retaliatory burst of reports cannot tank an innocent player's
// public badge. Trust only moves via completed missions (+0.5, clamped
// 0-100 in TrustScoreValue). Moderators act on Reports out of band.
func (h *Hub) HandleSubmitReport(c *client, data json.RawMessage) {
	req := struct {
		SquadID       string         `json:"squadId"`
		MissionTime   int            `json:"missionTime"`
		Success       bool           `json:"success"`
		DropsFound    []string       `json:"dropsFound"`
		PlayerRatings map[string]int `json:"playerRatings"`
		Notes         string         `json:"notes"`
	}{}
	if err := json.Unmarshal(data, &req); err != nil {
		return
	}

	h.mu.Lock()
	squad, ok := h.squads[req.SquadID]
	if !ok {
		h.mu.Unlock()
		return
	}

	report := &SessionReport{
		MissionTime:   req.MissionTime,
		Success:       req.Success,
		DropsFound:    req.DropsFound,
		PlayerRatings: req.PlayerRatings,
		Notes:         req.Notes,
		SubmittedAt:   time.Now(),
	}

	squad.SessionReport = report

	// Update player mission count — each completed squad mission is +0.5 trust.
	// Star ratings are kept as feedback but don't directly affect the score.
	// NOTE: low (1-star) ratings are treated as report signals for moderator
	// review only: counted on the player record, never applied to trust.
	for playerID, rating := range req.PlayerRatings {
		if cl, ok := h.clients[playerID]; ok {
			player := cl.player
			player.TotalMissions++
			player.LastActive = time.Now()
			if rating <= 1 {
				player.Reports++
			}
			player.TrustScore = player.TrustScoreValue()
		}
	}
	h.mu.Unlock()

	h.broadcastToSquad(req.SquadID, "report_submitted", report, "")
}

// HandleSetETA handles setting a player's ETA
func (h *Hub) HandleSetETA(c *client, data json.RawMessage) {
	req := struct {
		SquadID string `json:"squadId"`
		ETA     int    `json:"eta"` // minutes
	}{}
	if err := json.Unmarshal(data, &req); err != nil {
		return
	}

	h.mu.RLock()
	_, ok := h.squads[req.SquadID]
	h.mu.RUnlock()
	if !ok {
		return
	}

	h.broadcastToSquad(req.SquadID, "eta_updated", map[string]interface{}{
		"playerId":   c.player.ID,
		"playerName": c.player.Username,
		"eta":        req.ETA,
	}, "")
}

// HandleAddActivity handles adding an activity entry after a mission
func (h *Hub) HandleAddActivity(c *client, data json.RawMessage) {
	req := struct {
		SquadID    string   `json:"squadId"`
		SquadName  string   `json:"squadName"`
		Mission    string   `json:"mission"`
		Planet     string   `json:"planet"`
		Difficulty string   `json:"difficulty"`
		Success    bool     `json:"success"`
		PlayedWith []string `json:"playedWith"`
	}{}
	if err := json.Unmarshal(data, &req); err != nil {
		return
	}

	h.mu.Lock()
	entry := ActivityEntry{
		SquadID:    req.SquadID,
		SquadName:  req.SquadName,
		Mission:    req.Mission,
		Planet:     req.Planet,
		Difficulty: req.Difficulty,
		Success:    req.Success,
		PlayedWith: req.PlayedWith,
		PlayedAt:   time.Now(),
	}
	c.player.RecentActivity = append([]ActivityEntry{entry}, c.player.RecentActivity...)
	// Keep only last 20 activities
	if len(c.player.RecentActivity) > 20 {
		c.player.RecentActivity = c.player.RecentActivity[:20]
	}

	// Update total missions — each completed mission is +0.5 trust
	c.player.TotalMissions++
	c.player.LastActive = time.Now()

	// Recalculate trust score
	c.player.TrustScore = c.player.TrustScoreValue()

	// Broadcast to squad members who played together
	for _, playerID := range req.PlayedWith {
		if target, ok := h.clients[playerID]; ok {
			target.sendEvent("activity_added", map[string]interface{}{
				"playerId": c.player.ID,
				"activity": entry,
			})
		}
	}
	h.mu.Unlock()

	c.sendEvent("activity_added", map[string]interface{}{
		"playerId": c.player.ID,
		"activity": entry,
	})
}

// HandleVotePlayer handles a player voting/rating another player after a mission
func (h *Hub) HandleVotePlayer(c *client, data json.RawMessage) {
	req := struct {
		TargetID    string `json:"targetId"`
		Rating      int    `json:"rating"` // 1-5
		Comment     string `json:"comment"`
		MissionType string `json:"missionType"`
	}{}
	if err := json.Unmarshal(data, &req); err != nil {
		return
	}

	if req.Rating < 1 || req.Rating > 5 {
		return
	}

	h.mu.Lock()
	defer h.mu.Unlock()

	// Store in player's reputation (in production, this would go to a database)
	if target, ok := h.clients[req.TargetID]; ok {
		target.sendEvent("player_voted", map[string]interface{}{
			"voterId":     c.player.ID,
			"voterName":   c.player.Username,
			"rating":      req.Rating,
			"comment":     req.Comment,
			"missionType": req.MissionType,
		})
	}

	c.sendEvent("vote_recorded", map[string]interface{}{
		"targetId": req.TargetID,
		"rating":   req.Rating,
	})
}

// HandleGetPlayerStats handles getting a player's stats
func (h *Hub) HandleGetPlayerStats(c *client, data json.RawMessage) {
	req := struct {
		PlayerID string `json:"playerId"`
	}{}
	if err := json.Unmarshal(data, &req); err != nil {
		return
	}

	h.mu.RLock()
	defer h.mu.RUnlock()

	var target *client
	if req.PlayerID != "" {
		target = h.clients[req.PlayerID]
	} else {
		target = c
	}

	if target == nil {
		c.sendEvent("error", map[string]string{"message": "Player not found"})
		return
	}

	p := target.player
	publicStats := map[string]interface{}{
		"playerId":          p.ID,
		"username":          p.Username,
		"masteryRank":       p.MasteryRank,
		"legendaryRank":     p.LegendaryRank,
		"totalMissions":     p.TotalMissions,
		"reputation":        p.Reputation,
		"trustScore":        p.TrustScore,
		"verificationLevel": p.VerificationLevel,
		"recentActivity":    p.RecentActivity,
		"clanTag":           p.ClanTag,
		"platform":          p.Platform,
		"region":            p.Region,
	}

	c.sendEvent("player_stats", publicStats)
}

// HandleGetSquadHistory handles getting a squad's activity history
func (h *Hub) HandleGetSquadHistory(c *client, data json.RawMessage) {
	req := struct {
		SquadID string `json:"squadId"`
		Limit   int    `json:"limit"`
	}{}
	if err := json.Unmarshal(data, &req); err != nil {
		return
	}

	if req.Limit <= 0 {
		req.Limit = 10
	}

	h.mu.RLock()
	squad, ok := h.squads[req.SquadID]
	h.mu.RUnlock()

	if !ok {
		c.sendEvent("error", map[string]string{"message": "Squad not found"})
		return
	}

	// Build history from player activities
	var history []map[string]interface{}
	for _, player := range squad.Players {
		for _, activity := range player.RecentActivity {
			if activity.SquadID == req.SquadID {
				history = append(history, map[string]interface{}{
					"playerId":   player.ID,
					"playerName": player.Username,
					"activity":   activity,
				})
				if len(history) >= req.Limit {
					break
				}
			}
		}
		if len(history) >= req.Limit {
			break
		}
	}

	c.sendEvent("squad_history", map[string]interface{}{
		"squadId": req.SquadID,
		"history": history,
	})
}

// HandleSetActivity sets a player's activity status (online / in_game / away)
func (h *Hub) handleSetActivity(c *client, data json.RawMessage) {
	var req struct {
		Status string `json:"status"` // "online", "in_game", "away", "idle"
		Game   string `json:"game,omitempty"`
	}
	if err := json.Unmarshal(data, &req); err != nil {
		return
	}

	if req.Status == "in_game" {
		c.player.OnlineStatus = OnlineStatusInGame
	} else if req.Status == "away" || req.Status == "idle" {
		c.player.OnlineStatus = OnlineStatusAway
	} else {
		c.player.OnlineStatus = OnlineStatusOnline
	}
	c.player.LastActive = time.Now()

	h.broadcastEvent("player_activity_updated", map[string]interface{}{
		"playerId":       c.player.ID,
		"playerUsername": c.player.Username,
		"status":         c.player.OnlineStatus,
		"game":           req.Game,
		"timestamp":      time.Now().Unix(),
	})
}

// HandleRecentPlayed records a player's most recent mission into their activity feed
func (h *Hub) handleRecentPlayed(c *client, data json.RawMessage) {
	var req struct {
		MissionType string `json:"missionType"`
		Planet      string `json:"planet"`
		Difficulty  string `json:"difficulty"`
	}
	if err := json.Unmarshal(data, &req); err != nil {
		return
	}

	entry := ActivityEntry{
		SquadID:    "",
		SquadName:  "",
		Mission:    req.MissionType,
		Planet:     req.Planet,
		Difficulty: req.Difficulty,
		Success:    true,
		PlayedWith: []string{},
		PlayedAt:   time.Now(),
	}
	h.mu.Lock()
	c.player.RecentActivity = append(c.player.RecentActivity, entry)
	if len(c.player.RecentActivity) > 20 {
		c.player.RecentActivity = c.player.RecentActivity[:20]
	}
	c.player.LastActive = time.Now()
	h.mu.Unlock()

	h.broadcastEvent("player_recently_played", map[string]interface{}{
		"playerId":       c.player.ID,
		"playerUsername": c.player.Username,
		"missionType":    req.MissionType,
		"planet":         req.Planet,
		"difficulty":     req.Difficulty,
		"timestamp":      time.Now().Unix(),
	})
	log.Printf("squad: %s recently played: %s/%s", c.player.Username, req.MissionType, req.Planet)
}

// HandleWantedPost creates or updates a wanted post (player requesting role/item/help)
func (h *Hub) HandleWantedPost(c *client, data json.RawMessage) {
	var req struct {
		Type      string `json:"type"`      // "role", "item", "action", "help"
		Content   string `json:"content"`   // What they need
		Priority  string `json:"priority"`  // "urgent", "normal", "low"
		ExpiresIn int    `json:"expiresIn"` // minutes until expiry (0 = 30 min default)
	}
	if err := json.Unmarshal(data, &req); err != nil {
		c.sendEvent("error", map[string]string{"message": "Invalid wanted post"})
		return
	}

	if req.Type == "" || req.Content == "" {
		c.sendEvent("error", map[string]string{"message": "Type and content required"})
		return
	}

	expiry := 30 * time.Minute
	if req.ExpiresIn > 0 {
		expiry = time.Duration(req.ExpiresIn) * time.Minute
	}

	post := &WantedPost{
		ID:         uuid.New().String(),
		PlayerID:   c.player.ID,
		PlayerName: c.player.Username,
		Type:       req.Type,
		Content:    SanitizeString(req.Content),
		Priority:   req.Priority,
		ExpiresAt:  time.Now().Add(expiry),
		CreatedAt:  time.Now(),
	}

	h.wantedMu.Lock()
	h.wantedPosts[post.ID] = post
	h.wantedMu.Unlock()

	c.sendEvent("wanted_post_created", map[string]interface{}{
		"wantedPost":    post,
		"expiresAt":     post.ExpiresAt.Unix(),
		"timeRemaining": int(post.ExpiresAt.Sub(time.Now()).Minutes()),
	})

	h.broadcastEvent("wanted_post", map[string]interface{}{
		"wantedPost":    post,
		"timeRemaining": int(post.ExpiresAt.Sub(time.Now()).Minutes()),
		"totalPosts":    len(h.wantedPosts),
	})

	log.Printf("squad: wanted post created by %s: %s (%s)", c.player.Username, req.Content, req.Type)
}

// HandleQuickAction creates a quick action intent (one-click)
func (h *Hub) HandleQuickAction(c *client, data json.RawMessage) {
	var req struct {
		Action   string `json:"action"`  // "looking_for_squad", "offering_help", "wanted_role", "skip_mission"
		Message  string `json:"message"` // Custom message
		Mission  string `json:"mission,omitempty"`
		Planet   string `json:"planet,omitempty"`
		Duration int    `json:"duration,omitempty"` // minutes
	}
	if err := json.Unmarshal(data, &req); err != nil {
		c.sendEvent("error", map[string]string{"message": "Invalid quick action"})
		return
	}

	if req.Action == "" {
		c.sendEvent("error", map[string]string{"message": "Action required"})
		return
	}

	expiryMinutes := 15
	if req.Duration > 0 {
		expiryMinutes = req.Duration
	}

	action := &QuickAction{
		ID:         uuid.New().String(),
		PlayerID:   c.player.ID,
		PlayerName: c.player.Username,
		Action:     req.Action,
		Message:    SanitizeString(req.Message),
		Mission:    req.Mission,
		Planet:     req.Planet,
		Duration:   expiryMinutes,
		CreatedAt:  time.Now(),
		ExpiresAt:  time.Now().Add(time.Duration(expiryMinutes) * time.Minute),
	}

	h.quickMu.Lock()
	for id, old := range h.quickActions {
		if old.PlayerID == c.player.ID {
			delete(h.quickActions, id)
		}
	}
	h.quickActions[action.ID] = action
	h.quickMu.Unlock()

	c.sendEvent("quick_action_created", map[string]interface{}{
		"quickAction":   action,
		"expiresAt":     action.ExpiresAt.Unix(),
		"timeRemaining": expiryMinutes,
	})

	h.broadcastEvent("quick_action", map[string]interface{}{
		"quickAction":   action,
		"timeRemaining": expiryMinutes,
		"totalActions":  len(h.quickActions),
	})

	log.Printf("squad: quick action by %s: %s (%s)", c.player.Username, req.Action, req.Message)
}

// HandlePlayingNow sets what a player is currently doing
func (h *Hub) HandlePlayingNow(c *client, data json.RawMessage) {
	var req struct {
		Mission   string `json:"mission,omitempty"`
		Planet    string `json:"planet,omitempty"`
		Node      string `json:"node,omitempty"`
		Activity  string `json:"activity,omitempty"` // "playing", "in_lobby", "afk"
		WithSquad bool   `json:"withSquad,omitempty"`
	}
	if err := json.Unmarshal(data, &req); err != nil {
		c.sendEvent("error", map[string]string{"message": "Invalid playing now data"})
		return
	}

	h.playingMu.Lock()
	for id, old := range h.playingNow {
		if old.PlayerID == c.player.ID {
			delete(h.playingNow, id)
		}
	}

	pn := &PlayingNow{
		PlayerID:   c.player.ID,
		PlayerName: c.player.Username,
		Mission:    req.Mission,
		Planet:     req.Planet,
		Node:       req.Node,
		Activity:   req.Activity,
		Since:      time.Now(),
		WithSquad:  req.WithSquad,
	}
	h.playingNow[c.player.ID] = pn
	h.playingMu.Unlock()

	c.sendEvent("playing_now_updated", map[string]interface{}{
		"playingNow": pn,
	})

	h.broadcastEvent("player_playing_now", map[string]interface{}{
		"playerId":     c.player.ID,
		"playerName":   c.player.Username,
		"playingNow":   pn,
		"totalPlaying": len(h.playingNow),
	})

	log.Printf("squad: %s playing now: %s %s %s", c.player.Username, req.Activity, req.Mission, req.Planet)
}

// HandleMissionPlan creates or shares a mission plan
func (h *Hub) HandleMissionPlan(c *client, data json.RawMessage) {
	var req struct {
		Title         string     `json:"title"`
		Description   string     `json:"description"`
		Steps         []PlanStep `json:"steps"`
		EstimatedTime int        `json:"estimatedTime"`
		Difficulty    string     `json:"difficulty"` // "easy", "medium", "hard"
		ShareToSquad  bool       `json:"shareToSquad,omitempty"`
	}
	if err := json.Unmarshal(data, &req); err != nil {
		c.sendEvent("error", map[string]string{"message": "Invalid mission plan"})
		return
	}

	if req.Title == "" || len(req.Steps) == 0 {
		c.sendEvent("error", map[string]string{"message": "Title and steps required"})
		return
	}

	plan := &MissionPlan{
		ID:            uuid.New().String(),
		Title:         SanitizeString(req.Title),
		Description:   SanitizeString(req.Description),
		Steps:         req.Steps,
		EstimatedTime: req.EstimatedTime,
		Difficulty:    req.Difficulty,
		IsShared:      req.ShareToSquad,
		CreatedBy:     c.player.ID,
		CreatedByName: c.player.Username,
		CreatedAt:     time.Now(),
	}

	for i := range plan.Steps {
		if plan.Steps[i].Order == 0 {
			plan.Steps[i].Order = i + 1
		}
	}

	h.planMu.Lock()
	h.missionPlans[plan.ID] = plan
	h.planMu.Unlock()

	c.sendEvent("mission_plan_created", map[string]interface{}{
		"missionPlan":  plan,
		"shareToSquad": plan.IsShared,
	})

	h.broadcastEvent("mission_plan", map[string]interface{}{
		"missionPlan": plan,
		"totalPlans":  len(h.missionPlans),
		"byPlayer":    c.player.Username,
	})

	log.Printf("squad: mission plan created by %s: %s", c.player.Username, req.Title)
}

// HandleGetWantedPosts returns all active wanted posts
func (h *Hub) HandleGetWantedPosts(c *client, data json.RawMessage) {
	h.wantedMu.RLock()
	defer h.wantedMu.RUnlock()

	var posts []*WantedPost
	for _, post := range h.wantedPosts {
		if time.Now().Before(post.ExpiresAt) {
			posts = append(posts, post)
		}
	}

	c.sendEvent("wanted_posts", map[string]interface{}{
		"wantedPosts": posts,
		"total":       len(posts),
	})
}

// HandleGetQuickActions returns all active quick actions
func (h *Hub) HandleGetQuickActions(c *client, data json.RawMessage) {
	h.quickMu.RLock()
	defer h.quickMu.RUnlock()

	var actions []*QuickAction
	for _, action := range h.quickActions {
		if time.Now().Before(action.ExpiresAt) {
			actions = append(actions, action)
		}
	}

	c.sendEvent("quick_actions", map[string]interface{}{
		"quickActions": actions,
		"total":        len(actions),
	})
}

// HandleGetPlayingNow returns all players currently playing
func (h *Hub) HandleGetPlayingNow(c *client, data json.RawMessage) {
	h.playingMu.RLock()
	defer h.playingMu.RUnlock()

	var playing []*PlayingNow
	for _, pn := range h.playingNow {
		if time.Since(pn.Since) < 5*time.Minute {
			playing = append(playing, pn)
		}
	}

	c.sendEvent("playing_now", map[string]interface{}{
		"playingNow": playing,
		"total":      len(playing),
	})
}

// HandleGetMissionPlans returns all mission plans
func (h *Hub) HandleGetMissionPlans(c *client, data json.RawMessage) {
	h.planMu.RLock()
	defer h.planMu.RUnlock()

	var plans []*MissionPlan
	for _, plan := range h.missionPlans {
		plans = append(plans, plan)
	}

	c.sendEvent("mission_plans", map[string]interface{}{
		"missionPlans": plans,
		"total":        len(plans),
	})
}

// HandleFindMatch pairs the player with a random open squad matching their
// preferences, or creates a new auto-named squad when nothing matches.
func (h *Hub) HandleFindMatch(c *client, data json.RawMessage) {
	var req struct {
		Mode        string `json:"mode"`      // "casual" or "serious" ("" = any)
		SquadSize   int    `json:"squadSize"` // 4 or 6 (0 = any)
		Mission     string `json:"mission"`   // "" or "Any" = any
		MissionType string `json:"missionType"`
		Planet      string `json:"planet"`     // "" or "Any" = any
		Difficulty  string `json:"difficulty"` // "" or "Any" = any
		Region      string `json:"region"`     // "" or "Any" = any
		Language    string `json:"language"`   // "" or "Any" = any
	}
	if err := json.Unmarshal(data, &req); err != nil {
		c.sendEvent("error", map[string]string{"message": "Invalid matchmaking request"})
		return
	}

	if req.SquadSize != 0 && req.SquadSize != 4 && req.SquadSize != MaxSquadSize {
		req.SquadSize = 0
	}
	if req.Mode != "" && req.Mode != string(SquadModeCasual) && req.Mode != string(SquadModeSerious) {
		req.Mode = ""
	}
	mission := req.Mission
	if mission == "" {
		mission = req.MissionType
	}

	matches := func(s *Squad) bool {
		if s.Status != SquadStatusOpen {
			return false
		}
		if len(s.Players) >= s.MaxPlayers {
			return false
		}
		if req.Mode != "" && string(s.Mode) != "" && string(s.Mode) != req.Mode {
			return false
		}
		if req.SquadSize != 0 && s.MaxPlayers != req.SquadSize {
			return false
		}
		if mission != "" && mission != "Any" && s.Mission != "" && s.Mission != "Any" && s.Mission != mission {
			return false
		}
		if req.Planet != "" && req.Planet != "Any" && s.Planet != "" && s.Planet != "Any" && s.Planet != req.Planet {
			return false
		}
		if req.Difficulty != "" && req.Difficulty != "Any" && s.Difficulty != "" && s.Difficulty != "Any" && s.Difficulty != req.Difficulty {
			return false
		}
		if req.Region != "" && req.Region != "Any" && s.Region != "" && s.Region != "Any" && s.Region != req.Region {
			return false
		}
		if req.Language != "" && req.Language != "Any" && s.Language != "" && s.Language != "Any" && s.Language != req.Language {
			return false
		}
		return true
	}

	// Already in a squad? Just tell the client where they are.
	h.mu.RLock()
	if squadID, ok := h.playerSquad[c.player.ID]; ok {
		if squad, ok := h.squads[squadID]; ok {
			h.mu.RUnlock()
			c.sendEvent("match_found", map[string]interface{}{"squad": squad, "created": false})
			return
		}
	}
	candidates := make([]*Squad, 0)
	for _, squad := range h.squads {
		if matches(squad) {
			candidates = append(candidates, squad)
		}
	}
	h.mu.RUnlock()

	if len(candidates) > 0 {
		target := candidates[time.Now().UnixNano()%int64(len(candidates))]
		h.mu.Lock()
		squad, ok := h.squads[target.ID]
		if !ok || squad.Status != SquadStatusOpen || len(squad.Players) >= squad.MaxPlayers {
			h.mu.Unlock()
			c.sendEvent("error", map[string]string{"message": "No matching squad available, try again"})
			return
		}
		if existingID, ok := h.playerSquad[c.player.ID]; ok {
			h.mu.Unlock()
			c.sendEvent("error", map[string]string{"message": "Already in a squad", "squadId": existingID})
			return
		}
		squad.Players = append(squad.Players, c.player)
		h.playerSquad[c.player.ID] = squad.ID
		if len(squad.Players) >= squad.MaxPlayers {
			squad.Status = SquadStatusFull
		}
		h.mu.Unlock()

		c.sendEvent("match_found", map[string]interface{}{"squad": squad, "created": false})

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
		log.Printf("squad: matchmaking paired %s with squad %s (%s)", c.player.Username, squad.Name, squad.ID)
		return
	}

	// No open squad matched: auto-create one from the requested settings.
	size := req.SquadSize
	if size == 0 {
		size = MaxSquadSize
	}
	maxPlayers := MaxSquadSize
	if size == 4 {
		maxPlayers = 4
	}
	mode := SquadMode(req.Mode)
	if mode == "" {
		mode = SquadModeCasual
	}
	squadMission := mission
	if squadMission == "" {
		squadMission = "Any"
	}
	squadPlanet := req.Planet
	if squadPlanet == "" {
		squadPlanet = "Any"
	}
	squadDifficulty := req.Difficulty
	if squadDifficulty == "" {
		squadDifficulty = "Any"
	}
	squadRegion := req.Region
	if squadRegion == "" || squadRegion == "Any" {
		squadRegion = c.player.Region
	}
	squadLanguage := req.Language
	if squadLanguage == "" {
		squadLanguage = "Any"
	}

	h.mu.Lock()
	if existingID, ok := h.playerSquad[c.player.ID]; ok {
		h.mu.Unlock()
		c.sendEvent("error", map[string]string{"message": "Already in a squad", "squadId": existingID})
		return
	}
	squad := &Squad{
		ID:         uuid.New().String(),
		Name:       fmt.Sprintf("%s's %s Squad", c.player.Username, squadMission),
		Mission:    squadMission,
		Planet:     squadPlanet,
		Difficulty: squadDifficulty,
		Region:     squadRegion,
		Language:   squadLanguage,
		Status:     SquadStatusOpen,
		LeaderID:   c.player.ID,
		LeaderName: c.player.Username,
		Mode:       mode,
		Players:    []*Player{c.player},
		SquadSize:  size,
		MaxPlayers: maxPlayers,
		CreatedAt:  time.Now(),
		Tags:       []string{"quick-match"},
	}
	h.squads[squad.ID] = squad
	h.playerSquad[c.player.ID] = squad.ID
	h.mu.Unlock()

	c.sendEvent("match_found", map[string]interface{}{"squad": squad, "created": true})
	h.broadcastSquadList()
	log.Printf("squad: matchmaking created squad %s (%s) for %s", squad.Name, squad.ID, c.player.Username)
}

// HandleSetMatchPref sets a player's match preferences
func (h *Hub) HandleSetMatchPref(c *client, data json.RawMessage) {
	var req struct {
		Playstyle string `json:"playstyle"` // "casual", "serious", "learning", "any"
		SquadSize int    `json:"squadSize"` // 4 or 6 (0 = any)
		MinMR     int    `json:"minMR"`
	}
	if err := json.Unmarshal(data, &req); err != nil {
		c.sendEvent("error", map[string]string{"message": "Invalid match preference"})
		return
	}

	c.player.MatchPref = MatchPreference{
		Playstyle: req.Playstyle,
		SquadSize: req.SquadSize,
		MinMR:     req.MinMR,
	}

	c.sendEvent("match_pref_set", map[string]interface{}{
		"matchPref": c.player.MatchPref,
	})

	h.broadcastEvent("player_match_pref", map[string]interface{}{
		"playerId":   c.player.ID,
		"playerName": c.player.Username,
		"matchPref":  c.player.MatchPref,
	})

	log.Printf("squad: %s match pref: %+v", c.player.Username, c.player.MatchPref)
}
