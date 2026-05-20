package handlers

import (
    "encoding/json"
    "net/http/httptest"
    "testing"
    "context"
)

type fakeThemeRepo struct{ Count int }
func (f fakeThemeRepo) QuestionCount(ctx context.Context, themeID int64) (int, error) { return f.Count, nil }

func TestThemeQuestionCountHandler(t *testing.T) {
    h := ThemeQuestionCountHandler{Repo: fakeThemeRepo{Count: 12}}
    req := httptest.NewRequest("GET", "/api/v1/themes/5/question_count/", nil)
    rr := httptest.NewRecorder()
    h.ServeHTTP(rr, req)
    if rr.Code != 200 {
        t.Fatalf("expected 200, got %d", rr.Code)
    }
    var resp map[string]int
    if err := json.NewDecoder(rr.Body).Decode(&resp); err != nil {
        t.Fatalf("decode: %v", err)
    }
    if resp["count"] != 12 { t.Fatalf("unexpected count: %v", resp) }
}
