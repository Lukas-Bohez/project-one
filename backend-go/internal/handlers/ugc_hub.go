// Package chat implements a lightweight, room-based WebSocket chat server
// for live discussion around a specific quiz or story. One Hub manages many
// rooms; each room broadcasts only to the clients that joined it. Every
// client has its own token-bucket rate limiter so one connection flooding
// the socket can't starve or spam the room.
//
// This package does not implement authentication itself - see Authenticator
// below - and does not implement content moderation on its own; it calls a
// middleware.ContentModerator on every inbound message before broadcasting
// or persisting it, same as the CRUD handlers do for quizzes and stories.
package chat

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"gorm.io/gorm"

	"quizthespire/server/middleware"
	"quizthespire/server/models"
)

const (
	writeWait       = 10 * time.Second
	pongWait        = 60 * time.Second
	pingPeriod      = (pongWait * 9) / 10
	maxFrameBytes   = 4096 // raw inbound WS frame size, not just the "content" field
	maxContentRunes = 2000
	sendBufferSize  = 16
)

// RoomKeyForQuiz and RoomKeyForStory give handlers and chat a single shared
// convention for room keys, matching ChatRoom.TargetType/TargetID.
func RoomKeyForQuiz(quizID uint) string   { return fmt.Sprintf("quiz:%d", quizID) }
func RoomKeyForStory(storyID uint) string { return fmt.Sprintf("story:%d", storyID) }

// ---------------------------------------------------------------------------
// Per-connection token bucket rate limiter. Deliberately separate from the
// submission limiter in server/middleware/moderation.go: that one throttles
// HTTP POST frequency across stateless requests, this one throttles
// messages on a single open WebSocket connection.
// ---------------------------------------------------------------------------

type tokenBucket struct {
	mu         sync.Mutex
	tokens     float64
	maxTokens  float64
	refillRate float64 // tokens per second
	lastRefill time.Time
}

func newTokenBucket(maxTokens, refillPerSecond float64) *tokenBucket {
	return &tokenBucket{
		tokens:     maxTokens,
		maxTokens:  maxTokens,
		refillRate: refillPerSecond,
		lastRefill: time.Now(),
	}
}

func (b *tokenBucket) allow() bool {
	b.mu.Lock()
	defer b.mu.Unlock()
	now := time.Now()
	elapsed := now.Sub(b.lastRefill).Seconds()
	b.tokens = min(b.maxTokens, b.tokens+elapsed*b.refillRate)
	b.lastRefill = now
	if b.tokens >= 1 {
		b.tokens--
		return true
	}
	return false
}

// ---------------------------------------------------------------------------
// Pluggable seams: auth and persistence. Neither is implemented here -
// this package owns the concurrency and the wire protocol, not your auth
// system or your DB layer.
// ---------------------------------------------------------------------------

// Authenticator validates an incoming WebSocket upgrade request and
// resolves it to a user ID. Browsers can't set custom headers on a WS
// upgrade, so token-based schemes typically read from a query parameter or
// a cookie; wire this to whatever session/JWT auth the rest of the backend
// already uses. Minimal example for a query-parameter token:
//
//	type queryTokenAuth struct{ verify func(token string) (uint, error) }
//	func (a queryTokenAuth) AuthenticateUpgrade(r *http.Request) (uint, error) {
//		return a.verify(r.URL.Query().Get("token"))
//	}
type Authenticator interface {
	AuthenticateUpgrade(r *http.Request) (userID uint, err error)
}

// MessageStore persists a chat message. GormMessageStore is a ready
// implementation; swap it out if this backend isn't using GORM for this
// table.
type MessageStore interface {
	SaveMessage(ctx context.Context, roomDBID, userID uint, content string) (models.ChatMessage, error)
}

type GormMessageStore struct {
	DB *gorm.DB
}

func (s GormMessageStore) SaveMessage(ctx context.Context, roomDBID, userID uint, content string) (models.ChatMessage, error) {
	msg := models.ChatMessage{RoomID: roomDBID, UserID: userID, Content: content, CreatedAt: time.Now()}
	if err := s.DB.WithContext(ctx).Create(&msg).Error; err != nil {
		return models.ChatMessage{}, err
	}
	return msg, nil
}

// ---------------------------------------------------------------------------
// Wire format
// ---------------------------------------------------------------------------

type inboundMessage struct {
	Content string `json:"content"`
}

type outboundMessage struct {
	Type      string    `json:"type"` // "message" | "error"
	RoomID    string    `json:"room_id"`
	UserID    uint      `json:"user_id,omitempty"`
	Content   string    `json:"content"`
	Category  string    `json:"category,omitempty"` // set on "error" frames
	CreatedAt time.Time `json:"created_at"`
}

func mustMarshal(m outboundMessage) []byte {
	b, err := json.Marshal(m)
	if err != nil {
		// m is a fixed, JSON-safe struct - this can only fail on a
		// programmer error, so a log line beats a panic in a live server.
		log.Printf("chat: failed to marshal outbound message: %v", err)
		return []byte(`{"type":"error","content":"internal error"}`)
	}
	return b
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

type Client struct {
	hub     *Hub
	conn    *websocket.Conn
	send    chan []byte
	roomKey string
	userID  uint
	limiter *tokenBucket
}

func (c *Client) readPump() {
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
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("chat: unexpected close for user %d: %v", c.userID, err)
			}
			return
		}

		if !c.limiter.allow() {
			c.send <- mustMarshal(outboundMessage{
				Type: "error", RoomID: c.roomKey, Content: "rate limit exceeded, slow down",
				Category: "rate_limited", CreatedAt: time.Now(),
			})
			continue
		}

		var in inboundMessage
		if err := json.Unmarshal(raw, &in); err != nil {
			c.send <- mustMarshal(outboundMessage{
				Type: "error", RoomID: c.roomKey, Content: "invalid message format", CreatedAt: time.Now(),
			})
			continue
		}
		runeLen := len([]rune(in.Content))
		if runeLen == 0 || runeLen > maxContentRunes {
			c.send <- mustMarshal(outboundMessage{
				Type: "error", RoomID: c.roomKey, Content: "message must be 1-2000 characters", CreatedAt: time.Now(),
			})
			continue
		}

		if c.hub.moderator != nil {
			result, modErr := c.hub.moderator.Screen(context.Background(), in.Content, c.userID)
			if modErr != nil || !result.Allowed {
				reason := "message rejected by moderation"
				if result.Reason != "" {
					reason = result.Reason
				}
				c.send <- mustMarshal(outboundMessage{
					Type: "error", RoomID: c.roomKey, Content: reason,
					Category: string(result.Category), CreatedAt: time.Now(),
				})
				continue
			}
		}

		saved := models.ChatMessage{UserID: c.userID, Content: in.Content, CreatedAt: time.Now()}
		if c.hub.store != nil {
			roomDBID, ok := c.hub.roomDBID(c.roomKey)
			if !ok {
				c.send <- mustMarshal(outboundMessage{Type: "error", RoomID: c.roomKey, Content: "unknown room", CreatedAt: time.Now()})
				continue
			}
			var saveErr error
			saved, saveErr = c.hub.store.SaveMessage(context.Background(), roomDBID, c.userID, in.Content)
			if saveErr != nil {
				log.Printf("chat: failed to persist message: %v", saveErr)
				c.send <- mustMarshal(outboundMessage{Type: "error", RoomID: c.roomKey, Content: "failed to send message", CreatedAt: time.Now()})
				continue
			}
		}

		out := mustMarshal(outboundMessage{
			Type: "message", RoomID: c.roomKey, UserID: c.userID,
			Content: saved.Content, CreatedAt: saved.CreatedAt,
		})
		c.hub.broadcast <- roomBroadcast{roomKey: c.roomKey, payload: out}
	}
}

func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case msg, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := c.conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				return
			}
		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// ---------------------------------------------------------------------------
// Hub: rooms, registration, and broadcast routing
// ---------------------------------------------------------------------------

type room struct {
	clients map[*Client]bool
	mu      sync.RWMutex
}

type roomBroadcast struct {
	roomKey string
	payload []byte
}

type Hub struct {
	rooms      map[string]*room
	roomsMu    sync.RWMutex
	register   chan *Client
	unregister chan *Client
	broadcast  chan roomBroadcast

	auth      Authenticator
	moderator middleware.ContentModerator
	store     MessageStore
	upgrader  websocket.Upgrader

	allowedOrigins map[string]bool

	// roomDBIDResolver maps a room key ("quiz:123") to the ugc_chat_rooms.id
	// messages should be persisted under - typically a find-or-create
	// lookup against that table, keyed by TargetType/TargetID. If nil (or
	// Store is nil), messages are broadcast live but not persisted.
	roomDBIDResolver func(roomKey string) (uint, bool)
}

type HubConfig struct {
	Auth             Authenticator               // required for authenticated rooms; nil allows anonymous userID=0
	Moderator        middleware.ContentModerator // required to screen messages; nil disables screening entirely
	Store            MessageStore                // nil disables persistence (broadcast-only)
	AllowedOrigins   []string                    // exact-match allowlist, e.g. []string{"https://quizthespire.com"}
	RoomDBIDResolver func(roomKey string) (uint, bool)
}

func NewHub(cfg HubConfig) *Hub {
	origins := make(map[string]bool, len(cfg.AllowedOrigins))
	for _, o := range cfg.AllowedOrigins {
		origins[o] = true
	}
	h := &Hub{
		rooms:            make(map[string]*room),
		register:         make(chan *Client),
		unregister:       make(chan *Client),
		broadcast:        make(chan roomBroadcast, 256),
		auth:             cfg.Auth,
		moderator:        cfg.Moderator,
		store:            cfg.Store,
		allowedOrigins:   origins,
		roomDBIDResolver: cfg.RoomDBIDResolver,
	}
	h.upgrader = websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		CheckOrigin:     h.checkOrigin,
	}
	return h
}

func (h *Hub) roomDBID(roomKey string) (uint, bool) {
	if h.roomDBIDResolver == nil {
		return 0, false
	}
	return h.roomDBIDResolver(roomKey)
}

func (h *Hub) checkOrigin(r *http.Request) bool {
	origin := r.Header.Get("Origin")
	if origin == "" {
		// No Origin header means this isn't a browser-context request.
		// Reject by default; relax explicitly if you need non-browser
		// WS clients to connect directly.
		return false
	}
	return h.allowedOrigins[origin]
}

// Run must be started in its own goroutine (go hub.Run()) before ServeWS
// starts accepting connections, and should run for the lifetime of the
// process.
func (h *Hub) Run() {
	for {
		select {
		case c := <-h.register:
			h.roomsMu.Lock()
			r, ok := h.rooms[c.roomKey]
			if !ok {
				r = &room{clients: make(map[*Client]bool)}
				h.rooms[c.roomKey] = r
			}
			h.roomsMu.Unlock()

			r.mu.Lock()
			r.clients[c] = true
			r.mu.Unlock()

		case c := <-h.unregister:
			h.roomsMu.RLock()
			r, ok := h.rooms[c.roomKey]
			h.roomsMu.RUnlock()
			if !ok {
				continue
			}

			r.mu.Lock()
			if _, present := r.clients[c]; present {
				delete(r.clients, c)
				close(c.send)
			}
			empty := len(r.clients) == 0
			r.mu.Unlock()

			if empty {
				h.roomsMu.Lock()
				delete(h.rooms, c.roomKey)
				h.roomsMu.Unlock()
			}

		case b := <-h.broadcast:
			h.roomsMu.RLock()
			r, ok := h.rooms[b.roomKey]
			h.roomsMu.RUnlock()
			if !ok {
				continue
			}

			r.mu.RLock()
			for c := range r.clients {
				select {
				case c.send <- b.payload:
				default:
					// c's send buffer is full - it isn't keeping up.
					// Drop it rather than block the whole room; unregister
					// asynchronously since this goroutine is the only
					// reader of h.unregister and would deadlock sending
					// to it directly.
					go func(c *Client) { h.unregister <- c }(c)
				}
			}
			r.mu.RUnlock()
		}
	}
}

// ServeWS upgrades a request to a WebSocket connection and joins the room
// named by the "room" path value:
//
//	mux.Handle("/ws/rooms/{room}", hub.ServeWS())
//
// The room key is opaque to this package - RoomKeyForQuiz/RoomKeyForStory
// give a consistent convention shared with server/handlers/ugc_crud.go.
func (h *Hub) ServeWS() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		roomKey := r.PathValue("room")
		if roomKey == "" {
			http.Error(w, "room is required", http.StatusBadRequest)
			return
		}

		var userID uint
		if h.auth != nil {
			id, err := h.auth.AuthenticateUpgrade(r)
			if err != nil {
				http.Error(w, "unauthorized", http.StatusUnauthorized)
				return
			}
			userID = id
		}

		conn, err := h.upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("chat: upgrade failed: %v", err)
			return
		}

		client := &Client{
			hub:     h,
			conn:    conn,
			send:    make(chan []byte, sendBufferSize),
			roomKey: roomKey,
			userID:  userID,
			limiter: newTokenBucket(5, 1), // burst of 5, refilling at 1/sec (~60 msgs/min sustained)
		}

		h.register <- client

		go client.writePump()
		go client.readPump()
	}
}
