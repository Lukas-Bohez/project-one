package main

import (
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/Lukas-Bohez/project-one/backend-go/internal/api/handlers"
	"github.com/Lukas-Bohez/project-one/backend-go/internal/config"
	"github.com/Lukas-Bohez/project-one/backend-go/internal/db"
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

	mux := http.NewServeMux()
	if mysqlDB != nil {
		mux.Handle("/healthz", handlers.HealthHandler{DB: mysqlDB.DB})
	} else {
		mux.Handle("/healthz", handlers.HealthHandler{})
	}
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = fmt.Fprint(w, `{"service":"quizthespire-go","status":"running"}`)
	})

	server := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           withLogging(mux),
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
