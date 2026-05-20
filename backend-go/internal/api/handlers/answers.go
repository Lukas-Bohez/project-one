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

	answers, err := h.Repo.ListByQuestionID(r.Context(), questionID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"count":   len(answers),
		"answers": answers,
	})
}