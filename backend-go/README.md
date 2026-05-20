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
  - Optional pagination: `limit` (default 100, max 1000) and `offset` (default 0)

Examples:

List answers for question 123 with pagination:

```bash
curl "http://localhost:8081/api/v1/answers?question_id=123&limit=50&offset=0"
```

Fetch single answer by id:

```bash
curl "http://localhost:8081/api/v1/answers/456"
```

Create a new answer:

```bash
curl -X POST -H "Content-Type: application/json" \
	-d '{"questionId":123,"answer_text":"New answer","is_correct":false}' \
	"http://localhost:8081/api/v1/answers"
```

Update an answer:

```bash
curl -X PUT -H "Content-Type: application/json" \
	-d '{"answer_text":"Updated text","is_correct":true}' \
	"http://localhost:8081/api/v1/answers/456"
```

Delete an answer:

```bash
curl -X DELETE "http://localhost:8081/api/v1/answers/456"
```

Responses for the list endpoint include `count` (returned items) and `total` (matching items without pagination).

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

## CORS

The server supports CORS configuration via environment variables:

- `CORS_ALLOWED_ORIGINS` — comma-separated list of allowed origins. Use `*` to allow all origins. If unset, `*` is used.
- `CORS_ALLOW_CREDENTIALS` — set to `true` to enable `Access-Control-Allow-Credentials: true`.

Example to allow only the portfolio frontend:

```bash
export CORS_ALLOWED_ORIGINS="https://your-frontend.example.com"
export CORS_ALLOW_CREDENTIALS=true
```
