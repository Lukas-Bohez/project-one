package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/Lukas-Bohez/project-one/backend-go/internal/repository"
)

type AnswerHandler struct {
	Repo *repository.AnswerRepository
}

func (h AnswerHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.Header().Set("Allow", http.MethodGet)
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	rawQuestionID := r.URL.Query().Get("question_id")
	if rawQuestionID == "" {
		http.Error(w, "question_id is required", http.StatusBadRequest)
		return
	}
	questionID, err := strconv.ParseInt(rawQuestionID, 10, 64)
	if err != nil || questionID <= 0 {
		http.Error(w, "invalid question_id", http.StatusBadRequest)
		return
	}

	// Parse pagination params
	limit := 100
	offset := 0
	if raw := r.URL.Query().Get("limit"); raw != "" {
		if v, err := strconv.Atoi(raw); err == nil && v > 0 {
			if v > 1000 {
				v = 1000
			}
			limit = v
		}
	}
	if raw := r.URL.Query().Get("offset"); raw != "" {
		if v, err := strconv.Atoi(raw); err == nil && v >= 0 {
			offset = v
		}
	}

	answers, total, err := h.Repo.ListByQuestionID(r.Context(), questionID, limit, offset)
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