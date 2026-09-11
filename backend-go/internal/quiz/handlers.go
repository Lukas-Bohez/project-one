package quiz

import (
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/Lukas-Bohez/project-one/backend-go/internal/models"
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
	case "leave":
		h.handleLeaveRoom(c, msg.Data)
	case "request_leaderboard":
		h.handleLeaderboardRequest(c, msg.Data)
	case "leave_quiz_session":
		h.handleLeaveSession(c, msg.Data)
	default:
		log.Printf("unknown event: %s", msg.Event)
	}
}

// handleJoinSession joins a client to a quiz session and syncs their state.
func (h *Hub) handleJoinSession(c *client, data json.RawMessage) {
	var req struct {
		SessionID int64  `json:"session_id"`
		UserID    int64  `json:"userId"`
		Username  string `json:"username"`
	}
	if err := json.Unmarshal(data, &req); err != nil {
		c.sendEvent("join_session_error", map[string]string{"error": "invalid data"})
		return
	}

	var sessionID int64 = req.SessionID
	if sessionID == 0 {
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
		"room":       fmt.Sprintf("quiz_session_%d", sessionID),
		"timestamp":  time.Now().UTC().Format(time.RFC3339),
	})

	ss := h.getSessionState(sessionID)
	h.syncClientPhase(c, session, ss)

	if !ss.IsLoopRunning() {
		ss.StartLoop()
	}
}

// syncClientPhase sends the appropriate state to a newly-joined client.
func (h *Hub) syncClientPhase(c *client, session *repository.QuizSession, ss *SessionState) {
	phase := ss.GetPhase()

	switch phase {
	case PhaseVoting:
		h.sendThemeSelection(c, c.sessionID, ss)
		break
	case PhaseThemeDisplay:
		if session.ThemeID != nil {
			theme, err := h.repo.GetThemeByID(*session.ThemeID)
			if err == nil && theme != nil {
				c.sendEvent("theme_display", map[string]interface{}{
					"session_id": c.sessionID,
					"theme_data": theme,
					"timestamp":  time.Now().UTC().Format(time.RFC3339),
				})
			}
		}
	case PhaseQuiz, PhaseExplanation:
		if ss.QuizState.CurrentQuestion != nil {
			h.sendQuestionData(c, c.sessionID, ss.QuizState.CurrentQuestion)
		}
	}
}

// sendThemeSelection emits theme_selection and phase_started to a client.
func (h *Hub) sendThemeSelection(c *client, sessionID int64, ss *SessionState) {
	themes, err := h.repo.GetActiveThemes()
	if err != nil || len(themes) == 0 {
		c.sendEvent("theme_selection_error", map[string]string{"error": "No themes available"})
		return
	}

	var validThemes []map[string]interface{}
	themeIDs := make([]int64, len(themes))
	for i, t := range themes {
		themeIDs[i] = t.ID
	}
	counts, _ := h.repo.GetThemeQuestionCounts(themeIDs)

	for _, t := range themes {
		validThemes = append(validThemes, map[string]interface{}{
			"id":              t.ID,
			"name":            t.Name,
			"description":     safeString(t.Description),
			"logoUrl":         t.LogoURL,
			"is_active":       t.IsActive,
			"question_count":  counts[t.ID],
		})
	}

	if len(validThemes) == 0 {
		c.sendEvent("theme_selection_error", map[string]string{"error": "No themes with questions available"})
		return
	}

	c.sendEvent("theme_selection", map[string]interface{}{
		"id":          "theme_selection",
		"question":    "Choose a theme?",
		"type":        "theme_selection",
		"themes":      validThemes,
		"count":       len(validThemes),
		"active_only": true,
		"timestamp":   time.Now().Unix(),
	})

	c.sendEvent("phase_started", map[string]interface{}{
		"session_id": sessionID,
		"phase":      "voting",
		"duration":   VotingTime,
		"timestamp":  time.Now().UTC().Format(time.RFC3339),
	})
}

// sendQuestionData emits questionData + question_started to a client and the session.
func (h *Hub) sendQuestionData(target *client, sessionID int64, question *models.Question) {
	answers, err := h.repo.GetAnswersForQuestion(question.ID)
	if err != nil {
		return
	}

	answerList := make([]map[string]interface{}, len(answers))
	for i, a := range answers {
		answerList[i] = map[string]interface{}{
			"id":            a.ID,
			"questionId":    a.QuestionID,
			"answer_text":   a.AnswerText,
			"is_correct":    a.IsCorrect,
			"created_at":    a.CreatedAt,
			"updated_at":    a.UpdatedAt,
		}
	}

	questionMap := map[string]interface{}{
		"id":                question.ID,
		"question_text":     question.QuestionText,
		"themeId":           question.ThemeID,
		"difficultyLevelId": question.DifficultyLevelID,
		"explanation":       safeString(question.Explanation),
		"Url":               question.URL,
		"time_limit":        question.TimeLimit,
		"think_time":        question.ThinkTime,
		"points":            question.Points,
	}

	questionTime := question.TimeLimit
	if questionTime < 9 {
		questionTime = 9
	}

	payload := map[string]interface{}{
		"session_id": sessionID,
		"question":   questionMap,
		"answers":    answerList,
		"duration":   questionTime,
	}

	target.sendEvent("questionData", payload)
	h.broadcastToSession(sessionID, "questionData", payload)
	h.broadcastToSession(sessionID, "question_started", map[string]interface{}{
		"session_id":    sessionID,
		"question_id":   question.ID,
		"question_text": question.QuestionText,
		"answers":       answerList,
		"duration":      questionTime,
	})
}

func (h *Hub) handleJoinRoom(c *client, data json.RawMessage) {
	var req struct {
		Room string `json:"room"`
	}
	if err := json.Unmarshal(data, &req); err != nil {
		return
	}
	c.room = req.Room
	c.sendEvent("room_joined", map[string]interface{}{
		"room":   req.Room,
		"status": "success",
	})
}

func (h *Hub) handleLeaveRoom(c *client, data json.RawMessage) {
	var req struct {
		Room string `json:"room"`
	}
	if err := json.Unmarshal(data, &req); err != nil {
		return
	}
	c.room = ""
}

func (h *Hub) handleLeaveSession(c *client, data json.RawMessage) {
	h.unregister <- c
}

func (h *Hub) handleLeaderboardRequest(c *client, data json.RawMessage) {
	h.sendLeaderboard(c, c.sessionID)
}

func (h *Hub) broadcastLeaderboard(sessionID int64) {
	scores, err := h.repo.GetSessionScores(sessionID)
	if err != nil {
		return
	}
	h.broadcastToSession(sessionID, "leaderboard", map[string]interface{}{
		"session_id":  sessionID,
		"leaderboard": scores,
	})
}

func (h *Hub) sendLeaderboard(c *client, sessionID int64) {
	scores, err := h.repo.GetSessionScores(sessionID)
	if err != nil {
		return
	}
	c.sendEvent("leaderboard", map[string]interface{}{
		"session_id":  sessionID,
		"leaderboard": scores,
	})
}
