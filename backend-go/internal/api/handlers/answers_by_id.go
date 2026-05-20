package handlers

import (
    "context"
    "encoding/json"
    "net/http"
    "path"
    "strconv"
    "database/sql"

    "github.com/Lukas-Bohez/project-one/backend-go/internal/models"
)

type AnswerByIDHandler struct {
    Repo interface {
        GetByID(ctx context.Context, id int64) (*models.Answer, error)
    }
}

func (h AnswerByIDHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
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

    switch r.Method {
    case http.MethodGet:
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
        return
    case http.MethodPut:
        var payload models.Answer
        if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
            http.Error(w, "invalid body", http.StatusBadRequest)
            return
        }
        payload.ID = id
        if updater, ok := h.Repo.(interface{ Update(ctx context.Context, a models.Answer) error }); ok {
            if err := updater.Update(r.Context(), payload); err != nil {
                if err == sql.ErrNoRows {
                    http.Error(w, "not found", http.StatusNotFound)
                    return
                }
                http.Error(w, err.Error(), http.StatusInternalServerError)
                return
            }
            w.Header().Set("Content-Type", "application/json")
            _ = json.NewEncoder(w).Encode(payload)
            return
        }
        http.Error(w, "update not supported", http.StatusNotImplemented)
        return
    case http.MethodDelete:
        if deleter, ok := h.Repo.(interface{ Delete(ctx context.Context, id int64) error }); ok {
            if err := deleter.Delete(r.Context(), id); err != nil {
                if err == sql.ErrNoRows {
                    http.Error(w, "not found", http.StatusNotFound)
                    return
                }
                http.Error(w, err.Error(), http.StatusInternalServerError)
                return
            }
            w.WriteHeader(http.StatusNoContent)
            return
        }
        http.Error(w, "delete not supported", http.StatusNotImplemented)
        return
    default:
        w.Header().Set("Allow", "GET, PUT, DELETE")
        http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
        return
    }
}
