package models

import "time"

type Question struct {
	ID                int64      `json:"id"`
	QuestionText      string     `json:"question_text"`
	ThemeID           int64      `json:"themeId"`
	DifficultyLevelID int64      `json:"difficultyLevelId"`
	Explanation       *string    `json:"explanation,omitempty"`
	URL               *string    `json:"Url,omitempty"`
	TimeLimit         int        `json:"time_limit"`
	ThinkTime         int        `json:"think_time"`
	Points            int        `json:"points"`
	IsActive          bool       `json:"is_active"`
	NoAnswerCorrect   bool       `json:"no_answer_correct"`
	LightMax          *float64   `json:"LightMax,omitempty"`
	LightMin          *float64   `json:"LightMin,omitempty"`
	TempMax           *float64   `json:"TempMax,omitempty"`
	TempMin           *float64   `json:"TempMin,omitempty"`
	CreatedBy         *int64     `json:"createdBy,omitempty"`
	CreatedAt         *time.Time `json:"created_at,omitempty"`
	UpdatedAt         *time.Time `json:"updated_at,omitempty"`
}

type Theme struct {
	ID          int64      `json:"id"`
	Name        string     `json:"name"`
	Description *string    `json:"description,omitempty"`
	LogoURL     *string    `json:"logoUrl,omitempty"`
	IsActive    bool       `json:"is_active"`
	CreatedAt   *time.Time `json:"created_at,omitempty"`
	UpdatedAt   *time.Time `json:"updated_at,omitempty"`
}

type DifficultyLevel struct {
	ID     int64  `json:"id"`
	Name   string `json:"name"`
	Weight int    `json:"weight"`
}

type Answer struct {
	ID        int64      `json:"id"`
	QuestionID int64     `json:"questionId"`
	AnswerText string     `json:"answer_text"`
	IsCorrect  bool       `json:"is_correct"`
	CreatedAt  *time.Time `json:"created_at,omitempty"`
	UpdatedAt  *time.Time `json:"updated_at,omitempty"`
}

type User struct {
	ID               int64      `json:"id"`
	LastName         string     `json:"last_name"`
	FirstName        string     `json:"first_name"`
	RFIDCode         *string    `json:"rfid_code,omitempty"`
	UserRoleID       int64      `json:"userRoleId"`
	SoulPoints       int        `json:"soul_points"`
	LimbPoints       int        `json:"limb_points"`
	PasswordHash     *string    `json:"password_hash,omitempty"`
	Salt             *string    `json:"salt,omitempty"`
	LastActive       *time.Time `json:"last_active,omitempty"`
	SessionExpiresAt *time.Time `json:"session_expires_at,omitempty"`
	UpdatedBy        *int64     `json:"updated_by,omitempty"`
}

type UserPublic struct {
	ID               int64      `json:"id"`
	LastName         string     `json:"last_name"`
	FirstName        string     `json:"first_name"`
	RFIDCode         *string    `json:"rfid_code,omitempty"`
	UserRoleID       int64      `json:"userRoleId"`
	SoulPoints       int        `json:"soul_points"`
	LimbPoints       int        `json:"limb_points"`
	LastActive       *time.Time `json:"last_active,omitempty"`
	SessionExpiresAt *time.Time `json:"session_expires_at,omitempty"`
	UpdatedBy        *int64     `json:"updated_by,omitempty"`
}
