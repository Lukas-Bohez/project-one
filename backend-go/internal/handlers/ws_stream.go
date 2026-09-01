// Package handlers implements HTTP/WebSocket handlers for quizthespire.com's
// Go backend.
package handlers

import (
	"bufio"
	"bytes"
	"context"
	"fmt"
	"log"
	"net/http"
	"os/exec"
	"strconv"
	"strings"
	"time"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"
)

// DownloadStreamer upgrades requests to WebSocket connections and streams
// yt-dlp download progress back to the client as JSON frames, replacing
// HTTP polling. It caps concurrent yt-dlp processes so a burst of playlist
// downloads can't exhaust CPU/RAM on constrained hosts (e.g. a Pi 5).
//
// Wire it into your router like:
//
//	streamer := handlers.NewDownloadStreamer(
//		"/opt/quizthespire/downloads",
//		[]string{"quizthespire.com"},
//		3,
//	)
//	mux.Handle("/ws/converter/progress", streamer)
//
// go get github.com/coder/websocket before building — this package can't
// resolve external Go modules in this sandbox, so the import above hasn't
// been build-verified against the real dependency, only checked against
// the library's documented API.
type DownloadStreamer struct {
	downloadDir    string
	allowedOrigins []string
	slots          chan struct{}
}

// NewDownloadStreamer builds a DownloadStreamer. maxConcurrent <= 0 falls
// back to 3 — a starting guess for an 8GB Pi 5, not a measured value.
// Tune it against actual free memory once nginx/Caddy and anything else
// on the box are accounted for; each yt-dlp+ffmpeg remux can spike well
// past 200-300MB RSS.
func NewDownloadStreamer(downloadDir string, allowedOrigins []string, maxConcurrent int) *DownloadStreamer {
	if maxConcurrent <= 0 {
		maxConcurrent = 3
	}
	return &DownloadStreamer{
		downloadDir:    downloadDir,
		allowedOrigins: allowedOrigins,
		slots:          make(chan struct{}, maxConcurrent),
	}
}

type progressFrame struct {
	Type       string `json:"type"` // "progress" | "done" | "error"
	Percent    string `json:"percent,omitempty"`
	ETA        string `json:"eta,omitempty"`
	Speed      string `json:"speed,omitempty"`
	Downloaded int64  `json:"downloaded_bytes,omitempty"`
	Total      int64  `json:"total_bytes,omitempty"`
	Message    string `json:"message,omitempty"`
}

type startMessage struct {
	URL string `json:"url"`
}

// ServeHTTP implements http.Handler so DownloadStreamer can be mounted
// directly on a mux.
func (s *DownloadStreamer) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
		OriginPatterns: s.allowedOrigins,
	})
	if err != nil {
		log.Printf("ws accept: %v", err)
		return
	}
	defer conn.CloseNow()

	// Derive our own long-lived context rather than trusting r.Context()
	// for the life of a multi-minute download — on some setups the
	// request context is cancelled as soon as the hijack completes.
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Hour)
	defer cancel()

	var start startMessage
	if err := wsjson.Read(ctx, conn, &start); err != nil || start.URL == "" {
		conn.Close(websocket.StatusUnsupportedData, `expected {"url": "..."} as the first message`)
		return
	}

	select {
	case s.slots <- struct{}{}:
		defer func() { <-s.slots }()
	default:
		_ = wsjson.Write(ctx, conn, progressFrame{Type: "error", Message: "server is at capacity — try again shortly"})
		// 1013 Try Again Later. Cast rather than a named constant since
		// that one isn't confirmed to exist under this exact name.
		conn.Close(websocket.StatusCode(1013), "at capacity")
		return
	}

	if err := s.streamDownload(ctx, conn, start.URL); err != nil {
		log.Printf("download stream for %s: %v", start.URL, err)
		_ = wsjson.Write(ctx, conn, progressFrame{Type: "error", Message: err.Error()})
		conn.Close(websocket.StatusInternalError, "download failed")
		return
	}

	conn.Close(websocket.StatusNormalClosure, "done")
}

func (s *DownloadStreamer) streamDownload(ctx context.Context, conn *websocket.Conn, url string) error {
	// yt-dlp's --progress-template does raw string substitution with no
	// escaping, so asking it to emit JSON text directly is one stray
	// character (a quote in a video title, say) away from an invalid
	// frame. Instead it emits a simple '|'-delimited record; we parse
	// that below and let Go's encoding/json (via wsjson.Write) build the
	// actual JSON, which escapes correctly by construction.
	tmpl := "download:PROGRESS|%(progress._percent_str)s|%(progress._eta_str)s|%(progress._speed_str)s|%(progress.downloaded_bytes)s|%(progress.total_bytes)s"

	cmd := exec.CommandContext(ctx, "yt-dlp",
		"--newline",
		"--progress-template", tmpl,
		"-P", s.downloadDir,
		"-o", "%(playlist_index)s-%(title)s.%(ext)s",
		url,
	)

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return fmt.Errorf("stdout pipe: %w", err)
	}
	var stderrBuf bytes.Buffer
	cmd.Stderr = &stderrBuf

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("start yt-dlp: %w", err)
	}

	scanner := bufio.NewScanner(stdout)
	for scanner.Scan() {
		line := scanner.Text()
		if !strings.HasPrefix(line, "PROGRESS|") {
			continue // extractor/status noise, not a progress line
		}
		frame, ok := parseProgressLine(line)
		if !ok {
			continue
		}
		if err := wsjson.Write(ctx, conn, frame); err != nil {
			_ = cmd.Process.Kill()
			return fmt.Errorf("client write failed, killed yt-dlp: %w", err)
		}
	}

	if err := cmd.Wait(); err != nil {
		return fmt.Errorf("yt-dlp exited: %w: %s", err, strings.TrimSpace(stderrBuf.String()))
	}

	return wsjson.Write(ctx, conn, progressFrame{Type: "done"})
}

func parseProgressLine(line string) (progressFrame, bool) {
	parts := strings.SplitN(line, "|", 6)
	if len(parts) != 6 {
		return progressFrame{}, false
	}
	frame := progressFrame{
		Type:    "progress",
		Percent: strings.TrimSpace(parts[1]),
		ETA:     strings.TrimSpace(parts[2]),
		Speed:   strings.TrimSpace(parts[3]),
	}
	// downloaded/total bytes read "NA" until yt-dlp knows the size (e.g.
	// early in a stream) — ParseInt fails harmlessly and the field is
	// just left at 0 rather than erroring the whole frame out.
	if n, err := strconv.ParseInt(strings.TrimSpace(parts[4]), 10, 64); err == nil {
		frame.Downloaded = n
	}
	if n, err := strconv.ParseInt(strings.TrimSpace(parts[5]), 10, 64); err == nil {
		frame.Total = n
	}
	return frame, true
}
