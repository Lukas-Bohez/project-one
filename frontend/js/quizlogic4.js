// Fixed QuizQuestionHandler with proper user handling
class QuizQuestionHandler {
    constructor(quizLogic, socket) {
        this.quizLogic = quizLogic;
        this.socket = socket;
        this.currentQuestion = null;
        this.currentUser = null;
        this.players = [];
        this.timeRemaining = 0;
    }

    setCurrentUser(user) {
        console.log("QuizQuestionHandler: Setting current user:", user);
        this.currentUser = user;
        
        // Ensure both id and user_id are available for compatibility
        if (this.currentUser && !this.currentUser.user_id && this.currentUser.id) {
            this.currentUser.user_id = this.currentUser.id;
        }
        if (this.currentUser && !this.currentUser.id && this.currentUser.user_id) {
            this.currentUser.id = this.currentUser.user_id;
        }
        
        console.log("QuizQuestionHandler: Current user after processing:", this.currentUser);
    }

    loadQuestion(questionData) {
        console.log("Loading question:", questionData);
        this.currentQuestion = questionData;

        // Clean up any existing explanation displays
        this.clearExplanations();

        // Clear previous question
        this.clearQuestion();

        // Set question text
        this.setQuestionText(questionData);

        // Set question image if exists
        this.setQuestionImage(questionData);

        // Set up answer options
        this.setupAnswerOptions(questionData);

        // Bind events
        this.bindAnswerEvents();

        // Emit custom event
        document.dispatchEvent(new CustomEvent('questionLoaded', {
            detail: questionData
        }));
    }

    // Method to clear any explanation displays when new question loads
    clearExplanations() {
        // Remove explanation modal if it exists
        const explanationModal = document.getElementById('explanationModal');
        if (explanationModal) {
            explanationModal.remove();
        }
        
        // Clear any explanation content from the main question area
        const questionText = document.getElementById('questionText');
        if (questionText && questionText.querySelector('.explanation-content')) {
            questionText.innerHTML = '';
        }
    }

    clearQuestion() {
        const questionText = document.getElementById('questionText');
        const questionImage = document.getElementById('questionImage');
        const answerButtons = document.querySelectorAll('.c-answer-btn');

        if (questionText) questionText.textContent = '';
        if (questionImage) questionImage.innerHTML = '';

        answerButtons.forEach((button) => {
            button.textContent = '';
            button.style.display = 'none';
            button.disabled = true;
            button.classList.remove('selected');
            delete button.dataset.themeId;
            delete button.dataset.themeName;
        });
    }

    setQuestionText(questionData) {
        const questionText = document.getElementById('questionText');
        if (questionText) {
            // Use custom question text if provided, otherwise use default
            let questionType;
            if (questionData.type === 'theme_selection') {
                questionType = questionData.question || 'Select a theme for the next round:';
            } else {
                questionType = questionData.question || 'No question text provided.';
            }
            questionText.textContent = questionType;
        }
    }

    setQuestionImage(questionData) {
        const questionImage = document.getElementById('questionImage');
        if (questionImage && questionData.image) {
            questionImage.innerHTML = `<img src="${questionData.image}" alt="Question image" class="c-question-image">`;
        }
    }

setupAnswerOptions(questionData) {
    const options = questionData.type === 'theme_selection'
        ? questionData.themes
        : questionData.answers;

    if (!options || options.length === 0) {
        this.handleErrorDisplay('No options available for this round.');
        return;
    }

    // Get the answers container
    const answersContainer = document.querySelector('.c-answers-container');
    if (!answersContainer) {
        console.error('Answers container not found');
        return;
    }

    // Get all existing answer buttons
    let answerButtons = Array.from(answersContainer.querySelectorAll('.c-answer-btn'));

    // If we need more buttons than currently exist, create them
    while (answerButtons.length < options.length) {
        const newButton = document.createElement('button');
        newButton.className = 'c-answer-btn gamepad';
        newButton.id = `answer${answerButtons.length + 1}`;
        answersContainer.appendChild(newButton);
        answerButtons.push(newButton);
    }

    // Now set up all the options
    answerButtons.forEach((button, index) => {
        if (options[index]) {
            const option = options[index];

            button.textContent = questionData.type === 'theme_selection'
                ? (option.name || option.title || `Theme ${index + 1}`)
                : (option.answer_text || option.text || option);

            button.style.display = 'block';
            button.disabled = false;
            button.classList.add('gamepad');

            if (questionData.type === 'theme_selection') {
                button.dataset.themeId = option.id;
                button.dataset.themeName = option.name || option.title;
            }
        } else {
            // Hide extra buttons if we have more than needed
            button.style.display = 'none';
            button.disabled = true;
        }
    });
}
    bindAnswerEvents() {
        const answerButtons = document.querySelectorAll('.c-answer-btn');
        if (answerButtons.length === 0) {
            console.warn("No answer buttons found");
            return;
        }

        answerButtons.forEach((button, index) => {
            // Remove old listener
            const oldClickListener = button.__quizAnswerListener;
            if (oldClickListener) {
                button.removeEventListener('click', oldClickListener);
            }

            // Add new listener
            const newClickListener = () => {
                this.handleAnswerClick(index, button);
            };
            button.addEventListener('click', newClickListener);
            button.__quizAnswerListener = newClickListener;
        });

        console.log("Bound events to", answerButtons.length, "answer buttons");
    }

    handleAnswerClick(answerIndex, buttonElement) {
        console.log("Answer clicked:", answerIndex);
        console.log("Current user at time of click:", this.currentUser);

        if (!this.currentQuestion || !this.currentQuestion.type) {
            console.error("Invalid question state");
            return;
        }

        const answerButtons = document.querySelectorAll('.c-answer-btn');
        const questionType = this.currentQuestion.type;
        answerButtons.forEach(btn => btn.disabled = true);

        // FIXED: Better user validation
        if (!this.currentUser) {
            console.error("No current user set in handler");
            this.handleErrorDisplay("Please log in again - no user data");
            answerButtons.forEach(btn => btn.disabled = false);
            return;
        }

        // Check for both possible user ID fields
        const userId = this.currentUser.user_id || this.currentUser.id;
        if (!userId) {
            console.error("User object missing ID field:", this.currentUser);
            this.handleErrorDisplay("Please log in again - missing user ID");
            answerButtons.forEach(btn => btn.disabled = false);
            return;
        }

        console.log("Using user ID:", userId);

        const options = questionType === 'theme_selection'
            ? this.currentQuestion.themes
            : this.currentQuestion.answers;

        if (!options || !Array.isArray(options)) {
            console.error("Invalid options array:", options);
            this.handleErrorDisplay("No valid choices available");
            answerButtons.forEach(btn => btn.disabled = false);
            return;
        }

        if (answerIndex < 0 || answerIndex >= options.length) {
            console.error("Invalid answer index:", answerIndex);
            this.handleErrorDisplay("Invalid selection");
            answerButtons.forEach(btn => btn.disabled = false);
            return;
        }

        const selectedOption = options[answerIndex];

        if (questionType === 'theme_selection') {
            if (!selectedOption || typeof selectedOption !== 'object') {
                console.error("Invalid theme option structure:", selectedOption);
                this.handleErrorDisplay("Invalid theme format");
                answerButtons.forEach(btn => btn.disabled = false);
                return;
            }

            // Ensure the themeId is a valid number
            const themeId = Number(selectedOption.id);
            if (!selectedOption.id || isNaN(themeId)) {
                console.error("Non-numeric or missing theme ID:", selectedOption.id);
                this.handleErrorDisplay("Theme ID format error");
                answerButtons.forEach(btn => btn.disabled = false);
                return;
            }

            const emissionData = {
                userId: Number(userId), // Use the validated userId
                themeId: themeId,
                themeName: String(selectedOption.name || selectedOption.title || ""),
                request_user_data: true
            };

            console.log("Emitting theme_selected with verified data:", emissionData);
            this.socket.emit('theme_selected', emissionData);

        } else {
            // Handle regular answer submission
            const emissionData = {
                userId: Number(userId), // Use the validated userId
                questionId: this.currentQuestion.id,
                answerIndex: answerIndex,
                answerText: selectedOption.answer_text || selectedOption.text || selectedOption,
                request_user_data: true
            };

            console.log("Emitting answer with verified data:", emissionData);
            this.socket.emit('submit_answer', emissionData);
        }

        // Visual feedback
        buttonElement.classList.add('selected');
        setTimeout(() => {
            buttonElement.classList.remove('selected');
            answerButtons.forEach(btn => btn.disabled = false);
        }, 1500);
    }

    showExplanation(data) {
        console.log("Showing explanation for question", data.question_id || 'unknown', data);
        
        // Pass the entire data object to displayExplanation
        this.displayExplanation(data);
    }

    displayExplanation(explanationData) {
        console.log("Displaying explanation in existing question area", explanationData);
        
        // Extract data from the explanation object
        const explanationText = explanationData?.explanation_text || 'No explanation provided';
        const duration = explanationData?.duration || 5;
        const questionId = explanationData?.question_id;
        
        // Try to find existing containers first
        let questionTextEl = document.getElementById('questionText');
        let answerContainer = document.getElementById('answerContainer');
        
        // If core containers don't exist, try to find or create them
        if (!questionTextEl || !answerContainer) {
            console.warn("Core containers missing, attempting to find or create them");
            
            // Try to find alternative containers that might exist
            const quizContainer = document.querySelector('.quiz-container') || 
                                 document.querySelector('#quizContainer') ||
                                 document.querySelector('.c-quiz-area') ||
                                 document.querySelector('main') ||
                                 document.body;
            
            if (!quizContainer) {
                console.error("No suitable container found for explanation display");
                // Fallback: create a modal-style overlay
                this.createExplanationModal(explanationText);
                return;
            }
            
            // Create the missing elements if they don't exist
            if (!questionTextEl) {
                questionTextEl = document.createElement('div');
                questionTextEl.id = 'questionText';
                questionTextEl.className = 'question-text';
                quizContainer.appendChild(questionTextEl);
            }
            
            if (!answerContainer) {
                answerContainer = document.createElement('div');
                answerContainer.id = 'answerContainer';
                answerContainer.className = 'answer-container';
                quizContainer.appendChild(answerContainer);
            }
        }
        
        // Now display the explanation
        questionTextEl.innerHTML = `
            <div class="explanation-content">
                <h3>Explanation</h3>
                <p style="white-space: pre-line;">${explanationText}</p>
            </div>
        `;
        
        // Clear answers - no continue button needed, server will send next question
        answerContainer.innerHTML = '';
        answerContainer.style.display = 'none';
        
        // Emit custom event for other parts of the app
        document.dispatchEvent(new CustomEvent('explanationDisplayed', {
            detail: { explanationText, duration, questionId }
        }));
    }

    // Fallback method to create a modal-style explanation display
    createExplanationModal(explanationText) {
        console.log("Creating explanation modal as fallback");
        
        // Remove any existing explanation modal
        const existingModal = document.getElementById('explanationModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Create modal overlay
        const modal = document.createElement('div');
        modal.id = 'explanationModal';
        modal.className = 'explanation-modal-overlay';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1002;
            animation: fadeIn 0.3s ease;
        `;
        
        // Create modal content (no continue button - server will handle next question)
        modal.innerHTML = `
            <div class="explanation-modal-content" style="
                background: white;
                padding: 30px;
                border-radius: 10px;
                max-width: 600px;
                max-height: 80vh;
                overflow-y: auto;
                margin: 20px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            ">
                <div class="explanation-content">
                    <h3 style="color: #333; margin-bottom: 20px;">Explanation</h3>
                    <p style="color: #666; line-height: 1.6; margin-bottom: 30px; white-space: pre-line;">
                        ${explanationText}
                    </p>
                </div>
            </div>
        `;
        
        // Add fade-in animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
        `;
        document.head.appendChild(style);
        
        // Add to page
        document.body.appendChild(modal);
        
        // Store reference to modal for cleanup when next question loads
        this.currentExplanationModal = modal;
        
        // Emit custom event
        document.dispatchEvent(new CustomEvent('explanationDisplayed', {
            detail: { explanationText, modalMode: true }
        }));
    }
    showThemeDisplay(themeData) {
    console.log("Showing theme display", themeData);
    this.displayTheme(themeData);
}

displayTheme(themeData) {
    console.log("Displaying theme in existing question area", themeData);
    
    // Extract data from the theme object
    const themeName = themeData?.name || 'Unknown Theme';
    const themeDescription = themeData?.description || 'No description provided';
    
    // Try to find existing containers first (same as explanation display)
    let questionTextEl = document.getElementById('questionText');
    let answerContainer = document.getElementById('answerContainer');
    
    // If core containers don't exist, try to find or create them
    if (!questionTextEl || !answerContainer) {
        console.warn("Core containers missing, attempting to find or create them");
        
        const quizContainer = document.querySelector('.quiz-container') || 
                             document.querySelector('#quizContainer') ||
                             document.querySelector('.c-quiz-area') ||
                             document.querySelector('main') ||
                             document.body;
        
        if (!quizContainer) {
            console.error("No suitable container found for theme display");
            // Fallback: create a modal-style overlay
            this.createThemeModal(themeName, themeDescription);
            return;
        }
        
        // Create the missing elements if they don't exist
        if (!questionTextEl) {
            questionTextEl = document.createElement('div');
            questionTextEl.id = 'questionText';
            questionTextEl.className = 'question-text';
            quizContainer.appendChild(questionTextEl);
        }
        
        if (!answerContainer) {
            answerContainer = document.createElement('div');
            answerContainer.id = 'answerContainer';
            answerContainer.className = 'answer-container';
            quizContainer.appendChild(answerContainer);
        }
    }
    
    // Now display the theme
    questionTextEl.innerHTML = `
        <div class="theme-content">
            <h3>Theme: ${themeName}</h3>
            <p style="white-space: pre-line;">${themeDescription}</p>
        </div>
    `;
    
    // Clear answers
    answerContainer.innerHTML = '';
    answerContainer.style.display = 'none';
    
    // Emit custom event for other parts of the app
    document.dispatchEvent(new CustomEvent('themeDisplayed', {
        detail: { themeName, themeDescription }
    }));
}

// Fallback method to create a modal-style theme display
createThemeModal(themeName, themeDescription) {
    console.log("Creating theme modal as fallback");
    
    // Remove any existing theme modal
    const existingModal = document.getElementById('themeModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Create modal overlay
    const modal = document.createElement('div');
    modal.id = 'themeModal';
    modal.className = 'theme-modal-overlay';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1002;
        animation: fadeIn 0.3s ease;
    `;
    
    // Create modal content
    modal.innerHTML = `
        <div class="theme-modal-content" style="
            background: white;
            padding: 30px;
            border-radius: 10px;
            max-width: 600px;
            max-height: 80vh;
            overflow-y: auto;
            margin: 20px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        ">
            <div class="theme-content">
                <h3 style="color: #333; margin-bottom: 20px;">Theme: ${themeName}</h3>
                <p style="color: #666; line-height: 1.6; margin-bottom: 30px; white-space: pre-line;">
                    ${themeDescription}
                </p>
            </div>
        </div>
    `;
    
    // Add fade-in animation if not already present
    if (!document.getElementById('fadeInAnimationStyle')) {
        const style = document.createElement('style');
        style.id = 'fadeInAnimationStyle';
        style.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Add to page
    document.body.appendChild(modal);
    
    // Store reference to modal for cleanup when next question loads
    this.currentThemeModal = modal;
    
    // Emit custom event
    document.dispatchEvent(new CustomEvent('themeDisplayed', {
        detail: { themeName, themeDescription, modalMode: true }
    }));
}
    // Method to handle the end of the quiz
    showQuizEnd(data) {
        console.log("Handling quiz end:", data);
        this.displayFinalScreen("Quiz Finished!", data.message || "Thanks for playing!");
        
        // Optionally show final scores
        if (data.final_scores && Array.isArray(data.final_scores)) {
            this.displayFinalScores(data.final_scores);
        }
    }

    // Display final screen
    displayFinalScreen(title, message) {
        const finalContainer = document.getElementById('finalScreenContainer') || this.createFinalScreenContainer();
        
        finalContainer.innerHTML = `
            <div class="final-screen-content">
                <h2>${title}</h2>
                <p>${message}</p>
                <div id="finalScoresContainer"></div>
                <button class="btn btn-primary" onclick="location.reload()">
                    Start New Quiz
                </button>
            </div>
        `;
        
        finalContainer.style.display = 'flex';
    }

    // Create final screen container
    createFinalScreenContainer() {
        const container = document.createElement('div');
        container.id = 'finalScreenContainer';
        container.className = 'final-screen-overlay';
        container.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.9);
            display: none;
            justify-content: center;
            align-items: center;
            z-index: 1001;
            color: white;
            text-align: center;
        `;
        
        document.body.appendChild(container);
        return container;
    }

    // Display final scores
    displayFinalScores(scores) {
        const scoresContainer = document.getElementById('finalScoresContainer');
        if (!scoresContainer) return;

        const scoresHtml = scores
            .sort((a, b) => b.score - a.score)
            .map((player, index) => `
                <div class="final-score-item">
                    <span class="rank">#${index + 1}</span>
                    <span class="name">${player.name || player.username}</span>
                    <span class="score">${player.score} points</span>
                </div>
            `).join('');

        scoresContainer.innerHTML = `
            <h3>Final Scores</h3>
            <div class="scores-list">${scoresHtml}</div>
        `;
    }

    // Method to handle phase changes
    handlePhaseChange(data) {
        console.log(`Handling phase change to ${data.phase}`);
        let message = "";
        
        switch (data.phase) {
            case 'theme_display':
                message = `Theme selected! Get ready for the quiz.`;
                this.clearQuestion();
                break;
            case 'quiz':
                message = 'The quiz is starting now!';
                break;
            case 'voting':
                message = 'A new quiz is starting! Vote for a theme.';
                this.clearQuestion();
                break;
            case 'explanation':
                message = 'Reviewing the answer...';
                break;
            case 'results':
                message = 'Quiz completed! Calculating results...';
                break;
        }
        
        if (message) {
            this.showFeedback(message);
        }

        // Emit custom event for other parts of the app
        document.dispatchEvent(new CustomEvent('phaseChanged', {
            detail: data
        }));
    }

    // Method to update timer display
    updateTimer(timeRemaining) {
        this.timeRemaining = timeRemaining;
        const timerElement = document.getElementById('timerDisplay');
        
        if (timerElement) {
            timerElement.textContent = `Time: ${timeRemaining}s`;
            
            // Add visual warning for low time
            if (timeRemaining <= 5) {
                timerElement.classList.add('timer-warning');
            } else {
                timerElement.classList.remove('timer-warning');
            }
        }

        // Emit custom event
        document.dispatchEvent(new CustomEvent('timerUpdate', {
            detail: { timeRemaining }
        }));
    }

    // Method to handle timer finished
    handleTimerFinished() {
        console.log("Timer finished");
        
        // Disable all answer buttons
        const answerButtons = document.querySelectorAll('.c-answer-btn');
        answerButtons.forEach(btn => {
            btn.disabled = true;
            btn.classList.add('disabled');
        });

        this.showFeedback("Time's up!", true);

        // Emit custom event
        document.dispatchEvent(new CustomEvent('timerFinished'));
    }

    // Method to show feedback messages
    showFeedback(message, isError = false) {
        console.log(`Feedback: ${message}`, isError ? '(Error)' : '');
        
        // Create or get feedback element
        let feedbackElement = document.getElementById('feedbackDisplay');
        if (!feedbackElement) {
            feedbackElement = document.createElement('div');
            feedbackElement.id = 'feedbackDisplay';
            feedbackElement.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 15px 20px;
                border-radius: 5px;
                color: white;
                font-weight: bold;
                z-index: 1000;
                max-width: 300px;
                transition: opacity 0.3s ease;
            `;
            document.body.appendChild(feedbackElement);
        }

        // Set message and style
        feedbackElement.textContent = message;
        feedbackElement.style.backgroundColor = isError ? '#dc3545' : '#28a745';
        feedbackElement.style.opacity = '1';
        feedbackElement.style.display = 'block';

        // Auto-hide after 3 seconds
        setTimeout(() => {
            feedbackElement.style.opacity = '0';
            setTimeout(() => {
                feedbackElement.style.display = 'none';
            }, 300);
        }, 3000);
    }

    // Method to update players display
    updatePlayersDisplay() {
        const playersContainer = document.getElementById('playersContainer');
        if (!playersContainer || !this.players) return;

        const playersHtml = this.players
            .sort((a, b) => (b.session_score || 0) - (a.session_score || 0))
            .map((player, index) => `
                <div class="player-item ${player.user_id === this.currentUser?.user_id ? 'current-player' : ''}">
                    <span class="rank">#${index + 1}</span>
                    <span class="name">${player.name || player.username}</span>
                    <span class="score">${player.session_score || 0}</span>
                </div>
            `).join('');

        playersContainer.innerHTML = `
            <h3>Players</h3>
            <div class="players-list">${playersHtml}</div>
        `;
    }

    // Method to handle error display
    handleErrorDisplay(message) {
        console.error("Question error:", message);

        const questionText = document.getElementById('questionText');
        const questionImage = document.getElementById('questionImage');
        const answerButtons = document.querySelectorAll('.c-answer-btn');

        if (questionText) questionText.textContent = `ERROR: ${message}`;
        if (questionImage) questionImage.innerHTML = '';

        answerButtons.forEach(button => {
            button.style.display = 'none';
            button.disabled = true;
            button.textContent = '';
            button.classList.remove('selected');
        });

        this.showFeedback(message, true);

        document.dispatchEvent(new CustomEvent('quizError', {
            detail: { message }
        }));
    }

    // Method to reset the quiz state
    reset() {
        this.currentQuestion = null;
        this.timeRemaining = 0;
        this.clearQuestion();
        
        // Hide overlays
        const explanationContainer = document.getElementById('explanationContainer');
        const finalContainer = document.getElementById('finalScreenContainer');
        
        if (explanationContainer) explanationContainer.style.display = 'none';
        if (finalContainer) finalContainer.style.display = 'none';
        
        console.log("Quiz handler reset");
    }
}

window.QuizQuestionHandler = QuizQuestionHandler;