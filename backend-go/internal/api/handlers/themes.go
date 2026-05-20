package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/Lukas-Bohez/project-one/backend-go/internal/repository"
)

type ThemeHandler struct {
	Repo *repository.ThemeRepository
}

func (h ThemeHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.Header().Set("Allow", http.MethodGet)
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	activeOnly := strings.EqualFold(r.URL.Query().Get("active_only"), "true")
	themes, err := h.Repo.List(r.Context(), activeOnly)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"count":  len(themes),
		"themes": themes,
	})
}
