package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/Lukas-Bohez/project-one/backend-go/internal/models"
)

type AnswerStore interface {
	ListByQuestionID(ctx context.Context, questionID int64, limit, offset int) ([]models.Answer, int, error)
	GetByID(ctx context.Context, id int64) (*models.Answer, error)
	Create(ctx context.Context, a models.Answer) (int64, error)
	Update(ctx context.Context, a models.Answer) error
	Delete(ctx context.Context, id int64) error
}

type AnswerHandler struct {
	Repo AnswerStore
}

func (h AnswerHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		// continue to list
	case http.MethodPost:
		// handle create
		var payload models.Answer
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			http.Error(w, "invalid body", http.StatusBadRequest)
			return
		}
		if payload.QuestionID == 0 || payload.AnswerText == "" {
			http.Error(w, "question_id and answer_text required", http.StatusBadRequest)
			return
		}
		id, err := h.Repo.Create(r.Context(), payload)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Location", "/api/v1/answers/"+strconv.FormatInt(id, 10))
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(map[string]any{"id": id})
		return
	default:
		w.Header().Set("Allow", "GET, POST")
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