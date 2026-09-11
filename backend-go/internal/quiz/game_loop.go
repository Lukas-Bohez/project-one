package quiz

import (
	"log"
	"time"

	"github.com/Lukas-Bohez/project-one/backend-go/internal/models"
)

// runLoop is the per-session game loop goroutine.
func (s *SessionState) runLoop() {
	log.Printf("[loop] session %d: starting game loop (phase=%s)", s.SessionID, s.Phase)

	if !s.runVotingPhase() {
		return
	}
	if !s.runThemeDisplayPhase() {
		return
	}

	questionNum := 0
	for {
		questionNum++
		if !s.runQuestionPhase(questionNum) {
			break
		}
		if !s.runExplanationPhase(questionNum) {
			break
		}
	}

	log.Printf("[loop] session %d: quiz loop ended after %d questions", s.SessionID, questionNum)
	s.cleanup()
}

// runVotingPhase counts down the voting timer.
func (s *SessionState) runVotingPhase() bool {
	s.SetPhase(PhaseVoting)
	s.hub.broadcastToSession(s.SessionID, "phase_started", map[string]interface{}{
		"session_id": s.SessionID,
		"phase":      "voting",
		"duration":   VotingTime,
		"timestamp":  time.Now().Unix(),
	})

	deadline := time.Now().Add(time.Duration(VotingTime) * time.Second)
	ticker := time.NewTicker(TickInterval)
	defer ticker.Stop()

	expired := false
	for !expired {
		select {
		case <-s.LoopStopChan:
			return false
		case <-ticker.C:
			remaining := time.Until(deadline).Seconds()
			if remaining <= 0 {
				expired = true
				break
			}
			s.hub.broadcastToSession(s.SessionID, "quiz_timer", map[string]interface{}{
				"session_id":    s.SessionID,
				"phase":         "voting",
				"duration":      VotingTime,
				"timeRemaining": int(remaining),
				"timestamp":     time.Now().Unix(),
			})
		}
	}

	s.hub.broadcastToSession(s.SessionID, "quiz_timer_finished", map[string]interface{}{
		"session_id": s.SessionID,
		"phase":      "voting",
		"timestamp":  time.Now().Unix(),
	})

	winningThemeID := s.WinningTheme()
	if winningThemeID == nil {
		themes, err := s.hub.repo.GetActiveThemes()
		if err != nil || len(themes) == 0 {
			s.hub.broadcastToSession(s.SessionID, "quiz_error", map[string]interface{}{
				"session_id": s.SessionID,
				"error":      "No themes available",
			})
			return false
		}
		winningThemeID = &themes[0].ID
	}

	if err := s.hub.repo.SetSessionTheme(s.SessionID, *winningThemeID); err != nil {
		log.Printf("[loop] session %d: failed to set session theme: %v", s.SessionID, err)
	}

	s.hub.broadcastToSession(s.SessionID, "theme_votes_update", map[string]interface{}{
		"session_id": s.SessionID,
		"votes":      map[string]interface{}{},
		"timestamp":  time.Now().Unix(),
	})

	return true
}

// runThemeDisplayPhase shows the winning theme.
func (s *SessionState) runThemeDisplayPhase() bool {
	s.SetPhase(PhaseThemeDisplay)

	session, err := s.hub.repo.GetSessionByID(s.SessionID)
	if err != nil || session == nil || session.ThemeID == nil {
		s.hub.broadcastToSession(s.SessionID, "quiz_error", map[string]interface{}{
			"error": "Session not found or theme not set",
		})
		return false
	}

	theme, err := s.hub.repo.GetThemeByID(*session.ThemeID)
	if err != nil || theme == nil {
		s.SetPhase(PhaseFinished)
		return false
	}

	s.hub.broadcastToSession(s.SessionID, "theme_display", map[string]interface{}{
		"session_id":  s.SessionID,
		"theme_data":  theme,
		"timestamp":   time.Now().Unix(),
	})
	s.hub.broadcastToSession(s.SessionID, "phase_started", map[string]interface{}{
		"session_id": s.SessionID,
		"phase":      "theme_display",
		"duration":   ThemeDisplayTime,
		"timestamp":  time.Now().Unix(),
	})

	deadline := time.Now().Add(time.Duration(ThemeDisplayTime) * time.Second)
	ticker := time.NewTicker(TickInterval)
	defer ticker.Stop()

	expired := false
	for !expired {
		select {
		case <-s.LoopStopChan:
			return false
		case <-ticker.C:
			remaining := time.Until(deadline).Seconds()
			if remaining <= 0 {
				expired = true
				break
			}
			s.hub.broadcastToSession(s.SessionID, "quiz_timer", map[string]interface{}{
				"session_id":    s.SessionID,
				"phase":         "theme_display",
				"duration":      ThemeDisplayTime,
				"timeRemaining": int(remaining),
				"timestamp":     time.Now().Unix(),
			})
		}
	}

	s.hub.broadcastToSession(s.SessionID, "quiz_timer_finished", map[string]interface{}{
		"session_id": s.SessionID,
		"phase":      "theme_display",
		"timestamp":  time.Now().Unix(),
	})

	s.SetPhase(PhaseQuiz)
	return true
}

// waitForTimer counts down for the given duration, broadcasting quiz_timer
// ticks every TickInterval. Returns false if the loop was stopped early.
func (s *SessionState) waitForTimer(duration int, phase string) bool {
	deadline := time.Now().Add(time.Duration(duration) * time.Second)
	ticker := time.NewTicker(TickInterval)
	defer ticker.Stop()

	expired := false
	for !expired {
		select {
		case <-s.LoopStopChan:
			return false
		case <-ticker.C:
			remaining := time.Until(deadline).Seconds()
			if remaining <= 0 {
				expired = true
				break
			}
			s.hub.broadcastToSession(s.SessionID, "quiz_timer", map[string]interface{}{
				"session_id":    s.SessionID,
				"phase":         phase,
				"duration":      duration,
				"timeRemaining": int(remaining),
				"timestamp":     time.Now().Unix(),
			})
		}
	}
	return true
}

// runQuestionPhase picks the next unasked question for the session's theme,
// broadcasts it, and waits for the answer timer to expire.
func (s *SessionState) runQuestionPhase(questionNum int) bool {
	s.mu.Lock()
	asked := make(map[int64]bool, len(s.QuizState.AskedQuestions))
	for _, id := range s.QuizState.AskedQuestions {
		asked[id] = true
	}
	s.mu.Unlock()

	session, err := s.hub.repo.GetSessionByID(s.SessionID)
	if err != nil || session == nil || session.ThemeID == nil {
		s.hub.broadcastToSession(s.SessionID, "quiz_error", map[string]interface{}{
			"session_id": s.SessionID,
			"error":      "Session not found or theme not set",
		})
		return false
	}

	questions, err := s.hub.repo.GetQuestionsByTheme(*session.ThemeID)
	if err != nil || len(questions) == 0 {
		s.hub.broadcastToSession(s.SessionID, "quiz_error", map[string]interface{}{
			"session_id": s.SessionID,
			"error":      "No questions available for this theme",
		})
		return false
	}

	// Pick the first question that has not been asked yet.
	var q *models.Question
	for i := range questions {
		if !asked[questions[i].ID] {
			q = &questions[i]
			break
		}
	}
	if q == nil {
		// Every question has been asked — end the quiz.
		s.SetPhase(PhaseFinished)
		s.hub.broadcastToSession(s.SessionID, "quiz_finished", map[string]interface{}{
			"session_id": s.SessionID,
			"reason":     "all_questions_asked",
			"timestamp":  time.Now().Unix(),
		})
		return false
	}

	if err := s.hub.repo.AddQuizQuestion(s.SessionID, q.ID); err != nil {
		log.Printf("[loop] session %d: failed to record question: %v", s.SessionID, err)
	}

	answers, err := s.hub.repo.GetAnswersForQuestion(q.ID)
	if err != nil || len(answers) == 0 {
		s.hub.broadcastToSession(s.SessionID, "quiz_error", map[string]interface{}{
			"session_id": s.SessionID,
			"error":      "No answers found for question",
		})
		return false
	}
	answerList := make([]map[string]interface{}, len(answers))
	for i, a := range answers {
		answerList[i] = map[string]interface{}{
			"id":          a.ID,
			"questionId":  a.QuestionID,
			"answer_text": a.AnswerText,
			"is_correct":  a.IsCorrect,
			"created_at":  a.CreatedAt,
			"updated_at":  a.UpdatedAt,
		}
	}

	questionTime := q.TimeLimit
	if questionTime < 9 {
		questionTime = DefaultQuestionTime
	}

	s.mu.Lock()
	s.QuizState.CurrentQuestion = q
	s.QuizState.QuestionCount = questionNum
	s.QuizState.WaitingForAnswers = true
	s.QuizState.AskedQuestions = append(s.QuizState.AskedQuestions, q.ID)
	s.mu.Unlock()

	questionPayload := map[string]interface{}{
		"session_id": s.SessionID,
		"question": map[string]interface{}{
			"id":                q.ID,
			"question_text":     q.QuestionText,
			"themeId":           q.ThemeID,
			"difficultyLevelId": q.DifficultyLevelID,
			"explanation":       safeString(q.Explanation),
			"Url":               q.URL,
			"time_limit":        q.TimeLimit,
			"think_time":        q.ThinkTime,
			"points":            q.Points,
		},
		"answers":  answerList,
		"duration": questionTime,
	}
	s.hub.broadcastToSession(s.SessionID, "questionData", questionPayload)
	s.hub.broadcastToSession(s.SessionID, "question_started", map[string]interface{}{
		"session_id":    s.SessionID,
		"question_id":   q.ID,
		"question_text": q.QuestionText,
		"answers":       answerList,
		"duration":      questionTime,
	})

	if !s.waitForTimer(questionTime, "quiz") {
		return false
	}

	s.mu.Lock()
	s.QuizState.WaitingForAnswers = false
	s.mu.Unlock()
	return true
}

// runExplanationPhase reveals the correct answer and explanation for the
// question that was just played, then returns the session to quiz phase.
func (s *SessionState) runExplanationPhase(questionNum int) bool {
	s.SetPhase(PhaseExplanation)

	s.mu.Lock()
	q := s.QuizState.CurrentQuestion
	s.mu.Unlock()
	if q == nil {
		return false
	}

	answers, err := s.hub.repo.GetAnswersForQuestion(q.ID)
	if err != nil || len(answers) == 0 {
		return false
	}

	correctIndex := -1
	correctText := ""
	for i, a := range answers {
		if a.IsCorrect {
			correctIndex = i
			correctText = a.AnswerText
			break
		}
	}

	s.hub.broadcastToSession(s.SessionID, "question_explanation", map[string]interface{}{
		"session_id":           s.SessionID,
		"question_id":          q.ID,
		"question_number":      questionNum,
		"correct_answer_index": correctIndex,
		"correct_answer_text":  correctText,
		"explanation":          safeString(q.Explanation),
		"timestamp":            time.Now().Unix(),
	})

	if !s.waitForTimer(DefaultExplanationTime, "explanation") {
		return false
	}

	s.SetPhase(PhaseQuiz)
	return true
}

// cleanup finalizes the session once the quiz loop ends.
func (s *SessionState) cleanup() {
	s.SetPhase(PhaseFinished)
	s.hub.broadcastToSession(s.SessionID, "quiz_finished", map[string]interface{}{
		"session_id": s.SessionID,
		"timestamp":  time.Now().Unix(),
	})
	s.hub.broadcastLeaderboard(s.SessionID)
	s.StopLoop()
}
