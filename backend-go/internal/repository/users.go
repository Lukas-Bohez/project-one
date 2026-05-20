package repository

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/Lukas-Bohez/project-one/backend-go/internal/models"
)

type UserRepository struct {
	db *sql.DB
}

func NewUserRepository(db *sql.DB) *UserRepository {
	return &UserRepository{db: db}
}

func (r *UserRepository) ListPublic(ctx context.Context, limit int) ([]models.UserPublic, error) {
	query := `
		SELECT id, last_name, first_name, rfid_code, userRoleId, soul_points, limb_points,
		       last_active, session_expires_at, updated_by
		FROM users
		ORDER BY id ASC
	`
	args := make([]any, 0, 1)
	if limit > 0 {
		query += " LIMIT ?"
		args = append(args, limit)
	}

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("list users: %w", err)
	}
	defer rows.Close()

	users := make([]models.UserPublic, 0)
	for rows.Next() {
		item, err := scanUserPublic(rows)
		if err != nil {
			return nil, err
		}
		users = append(users, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate users: %w", err)
	}

	return users, nil
}

func (r *UserRepository) GetPublicByID(ctx context.Context, id int64) (*models.UserPublic, error) {
	const query = `
		SELECT id, last_name, first_name, rfid_code, userRoleId, soul_points, limb_points,
		       last_active, session_expires_at, updated_by
		FROM users
		WHERE id = ?
		LIMIT 1
	`

	row := r.db.QueryRowContext(ctx, query, id)
	item, err := scanUserPublic(row)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("get user by id: %w", err)
	}

	return &item, nil
}

func scanUserPublic(scanner interface {
	Scan(dest ...any) error
}) (models.UserPublic, error) {
	var (
		item             models.UserPublic
		rfidCode         sql.NullString
		lastActive       sql.NullTime
		sessionExpiresAt sql.NullTime
		updatedBy        sql.NullInt64
	)

	if err := scanner.Scan(
		&item.ID,
		&item.LastName,
		&item.FirstName,
		&rfidCode,
		&item.UserRoleID,
		&item.SoulPoints,
		&item.LimbPoints,
		&lastActive,
		&sessionExpiresAt,
		&updatedBy,
	); err != nil {
		return models.UserPublic{}, err
	}

	if rfidCode.Valid {
		value := rfidCode.String
		item.RFIDCode = &value
	}
	if lastActive.Valid {
		value := lastActive.Time.UTC()
		item.LastActive = &value
	}
	if sessionExpiresAt.Valid {
		value := sessionExpiresAt.Time.UTC()
		item.SessionExpiresAt = &value
	}
	if updatedBy.Valid {
		value := updatedBy.Int64
		item.UpdatedBy = &value
	}

	return item, nil
}