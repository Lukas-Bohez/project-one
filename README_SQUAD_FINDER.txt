=== WARFRAME SQUAD FINDER ===

Live at: https://quizthespire.com/pages/squad/

To run:
  cd /home/student/Project/project-one/backend-go
  export PATH=/usr/local/go/bin:$PATH
  go build -o bin/quizthespire-server ./cmd/server
  PORT=8081 CORS_ALLOWED_ORIGINS='https://quizthespire.com' ./bin/quizthespire-server

Files:
  backend-go/internal/squad/   - Go backend (WebSocket hub, models, handlers)
  frontend/pages/squad/        - HTML page
  frontend/css/pages/squad/    - CSS (squad.css, squad-panels.css, squad-chat.css)
  frontend/js/pages/squad/    - JS client (squad-client.js)

See: project-one/WARFRAME_SQUAD_FINDER.md for full API docs.

IMPORTANT (2026-09-12): the squad WS must be proxied by Apache to the Go
backend on :8081 BEFORE the generic /api -> Python (:8001) catch-all:

  ProxyPass /api/v1/squad/ws ws://127.0.0.1:8081/api/v1/squad/ws
  ProxyPassReverse /api/v1/squad/ws ws://127.0.0.1:8081/api/v1/squad/ws
  ProxyPass /api/v1/squad http://127.0.0.1:8081/api/v1/squad
  ProxyPassReverse /api/v1/squad http://127.0.0.1:8081/api/v1/squad

Without it players see "Connecting..." + "0 online" (the /api catch-all would
otherwise 404 the WebSocket). Restart:  sudo systemctl restart quizthespire
Build:   cd backend-go && export PATH=/usr/local/go/bin:$PATH && go build -o bin/quizthespire-server ./cmd/server
