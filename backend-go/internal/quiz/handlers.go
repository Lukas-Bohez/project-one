package quiz

import (
	"encoding/json"
	"log"
	"time"

	"github.com/Lukas-Bohez/project-one/backend-go/internal/repository"
)

// handleEvent routes an incoming message to the right handler.
func (h *Hub) handleEvent(c *client, msg *message) {
	switch msg.Event {
	case "join_quiz_session":
		h.handleJoinSession(c, msg.Data)
	case "submit_answer":
		h.handleSubmitAnswer(c, msg.Data)
	case "theme_selected":
		h.handleThemeSelected(c, msg.Data)
	case "join":
		h.handleJoinRoom(c, msg.Data)
	case "leave_quiz_session":
		h.handleLeaveSession(c, msg.Data)
	case "request_leaderboard":
		h.handleLeaderboardRequest(c, msg.Data)
	default:
		log.Printf("unknown event: %s", msg.Event)
	}
}

// handleJoinSession joins a client to a quiz session and syncs their state.
func (h *Hub) handleJoinSession(c *client, data json.RawMessage) {
	var req struct {
		SessionID *int64 `json:"session_id"`
		UserID    int64  `json:"userId"`
		Username  string `json:"username"`
	}
	if err := json.Unmarshal(data, &req); err != nil {
		c.sendEvent("join_session_error", map[string]string{"error": "invalid data"})
		return
	}

	var sessionID int64
	if req.SessionID != nil {
		sessionID = *req.SessionID
	} else {
		sessions, err := h.repo.GetActiveSessions()
		if err != nil || len(sessions) == 0 {
			c.sendEvent("join_session_error", map[string]string{"error": "no active sessions"})
			return
		}
		sessionID = sessions[0].ID
	}

	session, err := h.repo.GetSessionByID(sessionID)
	if err != nil || session == nil {
		c.sendEvent("join_session_error", map[string]string{"error": "session not found"})
		return
	}

	c.sessionID = sessionID
	c.userID = req.UserID
	c.username = req.Username
	h.register <- c

	c.sendEvent("join_session_success", map[string]interface{}{
		"session_id": sessionID,
		"timestamp":  time.Now().UTC().Format(time.RFC3339),
	})

	h.syncClientPhase(c, session)
}

func (h *Hub) syncClientPhase(c *client, session *repository.QuizSession) {
	switch session.Phase {
	case string(PhaseVoting):
		h.broadcastToSession(c.sessionID, "voting_started", map[string]interface{}{
			"session_id": c.sessionID,
			"timestamp":  time.Now().UTC().Format(time.RFC3339),
		})
	case string(PhaseThemeDisplay):
		if session.ThemeID != nil {
			theme, _ := h.repo.GetThemeByID(*session.ThemeID)
			if theme != nil {
				c.sendEvent("theme_selected", map[string]interface{}{
					"session_id": c.sessionID,
					"theme_data": theme,
					"timestamp":  time.Now().UTC().Format(time.RFC3339),
				})
			}
		}
	case string(PhaseQuiz):
		question, _ := h.repo.GetCurrentQuestion(c.sessionID)
		if question != nil {
			answers, _ := h.repo.GetAnswersForQuestion(question.ID)
			c.sendEvent("question", map[string]interface{}{
				"session_id": c.sessionID,
				"question":   question,
				"answers":    answers,
			})
		}
	}
}

func (h *Hub) handleJoinRoom(c *client, data json.RawMessage) {
	var req struct {
		Room string `json:"room"`
	}
	if err := json.Unmarshal(data, &req); err != nil {
		return
	}
	c.room = req.Room
	c.sendEvent("room_joined", map[string]string{"room": req.Room})
}

func (h *Hub) handleLeaveSession(c *client, data json.RawMessage) {
	h.unregister <- c
}
