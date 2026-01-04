// Sentle Game Logic - Word-by-Word Wordle with Arrangement
class SentleGame {
    constructor() {
        this.sentence = null;
        this.words = [];
        this.currentWordIndex = 0;
        this.currentWord = '';
        this.currentGuess = '';
        this.wordGuesses = []; // Array of guesses for current word
        this.maxAttemptsPerWord = 5;
        this.gameStage = 'guessing'; // 'guessing' or 'arranging'
        this.guessedWords = []; // Successfully guessed words
        this.wordOrder = []; // User's arranged word order
        this.playerName = localStorage.getItem('sentle_playerName') || 'Anonymous';
        this.stats = this.loadStats();
        this.keyboardState = {};
        this.totalAttemptsUsed = 0;
        
        this.init();
    }
    
    async init() {
        await this.loadDailySentence();
        if (this.sentence) {
            this.createBoard();
            this.setupEventListeners();
            this.updateProgress();
            this.checkGameState();
        }
        this.loadLeaderboard();
    }
    
    async loadDailySentence() {
        try {
            const response = await fetch('/api/sentle/daily');
            const data = await response.json();
            
            if (data.sentence) {
                this.sentence = data.sentence.toUpperCase();
                this.words = this.sentence.split(' ');
                this.currentWord = this.words[0];
                this.sentenceId = data.id;
                this.targetDate = data.date;
            } else {
                this.showMessage('No sentence available today. Check back tomorrow!', 'error');
            }
        } catch (error) {
            console.error('Error loading sentence:', error);
            this.showMessage('Error loading game. Please try again.', 'error');
        }
    }
    
    createBoard() {
        const board = document.getElementById('gameBoard');
        board.innerHTML = '';
        
        // Create rows for max attempts
        for (let i = 0; i < this.maxAttemptsPerWord; i++) {
            const row = document.createElement('div');
            row.className = 'guess-row';
            row.id = `row-${i}`;
            
            // Create letter boxes for current word length
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
        // Physical keyboard
        document.addEventListener('keydown', (e) => this.handleKeyPress(e));
        
        // Virtual keyboard
        document.querySelectorAll('.key').forEach(key => {
            key.addEventListener('click', () => {
                const keyValue = key.dataset.key;
                this.handleVirtualKey(keyValue);
            });
        });
        
        // Arrangement stage
        document.getElementById('submitArrangementBtn')?.addEventListener('click', () => this.submitArrangement());
        
        // Modal controls
        this.setupModals();
        
        // Settings
        document.getElementById('saveNameBtn')?.addEventListener('click', () => this.saveName());
        document.getElementById('themeToggle')?.addEventListener('click', () => this.toggleTheme());
    }
    
    handleKeyPress(e) {
        if (this.gameStage === 'guessing') {
            const key = e.key;
            
            if (key === 'Enter') {
                this.submitGuess();
            } else if (key === 'Backspace') {
                this.deleteLetter();
            } else if (/^[a-zA-Z]$/.test(key)) {
                this.addLetter(key.toUpperCase());
            }
        }
    }
    
    handleVirtualKey(key) {
        if (this.gameStage === 'guessing') {
            if (key === 'ENTER') {
                this.submitGuess();
            } else if (key === 'BACKSPACE') {
                this.deleteLetter();
            } else {
                this.addLetter(key);
            }
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
        for (let i = 0; i < boxes.length; i++) {
            if (i < this.currentGuess.length) {
                boxes[i].textContent = this.currentGuess[i];
                boxes[i].classList.add('active');
            } else {
                boxes[i].textContent = '';
                boxes[i].classList.remove('active');
            }
        }
    }
    
    async submitGuess() {
        if (this.currentGuess.length !== this.currentWord.length) {
            this.showMessage('Not enough letters!', 'error');
            return;
        }
        
        this.wordGuesses.push(this.currentGuess);
        this.evaluateGuess(this.wordGuesses.length - 1);
        
        // Check if correct
        if (this.currentGuess === this.currentWord) {
            this.guessedWords.push(this.currentWord);
            this.totalAttemptsUsed += this.wordGuesses.length;
            this.showMessage(`✓ Word ${this.currentWordIndex + 1} correct!`, 'success');
            
            // Move to next word or arrangement stage
            if (this.currentWordIndex < this.words.length - 1) {
                setTimeout(() => {
                    this.currentWordIndex++;
                    this.currentWord = this.words[this.currentWordIndex];
                    this.currentGuess = '';
                    this.wordGuesses = [];
                    this.createBoard();
                    this.updateProgress();
                    this.showMessage(`Guess Word ${this.currentWordIndex + 1}!`, 'info');
                }, 1000);
            } else {
                // All words guessed, move to arrangement
                setTimeout(() => {
                    this.moveToArrangementStage();
                }, 1000);
            }
        } else if (this.wordGuesses.length >= this.maxAttemptsPerWord) {
            // Out of attempts for this word
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
        for (let char of this.currentWord) {
            letterCount[char] = (letterCount[char] || 0) + 1;
        }
        
        // First pass: mark correct letters
        for (let i = 0; i < boxes.length; i++) {
            if (guess[i] === this.currentWord[i]) {
                boxes[i].classList.add('correct');
                letterCount[guess[i]]--;
                this.updateKeyboardKey(guess[i], 'correct');
            }
        }
        
        // Second pass: mark present and absent
        for (let i = 0; i < boxes.length; i++) {
            if (!boxes[i].classList.contains('correct')) {
                if (letterCount[guess[i]] > 0) {
                    boxes[i].classList.add('present');
                    letterCount[guess[i]]--;
                    if (this.keyboardState[guess[i]] !== 'correct') {
                        this.updateKeyboardKey(guess[i], 'present');
                    }
                } else {
                    boxes[i].classList.add('absent');
                    if (!this.keyboardState[guess[i]]) {
                        this.updateKeyboardKey(guess[i], 'absent');
                    }
                }
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
        const progress = ((this.currentWordIndex) / this.words.length) * 100;
        document.getElementById('progressFill').style.width = progress + '%';
        document.getElementById('progressText').textContent = 
            `Word ${this.currentWordIndex + 1} of ${this.words.length}`;
        document.getElementById('wordNumber').textContent = `Word ${this.currentWordIndex + 1}`;
        document.getElementById('wordHint').textContent = 
            `${this.maxAttemptsPerWord - this.wordGuesses.length} attempts remaining`;
    }
    
    moveToArrangementStage() {
        this.gameStage = 'arranging';
        document.getElementById('gameBoard').style.display = 'none';
        document.getElementById('keyboard').style.display = 'none';
        document.querySelector('.game-progress').style.display = 'none';
        document.querySelector('.current-word-section').style.display = 'none';
        
        const arrangementStage = document.getElementById('arrangementStage');
        arrangementStage.style.display = 'block';
        
        // Create draggable word pills
        const availableWords = document.getElementById('availableWords');
        availableWords.innerHTML = '';
        
        const shuffledWords = [...this.guessedWords].sort(() => Math.random() - 0.5);
        
        shuffledWords.forEach((word, index) => {
            const pill = document.createElement('div');
            pill.className = 'word-pill';
            pill.textContent = word;
            pill.draggable = true;
            pill.dataset.index = index;
            pill.dataset.word = word;
            
            pill.addEventListener('dragstart', (e) => {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/html', pill.innerHTML);
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
            const word = e.dataTransfer.getData('text/html');
            this.addWordToSentence(word);
        });
        
        this.showMessage('Arrange the words to form the complete sentence!', 'info');
    }
    
    addWordToSentence(word) {
        const sentenceBuilder = document.getElementById('sentenceBuilder');
        const wordSpan = document.createElement('div');
        wordSpan.className = 'word-in-sentence';
        wordSpan.textContent = word;
        wordSpan.draggable = true;
        
        wordSpan.addEventListener('dragstart', (e) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/html', wordSpan.innerHTML);
        });
        
        sentenceBuilder.appendChild(wordSpan);
    }
    
    submitArrangement() {
        const sentenceBuilder = document.getElementById('sentenceBuilder');
        const words = Array.from(sentenceBuilder.querySelectorAll('.word-in-sentence'))
            .map(w => w.textContent);
        
        if (words.length !== this.guessedWords.length) {
            this.showMessage('You must arrange all words!', 'error');
            return;
        }
        
        const arrangedSentence = words.join(' ');
        
        if (arrangedSentence === this.sentence) {
            const score = this.calculateScore();
            this.endGame(true, score);
        } else {
            this.showMessage('Incorrect arrangement. Try again!', 'error');
        }
    }
    
    calculateScore() {
        // Base score for completing the game
        let score = 500;
        
        // Bonus: 100 points per unused attempt
        const totalAttemptsAvailable = this.words.length * this.maxAttemptsPerWord;
        const unusedAttempts = totalAttemptsAvailable - this.totalAttemptsUsed;
        score += (unusedAttempts * 100);
        
        return score;
    }
    
    async endGame(won, score) {
        this.gameStage = 'ended';
        document.getElementById('keyboard').style.display = 'none';
        document.getElementById('arrangementStage').style.display = 'none';
        
        if (won) {
            this.showMessage(`Congratulations! You won with ${score} points! 🎉`, 'success');
            await this.submitScore(score, this.totalAttemptsUsed);
            this.updateStats(true, score);
        } else {
            this.showMessage(`Game Over! The sentence was: ${this.sentence}`, 'error');
            this.updateStats(false, 0);
        }
        
        setTimeout(() => {
            this.showStatsModal();
        }, 1500);
    }
    
    async submitScore(score, attemptsUsed) {
        try {
            await fetch('/api/sentle/score', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    playerName: this.playerName,
                    score: score,
                    attempts: attemptsUsed,
                    sentenceId: this.sentenceId,
                    date: this.targetDate
                })
            });
            
            this.loadLeaderboard();
        } catch (error) {
            console.error('Error submitting score:', error);
        }
    }
    
    async loadLeaderboard() {
        try {
            const response = await fetch('/api/sentle/leaderboard');
            const data = await response.json();
            
            const leaderboard = document.getElementById('leaderboard');
            leaderboard.innerHTML = '';
            
            if (data.leaderboard && data.leaderboard.length > 0) {
                data.leaderboard.forEach((entry, index) => {
                    const item = document.createElement('div');
                    item.className = 'leaderboard-item';
                    
                    const rankClass = index === 0 ? 'top1' : index === 1 ? 'top2' : index === 2 ? 'top3' : '';
                    
                    item.innerHTML = `
                        <span class="leaderboard-rank ${rankClass}">#${index + 1}</span>
                        <span class="leaderboard-name">${this.escapeHtml(entry.playerName)}</span>
                        <span class="leaderboard-score">${entry.score} pts</span>
                    `;
                    
                    leaderboard.appendChild(item);
                });
            } else {
                leaderboard.innerHTML = '<div class="loading">No scores yet. Be the first!</div>';
            }
        } catch (error) {
            console.error('Error loading leaderboard:', error);
        }
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    showMessage(text, type = 'info') {
        const message = document.getElementById('message');
        message.textContent = text;
        message.className = `message ${type}`;
        
        setTimeout(() => {
            message.className = 'message';
            message.textContent = '';
        }, 3000);
    }
    
    loadStats() {
        const defaultStats = {
            gamesPlayed: 0,
            gamesWon: 0,
            currentStreak: 0,
            maxStreak: 0,
            totalScore: 0
        };
        
        const saved = localStorage.getItem('sentle_stats');
        return saved ? JSON.parse(saved) : defaultStats;
    }
    
    updateStats(won, score) {
        this.stats.gamesPlayed++;
        
        if (won) {
            this.stats.gamesWon++;
            this.stats.currentStreak++;
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
            gameStage: this.gameStage,
            totalAttemptsUsed: this.totalAttemptsUsed
        };
        
        localStorage.setItem('sentle_gameState', JSON.stringify(state));
    }
    
    checkGameState() {
        const saved = localStorage.getItem('sentle_gameState');
        if (!saved) return;
        
        const state = JSON.parse(saved);
        
        if (state.date === this.targetDate && state.guessedWords.length > 0) {
            // Restore game state
            this.currentWordIndex = state.currentWordIndex;
            this.guessedWords = state.guessedWords;
            this.wordGuesses = state.wordGuesses;
            this.gameStage = state.gameStage;
            this.totalAttemptsUsed = state.totalAttemptsUsed;
            
            if (this.gameStage === 'guessing') {
                // Replay word guesses
                this.currentWord = this.words[this.currentWordIndex];
                this.createBoard();
                
                for (let i = 0; i < this.wordGuesses.length; i++) {
                    this.evaluateGuess(i);
                }
                
                this.updateProgress();
            } else if (this.gameStage === 'arranging') {
                this.moveToArrangementStage();
            }
        }
    }
    
    setupModals() {
        const helpBtn = document.getElementById('helpBtn');
        const statsBtn = document.getElementById('statsBtn');
        const settingsBtn = document.getElementById('settingsBtn');
        
        const helpModal = document.getElementById('helpModal');
        const statsModal = document.getElementById('statsModal');
        const settingsModal = document.getElementById('settingsModal');
        
        helpBtn?.addEventListener('click', () => {
            helpModal.style.display = 'block';
        });
        
        statsBtn?.addEventListener('click', () => {
            this.showStatsModal();
        });
        
        settingsBtn?.addEventListener('click', () => {
            document.getElementById('playerName').value = this.playerName;
            settingsModal.style.display = 'block';
        });
        
        document.querySelectorAll('.close').forEach(closeBtn => {
            closeBtn.addEventListener('click', (e) => {
                e.target.closest('.modal').style.display = 'none';
            });
        });
        
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.style.display = 'none';
            }
        });
    }
    
    showStatsModal() {
        const modal = document.getElementById('statsModal');
        
        document.getElementById('gamesPlayed').textContent = this.stats.gamesPlayed;
        document.getElementById('winRate').textContent = 
            this.stats.gamesPlayed > 0 
                ? Math.round((this.stats.gamesWon / this.stats.gamesPlayed) * 100) 
                : 0;
        document.getElementById('currentStreak').textContent = this.stats.currentStreak;
        document.getElementById('maxStreak').textContent = this.stats.maxStreak;
        document.getElementById('totalScore').textContent = this.stats.totalScore;
        
        modal.style.display = 'block';
    }
    
    saveName() {
        const nameInput = document.getElementById('playerName');
        const name = nameInput.value.trim();
        
        if (name.length > 0) {
            this.playerName = name;
            localStorage.setItem('sentle_playerName', name);
            this.showMessage('Name saved!', 'success');
        } else {
            this.showMessage('Please enter a valid name', 'error');
        }
    }
    
    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        this.showMessage(`Theme changed to ${newTheme}`, 'info');
    }
}

// Initialize game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Apply saved theme
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    // Start game
    new SentleGame();
});
    
    setupEventListeners() {
        // Physical keyboard
        document.addEventListener('keydown', (e) => this.handleKeyPress(e));
        
        // Virtual keyboard
        document.querySelectorAll('.key').forEach(key => {
            key.addEventListener('click', () => {
                const keyValue = key.dataset.key;
                this.handleVirtualKey(keyValue);
            });
        });
        
        // Modal controls
        this.setupModals();
        
        // Settings
        document.getElementById('saveNameBtn')?.addEventListener('click', () => this.saveName());
        document.getElementById('themeToggle')?.addEventListener('click', () => this.toggleTheme());
    }
    
    handleKeyPress(e) {
        if (this.gameOver) return;
        
        const key = e.key;
        
        if (key === 'Enter') {
            this.submitGuess();
        } else if (key === 'Backspace') {
            this.deleteLetter();
        } else if (key === ' ') {
            e.preventDefault();
            this.addLetter(' ');
        } else if (/^[a-zA-Z]$/.test(key)) {
            this.addLetter(key.toUpperCase());
        }
    }
    
    handleVirtualKey(key) {
        if (this.gameOver) return;
        
        if (key === 'ENTER') {
            this.submitGuess();
        } else if (key === 'BACKSPACE') {
            this.deleteLetter();
        } else if (key === 'SPACE') {
            this.addLetter(' ');
        } else {
            this.addLetter(key);
        }
    }
    
    addLetter(letter) {
        if (this.currentGuess.length < this.targetSentence.length) {
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
        const row = document.getElementById(`row-${this.currentRow}`);
        const boxes = row.querySelectorAll('.letter-box:not(.space)');
        
        let guessIndex = 0;
        for (let i = 0; i < this.targetSentence.length; i++) {
            const box = document.getElementById(`box-${this.currentRow}-${i}`);
            
            if (this.targetSentence[i] === ' ') {
                continue;
            }
            
            if (guessIndex < this.currentGuess.length && this.currentGuess[guessIndex] !== ' ') {
                box.textContent = this.currentGuess[guessIndex];
                box.classList.add('active');
            } else {
                box.textContent = '';
                box.classList.remove('active');
            }
            
            if (this.currentGuess[guessIndex] === ' ') {
                guessIndex++;
            }
            guessIndex++;
        }
    }
    
    async submitGuess() {
        if (this.currentGuess.length !== this.targetSentence.replace(/ /g, '').length) {
            this.showMessage('Not enough letters!', 'error');
            return;
        }
        
        // Check guess validity
        if (!this.isValidGuess(this.currentGuess)) {
            this.showMessage('Please enter a valid sentence!', 'error');
            return;
        }
        
        this.evaluateGuess();
        this.guesses.push(this.currentGuess);
        
        const isWin = this.currentGuess.replace(/ /g, '') === this.targetSentence.replace(/ /g, '');
        
        if (isWin) {
            this.gameOver = true;
            const score = this.calculateScore(this.currentRow + 1);
            await this.submitScore(score, this.currentRow + 1);
            this.updateStats(true, this.currentRow + 1, score);
            setTimeout(() => {
                this.showMessage(`Congratulations! You won with ${score} points! 🎉`, 'success');
                this.showStatsModal();
            }, 2000);
        } else if (this.currentRow >= this.maxGuesses - 1) {
            this.gameOver = true;
            this.updateStats(false, this.maxGuesses, 0);
            setTimeout(() => {
                this.showMessage(`Game Over! The sentence was: ${this.targetSentence}`, 'error');
                this.showStatsModal();
            }, 2000);
        } else {
            this.currentRow++;
            this.currentGuess = '';
        }
        
        this.saveGameState();
    }
    
    isValidGuess(guess) {
        // Check if guess has at least one letter and matches the pattern
        const cleanGuess = guess.replace(/ /g, '');
        const cleanTarget = this.targetSentence.replace(/ /g, '');
        
        return cleanGuess.length === cleanTarget.length && /[A-Z]/.test(guess);
    }
    
    evaluateGuess() {
        const row = document.getElementById(`row-${this.currentRow}`);
        const boxes = Array.from(row.querySelectorAll('.letter-box'));
        
        const targetChars = this.targetSentence.split('');
        const guessChars = [];
        
        // Build guess chars array matching target positions
        let guessIndex = 0;
        for (let i = 0; i < targetChars.length; i++) {
            if (targetChars[i] === ' ') {
                guessChars.push(' ');
            } else {
                while (guessIndex < this.currentGuess.length && this.currentGuess[guessIndex] === ' ') {
                    guessIndex++;
                }
                guessChars.push(this.currentGuess[guessIndex] || '');
                guessIndex++;
            }
        }
        
        const letterCount = {};
        targetChars.forEach(char => {
            if (char !== ' ') {
                letterCount[char] = (letterCount[char] || 0) + 1;
            }
        });
        
        // First pass: mark correct letters
        guessChars.forEach((char, i) => {
            if (char === targetChars[i]) {
                boxes[i].classList.add('correct');
                letterCount[char]--;
                this.updateKeyboardKey(char, 'correct');
            }
        });
        
        // Second pass: mark present and absent letters
        guessChars.forEach((char, i) => {
            if (char !== ' ' && !boxes[i].classList.contains('correct')) {
                if (letterCount[char] > 0) {
                    boxes[i].classList.add('present');
                    letterCount[char]--;
                    if (this.keyboardState[char] !== 'correct') {
                        this.updateKeyboardKey(char, 'present');
                    }
                } else {
                    boxes[i].classList.add('absent');
                    if (!this.keyboardState[char]) {
                        this.updateKeyboardKey(char, 'absent');
                    }
                }
            }
        });
    }
    
    updateKeyboardKey(letter, state) {
        this.keyboardState[letter] = state;
        const key = document.querySelector(`.key[data-key="${letter}"]`);
        if (key) {
            key.classList.remove('correct', 'present', 'absent');
            key.classList.add(state);
        }
    }
    
    calculateScore(guessCount) {
        const scoreMap = { 1: 600, 2: 500, 3: 400, 4: 300, 5: 200, 6: 100 };
        return scoreMap[guessCount] || 0;
    }
    
    async submitScore(score, guesses) {
        try {
            await fetch('/api/sentle/score', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    playerName: this.playerName,
                    score: score,
                    guesses: guesses,
                    sentenceId: this.sentenceId,
                    date: this.targetDate
                })
            });
            
            this.loadLeaderboard();
        } catch (error) {
            console.error('Error submitting score:', error);
        }
    }
    
    async loadLeaderboard() {
        try {
            const response = await fetch('/api/sentle/leaderboard');
            const data = await response.json();
            
            const leaderboard = document.getElementById('leaderboard');
            leaderboard.innerHTML = '';
            
            if (data.leaderboard && data.leaderboard.length > 0) {
                data.leaderboard.forEach((entry, index) => {
                    const item = document.createElement('div');
                    item.className = 'leaderboard-item';
                    
                    const rankClass = index === 0 ? 'top1' : index === 1 ? 'top2' : index === 2 ? 'top3' : '';
                    
                    item.innerHTML = `
                        <span class="leaderboard-rank ${rankClass}">#${index + 1}</span>
                        <span class="leaderboard-name">${this.escapeHtml(entry.playerName)}</span>
                        <span class="leaderboard-score">${entry.score} pts</span>
                    `;
                    
                    leaderboard.appendChild(item);
                });
            } else {
                leaderboard.innerHTML = '<div class="loading">No scores yet. Be the first!</div>';
            }
        } catch (error) {
            console.error('Error loading leaderboard:', error);
        }
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    showMessage(text, type = 'info') {
        const message = document.getElementById('message');
        message.textContent = text;
        message.className = `message ${type}`;
        
        setTimeout(() => {
            message.className = 'message';
            message.textContent = '';
        }, 3000);
    }
    
    loadStats() {
        const defaultStats = {
            gamesPlayed: 0,
            gamesWon: 0,
            currentStreak: 0,
            maxStreak: 0,
            totalScore: 0,
            guessDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }
        };
        
        const saved = localStorage.getItem('sentle_stats');
        return saved ? JSON.parse(saved) : defaultStats;
    }
    
    updateStats(won, guesses, score) {
        this.stats.gamesPlayed++;
        
        if (won) {
            this.stats.gamesWon++;
            this.stats.currentStreak++;
            this.stats.maxStreak = Math.max(this.stats.maxStreak, this.stats.currentStreak);
            this.stats.guessDistribution[guesses]++;
            this.stats.totalScore += score;
        } else {
            this.stats.currentStreak = 0;
        }
        
        localStorage.setItem('sentle_stats', JSON.stringify(this.stats));
    }
    
    saveGameState() {
        const state = {
            date: this.targetDate,
            guesses: this.guesses,
            currentRow: this.currentRow,
            gameOver: this.gameOver
        };
        
        localStorage.setItem('sentle_gameState', JSON.stringify(state));
    }
    
    checkGameState() {
        const saved = localStorage.getItem('sentle_gameState');
        if (!saved) return;
        
        const state = JSON.parse(saved);
        
        if (state.date === this.targetDate && state.guesses.length > 0) {
            // Restore game state
            this.guesses = state.guesses;
            this.currentRow = state.currentRow;
            this.gameOver = state.gameOver;
            
            // Replay guesses
            this.guesses.forEach((guess, index) => {
                this.currentGuess = guess;
                this.currentRow = index;
                this.updateCurrentRow();
                this.evaluateGuess();
            });
            
            if (!this.gameOver) {
                this.currentRow = state.currentRow;
                this.currentGuess = '';
            }
        }
    }
    
    setupModals() {
        const helpBtn = document.getElementById('helpBtn');
        const statsBtn = document.getElementById('statsBtn');
        const settingsBtn = document.getElementById('settingsBtn');
        
        const helpModal = document.getElementById('helpModal');
        const statsModal = document.getElementById('statsModal');
        const settingsModal = document.getElementById('settingsModal');
        
        helpBtn?.addEventListener('click', () => {
            helpModal.style.display = 'block';
        });
        
        statsBtn?.addEventListener('click', () => {
            this.showStatsModal();
        });
        
        settingsBtn?.addEventListener('click', () => {
            document.getElementById('playerName').value = this.playerName;
            settingsModal.style.display = 'block';
        });
        
        document.querySelectorAll('.close').forEach(closeBtn => {
            closeBtn.addEventListener('click', (e) => {
                e.target.closest('.modal').style.display = 'none';
            });
        });
        
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.style.display = 'none';
            }
        });
    }
    
    showStatsModal() {
        const modal = document.getElementById('statsModal');
        
        document.getElementById('gamesPlayed').textContent = this.stats.gamesPlayed;
        document.getElementById('winRate').textContent = 
            this.stats.gamesPlayed > 0 
                ? Math.round((this.stats.gamesWon / this.stats.gamesPlayed) * 100) 
                : 0;
        document.getElementById('currentStreak').textContent = this.stats.currentStreak;
        document.getElementById('maxStreak').textContent = this.stats.maxStreak;
        document.getElementById('totalScore').textContent = this.stats.totalScore;
        
        modal.style.display = 'block';
    }
    
    saveName() {
        const nameInput = document.getElementById('playerName');
        const name = nameInput.value.trim();
        
        if (name.length > 0) {
            this.playerName = name;
            localStorage.setItem('sentle_playerName', name);
            this.showMessage('Name saved!', 'success');
        } else {
            this.showMessage('Please enter a valid name', 'error');
        }
    }
    
    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        this.showMessage(`Theme changed to ${newTheme}`, 'info');
    }
}

// Initialize game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Apply saved theme
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    // Start game
    new SentleGame();
});
