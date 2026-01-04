// Sentle Game Logic - Word-by-Word Wordle with Arrangement Stage
class SentleGame {
    constructor() {
        this.sentence = '';
        this.words = [];
        this.currentWordIndex = 0;
        this.currentWord = '';
        this.currentGuess = '';
        this.wordGuesses = [];
        this.maxAttemptsPerWord = 5;
        this.gameStage = 'login'; // login | guessing | arranging | ended
        this.guessedWords = [];
        this.totalAttemptsUsed = 0;
        this.username = localStorage.getItem('sentle_username') || '';
        this.sessionToken = localStorage.getItem('sentle_session') || '';
        this.stats = this.loadStats();
        this.keyboardState = {};
        this.sentenceId = null;
        this.targetDate = null;
        this.restoreStateDone = false;
        this.completed = false;
        this.scoreSubmitted = false;
        this.modalsSetup = false;

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
        if (clearStorage) {
            localStorage.removeItem('sentle_gameState');
        }
        this.resetKeyboard();
    }

    resetKeyboard() {
        this.keyboardState = {};
        document.querySelectorAll('.key').forEach((key) => {
            key.classList.remove('correct', 'present', 'absent');
        });
    }

    init() {
        // Always wire modal buttons even if game fails to load
        this.setupModals();

        if (this.sessionToken && this.username) {
            this.hideLoginScreen();
            this.startGame();
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

        if (!firstName || !lastName || !password || !password2) {
            this.showMessage('All fields are required', 'error');
            return;
        }

        if (password !== password2) {
            this.showMessage('Passwords do not match', 'error');
            return;
        }

        if (password.length < 6) {
            this.showMessage('Password must be at least 6 characters', 'error');
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
                this.showMessage('Account created. Please login.', 'success');
                this.toggleForms('login');
            } else {
                this.showMessage(data.detail || 'Registration failed', 'error');
            }
        } catch (err) {
            this.showMessage('Registration error', 'error');
        }
    }

    async loginUser() {
        const firstName = document.getElementById('loginFirst').value.trim();
        const lastName = document.getElementById('loginLast').value.trim();
        const password = document.getElementById('loginPassword').value.trim();

        if (!firstName || !lastName || !password) {
            this.showMessage('First name, last name, and password are required', 'error');
            return;
        }

        try {
            const response = await fetch('/api/sentle/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ first_name: firstName, last_name: lastName, password }),
            });

            const data = await response.json();

            if (response.ok) {
                this.sessionToken = data.session_token;
                this.username = data.username;
                localStorage.setItem('sentle_session', this.sessionToken);
                localStorage.setItem('sentle_username', this.username);
                this.hideLoginScreen();
                this.startGame();
            } else {
                this.showMessage(data.detail || 'Login failed', 'error');
            }
        } catch (err) {
            this.showMessage('Login error', 'error');
        }
    }

    async startGame() {
        this.gameStage = 'guessing';
        await this.loadDailySentence();
        if (!this.sentence) return;

        if (this.completed || this.gameStage === 'ended') {
            this.handleCompletedRestore();
            return;
        }

        if (!this.restoreStateDone) {
            this.currentWord = this.words[0];
            this.currentGuess = '';
            this.wordGuesses = [];
        }

        this.createBoard();
        this.setupEventListeners();
        this.updateProgress();
        this.loadLeaderboard();
    }

    async loadDailySentence() {
        try {
            const response = await fetch('/api/sentle/daily');
            const data = await response.json();

            if (data && data.sentence) {
                this.sentence = data.sentence.toUpperCase();
                this.words = this.sentence.split(' ');
                this.currentWord = this.words[0];
                this.sentenceId = data.id;
                this.targetDate = data.date;
                this.checkGameState();
            } else {
                this.showMessage('No sentence available today. Check back tomorrow!', 'error');
            }
        } catch (err) {
            console.error('Error loading sentence:', err);
            this.showMessage('Error loading game. Please try again.', 'error');
        }
    }

    createBoard() {
        const board = document.getElementById('gameBoard');
        board.innerHTML = '';

        for (let i = 0; i < this.maxAttemptsPerWord; i++) {
            const row = document.createElement('div');
            row.className = 'guess-row';
            row.id = `row-${i}`;

            for (let j = 0; j < this.currentWord.length; j++) {
                const box = document.createElement('div');
                box.className = 'letter-box';
                box.id = `box-${i}-${j}`;
                row.appendChild(box);
            }

            board.appendChild(row);
        }
    }

    setupEventListeners() {
        document.addEventListener('keydown', (e) => this.handleKeyPress(e));

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
        if (this.currentGuess.length < this.currentWord.length) {
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
        const row = document.getElementById(`row-${currentAttempt}`);
        if (!row) return;
        const boxes = row.querySelectorAll('.letter-box');
        boxes.forEach((box, idx) => {
            box.textContent = this.currentGuess[idx] || '';
            box.classList.toggle('active', !!this.currentGuess[idx]);
        });
    }

    submitGuess() {
        if (this.currentGuess.length !== this.currentWord.length) {
            this.showMessage('Not enough letters!', 'error');
            return;
        }

        this.wordGuesses.push(this.currentGuess);
        const guessIndex = this.wordGuesses.length - 1;
        this.evaluateGuess(guessIndex);

        if (this.currentGuess === this.currentWord) {
            this.guessedWords.push(this.currentWord);
            this.totalAttemptsUsed += this.wordGuesses.length;
            this.showMessage(`✓ Word ${this.currentWordIndex + 1} correct!`, 'success');

            if (this.currentWordIndex < this.words.length - 1) {
                setTimeout(() => {
                    this.currentWordIndex += 1;
                    this.currentWord = this.words[this.currentWordIndex];
                    this.currentGuess = '';
                    this.wordGuesses = [];
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
        } else if (this.wordGuesses.length >= this.maxAttemptsPerWord) {
            this.showMessage(`Game Over! The word was: ${this.currentWord}`, 'error');
            this.endGame(false);
        } else {
            this.showMessage(`${this.maxAttemptsPerWord - this.wordGuesses.length} attempts left`, 'info');
            this.currentGuess = '';
        }

        this.saveGameState();
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
        if (wordHint) wordHint.textContent = `${this.maxAttemptsPerWord - this.wordGuesses.length} attempts remaining`;
    }

    moveToArrangementStage() {
        this.gameStage = 'arranging';
        document.getElementById('gameBoard').style.display = 'none';
        document.getElementById('keyboard').style.display = 'none';
        document.querySelector('.game-progress').style.display = 'none';
        document.querySelector('.current-word-section').style.display = 'none';

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
            // Allow retry - clear sentence builder for another attempt
            sentenceBuilder.innerHTML = '';
        }
    }

    calculateScore() {
        const totalAttemptsAvailable = this.words.length * this.maxAttemptsPerWord;
        const unusedAttempts = Math.max(0, totalAttemptsAvailable - this.totalAttemptsUsed);
        return 500 + unusedAttempts * 100;
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

        this.saveGameState();

        setTimeout(() => this.showStatsModal(), 1200);
    }

    async submitScore(score, attemptsUsed) {
        if (this.scoreSubmitted) {
            this.showMessage('Score already submitted for today.', 'info');
            return;
        }
        try {
            console.log('Submitting score:', {
                score,
                attempts: attemptsUsed,
                sentenceId: this.sentenceId,
                date: this.targetDate,
                sessionToken: this.sessionToken
            });

            const response = await fetch('/api/sentle/score', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_token: this.sessionToken,
                    score,
                    attempts: attemptsUsed,
                    sentenceId: this.sentenceId,
                    date: this.targetDate,
                }),
            });

            const data = await response.json();
            console.log('Score submission response:', { status: response.status, data });
            
            if (response.ok) {
                this.scoreSubmitted = true;
                this.completed = true;
                this.saveGameState();
                this.showMessage('Score saved to leaderboard!', 'success');
                this.loadLeaderboard();
            } else {
                if (response.status === 403) {
                    this.scoreSubmitted = true;
                    this.completed = true;
                    this.saveGameState();
                }
                this.showMessage(data.detail || 'Score submission failed', 'error');
                console.error('Score submission error:', data.detail);
            }
        } catch (err) {
            console.error('Error submitting score:', err);
        }
    }

    async loadLeaderboard() {
        const globalBoard = document.getElementById('leaderboard-global');
        const dailyBoard = document.getElementById('leaderboard-daily');

        if (globalBoard) {
            globalBoard.innerHTML = '<div class="loading">Loading leaderboard...</div>';
        }
        if (dailyBoard) {
            dailyBoard.innerHTML = '<div class="loading">Loading today\'s scores...</div>';
        }

        try {
            const globalRes = await fetch('/api/sentle/leaderboard', { cache: 'no-store' });
            if (!globalRes.ok) {
                const errorMsg = `Unable to load leaderboard (status ${globalRes.status})`;
                console.error('Global leaderboard error:', errorMsg);
                if (globalBoard) globalBoard.innerHTML = `<div class="loading">${errorMsg}</div>`;
            } else {
                const globalData = await globalRes.json();
                console.log('Global leaderboard data:', globalData);
                this.renderLeaderboardList(
                    globalBoard,
                    globalData?.leaderboard,
                    'No scores yet. Be the first!'
                );
            }
        } catch (err) {
            console.error('Error loading global leaderboard:', err);
            if (globalBoard) globalBoard.innerHTML = '<div class="loading">Unable to load leaderboard.</div>';
        }

        try {
            const dailyRes = await fetch('/api/sentle/leaderboard/daily', { cache: 'no-store' });
            if (!dailyRes.ok) {
                const errorMsg = `Unable to load today\'s scores (status ${dailyRes.status})`;
                console.error('Daily leaderboard error:', errorMsg);
                if (dailyBoard) dailyBoard.innerHTML = `<div class="loading">${errorMsg}</div>`;
            } else {
                const dailyData = await dailyRes.json();
                console.log('Daily leaderboard data:', dailyData);
                const dailyEmpty = dailyData?.date
                    ? `No scores yet for ${dailyData.date}.`
                    : 'No scores yet for today.';
                this.renderLeaderboardList(dailyBoard, dailyData?.leaderboard, dailyEmpty);
            }
        } catch (err) {
            console.error('Error loading daily leaderboard:', err);
            if (dailyBoard) dailyBoard.innerHTML = '<div class="loading">Unable to load today\'s scores.</div>';
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
                    <span class="leaderboard-name">${this.escapeHtml(entry.playerName)}</span>
                    <span class="leaderboard-score">${entry.score} pts</span>
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

    loadStats() {
        const defaultStats = {
            gamesPlayed: 0,
            gamesWon: 0,
            currentStreak: 0,
            maxStreak: 0,
            totalScore: 0,
        };
        const saved = localStorage.getItem('sentle_stats');
        return saved ? JSON.parse(saved) : defaultStats;
    }

    updateStats(won, score) {
        this.stats.gamesPlayed += 1;
        if (won) {
            this.stats.gamesWon += 1;
            this.stats.currentStreak += 1;
            this.stats.maxStreak = Math.max(this.stats.maxStreak, this.stats.currentStreak);
            this.stats.totalScore += score;
        } else {
            this.stats.currentStreak = 0;
        }
        localStorage.setItem('sentle_stats', JSON.stringify(this.stats));
    }

    saveGameState() {
        const state = {
            date: this.targetDate,
            currentWordIndex: this.currentWordIndex,
            guessedWords: this.guessedWords,
            wordGuesses: this.wordGuesses,
            currentGuess: this.currentGuess,
            gameStage: this.gameStage,
            totalAttemptsUsed: this.totalAttemptsUsed,
            completed: this.completed,
            scoreSubmitted: this.scoreSubmitted,
        };
        localStorage.setItem('sentle_gameState', JSON.stringify(state));
    }

    checkGameState() {
        const saved = localStorage.getItem('sentle_gameState');
        if (!saved) return;

        const state = JSON.parse(saved);
        if (state.date !== this.targetDate) {
            // Different day -> clear old state
            localStorage.removeItem('sentle_gameState');
            return;
        }

        this.currentWordIndex = state.currentWordIndex;
        this.guessedWords = state.guessedWords || [];
        this.wordGuesses = state.wordGuesses || [];
        this.gameStage = state.gameStage || 'guessing';
        this.totalAttemptsUsed = state.totalAttemptsUsed || 0;
        this.currentGuess = state.currentGuess || '';
        this.currentWord = this.words[this.currentWordIndex];
        this.restoreStateDone = true;
        this.completed = state.completed || false;
        this.scoreSubmitted = state.scoreSubmitted || false;

        if (this.gameStage === 'guessing') {
            this.createBoard();
            for (let i = 0; i < this.wordGuesses.length; i++) {
                this.evaluateGuess(i);
            }
            this.updateCurrentRow();
            this.updateProgress();
        } else if (this.gameStage === 'arranging') {
            this.moveToArrangementStage();
        } else if (this.gameStage === 'ended' || this.completed) {
            this.handleCompletedRestore();
        }
    }

    setupModals() {
        if (this.modalsSetup) return;

        const helpBtn = document.getElementById('helpBtn');
        const statsBtn = document.getElementById('statsBtn');
        const themeToggleBtn = document.getElementById('themeToggleBtn');
        const logoutBtn = document.getElementById('logout');

        const helpModal = document.getElementById('helpModal');
        const statsModal = document.getElementById('statsModal');

        helpBtn?.addEventListener('click', () => {
            helpModal.style.display = 'block';
        });
        statsBtn?.addEventListener('click', () => {
            this.showStatsModal();
        });
        themeToggleBtn?.addEventListener('click', () => {
            if (typeof window.toggleTheme === 'function') {
                window.toggleTheme();
            }
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

    showStatsModal() {
        const modal = document.getElementById('statsModal');
        document.getElementById('gamesPlayed').textContent = this.stats.gamesPlayed;
        document.getElementById('winRate').textContent =
            this.stats.gamesPlayed > 0 ? Math.round((this.stats.gamesWon / this.stats.gamesPlayed) * 100) : 0;
        document.getElementById('currentStreak').textContent = this.stats.currentStreak;
        document.getElementById('maxStreak').textContent = this.stats.maxStreak;
        document.getElementById('totalScore').textContent = this.stats.totalScore;
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

    logout() {
        localStorage.removeItem('sentle_session');
        localStorage.removeItem('sentle_username');
        this.sessionToken = '';
        this.username = '';
        // Keep game state so progress can't be reset by logout/login
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
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    gameInstance = new SentleGame();
});
