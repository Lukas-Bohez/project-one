package repository

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"github.com/Lukas-Bohez/project-one/backend-go/internal/models"
)

type QuestionRepository struct {
	db *sql.DB
}

func NewQuestionRepository(db *sql.DB) *QuestionRepository {
	return &QuestionRepository{db: db}
}

func (r *QuestionRepository) List(ctx context.Context, activeOnly bool, limit int) ([]models.Question, error) {
	query := `
		SELECT id, question_text, themeId, difficultyLevelId, explanation, Url,
		       time_limit, think_time, points, is_active, no_answer_correct,
		       LightMax, LightMin, TempMax, TempMin, createdBy, created_at, updated_at
		FROM questions
	`
	clauses := make([]string, 0, 2)
	args := make([]any, 0, 2)

	if activeOnly {
		clauses = append(clauses, "is_active = TRUE")
	}
	if limit > 0 {
		query += " ORDER BY id ASC LIMIT ?"
		args = append(args, limit)
	} else {
		query += " ORDER BY id ASC"
	}
	if len(clauses) > 0 {
		query = strings.Replace(query, "FROM questions", "FROM questions WHERE "+strings.Join(clauses, " AND "), 1)
	}

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("list questions: %w", err)
	}
	defer rows.Close()

	questions := make([]models.Question, 0)
	for rows.Next() {
		item, err := scanQuestion(rows)
		if err != nil {
			return nil, err
		}
		questions = append(questions, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate questions: %w", err)
	}

	return questions, nil
}

func (r *QuestionRepository) GetByID(ctx context.Context, id int64) (*models.Question, error) {
	const query = `
		SELECT id, question_text, themeId, difficultyLevelId, explanation, Url,
		       time_limit, think_time, points, is_active, no_answer_correct,
		       LightMax, LightMin, TempMax, TempMin, createdBy, created_at, updated_at
		FROM questions
		WHERE id = ?
		LIMIT 1
	`

	row := r.db.QueryRowContext(ctx, query, id)
	item, err := scanQuestion(row)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("get question by id: %w", err)
	}

	return &item, nil
}

func scanQuestion(scanner interface {
	Scan(dest ...any) error
}) (models.Question, error) {
	var (
		item        models.Question
		explanation sql.NullString
		urlValue    sql.NullString
		lightMax    sql.NullFloat64
		lightMin    sql.NullFloat64
		tempMax     sql.NullFloat64
		tempMin     sql.NullFloat64
		createdBy   sql.NullInt64
		createdAt   sql.NullTime
		updatedAt   sql.NullTime
	)

	if err := scanner.Scan(
		&item.ID,
		&item.QuestionText,
		&item.ThemeID,
		&item.DifficultyLevelID,
		&explanation,
		&urlValue,
		&item.TimeLimit,
		&item.ThinkTime,
		&item.Points,
		&item.IsActive,
		&item.NoAnswerCorrect,
		&lightMax,
		&lightMin,
		&tempMax,
		&tempMin,
		&createdBy,
		&createdAt,
		&updatedAt,
	); err != nil {
		return models.Question{}, err
	}

	item.Explanation = nullString(explanation)
	item.URL = nullString(urlValue)
	item.LightMax = nullFloat64(lightMax)
	item.LightMin = nullFloat64(lightMin)
	item.TempMax = nullFloat64(tempMax)
	item.TempMin = nullFloat64(tempMin)
	item.CreatedBy = nullInt64(createdBy)
	item.CreatedAt = nullTimeUTC(createdAt)
	item.UpdatedAt = nullTimeUTC(updatedAt)

	return item, nil
}

// ActiveCount returns the number of active questions (is_active = TRUE)
func (r *QuestionRepository) ActiveCount(ctx context.Context) (int, error) {
	const query = `SELECT COUNT(1) FROM questions WHERE is_active = TRUE`
	var cnt int
	if err := r.db.QueryRowContext(ctx, query).Scan(&cnt); err != nil {
		return 0, fmt.Errorf("active question count: %w", err)
	}
	return cnt, nil
}
