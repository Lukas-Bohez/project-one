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

        // Inject responsive CSS styles for all screen sizes
    injectResponsiveStyles() {
        const existingStyle = document.getElementById('quiz-responsive-styles');
        if (existingStyle) {
            existingStyle.remove();
        }

        const style = document.createElement('style');
        style.id = 'quiz-responsive-styles';
        style.textContent = `
            /* Base quiz container styling */
            .quiz-container, #quizContainer, .c-quiz-area {
                height: 100vh;
                max-height: 100vh;
                overflow: hidden;
                display: flex;
                flex-direction: column;
                padding: 0.5rem;
                box-sizing: border-box;
            }

            /* Question text responsive styling */
            #questionText, .question-text {
                flex: 1 1 auto;
                min-height: 15vh;
                max-height: 40vh;
                overflow-y: auto;
                padding: 1rem;
                margin-bottom: 1rem;
                font-size: clamp(1rem, 4vw, 2rem);
                line-height: 1.3;
                display: flex;
                align-items: center;
                justify-content: center;
                text-align: center;
                background: rgba(255, 255, 255, 0.9);
                border-radius: 10px;
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
                word-wrap: break-word;
                hyphens: auto;
            }

            /* Question image responsive styling */
            #questionImage {
                max-height: 20vh;
                margin-bottom: 1rem;
                display: flex;
                justify-content: center;
                align-items: center;
            }

            #questionImage img {
                max-width: 100%;
                max-height: 100%;
                object-fit: contain;
                border-radius: 8px;
            }

            /* Answers container - flexible grid */
            .c-answers-container {
                flex: 1 1 auto;
                display: grid;
                gap: 0.5rem;
                padding: 0.5rem 0;
                min-height: 40vh;
                max-height: 60vh;
            }

            /* Answer buttons responsive styling */
            .c-answer-btn {
                min-height: 8vh;
                max-height: 12vh;
                padding: 0.5rem;
                font-size: clamp(0.8rem, 3vw, 1.2rem);
                line-height: 1.2;
                border: 2px solid #ddd;
                border-radius: 8px;
                background: white;
                cursor: pointer;
                transition: all 0.3s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                text-align: center;
                word-wrap: break-word;
                hyphens: auto;
                overflow-wrap: break-word;
                box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
            }

            .c-answer-btn:hover:not(:disabled) {
                background: #f0f0f0;
                border-color: #007bff;
                transform: translateY(-2px);
                box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15);
            }

            .c-answer-btn:active {
                transform: translateY(0);
            }

            .c-answer-btn.selected {
                background: #007bff;
                color: white;
                border-color: #007bff;
            }

            .c-answer-btn:disabled {
                opacity: 0.6;
                cursor: not-allowed;
            }

            /* Grid layouts for different screen sizes */
            @media (min-height: 800px) {
                .c-answers-container {
                    grid-template-columns: 1fr 1fr;
                    grid-template-rows: 1fr 1fr;
                }
            }

            @media (max-height: 799px) and (min-height: 600px) {
                .c-answers-container {
                    grid-template-columns: 1fr 1fr;
                    grid-template-rows: 1fr 1fr;
                }
                
                #questionText, .question-text {
                    max-height: 25vh;
                    font-size: clamp(0.9rem, 3.5vw, 1.5rem);
                }
                
                .c-answer-btn {
                    min-height: 6vh;
                    max-height: 10vh;
                    font-size: clamp(0.7rem, 2.5vw, 1rem);
                }
            }

            @media (max-height: 599px) {
                .c-answers-container {
                    grid-template-columns: 1fr 1fr;
                    grid-template-rows: 1fr 1fr;
                }
                
                #questionText, .question-text {
                    max-height: 20vh;
                    min-height: 10vh;
                    font-size: clamp(0.8rem, 3vw, 1.2rem);
                    padding: 0.5rem;
                }
                
                .c-answer-btn {
                    min-height: 5vh;
                    max-height: 8vh;
                    font-size: clamp(0.6rem, 2vw, 0.9rem);
                    padding: 0.3rem;
                }
                
                #questionImage {
                    max-height: 15vh;
                }
            }

            /* Very small screens (phones in landscape) */
            @media (max-height: 450px) {
                .quiz-container, #quizContainer, .c-quiz-area {
                    padding: 0.25rem;
                }
                
                #questionText, .question-text {
                    max-height: 15vh;
                    min-height: 8vh;
                    font-size: clamp(0.7rem, 2.5vw, 1rem);
                    padding: 0.25rem;
                    margin-bottom: 0.5rem;
                }
                
                .c-answers-container {
                    gap: 0.25rem;
                    min-height: 30vh;
                }
                
                .c-answer-btn {
                    min-height: 4vh;
                    max-height: 6vh;
                    font-size: clamp(0.5rem, 1.8vw, 0.8rem);
                    padding: 0.2rem;
                }
                
                #questionImage {
                    max-height: 10vh;
                    margin-bottom: 0.5rem;
                }
            }

            /* Portrait orientation specific adjustments */
            @media (orientation: portrait) {
                @media (max-width: 480px) {
                    .c-answers-container {
                        grid-template-columns: 1fr;
                        grid-template-rows: repeat(4, 1fr);
                    }
                    
                    .c-answer-btn {
                        min-height: 6vh;
                        max-height: 8vh;
                    }
                }
            }

            /* Landscape orientation specific adjustments */
            @media (orientation: landscape) {
                @media (max-height: 500px) {
                    .c-answers-container {
                        grid-template-columns: 1fr 1fr;
                        grid-template-rows: 1fr 1fr;
                    }
                }
            }

            /* Explanation and theme content responsive styling */
            .explanation-content, .theme-content {
                padding: 1rem;
                background: rgba(255, 255, 255, 0.95);
                border-radius: 10px;
                margin-bottom: 1rem;
                max-height: 70vh;
                overflow-y: auto;
            }

            .explanation-content h3, .theme-content h3 {
                font-size: clamp(1.2rem, 4vw, 2rem);
                margin-bottom: 1rem;
                color: #333;
            }

            .explanation-content p, .theme-content p {
                font-size: clamp(0.9rem, 3vw, 1.2rem);
                line-height: 1.5;
                color: #666;
            }

            /* Modal responsive styling */
            .explanation-modal-overlay, .theme-modal-overlay {
                padding: 1rem;
            }

            .explanation-modal-content, .theme-modal-content {
                max-width: 90vw;
                max-height: 80vh;
                overflow-y: auto;
                margin: 1rem;
            }

            /* Timer and feedback responsive styling */
            #timerDisplay {
                position: fixed;
                top: 1rem;
                right: 1rem;
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 0.5rem 1rem;
                border-radius: 20px;
                font-size: clamp(0.8rem, 2.5vw, 1.2rem);
                font-weight: bold;
                z-index: 100;
                backdrop-filter: blur(5px);
            }

            .timer-warning {
                background: rgba(220, 53, 69, 0.9) !important;
                animation: pulse 1s infinite;
            }

            @keyframes pulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.05); }
                100% { transform: scale(1); }
            }

            #feedbackDisplay {
                max-width: 80vw;
                font-size: clamp(0.8rem, 2.5vw, 1rem);
                padding: 0.75rem 1rem;
            }

            /* Final screen responsive styling */
            #finalScreenContainer {
                padding: 1rem;
            }

            .final-screen-content .card {
                max-width: 90vw;
                width: 100%;
                padding: 2rem 1rem;
            }

            .final-screen-content .title {
                font-size: clamp(1.5rem, 6vw, 2.5rem);
            }

            .final-screen-content .message {
                font-size: clamp(1rem, 3vw, 1.2rem);
            }

            .user-greeting {
                font-size: clamp(1.2rem, 4vw, 1.5rem);
            }

            .restart-btn {
                padding: 0.75rem 1.5rem;
                font-size: clamp(0.9rem, 3vw, 1.1rem);
            }

            /* Utility classes for dynamic adjustments */
            .fit-screen {
                height: 100vh !important;
                max-height: 100vh !important;
                overflow: hidden !important;
            }

            .text-fit {
                font-size: clamp(0.6rem, 2vw, 2rem) !important;
                line-height: 1.2 !important;
            }

            .button-fit {
                min-height: 4vh !important;
                max-height: 12vh !important;
                font-size: clamp(0.5rem, 2vw, 1.2rem) !important;
            }
        `;
        
        document.head.appendChild(style);
    }

    // Enhanced method to ensure content fits on screen
    ensureScreenFit() {
        const container = document.querySelector('.quiz-container') || 
                         document.querySelector('#quizContainer') || 
                         document.querySelector('.c-quiz-area');
        
        if (container) {
            container.classList.add('fit-screen');
        }

        // Dynamically adjust if content is overflowing
        const questionText = document.getElementById('questionText');
        const answersContainer = document.querySelector('.c-answers-container');
        
        if (questionText && answersContainer) {
            const totalHeight = window.innerHeight;
            const questionHeight = questionText.offsetHeight;
            const answersHeight = answersContainer.offsetHeight;
            
            // If content doesn't fit, apply more aggressive sizing
            if (questionHeight + answersHeight > totalHeight * 0.9) {
                questionText.classList.add('text-fit');
                
                const answerButtons = document.querySelectorAll('.c-answer-btn');
                answerButtons.forEach(btn => {
                    btn.classList.add('button-fit');
                });
            }
        }
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
    this.ensureScreenFit();
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

        // Ensure responsive design is applied
        this.ensureScreenFit();

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

    // Reset all answer buttons to default state
    const answerButtons = document.querySelectorAll('.c-answer-btn');
    answerButtons.forEach(button => {
        // Remove any highlighting styles
        button.style.opacity = '1';
        button.style.backgroundColor = '';
        button.style.color = '';
        
        // Remove any correctness-related dataset attributes
        if (button.dataset.isCorrect !== undefined) {
            delete button.dataset.isCorrect;
        }
        if (button.dataset.answerId !== undefined) {
            delete button.dataset.answerId;
        }
        
        // Reset disabled state (will be properly set when new question loads)
        button.disabled = false;
    });
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
    this.ensureScreenFit();
}


setQuestionImage(questionData) {
    const questionImage = document.getElementById('questionImage');
    if (questionImage && questionData.image) {
        questionImage.innerHTML = `<img src="${questionData.image}" alt="Question image" class="c-question-image">`;
    }
    this.ensureScreenFit();
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

            // Store additional data as dataset attributes
            if (questionData.type === 'theme_selection') {
                button.dataset.themeId = option.id;
                button.dataset.themeName = option.name || option.title;
            } else {
                // For regular answers, store whether it's correct
                button.dataset.isCorrect = option.is_correct || 0;
                button.dataset.answerId = option.id;
            }
        } else {
            // Hide extra buttons if we have more than needed
            button.style.display = 'none';
            button.disabled = true;
        }
    });
    
    this.ensureScreenFit();
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
    
    // Highlight correct answers before showing explanation
    this.highlightCorrectAnswer(data);
    
    // Pass the entire data object to displayExplanation
    this.displayExplanation(data);
}

highlightCorrectAnswer() {
    const answerButtons = document.querySelectorAll('.c-answer-btn');
    
    answerButtons.forEach(button => {
        if (button.dataset.isCorrect !== undefined) {
            if (button.dataset.isCorrect === '1') {
                // Highlight correct answer (full opacity)
                button.style.opacity = '1';
                button.style.backgroundColor = '#4CAF50'; // Green for correct
                button.style.color = 'white';
            } else {
                // Dim incorrect answers
                button.style.opacity = '0.5';
                button.style.backgroundColor = ''; // Reset to default
                button.style.color = '';
            }
            button.disabled = true; // Keep buttons disabled during explanation
        }
    });
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
    
    // We keep the answer buttons visible but disabled with correct ones highlighted
    answerContainer.style.display = 'block';
    
    // Emit custom event for other parts of the app
    document.dispatchEvent(new CustomEvent('explanationDisplayed', {
        detail: { explanationText, duration, questionId }
    }));
    
    this.ensureScreenFit();
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
                padding: clamp(15px, 4vw, 30px);
                border-radius: 10px;
                max-width: min(600px, 90vw);
                max-height: 80vh;
                overflow-y: auto;
                margin: 20px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            ">
                <div class="explanation-content">
                    <h3 style="color: #333; margin-bottom: 20px; font-size: clamp(1.2rem, 4vw, 2rem);">Explanation</h3>
                    <p style="color: #666; line-height: 1.6; margin-bottom: 30px; white-space: pre-line; font-size: clamp(0.9rem, 3vw, 1.2rem);">
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
    
    this.ensureScreenFit();
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
            padding: clamp(15px, 4vw, 30px);
            border-radius: 10px;
            max-width: min(600px, 90vw);
            max-height: 80vh;
            overflow-y: auto;
            margin: 20px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        ">
            <div class="theme-content">
                <h3 style="color: #333; margin-bottom: 20px; font-size: clamp(1.2rem, 4vw, 2rem);">Theme: ${themeName}</h3>
                <p style="color: #666; line-height: 1.6; margin-bottom: 30px; white-space: pre-line; font-size: clamp(0.9rem, 3vw, 1.2rem);">
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

displayFinalScreen(title, message) {
    const finalContainer = document.getElementById('finalScreenContainer') || this.createFinalScreenContainer();
    
    // Get user details
    const firstName = localStorage.getItem('user_first_name') || '';
    const lastName = localStorage.getItem('user_last_name') || '';
    const userName = `${firstName} ${lastName}`.trim();
    
    // Inject CSS directly with responsive design
    const style = document.createElement('style');
    style.textContent = `
        #finalScreenContainer {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            display: none;
            justify-content: center;
            align-items: center;
            z-index: 1000;
            animation: fadeIn 0.5s ease-out;
            overflow: hidden;
            padding: 1rem;
            box-sizing: border-box;
        }
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        .final-screen-content {
            position: relative;
            width: 100%;
            height: 100%;
            display: flex;
            justify-content: center;
            align-items: center;
        }
        .final-screen-content .card {
            position: relative;
            background: white;
            padding: clamp(1.5rem, 5vw, 3rem);
            border-radius: 20px;
            box-shadow: 0 15px 30px rgba(0, 0, 0, 0.2);
            text-align: center;
            max-width: min(600px, 90vw);
            width: 100%;
            max-height: 80vh;
            overflow-y: auto;
            transform: scale(0.95);
            animation: cardEnter 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
            overflow: visible;
            z-index: 2;
        }
        @keyframes cardEnter {
            to { transform: scale(1); }
        }
        .final-screen-content .card::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: linear-gradient(
                to bottom right,
                rgba(255,255,255,0.3) 0%,
                rgba(255,255,255,0) 60%
            );
            transform: rotate(30deg);
            pointer-events: none;
        }
        .final-screen-content .title {
            font-size: clamp(1.5rem, 6vw, 2.5rem);
            margin-bottom: 1rem;
            color: #4a4a4a;
            background: linear-gradient(to right, #667eea, #764ba2);
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
            font-weight: 700;
        }
        .final-screen-content .message {
            font-size: clamp(1rem, 3vw, 1.2rem);
            color: #666;
            margin-bottom: 1rem;
            line-height: 1.6;
        }
        .user-greeting {
            font-size: clamp(1.2rem, 4vw, 1.5rem);
            font-weight: bold;
            margin: 1.5rem 0;
            color: #4a4a4a;
            animation: pulse 2s infinite;
        }
        @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.05); }
            100% { transform: scale(1); }
        }
        .restart-btn {
            position: relative;
            background: linear-gradient(to right, #667eea, #764ba2);
            color: white;
            border: none;
            padding: clamp(0.75rem, 3vw, 1rem) clamp(1.5rem, 4vw, 2rem);
            font-size: clamp(0.9rem, 3vw, 1.1rem);
            border-radius: 50px;
            cursor: pointer;
            overflow: hidden;
            transition: all 0.3s ease;
            box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
            z-index: 1;
            font-weight: 600;
            letter-spacing: 0.5px;
            margin-top: 1.5rem;
        }
        .restart-btn:hover {
            transform: translateY(-3px);
            box-shadow: 0 8px 20px rgba(102, 126, 234, 0.6);
        }
        .restart-btn:active {
            transform: translateY(1px);
        }
        .hover-effect {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 5px;
            height: 5px;
            background: rgba(255, 255, 255, 0.5);
            border-radius: 50%;
            opacity: 0;
            transition: width 0.3s ease, height 0.3s ease, opacity 0.3s ease;
            z-index: -1;
        }
        .restart-btn:hover .hover-effect {
            width: 200px;
            height: 200px;
            opacity: 1;
        }
        .confetti {
            position: fixed;
            width: 10px;
            height: 10px;
            opacity: 0;
            animation: confettiFall linear infinite;
            pointer-events: none;
            z-index: 1;
        }
        @keyframes confettiFall {
            0% {
                transform: translate3d(var(--start-x), -100px, 0) rotate(0deg);
                opacity: 1;
            }
            100% {
                transform: translate3d(var(--end-x), calc(100vh + 100px), 0) rotate(360deg);
                opacity: 0;
            }
        }
        .scores-container {
            margin: 1rem 0;
            padding: clamp(1rem, 3vw, 1.5rem);
            background: rgba(102, 126, 234, 0.1);
            border-radius: 10px;
            animation: fadeInUp 0.5s ease-out;
            position: relative;
            z-index: 2;
            max-height: 30vh;
            overflow-y: auto;
        }
        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        /* Mobile specific adjustments */
        @media (max-height: 600px) {
            .final-screen-content .card {
                max-height: 90vh;
                padding: clamp(1rem, 3vw, 2rem);
            }
            .final-screen-content .title {
                font-size: clamp(1.2rem, 5vw, 2rem);
                margin-bottom: 0.5rem;
            }
            .user-greeting {
                margin: 1rem 0;
                font-size: clamp(1rem, 3.5vw, 1.3rem);
            }
            .scores-container {
                max-height: 25vh;
                margin: 0.5rem 0;
            }
        }
    `;
    document.head.appendChild(style);

    // Create HTML content
    finalContainer.innerHTML = `
        <div class="final-screen-content">
            <div class="card">
                <h2 class="title">${title}</h2>
                <p class="message">${message}</p>
                ${userName ? `<div class="user-greeting">Congratulations, ${userName}!</div>` : ''}
                <button class="restart-btn" onclick="location.reload()">
                    Start New Quiz
                    <span class="hover-effect"></span>
                </button>
            </div>
        </div>
    `;
    
    // Generate INSANE full-screen confetti
    const colors = ['#f00', '#0f0', '#00f', '#ff0', '#f0f', '#0ff', '#ff6b6b', '#4ecdc4', '#ffe66d', '#ff9ff3'];
    const shapes = ['50%', '0', '25%', '75%', '100%'];
    const confettiCount = 1000
    
    for (let i = 0; i < confettiCount; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        
        // Random properties for full-screen coverage
        const size = Math.random() * 12 + 3;
        const color = colors[Math.floor(Math.random() * colors.length)];
        const startX = Math.random() * window.innerWidth;
        const endX = (Math.random() * 200) - 100; // -100 to 100px horizontal movement
        const animationDuration = Math.random() * 4 + 3;
        const animationDelay = Math.random() * 8;
        const shape = shapes[Math.floor(Math.random() * shapes.length)];
        
        confetti.style.cssText = `
            --start-x: ${startX}px;
            --end-x: ${startX + endX}px;
            width: ${size}px;
            height: ${size}px;
            background: ${color};
            animation-duration: ${animationDuration}s;
            animation-delay: ${animationDelay}s;
            border-radius: ${shape};
            left: 0;
            top: 0;
        `;
        
        document.body.appendChild(confetti);
    }
    
    finalContainer.style.display = 'flex';
    
    // Clean up confetti when screen is closed
    finalContainer.addEventListener('click', function() {
        const allConfetti = document.querySelectorAll('.confetti');
        allConfetti.forEach(c => c.remove());
    });
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
    
    this.ensureScreenFit();
}


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
    this.ensureScreenFit();
}

}

window.QuizQuestionHandler = QuizQuestionHandler;