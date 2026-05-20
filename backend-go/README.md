# Backend Go Scaffold

This directory contains the first Go backend slice for the `project-one` migration.

## What is included

- `cmd/server`: entrypoint for the new Go HTTP server
- `internal/config`: environment parsing and port/database configuration
- `internal/db`: MySQL connection helpers
- `internal/api/handlers`: basic HTTP handlers
- `internal/models`: shared data structs that mirror the Python backend models
- `internal/repository`: MySQL-backed read repositories for quiz data

## Endpoints

- `GET /healthz` - server and database health check
- `GET /api/v1/questions` - list quiz questions, optional `active_only=true` and `limit=<n>`
- `GET /api/v1/answers?question_id=<id>` - list answers for a question
 - `GET /api/v1/answers/{id}` - fetch a single answer by id
- `GET /api/v1/themes` - list quiz themes, optional `active_only=true`
- `GET /api/v1/users` - list public user records, optional `limit=<n>`

## Run

```bash
cd backend-go
go mod tidy
go run ./cmd/server
```

## Environment

The Go server reads the same database contract as the Python backend:

- `DATABASE_URL`
- or `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`

The HTTP server listens on `PORT` and defaults to `8081` so it can run beside the Python backend.
