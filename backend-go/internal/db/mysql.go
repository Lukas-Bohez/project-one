package db

import (
	"database/sql"
	"fmt"

	_ "github.com/go-sql-driver/mysql"

	"github.com/Lukas-Bohez/project-one/backend-go/internal/config"
)

type MySQL struct {
	DB *sql.DB
}

func Open(cfg config.DBConfig) (*MySQL, error) {
	db, err := sql.Open("mysql", cfg.DSN())
	if err != nil {
		return nil, fmt.Errorf("open mysql connection: %w", err)
	}

	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(10)
	db.SetConnMaxLifetime(0)

	if err := db.Ping(); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("ping mysql: %w", err)
	}

	return &MySQL{DB: db}, nil
}

func (m *MySQL) Close() error {
	if m == nil || m.DB == nil {
		return nil
	}
	return m.DB.Close()
}
