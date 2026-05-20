package config

import (
	"fmt"
	"net/url"
	"os"
	"strconv"
)

type DBConfig struct {
	Host     string
	Port     int
	User     string
	Password string
	Name     string
	Charset  string
}

type Config struct {
	Port     string
	DB       DBConfig
	Database string
}

func Load() Config {
	return Config{
		Port:     envOr("PORT", "8081"),
		Database: envOr("DATABASE_URL", ""),
		DB:       loadDBConfig(),
	}
}

func loadDBConfig() DBConfig {
	if databaseURL := os.Getenv("DATABASE_URL"); databaseURL != "" {
		if parsed, err := url.Parse(databaseURL); err == nil {
			host := "127.0.0.1"
			if parsed.Hostname() != "" {
				host = parsed.Hostname()
			}

			port := 3306
			if parsed.Port() != "" {
				if parsedPort, err := strconv.Atoi(parsed.Port()); err == nil {
					port = parsedPort
				}
			}

			user := "quiz_user"
			if parsed.User != nil && parsed.User.Username() != "" {
				user = parsed.User.Username()
			}

			password, _ := parsed.User.Password()
			if password == "" {
				password = "secure_password_not_here"
			}

			name := "quizTheSpire"
			if parsed.Path != "" {
				trimmed := parsed.Path
				if len(trimmed) > 0 && trimmed[0] == '/' {
					trimmed = trimmed[1:]
				}
				if trimmed != "" {
					name = trimmed
				}
			}

			return DBConfig{
				Host:     host,
				Port:     port,
				User:     user,
				Password: password,
				Name:     name,
				Charset:  "utf8mb4",
			}
		}
	}

	port := 3306
	if rawPort := envOr("DB_PORT", "3306"); rawPort != "" {
		if parsedPort, err := strconv.Atoi(rawPort); err == nil {
			port = parsedPort
		}
	}

	return DBConfig{
		Host:     envOr("DB_HOST", "127.0.0.1"),
		Port:     port,
		User:     envOr("DB_USER", "quiz_user"),
		Password: envOr("DB_PASSWORD", "secure_password_not_here"),
		Name:     envOr("DB_NAME", "quizTheSpire"),
		Charset:  "utf8mb4",
	}
}

func envOr(name, fallback string) string {
	if value := os.Getenv(name); value != "" {
		return value
	}
	return fallback
}

func (c DBConfig) DSN() string {
	return fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?charset=%s&parseTime=true&loc=UTC",
		c.User,
		c.Password,
		c.Host,
		c.Port,
		c.Name,
		c.Charset,
	)
}
