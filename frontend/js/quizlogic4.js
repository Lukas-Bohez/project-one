// Fixed QuizQuestionHandler with proper user handling
class QuizQuestionHandler {
    constructor(quizLogic, socket) {
        this.quizLogic = quizLogic;
        this.socket = socket;
        this.currentQuestion = null;
        this.currentUser = null;
        this.players = [];
        this.timeRemaining = 0;
        
        // Listen for answer responses from server
        if (this.socket) {
            this.socket.on('answer_response', (responseData) => {
                console.log("=== ANSWER RESPONSE FROM SERVER ===");
                console.log("Response data:", JSON.stringify(responseData, null, 2));
                
                if (responseData.success) {
                    console.log("✅ Answer submitted successfully!");
                    console.log("Is correct:", responseData.is_correct);
                    console.log("Points earned:", responseData.points_earned);
                } else {
                    console.error("❌ Answer submission failed:", responseData.error);
                    if (this.handleErrorDisplay) {
                        this.handleErrorDisplay(responseData.error);
                    }
                }
            });

            // Listen for theme selection data
            this.socket.on('theme_selection', (data) => {
                console.log("✅ Received 'theme_selection':", data);
                this.loadQuestion(data);
            });

            // Listen for question data
            this.socket.on('questionData', (data) => {
                console.log("✅ Received 'questionData':", data);
                this.loadQuestion(data);
            });

            // Listen for explanation started
            this.socket.on('explanation_started', (data) => {
                console.log("✅ Explanation Started:", data);
                if (typeof this.showExplanation === 'function') {
                    this.showExplanation(data);
                } else {
                    console.error("Explanation handler broken, data:", data);
                }
            });
            
            console.log("Socket event listeners set up for answer responses");
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

        // Start timeout for question loading - show reload button if no question loads within 2 seconds
        this.startQuestionLoadTimeout();
    }

    startQuestionLoadTimeout() {
        // Clear any existing timeout
        if (this.questionLoadTimeout) {
            clearTimeout(this.questionLoadTimeout);
        }

        // Only set timeout if we haven't already tried reloading
        if (!sessionStorage.getItem('questionReloadAttempted')) {
            // Set 2-second timeout - reload page if no question loads
            this.questionLoadTimeout = setTimeout(() => {
                // Check if we have a current question
                if (!this.currentQuestion || document.getElementById('questionText').textContent === 'Loading question...') {
                    console.log("No question loaded within 2 seconds, marking reload attempted and reloading page");
                    sessionStorage.setItem('questionReloadAttempted', 'true');
                    window.location.reload();
                }
            }, 2000);
        }
    }

    showReloadButton() {
        // This method is no longer used since we auto-reload
        // Keeping it for potential future use
    }

    loadQuestion(questionData) {
        console.log("Loading question:", questionData);
        this.currentQuestion = questionData;

        // Clear the question load timeout since we got a question
        if (this.questionLoadTimeout) {
            clearTimeout(this.questionLoadTimeout);
            this.questionLoadTimeout = null;
        }

        // Clear reload attempted flag since we successfully loaded a question
        sessionStorage.removeItem('questionReloadAttempted');

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
    
    // Clear any error messages
    const errorContainer = document.getElementById('errorDisplay');
    if (errorContainer) {
        errorContainer.style.display = 'none';
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
        const errorContainer = document.getElementById('errorDisplay');
        
        // Clear any error messages when displaying new content
        if (errorContainer) {
            errorContainer.style.display = 'none';
        }
        
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

// Add these missing helper methods first
getRandomItem(array) {
    return array[Math.floor(Math.random() * array.length)];
}

getRandomItems(array, count) {
    const shuffled = [...array].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, Math.min(count, array.length));
}

shuffleArray(array) {
    return [...array].sort(() => 0.5 - Math.random());
}

getOptionText(option, questionType) {
    return questionType === 'theme_selection' 
        ? (option.name || option.title || 'Unnamed Theme')
        : (option.answer_text || option.text || option);
}

// Then your existing setupAnswerOptions function
setupAnswerOptions(questionData) {
    // 1. Style Injection (only once)
    this.injectAnswerBoxStyles();
    
    // 2. Get Options
    const options = questionData.type === 'theme_selection' 
        ? questionData.themes 
        : questionData.answers;
    
    if (!options?.length) {
        this.handleErrorDisplay('No options available');
        return;
    }

    // 3. Prepare Container - DON'T replace the class, ADD to it
    const container = document.querySelector('.c-answers-container');
    if (!container) return;
    
    container.innerHTML = '';
    container.classList.add('answer-grid-container'); // Add instead of replace

    // 4. Process Answers
    const filteredOptions = this.selectOptimalAnswers(options, questionData.type);
    this.renderAnswerBoxes(filteredOptions, container, questionData.type);
}

// ========================
// CORE LOGIC
// ========================

selectOptimalAnswers(options, questionType) {
    if (questionType === 'theme_selection') {
        return this.getRandomItems(options, 4);
    }

    const correct = options.filter(o => o.is_correct == 1);
    const incorrect = options.filter(o => o.is_correct != 1);
    
    let selected = [];
    
    // Priority 1: 1 correct + 3 incorrect
    if (correct.length > 0 && incorrect.length >= 3) {
        selected.push(this.getRandomItem(correct));
        selected.push(...this.getRandomItems(incorrect, 3));
    } 
    // Priority 2: 1 correct + fill remaining
    else if (correct.length > 0) {
        selected.push(this.getRandomItem(correct));
        const remaining = options.filter(o => !selected.includes(o));
        selected.push(...this.getRandomItems(remaining, 3));
    }
    // Fallback: Random selection
    else {
        selected = this.getRandomItems(options, 4);
    }

    return this.shuffleArray(selected).slice(0, 4);
}

// ========================
// RENDERING
// ========================

renderAnswerBoxes(options, container, questionType) {
    const buttonConfigs = [
        { color: '#FF5A5A', key: 'right', label: 'A' },
        { color: '#FFD166', key: 'bottom', label: 'B' },
        { color: '#06D6A0', key: 'left', label: 'Y' },
        { color: '#118AB2', key: 'top', label: 'X' }
    ];
    options.forEach((option, i) => {
        const config = buttonConfigs[i];
        const box = document.createElement('div');
        box.className = 'answer-box';
       
        box.innerHTML = `
            <div class="snes-button" style="background: ${config.color}">
                <span class="button-label">${config.label}</span>
                <div class="answer-content">${this.getOptionText(option, questionType)}</div>
            </div>
            <div class="box-decoration ${config.key}"></div>
        `;
       
        // Store answer metadata
        if (questionType !== 'theme_selection') {
            box.dataset.isCorrect = option.is_correct || 0;
            box.dataset.answerId = option.id;
        }
       
        container.appendChild(box);
    });
}

// ========================
// STYLES & UTILITIES
// ========================
injectAnswerBoxStyles() {
    if (document.getElementById('answer-box-styles')) return;
   
    const style = document.createElement('style');
    style.id = 'answer-box-styles';
    style.textContent = `
        .answer-grid-container {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
       
        .answer-box {
            position: relative;
            perspective: 1000px;
            height: 80px; /* Reduced from 120px */
        }
       
        .snes-button {
            height: 100%;
            border-radius: 12px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            color: white;
            font-weight: bold;
            position: relative;
            overflow: hidden;
            box-shadow: 0 6px 12px rgba(0,0,0,0.15);
            transition: all 0.3s ease;
            cursor: pointer;
            border: none;
            padding: 8px; /* Added padding to prevent content touching edges */
        }
       
        .snes-button:hover {
            transform: translateY(-3px); /* Reduced from -5px */
            box-shadow: 0 8px 16px rgba(0,0,0,0.2); /* Reduced shadow */
        }
       
        .button-label {
            position: absolute;
            font-size: 12px; /* Reduced from 14px */
            font-weight: bold;
            opacity: 0.9;
            z-index: 2;
            background: rgba(0,0,0,0.2); /* Added subtle background */
            padding: 2px 6px;
            border-radius: 4px;
            min-width: 16px;
            text-align: center;
        }
       
        .answer-content {
            padding: 4px 8px; /* Reduced padding */
            text-align: center;
            font-size: 14px; /* Reduced from 16px */
            text-shadow: 1px 1px 2px rgba(0,0,0,0.3);
            line-height: 1.2;
            z-index: 1;
            position: relative;
        }
       
        /* Position labels in corners, away from content */
        .answer-box:nth-child(1) .button-label { top: 4px; right: 4px; }
        .answer-box:nth-child(2) .button-label { bottom: 4px; right: 4px; }
        .answer-box:nth-child(3) .button-label { bottom: 4px; left: 4px; }
        .answer-box:nth-child(4) .button-label { top: 4px; left: 4px; }
       
        /* Decorative corners - smaller and more subtle */
        .box-decoration {
            position: absolute;
            width: 20px; /* Reduced from 30px */
            height: 20px;
            background: white;
            opacity: 0.1; /* Reduced from 0.2 */
            border-radius: 3px;
        }
        
        .answer-box:nth-child(1) .box-decoration { top: 0; left: 0; }
        .answer-box:nth-child(2) .box-decoration { top: 0; right: 0; }
        .answer-box:nth-child(3) .box-decoration { bottom: 0; left: 0; }
        .answer-box:nth-child(4) .box-decoration { bottom: 0; right: 0; }
    `;
    document.head.appendChild(style);
}



bindAnswerEvents() {
    const answerBoxes = document.querySelectorAll('.answer-box');
    if (answerBoxes.length === 0) {
        console.warn("No answer boxes found");
        return;
    }

    answerBoxes.forEach((box) => {
        // Remove ALL existing listeners to prevent conflicts
        const oldListeners = box.getEventListeners ? box.getEventListeners('click') : [];
        if (box.__quizAnswerListener) {
            box.removeEventListener('click', box.__quizAnswerListener);
            box.__quizAnswerListener = null;
        }

        // Mark this handler as the active one
        if (!window.activeQuizHandler) {
            window.activeQuizHandler = this;
        }

        // Only bind if this is the active handler
        if (window.activeQuizHandler === this) {
            const newClickListener = (event) => {
                // Prevent other handlers from processing this click
                event.stopImmediatePropagation();
                console.log("Answer clicked by active handler:", this);
                this.handleAnswerClick(box);
            };
            box.addEventListener('click', newClickListener, { capture: true });
            box.__quizAnswerListener = newClickListener;
        }
    });

    console.log("Bound events to", answerBoxes.length, "answer boxes (active handler:", window.activeQuizHandler === this, ")");
}

handleAnswerClick(boxElement) {
    console.log("=== ANSWER CLICK DEBUG ===");
    console.log("Handler instance:", this);
    console.log("Active handler:", window.activeQuizHandler);
    console.log("Is active:", window.activeQuizHandler === this);
    console.log("Box element:", boxElement);
    console.log("Current question:", this.currentQuestion);
    console.log("Current user:", this.currentUser);
    console.log("Socket connected:", this.socket && this.socket.connected);

    // Check if question is still loading - if so, reload the page
    const questionText = document.getElementById('questionText');
    if (!this.currentQuestion || (questionText && questionText.textContent === 'Loading question...')) {
        console.log("Question still loading, reloading page");
        window.location.reload();
        return;
    }

    if (!this.currentQuestion || !this.currentQuestion.type) {
        console.error("Invalid question state - no current question");
        return;
    }

    if (!this.socket || !this.socket.connected) {
        console.error("Socket not connected");
        return;
    }

    // Disable all answer boxes temporarily
    const answerBoxes = document.querySelectorAll('.answer-box');
    answerBoxes.forEach(box => {
        box.style.pointerEvents = 'none';
        box.querySelector('.snes-button').style.opacity = '0.7';
    });

    const questionType = this.currentQuestion.type;
    const options = questionType === 'theme_selection' 
        ? this.currentQuestion.themes 
        : this.currentQuestion.answers;

    if (!options || !Array.isArray(options)) {
        console.error("Invalid options array:", options);
        this.handleErrorDisplay("No valid choices available");
        this.enableAnswerBoxes();
        return;
    }

    // Get the answer text from the clicked element
    const answerContentElement = boxElement.querySelector('.answer-content');
    if (!answerContentElement) {
        console.error("No answer content found in clicked element");
        this.handleErrorDisplay("Invalid selection - no content");
        this.enableAnswerBoxes();
        return;
    }
    
    const selectedText = answerContentElement.textContent.trim();
    
    if (!selectedText) {
        console.error("No text content found in answer element");
        this.handleErrorDisplay("Invalid selection - empty content");
        this.enableAnswerBoxes();
        return;
    }

    // Find the correct option by matching the text content
    const selectedOption = options.find(option => {
        const optionText = option.name || option.answer_text || option.text || option.title || String(option);
        return optionText.trim() === selectedText;
    });

    if (!selectedOption) {
        console.error("Could not find option with text:", selectedText, "in options:", options);
        this.handleErrorDisplay("Selection not found");
        this.enableAnswerBoxes();
        return;
    }

    // Find the index for backwards compatibility (if needed elsewhere)
    const answerIndex = options.findIndex(option => {
        const optionText = option.name || option.answer_text || option.text || option.title || String(option);
        return optionText.trim() === selectedText;
    });

    const userId = this.getCurrentUserId();

    console.log("=== USER ID DEBUG ===");
    console.log("Current user object:", this.currentUser);
    console.log("Extracted user ID:", userId);

    if (!userId) {
        console.error("No current user ID available");
        console.error("Current user object:", this.currentUser);
        this.handleErrorDisplay("Please log in again");
        this.enableAnswerBoxes();
        return;
    }

    // Visual feedback
    boxElement.querySelector('.snes-button').style.transform = 'scale(0.95)';
    boxElement.classList.add('selected');

    // Debug logging
    console.log("=== SELECTION DEBUG ===");
    console.log("Selected text:", selectedText);
    console.log("Found option:", selectedOption);
    console.log("Answer index:", answerIndex);

    if (questionType === 'theme_selection') {
        const themeId = Number(selectedOption.id);
        if (isNaN(themeId)) {
            console.error("Invalid theme ID:", selectedOption.id);
            this.handleErrorDisplay("Theme ID format error");
            this.enableAnswerBoxes();
            return;
        }

        const emissionData = {
            userId: userId,
            themeId: themeId,
            themeName: String(selectedOption.name || selectedOption.title || ""),
            request_user_data: true
        };

        console.log("Emitting theme_selected:", emissionData);
        this.socket.emit('theme_selected', emissionData);
    } else {
        const emissionData = {
            userId: userId,
            questionId: this.currentQuestion.id,
            answerIndex: answerIndex, // Keep this if your backend expects it
            answerText: selectedOption.answer_text || selectedOption.text || selectedOption.name || selectedOption,
            isCorrect: boxElement.dataset.isCorrect === "1",
            answerId: selectedOption.id, // Use the actual option ID
            request_user_data: true
        };

        console.log("=== EMITTING ANSWER ===");
        console.log("Full emission data:", JSON.stringify(emissionData, null, 2));
        console.log("Required backend fields:");
        console.log("- userId:", emissionData.userId, "(type:", typeof emissionData.userId, ")");
        console.log("- questionId:", emissionData.questionId, "(type:", typeof emissionData.questionId, ")");
        console.log("- answerIndex:", emissionData.answerIndex, "(type:", typeof emissionData.answerIndex, ")");
        console.log("Socket state:", this.socket.connected ? 'connected' : 'disconnected');
        console.log("Socket ID:", this.socket.id);
        
        try {
            this.socket.emit('submit_answer', emissionData);
            console.log("✅ Answer successfully emitted to server");
            console.log("Waiting for answer_response event from server...");
        } catch (error) {
            console.error("❌ Failed to emit answer:", error);
            this.handleErrorDisplay("Failed to submit answer");
        }
    }

    // Reset visual state after delay
    setTimeout(() => {
        boxElement.querySelector('.snes-button').style.transform = '';
        boxElement.classList.remove('selected');
        this.enableAnswerBoxes();
    }, 1000);
}

// Helper method to enable answer boxes
enableAnswerBoxes() {
    const answerBoxes = document.querySelectorAll('.answer-box');
    answerBoxes.forEach(box => {
        box.style.pointerEvents = '';
        box.querySelector('.snes-button').style.opacity = '';
    });
}

// Helper method to get current user ID
getCurrentUserId() {
    if (!this.currentUser) return null;
    return Number(this.currentUser.user_id || this.currentUser.id);
}

showExplanation(data) {
    console.log("Showing explanation for question", data.question_id || 'unknown', data);
    
    // Highlight correct answers before showing explanation
    this.highlightCorrectAnswer(data);
    
    // Pass the entire data object to displayExplanation
    this.displayExplanation(data);
}

highlightCorrectAnswer() {
    // Get all answer boxes
    const answerBoxes = document.querySelectorAll('.answer-box');
    
    // If we don't have current question data, do nothing
    if (!this.currentQuestion) return;
    
    // For theme selection questions, don't hide any answers (all are valid choices)
    if (this.currentQuestion.type === 'theme_selection') {
        return; // Exit early - no highlighting needed for theme selection
    }
    
    // For regular questions, process correctness
    if (this.currentQuestion.answers) {
        // Create a map of answer texts to their correctness
        const answerCorrectness = {};
        this.currentQuestion.answers.forEach(answer => {
            answerCorrectness[answer.answer_text] = answer.is_correct;
        });
        
        // Process each answer box
        answerBoxes.forEach(box => {
            // Find the answer content element
            const answerContent = box.querySelector('.answer-content');
            if (!answerContent) return;
            
            const answerText = answerContent.textContent.trim();
            
            // Check if this answer is correct
            if (answerCorrectness[answerText] === 1) {
                // Highlight correct answer
                const snesButton = box.querySelector('.snes-button');
                if (snesButton) {
                    snesButton.style.backgroundColor = '#2e7d32'; // Accessible green for correct
                    const label = snesButton.querySelector('.button-label');
                    if (label) label.style.color = 'white';
                }
            } else {
                // Hide incorrect answers
                box.style.display = 'none';
            }
        });
    }
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

displayFinalScreen(title, message) {
    const finalContainer = document.getElementById('finalScreenContainer') || this.createFinalScreenContainer();
    
    // Get user details
    const firstName = localStorage.getItem('user_first_name') || '';
    const lastName = localStorage.getItem('user_last_name') || '';
    const userName = `${firstName} ${lastName}`.trim();
    
    // Inject CSS directly
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
            padding: 3rem;
            border-radius: 20px;
            box-shadow: 0 15px 30px rgba(0, 0, 0, 0.2);
            text-align: center;
            max-width: 600px;
            width: 90%;
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
            font-size: 2.5rem;
            margin-bottom: 1rem;
            color: #4a4a4a;
            background: linear-gradient(to right, #667eea, #764ba2);
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
            font-weight: 700;
        }
        .final-screen-content .message {
            font-size: 1.2rem;
            color: #666;
            margin-bottom: 1rem;
            line-height: 1.6;
        }
        .user-greeting {
            font-size: 1.5rem;
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
            padding: 1rem 2rem;
            font-size: 1.1rem;
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
            padding: 1.5rem;
            background: rgba(102, 126, 234, 0.1);
            border-radius: 10px;
            animation: fadeInUp 0.5s ease-out;
            position: relative;
            z-index: 2;
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
    const confettiCount = 1000; // Increase this number for even more madness
    
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

    // Method to handle error display
    handleErrorDisplay(message) {
        console.error("Question error:", message);

        const errorContainer = document.getElementById('errorDisplay');
        
        if (errorContainer) {
            errorContainer.textContent = message;
            errorContainer.style.display = 'block';
            
            // Auto-hide error after 5 seconds unless it's a critical error
            if (!message.includes('login') && !message.includes('connection')) {
                setTimeout(() => {
                    errorContainer.style.display = 'none';
                }, 5000);
            }
        }
        
        // Don't hide answer buttons for explanation phase errors - just show the error
        if (message.includes('explanation phase')) {
            return;
        }
        
        // Only disable buttons for critical errors
        const answerButtons = document.querySelectorAll('.c-answer-btn');
        answerButtons.forEach(button => {
            button.disabled = true;
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