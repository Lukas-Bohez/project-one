package handlers

import (
    "context"
    "encoding/json"
    "net/http"
    "net/http/httptest"
    "testing"

    "github.com/Lukas-Bohez/project-one/backend-go/internal/models"
)

// mockAnswerStore is a configurable AnswerStore test double: set only the
// *Func fields the test under test actually exercises. Calling a method
// whose func field was left nil panics with a clear message rather than a
// bare nil-pointer dereference, so a test that accidentally reaches an
// unconfigured method fails with an obvious cause.
type mockAnswerStore struct {
    listFunc       func(ctx context.Context, questionID int64, limit, offset int) ([]models.Answer, int, error)
    getFunc        func(ctx context.Context, id int64) (*models.Answer, error)
    createFunc     func(ctx context.Context, a models.Answer) (int64, error)
    updateFunc     func(ctx context.Context, a models.Answer) error
    deleteFunc     func(ctx context.Context, id int64) error
    percentageFunc func(ctx context.Context) (float64, error)
}

func (m mockAnswerStore) ListByQuestionID(ctx context.Context, questionID int64, limit, offset int) ([]models.Answer, int, error) {
    return m.listFunc(ctx, questionID, limit, offset)
}

func (m mockAnswerStore) GetByID(ctx context.Context, id int64) (*models.Answer, error) {
    return m.getFunc(ctx, id)
}

func (m mockAnswerStore) Create(ctx context.Context, a models.Answer) (int64, error) {
    if m.createFunc == nil {
        panic("mockAnswerStore.Create called but createFunc was not set")
    }
    return m.createFunc(ctx, a)
}

func (m mockAnswerStore) Update(ctx context.Context, a models.Answer) error {
    if m.updateFunc == nil {
        panic("mockAnswerStore.Update called but updateFunc was not set")
    }
    return m.updateFunc(ctx, a)
}

func (m mockAnswerStore) Delete(ctx context.Context, id int64) error {
    if m.deleteFunc == nil {
        panic("mockAnswerStore.Delete called but deleteFunc was not set")
    }
    return m.deleteFunc(ctx, id)
}

func (m mockAnswerStore) Percentage(ctx context.Context) (float64, error) {
    if m.percentageFunc == nil {
        panic("mockAnswerStore.Percentage called but percentageFunc was not set")
    }
    return m.percentageFunc(ctx)
}

func TestAnswerHandler_List(t *testing.T) {
    sample := []models.Answer{{ID: 1, QuestionID: 123, AnswerText: "A", IsCorrect: true}}
    store := mockAnswerStore{
        listFunc: func(ctx context.Context, questionID int64, limit, offset int) ([]models.Answer, int, error) {
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
        getFunc: func(ctx context.Context, id int64) (*models.Answer, error) { return expected, nil },
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
