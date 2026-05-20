package handlers

import (
    "context"
    "encoding/json"
    "net/http"
    "path"
    "strconv"

    "github.com/Lukas-Bohez/project-one/backend-go/internal/models"
)

type AnswerByIDHandler struct {
    Repo interface {
        GetByID(ctx context.Context, id int64) (*models.Answer, error)
    }
}

func (h AnswerByIDHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodGet {
        w.Header().Set("Allow", http.MethodGet)
        http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
        return
    }

    // Extract ID from path, expecting pattern /api/v1/answers/{id}
    idStr := path.Base(r.URL.Path)
    if idStr == "" || idStr == "answers" {
        http.Error(w, "answer id required", http.StatusBadRequest)
        return
    }
    id, err := strconv.ParseInt(idStr, 10, 64)
    if err != nil || id <= 0 {
        http.Error(w, "invalid answer id", http.StatusBadRequest)
        return
    }

    item, err := h.Repo.GetByID(r.Context(), id)
    if err != nil {
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }
    if item == nil {
        http.Error(w, "not found", http.StatusNotFound)
        return
    }

    w.Header().Set("Content-Type", "application/json")
    _ = json.NewEncoder(w).Encode(item)
}
