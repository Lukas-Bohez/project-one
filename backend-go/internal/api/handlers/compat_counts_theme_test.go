package handlers

import (
    "encoding/json"
    "net/http/httptest"
    "testing"
)

// fakeThemeRepo is defined once, in compat_counts_test.go, and shared by
// every test in this package that needs a ThemeRepo double.

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
