const lanIP = `https://${window.location.hostname}`;

document.addEventListener('DOMContentLoaded', function() {
    // #region --- State Management ---
    let allQuestions = [];
    let practiceQuestions = [];
    let currentQuestionIndex = 0;
    
    // In-memory cache as fallback
    const memoryCache = new Map();
    // #endregion

    // #region --- DOM Element References ---
    const dom = {
        // Question Display
        questionDisplay: document.querySelector('.question-display'),
        themeTag: document.querySelector('.theme-tag'),
        difficultyTag: document.querySelector('.difficulty-tag'),
        questionText: document.querySelector('.question-text'),
        answersContainer: document.querySelector('.answers-container'),
        explanation: document.querySelector('.explanation'),
        // Navigation Buttons
        prevQuestionBtn: document.getElementById('prevQuestionBtn'),
        checkAnswerBtn: document.getElementById('checkAnswerBtn'),
        nextQuestionBtn: document.getElementById('nextQuestionBtn'),
        // Individual Question Selector
        toggleSelector: document.getElementById('toggleSelector'),
        questionSelector: document.getElementById('questionSelector'),
        questionsList: document.getElementById('questionsList'),
        selectAllBtn: document.getElementById('selectAllBtn'),
        deselectAllBtn: document.getElementById('deselectAllBtn'),
        practiceSelectedBtn: document.getElementById('practiceSelectedBtn'),
        selectedCount: document.getElementById('selectedCount'),
        // Sidebar Filters
        themeFilterContainer: document.getElementById('theme-filter-container'),
        difficultyFilterContainer: document.querySelectorAll('.filter-panel .checkbox-list')[1],
        startPracticeBtn: document.getElementById('startPracticeBtn'),
        selectAllFiltersBtn: document.getElementById('selectAllThemesBtn'),
    };
    // #endregion

    // #region --- Utility Functions ---
    const shuffleArray = (array) => {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    };
    // #endregion

    // #region --- Improved Caching Utilities ---
    const cache = {
        get: function(key) {
            try {
                // Try localStorage first
                if (typeof Storage !== "undefined" && localStorage) {
                    const item = localStorage.getItem(key);
                    if (item) {
                        return JSON.parse(item);
                    }
                }
            } catch (e) {
                console.warn(`[Cache] localStorage failed, using memory cache: ${e.message}`);
            }
            
            // Fallback to memory cache
            return memoryCache.get(key) || null;
        },
        
        set: function(key, data) {
            const cacheData = {
                timestamp: new Date().getTime(),
                data: data
            };
            
            try {
                // Try localStorage first
                if (typeof Storage !== "undefined" && localStorage) {
                    localStorage.setItem(key, JSON.stringify(cacheData));
                    console.log(`[Cache] Data saved to localStorage for key: ${key}`);
                    return;
                }
            } catch (e) {
                console.warn(`[Cache] localStorage failed, using memory cache: ${e.message}`);
            }
            
            // Fallback to memory cache
            memoryCache.set(key, cacheData);
            console.log(`[Cache] Data saved to memory cache for key: ${key}`);
        },
        
        isValid: function(cachedItem, duration = 60000) {
            if (!cachedItem || !cachedItem.timestamp) return false;
            return (new Date().getTime() - cachedItem.timestamp) < duration;
        }
    };
    // #endregion

    // #region --- Data Fetching (from your backend) ---
    const fetchQuestions = async (activeOnly = false) => {
        const questionsEndpoint = `${lanIP}/api/v1/questions/`;
        const answersBaseEndpoint = `${lanIP}/api/v1/questions/`;
        const themesBaseEndpoint = `${lanIP}/api/v1/themes/`;
        const CACHE_KEY = `myApp_questionsCache_${activeOnly ? 'active' : 'all'}`;
        const CACHE_DURATION = 60 * 1000; // 1 minute

        try {
            // Check cache first
            const cachedData = cache.get(CACHE_KEY);
            if (cachedData && cache.isValid(cachedData, CACHE_DURATION)) {
                console.log(`[Cache Hit] Returning data from cache for key: ${CACHE_KEY}`);
                return cachedData.data;
            }

            console.log(`[Cache Miss/Expired] Fetching new data for key: ${CACHE_KEY}`);

            const questionsUrl = activeOnly ? `${questionsEndpoint}?active_only=true` : questionsEndpoint;
            const questionsResponse = await fetch(questionsUrl);
            if (!questionsResponse.ok) {
                throw new Error(`HTTP error fetching questions! Status: ${questionsResponse.status}`);
            }
            const questions = await questionsResponse.json();

            // Fetch themes
            const uniqueThemeIds = [...new Set(questions.map(q => q.themeId).filter(id => id))];
            const themePromises = uniqueThemeIds.map(async id => {
                try {
                    const response = await fetch(`${themesBaseEndpoint}${id}/`);
                    return response.ok ? await response.json() : { id, name: 'Unknown Theme' };
                } catch (error) {
                    console.warn(`Failed to fetch theme ${id}:`, error);
                    return { id, name: 'Unknown Theme' };
                }
            });
            const themes = await Promise.all(themePromises);
            const themeMap = themes.reduce((map, theme) => {
                map[theme.id] = theme;
                return map;
            }, {});

            // Fetch answers for each question
            const questionsWithDetails = await Promise.all(questions.map(async (question) => {
                try {
                    const answersUrl = `${answersBaseEndpoint}${question.id}/answers`;
                    const answersResponse = await fetch(answersUrl);
                    const answersData = answersResponse.ok ? await answersResponse.json() : { answers: [] };
                    
                    return {
                        ...question,
                        answers: answersData.answers || [],
                        theme: themeMap[question.themeId] || { name: 'Unknown Theme' },
                    };
                } catch (error) {
                    console.warn(`Failed to fetch answers for question ${question.id}:`, error);
                    return {
                        ...question,
                        answers: [],
                        theme: themeMap[question.themeId] || { name: 'Unknown Theme' },
                    };
                }
            }));

            // Cache the result
            cache.set(CACHE_KEY, questionsWithDetails);
            console.log(`[Cache Update] New data saved to cache for key: ${CACHE_KEY}`);
            
            return questionsWithDetails;
        } catch (error) {
            console.error('Failed to fetch questions:', error);
            
            // Try to return cached data even if expired
            const cachedData = cache.get(CACHE_KEY);
            if (cachedData && cachedData.data) {
                console.log('[Cache Fallback] Returning expired cache data due to fetch error');
                return cachedData.data;
            }
            
            return []; // Return empty if fetch fails and no cache exists
        }
    };

    const fetchThemes = async () => {
        try {
            const response = await fetch(`${lanIP}/api/v1/themes/`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const themes = await response.json();
            
            // Calculate question counts from the allQuestions array instead of API
            // This is more reliable than calling the question_count endpoint
            const themesWithCounts = themes.map(theme => {
                const count = allQuestions.filter(q => q.themeId === theme.id).length;
                return { ...theme, questionCount: { count } };
            });
            
            return themesWithCounts;
        } catch (error) {
            console.error("Error fetching themes:", error);
            return [];
        }
    };
    // #endregion

    // #region --- Filter Logic ---
    const updateQuestionSelectorBasedOnFilters = () => {
        if (!dom.questionsList || !allQuestions.length) {
            console.log('Cannot update question selector - missing elements or no questions');
            return;
        }

        try {
            // Get selected theme and difficulty filters
            const selectedThemeIds = dom.themeFilterContainer ? 
                Array.from(dom.themeFilterContainer.querySelectorAll('input:checked')).map(cb => cb.dataset.id) : [];
            const selectedDifficultyIds = dom.difficultyFilterContainer ? 
                Array.from(dom.difficultyFilterContainer.querySelectorAll('input:checked')).map(cb => cb.dataset.difficultyId) : [];
            
            console.log('Selected theme IDs:', selectedThemeIds);
            console.log('Selected difficulty IDs:', selectedDifficultyIds);
            
            // Filter questions
            const filteredQuestions = allQuestions.filter(q => {
                const themeMatch = selectedThemeIds.length === 0 || selectedThemeIds.includes(String(q.themeId));
                const difficultyMatch = selectedDifficultyIds.length === 0 || selectedDifficultyIds.includes(String(q.difficultyLevelId));
                return themeMatch && difficultyMatch;
            });
            
            console.log(`Filtered ${filteredQuestions.length} questions from ${allQuestions.length} total`);
            
            // Update the individual question selector with filtered questions
            populateIndividualQuestionSelector(filteredQuestions);
            
        } catch (error) {
            console.error('Error updating question selector based on filters:', error);
        }
    };

    const setupFilterListeners = () => {
        // Add event listeners to theme filters
        if (dom.themeFilterContainer) {
            dom.themeFilterContainer.addEventListener('change', () => {
                console.log('Theme filter changed');
                updateQuestionSelectorBasedOnFilters();
            });
        }

        // Add event listeners to difficulty filters  
        if (dom.difficultyFilterContainer) {
            dom.difficultyFilterContainer.addEventListener('change', () => {
                console.log('Difficulty filter changed');
                updateQuestionSelectorBasedOnFilters();
            });
        }
    };
    // #endregion

    // #region --- Core Quiz Logic ---
    const startPractice = (questionIDs) => {
        if (!questionIDs || questionIDs.length === 0) {
            alert('No questions selected for practice. Please check your filters or selection.');
            return;
        }

        practiceQuestions = allQuestions.filter(q => questionIDs.includes(String(q.id)));
        practiceQuestions.sort(() => Math.random() - 0.5); // Shuffle questions

        if (practiceQuestions.length > 0) {
            currentQuestionIndex = 0;
            displayQuestion(currentQuestionIndex);
            
            // Show question display and hide selector
            if (dom.questionDisplay) {
                dom.questionDisplay.style.display = 'block';
            }
            if (dom.questionSelector) {
                dom.questionSelector.classList.remove('show');
            }
            if (dom.toggleSelector && dom.toggleSelector.querySelector('.toggle-icon')) {
                dom.toggleSelector.querySelector('.toggle-icon').textContent = '▼';
            }
        } else {
            alert('No matching questions found for your selection.');
            if (dom.questionDisplay) {
                dom.questionDisplay.style.display = 'none';
            }
        }
    };

    const displayQuestion = (index) => {
        if (index < 0 || index >= practiceQuestions.length) return;
        const question = practiceQuestions[index];

        // Create question display HTML if it doesn't exist
        if (dom.questionDisplay && !dom.questionDisplay.querySelector('.question-text')) {
            dom.questionDisplay.innerHTML = `
                <div class="question-header">
                    <span class="theme-tag"></span>
                    <span class="difficulty-tag"></span>
                </div>
                <div class="question-text"></div>
                <div class="answers-container"></div>
                <div class="explanation"></div>
                <div class="question-controls">
                    <button id="prevQuestionBtn" class="btn btn-secondary">Previous</button>
                    <button id="checkAnswerBtn" class="btn btn-primary">Check Answer</button>
                    <button id="nextQuestionBtn" class="btn btn-primary">Next</button>
                </div>
            `;
            
            // Update DOM references after creating elements
            dom.themeTag = dom.questionDisplay.querySelector('.theme-tag');
            dom.difficultyTag = dom.questionDisplay.querySelector('.difficulty-tag');
            dom.questionText = dom.questionDisplay.querySelector('.question-text');
            dom.answersContainer = dom.questionDisplay.querySelector('.answers-container');
            dom.explanation = dom.questionDisplay.querySelector('.explanation');
            dom.prevQuestionBtn = document.getElementById('prevQuestionBtn');
            dom.checkAnswerBtn = document.getElementById('checkAnswerBtn');
            dom.nextQuestionBtn = document.getElementById('nextQuestionBtn');
            
            // Re-setup event listeners for new buttons
            setupQuestionEventListeners();
        }

        if (dom.themeTag) dom.themeTag.textContent = question.theme.name || 'General';
        if (dom.difficultyTag) {
            // Map difficulty levels based on your API data structure
            const difficultyMap = {
                1: 'Easy',
                2: 'Normal', 
                3: 'Hard'
            };
            dom.difficultyTag.textContent = difficultyMap[question.difficultyLevelId] || question.difficulty || 'Normal';
        }
        if (dom.questionText) dom.questionText.textContent = question.question_text || question.questionText;

        if (dom.answersContainer) {
            dom.answersContainer.innerHTML = ''; // Clear previous answers
            
            // Randomize the order of answers for this question
            const shuffledAnswers = shuffleArray(question.answers);
            console.log('Answer order randomized for question:', question.id);
            
            shuffledAnswers.forEach(answer => {
                const button = document.createElement('button');
                button.className = 'answer-btn';
                button.textContent = answer.answer_text || answer.answerText;
                button.dataset.answerId = answer.id;
                dom.answersContainer.appendChild(button);
            });
        }

        if (dom.explanation) {
            dom.explanation.classList.remove('show');
            dom.explanation.innerHTML = '';
        }
        if (dom.checkAnswerBtn) dom.checkAnswerBtn.disabled = false;
        if (dom.nextQuestionBtn) dom.nextQuestionBtn.disabled = true;
        if (dom.prevQuestionBtn) dom.prevQuestionBtn.disabled = index === 0;
        if (dom.nextQuestionBtn) {
            dom.nextQuestionBtn.textContent = (index === practiceQuestions.length - 1) ? 'Finish Practice' : 'Next';
        }
    };

    const handleCheckAnswer = () => {
        if (!dom.answersContainer || !dom.answersContainer.querySelector('.answer-btn.selected')) {
            alert('Please select at least one answer.');
            return;
        }

        const currentQuestion = practiceQuestions[currentQuestionIndex];
        const answerButtons = dom.answersContainer.querySelectorAll('.answer-btn');

        answerButtons.forEach(btn => {
            btn.disabled = true;
            const answerId = parseInt(btn.dataset.answerId);
            const answerData = currentQuestion.answers.find(a => a.id === answerId);
            if (answerData && (answerData.is_correct || answerData.isCorrect)) {
                btn.classList.add('correct');
            }
            if (btn.classList.contains('selected') && answerData && !(answerData.is_correct || answerData.isCorrect)) {
                btn.classList.add('incorrect');
            }
        });

        if (dom.explanation) {
            dom.explanation.innerHTML = `<strong>Explanation:</strong> ${currentQuestion.explanation || 'No explanation available.'}`;
            dom.explanation.classList.add('show');
        }
        if (dom.checkAnswerBtn) dom.checkAnswerBtn.disabled = true;
        if (dom.nextQuestionBtn) dom.nextQuestionBtn.disabled = false;
    };

    const handleNextPrev = (direction) => {
        const newIndex = currentQuestionIndex + direction;
        if (direction === 1 && newIndex >= practiceQuestions.length) {
            alert('You have completed the practice session!');
            if (dom.questionDisplay) {
                dom.questionDisplay.innerHTML = '<h2>Practice Complete! ✅</h2><p>Select new questions or filters to start another session.</p>';
            }
        } else if (newIndex >= 0) {
            currentQuestionIndex = newIndex;
            displayQuestion(currentQuestionIndex);
        }
    };
    // #endregion

    // #region --- UI Population and Initialization ---
    const populateFilters = (themes) => {
        if (dom.themeFilterContainer) {
            dom.themeFilterContainer.innerHTML = '';
            themes.forEach(theme => {
                const count = theme.questionCount ? theme.questionCount.count || 0 : 0;
                if (count > 0) {
                    dom.themeFilterContainer.innerHTML += `
                        <div class="checkbox-item">
                            <input type="checkbox" id="theme-${theme.id}" data-id="${theme.id}" checked>
                            <label for="theme-${theme.id}">${theme.name} (${count})</label>
                        </div>`;
                }
            });
        }

        if (dom.difficultyFilterContainer) {
            dom.difficultyFilterContainer.innerHTML = '';
            // Map difficulty levels based on your API data structure
            const difficultyMap = { 1: 'Easy', 2: 'Normal', 3: 'Hard' };
            Object.entries(difficultyMap).forEach(([levelId, diffName]) => {
                const count = allQuestions.filter(q => q.difficultyLevelId == levelId).length;
                if (count > 0) {
                    dom.difficultyFilterContainer.innerHTML += `
                        <div class="checkbox-item">
                            <input type="checkbox" id="difficulty-${diffName.toLowerCase()}" data-difficulty-id="${levelId}" checked>
                            <label for="difficulty-${diffName.toLowerCase()}">${diffName} (${count})</label>
                        </div>`;
                }
            });
        }
    };
    
    const populateIndividualQuestionSelector = (questions) => {
        if (dom.questionsList) {
            dom.questionsList.innerHTML = '';
            questions.forEach(q => {
                const questionText = q.question_text || q.questionText || 'Question text not available';
                const themeName = q.theme?.name || 'General';
                const difficultyMap = { 1: 'Easy', 2: 'Normal', 3: 'Hard' };
                const difficulty = difficultyMap[q.difficultyLevelId] || q.difficulty || 'Normal';
                
                dom.questionsList.innerHTML += `
                    <div class="question-item">
                        <input type="checkbox" id="q${q.id}" data-id="${q.id}">
                        <label for="q${q.id}" class="question-text-preview">${questionText}</label>
                        <span class="question-meta">${themeName} • ${difficulty}</span>
                    </div>`;
            });
            initializeQuestionSelectorLogic();
        }
    };

    function initializeQuestionSelectorLogic() {
        if (!dom.questionsList) return;
        
        const checkboxes = dom.questionsList.querySelectorAll('input[type="checkbox"]');
        const updateCount = () => {
            const selected = dom.questionsList.querySelectorAll('input:checked').length;
            if (dom.selectedCount) dom.selectedCount.textContent = selected;
            if (dom.practiceSelectedBtn) dom.practiceSelectedBtn.disabled = selected === 0;
        };

        if (dom.selectAllBtn) {
            // Remove existing listeners to prevent duplicates
            const newSelectAllBtn = dom.selectAllBtn.cloneNode(true);
            dom.selectAllBtn.parentNode.replaceChild(newSelectAllBtn, dom.selectAllBtn);
            dom.selectAllBtn = newSelectAllBtn;
            
            dom.selectAllBtn.addEventListener('click', () => {
                checkboxes.forEach(cb => cb.checked = true);
                updateCount();
            });
        }
        
        if (dom.deselectAllBtn) {
            // Remove existing listeners to prevent duplicates
            const newDeselectAllBtn = dom.deselectAllBtn.cloneNode(true);
            dom.deselectAllBtn.parentNode.replaceChild(newDeselectAllBtn, dom.deselectAllBtn);
            dom.deselectAllBtn = newDeselectAllBtn;
            
            dom.deselectAllBtn.addEventListener('click', () => {
                checkboxes.forEach(cb => cb.checked = false);
                updateCount();
            });
        }
        
        checkboxes.forEach(cb => cb.addEventListener('change', updateCount));
        
        if (dom.practiceSelectedBtn) {
            // Remove existing listeners to prevent duplicates
            const newPracticeSelectedBtn = dom.practiceSelectedBtn.cloneNode(true);
            dom.practiceSelectedBtn.parentNode.replaceChild(newPracticeSelectedBtn, dom.practiceSelectedBtn);
            dom.practiceSelectedBtn = newPracticeSelectedBtn;
            
            dom.practiceSelectedBtn.addEventListener('click', () => {
                const selectedIds = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.dataset.id);
                startPractice(selectedIds);
            });
        }
        
        updateCount();
    }
    // #endregion

    // #region --- Event Handlers & Listeners ---
    const setupQuestionEventListeners = () => {
        if (dom.checkAnswerBtn) {
            dom.checkAnswerBtn.addEventListener('click', handleCheckAnswer);
        }
        if (dom.nextQuestionBtn) {
            dom.nextQuestionBtn.addEventListener('click', () => handleNextPrev(1));
        }
        if (dom.prevQuestionBtn) {
            dom.prevQuestionBtn.addEventListener('click', () => handleNextPrev(-1));
        }
        if (dom.answersContainer) {
            dom.answersContainer.addEventListener('click', e => {
                if (e.target.classList.contains('answer-btn')) {
                    // Clear other selections for single-choice questions
                    dom.answersContainer.querySelectorAll('.answer-btn').forEach(btn => {
                        btn.classList.remove('selected');
                    });
                    e.target.classList.add('selected');
                }
            });
        }
    };

    const setupEventListeners = () => {
        setupQuestionEventListeners();
        
        if (dom.toggleSelector) {
            dom.toggleSelector.addEventListener('click', () => {
                if (dom.questionSelector) {
                    dom.questionSelector.classList.toggle('show');
                    const toggleIcon = dom.toggleSelector.querySelector('.toggle-icon');
                    if (toggleIcon) {
                        toggleIcon.textContent = dom.questionSelector.classList.contains('show') ? '▲' : '▼';
                    }
                }
            });
        }

        if (dom.startPracticeBtn) {
            dom.startPracticeBtn.addEventListener('click', () => {
                const selectedThemeIds = dom.themeFilterContainer ? 
                    Array.from(dom.themeFilterContainer.querySelectorAll('input:checked')).map(cb => cb.dataset.id) : [];
                const selectedDifficultyIds = dom.difficultyFilterContainer ? 
                    Array.from(dom.difficultyFilterContainer.querySelectorAll('input:checked')).map(cb => cb.dataset.difficultyId) : [];
                
                const filteredIds = allQuestions
                    .filter(q => {
                        const themeMatch = selectedThemeIds.length === 0 || selectedThemeIds.includes(String(q.themeId));
                        const difficultyMatch = selectedDifficultyIds.length === 0 || selectedDifficultyIds.includes(String(q.difficultyLevelId));
                        return themeMatch && difficultyMatch;
                    })
                    .map(q => String(q.id));
                    
                console.log('Filtered question IDs:', filteredIds);
                startPractice(filteredIds);
            });
        }

        if (dom.selectAllFiltersBtn) {
            dom.selectAllFiltersBtn.addEventListener('click', () => {
                document.querySelectorAll('.filter-panel input[type="checkbox"]').forEach(cb => cb.checked = true);
                updateQuestionSelectorBasedOnFilters();
            });
        }

        // Add deselect all filters button functionality
        const deselectAllFiltersBtn = document.getElementById('deselectAllThemesBtn');
        if (deselectAllFiltersBtn) {
            deselectAllFiltersBtn.addEventListener('click', () => {
                // Deselect all theme filters
                if (dom.themeFilterContainer) {
                    dom.themeFilterContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
                }
                // Deselect all difficulty filters
                if (dom.difficultyFilterContainer) {
                    dom.difficultyFilterContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
                }
                updateQuestionSelectorBasedOnFilters();
            });
        }
    };
    // #endregion

    // #region --- App Initialization ---
    const main = async () => {
        console.log('Starting main initialization...');
        
        if (dom.questionDisplay) {
            dom.questionDisplay.style.display = 'none';
        }
        
        try {
            console.log('Initializing practice hub...');
            
            // First fetch questions
            const questions = await fetchQuestions(true);
            allQuestions = questions;
            console.log(`Loaded ${allQuestions.length} questions`);
            
            if (allQuestions.length === 0) {
                console.warn('No questions loaded from API');
                if (dom.questionDisplay) {
                    dom.questionDisplay.innerHTML = '<h2>No Questions Available</h2><p>No active questions found. Please check your API connection.</p>';
                    dom.questionDisplay.style.display = 'block';
                }
                return;
            }
            
            // Then fetch themes and calculate counts from the questions we already have
            const themesResponse = await fetch(`${lanIP}/api/v1/themes/`);
            if (!themesResponse.ok) throw new Error(`HTTP error! status: ${themesResponse.status}`);
            const themes = await themesResponse.json();
            
            // Calculate question counts from the allQuestions array
            const themesWithCounts = themes.map(theme => {
                const count = allQuestions.filter(q => q.themeId === theme.id).length;
                return { ...theme, questionCount: { count } };
            });
            
            console.log('Available themes with counts:', themesWithCounts);
            
            if (themesWithCounts.length === 0) {
                console.warn('No themes loaded from API');
            }
            
            // Populate UI
            populateFilters(themesWithCounts);
            populateIndividualQuestionSelector(allQuestions);
            setupEventListeners();
            setupFilterListeners();
            
            console.log('Practice hub initialized successfully');
            console.log('Themes loaded:', themesWithCounts.map(t => `${t.name} (${t.questionCount.count})`));
            
            // Initialize filter-based question selection
            updateQuestionSelectorBasedOnFilters();
            
        } catch (error) {
            console.error("Failed to initialize the practice hub:", error);
            if (dom.questionDisplay) {
                dom.questionDisplay.innerHTML = '<h2>Error 😢</h2><p>Could not load questions. Please try refreshing the page.</p><p>Error details: ' + error.message + '</p>';
                dom.questionDisplay.style.display = 'block';
            }
        }
        
        // Initialize ads if available
        if (typeof adsbygoogle !== 'undefined') {
            try {
                (adsbygoogle = window.adsbygoogle || []).push({});
            } catch (adError) {
                console.log('Ad initialization skipped');
            }
        }
    };

    main();
    // #endregion
});