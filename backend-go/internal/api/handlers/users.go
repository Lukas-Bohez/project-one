package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/Lukas-Bohez/project-one/backend-go/internal/repository"
)

type UserHandler struct {
	Repo *repository.UserRepository
}

func (h UserHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.Header().Set("Allow", http.MethodGet)
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	limit := 0
	if rawLimit := r.URL.Query().Get("limit"); rawLimit != "" {
		parsedLimit, err := strconv.Atoi(rawLimit)
		if err != nil || parsedLimit < 0 {
			http.Error(w, "invalid limit", http.StatusBadRequest)
			return
		}
		limit = parsedLimit
	}

	users, err := h.Repo.ListPublic(r.Context(), limit)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"count": len(users),
		"users": users,
	})
}