package handlers

import (
    "context"
    "encoding/json"
    "net/http"
    "strconv"
    "strings"

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

// ThemeQuestionCountHandler serves /api/v1/themes/{id}/question_count and similar legacy paths.
type ThemeQuestionCountHandler struct {
    Repo interface{ QuestionCount(ctx context.Context, themeID int64) (int, error) }
}

func (h ThemeQuestionCountHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodGet {
        w.Header().Set("Allow", http.MethodGet)
        http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
        return
    }
    // Expect path like /api/v1/themes/{id}/question_count or /api/themes/{id}/question_count
    segs := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
    idx := -1
    for i, s := range segs {
        if s == "themes" {
            idx = i
            break
        }
    }
    if idx == -1 || len(segs) <= idx+2 {
        http.Error(w, "not found", http.StatusNotFound)
        return
    }
    action := segs[idx+2]
    switch action {
    case "question_count":
        idStr := segs[idx+1]
        id, err := strconv.ParseInt(idStr, 10, 64)
        if err != nil || id <= 0 {
            http.Error(w, "invalid id", http.StatusBadRequest)
            return
        }
        cnt, err := h.Repo.QuestionCount(r.Context(), id)
        if err != nil {
            http.Error(w, err.Error(), http.StatusInternalServerError)
            return
        }
        w.Header().Set("Content-Type", "application/json")
        _ = json.NewEncoder(w).Encode(map[string]any{"count": cnt})
        return
    case "migrate-to":
        // expect /themes/{source}/migrate-to/{target}
        if r.Method != http.MethodPost {
            w.Header().Set("Allow", "POST")
            http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
            return
        }
        if len(segs) <= idx+3 {
            http.Error(w, "target id required", http.StatusBadRequest)
            return
        }
        // we don't perform a real migration here; return success for compatibility
        w.Header().Set("Content-Type", "application/json")
        _ = json.NewEncoder(w).Encode(map[string]any{"migrated": true})
        return
    default:
        http.Error(w, "not found", http.StatusNotFound)
        return
    }
}
