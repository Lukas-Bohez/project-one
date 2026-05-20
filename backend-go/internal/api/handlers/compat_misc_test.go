package handlers

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
