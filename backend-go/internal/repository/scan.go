package repository

import (
	"database/sql"
	"time"

	"github.com/Lukas-Bohez/project-one/backend-go/internal/models"
)

func scanTheme(scanner interface {
	Scan(dest ...any) error
}) (models.Theme, error) {
	var (
		item       models.Theme
		description sql.NullString
		logoURL    sql.NullString
		createdAt  sql.NullTime
		updatedAt  sql.NullTime
	)

	if err := scanner.Scan(
		&item.ID,
		&item.Name,
		&description,
		&logoURL,
		&item.IsActive,
		&createdAt,
		&updatedAt,
	); err != nil {
		return models.Theme{}, err
	}

	if description.Valid {
		value := description.String
		item.Description = &value
	}
	if logoURL.Valid {
		value := logoURL.String
		item.LogoURL = &value
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

func utcTimePtr(value time.Time) *time.Time {
	v := value.UTC()
	return &v
}