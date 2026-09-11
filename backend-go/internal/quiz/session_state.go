package quiz

import (
	"sync"
	"time"

	"github.com/Lukas-Bohez/project-one/backend-go/internal/models"
)

// Phase represents the current state of a quiz session.
type Phase string

const (
	PhaseVoting       Phase = "voting"
	PhaseThemeDisplay Phase = "theme_display"
	PhaseQuiz         Phase = "quiz"
	PhaseExplanation  Phase = "explanation"
	PhaseFinished     Phase = "finished"
)

// Timer durations (seconds) — fixed values, no hardware sensor dependency.
const (
	VotingTime       = 33
	ThemeDisplayTime = 10
	DefaultQuestionTime = 20
	DefaultExplanationTime = 10
	TickInterval     = 500 * time.Millisecond
)

// PlayerInfo tracks a connected player.
type PlayerInfo struct {
	UserID   int64  `json:"userId"`
	Username string `json:"username"`
}

// QuizState tracks per-session in-memory game progress.
type QuizState struct {
	AskedQuestions []int64         `json:"asked_questions"`
	QuestionCount  int             `json:"question_count"`
	TotalScore     float64         `json:"total_score"`
	PlayerCount    int             `json:"player_count"`
	CurrentQuestion *models.Question `json:"current_question,omitempty"`
	WaitingForAnswers bool          `json:"waiting_for_answers"`
}

// SessionState holds all per-session runtime state.
type SessionState struct {
	mu                sync.Mutex
	SessionID         int64
	Phase             Phase
	QuizState         QuizState
	Players           map[int64]*PlayerInfo // userID -> player
	Votes             map[int64]int64       // themeID -> vote count
	UserVotes         map[int64]int64       // userID -> themeID
	GameLoopActive    bool
	LoopStopChan      chan struct{}
	Clients           map[*client]bool      // clients in this session
	hub               *Hub                  // back-reference to the quiz hub
}

// NewSessionState creates a new session state.
func NewSessionState(sessionID int64) *SessionState {
	return &SessionState{
		SessionID:    sessionID,
		Phase:        PhaseVoting,
		Players:      make(map[int64]*PlayerInfo),
		Votes:        make(map[int64]int64),
		UserVotes:      make(map[int64]int64),
		Clients:        make(map[*client]bool),
		QuizState: QuizState{
			AskedQuestions: []int64{},
		},
	}
}

// AddPlayer adds a player to the session. Returns true if newly added.
func (s *SessionState) AddPlayer(userID int64, username string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, exists := s.Players[userID]; exists {
		if username != "" {
			s.Players[userID].Username = username
		}
		return false
	}
	s.Players[userID] = &PlayerInfo{UserID: userID, Username: username}
	s.QuizState.PlayerCount = len(s.Players)
	return true
}

// RemovePlayer removes a player from the session.
func (s *SessionState) RemovePlayer(userID int64) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.Players, userID)
	delete(s.UserVotes, userID)
	s.QuizState.PlayerCount = len(s.Players)
}

// PlayerCount returns the current number of players.
func (s *SessionState) PlayerCount() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return len(s.Players)
}

// RecordVote records a theme vote for a user. Returns the updated vote counts.
func (s *SessionState) RecordVote(userID, themeID int64) map[int64]int64 {
	s.mu.Lock()
	defer s.mu.Unlock()
	if oldTheme, exists := s.UserVotes[userID]; exists {
		s.Votes[oldTheme]--
		if s.Votes[oldTheme] <= 0 {
			delete(s.Votes, oldTheme)
		}
	}
	s.Votes[themeID]++
	s.UserVotes[userID] = themeID
	result := make(map[int64]int64)
	for k, v := range s.Votes {
		result[k] = v
	}
	return result
}

// VoteCount returns the total number of votes.
func (s *SessionState) VoteCount() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	total := 0
	for _, v := range s.Votes {
		total += int(v)
	}
	return total
}

// WinningTheme returns the theme with the most votes (random tiebreak).
func (s *SessionState) WinningTheme() *int64 {
	s.mu.Lock()
	defer s.mu.Unlock()
	if len(s.Votes) == 0 {
		return nil
	}
	var maxVotes int64 = -1
	var winners []int64
	for themeID, votes := range s.Votes {
		if votes > maxVotes {
			maxVotes = votes
			winners = []int64{themeID}
		} else if votes == maxVotes {
			winners = append(winners, themeID)
		}
	}
	if len(winners) == 0 {
		return nil
	}
	// Simple deterministic selection (first in map iteration order)
	winning := winners[0]
	return &winning
}

// SetPhase sets the current phase.
func (s *SessionState) SetPhase(phase Phase) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.Phase = phase
}

// GetPhase returns the current phase.
func (s *SessionState) GetPhase() Phase {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.Phase
}

// AddClient registers a client connection in this session.
func (s *SessionState) AddClient(c *client) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.Clients[c] = true
}

// RemoveClient unregisters a client connection.
func (s *SessionState) RemoveClient(c *client) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.Clients, c)
}

// ClientCount returns the number of connected clients.
func (s *SessionState) ClientCount() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return len(s.Clients)
}

// HasActiveClients returns true if any clients are connected.
func (s *SessionState) HasActiveClients() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return len(s.Clients) > 0
}

// StartLoop starts the game loop goroutine.
func (s *SessionState) StartLoop() {
	s.mu.Lock()
	if s.GameLoopActive {
		s.mu.Unlock()
		return
	}
	s.GameLoopActive = true
	s.LoopStopChan = make(chan struct{})
	s.mu.Unlock()
	go s.runLoop()
}

// StopLoop stops the game loop goroutine.
func (s *SessionState) StopLoop() {
	s.mu.Lock()
	if !s.GameLoopActive {
		s.mu.Unlock()
		return
	}
	s.GameLoopActive = false
	stopChan := s.LoopStopChan
	s.mu.Unlock()
	close(stopChan)
}

// IsLoopRunning returns whether the game loop is active.
func (s *SessionState) IsLoopRunning() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.GameLoopActive
}