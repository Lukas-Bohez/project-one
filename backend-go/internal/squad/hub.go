// Package squad implements a 6-player group finder for Warframe with real-time
// chat. Players can create squads, join existing ones, and communicate via
// WebSocket-powered chat. The hub manages squad lifecycle, player matching,
// and broadcasts squad updates to all connected clients.
package squad

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxFrameBytes  = 8192
	sendBufferSize = 32
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin:     func(r *http.Request) bool { return true },
}

// client represents a single WebSocket connection to the squad finder
type client struct {
	hub           *Hub
	conn          *websocket.Conn
	send          chan []byte
	player        *Player
	joinedAt      time.Time
	messageCount  int
	lastMessageAt time.Time
	mu            sync.Mutex
}

// rateLimit checks if the client has exceeded the message rate limit
func (c *client) rateLimit() bool {
	c.mu.Lock()
	defer c.mu.Unlock()

	now := time.Now()
	if now.Sub(c.lastMessageAt) > RateLimitWindow {
		c.messageCount = 0
		c.lastMessageAt = now
	}

	c.messageCount++
	return c.messageCount <= RateLimitMessages
}

// message represents a JSON frame on the wire
type message struct {
	Event string          `json:"event"`
	Data  json.RawMessage `json:"data"`
}

// Hub maintains the set of active clients and squads, and broadcasts updates
type Hub struct {
	clients     map[string]*client
	squads      map[string]*Squad
	playerSquad map[string]string

	register   chan *client
	unregister chan *client
	broadcast  chan []byte

	mu             sync.RWMutex
	allowedOrigins map[string]bool

	// Wanted posts: players requesting roles/items/help
	wantedPosts  map[string]*WantedPost
	wantedMu     sync.RWMutex
	// Quick actions: one-click intents
	quickActions map[string]*QuickAction
	quickMu      sync.RWMutex
	// Playing now status
	playingNow  map[string]*PlayingNow
	playingMu   sync.RWMutex
	// Mission plans shared by players
	missionPlans map[string]*MissionPlan
	planMu       sync.RWMutex
	// Recent activity feed
	recentActivity map[string]*RecentActivity
	activityMu    sync.RWMutex
}

// NewHub creates a new squad finder hub
func NewHub() *Hub {
	return &Hub{
		clients:        make(map[string]*client),
		squads:         make(map[string]*Squad),
		playerSquad:    make(map[string]string),
		register:       make(chan *client),
		unregister:     make(chan *client),
		broadcast:      make(chan []byte, 256),
		allowedOrigins: make(map[string]bool),
	}
}

// Run starts the hub's main event loop
func (h *Hub) Run() {
	for {
		select {
		case c := <-h.register:
			h.mu.Lock()
			h.clients[c.player.ID] = c
			h.mu.Unlock()
			log.Printf("squad: player %s connected", c.player.Username)
			h.sendSquadList(c)
			h.broadcastPlayerCount()

		case c := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[c.player.ID]; ok {
				delete(h.clients, c.player.ID)
				close(c.send)
				h.removePlayerFromSquad(c.player.ID)
			}
			h.mu.Unlock()
			log.Printf("squad: player %s disconnected", c.player.Username)
			h.broadcastPlayerCount()

		case msg := <-h.broadcast:
			h.mu.RLock()
			for _, c := range h.clients {
				select {
				case c.send <- msg:
				default:
				}
			}
			h.mu.RUnlock()
		}
	}
}

// ServeWS handles WebSocket upgrade for the squad finder
func (h *Hub) ServeWS(w http.ResponseWriter, r *http.Request) {
	// Security: Validate origin
	origin := r.Header.Get("Origin")
	if !h.isAllowedOrigin(origin) {
		http.Error(w, "Origin not allowed", http.StatusForbidden)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("squad: upgrade failed: %v", err)
		return
	}

	// Set read deadline for initial message
	conn.SetReadDeadline(time.Now().Add(10 * time.Second))
	_, raw, err := conn.ReadMessage()
	if err != nil {
		log.Printf("squad: failed to read initial message: %v", err)
		conn.Close()
		return
	}

	var msg message
	if err := json.Unmarshal(raw, &msg); err != nil {
		log.Printf("squad: invalid initial message: %v", err)
		conn.Close()
		return
	}

	if msg.Event != "join_finder" {
		log.Printf("squad: expected join_finder event, got %s", msg.Event)
		conn.Close()
		return
	}

	var player Player
	if err := json.Unmarshal(msg.Data, &player); err != nil {
		log.Printf("squad: invalid player data: %v", err)
		conn.Close()
		return
	}

	// Security: Validate username
	if !ValidateUsername(player.Username) {
		log.Printf("squad: invalid username: %s", player.Username)
		conn.Close()
		return
	}

	// Security: Check for banned player
	if player.Banned {
		log.Printf("squad: banned player attempted connection: %s", player.Username)
		conn.Close()
		return
	}

	player.JoinedAt = time.Now()
	player.IsReady = false
	player.OnlineStatus = OnlineStatusOnline
	player.LastActive = time.Now()
	player.VerificationLevel = VerificationNone
	player.TrustScore = 50.0

	c := &client{
		hub:      h,
		conn:     conn,
		send:     make(chan []byte, sendBufferSize),
		player:   &player,
		joinedAt: time.Now(),
	}

	h.register <- c

	go c.writePump()
	go c.readPump()
}

// isAllowedOrigin checks if the origin is allowed to connect
func (h *Hub) isAllowedOrigin(origin string) bool {
	if origin == "" {
		return false
	}
	// Allow localhost for development
	if origin == "http://localhost:8081" || origin == "https://localhost:8081" {
		return true
	}
	// Allow the main domain
	if origin == "https://quizthespire.com" || origin == "http://quizthespire.com" {
		return true
	}
	return false
}

// readPump handles incoming messages from the client
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

		// Rate limiting
		if !c.rateLimit() {
			c.sendEvent("error", map[string]string{"message": "Rate limit exceeded. Please slow down."})
			continue
		}

		var msg message
		if err := json.Unmarshal(raw, &msg); err != nil {
			continue
		}

		// Validate event name length
		if len(msg.Event) > 50 {
			continue
		}

		c.hub.handleEvent(c, &msg)
	}
}

// writePump handles outgoing messages to the client
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
			if err := c.conn.WriteMessage(websocket.TextMessage, data); err != nil {
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

// sendEvent sends a JSON event to this client only
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

// sendSquadList sends the current list of open squads to a client
func (h *Hub) sendSquadList(c *client) {
	h.mu.RLock()
	squadList := make([]*Squad, 0, len(h.squads))
	for _, squad := range h.squads {
		if squad.Status == SquadStatusOpen {
			squadList = append(squadList, squad)
		}
	}
	h.mu.RUnlock()

	c.sendEvent("squad_list", map[string]interface{}{
		"squads": squadList,
	})
}

// broadcastEvent sends a JSON event to all connected clients
func (h *Hub) broadcastEvent(event string, data interface{}) {
	payload := map[string]interface{}{"event": event, "data": data}
	raw, err := json.Marshal(payload)
	if err != nil {
		return
	}
	h.broadcast <- raw
}

// broadcastToSquad sends a JSON event to all members of a specific squad
func (h *Hub) broadcastToSquad(squadID string, event string, data interface{}, excludePlayerID string) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	payload := map[string]interface{}{"event": event, "data": data}
	raw, err := json.Marshal(payload)
	if err != nil {
		return
	}

	squad, ok := h.squads[squadID]
	if !ok {
		return
	}

	for _, player := range squad.Players {
		if player.ID == excludePlayerID {
			continue
		}
		if c, ok := h.clients[player.ID]; ok {
			select {
			case c.send <- raw:
			default:
			}
		}
	}
}

// broadcastPlayerCount sends the current online player count to all clients
func (h *Hub) broadcastPlayerCount() {
	h.mu.RLock()
	count := len(h.clients)
	h.mu.RUnlock()

	h.broadcastEvent("player_count", map[string]interface{}{
		"online": count,
	})
}
