package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/Lukas-Bohez/project-one/backend-go/internal/httpx"
)

// QuizLoginHandler returns a stable token payload for legacy manage login flows.
type QuizLoginHandler struct{}

func (QuizLoginHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.Header().Set("Allow", "POST")
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"token":        "dev-token",
		"access_token": "dev-token",
		"user_id":      1,
		"id":           1,
	})
}

// QuizUserCheckHandler returns a stable user id for legacy business setup flows.
type QuizUserCheckHandler struct{}

func (QuizUserCheckHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.Header().Set("Allow", "POST")
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"id": 1, "exists": true})
}

// ShutdownHandler is not implemented yet — returns 501 so callers do not
// believe the server actually shut down. Wire up graceful shutdown (drain
// connections, close DB pools, run deferred work) before enabling it.
type ShutdownHandler struct{}

func (ShutdownHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.Header().Set("Allow", "POST")
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	httpx.Error(w, r, http.StatusNotImplemented, "Shutdown is not implemented yet", nil)
}

// ArticlesHandler provides minimal compatibility for /api/v1/articles and related paths.
type ArticlesHandler struct{}

func (ArticlesHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// support list and basic article operations without DB changes
	path := strings.TrimPrefix(r.URL.Path, "/api/v1/articles")
	if path == "" || path == "/" || strings.HasPrefix(path, "/?") {
		// list
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"count": 0, "articles": []any{}})
		return
	}
	if strings.HasPrefix(path, "/stats") {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"count":           0,
			"articles":        []any{},
			"views":           0,
			"total_articles":  0,
			"active_articles": 0,
			"published":       0,
			"draft":           0,
			"archived":        0,
		})
		return
	}

	// paths like /{id}/ or /by-story/{id}/ or /{id}/status/
	// respond with simple success payloads for mutating requests
	if strings.HasPrefix(path, "/by-story/") {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"count": 0, "articles": []any{}})
		return
	}

	if strings.HasSuffix(path, "/status/") {
		// allow PATCH/POST for status toggles
		if r.Method == http.MethodPatch || r.Method == http.MethodPost {
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]any{"ok": true})
			return
		}
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// article detail paths
	if r.Method == http.MethodGet {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{})
		return
	}
	if r.Method == http.MethodPost || r.Method == http.MethodPatch || r.Method == http.MethodDelete {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"ok": true})
		return
	}
	w.Header().Set("Allow", "GET, POST, PATCH, DELETE")
	http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
}

// StoriesHandler provides minimal compatibility for /api/v1/stories endpoints.
type StoriesHandler struct{}

func (StoriesHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// support basic CRUD with noop responses
	if r.Method == http.MethodGet {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode([]any{})
		return
	}
	if strings.HasPrefix(r.URL.Path, "/api/v1/stories/create-if-not-exists") && r.Method == http.MethodPost {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"ok": true})
		return
	}
	if r.Method == http.MethodPost || r.Method == http.MethodPatch || r.Method == http.MethodDelete {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"ok": true})
		return
	}
	w.Header().Set("Allow", "GET, POST, PATCH, DELETE")
	http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
}

// BanIPHandler is not implemented yet — returns 501. The real handler needs a
// firewall/blocklist seam (and a decision on whether IP bans live in nginx or
// the app layer); until that is wired up, refuse the call rather than lie.
type BanIPHandler struct{}

func (BanIPHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.Header().Set("Allow", "POST")
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	httpx.Error(w, r, http.StatusNotImplemented, "Ban-IP is not implemented yet", nil)
}

// ThemeMigrateHandler is a noop success response for theme migrate endpoints.
type ThemeMigrateHandler struct{}

func (ThemeMigrateHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.Header().Set("Allow", "POST")
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"migrated": true})
}
