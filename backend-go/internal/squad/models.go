package squad

import (
	"crypto/subtle"
	"encoding/json"
	"os"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"
)

// ---------------------------------------------------------------------------
// Games & Categories (user-generated content)
// ---------------------------------------------------------------------------

// Game represents a supported game. Games can be seeded (system) or
// user-created. Each game owns its own set of categories.
type Game struct {
	ID          string     `json:"id"`
	Name        string     `json:"name"`
	Slug        string     `json:"slug"`
	Description string     `json:"description"`
	Icon        string     `json:"icon"`
	Categories  []Category `json:"categories"`
	IsCustom    bool       `json:"isCustom"`
	CreatedBy   string     `json:"createdBy"`
	CreatedAt   time.Time  `json:"createdAt"`
}

// Category is an activity/mission type within a game.
type Category struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Icon      string    `json:"icon"`
	IsCustom  bool      `json:"isCustom"`
	CreatedBy string    `json:"createdBy"`
	CreatedAt time.Time `json:"createdAt"`
}

// SquadStatus represents the current state of a squad
type SquadStatus string

const (
	SquadStatusOpen   SquadStatus = "open"
	SquadStatusFull   SquadStatus = "full"
	SquadStatusInGame SquadStatus = "in_game"
	SquadStatusClosed SquadStatus = "closed"
)

// MaxSquadSize is the maximum number of players in a squad
const MaxSquadSize = 6

// SquadMode defines the gameplay mode
type SquadMode string

const (
	SquadModeCasual  SquadMode = "casual"
	SquadModeSerious SquadMode = "serious"
)

// PlayerRole represents a role in the squad
type PlayerRole string

const (
	RoleDPS        PlayerRole = "dps"
	RoleSupport    PlayerRole = "support"
	RoleBuffer     PlayerRole = "buffer"
	RoleShield     PlayerRole = "shield"
	RoleArcane     PlayerRole = "arcane"
	RoleResource   PlayerRole = "resource"
	RoleEfficiency PlayerRole = "efficiency"
	RoleAny        PlayerRole = "any"
)

var AllRoles = []PlayerRole{RoleDPS, RoleSupport, RoleBuffer, RoleShield, RoleArcane, RoleResource, RoleEfficiency, RoleAny}

// RoleDisplay returns display name for a role
func (r PlayerRole) Display() string {
	switch r {
	case RoleDPS:
		return "DPS"
	case RoleSupport:
		return "Support"
	case RoleBuffer:
		return "Buffer"
	case RoleShield:
		return "Shield"
	case RoleArcane:
		return "Arcane"
	case RoleResource:
		return "Resource"
	case RoleEfficiency:
		return "Efficiency"
	default:
		return "Any"
	}
}

// SessionReport represents a post-mission report
type SessionReport struct {
	MissionTime   int            `json:"missionTime"`
	Success       bool           `json:"success"`
	DropsFound    []string       `json:"dropsFound"`
	PlayerRatings map[string]int `json:"playerRatings"`
	Notes         string         `json:"notes"`
	SubmittedAt   time.Time      `json:"submittedAt"`
}

// ActivityEntry represents a player's recent squad activity for reputation
type ActivityEntry struct {
	SquadID    string    `json:"squadId"`
	SquadName  string    `json:"squadName"`
	Mission    string    `json:"mission"`
	Planet     string    `json:"planet"`
	Difficulty string    `json:"difficulty"`
	Success    bool      `json:"success"`
	PlayedWith []string  `json:"playedWith"` // Player IDs
	PlayedAt   time.Time `json:"playedAt"`
}

// Security constants
const (
	MaxMessageLength    = 500
	MaxSquadNameLength  = 40
	MaxPlayerNameLength = 20
	MinPlayerNameLength = 2
	MaxChatHistory      = 100
	MaxDescriptionLen   = 240
	RateLimitMessages   = 5
	RateLimitWindow     = 10 * time.Second
)

// Validation patterns
var (
	validUsernamePattern  = regexp.MustCompile(`^[a-zA-Z0-9_\-\[\]]+$`)
	validSquadNamePattern = regexp.MustCompile(`^[a-zA-Z0-9_\-\s\[\]\(\)]+$`)
)

// ValidateUsername checks if a username meets security requirements
func ValidateUsername(username string) bool {
	if utf8.RuneCountInString(username) < MinPlayerNameLength || utf8.RuneCountInString(username) > MaxPlayerNameLength {
		return false
	}
	return validUsernamePattern.MatchString(username)
}

// ValidateSquadName checks if a squad name meets security requirements
func ValidateSquadName(name string) bool {
	if len(name) < 3 || len(name) > MaxSquadNameLength {
		return false
	}
	return validSquadNamePattern.MatchString(name)
}

// SanitizeString removes potentially dangerous characters
func SanitizeString(s string) string {
	s = strings.TrimSpace(s)
	s = strings.ReplaceAll(s, "<", "&lt;")
	s = strings.ReplaceAll(s, ">", "&gt;")
	s = strings.ReplaceAll(s, "\"", "&quot;")
	s = strings.ReplaceAll(s, "'", "&#39;")
	return s
}

// SecureCompare performs constant-time string comparison to prevent timing attacks
func SecureCompare(a, b string) bool {
	return subtle.ConstantTimeCompare([]byte(a), []byte(b)) == 1
}

// AccountVerificationStatus represents the verification level of an account
type AccountVerificationStatus string

const (
	VerificationNone     AccountVerificationStatus = "none"
	VerificationPending  AccountVerificationStatus = "pending"
	VerificationVerified AccountVerificationStatus = "verified"
	VerificationPremium  AccountVerificationStatus = "premium"
)

// PlayerOnlineStatus represents the current online status
type PlayerOnlineStatus string

const (
	OnlineStatusOnline  PlayerOnlineStatus = "online"
	OnlineStatusInGame  PlayerOnlineStatus = "in_game"
	OnlineStatusAway    PlayerOnlineStatus = "away"
	OnlineStatusOffline PlayerOnlineStatus = "offline"
)

// Squad represents a group of players looking to play together
type Squad struct {
	ID           string      `json:"id"`
	Name         string      `json:"name"`
	GameID       string      `json:"gameId"`      // which game this squad is for
	CategoryID   string      `json:"categoryId"`  // activity/category within the game
	Mission      string      `json:"missionType"`
	Planet       string      `json:"planet"`
	Node         string      `json:"node"`
	Difficulty   string      `json:"difficulty"`
	Region       string      `json:"region"`
	Language     string      `json:"language"`
	Status       SquadStatus `json:"status"`
	LeaderID     string      `json:"leaderId"`
	LeaderName   string      `json:"leaderName"`
	LeaderTrust  float64     `json:"leaderTrust"`
	Players      []*Player   `json:"players"`
	MaxPlayers   int         `json:"maxPlayers"`
	Mode         SquadMode   `json:"mode"`      // "casual" or "serious"
	SquadSize    int         `json:"squadSize"` // 4 or 6
	CreatedAt    time.Time   `json:"createdAt"`
	UpdatedAt    time.Time   `json:"updatedAt"`
	Tags         []string    `json:"tags"`
	Description  string      `json:"description"` // freeform: "EDA Stella farm, Cyte-09 ad clear, need supports"
	Requirements string      `json:"requirements"`
	// Objective states what the run is for: "clear" (finish the mission),
	// "farm" (grind loot/points) or "other". Empty = not stated.
	Objective string `json:"objective,omitempty"`
	// Mission modifiers. These are not mission types; they stack on top of
	// the chosen mission (e.g. Survival + Steel Path + Void Fissure).
	SteelPath   bool     `json:"steelPath,omitempty"`
	Nightmare   bool     `json:"nightmare,omitempty"`
	VoidFissure bool     `json:"voidFissure,omitempty"`
	VoiceChat   bool     `json:"voiceChat"`
	Experience  string   `json:"experience"` // "new", "veteran", "any"
	Playstyle   string   `json:"playstyle"`  // "stealth", "speed", "loot", "any"
	Relics      []string `json:"relics"`

	// Role assignments: playerID -> role
	Roles map[string]PlayerRole `json:"roles,omitempty"`
	// Drop targets: item name -> list of player IDs who want it
	DropTargets map[string][]string `json:"dropTargets,omitempty"`
	// Session tracking
	SessionStarted   bool           `json:"sessionStarted"`
	SessionStartedAt time.Time      `json:"sessionStartedAt,omitempty"`
	SessionEnded     bool           `json:"sessionEnded"`
	SessionEndedAt   time.Time      `json:"sessionEndedAt,omitempty"`
	SessionDuration  int            `json:"sessionDuration"` // minutes
	SessionSuccess   bool           `json:"sessionSuccess"`
	SessionReport    *SessionReport `json:"sessionReport,omitempty"`
	ModRank          string         `json:"modRank"`
	MissionTime      int            `json:"missionTime"` // estimated minutes
	IsCrossPlatform  bool           `json:"isCrossPlatform"`
	IsRecruiting     bool           `json:"isRecruiting"`
	Views            int            `json:"views"`
	JoinRequests     int            `json:"joinRequests"`
}

// SquadFilter represents filters for searching squads
type SquadFilter struct {
	Mission       string `json:"mission"`
	Planet        string `json:"planet"`
	Node          string `json:"node"`
	Difficulty    string `json:"difficulty"`
	Region        string `json:"region"`
	Language      string `json:"language"`
	HasSlots      bool   `json:"hasSlots"`
	MinTrust      int    `json:"minTrust"`
	Experience    string `json:"experience"`
	Playstyle     string `json:"playstyle"`
	VoiceChat     bool   `json:"voiceChat"`
	CrossPlatform bool   `json:"crossPlatform"`
}

// Player represents a player in the squad finder
type Player struct {
	ID                string                    `json:"id"`
	Username          string                    `json:"username"`
	MasteryRank       int                       `json:"masteryRank"`
	Platform          string                    `json:"platform"`
	Region            string                    `json:"region"`
	Language          string                    `json:"language"`
	JoinedAt          time.Time                 `json:"joinedAt"`
	IsReady           bool                      `json:"isReady"`
	OnlineStatus      PlayerOnlineStatus        `json:"onlineStatus"`
	VerificationLevel AccountVerificationStatus `json:"verificationLevel"`
	Reputation        int                       `json:"reputation"`
	TotalMissions     int                       `json:"totalMissions"`
	WarframeName      string                    `json:"warframeName,omitempty"`
	ClanTag           string                    `json:"clanTag,omitempty"`
	AvatarURL         string                    `json:"avatarURL,omitempty"`
	LastActive        time.Time                 `json:"lastActive"`
	IsPremium         bool                      `json:"isPremium"`
	TrustScore        float64                   `json:"trustScore"`
	Reports           int                       `json:"reports"`
	MatchPref         MatchPreference           `json:"matchPref,omitempty"`
	RecentActivity    []ActivityEntry           `json:"recentActivity,omitempty"`
	Banned            bool                      `json:"banned"`
	BanReason         string                    `json:"banReason,omitempty"`
}

// ReputationEntry represents a reputation/trust rating between players

// MissionPlan represents a planned mission route/strategy to share with the squad
type MissionPlan struct {
	ID            string     `json:"id"`
	Title         string     `json:"title"`       // e.g. "Rush Kuva Fortress", "Quick Steel Path"
	Description   string     `json:"description"` // What the plan involves
	CreatedBy     string     `json:"createdBy"`   // Player ID who created it
	CreatedByName string     `json:"createdByName"`
	Steps         []PlanStep `json:"steps"`         // Ordered list of actions
	EstimatedTime int        `json:"estimatedTime"` // minutes
	Difficulty    string     `json:"difficulty"`    // "easy", "medium", "hard"
	IsShared      bool       `json:"isShared"`      // Whether shared to squad
	CreatedAt     time.Time  `json:"createdAt"`
}

// PlanStep represents one step in a mission plan
type PlanStep struct {
	Order    int    `json:"order"`
	Action   string `json:"action"`  // "drop at", "kill", "collect", "escape"
	Target   string `json:"target"`  // location, enemy type, item
	Details  string `json:"details"` // additional info
	Optional bool   `json:"optional"`
}

// WantedPost represents a player's request for a specific role/item/action
type WantedPost struct {
	ID         string    `json:"id"`
	PlayerID   string    `json:"playerId"`
	PlayerName string    `json:"playerName"`
	Type       string    `json:"type"`     // "role", "item", "action", "help"
	Content    string    `json:"content"`  // e.g. "Need Viper for survival", "Looking for Duviri paradox runs"
	Priority   string    `json:"priority"` // "urgent", "normal", "low"
	ExpiresAt  time.Time `json:"expiresAt"`
	CreatedAt  time.Time `json:"createdAt"`
	Responded  bool      `json:"responded"`
	Response   string    `json:"response,omitempty"`
}

// QuickAction represents a one-click intent to express what you're looking for
type QuickAction struct {
	ID         string    `json:"id"`
	PlayerID   string    `json:"playerId"`
	PlayerName string    `json:"playerName"`
	Action     string    `json:"action"`            // "looking_for_squad", "offering_help", "wanted_role", "skip_mission"
	Message    string    `json:"message"`           // Custom message
	Mission    string    `json:"mission,omitempty"` // Specific mission if relevant
	Planet     string    `json:"planet,omitempty"`
	Duration   int       `json:"duration,omitempty"` // How long available (minutes)
	CreatedAt  time.Time `json:"createdAt"`
	ExpiresAt  time.Time `json:"expiresAt"`
}

// PlayingNow represents what a player is currently doing in Warframe
type PlayingNow struct {
	PlayerID   string    `json:"playerId"`
	PlayerName string    `json:"playerName"`
	Mission    string    `json:"mission,omitempty"`
	Planet     string    `json:"planet,omitempty"`
	Node       string    `json:"node,omitempty"`
	Activity   string    `json:"activity,omitempty"` // "playing", "in_lobby", "afk"
	Since      time.Time `json:"since"`
	WithSquad  bool      `json:"withSquad"`
}

// ActivityRecord represents a recent activity for a player (for trust/verification)
type ActivityRecord struct {
	MissionType string    `json:"missionType"`
	Planet      string    `json:"planet"`
	Difficulty  string    `json:"difficulty"`
	Completed   bool      `json:"completed"`
	Timestamp   time.Time `json:"timestamp"`
}

// MatchPreference represents a player's preferences for finding matches
type MatchPreference struct {
	Playstyle string `json:"playstyle"` // "casual", "serious", "learning", "any"
	SquadSize int    `json:"squadSize"` // 4 or 6 (0 = any)
	MinMR     int    `json:"minMR"`     // minimum mastery rank preference
}

// RecentActivity represents aggregated recent activity for a player
type RecentActivity struct {
	PlayerID      string           `json:"playerId"`
	Activities    []ActivityRecord `json:"activities"`
	LastActive    time.Time        `json:"lastActive"`
	TotalMissions int              `json:"totalMissions"`
}
type ReputationEntry struct {
	FromPlayerID string    `json:"fromPlayerId"`
	ToPlayerID   string    `json:"toPlayerId"`
	Rating       int       `json:"rating"` // 1-5 stars
	Comment      string    `json:"comment"`
	Timestamp    time.Time `json:"timestamp"`
	MissionType  string    `json:"missionType"`
}

// TrustScore calculates the player's trust score.
// Simple system: everyone starts at 50, +0.5 per completed squad mission,
// -10 per report. No caps, no floors — good play always climbs, bad play
// always hurts, and you can always earn your way back.
func (p *Player) TrustScoreValue() float64 {
	score := 50.0
	score += float64(p.TotalMissions) * 0.5
	score -= float64(p.Reports) * 10.0
	return score
}

func min(a, b float64) float64 {
	if a < b {
		return a
	}
	return b
}

func max(a, b float64) float64 {
	if a > b {
		return a
	}
	return b
}

// ChatMessage represents a message sent in squad chat
type ChatMessage struct {
	ID         string    `json:"id"`
	SquadID    string    `json:"squadId"`
	SenderID   string    `json:"senderId"`
	SenderName string    `json:"senderName"`
	Content    string    `json:"content"`
	Timestamp  time.Time `json:"timestamp"`
	Type       string    `json:"type"` // "message", "system", "join", "leave"
}

// Available mission types in Warframe. Pure gamemodes and special activities
// only. Modifiers (Steel Path, Nightmare, Void Fissure) are separate boolean
// fields on the squad, not entries here.
var AvailableMissions = []string{
	"Any",
	"Archon Hunt",
	"Arbitration",
	"Assassination",
	"Cascade (Level Cap)",
	"Capture",
	"Circuit",
	"Defense",
	"Descendia",
	"Disruption",
	"Dragon Key Vaults",
	"Duviri",
	"EDA (Deep Archimedea)",
	"Eidolon Hunt",
	"ETA (Temporal Archimedea)",
	"Excavation",
	"Exterminate",
	"Exploiter Orb",
	"Infested Salvage",
	"Interception",
	"Junction",
	"Mobile Defense",
	"Netracell",
	"Open World",
	"Perrita Rebellion",
	"Profit-Taker",
	"Quest",
	"Rescue",
	"Sabotage",
	"Sanctuary Onslaught",
	"Spy",
	"Survival",
}

// Available objectives for a squad run
var AvailableObjectives = []string{
	"any",
	"clear",
	"farm",
	"other",
}

// Available mission modifiers (stack on top of the mission type)
var AvailableModifiers = []string{
	"Steel Path",
	"Nightmare",
	"Void Fissure",
}

// Available planets in Warframe (alphabetical)
var AvailablePlanets = []string{
	"Any",
	"Cambion Drift",
	"Deimos",
	"Duviri",
	"Earth",
	"Eris",
	"Höllvania",
	"Jupiter",
	"Mars",
	"Mercury",
	"Neptune",
	"Pluto",
	"Saturn",
	"Sedna",
	"Uranus",
	"Venus",
	"Void",
	"Zariman",
}

// Available difficulties (alphabetical)
var AvailableDifficulties = []string{
	"Any",
	"Duviri",
	"Endless",
	"Normal",
	"Steel Path",
	"The Circuit",
}

// Available regions (alphabetical)
var AvailableRegions = []string{
	"Any",
	"Asia",
	"EU",
	"NA-East",
	"NA-West",
	"OC",
	"SA",
}

// Available platforms (alphabetical)
var AvailablePlatforms = []string{
	"PC",
	"PlayStation",
	"Switch",
	"Xbox",
}

// Available languages (alphabetical)
var AvailableLanguages = []string{
	"Any",
	"Chinese",
	"English",
	"French",
	"German",
	"Japanese",
	"Korean",
	"Portuguese",
	"Russian",
	"Spanish",
}

// Available experience levels
var AvailableExperienceLevels = []string{
	"any",
	"new",
	"veteran",
	"mr5",
	"mr10",
	"mr15",
	"mr20",
	"mr25+",
}

// Available playstyles
var AvailablePlaystyles = []string{
	"any",
	"stealth",
	"speed",
	"loot",
	"efficiency",
	"chill",
	"learning",
}

// Available mod rank requirements
var AvailableModRanks = []string{
	"any",
	"unranked",
	"half",
	"full",
	"minmaxed",
}

// Available relic tiers
var AvailableRelicTiers = []string{
	"Lith",
	"Meso",
	"Neo",
	"Axi",
	"Requiem",
}

// Report reasons
var ReportReasons = []string{
	"toxic_behavior",
	"scamming",
	"afk",
	"leaving_early",
	"harassment",
	"spam",
	"other",
}

// Ban durations in hours
const (
	BanDuration1Hour   = 1
	BanDuration24Hours = 24
	BanDuration7Days   = 168
	BanDuration30Days  = 720
	BanDurationPerm    = -1
)

// ---------------------------------------------------------------------------
// Persistence (JSON file for user-generated content)
// ---------------------------------------------------------------------------

const storeFile = "/home/student/Project/project-one/backend-go/internal/squad/store.json"

// Store holds mutable state that survives restarts.
type Store struct {
	Games      map[string]*Game     `json:"games"`
	CustomCats map[string]*Category `json:"customCats"`
}

func loadStore() *Store {
	s := &Store{
		Games:      make(map[string]*Game),
		CustomCats: make(map[string]*Category),
	}
	data, err := os.ReadFile(storeFile)
	if err != nil {
		return s
	}
	_ = json.Unmarshal(data, s)
	return s
}

func (s *Store) save() {
	data, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return
	}
	_ = os.WriteFile(storeFile, data, 0644)
}

func newID() string {
	return uuid.New().String()
}

// seedGames returns the default games and their categories.
func seedGames() []*Game {
	now := time.Now()
	return []*Game{
		{
			ID:          "game_warframe",
			Name:        "Warframe",
			Slug:        "warframe",
			Description: "Find squads for missions, farms, and endgame content across the Origin System.",
			Icon:        "🪐",
			IsCustom:    false,
			CreatedBy:   "system",
			CreatedAt:   now,
			Categories: []Category{
				{ID: "cat_wf_survival", Name: "Survival", Icon: "⏳", IsCustom: false, CreatedBy: "system", CreatedAt: now},
				{ID: "cat_wf_disruption", Name: "Disruption", Icon: "🔮", IsCustom: false, CreatedBy: "system", CreatedAt: now},
				{ID: "cat_wf_excavation", Name: "Excavation", Icon: "⛏️", IsCustom: false, CreatedBy: "system", CreatedAt: now},
				{ID: "cat_wf_defense", Name: "Defense", Icon: "🛡️", IsCustom: false, CreatedBy: "system", CreatedAt: now},
				{ID: "cat_wf_spy", Name: "Spy", Icon: "🕵️", IsCustom: false, CreatedBy: "system", CreatedAt: now},
				{ID: "cat_wf_rescue", Name: "Rescue", Icon: "🚨", IsCustom: false, CreatedBy: "system", CreatedAt: now},
				{ID: "cat_wf_capture", Name: "Capture", Icon: "🎯", IsCustom: false, CreatedBy: "system", CreatedAt: now},
				{ID: "cat_wf_exterminate", Name: "Exterminate", Icon: "💀", IsCustom: false, CreatedBy: "system", CreatedAt: now},
				{ID: "cat_wf_assassination", Name: "Assassination", Icon: "🗡️", IsCustom: false, CreatedBy: "system", CreatedAt: now},
				{ID: "cat_wf_mobile_defense", Name: "Mobile Defense", Icon: "🚂", IsCustom: false, CreatedBy: "system", CreatedAt: now},
				{ID: "cat_wf_interception", Name: "Interception", Icon: "📡", IsCustom: false, CreatedBy: "system", CreatedAt: now},
				{ID: "cat_wf_sabotage", Name: "Sabotage", Icon: "💣", IsCustom: false, CreatedBy: "system", CreatedAt: now},
				{ID: "cat_wf_void_fissure", Name: "Void Fissure", Icon: "🌀", IsCustom: false, CreatedBy: "system", CreatedAt: now},
				{ID: "cat_wf_arbitration", Name: "Arbitration", Icon: "⚖️", IsCustom: false, CreatedBy: "system", CreatedAt: now},
				{ID: "cat_wf_steel_path", Name: "Steel Path", Icon: "🔥", IsCustom: false, CreatedBy: "system", CreatedAt: now},
				{ID: "cat_wf_nightmare", Name: "Nightmare", Icon: "😱", IsCustom: false, CreatedBy: "system", CreatedAt: now},
				{ID: "cat_wf_archon_hunt", Name: "Archon Hunt", Icon: "👹", IsCustom: false, CreatedBy: "system", CreatedAt: now},
				{ID: "cat_wf_duviri", Name: "Duviri", Icon: "🌿", IsCustom: false, CreatedBy: "system", CreatedAt: now},
				{ID: "cat_wf_sanctuary", Name: "Sanctuary Onslaught", Icon: "🏛️", IsCustom: false, CreatedBy: "system", CreatedAt: now},
				{ID: "cat_wf_profit_taker", Name: "Profit-Taker", Icon: "💰", IsCustom: false, CreatedBy: "system", CreatedAt: now},
				{ID: "cat_wf_exploiter", Name: "Exploiter Orb", Icon: "🤖", IsCustom: false, CreatedBy: "system", CreatedAt: now},
				{ID: "cat_wf_eidolon", Name: "Eidolon Hunt", Icon: "🦌", IsCustom: false, CreatedBy: "system", CreatedAt: now},
				{ID: "cat_wf_dragon_key", Name: "Dragon Key Vaults", Icon: "🐉", IsCustom: false, CreatedBy: "system", CreatedAt: now},
				{ID: "cat_wf_cascade", Name: "Cascade (Level Cap)", Icon: "🌊", IsCustom: false, CreatedBy: "system", CreatedAt: now},
				{ID: "cat_wf_descendia", Name: "Descendia", Icon: "🏔️", IsCustom: false, CreatedBy: "system", CreatedAt: now},
				{ID: "cat_wf_eda", Name: "EDA (Deep Archimedea)", Icon: "🔬", IsCustom: false, CreatedBy: "system", CreatedAt: now},
				{ID: "cat_wf_eta", Name: "ETA (Temporal Archimedea)", Icon: "⏱️", IsCustom: false, CreatedBy: "system", CreatedAt: now},
				{ID: "cat_wf_perrita", Name: "Perrita Rebellion", Icon: "⚔️", IsCustom: false, CreatedBy: "system", CreatedAt: now},
				{ID: "cat_wf_circuit", Name: "Circuit", Icon: "🔄", IsCustom: false, CreatedBy: "system", CreatedAt: now},
				{ID: "cat_wf_netracell", Name: "Netracell", Icon: "🧬", IsCustom: false, CreatedBy: "system", CreatedAt: now},
				{ID: "cat_wf_open_world", Name: "Open World", Icon: "🌍", IsCustom: false, CreatedBy: "system", CreatedAt: now},
				{ID: "cat_wf_junction", Name: "Junction", Icon: "🔀", IsCustom: false, CreatedBy: "system", CreatedAt: now},
				{ID: "cat_wf_quest", Name: "Quest", Icon: "📜", IsCustom: false, CreatedBy: "system", CreatedAt: now},
				{ID: "cat_wf_salvage", Name: "Infested Salvage", Icon: "🦠", IsCustom: false, CreatedBy: "system", CreatedAt: now},
			},
		},
		{
			ID:          "game_destiny2",
			Name:        "Destiny 2",
			Slug:        "destiny2",
			Description: "LFG for raids, dungeons, Nightfalls, Crucible, and Gambit.",
			Icon:        "🛡️",
			IsCustom:    false,
			CreatedBy:   "system",
			CreatedAt:   now,
			Categories: []Category{
				{ID: "cat_d2_raid", Name: "Raid", Icon: "⚔️", IsCustom: false, CreatedBy: "system", CreatedAt: now},
				{ID: "cat_d2_dungeon", Name: "Dungeon", Icon: "🏰", IsCustom: false, CreatedBy: "system", CreatedAt: now},
				{ID: "cat_d2_nightfall", Name: "Nightfall", Icon: "🌙", IsCustom: false, CreatedBy: "system", CreatedAt: now},
				{ID: "cat_d2_crucible", Name: "Crucible", Icon: "🏟️", IsCustom: false, CreatedBy: "system", CreatedAt: now},
				{ID: "cat_d2_gambit", Name: "Gambit", Icon: "🎲", IsCustom: false, CreatedBy: "system", CreatedAt: now},
				{ID: "cat_d2_story", Name: "Story Mission", Icon: "📖", IsCustom: false, CreatedBy: "system", CreatedAt: now},
				{ID: "cat_d2_exotic", Name: "Exotic Quest", Icon: "✨", IsCustom: false, CreatedBy: "system", CreatedAt: now},
				{ID: "cat_d2_seasonal", Name: "Seasonal Activity", Icon: "🌟", IsCustom: false, CreatedBy: "system", CreatedAt: now},
			},
		},
		{
			ID:          "game_valorant",
			Name:        "Valorant",
			Slug:        "valorant",
			Description: "Find teammates for competitive, unrated, and custom games.",
			Icon:        "🎯",
			IsCustom:    false,
			CreatedBy:   "system",
			CreatedAt:   now,
			Categories: []Category{
				{ID: "cat_val_competitive", Name: "Competitive", Icon: "🏆", IsCustom: false, CreatedBy: "system", CreatedAt: now},
				{ID: "cat_val_unrated", Name: "Unrated", Icon: "🎮", IsCustom: false, CreatedBy: "system", CreatedAt: now},
				{ID: "cat_val_spikerush", Name: "Spike Rush", Icon: "⚡", IsCustom: false, CreatedBy: "system", CreatedAt: now},
				{ID: "cat_val_deathmatch", Name: "Deathmatch", Icon: "💀", IsCustom: false, CreatedBy: "system", CreatedAt: now},
				{ID: "cat_val_custom", Name: "Custom Game", Icon: "🔧", IsCustom: false, CreatedBy: "system", CreatedAt: now},
				{ID: "cat_val_swiftplay", Name: "Swiftplay", Icon: "🏃", IsCustom: false, CreatedBy: "system", CreatedAt: now},
			},
		},
		{
			ID:          "game_lethal_company",
			Name:        "Lethal Company",
			Slug:        "lethal-company",
			Description: "Suit up with crews to scrap moons and survive the horrors within.",
			Icon:        "🏭",
			IsCustom:    false,
			CreatedBy:   "system",
			CreatedAt:   now,
			Categories: []Category{
				{ID: "cat_lc_experimentation", Name: "Experimentation", Icon: "🧪", IsCustom: false, CreatedBy: "system", CreatedAt: now},
				{ID: "cat_lc_assurance", Name: "Assurance", Icon: "🏜️", IsCustom: false, CreatedBy: "system", CreatedAt: now},
				{ID: "cat_lc_vow", Name: "Vow", Icon: "🌿", IsCustom: false, CreatedBy: "system", CreatedAt: now},
				{ID: "cat_lc_artic", Name: "Rend / Dine / Titan", Icon: "❄️", IsCustom: false, CreatedBy: "system", CreatedAt: now},
				{ID: "cat_lc_quota", Name: "Quota Grind", Icon: "📊", IsCustom: false, CreatedBy: "system", CreatedAt: now},
			},
		},
		{
			ID:          "game_deep_rock",
			Name:        "Deep Rock Galactic",
			Slug:        "deep-rock-galactic",
			Description: "Rock and Stone! Find dwarves for mining missions deep underground.",
			Icon:        "⛏️",
			IsCustom:    false,
			CreatedBy:   "system",
			CreatedAt:   now,
			Categories: []Category{
				{ID: "cat_drg_mining", Name: "Mining Expedition", Icon: "💎", IsCustom: false, CreatedBy: "system", CreatedAt: now},
				{ID: "cat_drg_egg", Name: "Egg Hunt", Icon: "🥚", IsCustom: false, CreatedBy: "system", CreatedAt: now},
				{ID: "cat_drg_salvage", Name: "Salvage Operation", Icon: "🔧", IsCustom: false, CreatedBy: "system", CreatedAt: now},
				{ID: "cat_drg_elimination", Name: "Elimination", Icon: "💀", IsCustom: false, CreatedBy: "system", CreatedAt: now},
				{ID: "cat_drg_point", Name: "Point Extraction", Icon: "📦", IsCustom: false, CreatedBy: "system", CreatedAt: now},
			},
		},
	}
}