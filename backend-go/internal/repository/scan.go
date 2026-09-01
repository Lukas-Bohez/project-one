package repository

import (
	"database/sql"

	"github.com/Lukas-Bohez/project-one/backend-go/internal/models"
)

func scanTheme(scanner interface {
	Scan(dest ...any) error
}) (models.Theme, error) {
	var (
		item        models.Theme
		description sql.NullString
		logoURL     sql.NullString
		createdAt   sql.NullTime
		updatedAt   sql.NullTime
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

	item.Description = nullString(description)
	item.LogoURL = nullString(logoURL)
	item.CreatedAt = nullTimeUTC(createdAt)
	item.UpdatedAt = nullTimeUTC(updatedAt)

	return item, nil
}