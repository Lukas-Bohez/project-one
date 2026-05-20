package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/Lukas-Bohez/project-one/backend-go/internal/api/handlers"
	"github.com/Lukas-Bohez/project-one/backend-go/internal/config"
	"github.com/Lukas-Bohez/project-one/backend-go/internal/db"
	"github.com/Lukas-Bohez/project-one/backend-go/internal/repository"
)

func main() {
	cfg := config.Load()

	mysqlDB, err := db.Open(cfg.DB)
	if err != nil {
		log.Printf("mysql disabled: %v", err)
	}
	if mysqlDB != nil {
		defer mysqlDB.Close()
	}

	var questionRepo *repository.QuestionRepository
	var answerRepo *repository.AnswerRepository
	var themeRepo *repository.ThemeRepository
	var userRepo *repository.UserRepository
	if mysqlDB != nil {
		questionRepo = repository.NewQuestionRepository(mysqlDB.DB)
		answerRepo = repository.NewAnswerRepository(mysqlDB.DB)
		themeRepo = repository.NewThemeRepository(mysqlDB.DB)
		userRepo = repository.NewUserRepository(mysqlDB.DB)
	}

	mux := http.NewServeMux()
	if mysqlDB != nil {
		mux.Handle("/healthz", handlers.HealthHandler{DB: mysqlDB.DB})
	} else {
		mux.Handle("/healthz", handlers.HealthHandler{})
	}
	if questionRepo != nil {
		mux.Handle("/api/v1/questions", handlers.QuestionHandler{Repo: questionRepo})
		// Non-v1 alias for legacy frontend
		mux.Handle("/api/questions", handlers.QuestionHandler{Repo: questionRepo})
		mux.Handle("/api/questions/", handlers.QuestionHandler{Repo: questionRepo})
		// legacy active question count
		mux.Handle("/api/questions/active/count", handlers.QuestionsActiveHandler{Repo: questionRepo})
		mux.Handle("/api/v1/questions/active/count", handlers.QuestionsActiveHandler{Repo: questionRepo})
	}
	if answerRepo != nil {
		mux.Handle("/api/v1/answers", handlers.AnswerHandler{Repo: answerRepo})
		mux.Handle("/api/v1/answers/", handlers.AnswerByIDHandler{Repo: answerRepo})
	}
	// Compatibility: support legacy frontend path for answers under questions
	if answerRepo != nil {
		mux.Handle("/api/v1/questions/", handlers.QuestionsAnswersHandler{Repo: answerRepo})
	}
	if themeRepo != nil {
		mux.Handle("/api/v1/themes", handlers.ThemeHandler{Repo: themeRepo})
	}
	if userRepo != nil {
		mux.Handle("/api/v1/users", handlers.UserHandler{Repo: userRepo})
		// Non-v1 alias
		mux.Handle("/api/users", handlers.UserHandler{Repo: userRepo})
		mux.Handle("/api/users/", handlers.UserHandler{Repo: userRepo})
		// legacy active users count
		mux.Handle("/api/users/active/count", handlers.UsersActiveHandler{Repo: userRepo})
		mux.Handle("/api/v1/users/active/count", handlers.UsersActiveHandler{Repo: userRepo})
	}
	// answers percentage endpoint (legacy)
	if answerRepo != nil {
		mux.Handle("/api/v1/answers/percentage", handlers.AnswersPercentageHandler{Repo: answerRepo})
		mux.Handle("/api/answers/percentage", handlers.AnswersPercentageHandler{Repo: answerRepo})
	}
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = fmt.Fprint(w, `{"service":"quizthespire-go","status":"running"}`)
	})

	server := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           withCORS(withLogging(mux)),
		ReadHeaderTimeout: 5 * time.Second,
	}

	log.Printf("quizthespire-go listening on %s", server.Addr)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("server failed: %v", err)
	}
}

func withLogging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		log.Printf("%s %s", r.Method, r.URL.Path)
		next.ServeHTTP(w, r)
	})
}

func withCORS(next http.Handler) http.Handler {
	// Read allowlist from CORS_ALLOWED_ORIGINS (comma-separated). If empty, default to '*'.
	raw := os.Getenv("CORS_ALLOWED_ORIGINS")
	allowAll := false
	var allowed []string
	if raw == "" {
		allowAll = true
	} else {
		for _, part := range strings.Split(raw, ",") {
			p := strings.TrimSpace(part)
			if p == "" {
				continue
			}
			if p == "*" {
				allowAll = true
				break
			}
			allowed = append(allowed, p)
		}
	}

	allowCreds := false
	if strings.ToLower(os.Getenv("CORS_ALLOW_CREDENTIALS")) == "true" {
		allowCreds = true
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		var allowOrigin string
		if allowAll {
			allowOrigin = "*"
		} else if origin != "" {
			for _, a := range allowed {
				if strings.EqualFold(a, origin) {
					allowOrigin = origin
					break
				}
			}
		}

		if allowOrigin == "" {
			// No matching origin; for preflight respond 204 without CORS headers, for other requests return 403.
			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}
			http.Error(w, "origin not allowed", http.StatusForbidden)
			return
		}

		w.Header().Set("Access-Control-Allow-Origin", allowOrigin)
		if allowCreds {
			w.Header().Set("Access-Control-Allow-Credentials", "true")
		}
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}
