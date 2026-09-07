package quiz

import (
	"encoding/json"
	"log"

	"github.com/Lukas-Bohez/project-one/backend-go/internal/repository"
)

// handleSubmitAnswer processes an answer submission.
func (h *Hub) handleSubmitAnswer(c *client, data json.RawMessage) {
	var req struct {
		UserID      int64 `json:"userId"`
		QuestionID  int64 `json:"questionId"`
		AnswerIndex int   `json:"answerIndex"`
	}
	if err := json.Unmarshal(data, &req); err != nil {
		c.sendEvent("answer_response", AnswerResult{Success: false, Error: "invalid data"})
		return
	}

	question, err := h.repo.GetQuestionByID(req.QuestionID)
	if err != nil || question == nil {
		c.sendEvent("answer_response", AnswerResult{Success: false, Error: "question not found"})
		return
	}

	// Check for duplicate
	existing, _ := h.repo.GetPlayerAnswer(c.sessionID, req.UserID, req.QuestionID)
	if existing != nil {
		c.sendEvent("answer_response", AnswerResult{Success: false, Error: "answer already submitted"})
		return
	}

	// Check correctness
	answers, err := h.repo.GetAnswersForQuestion(req.QuestionID)
	if err != nil {
		c.sendEvent("answer_response", AnswerResult{Success: false, Error: "could not load answers"})
		return
	}

	isCorrect := false
	correctIndex := -1
	correctText := ""
	for i, a := range answers {
		if a.IsCorrect {
			correctIndex = i
			correctText = a.AnswerText
		}
		if i == req.AnswerIndex && a.IsCorrect {
			isCorrect = true
		}
	}

	pointsEarned := 0
	if isCorrect {
		pointsEarned = question.Points
	}

	// Save
	_, err = h.repo.CreatePlayerAnswer(repository.PlayerAnswer{
		SessionID:    c.sessionID,
		UserID:       req.UserID,
		QuestionID:   req.QuestionID,
		AnswerIndex:  req.AnswerIndex,
		IsCorrect:    isCorrect,
		PointsEarned: pointsEarned,
		TimeTaken:    15,
	})
	if err != nil {
		log.Printf("failed to save answer: %v", err)
		c.sendEvent("answer_response", AnswerResult{Success: false, Error: "failed to save answer"})
		return
	}

	c.sendEvent("answer_response", AnswerResult{
		Success:            true,
		IsCorrect:          isCorrect,
		PointsEarned:       pointsEarned,
		MaxPoints:          question.Points,
		CorrectAnswerIndex: correctIndex,
		CorrectAnswerText:  correctText,
		Explanation:        safeString(question.Explanation),
	})

	h.broadcastLeaderboard(c.sessionID)
}

func (h *Hub) handleThemeSelected(c *client, data json.RawMessage) {
	var req struct {
		ThemeID int64 `json:"themeId"`
	}
	if err := json.Unmarshal(data, &req); err != nil {
		return
	}
	h.repo.VoteForTheme(c.sessionID, req.ThemeID)
	h.broadcastToSession(c.sessionID, "theme_selected", map[string]interface{}{
		"session_id": c.sessionID,
		"theme_id":   req.ThemeID,
	})
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
