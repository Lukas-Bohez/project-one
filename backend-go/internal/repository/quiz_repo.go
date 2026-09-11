package repository

import (
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/Lukas-Bohez/project-one/backend-go/internal/models"
)

// GetQuestionByID returns a question by ID.
func (r *QuizRepository) GetQuestionByID(id int64) (*models.Question, error) {
	var q models.Question
	err := r.db.QueryRow(`
		SELECT id, question_text, themeId, difficultyLevelId, explanation, Url,
		       time_limit, think_time, points, is_active, no_answer_correct,
		       createdBy, LightMax, LightMin, TempMax, TempMin, created_at, updated_at
		FROM questions WHERE id = ?`, id).Scan(
		&q.ID, &q.QuestionText, &q.ThemeID, &q.DifficultyLevelID, &q.Explanation, &q.URL,
		&q.TimeLimit, &q.ThinkTime, &q.Points, &q.IsActive, &q.NoAnswerCorrect,
		&q.CreatedBy, &q.LightMax, &q.LightMin, &q.TempMax, &q.TempMin, &q.CreatedAt, &q.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &q, nil
}

// GetAnswersForQuestion returns all answers for a question.
func (r *QuizRepository) GetAnswersForQuestion(questionID int64) ([]models.Answer, error) {
	rows, err := r.db.Query(`
		SELECT id, questionId, answer_text, is_correct, created_at, updated_at
		FROM answers WHERE questionId = ? ORDER BY id`, questionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var answers []models.Answer
	for rows.Next() {
		var a models.Answer
		if err := rows.Scan(&a.ID, &a.QuestionID, &a.AnswerText, &a.IsCorrect, &a.CreatedAt, &a.UpdatedAt); err != nil {
			return nil, err
		}
		answers = append(answers, a)
	}
	return answers, rows.Err()
}

// GetCurrentQuestion returns the current question for a session.
func (r *QuizRepository) GetCurrentQuestion(sessionID int64) (*models.Question, error) {
	var q models.Question
	err := r.db.QueryRow(`
		SELECT q.id, q.question_text, q.themeId, q.difficultyLevelId, q.explanation, q.Url,
		       q.time_limit, q.think_time, q.points, q.is_active, q.no_answer_correct,
		       q.createdBy, q.LightMax, q.LightMin, q.TempMax, q.TempMin, q.created_at, q.updated_at
		FROM quiz_questions qq
		JOIN questions q ON q.id = qq.question_id
		WHERE qq.session_id = ?
		ORDER BY qq.question_order DESC LIMIT 1`, sessionID).Scan(
		&q.ID, &q.QuestionText, &q.ThemeID, &q.DifficultyLevelID, &q.Explanation, &q.URL,
		&q.TimeLimit, &q.ThinkTime, &q.Points, &q.IsActive, &q.NoAnswerCorrect,
		&q.CreatedBy, &q.LightMax, &q.LightMin, &q.TempMax, &q.TempMin, &q.CreatedAt, &q.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &q, nil
}

// GetPlayerAnswer checks if a player already answered a question.
func (r *QuizRepository) GetPlayerAnswer(sessionID, userID, questionID int64) (*PlayerAnswer, error) {
	var pa PlayerAnswer
	err := r.db.QueryRow(`
		SELECT id, sessionId, userId, questionId, answerId, is_correct, points_earned, time_taken, answered_at
		FROM playerAnswers WHERE sessionId = ? AND userId = ? AND questionId = ?`,
		sessionID, userID, questionID).Scan(
		&pa.ID, &pa.SessionID, &pa.UserID, &pa.QuestionID, &pa.AnswerID, &pa.IsCorrect, &pa.PointsEarned, &pa.TimeTaken, &pa.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &pa, nil
}

// CreatePlayerAnswer saves a player's answer.
func (r *QuizRepository) CreatePlayerAnswer(pa PlayerAnswer) (int64, error) {
	res, err := r.db.Exec(`
		INSERT INTO playerAnswers (sessionId, userId, questionId, answerId, is_correct, points_earned, time_taken, answered_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		pa.SessionID, pa.UserID, pa.QuestionID, pa.AnswerID, pa.IsCorrect, pa.PointsEarned, pa.TimeTaken, time.Now())
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

// VoteForTheme records a theme vote for a session.
func (r *QuizRepository) VoteForTheme(sessionID, themeID int64) error {
	_, err := r.db.Exec(`
		INSERT INTO theme_votes (session_id, theme_id, created_at) VALUES (?, ?, ?)`,
		sessionID, themeID, time.Now())
	return err
}

// SetSessionTheme updates the theme for a quiz session.
func (r *QuizRepository) SetSessionTheme(sessionID, themeID int64) error {
	_, err := r.db.Exec(`UPDATE quizSessions SET themeId = ? WHERE id = ?`, themeID, sessionID)
	return err
}

// GetQuestionsByTheme returns all active questions for a theme.
func (r *QuizRepository) GetQuestionsByTheme(themeID int64) ([]models.Question, error) {
	rows, err := r.db.Query(`
		SELECT id, question_text, themeId, difficultyLevelId, explanation, Url,
		       time_limit, think_time, points, is_active, no_answer_correct,
		       createdBy, LightMax, LightMin, TempMax, TempMin, created_at, updated_at
		FROM questions WHERE themeId = ? AND is_active = TRUE
		ORDER BY RAND()`, themeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var questions []models.Question
	for rows.Next() {
		var q models.Question
		if err := rows.Scan(
			&q.ID, &q.QuestionText, &q.ThemeID, &q.DifficultyLevelID, &q.Explanation, &q.URL,
			&q.TimeLimit, &q.ThinkTime, &q.Points, &q.IsActive, &q.NoAnswerCorrect,
			&q.CreatedBy, &q.LightMax, &q.LightMin, &q.TempMax, &q.TempMin, &q.CreatedAt, &q.UpdatedAt,
		); err != nil {
			return nil, err
		}
		questions = append(questions, q)
	}
	return questions, rows.Err()
}

// GetActiveThemes returns all active themes.
func (r *QuizRepository) GetActiveThemes() ([]models.Theme, error) {
	rows, err := r.db.Query(`
		SELECT id, name, description, logoUrl, is_active, created_at, updated_at
		FROM themes WHERE is_active = TRUE ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var themes []models.Theme
	for rows.Next() {
		var t models.Theme
		if err := rows.Scan(
			&t.ID, &t.Name, &t.Description, &t.LogoURL, &t.IsActive, &t.CreatedAt, &t.UpdatedAt,
		); err != nil {
			return nil, err
		}
		themes = append(themes, t)
	}
	return themes, rows.Err()
}

// GetQuestionCountByTheme returns the count of active questions for a theme.
func (r *QuizRepository) GetQuestionCountByTheme(themeID int64) (int, error) {
	var count int
	err := r.db.QueryRow(`SELECT COUNT(*) FROM questions WHERE themeId = ? AND is_active = TRUE`, themeID).Scan(&count)
	if err != nil {
		return 0, err
	}
	return count, nil
}

// AddQuizQuestion records a question as asked in a session.
func (r *QuizRepository) AddQuizQuestion(sessionID, questionID int64) error {
	_, err := r.db.Exec(`
		INSERT INTO quiz_questions (session_id, question_id, question_order, created_at)
		VALUES (?, ?, (SELECT IFNULL(MAX(question_order), 0) + 1 FROM quiz_questions WHERE session_id = ?), ?)`,
		sessionID, questionID, sessionID, time.Now())
	return err
}

// CountPlayersInSession returns the number of distinct players who have answered in a session.
func (r *QuizRepository) CountPlayersInSession(sessionID int64) (int, error) {
	var count int
	err := r.db.QueryRow(`
		SELECT COUNT(DISTINCT userId) FROM playerAnswers WHERE sessionId = ?`, sessionID).Scan(&count)
	if err != nil {
		return 0, err
	}
	return count, nil
}

// GetThemeQuestionCounts returns question counts for a list of theme IDs.
func (r *QuizRepository) GetThemeQuestionCounts(themeIDs []int64) (map[int64]int, error) {
	result := make(map[int64]int)
	if len(themeIDs) == 0 {
		return result, nil
	}
	placeholders := make([]string, len(themeIDs))
	args := make([]interface{}, len(themeIDs))
	for i, id := range themeIDs {
		placeholders[i] = "?"
		args[i] = id
	}
	query := `SELECT themeId, COUNT(*) FROM questions WHERE themeId IN (` + strings.Join(placeholders, ",") + `) AND is_active = TRUE GROUP BY themeId`
	rows, err := r.db.Query(query, args...)
	if err != nil {
		return result, err
	}
	defer rows.Close()
	for rows.Next() {
		var themeID int64
		var cnt int
		if err := rows.Scan(&themeID, &cnt); err != nil {
			return result, err
		}
		result[themeID] = cnt
	}
	return result, rows.Err()
}

// GetSessionScores returns the leaderboard for a session.
func (r *QuizRepository) GetSessionScores(sessionID int64) ([]PlayerScore, error) {
	rows, err := r.db.Query(`
		SELECT u.id, u.last_name, COALESCE(SUM(pa.points_earned), 0) as total_score
		FROM users u
		LEFT JOIN playerAnswers pa ON pa.userId = u.id AND pa.sessionId = ?
		WHERE u.id IN (SELECT DISTINCT userId FROM playerAnswers WHERE sessionId = ?)
		GROUP BY u.id, u.last_name
		ORDER BY total_score DESC LIMIT 20`, sessionID, sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var scores []PlayerScore
	for rows.Next() {
		var s PlayerScore
		if err := rows.Scan(&s.UserID, &s.Username, &s.TotalScore); err != nil {
			return nil, err
		}
		scores = append(scores, s)
	}
	return scores, rows.Err()
}

// InsertTheme creates a new theme if one with the same name doesn't already exist.
// Returns the theme ID (existing or newly inserted) and any error.
func (r *QuizRepository) InsertTheme(name, description, logoURL string, isActive bool) (int64, error) {
	// Check if theme with this name already exists
	var existingID int64
	err := r.db.QueryRow(`SELECT id FROM themes WHERE name = ?`, name).Scan(&existingID)
	if err == nil {
		return existingID, nil // already exists
	}
	if err != nil && err != sql.ErrNoRows {
		return 0, err
	}

	// Insert new theme
	result, err := r.db.Exec(
		`INSERT INTO themes (name, description, logoUrl, is_active, created_at, updated_at)
		 VALUES (?, ?, ?, ?, NOW(), NOW())`,
		name, description, logoURL, isActive,
	)
	if err != nil {
		return 0, err
	}
	return result.LastInsertId()
}

// EnsureThemes seeds the database with the standard quiz themes.
// It is safe to call multiple times — existing themes are skipped.
func (r *QuizRepository) EnsureThemes() error {
	themes := []struct {
		name        string
		description string
		logoURL     string
	}{
		{
			name:        "Japanese Language",
			description: "Master Japanese vocabulary, grammar, and expressions through interactive quizzes.",
			logoURL:     "https://quizthespire.com/images/themes/japanese-language.svg",
		},
		{
			name:        "World Cuisines",
			description: "Expand your culinary knowledge with traditional dishes, cooking techniques, and food culture from around the world.",
			logoURL:     "https://quizthespire.com/images/themes/world-cuisines.svg",
		},
		{
			name:        "Space Exploration",
			description: "Test your knowledge of space science, major missions, planetary astronomy, and cosmic history.",
			logoURL:     "https://quizthespire.com/images/themes/space-exploration.svg",
		},
		{
			name:        "Ancient Civilizations",
			description: "Explore the ancient world — Mesopotamia, Egypt, Greece, Rome, and Asian empires through history and archaeology.",
			logoURL:     "https://quizthespire.com/images/themes/ancient-civilizations.svg",
		},
		{
			name:        "World Geography",
			description: "Test your knowledge of countries, capitals, continents, landscapes, climate zones, and cultural landmarks.",
			logoURL:     "https://quizthespire.com/images/themes/world-geography.svg",
		},
		{
			name:        "Music Through the Ages",
			description: "Explore music history and theory — from classical periods and composers to popular genres and instrument families.",
			logoURL:     "https://quizthespire.com/images/themes/music-through-the-ages.svg",
		},
	}

	for _, t := range themes {
		_, err := r.InsertTheme(t.name, t.description, t.logoURL, true)
		if err != nil {
			return fmt.Errorf("ensure theme %q: %w", t.name, err)
		}
	}
	return nil
}
