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
