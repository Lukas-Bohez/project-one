package handlers

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestArticlesHandlerStatsCompat(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/v1/articles/stats/", nil)
	rec := httptest.NewRecorder()

	ArticlesHandler{}.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rec.Code)
	}
	body := rec.Body.String()
	if !strings.Contains(body, `"total_articles":0`) || !strings.Contains(body, `"active_articles":0`) {
		t.Fatalf("expected count payload, got %s", rec.Body.String())
	}
}

func TestStoriesHandlerCreateIfNotExistsCompat(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/v1/stories/create-if-not-exists", strings.NewReader(`{}`))
	rec := httptest.NewRecorder()

	StoriesHandler{}.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), `"ok":true`) {
		t.Fatalf("expected ok payload, got %s", rec.Body.String())
	}
}

func TestStoriesHandlerListCompat(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/v1/stories/", nil)
	rec := httptest.NewRecorder()

	StoriesHandler{}.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rec.Code)
	}
	if strings.TrimSpace(rec.Body.String()) != "[]" {
		t.Fatalf("expected empty array payload, got %s", rec.Body.String())
	}
}

func TestQuizLoginHandlerCompat(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/v1/quiz/login", strings.NewReader(`{"email":"a@example.com"}`))
	rec := httptest.NewRecorder()

	QuizLoginHandler{}.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rec.Code)
	}
	body := rec.Body.String()
	if !strings.Contains(body, `"token":"dev-token"`) || !strings.Contains(body, `"user_id":1`) {
		t.Fatalf("unexpected payload: %s", body)
	}
}

func TestQuizUserCheckHandlerCompat(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/v1/quiz/user/check", strings.NewReader(`{"email":"a@example.com"}`))
	rec := httptest.NewRecorder()

	QuizUserCheckHandler{}.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), `"id":1`) {
		t.Fatalf("unexpected payload: %s", rec.Body.String())
	}
}

// Shutdown is intentionally not implemented yet - it must not pretend to
// succeed, so the handler returns 501 with a clear message rather than a
// 200 that implies the server stopped.
func TestShutdownHandlerCompat(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/shutdown", nil)
	rec := httptest.NewRecorder()

	ShutdownHandler{}.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotImplemented {
		t.Fatalf("expected status 501, got %d", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), `"error":"Shutdown is not implemented yet"`) {
		t.Fatalf("unexpected payload: %s", rec.Body.String())
	}
}
