package repository

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/Lukas-Bohez/project-one/backend-go/internal/models"
)

type ThemeRepository struct {
	db *sql.DB
}

func NewThemeRepository(db *sql.DB) *ThemeRepository {
	return &ThemeRepository{db: db}
}

func (r *ThemeRepository) List(ctx context.Context, activeOnly bool) ([]models.Theme, error) {
	query := `
		SELECT id, name, description, logoUrl, is_active, created_at, updated_at
		FROM themes
	`
	if activeOnly {
		query += " WHERE is_active = TRUE"
	}
	query += " ORDER BY id ASC"

	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("list themes: %w", err)
	}
	defer rows.Close()

	themes := make([]models.Theme, 0)
	for rows.Next() {
		item, err := scanTheme(rows)
		if err != nil {
			return nil, err
		}
		themes = append(themes, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate themes: %w", err)
	}

	return themes, nil
}

func (r *ThemeRepository) GetByID(ctx context.Context, id int64) (*models.Theme, error) {
	const query = `
		SELECT id, name, description, logoUrl, is_active, created_at, updated_at
		FROM themes
		WHERE id = ?
		LIMIT 1
	`

	row := r.db.QueryRowContext(ctx, query, id)
	item, err := scanTheme(row)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("get theme by id: %w", err)
	}

	return &item, nil
}
