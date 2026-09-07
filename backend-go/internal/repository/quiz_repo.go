package repository

import (
	"database/sql"
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
		SELECT id, session_id, user_id, question_id, answer_index, is_correct, points_earned, time_taken, created_at
		FROM player_answers WHERE session_id = ? AND user_id = ? AND question_id = ?`,
		sessionID, userID, questionID).Scan(
		&pa.ID, &pa.SessionID, &pa.UserID, &pa.QuestionID, &pa.AnswerIndex, &pa.IsCorrect, &pa.PointsEarned, &pa.TimeTaken, &pa.CreatedAt)
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
		INSERT INTO player_answers (session_id, user_id, question_id, answer_index, is_correct, points_earned, time_taken, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		pa.SessionID, pa.UserID, pa.QuestionID, pa.AnswerIndex, pa.IsCorrect, pa.PointsEarned, pa.TimeTaken, time.Now())
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

// GetSessionScores returns the leaderboard for a session.
func (r *QuizRepository) GetSessionScores(sessionID int64) ([]PlayerScore, error) {
	rows, err := r.db.Query(`
		SELECT user_id, SUM(points_earned) as total_score
		FROM player_answers WHERE session_id = ?
		GROUP BY user_id ORDER BY total_score DESC LIMIT 20`, sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var scores []PlayerScore
	for rows.Next() {
		var s PlayerScore
		if err := rows.Scan(&s.UserID, &s.TotalScore); err != nil {
			return nil, err
		}
		s.Username = "Player"
		scores = append(scores, s)
	}
	return scores, rows.Err()
}