package quiz

import (
	"time"
)

// safeString dereferences a nullable string, returning "" for nil.
func safeString(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

// QuizSession represents an active quiz session.
type QuizSession struct {
	ID        int64     `json:"sessionId"`
	Name      string    `json:"name"`
	ThemeID   *int64    `json:"themeId,omitempty"`
	Phase     Phase     `json:"phase"`
	CreatedBy int64     `json:"createdBy"`
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
}

// PlayerAnswer records a single answer submission.
type PlayerAnswer struct {
	ID           int64     `json:"id"`
	SessionID    int64     `json:"session_id"`
	UserID       int64     `json:"user_id"`
	QuestionID   int64     `json:"question_id"`
	AnswerIndex  int       `json:"answer_index"`
	IsCorrect    bool      `json:"is_correct"`
	PointsEarned int       `json:"points_earned"`
	TimeTaken    int       `json:"time_taken"`
	CreatedAt    time.Time `json:"created_at"`
}

// PlayerScore tracks cumulative score for a player in a session.
type PlayerScore struct {
	UserID     int64  `json:"userId"`
	Username   string `json:"username"`
	TotalScore int    `json:"total_score"`
}

// QuestionWithAnswers represents a question and its answers for broadcast.
type QuestionWithAnswers struct {
	ID                int64    `json:"id"`
	QuestionText      string   `json:"question_text"`
	ThemeID           int64    `json:"themeId"`
	DifficultyLevelID int64    `json:"difficultyLevelId"`
	Answers           []Answer `json:"answers"`
	TimeLimit         int      `json:"time_limit"`
	Points            int      `json:"points"`
}

// Answer represents a single answer option.
type Answer struct {
	ID         int64  `json:"id"`
	AnswerText string `json:"answer_text"`
}


