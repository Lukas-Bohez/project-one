package squad

import (
	"crypto/subtle"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"
)

// SquadStatus represents the current state of a squad
type SquadStatus string

const (
	SquadStatusOpen    SquadStatus = "open"
	SquadStatusFull    SquadStatus = "full"
	SquadStatusInGame  SquadStatus = "in_game"
	SquadStatusClosed  SquadStatus = "closed"
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
    case RoleDPS: return "DPS"
    case RoleSupport: return "Support"
    case RoleBuffer: return "Buffer"
    case RoleShield: return "Shield"
    case RoleArcane: return "Arcane"
    case RoleResource: return "Resource"
    case RoleEfficiency: return "Efficiency"
    default: return "Any"
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
SquadID      string   `json:"squadId"`
SquadName    string   `json:"squadName"`
Mission      string   `json:"mission"`
Planet       string   `json:"planet"`
Difficulty   string   `json:"difficulty"`
Success      bool     `json:"success"`
PlayedWith   []string `json:"playedWith"`  // Player IDs
PlayedAt     time.Time `json:"playedAt"`
}
// Security constants
const (
	MaxMessageLength    = 500
	MaxSquadNameLength  = 40
	MaxPlayerNameLength = 20
	MinPlayerNameLength = 2
	MaxChatHistory      = 100
	RateLimitMessages   = 5
	RateLimitWindow     = 10 * time.Second
)

// Validation patterns
var (
	validUsernamePattern = regexp.MustCompile(`^[a-zA-Z0-9_\-\[\]]+$`)
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
	ID              string       `json:"id"`
	Name            string       `json:"name"`
	Mission         string       `json:"missionType"`
	Planet          string       `json:"planet"`
	Node            string       `json:"node"`
	Difficulty      string       `json:"difficulty"`
	Region          string       `json:"region"`
	Language        string       `json:"language"`
	Status          SquadStatus  `json:"status"`
	LeaderID        string       `json:"leaderId"`
	LeaderName      string       `json:"leaderName"`
	LeaderTrust     float64      `json:"leaderTrust"`
	Players         []*Player    `json:"players"`
	MaxPlayers      int          `json:"maxPlayers"`
	Mode           SquadMode   `json:"mode"` // "casual" or "serious"
	SquadSize     int         `json:"squadSize"` // 4 or 6
	CreatedAt       time.Time    `json:"createdAt"`
	UpdatedAt       time.Time    `json:"updatedAt"`
	Tags            []string     `json:"tags"`
	Description     string       `json:"description"`
	Requirements    string       `json:"requirements"`
	VoiceChat       bool         `json:"voiceChat"`
	Experience      string       `json:"experience"` // "new", "veteran", "any"
	Playstyle       string       `json:"playstyle"`  // "stealth", "speed", "loot", "any"
	Relics          []string     `json:"relics"`

    // Role assignments: playerID -> role
    Roles           map[string]PlayerRole `json:"roles,omitempty"`
    // Drop targets: item name -> list of player IDs who want it
    DropTargets     map[string][]string  `json:"dropTargets,omitempty"`
    // Session tracking
    SessionStarted  bool        `json:"sessionStarted"`
    SessionStartedAt time.Time `json:"sessionStartedAt,omitempty"`
    SessionEnded    bool        `json:"sessionEnded"`
    SessionEndedAt  time.Time `json:"sessionEndedAt,omitempty"`
    SessionDuration int         `json:"sessionDuration"` // minutes
    SessionSuccess  bool        `json:"sessionSuccess"`
    SessionReport   *SessionReport `json:"sessionReport,omitempty"`
	ModRank         string       `json:"modRank"`
	MissionTime     int          `json:"missionTime"` // estimated minutes
	IsCrossPlatform bool         `json:"isCrossPlatform"`
	IsRecruiting    bool         `json:"isRecruiting"`
	Views           int          `json:"views"`
	JoinRequests    int          `json:"joinRequests"`
}

// SquadFilter represents filters for searching squads
type SquadFilter struct {
	Mission     string `json:"mission"`
	Planet      string `json:"planet"`
	Node        string `json:"node"`
	Difficulty  string `json:"difficulty"`
	Region      string `json:"region"`
	Language    string `json:"language"`
	HasSlots    bool   `json:"hasSlots"`
	MinTrust    int    `json:"minTrust"`
	Experience  string `json:"experience"`
	Playstyle   string `json:"playstyle"`
	VoiceChat   bool   `json:"voiceChat"`
	CrossPlatform bool `json:"crossPlatform"`
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
	MatchPref       MatchPreference  `json:"matchPref,omitempty"`
	RecentActivity   []ActivityEntry   `json:"recentActivity,omitempty"`
	Banned            bool                      `json:"banned"`
	BanReason         string                    `json:"banReason,omitempty"`
}

// ReputationEntry represents a reputation/trust rating between players

// MissionPlan represents a planned mission route/strategy to share with the squad
type MissionPlan struct {
ID          string       `json:"id"`
Title       string       `json:"title"`       // e.g. "Rush Kuva Fortress", "Quick Steel Path"
Description string       `json:"description"` // What the plan involves
CreatedBy   string       `json:"createdBy"`   // Player ID who created it
CreatedByName string     `json:"createdByName"`
Steps       []PlanStep   `json:"steps"`       // Ordered list of actions
EstimatedTime int        `json:"estimatedTime"` // minutes
Difficulty   string      `json:"difficulty"`   // "easy", "medium", "hard"
IsShared     bool        `json:"isShared"`     // Whether shared to squad
CreatedAt    time.Time   `json:"createdAt"`
}

// PlanStep represents one step in a mission plan
type PlanStep struct {
Order    int    `json:"order"`
Action   string `json:"action"`   // "drop at", "kill", "collect", "escape"
Target   string `json:"target"`   // location, enemy type, item
Details  string `json:"details"`  // additional info
Optional bool   `json:"optional"`
}

// WantedPost represents a player's request for a specific role/item/action
type WantedPost struct {
ID        string    `json:"id"`
PlayerID  string    `json:"playerId"`
PlayerName string   `json:"playerName"`
Type      string    `json:"type"`  // "role", "item", "action", "help"
Content   string    `json:"content"` // e.g. "Need Viper for survival", "Looking for Duviri paradox runs"
Priority  string    `json:"priority"` // "urgent", "normal", "low"
ExpiresAt time.Time `json:"expiresAt"`
CreatedAt time.Time `json:"createdAt"`
Responded bool      `json:"responded"`
Response  string    `json:"response,omitempty"`
}

// QuickAction represents a one-click intent to express what you're looking for
type QuickAction struct {
ID        string    `json:"id"`
PlayerID  string    `json:"playerId"`
PlayerName string   `json:"playerName"`
Action    string    `json:"action"` // "looking_for_squad", "offering_help", "wanted_role", "skip_mission"
Message   string    `json:"message"` // Custom message
Mission   string    `json:"mission,omitempty"` // Specific mission if relevant
Planet    string    `json:"planet,omitempty"`
Duration  int       `json:"duration,omitempty"` // How long available (minutes)
CreatedAt time.Time `json:"createdAt"`
ExpiresAt time.Time `json:"expiresAt"`
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
Playstyle  string `json:"playstyle"`  // "casual", "serious", "learning", "any"
SquadSize  int    `json:"squadSize"`   // 4 or 6 (0 = any)
MinMR      int    `json:"minMR"`       // minimum mastery rank preference
}

// RecentActivity represents aggregated recent activity for a player
type RecentActivity struct {
PlayerID    string        `json:"playerId"`
Activities  []ActivityRecord `json:"activities"`
LastActive  time.Time     `json:"lastActive"`
TotalMissions int         `json:"totalMissions"`
}
type ReputationEntry struct {
	FromPlayerID string    `json:"fromPlayerId"`
	ToPlayerID   string    `json:"toPlayerId"`
	Rating       int       `json:"rating"` // 1-5 stars
	Comment      string    `json:"comment"`
	Timestamp    time.Time `json:"timestamp"`
	MissionType  string    `json:"missionType"`
}

// TrustFactors calculates trust score based on various metrics
func (p *Player) CalculateTrustScore() float64 {
	score := 50.0 // Base score

	// Verification bonus
	switch p.VerificationLevel {
	case VerificationVerified:
		score += 20
	case VerificationPremium:
		score += 30
	}

	// Reputation bonus (max 20 points)
	if p.Reputation > 0 {
		score += min(20, float64(p.Reputation)*0.5)
	}

	// Mission experience bonus (max 10 points)
	score += min(10, float64(p.TotalMissions)*0.1)

	// Penalty for reports
	score -= float64(p.Reports) * 10

	// Clan membership bonus
	if p.ClanTag != "" {
		score += 5
	}

	return max(0, min(100, score))
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
	ID        string    `json:"id"`
	SquadID   string    `json:"squadId"`
	SenderID  string    `json:"senderId"`
	SenderName string   `json:"senderName"`
	Content   string    `json:"content"`
	Timestamp time.Time `json:"timestamp"`
	Type      string    `json:"type"` // "message", "system", "join", "leave"
}

// Available missions in Warframe
var AvailableMissions = []string{
	"Exterminate",
	"Survival",
	"Defense",
	"Rescue",
	"Sabotage",
	"Spy",
	"Capture",
	"Mobile Defense",
	"Interception",
	"Disruption",
	"Excavation",
	"Void Fissure",
	"Arbitration",
	"Nightmare",
	"Steel Path",
	"Archon Hunt",
	"Duviri",
	"Sanctuary Onslaught",
	"Profit-Taker",
	"Exploiter Orb",
	"Eidolon Hunt",
	"Junction",
	"Quest",
	"Open World",
	"Circuit",
	"Netracell",
	"Assassination",
	"Infested Salvage",
	"Disruption",
	"Any",
}

// Available planets in Warframe
var AvailablePlanets = []string{
	"Earth",
	"Venus",
	"Mars",
	"Jupiter",
	"Saturn",
	"Uranus",
	"Neptune",
	"Pluto",
	"Eris",
	"Sedna",
	"Void",
	"Deimos",
	"Zariman",
	"Duviri",
	"Höllvania",
	"Mercury",
	"Cambion Drift",
	"Any",
}

// Available difficulties
var AvailableDifficulties = []string{
	"Normal",
	"Steel Path",
	"Endless",
	"The Circuit",
	"Duviri",
	"Any",
}

// Available regions
var AvailableRegions = []string{
	"NA-East",
	"NA-West",
	"EU",
	"OC",
	"Asia",
	"SA",
	"Any",
}

// Available platforms
var AvailablePlatforms = []string{
	"PC",
	"PlayStation",
	"Xbox",
	"Switch",
}

// Available languages
var AvailableLanguages = []string{
	"English",
	"French",
	"German",
	"Spanish",
	"Portuguese",
	"Russian",
	"Chinese",
	"Japanese",
	"Korean",
	"Any",
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
