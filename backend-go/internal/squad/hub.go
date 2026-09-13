// Package squad implements a 6-player group finder for Warframe with real-time
// chat. Players can create squads, join existing ones, and communicate via
// WebSocket-powered chat. The hub manages squad lifecycle, player matching,
// and broadcasts squad updates to all connected clients.
package squad

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxFrameBytes  = 8192
	sendBufferSize = 32

	// MaxClients is the maximum number of concurrent WebSocket connections
	// the squad hub will accept. Prevents a single user or bot from opening
	// thousands of connections and exhausting server resources.
	MaxClients = 500

	// MaxClientsPerIP limits concurrent connections from a single IP address.
	// Stops a single machine from monopolizing the connection pool.
	MaxClientsPerIP = 10

	// GlobalRateLimit is the maximum number of events the hub will process
	// per second across all clients. Beyond this, messages are dropped.
	GlobalRateLimit = 1000
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
	ip            string
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

	// ipConnections tracks how many concurrent connections each IP has
	ipConnections map[string]int
	ipMu          sync.RWMutex

	// Wanted posts: players requesting roles/items/help
	wantedPosts map[string]*WantedPost
	wantedMu    sync.RWMutex
	// Quick actions: one-click intents
	quickActions map[string]*QuickAction
	quickMu      sync.RWMutex
	// Playing now status
	playingNow map[string]*PlayingNow
	playingMu  sync.RWMutex
	// Mission plans shared by players
	missionPlans map[string]*MissionPlan
	planMu       sync.RWMutex
	// Recent activity feed
	recentActivity map[string]*RecentActivity
	activityMu     sync.RWMutex

	// Games & categories (seeded + user-generated)
	games   map[string]*Game
	gameMu  sync.RWMutex
	store   *Store
}

// NewHub creates a new squad finder hub
func NewHub() *Hub {
	store := loadStore()
	games := make(map[string]*Game)
	for _, g := range seedGames() {
		games[g.ID] = g
	}
	// Overlay any user-created games from the store
	for id, g := range store.Games {
		games[id] = g
	}
	return &Hub{
		games: games,
		store: store,
		clients:        make(map[string]*client),
		squads:         make(map[string]*Squad),
		playerSquad:    make(map[string]string),
		register:       make(chan *client),
		unregister:     make(chan *client),
		broadcast:      make(chan []byte, 256),
		allowedOrigins: make(map[string]bool),
		ipConnections:  make(map[string]int),
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
			// Send the new player their session bootstrap: filter options
			// (so dropdowns populate), the current squad list, then a
			// player_count broadcast so everyone's counter stays in sync.
			h.sendFilterOptions(c)
			h.sendSquadList(c)
			h.broadcastPlayerCount()

		case c := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[c.player.ID]; ok {
				delete(h.clients, c.player.ID)
				close(c.send)
				// Lock is already held here; use the Locked variant.
				// (removePlayerFromSquad would re-lock h.mu and deadlock
				// the hub's event loop on the first disconnect.)
				h.removePlayerFromSquadLocked(c.player.ID)
			}
			h.mu.Unlock()
			// Decrement IP connection count
			if c.ip != "" {
				h.ipMu.Lock()
				if h.ipConnections[c.ip] > 0 {
					h.ipConnections[c.ip]--
				}
				h.ipMu.Unlock()
			}
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
	log.Printf("squad: WebSocket origin=%q X-Forwarded-For=%q RemoteAddr=%s", origin, r.Header.Get("X-Forwarded-For"), r.RemoteAddr)
	if !h.isAllowedOrigin(origin) {
		http.Error(w, "Origin not allowed", http.StatusForbidden)
		return
	}

	// Security: Connection limits — prevent DDoS via WebSocket flooding
	clientIP := getClientIP(r)

	// Global client limit
	h.mu.RLock()
	globalCount := len(h.clients)
	h.mu.RUnlock()
	if globalCount >= MaxClients {
		http.Error(w, "Server full. Try again later.", http.StatusServiceUnavailable)
		log.Printf("squad: global connection limit reached (%d), rejecting %s", MaxClients, clientIP)
		return
	}

	// Per-IP connection limit
	h.ipMu.RLock()
	ipCount := h.ipConnections[clientIP]
	h.ipMu.RUnlock()
	if ipCount >= MaxClientsPerIP {
		http.Error(w, "Too many connections from your IP.", http.StatusTooManyRequests)
		log.Printf("squad: per-IP limit reached for %s (%d connections)", clientIP, ipCount)
		return
	}

	// Track this IP connection
	h.ipMu.Lock()
	h.ipConnections[clientIP]++
	h.ipMu.Unlock()

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("squad: upgrade failed: %v", err)
		// Decrement IP count on failed upgrade
		h.ipMu.Lock()
		h.ipConnections[clientIP]--
		h.ipMu.Unlock()
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

	// The frontend sends the player wrapped as data = { "player": {...} }.
	// Accept both the wrapped shape and a bare Player payload.
	var wrap struct {
		Player *Player `json:"player"`
	}
	if werr := json.Unmarshal(msg.Data, &wrap); werr == nil && wrap.Player != nil {
		player = *wrap.Player
	} else {
		if err := json.Unmarshal(msg.Data, &player); err != nil {
			log.Printf("squad: invalid player data: %v", err)
			conn.Close()
			return
		}
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

	// The client does not send an id; generate a unique one server-side so
	// every connection gets a distinct player identity. Without this, all
	// players share id "" and collide in the clients/playerSquad maps.
	if player.ID == "" {
		player.ID = uuid.New().String()
	}

	c := &client{
		hub:      h,
		conn:     conn,
		send:     make(chan []byte, sendBufferSize),
		player:   &player,
		ip:       clientIP,
		joinedAt: time.Now(),
	}

	h.register <- c

	go c.writePump()
	go c.readPump()
}

// isAllowedOrigin checks if the origin is allowed to connect.
// Empty origin means a non-browser client or a same-origin direct
// connection (curl, a Python script, or a browser that didn't send
// Origin) — these are safe to allow.
func (h *Hub) isAllowedOrigin(origin string) bool {
	if origin == "" {
		return true
	}
	// Allow localhost for development
	if origin == "http://localhost:8081" || origin == "https://localhost:8081" {
		return true
	}
	// Allow the main domain (with and without www)
	if origin == "https://quizthespire.com" || origin == "http://quizthespire.com" {
		return true
	}
	if origin == "https://www.quizthespire.com" || origin == "http://www.quizthespire.com" {
		return true
	}
	return false
}

// getClientIP extracts the real client IP from the request, checking
// X-Forwarded-For and X-Real-IP headers set by proxies (Apache).
func getClientIP(r *http.Request) string {
	// Check X-Forwarded-For first (set by Apache mod_proxy)
	xff := r.Header.Get("X-Forwarded-For")
	if xff != "" {
		// Take the first IP in the chain (the original client)
		if idx := len(xff); idx > 0 {
			for i, c := range xff {
				if c == ',' {
					xff = xff[:i]
					break
				}
			}
			return xff
		}
	}
	// Check X-Real-IP (alternative proxy header)
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return xri
	}
	// Fall back to the direct connection IP
	ip := r.RemoteAddr
	// Strip port if present
	for i := len(ip) - 1; i >= 0; i-- {
		if ip[i] == ':' {
			return ip[:i]
		}
	}
	return ip
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

// GetGames returns all games (seeded + user-created) with their categories.
func (h *Hub) GetGames() []*Game {
	h.gameMu.RLock()
	defer h.gameMu.RUnlock()
	result := make([]*Game, 0, len(h.games))
	for _, g := range h.games {
		result = append(result, g)
	}
	return result
}

// GetGame returns a single game by ID (or slug).
func (h *Hub) GetGame(idOrSlug string) *Game {
	h.gameMu.RLock()
	defer h.gameMu.RUnlock()
	if g, ok := h.games[idOrSlug]; ok {
		return g
	}
	for _, g := range h.games {
		if g.Slug == idOrSlug {
			return g
		}
	}
	return nil
}

// AddCategory adds a user-created category to a game and persists it.
func (h *Hub) AddCategory(gameID string, name, icon, createdBy string) *Category {
	h.gameMu.Lock()
	defer h.gameMu.Unlock()
	g, ok := h.games[gameID]
	if !ok {
		return nil
	}
	cat := Category{
		ID:        "cat_custom_" + newID(),
		Name:      SanitizeString(name),
		Icon:      icon,
		IsCustom:  true,
		CreatedBy: createdBy,
		CreatedAt: time.Now(),
	}
	g.Categories = append(g.Categories, cat)
	h.store.CustomCats[cat.ID] = &cat
	h.store.save()
	return &cat
}

// AddGame adds a user-created game and persists it.
func (h *Hub) AddGame(name, slug, description, icon, createdBy string) *Game {
	h.gameMu.Lock()
	defer h.gameMu.Unlock()
	if slug == "" {
		slug = strings.ToLower(strings.ReplaceAll(name, " ", "-"))
	}
	g := &Game{
		ID:          "game_custom_" + newID(),
		Name:        SanitizeString(name),
		Slug:        slug,
		Description: SanitizeString(description),
		Icon:        icon,
		Categories:  []Category{},
		IsCustom:    true,
		CreatedBy:   createdBy,
		CreatedAt:   time.Now(),
	}
	h.games[g.ID] = g
	h.store.Games[g.ID] = g
	h.store.save()
	return g
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
