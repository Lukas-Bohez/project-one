// Sentle Game Logic - Word-by-Word Wordle with Arrangement Stage
class SentleGame {
    constructor() {
        this.sentence = '';
        this.words = [];
        this.currentWordIndex = 0;
        this.currentWord = '';
        this.currentGuess = '';
        this.wordGuesses = [];
        // Allow generous attempts; rows are added dynamically as you guess
        this.maxAttemptsPerWord = 50;
        this.gameStage = 'login'; // login | guessing | arranging | ended
        this.guessedWords = [];
        this.totalAttemptsUsed = 0;
        this.username = localStorage.getItem('sentle_username') || '';
        this.sessionToken = localStorage.getItem('sentle_session') || '';
        this.userId = localStorage.getItem('sentle_user_id') || '';
        this.stats = {
            gamesPlayed: 0,
            gamesWon: 0,
            currentStreak: 0,
            maxStreak: 0,
            totalScore: 0,
            playedToday: false,
        };
        this.keyboardState = {};
        this.sentenceId = null;
        this.targetDate = null;
        this.restoreStateDone = false;
        this.completed = false;
        this.scoreSubmitted = false;
        this.modalsSetup = false;
        this.originalWords = [];
        this.wordOrder = [];
        this.practiceMode = false;
        this.practicePayload = null;
        // Letter reveal mechanic (server-validated)
        this.maxReveals = 0;
        this.revealsUsed = 0;
        this.revealedLetters = {}; // {wordIndex: {letterIndex: true}}
        this.gameSessionId = null; // Server-side game session tracking
        this.init();
    }

    resetState(clearStorage = true) {
        this.currentWordIndex = 0;
        this.currentWord = '';
        this.currentGuess = '';
        this.wordGuesses = [];
        this.guessedWords = [];
        this.totalAttemptsUsed = 0;
        this.gameStage = 'guessing';
        this.restoreStateDone = false;
        this.completed = false;
        this.scoreSubmitted = false;
        this.keyboardState = {};
        this.wordOrder = [];
        this.originalWords = [];
        this.revealsUsed = 0;
        this.revealedLetters = {};
        this.resetKeyboard();
        if (clearStorage) this.clearSavedState();
    }

    resetKeyboard() {
        this.keyboardState = {};
        document.querySelectorAll('.key').forEach((key) => {
            key.classList.remove('correct', 'present', 'absent');
        });
    }

    async init() {
        // Always wire modal buttons even if game fails to load
        this.setupModals();

        // Check if a replay/practice payload was stored (e.g., from archive)
        const replayRaw = localStorage.getItem('sentle_replay_payload');
        if (replayRaw) {
            try {
                this.practicePayload = JSON.parse(replayRaw);
                this.practiceMode = true;
                // Clear the payload so it does not persist beyond this session
                localStorage.removeItem('sentle_replay_payload');
            } catch (e) {
                console.warn('Invalid replay payload; ignoring');
            }
        }

        // Load stats from database (or fallback) and validate session
        const { stats, validSession } = await this.loadStats();
        this.stats = stats;

        // Local safeguard: if we have stored a played-today flag for this user/date, honor it
        const localPlayed = this.hasLocalPlayedToday();
        if (localPlayed) this.stats.playedToday = true;

        // Always load leaderboards (public information)
        this.loadLeaderboard();

        // If stored token is invalid, clear and show login instead of auto-starting a broken session
        if (!validSession && !this.practiceMode) {
            this.clearSessionAuth();
            this.showLoginScreen();
            return;
        }

        if (this.practiceMode) {
            this.hideLoginScreen();
            this.startPracticeGame();
            return;
        }

        if (this.sessionToken && this.username) {
            this.hideLoginScreen();
            // If already played, just show stats/leaderboards; otherwise start game
            if (this.stats.playedToday) {
                this.completed = true;
                this.scoreSubmitted = true;
                this.showMessage('You already played today. Come back tomorrow or view your stats/archives.', 'info');
                this.hideGameplayUI();
                this.loadLeaderboard();
                this.showStatsModal();
            } else {
                this.startGame();
            }
        } else {
            this.showLoginScreen();
        }
    }

    showLoginScreen() {
        const loginScreen = document.getElementById('loginScreen');
        const gameContainer = document.getElementById('gameContainer');
        if (loginScreen) loginScreen.style.display = 'flex';
        if (gameContainer) gameContainer.style.display = 'none';
        this.toggleForms('login');
    }

    hideLoginScreen() {
        const loginScreen = document.getElementById('loginScreen');
        const gameContainer = document.getElementById('gameContainer');
        if (loginScreen) loginScreen.style.display = 'none';
        if (gameContainer) gameContainer.style.display = 'block';
    }

    toggleForms(mode) {
        const loginForm = document.getElementById('loginForm');
        const regForm = document.getElementById('regForm');
        const tabLogin = document.getElementById('tabLogin');
        const tabRegister = document.getElementById('tabRegister');

        if (mode === 'register') {
            if (loginForm) loginForm.style.display = 'none';
            if (regForm) regForm.style.display = 'flex';
            if (tabLogin) tabLogin.classList.remove('active');
            if (tabRegister) tabRegister.classList.add('active');
        } else {
            if (loginForm) loginForm.style.display = 'flex';
            if (regForm) regForm.style.display = 'none';
            if (tabLogin) tabLogin.classList.add('active');
            if (tabRegister) tabRegister.classList.remove('active');
        }
    }

    async registerUser() {
        const firstName = document.getElementById('regFirst').value.trim();
        const lastName = document.getElementById('regLast').value.trim();
        const password = document.getElementById('regPassword').value.trim();
        const password2 = document.getElementById('regPassword2').value.trim();
        const errorDiv = document.getElementById('regError');

        // Clear previous errors
        if (errorDiv) {
            errorDiv.style.display = 'none';
            errorDiv.textContent = '';
        }

        if (!firstName || !lastName || !password || !password2) {
            const message = 'All fields are required';
            if (errorDiv) {
                errorDiv.textContent = message;
                errorDiv.style.display = 'block';
            }
            return;
        }

        if (password !== password2) {
            const message = 'Passwords do not match';
            if (errorDiv) {
                errorDiv.textContent = message;
                errorDiv.style.display = 'block';
            }
            return;
        }

        if (password.length < 6) {
            const message = 'Password must be at least 6 characters';
            if (errorDiv) {
                errorDiv.textContent = message;
                errorDiv.style.display = 'block';
            }
            return;
        }

        try {
            const response = await fetch('/api/sentle/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ first_name: firstName, last_name: lastName, password }),
            });

            const data = await response.json();

            if (response.ok) {
                const successDiv = errorDiv;
                if (successDiv) {
                    successDiv.textContent = 'Account created. Please login.';
                    successDiv.style.display = 'block';
                    successDiv.style.background = '#d4edda';
                    successDiv.style.color = '#155724';
                    successDiv.style.borderColor = '#c3e6cb';
                }
                setTimeout(() => this.toggleForms('login'), 2000);
            } else {
                const message = data.detail || 'Registration failed';
                if (errorDiv) {
                    errorDiv.textContent = message;
                    errorDiv.style.display = 'block';
                }
            }
        } catch (err) {
            const message = 'Registration error: ' + err.message;
            if (errorDiv) {
                errorDiv.textContent = message;
                errorDiv.style.display = 'block';
            }
        }
    }

    async loginUser() {
        const firstName = document.getElementById('loginFirst').value.trim();
        const lastName = document.getElementById('loginLast').value.trim();
        const password = document.getElementById('loginPassword').value.trim();
        const errorDiv = document.getElementById('loginError');

        console.log('Login attempt started');

        // Clear previous errors
        if (errorDiv) {
            errorDiv.style.display = 'none';
            errorDiv.textContent = '';
        }

        if (!firstName || !lastName || !password) {
            const message = 'First name, last name, and password are required';
            if (errorDiv) {
                errorDiv.textContent = message;
                errorDiv.style.display = 'block';
            }
            return;
        }

        try {
            const response = await fetch('/api/sentle/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ first_name: firstName, last_name: lastName, password }),
            });

            let data = {};
            try {
                data = await response.json();
            } catch (e) {
                // Non-JSON response; keep data empty
            }

            console.log('Login response:', { status: response.status, body: data });

            if (response.ok) {
                if (!data.session_token) {
                    const message = 'Login failed: missing session token from server';
                    if (errorDiv) {
                        errorDiv.textContent = message;
                        errorDiv.style.display = 'block';
                    }
                    this.showMessage(message, 'error');
                    console.error('Login failed: missing session_token in response');
                    return;
                }

                this.sessionToken = data.session_token;
                this.username = data.username;
                this.userId = data.user_id;
                localStorage.setItem('sentle_session', this.sessionToken);
                localStorage.setItem('sentle_username', this.username);
                if (this.userId) localStorage.setItem('sentle_user_id', this.userId);
                // Reload stats from database
                const { stats } = await this.loadStats();
                this.stats = stats;
                this.hideLoginScreen();

                // If the server says we already played today, skip straight to stats/info
                const playedToday = data.played_today || (this.stats && this.stats.playedToday);
                if (playedToday) {
                    this.completed = true;
                    this.scoreSubmitted = true;
                    this.showMessage('You already played today. Come back tomorrow or view your stats/archives.', 'info');
                    const keyboard = document.getElementById('keyboard');
                    const arrangementStage = document.getElementById('arrangementStage');
                    if (keyboard) keyboard.style.display = 'none';
                    if (arrangementStage) arrangementStage.style.display = 'none';
                    this.rememberPlayedToday(new Date().toISOString().slice(0, 10));
                    this.loadLeaderboard();
                    this.showStatsModal();
                    return;
                }

                this.startGame();
            } else {
                const message = data.detail || data.message || response.statusText || 'Login failed';
                if (errorDiv) {
                    errorDiv.textContent = message;
                    errorDiv.style.display = 'block';
                }
                // Also surface error in the main message area so it's visible even if the auth error div is hidden
                this.showMessage(message, 'error');
                console.error('Login failed:', { status: response.status, body: data });
            }
        } catch (err) {
            const message = 'Login error: ' + err.message;
            if (errorDiv) {
                errorDiv.textContent = message;
                errorDiv.style.display = 'block';
            }
            this.showMessage(message, 'error');
            console.error('Login error:', err);
        }
    }

    async startGame() {
        this.gameStage = 'guessing';
        // If the backend reports the user already played today, block starting a new game
        if (this.stats && this.stats.playedToday) {
            this.completed = true;
            this.scoreSubmitted = true;
            this.showMessage('You have already played today. Come back tomorrow!', 'info');
            const keyboard = document.getElementById('keyboard');
            const arrangementStage = document.getElementById('arrangementStage');
            if (keyboard) keyboard.style.display = 'none';
            if (arrangementStage) arrangementStage.style.display = 'none';
            this.rememberPlayedToday(new Date().toISOString().slice(0, 10));
            this.loadLeaderboard();
            this.showStatsModal();
            return;
        }
        await this.loadDailySentence();
        if (!this.sentence) {
            console.error('Failed to load daily sentence');
            return;
        }
        
        // CRITICAL: Verify words array is populated
        if (!this.words || this.words.length === 0) {
            console.error('CRITICAL: words array is empty after loadDailySentence', {
                sentence: this.sentence,
                originalWords: this.originalWords,
                words: this.words,
                wordOrder: this.wordOrder
            });
            this.showMessage('Failed to initialize game - please refresh', 'error');
            return;
        }
        
        console.log('✓ Sentence loaded:', {
            wordCount: this.words.length,
            words: this.words.map(w => w.length) // Log word lengths instead of actual words
        });

        // Try to restore saved state for this date; otherwise fresh
        this.checkGameState();
        // Validate restore; if not a clean guessing state, start fresh
        const validRestore =
            this.restoreStateDone &&
            this.gameStage === 'guessing' &&
            this.currentWordIndex < this.words.length &&
            this.guessedWords.length < this.words.length &&
            this.currentWord;

        if (!validRestore) {
            this.resetState(true);
            this.currentWordIndex = 0;
            this.currentWord = this.words[0];
            this.currentGuess = '';
            this.wordGuesses = [];
        }
        
        console.log('Before session init:', {
            currentWordIndex: this.currentWordIndex,
            currentWord: this.currentWord,
            wordsLength: this.words.length
        });

        // Initialize game session on server (secure tracking)
        if (!this.practiceMode) {
            await this.initializeGameSession();
        }
        
        // CRITICAL: Validate words array before using it
        console.log('After session init, validating words array:', {
            wordsIsArray: Array.isArray(this.words),
            wordsLength: this.words?.length,
            currentWordIndex: this.currentWordIndex,
            words: this.words
        });
        
        if (!Array.isArray(this.words) || this.words.length === 0) {
            console.error('CRITICAL: words is not a valid array after session init!', this.words);
            this.showMessage('Game initialization failed - please refresh', 'error');
            return;
        }
        
        // Ensure currentWordIndex is valid
        if (this.currentWordIndex < 0 || this.currentWordIndex >= this.words.length) {
            console.warn('Invalid currentWordIndex, resetting to 0');
            this.currentWordIndex = 0;
        }
        
        // Directly set currentWord from validated array
        this.currentWord = this.words[this.currentWordIndex];
        
        console.log('Set currentWord:', {
            type: typeof this.currentWord,
            isString: typeof this.currentWord === 'string',
            length: this.currentWord?.length
        });
        
        // FINAL safety check - if still undefined, something is very wrong
        if (!this.currentWord || typeof this.currentWord !== 'string') {
            console.error('CRITICAL: currentWord is STILL not a valid string!', {
                currentWord: this.currentWord,
                words: this.words,
                currentWordIndex: this.currentWordIndex,
                wordsAtIndex: this.words[this.currentWordIndex]
            });
            this.showMessage('Critical error: Cannot start game. Please refresh the page.', 'error');
            return;
        }
        
        console.log('✓ Ready to create board:', {
            currentWordLength: this.currentWord?.length,
            currentWordIndex: this.currentWordIndex
        });
        
        this.createBoard();
        this.setupEventListeners();
        this.updateProgress();
        this.loadLeaderboard();

        // Ensure the guessing UI is visible
        document.getElementById('gameBoard').style.display = 'block';
        document.getElementById('keyboard').style.display = 'block';
        const progress = document.querySelector('.game-progress');
        const currentWordSection = document.querySelector('.current-word-section');
        if (progress) progress.style.display = 'block';
        if (currentWordSection) currentWordSection.style.display = 'block';

        // Hide arrangement until the guessing stage is done
        const arrangementStage = document.getElementById('arrangementStage');
        if (arrangementStage) arrangementStage.style.display = 'none';
    }

    async startPracticeGame() {
        // Practice mode: use provided sentence payload, skip score submission
        this.gameStage = 'guessing';
        this.completed = false;
        this.scoreSubmitted = false;
        this.stats.playedToday = false;

        if (!this.practicePayload || !this.practicePayload.sentence) {
            this.showMessage('Practice sentence unavailable.', 'error');
            return;
        }

        // Load practice sentence
        this.sentence = this.practicePayload.sentence.toUpperCase();
        this.originalWords = this.sentence.split(' ');
        this.wordOrder = this.generateWordOrder(this.originalWords.length, this.practicePayload.wordOrder);
        this.words = this.wordOrder.map((idx) => this.originalWords[idx]);
        this.currentWord = this.words[0];
        this.sentenceId = this.practicePayload.id || null;
        this.targetDate = this.practicePayload.date || 'practice';

        // Reveals
        const totalLetters = this.sentence.replace(/\s/g, '').length;
        this.maxReveals = 0;  // Start with 0 reveals, gain 1 per failed guess
        this.updateRevealsDisplay();

        this.resetKeyboard();
        this.createBoard();
        this.setupEventListeners();
        this.updateProgress();

        // Show UI
        document.getElementById('gameBoard').style.display = 'block';
        document.getElementById('keyboard').style.display = 'block';
        const progress = document.querySelector('.game-progress');
        const currentWordSection = document.querySelector('.current-word-section');
        if (progress) progress.style.display = 'block';
        if (currentWordSection) currentWordSection.style.display = 'block';

        const arrangementStage = document.getElementById('arrangementStage');
        if (arrangementStage) arrangementStage.style.display = 'none';

        this.showMessage('Practice mode: scores won\'t submit.', 'info');
    }

    async initializeGameSession() {
        if (this.practiceMode) {
            console.log('Practice mode: skipping game session initialization');
            return; // No server tracking for practice
        }

        console.log('Initializing game session...', {
            sessionToken: this.sessionToken ? 'present' : 'missing',
            sentenceId: this.sentenceId,
            targetDate: this.targetDate
        });

        try {
            const response = await fetch('/api/sentle/game/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_token: this.sessionToken,
                    sentenceId: this.sentenceId,
                    date: this.targetDate
                })
            });

            const data = await response.json();
            console.log('Game session response:', { status: response.status, data });
            
            if (response.ok) {
                this.gameSessionId = data.game_session_id;
                this.currentWordIndex = data.current_word_index;
                this.totalAttemptsUsed = data.total_attempts;
                this.revealsUsed = data.reveals_used;
                this.completed = data.completed;

                console.log('✓ Game session initialized:', {
                    gameSessionId: this.gameSessionId,
                    currentWordIndex: this.currentWordIndex,
                    totalAttempts: this.totalAttemptsUsed
                });

                this.updateRevealsDisplay();
                this.showMessage('Game session initialized', 'info');
            } else {
                console.error('Failed to initialize game session:', data);
                // GRACEFUL DEGRADATION: Don't block gameplay, just disable server validation
                this.gameSessionId = null;
                console.warn('Playing without server-side validation (session init failed)');
                this.showMessage('Playing in offline mode', 'info');
            }
        } catch (err) {
            console.error('Error initializing game session:', err);
            // GRACEFUL DEGRADATION: Allow play without server tracking
            this.gameSessionId = null;
            console.warn('Playing without server-side validation (network error)');
            this.showMessage('Playing in offline mode', 'info');
        }
    }

    async loadDailySentence() {
        try {
            const response = await fetch('/api/sentle/daily');
            const data = await response.json();

            if (data && data.sentence) {
                this.sentence = data.sentence.toUpperCase();
                this.originalWords = this.sentence.split(' ');
                this.wordOrder = this.generateWordOrder(this.originalWords.length);
                this.words = this.wordOrder.map((idx) => this.originalWords[idx]);
                this.currentWord = this.words[0];
                this.sentenceId = data.id;
                this.targetDate = data.date;
                // Calculate max reveals: start with 0, gain 1 per failed guess
                const totalLetters = this.sentence.replace(/\s/g, '').length;
                this.maxReveals = 0;
                this.updateRevealsDisplay();
            } else {
                this.showMessage('No sentence available today. Check back tomorrow!', 'error');
            }
        } catch (err) {
            console.error('Error loading sentence:', err);
            this.showMessage('Error loading game. Please try again.', 'error');
        }
    }

    generateWordOrder(length, existingOrder = null) {
        if (existingOrder && Array.isArray(existingOrder) && existingOrder.length === length) {
            return existingOrder;
        }
        const order = Array.from({ length }, (_, i) => i);
        for (let i = order.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [order[i], order[j]] = [order[j], order[i]];
        }
        return order;
    }

    createBoard() {
        const board = document.getElementById('gameBoard');
        board.innerHTML = '';

        // Always show at least 5 rows, then grow as needed
        const rowsNeeded = Math.max(this.wordGuesses.length + 1, 5);
        for (let i = 0; i < rowsNeeded; i++) {
            const row = document.createElement('div');
            row.className = 'guess-row';
            row.id = `row-${i}`;

            for (let j = 0; j < this.currentWord.length; j++) {
                const box = document.createElement('div');
                box.className = 'letter-box';
                box.id = `box-${i}-${j}`;
                box.dataset.letterIndex = j;
                
                // If this is the current row and letter is revealed, show it
                if (i === this.wordGuesses.length && this.isLetterRevealed(this.currentWordIndex, j)) {
                    box.textContent = this.currentWord[j];
                    box.classList.add('revealed');
                }
                
                // Make current empty row boxes clickable for reveals
                if (i === this.wordGuesses.length && this.revealsUsed < this.maxReveals) {
                    box.style.cursor = 'pointer';
                    box.addEventListener('click', () => this.revealLetter(j));
                }
                
                row.appendChild(box);
            }

            board.appendChild(row);
        }
    }

    ensureNextRow() {
        const board = document.getElementById('gameBoard');
        const currentRows = board.querySelectorAll('.guess-row').length;
        const needed = Math.max(this.wordGuesses.length + 1, 5);
        if (needed <= currentRows) return;

        const row = document.createElement('div');
        row.className = 'guess-row';
        row.id = `row-${currentRows}`;
        for (let j = 0; j < this.currentWord.length; j++) {
            const box = document.createElement('div');
            box.className = 'letter-box';
            box.id = `box-${currentRows}-${j}`;
            box.dataset.letterIndex = j;
            
            // If letter is revealed, show it
            if (this.isLetterRevealed(this.currentWordIndex, j)) {
                box.textContent = this.currentWord[j];
                box.classList.add('revealed');
            }
            
            row.appendChild(box);
        }
        board.appendChild(row);
    }

    setupEventListeners() {
        // Remove previous keydown handler to prevent duplicate listeners
        if (this._keyHandler) {
            document.removeEventListener('keydown', this._keyHandler);
        }
        this._keyHandler = (e) => this.handleKeyPress(e);
        document.addEventListener('keydown', this._keyHandler);

        document.querySelectorAll('.key').forEach((key) => {
            key.addEventListener('click', () => {
                const keyValue = key.dataset.key;
                this.handleVirtualKey(keyValue);
            });
        });

        document
            .getElementById('submitArrangementBtn')
            ?.addEventListener('click', () => this.submitArrangement());

        this.setupModals();
    }

    handleKeyPress(e) {
        if (this.gameStage !== 'guessing') return;
        const key = e.key;
        if (key === 'Enter') {
            this.submitGuess();
        } else if (key === 'Backspace') {
            this.deleteLetter();
        } else if (/^[a-zA-Z]$/.test(key)) {
            this.addLetter(key.toUpperCase());
        }
    }

    handleVirtualKey(key) {
        if (this.gameStage !== 'guessing') return;
        if (key === 'ENTER') {
            this.submitGuess();
        } else if (key === 'BACKSPACE') {
            this.deleteLetter();
        } else {
            this.addLetter(key);
        }
    }

    addLetter(letter) {
        // Count non-revealed positions
        let nonRevealedCount = 0;
        for (let i = 0; i < this.currentWord.length; i++) {
            if (!this.isLetterRevealed(this.currentWordIndex, i)) {
                nonRevealedCount++;
            }
        }
        
        if (this.currentGuess.length < nonRevealedCount) {
            this.currentGuess += letter;
            this.updateCurrentRow();
        }
    }

    deleteLetter() {
        if (this.currentGuess.length > 0) {
            this.currentGuess = this.currentGuess.slice(0, -1);
            this.updateCurrentRow();
        }
    }

    updateCurrentRow() {
        const currentAttempt = this.wordGuesses.length;
        this.ensureNextRow();
        const row = document.getElementById(`row-${currentAttempt}`);
        if (!row) return;
        const boxes = row.querySelectorAll('.letter-box');
        
        // Build display string by merging revealed letters and current guess
        let guessIdx = 0;
        boxes.forEach((box, idx) => {
            if (this.isLetterRevealed(this.currentWordIndex, idx)) {
                // Always show revealed letter
                box.textContent = this.currentWord[idx];
                box.classList.add('revealed');
            } else {
                // Show letter from current guess in order of unrevealed slots
                box.textContent = this.currentGuess[guessIdx] || '';
                box.classList.toggle('active', !!this.currentGuess[guessIdx]);
                guessIdx++;
            }
        });

        // Update click listeners for reveals
        boxes.forEach((box, j) => {
            if (!this.isLetterRevealed(this.currentWordIndex, j) && this.revealsUsed < this.maxReveals) {
                box.style.cursor = 'pointer';
                // Remove existing listener to avoid duplicates
                if (box._revealHandler) {
                    box.removeEventListener('click', box._revealHandler);
                }
                box._revealHandler = () => this.revealLetter(j);
                box.addEventListener('click', box._revealHandler);
            } else {
                box.style.cursor = '';
                if (box._revealHandler) {
                    box.removeEventListener('click', box._revealHandler);
                    delete box._revealHandler;
                }
            }
        });
    }

    buildFinalGuess() {
        const unrevealed = [];
        for (let i = 0; i < this.currentWord.length; i++) {
            if (!this.isLetterRevealed(this.currentWordIndex, i)) {
                unrevealed.push(i);
            }
        }

        // Require letters for all unrevealed positions
        if (this.currentGuess.length < unrevealed.length) {
            return null;
        }

        const full = Array.from(this.currentWord).map(() => '');

        // Place revealed letters
        for (let i = 0; i < this.currentWord.length; i++) {
            if (this.isLetterRevealed(this.currentWordIndex, i)) {
                full[i] = this.currentWord[i];
            }
        }

        // Fill unrevealed slots in order with currentGuess characters
        for (let idx = 0; idx < unrevealed.length; idx++) {
            const pos = unrevealed[idx];
            full[pos] = this.currentGuess[idx] || '';
        }

        // If any slot empty, not enough letters
        if (full.some((ch) => ch === '')) return null;

        return full.join('');
    }

    async submitGuess() {
        const finalGuess = this.buildFinalGuess();
        if (!finalGuess) {
            this.showMessage('Not enough letters!', 'error');
            return;
        }

        // Update currentGuess to include revealed letters merged
        this.currentGuess = finalGuess;

        this.wordGuesses.push(this.currentGuess);
        const guessIndex = this.wordGuesses.length - 1;
        
        // Submit to server for validation (unless practice mode)
        if (!this.practiceMode && this.gameSessionId) {
            try {
                const response = await fetch('/api/sentle/guess', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        session_token: this.sessionToken,
                        game_session_id: this.gameSessionId,
                        word_index: this.currentWordIndex,
                        guess: this.currentGuess,
                        target_word: this.currentWord
                    })
                });
                
                const data = await response.json();
                if (response.ok) {
                    // Use server-validated feedback
                    this.evaluateGuessFromServer(guessIndex, data.feedback);
                    this.totalAttemptsUsed = data.total_attempts;
                    
                    // Check if correct
                    if (data.is_correct) {
                        this.handleCorrectGuess();
                    } else {
                        this.handleIncorrectGuess(data.attempt_number);
                    }
                } else {
                    this.showMessage(data.detail || 'Guess validation failed', 'error');
                    this.wordGuesses.pop(); // Remove failed guess
                    return;
                }
            } catch (err) {
                console.error('Error submitting guess:', err);
                this.showMessage('Error submitting guess', 'error');
                this.wordGuesses.pop();
                return;
            }
        } else {
            // Practice mode or no session: use client-side validation
            this.totalAttemptsUsed += 1;
            this.evaluateGuess(guessIndex);
            
            if (this.currentGuess === this.currentWord) {
                this.handleCorrectGuess();
            } else {
                if (this.wordGuesses.length >= this.maxAttemptsPerWord) {
                    // Failed this word — add it to guessedWords so arrangement stage has it
                    this.guessedWords.push(this.currentWord);
                    this.showMessage(`Out of attempts for "${this.currentWord}". Moving to next word.`, 'warning');
                    this.currentWordIndex += 1;
                    if (this.currentWordIndex < this.words.length) {
                        this.currentWord = this.words[this.currentWordIndex];
                        this.currentGuess = '';
                        this.wordGuesses = [];
                        this.maxReveals = 0;  // Reset reveals for new word
                        this.revealsUsed = 0;
                        this.updateRevealsDisplay();
                        this.resetKeyboard();
                        this.createBoard();
                        this.updateProgress();
                        this.showMessage(`Guess Word ${this.currentWordIndex + 1}!`, 'info');
                        this.saveGameState();
                    } else {
                        this.moveToArrangementStage();
                        this.saveGameState();
                    }
                } else {
                    this.handleIncorrectGuess(this.wordGuesses.length);
                }
            }
        }
        
        this.saveGameState();
    }
    
    handleCorrectGuess() {
        this.guessedWords.push(this.currentWord);
        this.showMessage(`✓ Word ${this.currentWordIndex + 1} correct!`, 'success');

        if (this.currentWordIndex < this.words.length - 1) {
            setTimeout(async () => {
                // Notify server word is complete
                await this.completeWordOnServer();
                
                this.currentWordIndex += 1;
                this.currentWord = this.words[this.currentWordIndex];
                this.currentGuess = '';
                this.wordGuesses = [];
                this.maxReveals = 0;  // Reset reveals for new word
                this.revealsUsed = 0;
                this.updateRevealsDisplay();
                this.resetKeyboard();
                this.createBoard();
                this.updateProgress();
                this.showMessage(`Guess Word ${this.currentWordIndex + 1}!`, 'info');
                this.saveGameState();
            }, 800);
        } else {
            setTimeout(() => {
                this.moveToArrangementStage();
                this.saveGameState();
            }, 800);
        }
    }
    
    handleIncorrectGuess(attemptNum) {
        this.showMessage(`Keep trying (attempt ${attemptNum})`, 'info');
        this.currentGuess = '';
        this.maxReveals += 1;  // Gain 1 reveal per failed guess
        this.updateRevealsDisplay();
        this.ensureNextRow();
        this.updateCurrentRow();  // Refresh listeners for new reveals
        this.updateProgress();
    }

    async completeWordOnServer() {
        if (this.practiceMode) return;

        try {
            await fetch('/api/sentle/word/complete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_token: this.sessionToken,
                    game_session_id: this.gameSessionId,
                    word_index: this.currentWordIndex
                })
            });
        } catch (err) {
            console.error('Error completing word on server:', err);
        }
    }

    evaluateGuessFromServer(guessIndex, feedback) {
        const row = document.getElementById(`row-${guessIndex}`);
        const boxes = row.querySelectorAll('.letter-box');
        const guess = this.wordGuesses[guessIndex];

        // Apply server-provided feedback
        for (let i = 0; i < boxes.length; i++) {
            const state = feedback[i];
            boxes[i].classList.add(state);
            if (state === 'correct') {
                this.updateKeyboardKey(guess[i], 'correct');
            } else if (state === 'present') {
                if (this.keyboardState[guess[i]] !== 'correct') {
                    this.updateKeyboardKey(guess[i], 'present');
                }
            } else if (state === 'absent') {
                if (!this.keyboardState[guess[i]]) {
                    this.updateKeyboardKey(guess[i], 'absent');
                }
            }
        }
    }

    evaluateGuess(guessIndex) {
        const row = document.getElementById(`row-${guessIndex}`);
        const boxes = row.querySelectorAll('.letter-box');
        const guess = this.wordGuesses[guessIndex];

        const letterCount = {};
        for (const ch of this.currentWord) {
            letterCount[ch] = (letterCount[ch] || 0) + 1;
        }

        for (let i = 0; i < boxes.length; i++) {
            if (guess[i] === this.currentWord[i]) {
                boxes[i].classList.add('correct');
                letterCount[guess[i]] -= 1;
                this.updateKeyboardKey(guess[i], 'correct');
            }
        }

        for (let i = 0; i < boxes.length; i++) {
            if (boxes[i].classList.contains('correct')) continue;
            const g = guess[i];
            if (letterCount[g] > 0) {
                boxes[i].classList.add('present');
                letterCount[g] -= 1;
                if (this.keyboardState[g] !== 'correct') this.updateKeyboardKey(g, 'present');
            } else {
                boxes[i].classList.add('absent');
                if (!this.keyboardState[g]) this.updateKeyboardKey(g, 'absent');
            }
        }
    }

    updateKeyboardKey(letter, state) {
        this.keyboardState[letter] = state;
        const key = document.querySelector(`.key[data-key="${letter}"]`);
        if (key) {
            key.classList.remove('correct', 'present', 'absent');
            key.classList.add(state);
        }
    }

    updateProgress() {
        const progress = (this.currentWordIndex / this.words.length) * 100;
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        const wordNumber = document.getElementById('wordNumber');
        const wordHint = document.getElementById('wordHint');

        if (progressFill) progressFill.style.width = `${progress}%`;
        if (progressText) progressText.textContent = `Word ${this.currentWordIndex + 1} of ${this.words.length}`;
        if (wordNumber) wordNumber.textContent = `Word ${this.currentWordIndex + 1}`;
        if (wordHint) wordHint.textContent = `Attempts so far: ${this.wordGuesses.length}`;
    }

    moveToArrangementStage() {
        this.gameStage = 'arranging';
        this.resetKeyboard();
        const gameBoard = document.getElementById('gameBoard');
        const keyboard = document.getElementById('keyboard');
        const gameProgress = document.querySelector('.game-progress');
        const currentWordSection = document.querySelector('.current-word-section');
        if (gameBoard) gameBoard.style.display = 'none';
        if (keyboard) keyboard.style.display = 'none';
        if (gameProgress) gameProgress.style.display = 'none';
        if (currentWordSection) currentWordSection.style.display = 'none';

        const arrangementStage = document.getElementById('arrangementStage');
        arrangementStage.style.display = 'block';

        const availableWords = document.getElementById('availableWords');
        availableWords.innerHTML = '';

        const shuffled = [...this.guessedWords].sort(() => Math.random() - 0.5);
        shuffled.forEach((word) => {
            const pill = document.createElement('div');
            pill.className = 'word-pill';
            pill.textContent = word;
            pill.draggable = true;
            pill.addEventListener('dragstart', (e) => {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', word);
            });
            availableWords.appendChild(pill);
        });

        const sentenceBuilder = document.getElementById('sentenceBuilder');
        sentenceBuilder.innerHTML = '';
        sentenceBuilder.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });
        sentenceBuilder.addEventListener('drop', (e) => {
            e.preventDefault();
            const word = e.dataTransfer.getData('text/plain');
            this.addWordToSentence(word);
        });

        this.showMessage('Arrange the words to form the complete sentence!', 'info');
        this.saveGameState();
    }

    addWordToSentence(word) {
        const availableWords = document.getElementById('availableWords');
        const sentenceBuilder = document.getElementById('sentenceBuilder');

        const pill = Array.from(availableWords.children).find(
            (p) => p.textContent === word && !p.classList.contains('used')
        );
        if (!pill) return;

        pill.classList.add('used');

        const wordSpan = document.createElement('div');
        wordSpan.className = 'word-in-sentence';
        wordSpan.textContent = word;
        wordSpan.draggable = true;

        wordSpan.addEventListener('click', () => {
            wordSpan.remove();
            pill.classList.remove('used');
        });

        wordSpan.addEventListener('dragstart', (e) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', word);
        });

        sentenceBuilder.appendChild(wordSpan);
    }

    submitArrangement() {
        const sentenceBuilder = document.getElementById('sentenceBuilder');
        const arranged = Array.from(sentenceBuilder.querySelectorAll('.word-in-sentence')).map(
            (w) => w.textContent
        );

        if (this.completed || this.gameStage === 'ended') {
            this.showMessage('Score already submitted for today.', 'info');
            return;
        }

        if (arranged.length !== this.guessedWords.length) {
            this.showMessage('You must arrange all words!', 'error');
            return;
        }

        const arrangedSentence = arranged.join(' ');
        if (arrangedSentence === this.sentence) {
            const score = this.calculateScore();
            this.showCompletionModal();
            this.endGame(true, score);
        } else {
            this.showMessage('❌ Incorrect arrangement. Try again!', 'error');
            // Allow retry - clear sentence builder and reset pill states
            sentenceBuilder.innerHTML = '';
            const availableWords = document.getElementById('availableWords');
            if (availableWords) {
                Array.from(availableWords.children).forEach(pill => pill.classList.remove('used'));
            }
        }
    }

    calculateScore() {
        // Scoring: cap attempts considered at 10 per word to keep scores finite
        const scoringCapPerWord = 10;
        const totalAttemptsAvailable = this.words.length * scoringCapPerWord;
        const unusedAttempts = Math.max(0, totalAttemptsAvailable - this.totalAttemptsUsed);
        let score = 500 + unusedAttempts * 100;
        // Deduct 100 points per reveal used
        score -= this.revealsUsed * 100;
        return Math.max(0, score); // Never go negative
    }

    showCompletionModal() {
        const modal = document.getElementById('completionModal');
        if (modal) modal.style.display = 'block';
    }

    async endGame(won, score = 0) {
        if (this.completed && won) {
            this.showMessage('Score already submitted for today.', 'info');
            return;
        }

        this.gameStage = 'ended';
        document.getElementById('keyboard').style.display = 'none';
        document.getElementById('arrangementStage').style.display = 'none';

        if (won) {
            this.showMessage(`Congratulations! You won with ${score} points! 🎉`, 'success');
            await this.submitScore(score, this.totalAttemptsUsed);
            this.updateStats(true, score);
            this.completed = true;
        } else {
            this.showMessage(`Game Over! The sentence was: ${this.sentence}`, 'error');
            this.updateStats(false, 0);
        }

        setTimeout(() => this.showStatsModal(), 1200);
    }

    async submitScore(score, attemptsUsed) {
        if (this.practiceMode) {
            this.showMessage('Practice mode: score not submitted.', 'info');
            return;
        }
        if (this.scoreSubmitted) {
            this.showMessage('Score already submitted for today.', 'info');
            return;
        }

        // Require a valid session before submitting to backend
        if (!this.sessionToken) {
            this.showMessage('Please log in before submitting your score.', 'error');
            return;
        }

        try {
            console.log('Submitting score:', {
                game_session_id: this.gameSessionId,
                sentenceId: this.sentenceId,
                date: this.targetDate,
                sessionToken: this.sessionToken,
                userId: this.userId
            });

            const response = await fetch('/api/sentle/score', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_token: this.sessionToken,
                    game_session_id: this.gameSessionId,
                    sentenceId: this.sentenceId,
                    date: this.targetDate,
                    user_id: this.userId,
                    score: score,
                    guesses: attemptsUsed,
                }),
            });

            const data = await response.json();
            console.log('Score submission response:', { status: response.status, data });
            
            if (response.ok) {
                this.scoreSubmitted = true;
                this.completed = true;
                this.showMessage(`Score saved: ${data.score} points!`, 'success');
                // Remember locally to prevent auto-login replay today
                this.rememberPlayedToday(this.targetDate);
                // Refresh stats from backend now that score is stored
                const { stats } = await this.loadStats();
                this.stats = stats;
                this.loadLeaderboard();
            } else {
                // Handle auth issues by forcing re-login
                if (response.status === 401) {
                    this.showMessage('Session expired. Please log in again to submit your score.', 'error');
                    localStorage.removeItem('sentle_session');
                    localStorage.removeItem('sentle_username');
                    localStorage.removeItem('sentle_user_id');
                    this.sessionToken = '';
                    this.username = '';
                    this.userId = '';
                }

                if (response.status === 403) {
                    // Duplicate submit: treat as submitted so user isn’t blocked
                    this.scoreSubmitted = true;
                    this.completed = true;
                }
                this.showMessage(data.detail || 'Score submission failed', 'error');
                console.error('Score submission error:', data.detail);
            }
        } catch (err) {
            console.error('Error submitting score:', err);
        }
    }

    async loadLeaderboard(targetDate = null) {
        console.log('🔄 loadLeaderboard called with targetDate:', targetDate);
        const globalBoard = document.getElementById('leaderboard-global');
        const dailyBoard = document.getElementById('leaderboard-daily');

        if (globalBoard) {
            globalBoard.innerHTML = '<div class="loading">Loading leaderboard...</div>';
        }
        if (dailyBoard) {
            const dateText = targetDate ? `Loading scores for ${targetDate}...` : 'Loading today\'s scores...';
            dailyBoard.innerHTML = `<div class="loading">${dateText}</div>`;
        }

        try {
            console.log('📡 Fetching global leaderboard...');
            const globalRes = await fetch('/api/sentle/leaderboard', { cache: 'no-store' });
            console.log('📡 Global leaderboard response:', globalRes.status, globalRes.statusText);
            const globalData = await globalRes.json();
            console.log('📊 Global leaderboard data:', globalData);
            
            this.renderLeaderboardList(
                globalBoard,
                globalData?.leaderboard,
                'No scores yet. Be the first!'
            );
        } catch (err) {
            console.error('❌ Error loading global leaderboard:', err);
            if (globalBoard) globalBoard.innerHTML = '<div class="loading">Unable to load leaderboard.</div>';
        }

        try {
            const dailyUrl = targetDate 
                ? `/api/sentle/leaderboard/daily?date=${encodeURIComponent(targetDate)}`
                : '/api/sentle/leaderboard/daily';
            console.log('📡 Fetching daily leaderboard:', dailyUrl);
            const dailyRes = await fetch(dailyUrl, { cache: 'no-store' });
            console.log('📡 Daily leaderboard response:', dailyRes.status, dailyRes.statusText);
            const dailyData = await dailyRes.json();
            console.log('📊 Daily leaderboard data:', dailyData);
            const dateStr = dailyData?.date || targetDate || 'today';
            const dailyEmpty = `No scores yet for ${dateStr}.`;
            
            this.renderLeaderboardList(dailyBoard, dailyData?.leaderboard, dailyEmpty);
        } catch (err) {
            console.error('❌ Error loading daily leaderboard:', err);
            const dateText = targetDate ? `Unable to load scores for ${targetDate}.` : 'Unable to load today\'s scores.';
            if (dailyBoard) dailyBoard.innerHTML = `<div class="loading">${dateText}</div>`;
        }
    }

    renderLeaderboardList(container, entries, emptyText) {
        if (!container) return;
        container.innerHTML = '';

        if (entries && entries.length > 0) {
            entries.forEach((entry, index) => {
                const item = document.createElement('div');
                item.className = 'leaderboard-item';
                const rankClass = index === 0 ? 'top1' : index === 1 ? 'top2' : index === 2 ? 'top3' : '';
                item.innerHTML = `
                    <span class="leaderboard-rank ${rankClass}">#${index + 1}</span>
                    <div class="leaderboard-text">
                        <span class="leaderboard-name">${this.escapeHtml(entry.playerName)}</span>
                        <span class="leaderboard-score">${entry.score} pts</span>
                    </div>
                `;
                container.appendChild(item);
            });
        } else {
            container.innerHTML = `<div class="loading">${emptyText}</div>`;
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showMessage(text, type = 'info') {
        const message = document.getElementById('message');
        if (!message) return;
        message.textContent = text;
        message.className = `message ${type}`;
        setTimeout(() => {
            message.className = 'message';
            message.textContent = '';
        }, 2500);
    }

    isLetterRevealed(wordIndex, letterIndex) {
        return this.revealedLetters[wordIndex]?.[letterIndex] || false;
    }

    async revealLetter(letterIndex) {
        if (this.gameStage !== 'guessing') return;
        
        // Don't reveal if already revealed
        if (this.isLetterRevealed(this.currentWordIndex, letterIndex)) {
            return;
        }
        
        // Submit to server for validation (unless practice mode)
        if (!this.practiceMode && this.gameSessionId) {
            try {
                const response = await fetch('/api/sentle/reveal', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        session_token: this.sessionToken,
                        game_session_id: this.gameSessionId,
                        word_index: this.currentWordIndex,
                        letter_index: letterIndex,
                        target_word: this.currentWord
                    })
                });
                
                const data = await response.json();
                if (response.ok) {
                    // Server validated and returned the letter
                    this.applyReveal(letterIndex, data.letter);
                    this.revealsUsed = data.reveals_used;
                    this.showMessage(`Letter revealed! ${data.reveals_available} reveals left`, 'info');
                } else {
                    this.showMessage(data.detail || 'Cannot reveal letter', 'error');
                }
            } catch (err) {
                console.error('Error revealing letter:', err);
                this.showMessage('Error revealing letter', 'error');
            }
        } else {
            // Practice mode: client-side reveal (insecure but acceptable for practice)
            if (this.revealsUsed >= this.maxReveals) {
                this.showMessage('No reveals left!', 'error');
                return;
            }
            this.applyReveal(letterIndex, this.currentWord[letterIndex]);
            this.revealsUsed++;
            this.showMessage(`Letter revealed! ${this.maxReveals - this.revealsUsed} reveals left`, 'info');
        }
        
        this.updateRevealsDisplay();
        this.saveGameState();
    }
    
    applyReveal(letterIndex, letter) {
        // Mark as revealed
        if (!this.revealedLetters[this.currentWordIndex]) {
            this.revealedLetters[this.currentWordIndex] = {};
        }
        this.revealedLetters[this.currentWordIndex][letterIndex] = true;
        
        // Update UI
        const currentRow = this.wordGuesses.length;
        const box = document.getElementById(`box-${currentRow}-${letterIndex}`);
        if (box) {
            box.textContent = letter;
            box.classList.add('revealed');
            box.style.cursor = 'default';
        }
    }

    updateRevealsDisplay() {
        const revealsDisplay = document.getElementById('revealsCounter');
        if (revealsDisplay) {
            const remaining = this.maxReveals - this.revealsUsed;
            revealsDisplay.textContent = `💡 Reveals: ${remaining}/${this.maxReveals}`;
            if (remaining === 0) {
                revealsDisplay.style.opacity = '0.5';
            }
        }
    }

    rememberPlayedToday(dateStr) {
        if (!dateStr) return;
        const payload = {
            date: dateStr,
            userId: this.userId || null,
            username: this.username || null,
        };
        localStorage.setItem('sentle_played_today', JSON.stringify(payload));
    }

    hasLocalPlayedToday() {
        const raw = localStorage.getItem('sentle_played_today');
        if (!raw) return false;
        try {
            const saved = JSON.parse(raw);
            const today = new Date().toISOString().slice(0, 10);
            if (saved.date !== today) return false;
            if (saved.userId && this.userId && String(saved.userId) !== String(this.userId)) return false;
            if (!saved.userId && saved.username && this.username && saved.username !== this.username) return false;
            return true;
        } catch (e) {
            return false;
        }
    }

    clearSavedState() {
        localStorage.removeItem('sentle_gameState');
    }

    clearSessionAuth() {
        this.sessionToken = '';
        this.username = '';
        this.userId = '';
        localStorage.removeItem('sentle_session');
        localStorage.removeItem('sentle_username');
        localStorage.removeItem('sentle_user_id');
    }

    saveGameState() {
        if (!this.targetDate) return;
        const state = {
            date: this.targetDate,
            sentence: this.sentence,
            sentenceId: this.sentenceId,
            currentWordIndex: this.currentWordIndex,
            guessedWords: this.guessedWords,
            wordGuesses: this.wordGuesses,
            currentGuess: this.currentGuess,
            gameStage: this.gameStage,
            totalAttemptsUsed: this.totalAttemptsUsed,
            keyboardState: this.keyboardState,
            completed: this.completed,
            scoreSubmitted: this.scoreSubmitted,
            userId: this.userId || null,
            revealsUsed: this.revealsUsed,
            revealedLetters: this.revealedLetters,
            maxReveals: this.maxReveals,
            wordOrder: this.wordOrder,
            originalWords: this.originalWords,
            practiceMode: this.practiceMode,
        };
        localStorage.setItem('sentle_gameState', JSON.stringify(state));
    }

    checkGameState() {
        const saved = localStorage.getItem('sentle_gameState');
        if (!saved) {
            console.log('No saved game state found');
            return;
        }

        const state = JSON.parse(saved);
        console.log('Checking saved game state:', {
            savedDate: state.date,
            targetDate: this.targetDate,
            matches: state.date === this.targetDate,
            savedState: state
        });
        
        if (state.date !== this.targetDate) {
            console.log('Saved state is for different date, ignoring');
            return;
        }

        // If saved state belongs to another user, skip restore
        if (state.userId && this.userId && String(state.userId) !== String(this.userId)) {
            console.log('Saved state belongs to different user, ignoring');
            return;
        }
        
        // Validate indices and stage; if invalid, clear and bail
        const invalidIndex = state.currentWordIndex >= this.words.length || state.currentWordIndex < 0;
        const invalidStage = state.gameStage && !['guessing', 'arranging'].includes(state.gameStage);
        const endedState = state.completed || state.scoreSubmitted;
        
        console.log('State validation:', {
            invalidIndex,
            invalidStage,
            endedState,
            savedWordIndex: state.currentWordIndex,
            currentWordsLength: this.words.length
        });
        
        if (invalidIndex || invalidStage || endedState) {
            console.log('Saved state is invalid, clearing it');
            this.clearSavedState();
            return;
        }

        console.log('BEFORE restore - current words:', this.words);

        this.sentenceId = state.sentenceId || this.sentenceId;
        this.sentence = state.sentence || this.sentence;
        this.originalWords = (state.originalWords && state.originalWords.length > 0) ? state.originalWords : (this.sentence ? this.sentence.split(' ') : []);
        this.wordOrder = (state.wordOrder && state.wordOrder.length > 0) ? state.wordOrder : this.generateWordOrder(this.originalWords.length);
        this.words = this.wordOrder.map((idx) => this.originalWords[idx]);
        
        console.log('AFTER restore - words regenerated:', {
            wordOrder: this.wordOrder,
            originalWords: this.originalWords,
            words: this.words
        });

        this.currentWordIndex = state.currentWordIndex || 0;
        this.guessedWords = state.guessedWords || [];
        this.wordGuesses = state.wordGuesses || [];
        this.currentGuess = state.currentGuess || '';
        this.gameStage = state.gameStage || 'guessing';
        this.totalAttemptsUsed = state.totalAttemptsUsed || 0;
        this.keyboardState = state.keyboardState || {};
        this.completed = state.completed || false;
        this.scoreSubmitted = state.scoreSubmitted || false;
        this.practiceMode = state.practiceMode || false;
        this.revealsUsed = state.revealsUsed || 0;
        this.revealedLetters = state.revealedLetters || {};
        this.maxReveals = state.maxReveals || 0;
        this.currentWord = this.words[this.currentWordIndex] || '';
        this.restoreStateDone = true;

        // Recreate board and replay guesses to restore colors
        this.createBoard();
        for (let i = 0; i < this.wordGuesses.length; i++) {
            this.evaluateGuess(i);
        }
        this.updateCurrentRow();
        this.updateProgress();
        this.updateRevealsDisplay();

        if (this.gameStage === 'arranging') {
            this.moveToArrangementStage();
        } else if (this.gameStage === 'ended' || this.completed) {
            this.handleCompletedRestore();
        }
    }

    async loadStats() {
        const defaultStats = {
            gamesPlayed: 0,
            gamesWon: 0,
            currentStreak: 0,
            maxStreak: 0,
            totalScore: 0,
            playedToday: false,
        };

        if (!this.sessionToken) {
            return { stats: defaultStats, validSession: false };
        }

        try {
            const response = await fetch('/api/sentle/stats', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.sessionToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.status === 401) {
                console.warn('Session expired while loading stats.');
                return { stats: defaultStats, validSession: false };
            }

            if (response.ok) {
                const statsData = await response.json();
                console.log('✓ Stats loaded from database:', statsData);
                console.log('  Source: MySQL database sentle_scores table');

                return {
                    stats: {
                        gamesPlayed: statsData.gamesPlayed || 0,
                        gamesWon: statsData.gamesWon || 0,
                        currentStreak: statsData.currentStreak || 0,
                        maxStreak: statsData.maxStreak || 0,
                        totalScore: statsData.totalScore || 0,
                        playedToday: !!statsData.playedToday,
                    },
                    validSession: true,
                };
            }

            throw new Error(`API returned ${response.status}`);
        } catch (error) {
            console.error('⚠ Error loading stats from API:', error);
            return { stats: defaultStats, validSession: false };
        }
    }

    async updateStats(won, score) {
        this.stats.gamesPlayed += 1;
        if (won) {
            this.stats.gamesWon += 1;
            this.stats.currentStreak += 1;
            this.stats.maxStreak = Math.max(this.stats.maxStreak, this.stats.currentStreak);
            this.stats.totalScore += score;
        } else {
            this.stats.currentStreak = 0;
        }
        
        console.log('✓ Stats updated (in-memory only):', this.stats);
        console.log('  Database will be updated via score submission endpoint');
        
        // Stats will be recalculated from database on next loadStats() call
        // The submitScore() endpoint stores the game to sentle_scores
    }

    // Game state persistence removed to avoid local cache conflicts

    setupModals() {
        if (this.modalsSetup) return;

        const helpBtn = document.getElementById('helpBtn');
        const logoutBtn = document.getElementById('logout');

        const helpModal = document.getElementById('helpModal');
        helpBtn?.addEventListener('click', () => {
            helpModal.style.display = 'block';
        });
        logoutBtn?.addEventListener('click', () => this.logout());

        document.querySelectorAll('.close').forEach((closeBtn) => {
            closeBtn.addEventListener('click', (e) => {
                e.target.closest('.modal').style.display = 'none';
            });
        });

        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.style.display = 'none';
            }
        });

        this.modalsSetup = true;
    }

    async showStatsModal() {
        const modal = document.getElementById('statsModal');
        if (!modal) return;
        // Reload stats from database before showing
        const { stats } = await this.loadStats();
        this.stats = stats;

        const gp = document.getElementById('gamesPlayed');
        const wr = document.getElementById('winRate');
        const cs = document.getElementById('currentStreak');
        const ms = document.getElementById('maxStreak');
        const ts = document.getElementById('totalScore');

        if (gp && wr && cs && ms && ts) {
            gp.textContent = this.stats.gamesPlayed;
            wr.textContent = this.stats.gamesPlayed > 0
                ? Math.round((this.stats.gamesWon / this.stats.gamesPlayed) * 100)
                : 0;
            cs.textContent = this.stats.currentStreak;
            ms.textContent = this.stats.maxStreak;
            ts.textContent = this.stats.totalScore;
        }

        modal.style.display = 'block';
    }

    handleCompletedRestore() {
        this.gameStage = 'ended';
        this.completed = true;

        const gameBoard = document.getElementById('gameBoard');
        const keyboard = document.getElementById('keyboard');
        const arrangementStage = document.getElementById('arrangementStage');
        const progress = document.querySelector('.game-progress');
        const currentWordSection = document.querySelector('.current-word-section');

        if (gameBoard) gameBoard.innerHTML = '';
        if (keyboard) keyboard.style.display = 'none';
        if (arrangementStage) arrangementStage.style.display = 'none';
        if (progress) progress.style.display = 'none';
        if (currentWordSection) currentWordSection.style.display = 'none';

        this.showMessage("You've already completed today's Sentle. Check the leaderboard!", 'info');
        this.loadLeaderboard();
    }

    hideGameplayUI() {
        const gameBoard = document.getElementById('gameBoard');
        const keyboard = document.getElementById('keyboard');
        const arrangementStage = document.getElementById('arrangementStage');
        const progress = document.querySelector('.game-progress');
        const currentWordSection = document.querySelector('.current-word-section');

        if (gameBoard) gameBoard.style.display = 'none';
        if (keyboard) keyboard.style.display = 'none';
        if (arrangementStage) arrangementStage.style.display = 'none';
        if (progress) progress.style.display = 'none';
        if (currentWordSection) currentWordSection.style.display = 'none';
    }

    logout() {
        localStorage.removeItem('sentle_session');
        localStorage.removeItem('sentle_username');
        localStorage.removeItem('sentle_user_id');
        this.sessionToken = '';
        this.username = '';
        this.userId = '';
        location.reload();
    }
}

// Global game instance
let gameInstance = null;

// Define window functions early so onclick handlers can find them
window.registerUser = function() { 
    if (gameInstance) gameInstance.registerUser(); 
};
window.loginUser = function() { 
    if (gameInstance) gameInstance.loginUser(); 
};
window.toggleRegister = function() {
    gameInstance?.toggleForms('register');
};
window.toggleLogin = function() {
    gameInstance?.toggleForms('login');
};

// Initialize game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Theme is handled by themeManager.js — do NOT override it here
    gameInstance = new SentleGame();
});
