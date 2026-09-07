// Package quiz implements a real-time multiplayer quiz engine over WebSockets.
// It mirrors the protocol that the Python Socket.IO backend previously served,
// so the frontend can connect to Go without changes to the event names or
// payload shapes.
//
// Protocol (JSON frames over WebSocket):
//
//	Client → Server: {"event": "join_quiz_session", "data": {"session_id": 1}}
//	Client → Server: {"event": "submit_answer", "data": {"userId": 1, "questionId": 42, "answerIndex": 2}}
//	Client → Server: {"event": "theme_selected", "data": {"themeId": 5}}
//	Client → Server: {"event": "join", "data": {"room": "quiz_session_1"}}
//	Server → Client: {"event": "join_session_success", "data": {"session_id": 1, ...}}
//	Server → Client: {"event": "answer_response", "data": {"success": true, ...}}
//	Server → Client: {"event": "question", "data": {...}}
//	Server → Client: {"event": "leaderboard", "data": [{...}, ...]}
package quiz

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/Lukas-Bohez/project-one/backend-go/internal/repository"
	"github.com/gorilla/websocket"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxFrameBytes  = 4096
	sendBufferSize = 16
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin:     func(r *http.Request) bool { return true },
}

// client represents a single WebSocket connection.
type client struct {
	hub       *Hub
	conn      *websocket.Conn
	send      chan []byte
	sessionID int64
	userID    int64
	username  string
	room      string
}

// message is a JSON frame on the wire.
type message struct {
	Event string          `json:"event"`
	Data  json.RawMessage `json:"data"`
}

// Hub maintains the set of active clients and broadcasts messages to rooms.
type Hub struct {
	// rooms maps session_id → set of clients
	rooms      map[int64]map[*client]bool
	register   chan *client
	unregister chan *client
	broadcast  chan broadcast
	mu         sync.RWMutex
	repo       *repository.QuizRepository
}

type broadcast struct {
	sessionID int64
	data      []byte
}

// NewHub creates a new quiz hub.
func NewHub(repo *repository.QuizRepository) *Hub {
	return &Hub{
		rooms:      make(map[int64]map[*client]bool),
		register:   make(chan *client),
		unregister: make(chan *client),
		broadcast:  make(chan broadcast),
		repo:       repo,
	}
}

// Run starts the hub's main loop.
func (h *Hub) Run() {
	for {
		select {
		case c := <-h.register:
			h.mu.Lock()
			if h.rooms[c.sessionID] == nil {
				h.rooms[c.sessionID] = make(map[*client]bool)
			}
			h.rooms[c.sessionID][c] = true
			h.mu.Unlock()

		case c := <-h.unregister:
			h.mu.Lock()
			if room, ok := h.rooms[c.sessionID]; ok {
				delete(room, c)
				if len(room) == 0 {
					delete(h.rooms, c.sessionID)
				}
			}
			h.mu.Unlock()
			close(c.send)

		case b := <-h.broadcast:
			h.mu.RLock()
			if room, ok := h.rooms[b.sessionID]; ok {
				for c := range room {
					select {
					case c.send <- b.data:
					default:
						// slow client, drop
					}
				}
			}
			h.mu.RUnlock()
		}
	}
}

// ServeWS handles WebSocket upgrade and starts read/write pumps.
func (h *Hub) ServeWS(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("ws upgrade failed: %v", err)
		return
	}
	c := &client{
		hub:  h,
		conn: conn,
		send: make(chan []byte, sendBufferSize),
	}
	h.register <- c

	go c.writePump()
	go c.readPump()
}

func (c *client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()
	c.conn.SetReadLimit(maxFrameBytes)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, raw, err := c.conn.ReadMessage()
		if err != nil {
			break
		}
		var msg message
		if err := json.Unmarshal(raw, &msg); err != nil {
			continue
		}
		c.hub.handleEvent(c, &msg)
	}
}

func (c *client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()
	for {
		select {
		case data, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(data)
			w.Close()
		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// sendEvent sends a JSON event to this client only.
func (c *client) sendEvent(event string, data interface{}) {
	payload := map[string]interface{}{"event": event, "data": data}
	raw, err := json.Marshal(payload)
	if err != nil {
		return
	}
	select {
	case c.send <- raw:
	default:
	}
}

// broadcastToSession sends a JSON event to all clients in a session.
func (h *Hub) broadcastToSession(sessionID int64, event string, data interface{}) {
	payload := map[string]interface{}{"event": event, "data": data}
	raw, err := json.Marshal(payload)
	if err != nil {
		return
	}
	h.broadcast <- broadcast{sessionID: sessionID, data: raw}
}
