package handlers

import (
    "context"
    "encoding/json"
    "net/http"

    "github.com/Lukas-Bohez/project-one/backend-go/internal/models"
)

// UsersActiveHandler returns JSON {count: N} for active users.
type UsersActiveHandler struct {
    Repo interface{ ActiveCount(ctx context.Context) (int, error) }
}

func (h UsersActiveHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodGet {
        w.Header().Set("Allow", http.MethodGet)
        http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
        return
    }
    cnt, err := h.Repo.ActiveCount(r.Context())
    if err != nil {
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }
    w.Header().Set("Content-Type", "application/json")
    _ = json.NewEncoder(w).Encode(map[string]any{"count": cnt})
}

// QuestionsActiveHandler returns JSON {count: N} for active questions.
type QuestionsActiveHandler struct {
    Repo interface{ ActiveCount(ctx context.Context) (int, error) }
}

func (h QuestionsActiveHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodGet {
        w.Header().Set("Allow", http.MethodGet)
        http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
        return
    }
    cnt, err := h.Repo.ActiveCount(r.Context())
    if err != nil {
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }
    w.Header().Set("Content-Type", "application/json")
    _ = json.NewEncoder(w).Encode(map[string]any{"count": cnt})
}

// AnswersPercentageHandler returns a raw number (percentage) as JSON.
type AnswersPercentageHandler struct {
    Repo interface{ Percentage(ctx context.Context) (float64, error) }
}

func (h AnswersPercentageHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodGet {
        w.Header().Set("Allow", http.MethodGet)
        http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
        return
    }
    perc, err := h.Repo.Percentage(r.Context())
    if err != nil {
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }
    w.Header().Set("Content-Type", "application/json")
    _ = json.NewEncoder(w).Encode(perc)
}

// small compile-time type usage to avoid import warnings
var _ = models.Answer{}
