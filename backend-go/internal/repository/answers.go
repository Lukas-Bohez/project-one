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

func (r *AnswerRepository) ListByQuestionID(ctx context.Context, questionID int64, limit, offset int) ([]models.Answer, error) {
	const query = `
		SELECT id, questionId, answer_text, is_correct, created_at, updated_at
		FROM answers
		WHERE questionId = ?
		ORDER BY id ASC
		LIMIT ? OFFSET ?
	`

	rows, err := r.db.QueryContext(ctx, query, questionID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("list answers: %w", err)
	}
	defer rows.Close()

	answers := make([]models.Answer, 0)
	for rows.Next() {
		item, err := scanAnswer(rows)
		if err != nil {
			return nil, err
		}
		answers = append(answers, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate answers: %w", err)
	}

	return answers, nil
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