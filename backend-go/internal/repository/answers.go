package repository

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/Lukas-Bohez/project-one/backend-go/internal/models"
)

type AnswerRepository struct {
	db *sql.DB
}

func NewAnswerRepository(db *sql.DB) *AnswerRepository {
	return &AnswerRepository{db: db}
}

func (r *AnswerRepository) ListByQuestionID(ctx context.Context, questionID int64, limit, offset int) ([]models.Answer, int, error) {
	// Get total matching rows for pagination metadata
	const countQuery = `SELECT COUNT(1) FROM answers WHERE questionId = ?`
	var total int
	if err := r.db.QueryRowContext(ctx, countQuery, questionID).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count answers: %w", err)
	}

	const query = `
		SELECT id, questionId, answer_text, is_correct, created_at, updated_at
		FROM answers
		WHERE questionId = ?
		ORDER BY id ASC
		LIMIT ? OFFSET ?
	`

	rows, err := r.db.QueryContext(ctx, query, questionID, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("list answers: %w", err)
	}
	defer rows.Close()

	answers := make([]models.Answer, 0)
	for rows.Next() {
		item, err := scanAnswer(rows)
		if err != nil {
			return nil, 0, err
		}
		answers = append(answers, item)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("iterate answers: %w", err)
	}

	return answers, total, nil
}

func (r *AnswerRepository) GetByID(ctx context.Context, answerID int64) (*models.Answer, error) {
	const query = `
		SELECT id, questionId, answer_text, is_correct, created_at, updated_at
		FROM answers
		WHERE id = ?
		LIMIT 1
	`

	row := r.db.QueryRowContext(ctx, query, answerID)
	item, err := scanAnswer(row)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("get answer by id: %w", err)
	}

	return &item, nil
}

// Create inserts a new answer and returns the new id.
func (r *AnswerRepository) Create(ctx context.Context, a models.Answer) (int64, error) {
	const query = `
		INSERT INTO answers (questionId, answer_text, is_correct, created_at, updated_at)
		VALUES (?, ?, ?, NOW(), NOW())
	`
	res, err := r.db.ExecContext(ctx, query, a.QuestionID, a.AnswerText, a.IsCorrect)
	if err != nil {
		return 0, fmt.Errorf("create answer: %w", err)
	}
	id, err := res.LastInsertId()
	if err != nil {
		return 0, fmt.Errorf("lastinsertid: %w", err)
	}
	return id, nil
}

// Update modifies an existing answer by id.
func (r *AnswerRepository) Update(ctx context.Context, a models.Answer) error {
	const query = `
		UPDATE answers
		SET answer_text = ?, is_correct = ?, updated_at = NOW()
		WHERE id = ?
	`
	res, err := r.db.ExecContext(ctx, query, a.AnswerText, a.IsCorrect, a.ID)
	if err != nil {
		return fmt.Errorf("update answer: %w", err)
	}
	if ra, err := res.RowsAffected(); err == nil && ra == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// Delete removes an answer by id.
func (r *AnswerRepository) Delete(ctx context.Context, id int64) error {
	const query = `DELETE FROM answers WHERE id = ?`
	res, err := r.db.ExecContext(ctx, query, id)
	if err != nil {
		return fmt.Errorf("delete answer: %w", err)
	}
	if ra, err := res.RowsAffected(); err == nil && ra == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// Percentage returns the overall percentage of answers that are correct (0-100).
func (r *AnswerRepository) Percentage(ctx context.Context) (float64, error) {
	const query = `SELECT SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as correct, COUNT(1) as total FROM answers`
	var correct sql.NullInt64
	var total sql.NullInt64
	if err := r.db.QueryRowContext(ctx, query).Scan(&correct, &total); err != nil {
		return 0, fmt.Errorf("percentage query: %w", err)
	}
	if !total.Valid || total.Int64 == 0 {
		return 0, nil
	}
	corr := int64(0)
	if correct.Valid {
		corr = correct.Int64
	}
	perc := (float64(corr) / float64(total.Int64)) * 100.0
	return perc, nil
}

func scanAnswer(scanner interface {
	Scan(dest ...any) error
}) (models.Answer, error) {
	var (
		item       models.Answer
		createdAt  sql.NullTime
		updatedAt  sql.NullTime
	)

	if err := scanner.Scan(
		&item.ID,
		&item.QuestionID,
		&item.AnswerText,
		&item.IsCorrect,
		&createdAt,
		&updatedAt,
	); err != nil {
		return models.Answer{}, err
	}

	if createdAt.Valid {
		value := createdAt.Time.UTC()
		item.CreatedAt = &value
	}
	if updatedAt.Valid {
		value := updatedAt.Time.UTC()
		item.UpdatedAt = &value
	}

	return item, nil
}