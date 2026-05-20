package handlers

import (
    "context"
    "encoding/json"
    "net/http/httptest"
    "testing"

    "github.com/Lukas-Bohez/project-one/backend-go/internal/models"
)

type fakeAnswerStore struct {
    Answers []models.Answer
    Total   int
}

func (f fakeAnswerStore) ListByQuestionID(ctx context.Context, questionID int64, limit, offset int) ([]models.Answer, int, error) {
    return f.Answers, f.Total, nil
}
func (f fakeAnswerStore) GetByID(ctx context.Context, id int64) (*models.Answer, error) { return nil, nil }
func (f fakeAnswerStore) Create(ctx context.Context, a models.Answer) (int64, error) { return 0, nil }
func (f fakeAnswerStore) Update(ctx context.Context, a models.Answer) error { return nil }
func (f fakeAnswerStore) Delete(ctx context.Context, id int64) error { return nil }

func TestQuestionsAnswersHandler_OK(t *testing.T) {
    sample := []models.Answer{
        {ID: 1, QuestionID: 123, AnswerText: "A", IsCorrect: true},
        {ID: 2, QuestionID: 123, AnswerText: "B", IsCorrect: false},
    }
    h := QuestionsAnswersHandler{Repo: fakeAnswerStore{Answers: sample, Total: 2}}

    req := httptest.NewRequest("GET", "/api/v1/questions/123/answers", nil)
    rr := httptest.NewRecorder()
    h.ServeHTTP(rr, req)

    if rr.Code != 200 {
        t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
    }

    var resp struct {
        Count   int             `json:"count"`
        Total   int             `json:"total"`
        Answers []models.Answer `json:"answers"`
    }
    if err := json.NewDecoder(rr.Body).Decode(&resp); err != nil {
        t.Fatalf("decode failed: %v", err)
    }
    if resp.Total != 2 || resp.Count != 2 || len(resp.Answers) != 2 {
        t.Fatalf("unexpected payload: %+v", resp)
    }
}
