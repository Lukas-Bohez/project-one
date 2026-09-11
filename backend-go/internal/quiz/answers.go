package quiz

import (
	"encoding/json"
	"log"
	"strconv"
	"time"

	"github.com/Lukas-Bohez/project-one/backend-go/internal/repository"
)

// AnswerResult is sent back to a player after submitting an answer.
type AnswerResult struct {
	Success            bool   `json:"success"`
	IsCorrect          bool   `json:"is_correct,omitempty"`
	PointsEarned       int    `json:"points_earned,omitempty"`
	MaxPoints          int    `json:"max_points,omitempty"`
	CorrectAnswerIndex int    `json:"correct_answer_index,omitempty"`
	CorrectAnswerText  string `json:"correct_answer_text,omitempty"`
	Explanation        string `json:"explanation,omitempty"`
	Error              string `json:"error,omitempty"`
}

// handleSubmitAnswer processes an answer submission.
// Only accepts answers during the "quiz" phase (not during explanation).
func (h *Hub) handleSubmitAnswer(c *client, data json.RawMessage) {
	var req struct {
		UserID     int64 `json:"userId"`
		QuestionID int64 `json:"questionId"`
		AnswerIdx  int   `json:"answerIndex"`
	}
	if err := json.Unmarshal(data, &req); err != nil {
		c.sendEvent("answer_response", AnswerResult{Success: false, Error: "invalid data"})
		return
	}

	ss := h.getSessionState(c.sessionID)
	phase := ss.GetPhase()

	// Only accept answers during quiz phase
	if phase != PhaseQuiz {
		c.sendEvent("answer_response", AnswerResult{
			Success: false,
			Error:   "Not accepting answers at this time",
		})
		return
	}

	// Check for duplicate answer
	existing, _ := h.repo.GetPlayerAnswer(c.sessionID, req.UserID, req.QuestionID)
	if existing != nil {
		c.sendEvent("answer_response", AnswerResult{
			Success: false,
			Error:   "Answer already submitted before",
		})
		return
	}

	question, err := h.repo.GetQuestionByID(req.QuestionID)
	if err != nil || question == nil {
		c.sendEvent("answer_response", AnswerResult{
			Success: false,
			Error:   "question not found",
		})
		return
	}

	answers, err := h.repo.GetAnswersForQuestion(req.QuestionID)
	if err != nil || len(answers) == 0 {
		c.sendEvent("answer_response", AnswerResult{
			Success: false,
			Error:   "no answers found for question",
		})
		return
	}

	// Map answer index to answer ID for storage
	answerID := int64(-1)
	if req.AnswerIdx >= 0 && req.AnswerIdx < len(answers) {
		answerID = answers[req.AnswerIdx].ID
	}

	isCorrect := false
	correctIndex := -1
	correctText := ""
	for i, a := range answers {
		if a.IsCorrect {
			correctIndex = i
			correctText = a.AnswerText
		}
		if i == req.AnswerIdx && a.IsCorrect {
			isCorrect = true
		}
	}

	pointsEarned := 0
	if isCorrect {
		pointsEarned = question.Points
	}

	now := time.Now()
	_, err = h.repo.CreatePlayerAnswer(repository.PlayerAnswer{
		SessionID:   c.sessionID,
		UserID:      req.UserID,
		QuestionID:  req.QuestionID,
		AnswerID:    answerID,
		IsCorrect:   isCorrect,
		PointsEarned: pointsEarned,
		TimeTaken:   15,
		CreatedAt:   now,
	})
	if err != nil {
		log.Printf("failed to save answer: %v", err)
		c.sendEvent("answer_response", AnswerResult{
			Success: false,
			Error:   "failed to save answer",
		})
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

// handleThemeSelected processes a theme vote during the voting phase.
func (h *Hub) handleThemeSelected(c *client, data json.RawMessage) {
	var req struct {
		ThemeID int64 `json:"themeId"`
	}
	if err := json.Unmarshal(data, &req); err != nil {
		return
	}
	if req.ThemeID <= 0 {
		return
	}

	ss := h.getSessionState(c.sessionID)
	phase := ss.GetPhase()
	if phase != PhaseVoting {
		return
	}

	h.repo.VoteForTheme(c.sessionID, req.ThemeID)
	votes := ss.RecordVote(c.userID, req.ThemeID)

	// Build votes map for JSON (theme ID as string key)
	votesMap := make(map[string]interface{})
	for k, v := range votes {
		votesMap[strconv.FormatInt(k, 10)] = v
	}

	h.broadcastToSession(c.sessionID, "theme_votes_update", map[string]interface{}{
		"session_id": c.sessionID,
		"votes":      votesMap,
		"timestamp":  time.Now().Unix(),
	})
}

