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
	if !strings.Contains(body, `"count":0`) {
		t.Fatalf("expected count payload, got %s", body)
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
}package handlers

import (
    "net/http/httptest"
    "testing"
)

func TestArticlesHandler_List(t *testing.T) {
    h := ArticlesHandler{}
    req := httptest.NewRequest("GET", "/api/v1/articles", nil)
    rr := httptest.NewRecorder()
    h.ServeHTTP(rr, req)
    if rr.Code != 200 {
        t.Fatalf("expected 200, got %d", rr.Code)
    }
}

func TestBanIPHandler_Post(t *testing.T) {
    h := BanIPHandler{}
    req := httptest.NewRequest("POST", "/api/v1/ban-ip", nil)
    rr := httptest.NewRecorder()
    h.ServeHTTP(rr, req)
    if rr.Code != 200 {
        t.Fatalf("expected 200, got %d", rr.Code)
    }
}
