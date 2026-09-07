package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/Lukas-Bohez/project-one/backend-go/internal/httpx"
	"github.com/Lukas-Bohez/project-one/backend-go/internal/models"
	"github.com/Lukas-Bohez/project-one/backend-go/internal/repository"
)

// QuestionListCompatHandler serves GET /api/v1/questions(/) in the legacy
// Python API's shape: a bare JSON array (no {"count":..,"questions":..}
// wrapper). study.js calls questions.map() directly on the response body.
type QuestionListCompatHandler struct {
	Repo *repository.QuestionRepository
}

func (h QuestionListCompatHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.Header().Set("Allow", http.MethodGet)
		httpx.Error(w, r, http.StatusMethodNotAllowed, "method not allowed", nil)
		return
	}

	activeOnly := strings.EqualFold(r.URL.Query().Get("active_only"), "true")
	limit := 0
	if rawLimit := r.URL.Query().Get("limit"); rawLimit != "" {
		parsedLimit, err := strconv.Atoi(rawLimit)
		if err != nil || parsedLimit < 0 {
			httpx.Error(w, r, http.StatusBadRequest, "invalid limit", nil)
			return
		}
		limit = parsedLimit
	}

	questions, err := h.Repo.List(r.Context(), activeOnly, limit)
	if err != nil {
		httpx.Error(w, r, http.StatusInternalServerError, "internal server error", err)
		return
	}
	if questions == nil {
		questions = []models.Question{} // never serialize null for a list
	}

	httpx.JSON(w, http.StatusOK, questions)
}

// ThemeListCompatHandler serves GET /api/v1/themes(/) as a bare JSON array,
// matching the legacy Python API shape consumed by study.js.
type ThemeListCompatHandler struct {
	Repo *repository.ThemeRepository
}

func (h ThemeListCompatHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.Header().Set("Allow", http.MethodGet)
		httpx.Error(w, r, http.StatusMethodNotAllowed, "method not allowed", nil)
		return
	}

	activeOnly := strings.EqualFold(r.URL.Query().Get("active_only"), "true")
	themes, err := h.Repo.List(r.Context(), activeOnly)
	if err != nil {
		httpx.Error(w, r, http.StatusInternalServerError, "internal server error", err)
		return
	}
	if themes == nil {
		themes = []models.Theme{}
	}

	httpx.JSON(w, http.StatusOK, themes)
}

// frontends that fetch a single theme with a trailing slash (e.g. study.js).
type ThemeByIDHandler struct {
	Repo *repository.ThemeRepository
}

func (h ThemeByIDHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.Header().Set("Allow", http.MethodGet)
		httpx.Error(w, r, http.StatusMethodNotAllowed, "method not allowed", nil)
		return
	}

	segs := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	idx := -1
	for i, s := range segs {
		if s == "themes" {
			idx = i
			break
		}
	}
	if idx == -1 || len(segs) <= idx+1 {
		httpx.Error(w, r, http.StatusNotFound, "not found", nil)
		return
	}

	id, err := strconv.ParseInt(segs[idx+1], 10, 64)
	if err != nil || id <= 0 {
		httpx.Error(w, r, http.StatusBadRequest, "invalid theme id", nil)
		return
	}

	theme, err := h.Repo.GetByID(r.Context(), id)
	if err != nil {
		httpx.Error(w, r, http.StatusInternalServerError, "internal server error", err)
		return
	}
	if theme == nil {
		httpx.Error(w, r, http.StatusNotFound, "theme not found", nil)
		return
	}

	httpx.JSON(w, http.StatusOK, theme)
}
