package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/Lukas-Bohez/project-one/backend-go/internal/httpx"
	"github.com/Lukas-Bohez/project-one/backend-go/internal/repository"
)

type QuestionHandler struct {
	Repo *repository.QuestionRepository
}

func (h QuestionHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.Header().Set("Allow", http.MethodGet)
		httpx.Error(w, r, http.StatusMethodNotAllowed, "method not allowed", nil)
		return
	}

	activeOnly := strings.EqualFold(r.URL.Query().Get("active_only"), "true")
	limit := 0
	if rawLimit := r.URL.Query().Get("limit"); rawLimit != "" {
		parsedLimit, err := strconv.Atoi(rawLimit)
		if err != nil || parsedLimit < 0 {
			httpx.Error(w, r, http.StatusBadRequest, "invalid limit", nil)
			return
		}
		limit = parsedLimit
	}

	questions, err := h.Repo.List(r.Context(), activeOnly, limit)
	if err != nil {
		httpx.Error(w, r, http.StatusInternalServerError, "internal server error", err)
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"count":     len(questions),
		"questions": questions,
	})
}
