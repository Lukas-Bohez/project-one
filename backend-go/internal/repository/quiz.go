package repository

import (
	"database/sql"
	"time"

	"github.com/Lukas-Bohez/project-one/backend-go/internal/models"
)

// QuizRepository provides data access for the quiz engine.
type QuizRepository struct {
	db *sql.DB
}

// NewQuizRepository creates a new quiz repository.
func NewQuizRepository(db *sql.DB) *QuizRepository {
	return &QuizRepository{db: db}
}

// QuizSession represents a quiz session row.
type QuizSession struct {
	ID        int64
	Name      string
	ThemeID   *int64
	Phase     string
	CreatedBy int64
	IsActive  bool
	CreatedAt time.Time
}

// PlayerAnswer represents a player's answer row.
type PlayerAnswer struct {
	ID           int64
	SessionID    int64
	UserID       int64
	QuestionID   int64
	AnswerID     int64
	IsCorrect    bool
	PointsEarned int
	TimeTaken    int
	CreatedAt    time.Time
}

// PlayerScore represents a leaderboard entry.
type PlayerScore struct {
	UserID     int64  `json:"userId"`
	Username   string `json:"username"`
	TotalScore int    `json:"total_score"`
}

// GetActiveSessions returns all active quiz sessions.
func (r *QuizRepository) GetActiveSessions() ([]QuizSession, error) {
	rows, err := r.db.Query(`
		SELECT id, name, themeId, phase, createdBy, is_active, created_at
		FROM quizSessions WHERE is_active = true
		ORDER BY created_at DESC LIMIT 10`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sessions []QuizSession
	for rows.Next() {
		var s QuizSession
		if err := rows.Scan(&s.ID, &s.Name, &s.ThemeID, &s.Phase, &s.CreatedBy, &s.IsActive, &s.CreatedAt); err != nil {
			return nil, err
		}
		sessions = append(sessions, s)
	}
	return sessions, rows.Err()
}

// GetSessionByID returns a single quiz session.
func (r *QuizRepository) GetSessionByID(id int64) (*QuizSession, error) {
	var s QuizSession
	err := r.db.QueryRow(`
		SELECT id, name, themeId, phase, createdBy, is_active, created_at
		FROM quizSessions WHERE id = ?`, id).Scan(
		&s.ID, &s.Name, &s.ThemeID, &s.Phase, &s.CreatedBy, &s.IsActive, &s.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &s, nil
}

// GetThemeByID returns a theme by ID.
func (r *QuizRepository) GetThemeByID(id int64) (*models.Theme, error) {
	var t models.Theme
	err := r.db.QueryRow(`
		SELECT id, name, description, logoUrl, is_active, created_at, updated_at
		FROM themes WHERE id = ?`, id).Scan(
		&t.ID, &t.Name, &t.Description, &t.LogoURL, &t.IsActive, &t.CreatedAt, &t.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &t, nil
}