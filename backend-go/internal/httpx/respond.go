// Package httpx holds small, dependency-free helpers for writing HTTP
// responses consistently across every handler.
//
// Today, thirteen call sites across the handlers package do this on any
// repository error:
//
//	http.Error(w, err.Error(), http.StatusInternalServerError)
//
// That sends the raw Go error string straight to the HTTP client. For a
// database-backed handler that string can include driver text, table or
// column names, or fragments of the failing query - none of which a client
// should ever see, and all of which is useful to an attacker probing the
// API. It's also an inconsistent response shape: some handlers already
// write a JSON body (via json.NewEncoder), others write the plain-text body
// http.Error produces, so callers of the API can't rely on one error
// format.
//
// Error() below fixes both problems: it always logs the real error
// server-side (so nothing is lost for debugging) and always sends the
// client a small, fixed JSON envelope with a message that's safe to show.
package httpx

import (
	"encoding/json"
	"log"
	"net/http"
)

// errorBody is the JSON shape every error response uses:
//
//	{"error": "question not found"}
type errorBody struct {
	Error string `json:"error"`
}

// Error logs err (with the request method and path, so it shows up next to
// the matching access log line) and writes publicMessage to the client as a
// JSON body with the given status code. err is never sent to the client -
// pass a publicMessage that's safe for anyone to read.
//
// Existing call sites that read:
//
//	http.Error(w, err.Error(), http.StatusInternalServerError)
//
// become:
//
//	httpx.Error(w, r, http.StatusInternalServerError, "internal server error", err)
//
// For a client mistake rather than a server-side failure (bad input,
// validation, etc.) there is no underlying error worth logging - pass nil:
//
//	httpx.Error(w, r, http.StatusBadRequest, "invalid limit", nil)
func Error(w http.ResponseWriter, r *http.Request, status int, publicMessage string, err error) {
	if err != nil {
		log.Printf("%s %s -> %d: %v", r.Method, r.URL.Path, status, err)
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(errorBody{Error: publicMessage})
}

// JSON writes payload as a JSON body with the given status code. It exists
// so success and error responses go through the same two functions instead
// of each handler setting its own headers and calling json.NewEncoder
// directly.
func JSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
