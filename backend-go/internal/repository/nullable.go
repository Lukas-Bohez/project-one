package repository

// nullable.go centralizes the conversion from database/sql's Null* wrapper
// types to the plain pointer types used on our models (*string, *float64,
// *int64, *time.Time). Every scan* function needs the same "is it NULL, and
// if not, take its address" conversion for each optional column; before this
// file existed that conversion was retyped inline about twenty times across
// answers.go, questions.go, scan.go and users.go, and four throwaway
// pointer-wrapping helpers (ptrString, ptrFloat64, ptrInt64, ptrTime,
// utcTimePtr) were added along the way but never actually called. This file
// replaces all of that with four small helpers, used consistently.

import (
	"database/sql"
	"time"
)

// nullString converts a sql.NullString into *string, returning nil when the
// database value was NULL.
func nullString(v sql.NullString) *string {
	if !v.Valid {
		return nil
	}
	value := v.String
	return &value
}

// nullFloat64 converts a sql.NullFloat64 into *float64, returning nil when
// the database value was NULL.
func nullFloat64(v sql.NullFloat64) *float64 {
	if !v.Valid {
		return nil
	}
	value := v.Float64
	return &value
}

// nullInt64 converts a sql.NullInt64 into *int64, returning nil when the
// database value was NULL.
func nullInt64(v sql.NullInt64) *int64 {
	if !v.Valid {
		return nil
	}
	value := v.Int64
	return &value
}

// nullTimeUTC converts a sql.NullTime into *time.Time normalized to UTC,
// returning nil when the database value was NULL. Every stored timestamp in
// this package was already being normalized to UTC by hand at each call
// site; that normalization now happens once, here.
func nullTimeUTC(v sql.NullTime) *time.Time {
	if !v.Valid {
		return nil
	}
	value := v.Time.UTC()
	return &value
}
