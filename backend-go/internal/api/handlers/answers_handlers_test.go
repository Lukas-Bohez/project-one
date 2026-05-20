package handlers

import (
    "context"
    "encoding/json"
    "net/http"
    "net/http/httptest"
    "testing"

    "github.com/Lukas-Bohez/project-one/backend-go/internal/models"
)

type mockAnswerStore struct {
    listFunc func(ctx context.Context, questionID int64, limit, offset int) ([]models.Answer, int, error)
    getFunc  func(ctx context.Context, id int64) (*models.Answer, error)
}

func (m mockAnswerStore) ListByQuestionID(ctx context.Context, questionID int64, limit, offset int) ([]models.Answer, int, error) {
    return m.listFunc(ctx, questionID, limit, offset)
}

func (m mockAnswerStore) GetByID(ctx context.Context, id int64) (*models.Answer, error) {
    return m.getFunc(ctx, id)
}

func TestAnswerHandler_List(t *testing.T) {
    sample := []models.Answer{{ID: 1, QuestionID: 123, AnswerText: "A", IsCorrect: true}}
    store := mockAnswerStore{
        listFunc: func(questionID int64, limit, offset int) ([]models.Answer, int, error) {
            return sample, 1, nil
        },
    }

    h := AnswerHandler{Repo: store}

    req := httptest.NewRequest(http.MethodGet, "/api/v1/answers?question_id=123", nil)
    rr := httptest.NewRecorder()
    h.ServeHTTP(rr, req)

    if rr.Code != http.StatusOK {
        t.Fatalf("expected 200 got %d", rr.Code)
    }
    var out struct {
        Count   int             `json:"count"`
        Total   int             `json:"total"`
        Answers []models.Answer `json:"answers"`
    }
    if err := json.NewDecoder(rr.Body).Decode(&out); err != nil {
        t.Fatalf("decode: %v", err)
    }
    if out.Total != 1 || out.Count != 1 || len(out.Answers) != 1 {
        t.Fatalf("unexpected response: %+v", out)
    }
}

func TestAnswerByIDHandler_Get(t *testing.T) {
    expected := &models.Answer{ID: 5, QuestionID: 1, AnswerText: "B", IsCorrect: false}
    store := mockAnswerStore{
        getFunc: func(id int64) (*models.Answer, error) { return expected, nil },
    }

    h := AnswerByIDHandler{Repo: store}
    req := httptest.NewRequest(http.MethodGet, "/api/v1/answers/5", nil)
    rr := httptest.NewRecorder()
    h.ServeHTTP(rr, req)
    if rr.Code != http.StatusOK {
        t.Fatalf("expected 200 got %d", rr.Code)
    }
    var got models.Answer
    if err := json.NewDecoder(rr.Body).Decode(&got); err != nil {
        t.Fatalf("decode: %v", err)
    }
    if got.ID != expected.ID {
        t.Fatalf("expected id %d got %d", expected.ID, got.ID)
    }
}
