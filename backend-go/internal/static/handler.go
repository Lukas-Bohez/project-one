package static

import (
"net/http"
"path/filepath"
	"time"
"strings"
)

// Handler serves static files from the given root directory.
type Handler struct {
root http.Dir
}

// New creates a new static file handler.
func New(rootDir string) *Handler {
return &Handler{root: http.Dir(rootDir)}
}

// ServeHTTP implements http.Handler.
func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
// Clean and normalize the path
reqPath := r.URL.Path
cleanPath := filepath.Clean(strings.TrimPrefix(reqPath, "/"))
if cleanPath == "." || cleanPath == "" {
cleanPath = "index.html"
}

// Security: prevent directory traversal
if strings.Contains(cleanPath, "..") {
http.Error(w, "not found", http.StatusNotFound)
return
}

// If the path looks like a directory (ends with / or is a known page path), serve index.html
if strings.HasSuffix(cleanPath, "/") || isDirectoryPath(cleanPath) {
cleanPath = filepath.Join(cleanPath, "index.html")
}

// Try to open the file
file, err := h.root.Open(cleanPath)
if err != nil {
// If original path was a directory, try index.html
if isDirectoryPath(strings.TrimPrefix(reqPath, "/")) {
file, err = h.root.Open(filepath.Join(strings.TrimPrefix(reqPath, "/"), "index.html"))
if err != nil {
http.Error(w, "not found", http.StatusNotFound)
return
}
} else {
http.Error(w, "not found", http.StatusNotFound)
return
}
}
defer file.Close()

// Determine content type from file extension
name := filepath.Base(cleanPath)
ct := mimeType(name)
w.Header().Set("Content-Type", ct)

// Serve the file
stat, _ := file.Stat()
if stat != nil {
http.ServeContent(w, r, name, stat.ModTime(), file)
} else {
http.ServeContent(w, r, name, time.Time{}, file)
}
}

// isDirectoryPath checks if a path looks like it should serve a directory index
func isDirectoryPath(path string) bool {
// Known page paths that should serve index.html
switch path {
case "pages/quiz", "pages/sentle", "pages": return true
}
return false
}

func mimeType(name string) string {
switch {
case strings.HasSuffix(name, ".html"), strings.HasSuffix(name, ".htm"):
return "text/html; charset=utf-8"
case strings.HasSuffix(name, ".js"):
return "application/javascript; charset=utf-8"
case strings.HasSuffix(name, ".css"):
return "text/css; charset=utf-8"
case strings.HasSuffix(name, ".json"):
return "application/json"
case strings.HasSuffix(name, ".png"):
return "image/png"
case strings.HasSuffix(name, ".ico"):
return "image/x-icon"
case strings.HasSuffix(name, ".svg"):
return "image/svg+xml"
case strings.HasSuffix(name, ".woff2"):
return "font/woff2"
case strings.HasSuffix(name, ".woff"):
return "font/woff"
default:
return "application/octet-stream"
}
}
