package handlers

import (
    "context"
    "encoding/json"
    "net/http"
    "strconv"
    "strings"

    "github.com/Lukas-Bohez/project-one/backend-go/internal/models"
)

// QuestionsAnswersHandler provides a compatibility endpoint for frontend callers
// expecting GET /api/v1/questions/{id}/answers. It delegates to the AnswerStore
// ListByQuestionID method and returns JSON with `answers`, `count` and `total`.
type QuestionsAnswersHandler struct {
    Repo AnswerStore
}

func (h QuestionsAnswersHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodGet {
        w.Header().Set("Allow", "GET")
        http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
        return
    }

    // Expect path like /api/v1/questions/{id}/answers or with trailing slash
    p := strings.TrimPrefix(r.URL.Path, "/api/v1/questions/")
    parts := strings.Split(strings.Trim(p, "/"), "/")
    if len(parts) < 2 || parts[1] != "answers" {
        http.Error(w, "not found", http.StatusNotFound)
        return
    }

    idStr := parts[0]
    qid, err := strconv.ParseInt(idStr, 10, 64)
    if err != nil || qid <= 0 {
        http.Error(w, "invalid question id", http.StatusBadRequest)
        return
    }

    // Parse optional pagination
    limit := 100
    offset := 0
    if raw := r.URL.Query().Get("limit"); raw != "" {
        if v, err := strconv.Atoi(raw); err == nil && v > 0 {
            if v > 1000 { v = 1000 }
            limit = v
        }
    }
    if raw := r.URL.Query().Get("offset"); raw != "" {
        if v, err := strconv.Atoi(raw); err == nil && v >= 0 {
            offset = v
        }
    }

    answers, total, err := h.Repo.ListByQuestionID(r.Context(), qid, limit, offset)
    if err != nil {
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }

    w.Header().Set("Content-Type", "application/json")
    _ = json.NewEncoder(w).Encode(map[string]any{
        "count":   len(answers),
        "total":   total,
        "answers": answers,
    })
}

// Ensure compile-time compatibility with the Answer type
var _ = models.Answer{}
