package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"time"
)

type HealthHandler struct {
	DB *sql.DB
}

type healthResponse struct {
	OK        bool   `json:"ok"`
	Service   string `json:"service"`
	Database  string `json:"database"`
	Timestamp string `json:"timestamp"`
}

func (h HealthHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.Header().Set("Allow", http.MethodGet)
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	status := "not configured"
	if h.DB != nil {
		if err := h.DB.PingContext(r.Context()); err == nil {
			status = "ok"
		} else {
			status = err.Error()
		}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(healthResponse{
		OK:        status == "ok",
		Service:   "quizthespire-go",
		Database:  status,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	})
}
