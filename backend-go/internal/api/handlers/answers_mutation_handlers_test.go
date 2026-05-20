package handlers

import (
    "bytes"
    "context"
    "encoding/json"
    "net/http"
    "net/http/httptest"
    "strconv"
    "testing"

    "github.com/Lukas-Bohez/project-one/backend-go/internal/models"
)

type mockAllStore struct {
    listFunc   func(ctx context.Context, questionID int64, limit, offset int) ([]models.Answer, int, error)
    getFunc    func(ctx context.Context, id int64) (*models.Answer, error)
    createFunc func(ctx context.Context, a models.Answer) (int64, error)
    updateFunc func(ctx context.Context, a models.Answer) error
    deleteFunc func(ctx context.Context, id int64) error
}

func (m mockAllStore) ListByQuestionID(ctx context.Context, questionID int64, limit, offset int) ([]models.Answer, int, error) {
    if m.listFunc != nil {
        return m.listFunc(ctx, questionID, limit, offset)
    }
    return nil, 0, nil
}

func (m mockAllStore) GetByID(ctx context.Context, id int64) (*models.Answer, error) {
    if m.getFunc != nil {
        return m.getFunc(ctx, id)
    }
    return nil, nil
}

func (m mockAllStore) Create(ctx context.Context, a models.Answer) (int64, error) {
    if m.createFunc != nil {
        return m.createFunc(ctx, a)
    }
    return 0, nil
}

func (m mockAllStore) Update(ctx context.Context, a models.Answer) error {
    if m.updateFunc != nil {
        return m.updateFunc(ctx, a)
    }
    return nil
}

func (m mockAllStore) Delete(ctx context.Context, id int64) error {
    if m.deleteFunc != nil {
        return m.deleteFunc(ctx, id)
    }
    return nil
}

func TestAnswerHandler_Create(t *testing.T) {
    store := mockAllStore{
        createFunc: func(ctx context.Context, a models.Answer) (int64, error) {
            if a.QuestionID == 0 || a.AnswerText == "" {
                t.Fatalf("invalid payload: %+v", a)
            }
            return 77, nil
        },
    }

    h := AnswerHandler{Repo: store}

    payload := map[string]any{"questionId": 123, "answer_text": "New","is_correct": false}
    b, _ := json.Marshal(payload)
    req := httptest.NewRequest(http.MethodPost, "/api/v1/answers", bytes.NewReader(b))
    req.Header.Set("Content-Type", "application/json")
    rr := httptest.NewRecorder()
    h.ServeHTTP(rr, req)

    if rr.Code != http.StatusCreated {
        t.Fatalf("expected 201 got %d body=%s", rr.Code, rr.Body.String())
    }
    if loc := rr.Header().Get("Location"); loc != "/api/v1/answers/77" {
        t.Fatalf("unexpected Location: %s", loc)
    }
    var out map[string]any
    if err := json.NewDecoder(rr.Body).Decode(&out); err != nil {
        t.Fatalf("decode: %v", err)
    }
    if idf, ok := out["id"]; !ok || int64(idf.(float64)) != 77 {
        t.Fatalf("unexpected id in body: %+v", out)
    }
}

func TestAnswerByIDHandler_UpdateAndDelete(t *testing.T) {
    updated := models.Answer{ID: 77, AnswerText: "Updated", IsCorrect: true}
    store := mockAllStore{
        updateFunc: func(ctx context.Context, a models.Answer) error {
            if a.ID != 77 {
                t.Fatalf("expected id 77, got %d", a.ID)
            }
            return nil
        },
        deleteFunc: func(ctx context.Context, id int64) error {
            if id != 77 {
                t.Fatalf("unexpected delete id %d", id)
            }
            return nil
        },
        getFunc: func(ctx context.Context, id int64) (*models.Answer, error) {
            if id == 77 {
                return &updated, nil
            }
            return nil, nil
        },
    }

    h := AnswerByIDHandler{Repo: store}

    // Update
    payload := map[string]any{"answer_text": updated.AnswerText, "is_correct": updated.IsCorrect}
    b, _ := json.Marshal(payload)
    req := httptest.NewRequest(http.MethodPut, "/api/v1/answers/77", bytes.NewReader(b))
    req.Header.Set("Content-Type", "application/json")
    rr := httptest.NewRecorder()
    h.ServeHTTP(rr, req)
    if rr.Code != http.StatusOK {
        t.Fatalf("expected 200 got %d body=%s", rr.Code, rr.Body.String())
    }
    var got models.Answer
    if err := json.NewDecoder(rr.Body).Decode(&got); err != nil {
        t.Fatalf("decode: %v", err)
    }
    if got.ID != 77 || got.AnswerText != updated.AnswerText {
        t.Fatalf("unexpected updated body: %+v", got)
    }

    // Delete
    req2 := httptest.NewRequest(http.MethodDelete, "/api/v1/answers/77", nil)
    rr2 := httptest.NewRecorder()
    h.ServeHTTP(rr2, req2)
    if rr2.Code != http.StatusNoContent {
        t.Fatalf("expected 204 got %d body=%s", rr2.Code, rr2.Body.String())
    }

    // Confirm GET still returns the item via getFunc
    req3 := httptest.NewRequest(http.MethodGet, "/api/v1/answers/77", nil)
    rr3 := httptest.NewRecorder()
    h.ServeHTTP(rr3, req3)
    if rr3.Code != http.StatusOK {
        t.Fatalf("expected 200 got %d body=%s", rr3.Code, rr3.Body.String())
    }
    var g models.Answer
    if err := json.NewDecoder(rr3.Body).Decode(&g); err != nil {
        t.Fatalf("decode: %v", err)
    }
    if g.ID != 77 {
        t.Fatalf("unexpected get response id %d", g.ID)
    }
    // location path helper sanity
    if _, err := strconv.ParseInt("77", 10, 64); err != nil {
        t.Fatalf("parse error: %v", err)
    }
}
