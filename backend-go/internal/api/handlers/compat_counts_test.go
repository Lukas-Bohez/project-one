package handlers

import (
    "encoding/json"
    "net/http/httptest"
    "testing"

    "context"
)

type fakeUsersRepo struct{ Count int }
func (f fakeUsersRepo) ActiveCount(ctx context.Context) (int, error) { return f.Count, nil }

func TestUsersActiveHandler(t *testing.T) {
    h := UsersActiveHandler{Repo: fakeUsersRepo{Count: 7}}
    req := httptest.NewRequest("GET", "/api/users/active/count", nil)
    rr := httptest.NewRecorder()
    h.ServeHTTP(rr, req)
    if rr.Code != 200 {
        t.Fatalf("expected 200, got %d", rr.Code)
    }
    var resp map[string]int
    if err := json.NewDecoder(rr.Body).Decode(&resp); err != nil {
        t.Fatalf("decode: %v", err)
    }
    if resp["count"] != 7 { t.Fatalf("unexpected count: %v", resp) }
}

type fakeQuestionsRepo struct{ Count int }
func (f fakeQuestionsRepo) ActiveCount(ctx context.Context) (int, error) { return f.Count, nil }

func TestQuestionsActiveHandler(t *testing.T) {
    h := QuestionsActiveHandler{Repo: fakeQuestionsRepo{Count: 3}}
    req := httptest.NewRequest("GET", "/api/questions/active/count", nil)
    rr := httptest.NewRecorder()
    h.ServeHTTP(rr, req)
    if rr.Code != 200 {
        t.Fatalf("expected 200, got %d", rr.Code)
    }
    var resp map[string]int
    if err := json.NewDecoder(rr.Body).Decode(&resp); err != nil {
        t.Fatalf("decode: %v", err)
    }
    if resp["count"] != 3 { t.Fatalf("unexpected count: %v", resp) }
}

type fakeAnswersRepo struct{ P float64 }
func (f fakeAnswersRepo) Percentage(ctx context.Context) (float64, error) { return f.P, nil }

func TestAnswersPercentageHandler(t *testing.T) {
    h := AnswersPercentageHandler{Repo: fakeAnswersRepo{P: 42.5}}
    req := httptest.NewRequest("GET", "/api/v1/answers/percentage", nil)
    rr := httptest.NewRecorder()
    h.ServeHTTP(rr, req)
    if rr.Code != 200 {
        t.Fatalf("expected 200, got %d", rr.Code)
    }
    var v float64
    if err := json.NewDecoder(rr.Body).Decode(&v); err != nil {
        t.Fatalf("decode: %v", err)
    }
    if v != 42.5 { t.Fatalf("unexpected value: %v", v) }
}
