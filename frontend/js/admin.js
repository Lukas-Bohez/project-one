// #region ***  DOM references                           ***********
const domAdmin = {
    logoutBtn: document.getElementById('logoutBtn'),
    tabBtns: document.querySelectorAll('.js-tab-btn'),
    tabContents: document.querySelectorAll('.js-tab-content'),
    editModal: document.getElementById('editModal'),
    closeModal: document.querySelector('.c-modal__close'),
    cancelBtn: document.querySelector('.c-btn--cancel'),
    searchInput: document.querySelector('.c-search-input'),
    addQuestionBtn: document.querySelector('.js-add-question'),
    addThemeBtn: document.querySelector('.js-add-theme'),
    saveChangesBtn: document.querySelector('.js-save-changes'),
    questionList: document.querySelector('.c-question-list'),
    themeList: document.querySelector('.c-theme-list'),
    userTable: document.querySelector('.c-user-table tbody'),
    themeFilter: document.querySelector('.js-theme-filter'), // Add this
    difficultyFilter: document.querySelector('.js-difficulty-filter'), // Add this
};

let currentForm = null;
// #endregion

// #region ***  Data & State Management                  ***********
let currentEditItem = null;
let currentTab = 'questions';


// #endregion

const fetchQuestions = async (activeOnly = false) => {
    const questionsEndpoint = `${lanIP}/api/v1/questions/`;
    const answersBaseEndpoint = `${lanIP}/api/v1/questions/`;
    const themesBaseEndpoint = `${lanIP}/api/v1/themes/`;

    // A more specific and unique key for your application's cache
    const CACHE_KEY = `myApp_questionsCache_${activeOnly ? 'active' : 'all'}`;
    const CACHE_DURATION = 60 * 1000; // 1 minute in milliseconds

    try {
        // --- ATTEMPT TO RETURN FROM CACHE FIRST ---
        const cachedDataString = localStorage.getItem(CACHE_KEY);

        if (cachedDataString) {
            const { timestamp, data } = JSON.parse(cachedDataString);
            const now = new Date().getTime();

            if (now - timestamp < CACHE_DURATION) {
                console.log(`[Cache Hit] Returning data from local cache for key: ${CACHE_KEY}`);
                return data; // IMMEDIATELY RETURN CACHED DATA
            } else {
                console.log(`[Cache Expired] Cache for key: ${CACHE_KEY} is older than 1 minute. Fetching new data...`);
                // Proceed to fetch new data
            }
        } else {
            console.log(`[Cache Miss] No data found in local cache for key: ${CACHE_KEY}. Fetching new data...`);
            // Proceed to fetch new data
        }

        // --- IF WE REACH THIS POINT, IT MEANS CACHE IS INVALID OR NON-EXISTENT.
        // --- PROCEED WITH API CALLS.

        // Step 1: Fetch all questions
        const questionsUrl = activeOnly ? `${questionsEndpoint}?active_only=true` : questionsEndpoint;
        const questionsResponse = await fetch(questionsUrl);
        if (!questionsResponse.ok) {
            console.error(`HTTP error fetching questions! Status: ${questionsResponse.status}`);
            return [];
        }
        const questions = await questionsResponse.json();

        // Step 2: Get unique theme IDs to minimize API calls
        const uniqueThemeIds = [...new Set(questions.map(q => q.themeId).filter(id => id))];

        // Step 3: Fetch all themes in parallel
        const themePromises = uniqueThemeIds.map(async (themeId) => {
            try {
                const themeResponse = await fetch(`${themesBaseEndpoint}${themeId}/`);
                if (!themeResponse.ok) {
                    console.warn(`HTTP error fetching theme ID ${themeId}! Status: ${themeResponse.status}`);
                    return { id: themeId, name: 'Unknown Theme', error: true };
                }
                const theme = await themeResponse.json();
                return theme;
            } catch (error) {
                console.warn(`Failed to fetch theme ID ${themeId}:`, error);
                return { id: themeId, name: 'Unknown Theme', error: true };
            }
        });

        const themes = await Promise.all(themePromises);

        // Step 4: Create a theme lookup map for quick access
        const themeMap = themes.reduce((map, theme) => {
            map[theme.id] = theme;
            return map;
        }, {});

        const questionsWithAnswersAndThemes = [];

        // Step 5: For each question, fetch its answers and attach theme data
        for (const question of questions) {
            // Fetch answers for this question
            const answersUrl = `${answersBaseEndpoint}${question.id}/answers`;
            const answersResponse = await fetch(answersUrl);
            let answers = [];

            if (!answersResponse.ok) {
                console.warn(`HTTP error fetching answers for question ID ${question.id}! Status: ${answersResponse.status}`);
            } else {
                const answersData = await answersResponse.json();
                answers = answersData.answers || [];
            }

            // Get theme data for this question
            const theme = themeMap[question.themeId] || {
                id: question.themeId,
                name: 'Unknown Theme',
                error: true
            };

            questionsWithAnswersAndThemes.push({
                ...question, // Spread all properties of the original question
                answers: answers, // Add the fetched answers
                theme: theme // Add the theme object - accessible as question.theme
            });
        }

        console.log('[API Fetch] Successfully fetched new data from API.');
        // console.log(questionsWithAnswersAndThemes); // Uncomment if you want to see the full data on every fetch

        // Step 6: Save the newly fetched data to local cache with a timestamp
        const dataToCache = {
            timestamp: new Date().getTime(),
            data: questionsWithAnswersAndThemes
        };
        localStorage.setItem(CACHE_KEY, JSON.stringify(dataToCache));
        console.log(`[Cache Update] New data saved to local cache for key: ${CACHE_KEY}`);

        return questionsWithAnswersAndThemes;

    } catch (error) {
        console.error('Failed to fetch questions, answers, or themes:', error);
        // if fetching fails, you might want to return the stale cache if available
        const cachedDataString = localStorage.getItem(CACHE_KEY);
        if (cachedDataString) {
            const { data } = JSON.parse(cachedDataString);
            console.warn('Returning stale data due to fetch error:', data);
            return data;
        }
    }
};







const fetchThemes = async () => {
    try {
        const response = await fetch(`${lanIP}/api/v1/themes/`);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }
        const themes = await response.json();

        // Fetch question count for each theme
        const themesWithCounts = await Promise.all(
            themes.map(async (theme) => {
                try {
                    const countResponse = await fetch(`${lanIP}/api/v1/themes/${theme.id}/question_count/`);
                    if (!countResponse.ok) {
                        // Log or handle error for individual count fetch, but don't stop the whole process
                        console.warn(`Failed to fetch question count for theme ID ${theme.id}: ${countResponse.status}`);
                        return { ...theme, questionCount: 0 }; // Assign 0 if count fails
                    }
                    const questionCount = await countResponse.json();
                    return { ...theme, questionCount: questionCount };
                } catch (countError) {
                    console.error(`Error fetching question count for theme ID ${theme.id}:`, countError);
                    return { ...theme, questionCount: 0 }; // Assign 0 if there's an error
                }
            })
        );
        console.log(themesWithCounts)
        return themesWithCounts;
    } catch (error) {
        console.error("Error fetching themes:", error);
        throw error;
    }
};

// Make sure 'lanIP' is correctly defined in your JavaScript, e.g.:
// const lanIP = "http://localhost:8000"; // Or your actual server IP/domain

const fetchUsers = async () => {
    // Use the new endpoint with IP information
    const url = `${lanIP}/api/v1/users/`; // or `/api/v1/users/with-ip/` if you want the separate endpoint
    console.log("Attempting to fetch users from:", url);
    
    try {
        const response = await fetch(url, {
            method: 'GET',
            mode: 'cors',
            credentials: 'omit',
            headers: {
                'Accept': 'application/json',
            },
        });
        
        console.log("Response status for users:", response.status);
        console.log("Response headers for users:", Array.from(response.headers.entries()));
        
        if (!response.ok) {
            let errorDetail = `HTTP error! Status: ${response.status}`;
            try {
                const errorBody = await response.json();
                errorDetail = errorBody.detail || errorDetail;
            } catch (e) {
                const errorText = await response.text();
                errorDetail = `HTTP error! Status: ${response.status}, Response: ${errorText.substring(0, 150)}...`;
            }
            throw new Error(errorDetail);
        }
        
        const users = await response.json();
        console.log("Successfully fetched users with IP info:", users);
        
        // Now you can access IP information for each user
        users.forEach(user => {
            console.log(`User ${user.first_name} ${user.last_name}:`);
            console.log(`  ID: ${user.id}`);
            console.log(`  IP Addresses (${user.ip_addresses.length}):`);
            user.ip_addresses.forEach(ip => {
                console.log(`    - ${ip.ip_address} (used ${ip.usage_count} times, last: ${ip.last_used})`);
                if (ip.is_banned) {
                    console.log(`      BANNED: ${ip.ban_reason || 'No reason provided'}`);
                }
                if (ip.is_primary) {
                    console.log(`      PRIMARY IP`);
                }
            });
        });
        
        return users;
    } catch (error) {
        console.error("Critical Error in fetchUsers:", error);
        const finalError = new Error(`Failed to fetch users from ${url}. Original error: ${error.message}`);
        throw finalError;
    }
};

// Example function to display user IP information in your UI
const displayUserIpInfo = (user) => {
    const ipInfo = user.ip_addresses.map(ip => {
        let status = '';
        if (ip.is_banned) {
            status = ' [BANNED]';
        }
        if (ip.is_primary) {
            status += ' [PRIMARY]';
        }
        return `${ip.ip_address}${status} (${ip.usage_count} uses)`;
    }).join(', ');
    
    return ipInfo || 'No IP addresses recorded';
};

// Example usage in your UI rendering
const renderUserTable = (users) => {
    return users.map(user => {
        const ipDisplay = displayUserIpInfo(user);
        return `
            <tr>
                <td>${user.first_name} ${user.last_name}</td>
                <td>${user.rfid_code || 'N/A'}</td>
                <td>${ipDisplay}</td>
                <td>${user.last_active || 'Never'}</td>
            </tr>
        `;
    }).join('');
};



let state = {
    questions: [],
    themes: [],
    users: []
};




// Enhanced updateQuestion function to read actual form data from DOM
const updateQuestion = async (question) => {
    try {
        const userId = sessionStorage.getItem('admin_user_id');
        const rfidCode = sessionStorage.getItem('admin_rfid_code');
        
        if (!userId || !rfidCode) {
            throw new Error('Authentication required. Please log in again.');
        }
        
        // Read the actual current values from the DOM elements
        const questionElement = document.querySelector(`[data-id="${question.id}"]`);
        if (!questionElement) {
            throw new Error('Question element not found in DOM');
        }
        
        // Get current form values
        const questionText = questionElement.querySelector('.c-question-text-edit')?.value || '';
        const themeSelect = questionElement.querySelector('.js-theme-select');
        const difficultySelect = questionElement.querySelector('.js-difficulty-select');
        const thinkTimeInput = questionElement.querySelector('.js-think-time');
        const timeLimitInput = questionElement.querySelector('.js-time-limit');
        const pointsInput = questionElement.querySelector('.js-points');
        const urlInput = questionElement.querySelector('.js-url');
        const isActiveCheckbox = questionElement.querySelector('.js-is-active');
        const noCorrectCheckbox = questionElement.querySelector('.js-not-correct');
        const explanationTextarea = questionElement.querySelector('.js-explanation');
        
        // Get environmental controls
        const lightMinInput = questionElement.querySelector('.js-light-min');
        const lightMaxInput = questionElement.querySelector('.js-light-max');
        const tempMinInput = questionElement.querySelector('.js-temp-min');
        const tempMaxInput = questionElement.querySelector('.js-temp-max');
        
        // Read current answers from the form
        const answerElements = questionElement.querySelectorAll('.c-answer-item');
        const currentAnswers = Array.from(answerElements).map(answerEl => {
            const textInput = answerEl.querySelector('.c-answer-text');
            const correctCheckbox = answerEl.querySelector('input[type="checkbox"]');
            return {
                answer_text: textInput?.value || '',
                is_correct: correctCheckbox?.checked || false
            };
        }).filter(answer => answer.answer_text.trim() !== ''); // Only include non-empty answers
        
        console.log('Current answers from DOM:', currentAnswers);
        
        // Helper function to safely get numeric value
        const getNumericValue = (input, defaultValue = null) => {
            if (!input || input.value === '') return defaultValue;
            const val = Number(input.value);
            return isNaN(val) ? defaultValue : val;
        };
        
        // Prepare the update data with current form values
        const updateData = {
            question_text: questionText,
            themeId: String(themeSelect?.value || 1),
            difficultyLevelId: String(difficultySelect?.value || 1),
            think_time: getNumericValue(thinkTimeInput, 0),
            time_limit: getNumericValue(timeLimitInput, 30),
            points: getNumericValue(pointsInput, 10),
            Url: urlInput?.value || null,
            is_active: isActiveCheckbox?.checked !== undefined ? isActiveCheckbox.checked : true,
            no_answer_correct: noCorrectCheckbox?.checked !== undefined ? noCorrectCheckbox.checked : false,
            LightMin: getNumericValue(lightMinInput),
            LightMax: getNumericValue(lightMaxInput),
            TempMin: getNumericValue(tempMinInput),
            TempMax: getNumericValue(tempMaxInput),
            explanation: explanationTextarea?.value || null,
            answers: currentAnswers
        };
        
        console.log('Updating question ID:', question.id);
        console.log('Sending update data:', updateData);
        
        // Make API call to update the question using PATCH method
        const response = await fetch(`${lanIP}/api/v1/questions/${question.id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': userId,
                'X-RFID': rfidCode
            },
            body: JSON.stringify(updateData)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            let errorData = {};
            try {
                errorData = JSON.parse(errorText);
            } catch (e) {
                console.error('Could not parse error response:', errorText);
            }
            
            // Better error message handling for validation errors
            let errorMessage;
            if (errorData.detail && Array.isArray(errorData.detail)) {
                // Format validation errors more clearly
                const validationErrors = errorData.detail.map(err => 
                    `${err.loc.join('.')}: ${err.msg}`
                ).join(', ');
                errorMessage = `Validation error: ${validationErrors}`;
            } else {
                errorMessage = errorData.detail || errorData.message || `HTTP error! status: ${response.status}`;
            }
            
            console.error('Update failed with error:', errorMessage);
            console.error('Response body:', errorText);
            throw new Error(errorMessage);
        }
        
        const result = await response.json();
        
        // Update the question in state with the actual form data
        const index = state.questions.findIndex(q => q.id === question.id);
        if (index >= 0) {
            // Merge the updated data back into the state
            state.questions[index] = { ...state.questions[index], ...updateData };
        }
        
        console.log('Question updated successfully:', result);
        showNotification(`Question updated successfully! ${result.updated_answers || 0} answers updated.`, 'success');
        
        return result;
        
    } catch (error) {
        console.error('Failed to update question:', error);
        
        // Handle specific error cases
        if (error.message.includes('403') || error.message.includes('Only admins can edit')) {
            showNotification('Access denied. Only admins can edit questions.', 'error');
        } else if (error.message.includes('404') || error.message.includes('not found')) {
            showNotification('Question not found. It may have been deleted.', 'error');
        } else if (error.message.includes('422') || error.message.includes('Unprocessable Entity')) {
            showNotification('Invalid data format. Please check all fields.', 'error');
        } else {
            console.log(`Failed to update question: ${error.message}`, 'error');
        }
        
        throw error; // Re-throw so calling code can handle it if needed
    }
};






const saveItem = async (itemType, item, isNewQuestion = false) => {
    console.log(`Saving ${itemType}:`, item);
    
    if (itemType === 'questions') {
        const questionForm = document.querySelector('.c-question-edit-container.active');
        
        // If it's a new question and we can't find the form, just reload and bail out
        if (isNewQuestion && !questionForm) {
            window.location.reload();
            return;
        }
        
        // If we get here, either it's not a new question or we found the form
        if (questionForm) {
            // [Keep all your existing form data collection logic here]
            
            if (isNewQuestion || !item.id) {
                await createQuestion(questionData);
                window.location.reload();
                return;
            } else {
                // Existing question update logic
                const updatedQuestion = await updateQuestion(questionData);
                // [Rest of your update logic]
                return updatedQuestion;
            }
        }
        
        // If we get here and it's not a new question, then silently reload
        window.location.reload();
        return;
    }
    // Code for themes and users ...
 else if (itemType === 'themes') {
        const index = state.themes.findIndex(t => t.id === item.id);
        if (index >= 0) {
            state.themes[index] = item;
        } else {
            item.id = state.themes.length + 1;
            item.questionCount = 0;
            state.themes.push(item);
        }
        return item;
    } else if (itemType === 'users') {
        const index = state.users.findIndex(u => u.id === item.id);
        if (index >= 0) {
            state.users[index] = item;
        } else {
            item.id = state.users.length + 1;
            state.users.push(item);
        }
        return item;
    }
   
    // If itemType doesn't match any known type
    throw new Error(`Unknown item type: ${itemType}`);
};



const deleteItem = async (itemType, itemId) => {
    try {
        if (itemType === 'questions') {
            const userId = sessionStorage.getItem('admin_user_id');
            const rfidCode = sessionStorage.getItem('admin_rfid_code');
            
            if (!userId || !rfidCode) {
                throw new Error('Authentication required. Please log in again.');
            }
            
            // Make API call to delete question
            const response = await fetch(`${lanIP}/api/v1/questions/${itemId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-ID': userId,
                    'X-RFID': rfidCode
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                let errorData = {};
                try {
                    errorData = JSON.parse(errorText);
                } catch (e) {
                    console.error('Could not parse error response:', errorText);
                }
                
                let errorMessage;
                if (errorData.detail && Array.isArray(errorData.detail)) {
                    const validationErrors = errorData.detail.map(err => 
                        `${err.loc.join('.')}: ${err.msg}`
                    ).join(', ');
                    errorMessage = `Validation error: ${validationErrors}`;
                } else {
                    errorMessage = errorData.detail || errorData.message || `HTTP error! status: ${response.status}`;
                }
                
                console.error('Delete failed with error:', errorMessage);
                console.error('Response body:', errorText);
                throw new Error(errorMessage);
            }

            const result = await response.json();
            console.log('Question deleted successfully:', result);

            // Remove from local state after successful API call
            state.questions = state.questions.filter(q => q.id !== itemId);
            
            showNotification('Question deleted successfully!', 'success');
            return true;
        } else if (itemType === 'themes') {
            const userId = sessionStorage.getItem('admin_user_id');
            const rfidCode = sessionStorage.getItem('admin_rfid_code');
            
            if (!userId || !rfidCode) {
                throw new Error('Authentication required. Please log in again.');
            }
            
            // Make API call to delete theme
            const response = await fetch(`${lanIP}/api/v1/themes/${itemId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-ID': userId,
                    'X-RFID': rfidCode
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                let errorData = {};
                try {
                    errorData = JSON.parse(errorText);
                } catch (e) {
                    console.error('Could not parse error response:', errorText);
                }
                
                let errorMessage;
                if (errorData.detail && Array.isArray(errorData.detail)) {
                    const validationErrors = errorData.detail.map(err => 
                        `${err.loc.join('.')}: ${err.msg}`
                    ).join(', ');
                    errorMessage = `Validation error: ${validationErrors}`;
                } else {
                    errorMessage = errorData.detail || errorData.message || `HTTP error! status: ${response.status}`;
                }
                
                console.error('Delete failed with error:', errorMessage);
                console.error('Response body:', errorText);
                throw new Error(errorMessage);
            }

            const result = await response.json();
            console.log('Theme deleted successfully:', result);

            // Remove from local state after successful API call
            state.themes = state.themes.filter(t => t.id !== itemId);
            
            showNotification('Theme deleted successfully!', 'success');
            return true;
        } else if (itemType === 'users') {
            const userId = sessionStorage.getItem('admin_user_id');
            const rfidCode = sessionStorage.getItem('admin_rfid_code');
            
            if (!userId || !rfidCode) {
                throw new Error('Authentication required. Please log in again.');
            }
            
            // Check if trying to delete own account
            if (parseInt(userId) === itemId) {
                throw new Error('Cannot delete your own account');
            }
            
            // Make API call to delete user
            const response = await fetch(`${lanIP}/api/v1/users/${itemId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-ID': userId,
                    'X-RFID': rfidCode
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                let errorData = {};
                try {
                    errorData = JSON.parse(errorText);
                } catch (e) {
                    console.error('Could not parse error response:', errorText);
                }
                
                let errorMessage;
                if (errorData.detail && Array.isArray(errorData.detail)) {
                    const validationErrors = errorData.detail.map(err => 
                        `${err.loc.join('.')}: ${err.msg}`
                    ).join(', ');
                    errorMessage = `Validation error: ${validationErrors}`;
                } else {
                    errorMessage = errorData.detail || errorData.message || `HTTP error! status: ${response.status}`;
                }
                
                console.error('Delete failed with error:', errorMessage);
                console.error('Response body:', errorText);
                throw new Error(errorMessage);
            }

            const result = await response.json();
            console.log('User deleted successfully:', result);

            // Remove from local state after successful API call
            state.users = state.users.filter(u => u.id !== itemId);
            
            showNotification('User deleted successfully!', 'success');
            return true;
        }
        
        console.log(`Deleting ${itemType} with ID:`, itemId);
        return true;
        
    } catch (error) {
        console.error(`Error deleting ${itemType}:`, error);
        
        // Handle specific error cases
        if (error.message.includes('403')) {
            if (itemType === 'questions') {
                showNotification('Access denied. Only admins can delete questions.', 'error');
            } else if (itemType === 'themes') {
                showNotification('Access denied. Only admins and moderators can delete themes.', 'error');
            } else if (itemType === 'users') {
                showNotification('Access denied. Only admins can delete users.', 'error');
            }
        } else if (error.message.includes('Cannot delete your own account')) {
            showNotification('You cannot delete your own account.', 'error');
        } else if (error.message.includes('404') || error.message.includes('not found')) {
            showNotification(`${itemType.charAt(0).toUpperCase() + itemType.slice(1, -1)} not found. It may have been already deleted.`, 'error');
        } else if (error.message.includes('Authentication required')) {
            showNotification('Please log in again to continue.', 'error');
        } else {
            showNotification(`Failed to delete ${itemType}: ${error.message}`, 'error');
        }
        
        return false;
    }
};

// #endregion

// #region ***  Callback-Visualisation - show___         ***********
// Enhanced showTab function to populate filters when showing questions tab
const showTab = (tabId) => {
    // Hide all tab contents
    domAdmin.tabContents.forEach(content => {
        content.classList.remove('active');
    });
    
    // Deactivate all tab buttons
    domAdmin.tabBtns.forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab content
    const selectedTab = document.querySelector(`.js-tab-content[data-tab="${tabId}"]`);
    if (selectedTab) selectedTab.classList.add('active');
    
    // Activate selected tab button
    const selectedBtn = document.querySelector(`.js-tab-btn[data-tab="${tabId}"]`);
    if (selectedBtn) selectedBtn.classList.add('active');
    
    // Update current tab state
    currentTab = tabId;
    
    // If switching to questions tab, populate theme filter
    if (tabId === 'questions') {
        populateThemeFilter();
    }
    
    // Load data for the selected tab
    loadTabData(tabId);
};

const showEditModal = async (itemType, item = null) => {
    const modal = domAdmin.editModal;
    const modalTitle = modal.querySelector('.c-modal-title');
    const form = modal.querySelector('.c-edit-form');
    
    // Helper function to escape HTML
    const escapeHTML = (str) => {
        if (!str) return '';
        return str.replace(/[&<>'"]/g, (tag) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag));
    };
    
    // **FIX: Ensure themes are loaded before building question form**
    if (itemType === 'questions' && (!state.themes || state.themes.length === 0)) {
        try {
            console.log('Loading themes for question modal...');
            state.themes = await fetchThemes();
        } catch (error) {
            console.error('Failed to load themes for modal:', error);
            state.themes = []; // Fallback to empty array
        }
    }
    
    // Helper function to generate answers HTML
    const generateAnswersHTML = (answers, count) => {
        return Array.from({length: count}, (_, i) => {
            // Preserve existing answers up to the new count
            const answer = i < answers.length ? answers[i] : {text: '', isCorrect: false};
            return `
                <div class="c-answer-item">
                    <input type="text" 
                        name="answers[${i}][text]"
                        class="c-answer-text c-form-input" 
                        value="${escapeHTML(answer.text)}" 
                        placeholder="Answer option ${i+1}">
                    <label class="c-answer-correct">
                        <input type="checkbox" 
                            name="answers[${i}][isCorrect]"
                            ${answer.isCorrect ? 'checked' : ''}>
                        <span>Correct</span>
                    </label>
                </div>
            `;
        }).join('');
    };

    // Clear previous form
    form.innerHTML = '';
    
    if (item) {
        currentEditItem = { ...item };
        modalTitle.textContent = `Edit ${itemType.slice(0, -1)}`;
    } else {
        currentEditItem = { id: null };
        modalTitle.textContent = `Add New ${itemType.slice(0, -1)}`;
    }
    
    // Build form based on item type
    if (itemType === 'questions') {
        // Get initial answer count - default to 4 if no item or no answers
        const initialAnswerCount = item && item.answers ? item.answers.length : 4;
        
        // **FIX: Build themes dropdown with proper error handling**
        let themesOptionsHTML = '';
        if (state.themes && state.themes.length > 0) {
            themesOptionsHTML = state.themes.map(theme => {
                // Compare theme IDs for proper selection
                const isSelected = item && (
                    (item.theme && item.theme.id === theme.id) || 
                    item.themeId === theme.id
                );
                return `<option value="${theme.id}" ${isSelected ? 'selected' : ''}>
                    ${escapeHTML(theme.name)}
                </option>`;
            }).join('');
        } else {
            themesOptionsHTML = '<option value="">No themes available - Please add themes first</option>';
        }
        
        form.innerHTML = `
            <div class="c-form-group">
                <label>Question</label>
                <input type="text" name="text" class="c-form-input" value="${escapeHTML(item ? item.text : '')}" required>
            </div>
            
            <div class="c-form-group">
                <label>Theme</label>
                <select name="theme" class="c-form-select" required>
                    ${themesOptionsHTML}
                </select>
            </div>
            
            <div class="c-form-group">
                <label>Difficulty</label>
                <select name="difficulty" class="c-form-select" required>
                    <option value="Easy" ${item && item.difficulty === 'Easy' ? 'selected' : ''}>Easy</option>
                    <option value="Medium" ${item && item.difficulty === 'Medium' ? 'selected' : ''}>Medium</option>
                    <option value="Hard" ${item && item.difficulty === 'Hard' ? 'selected' : ''}>Hard</option>
                    <option value="Expert" ${item && item.difficulty === 'Expert' ? 'selected' : ''}>Expert</option>
                </select>
            </div>
            
            <div class="c-form-group">
                <label>Think Time (seconds)</label>
                <input type="number" name="think_time" class="c-form-input" 
                       value="${item ? item.think_time : 0}" min="0">
            </div>
            
            <div class="c-form-group">
                <label>Answer Time Limit (seconds)</label>
                <input type="number" name="time_limit" class="c-form-input" 
                       value="${item ? item.time_limit : 30}" min="1" required>
            </div>
            
            <div class="c-form-group">
                <label>Points</label>
                <input type="number" name="points" class="c-form-input" 
                       value="${item ? item.points : 10}" min="1" required>
            </div>
            
            <div class="c-form-group">
                <label>Media URL (optional)</label>
                <input type="text" name="Url" class="c-form-input" 
                       value="${escapeHTML(item ? item.Url : '')}" placeholder="https://example.com/media">
            </div>
            
            <div class="c-form-group c-answer-correct">
                <label>
                    <input type="checkbox" name="is_active" class="c-form-checkbox" 
                           ${item && item.is_active ? 'checked' : ''}>
                    Active Question
                </label>
            </div>
            
            <div class="c-form-group c-answer-correct">
                <label>
                    <input type="checkbox" name="no_answer_correct" class="c-form-checkbox" 
                           ${item && item.no_answer_correct ? 'checked' : ''}>
                    No Correct Answer
                </label>
            </div>
            
            <div class="c-form-group">
                <label>Minimum Light</label>
                <input type="number" name="LightMin" class="c-form-input" 
                       value="${item ? item.LightMin : ''}" placeholder="leave blank if not applicable">
            </div>
            
            <div class="c-form-group">
                <label>Maximum Light</label>
                <input type="number" name="LightMax" class="c-form-input" 
                       value="${item ? item.LightMax : ''}" placeholder="leave blank if not applicable">
            </div>
            
            <div class="c-form-group">
                <label>Minimum Temperature</label>
                <input type="number" name="TempMin" class="c-form-input" 
                       value="${item ? item.TempMin : ''}" placeholder="leave blank if not applicable">
            </div>
            
            <div class="c-form-group">
                <label>Maximum Temperature</label>
                <input type="number" name="TempMax" class="c-form-input" 
                       value="${item ? item.TempMax : ''}" placeholder="leave blank if not applicable">
            </div>
            
            <div class="c-form-group">
                <label>Explanation</label>
                <textarea name="explanation" class="c-form-textarea c-explanation-textarea" 
                          placeholder="Detailed explanation for the correct answer">${escapeHTML(item ? item.explanation : '')}</textarea>
            </div>
            
            <div class="c-form-group">
                <label>Number of Answers</label>
<select name="answer_count" class="c-form-select js-answer-count">
    ${Array.from({length: 20}, (_, i) => i + 4).map(num => 
        `<option value="${num}" ${initialAnswerCount === num ? 'selected' : ''}>
            ${num}
        </option>`
    ).join('')}
</select>
            </div>

            <div class="c-answer-options">
                <div class="c-answer-list">
                    ${generateAnswersHTML(item ? item.answers : [], initialAnswerCount)}
                </div>
            </div>
        `;
            currentForm = form;
        // Add event listener for answer count change - using event delegation
        form.addEventListener('change', (e) => {
            if (e.target.classList.contains('js-answer-count')) {
                const newCount = parseInt(e.target.value);
                const answerListContainer = form.querySelector('.c-answer-list');
                
                if (answerListContainer) {
                    // Get current answers from the form
                    const currentAnswers = Array.from(answerListContainer.querySelectorAll('.c-answer-item')).map(answerItem => {
                        const textInput = answerItem.querySelector('input[type="text"]');
                        const checkboxInput = answerItem.querySelector('input[type="checkbox"]');
                        return {
                            text: textInput ? textInput.value : '',
                            isCorrect: checkboxInput ? checkboxInput.checked : false
                        };
                    });
                    
                    // Update the answer list with new count
                    answerListContainer.innerHTML = generateAnswersHTML(currentAnswers, newCount);
                }
            }
        });
    }
    
    else if (itemType === 'themes') {
        form.innerHTML = `
<div class="c-form-group">
    <label>Theme Name</label>
    <input type="text" name="name" class="c-form-input" value="${item ? item.name : ''}" required>
</div>

<div class="c-form-group">
    <label>Description (optional)</label>
    <textarea name="description" class="c-form-textarea c-explanation-textarea"  
              placeholder="Description of the theme">${escapeHTML(item ? item.description : '')}</textarea>
</div>

<div class="c-form-group c-answer-correct">
    <label>
        <input type="checkbox" name="is_active" class="c-form-checkbox" 
               ${item && item.is_active !== false ? 'checked' : ''}>
        Active Theme
    </label>
</div>
        `;
        currentForm = form;
} else if (itemType === 'users') {
    form.innerHTML = `
<div class="c-form-group">
    <label>Username</label>
    <input type="text" name="username" class="c-form-input" value="${item ? item.first_name + ' ' + item.last_name : ''}">
</div>
<div class="c-form-group">
    <label>Role</label>
    <select name="role" class="c-form-select">
        <option value="Admin" ${item && item.userRoleId === 3 ? 'selected' : ''}>Admin</option>
        <option value="Moderator" ${item && item.userRoleId === 2 ? 'selected' : ''}>Moderator</option>
        <option value="User" ${item && item.userRoleId === 1 ? 'selected' : ''}>User</option>
    </select>
</div>
<div class="c-form-group">
    <label>IP Address</label>
    <select name="ip" class="c-form-select">
        ${item && item.ip_addresses ? item.ip_addresses.map(ip => `
            <option value="${ip.ip_address}" ${ip.is_primary ? 'selected' : ''}>
                ${ip.ip_address} (used ${ip.usage_count} times)${ip.is_banned ? ' [BANNED]' : ''}${ip.is_primary ? ' [PRIMARY]' : ''}
            </option>
        `).join('') : '<option value="">No IP addresses found</option>'}
    </select>
</div>
<div class="c-form-group">
    <label>Ban Reason</label>
    <textarea name="banReason" class="c-explanation-textarea" placeholder="Enter reason for ban...">${item ? item.banReason || '' : ''}</textarea>
</div>
<div class="c-form-group">
    <label>Ban Duration</label>
    <div class="c-duration-container">
        <input type="number" name="banDurationValue" class="c-form-input" value="1" min="1">
        <select name="banDurationUnit" class="c-form-input">
            <option value="minutes">Minutes</option>
            <option value="hours" selected>Hours</option>
            <option value="days">Days</option>
            <option value="permanent">Eternity</option>
        </select>
        <button type="button" class="c-btn c-btn--primary" onclick="banIpAddress()">Ban IP Address</button>
    </div>
</div>
    `;

    // Define the ban function globally so onclick can access it
    window.banIpAddress = async function() {
            // Get form data
            const ipSelect = form.querySelector('select[name="ip"]');
            const banReasonTextarea = form.querySelector('textarea[name="banReason"]');
            const banDurationValueInput = form.querySelector('input[name="banDurationValue"]');
            const banDurationUnitSelect = form.querySelector('select[name="banDurationUnit"]');

            // Validate form data
            if (!ipSelect.value) {
                alert('Please select an IP address to ban');
                return;
            }

            if (!banReasonTextarea.value.trim()) {
                alert('Please enter a ban reason');
                return;
            }

            const banDurationValue = parseInt(banDurationValueInput.value);
            if (banDurationValue < 1) {
                alert('Ban duration must be at least 1');
                return;
            }

            // Prepare ban data
            const banData = {
                ip_address: ipSelect.value,
                ban_reason: banReasonTextarea.value.trim(),
                ban_duration_value: banDurationValue,
                ban_duration_unit: banDurationUnitSelect.value
            };

            // Get user credentials
            const userId = sessionStorage.getItem('admin_user_id');
            const rfidCode = sessionStorage.getItem('admin_rfid_code');

            if (!userId || !rfidCode) {
                alert('Admin credentials not found. Please log in again.');
                return;
            }

            try {
                // Get the button element
                const banButton = document.querySelector('.c-btn--primary');
                if (banButton) {
                    banButton.disabled = true;
                    banButton.textContent = 'Banning...';
                }

                const response = await fetch(`${lanIP}/api/v1/ban-ip`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-User-ID': userId,
                        'X-RFID': rfidCode
                    },
                    body: JSON.stringify(banData)
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.detail || `HTTP error! Status: ${response.status}`);
                }

                const result = await response.json();
                
                // Success
                alert(`IP address ${banData.ip_address} has been banned successfully!`);
                console.log('Ban result:', result);
                
                // Optionally refresh the user data or close the form
                // You might want to call your refresh function here
                
            } catch (error) {
                console.error('Error banning IP address:', error);
                alert(`Failed to ban IP address: ${error.message}`);
            } finally {
                // Re-enable button
                const banButton = document.querySelector('.c-btn--primary');
                if (banButton) {
                    banButton.disabled = false;
                    banButton.textContent = 'Ban IP Address';
                }
            }
    };
}
    
    // Add form action buttons
    form.innerHTML += `
        <div class="c-form-actions">
            <button type="button" class="c-btn c-btn--cancel">Cancel</button>
            <button type="submit" class="c-btn c-btn--primary js-save-changes">Save Changes</button>
        </div>
    `;
    
    // Reattach event listeners
    const newCancelBtn = form.querySelector('.c-btn--cancel');
    if (newCancelBtn) {
        newCancelBtn.addEventListener('click', hideEditModal);
    }
    
    const newSaveBtn = form.querySelector('.js-save-changes');
    if (newSaveBtn) {
        newSaveBtn.addEventListener('click', (e) => {
            e.preventDefault();
            saveCurrentItem(itemType);
        });
    }
    
    // Show modal
    modal.style.display = 'block';
};

const hideEditModal = () => {
    if (domAdmin.editModal) domAdmin.editModal.style.display = 'none';
    currentEditItem = null;
};

const showLoading = (element) => {
    element.innerHTML = '<div class="c-loading">Loading...</div>';
};

const showConfirmDialog = (message, onConfirm) => {
    if (confirm(message)) {
        onConfirm();
    }
};

const showNotification = (message, type = 'success') => {
    const notification = document.createElement('div');
    notification.className = `c-notification c-notification--${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
};
// #endregion

// #region ***  Data manipulation functions             ***********
const loadTabData = async (tabId) => {
    switch (tabId) {
        case 'questions':
            await loadQuestions();
            break;
        case 'themes':
            await loadThemes();
            break;
        case 'users':
            await loadUsers();
            break;
    }
};

// Fix 1: Search by search term crash - Update loadQuestions function
// Enhanced loadQuestions function with theme and difficulty filtering
const loadQuestions = async () => {
    const questionList = document.querySelector('.c-question-list');
    
    if (!questionList) return;
    
    showLoading(questionList);
    
    try {
        const questions = await fetchQuestions();
        state.questions = questions; // Update state with fetched questions
        
        // Get filter values
        const searchTerm = domAdmin.searchInput?.value.toLowerCase() || '';
        const selectedThemeId = domAdmin.themeFilter?.value ? parseInt(domAdmin.themeFilter.value) : null;
        const selectedDifficulty = domAdmin.difficultyFilter?.value ? parseInt(domAdmin.difficultyFilter.value) : null;
        
        // Apply all filters
        let filteredQuestions = questions;
        
        // Filter by search term
        if (searchTerm) {
            filteredQuestions = filteredQuestions.filter(q => 
                q.question_text.toLowerCase().includes(searchTerm)
            );
        }
        
        // Filter by theme
        if (selectedThemeId) {
            filteredQuestions = filteredQuestions.filter(q => 
                q.themeId === selectedThemeId
            );
        }
        
        // Filter by difficulty
        if (selectedDifficulty) {
            filteredQuestions = filteredQuestions.filter(q => 
                q.difficultyLevelId === selectedDifficulty
            );
        }
        
        // Handle empty states
        if (!questions.length || !filteredQuestions.length) {
            const message = !questions.length 
                ? 'No questions found. Add a new question to get started.'
                : 'No questions match your current filters.';
                
            questionList.innerHTML = `<div class="c-empty-state">${message}</div>`;
            return;
        }
        
        // Create document fragment for better performance
        const fragment = document.createDocumentFragment();
        
        // Create question elements
        filteredQuestions.forEach(question => {
            const questionItem = createQuestionElement(question);
            fragment.appendChild(questionItem);
        });
        
        // Clear and append all at once
        questionList.innerHTML = '';
        questionList.appendChild(fragment);
        
        // Add event delegation for better performance
        questionList.addEventListener('click', handleQuestionActions);
        questionList.addEventListener('change', handleQuestionFieldChanges);
        
    } catch (error) {
        console.error('Error loading questions:', error);
        questionList.innerHTML = '<div class="c-error-state">Failed to load questions. Please try again.</div>';
    }
};


// Fix 2: Themes dropdown options - Update createQuestionElement function
const createQuestionElement = (question) => {
    const element = document.createElement('div');
    element.className = 'c-question-item';
    element.dataset.id = question.id;

    const answerCount = question.answers.length > 4 ? question.answers.length : 4;
    const answersHTML = generateAnswersHTML(question.answers || [], answerCount);

    // Fix: Use theme.id for value and properly match with question.themeId
    const themesOptions = state.themes.map(theme => {
        const isSelected = question.themeId === theme.id || 
                          (question.theme && question.theme.id === theme.id);
        return `<option value="${theme.id}" ${isSelected ? 'selected' : ''}>${theme.name}</option>`;
    }).join('');

    element.innerHTML = `
    <div class="c-question-info">
        <div class="c-question-edit">
            <input type="text" class="c-question-text-edit" value="${escapeHTML(question.question_text)}" placeholder="Enter question">
        </div>

        <div class="c-question-meta">
            <div class="c-question-theme">
                <label for="theme-${question.id}">Theme:</label>
                <select id="theme-${question.id}" class="js-theme-select" data-question-id="${question.id}">
                    ${themesOptions}
                </select>
            </div>

            <div class="c-question-difficulty">
                <label for="difficulty-${question.id}">Difficulty:</label>
                <select id="difficulty-${question.id}" class="js-difficulty-select" data-question-id="${question.id}">
                    <option value="1" ${question.difficultyLevelId === 1 ? 'selected' : ''}>Easy</option>
                    <option value="2" ${question.difficultyLevelId === 2 ? 'selected' : ''}>Medium</option>
                    <option value="3" ${question.difficultyLevelId === 3 ? 'selected' : ''}>Hard</option>
                    <option value="4" ${question.difficultyLevelId === 4 ? 'selected' : ''}>Expert</option>
                </select>
            </div>

            <div class="c-question-time">
                <label for="think-time-${question.id}">Think Time (s):</label>
                <input type="number" id="think-time-${question.id}" class="c-answer-text js-think-time"
                        data-question-id="${question.id}" value="${question.think_time}" min="0">
            </div>

            <div class="c-question-time">
                <label for="time-limit-${question.id}">Answer Time (s):</label>
                <input type="number" id="time-limit-${question.id}" class="js-time-limit c-answer-text"
                        data-question-id="${question.id}" value="${question.time_limit}" min="1">
            </div>

            <div class="c-question-points">
                <label for="points-${question.id}">Points:</label>
                <input type="number" id="points-${question.id}" class="c-answer-text js-points"
                        data-question-id="${question.id}" value="${question.points}" min="1">
            </div>

            <div class="c-question-url">
                <label for="url-${question.id}">Media URL:</label>
                <input type="text" id="url-${question.id}" class="c-answer-text js-url"
                        data-question-id="${question.id}" value="${question.Url || ''}" placeholder="Optional media URL">
            </div>
            <div class="c-question-correct-special">
            <div class="c-question-correct c-answer-correct">
                <input type="checkbox" id="is-active-${question.id}" class="js-is-active c-answer-correct"
                        data-question-id="${question.id}" ${question.is_active ? 'checked' : ''}>
                <label for="is-active-${question.id}">Active Question</label>
            </div>

            <div class="c-question-correct-special" style="display: flex !important;">
                <input type="checkbox" id="not-correct-${question.id}" class="js-not-correct c-answer-correct"
                        data-question-id="${question.id}" ${question.no_answer_correct ? 'checked' : ''}>
                <label for="not-correct-${question.id}">No correct answer</label>
            </div>
            </div>
        </div>

        <div class="c-question-env">
            <div class="c-question-env-item">
                <label for="light-min-${question.id}">Min Light:</label>
                <input type="number" id="light-min-${question.id}" class="c-answer-text js-light-min"
                        data-question-id="${question.id}" value="${question.LightMin || ''}" placeholder="Optional">
            </div>
            <div class="c-question-env-item">
                <label for="light-max-${question.id}">Max Light:</label>
                <input type="number" id="light-max-${question.id}" class="c-answer-text js-light-max"
                        data-question-id="${question.id}" value="${question.LightMax || ''}" placeholder="Optional">
            </div>
            <div class="c-question-env-item">
                <label for="temp-min-${question.id}">Min Temp (°C):</label>
                <input type="number" id="temp-min-${question.id}" class="c-answer-text js-temp-min"
                        data-question-id="${question.id}" value="${question.TempMin || ''}" placeholder="Optional">
            </div>
            <div class="c-question-env-item">
                <label for="temp-max-${question.id}">Max Temp (°C):</label>
                <input type="number" id="temp-max-${question.id}" class="c-answer-text js-temp-max"
                        data-question-id="${question.id}" value="${question.TempMax || ''}" placeholder="Optional">
            </div>
        </div>

        <div class="c-answer-options">
            <div class="c-answer-count">
                <label for="answer-count-${question.id}">Number of answers:</label>
<select id="answer-count-${question.id}" class="js-answer-count" data-question-id="${question.id}">
    ${Array.from({length: 20}, (_, i) => i + 4).map(num =>
        `<option value="${num}" ${answerCount === num ? 'selected' : ''}>${num}</option>`
    ).join('')}
</select>
            </div>

            <div class="c-answer-list">
                ${answersHTML}
            </div>
        </div>

        <div class="c-explanation-container">
            <h3 class="c-explanation-heading">Question Explanation</h3>
            <div class="c-explanation-wrapper">
                <textarea id="explanation-${question.id}" class="c-explanation-textarea js-explanation"
                    data-question-id="${question.id}"
                    placeholder="Enter a detailed explanation for this question. This will help users understand the correct answer."
                >${question.explanation || ''}</textarea>
            </div>
        </div>

        <div class="c-question-actions">
            <button class="c-btn c-btn--delete js-delete-question" data-id="${question.id}">Delete Question</button>
        </div>
    </div>
    `;

    return element;
};

// Helper function to generate answers HTML
const generateAnswersHTML = (answers, count) => {
    return Array.from({length: count}, (_, i) => {
        // Access properties using the new names: answer_text and is_correct
        const answer = answers[i] || { answer_text: '', is_correct: false };
        return `
            <div class="c-answer-item">
                <input type="text" 
                       class="c-answer-text" 
                       value="${escapeHTML(answer.answer_text)}" 
                       placeholder="Answer option ${i+1}">
                <label class="c-answer-correct">
                    <input type="checkbox" ${answer.is_correct ? 'checked' : ''}>
                    <span>Correct</span>
                </label>
            </div>
        `;
    }).join('');
};


const handleQuestionActions = async (event) => {
    const target = event.target;
   
    // Edit button handler
    if (target.classList.contains('js-edit-question')) {
        const questionId = parseInt(target.dataset.id);
        const question = state.questions.find(q => q.id === questionId);
        
        if (!question) {
            showNotification('Question not found', 'error');
            return;
        }
        
        console.log('Original question:', question);
        
        try {
            // Disable the button to prevent multiple clicks
            target.disabled = true;
            target.textContent = 'Saving...';
            
 
            await saveItem('questions', question);
            
            showNotification('Question saved successfully', 'success');
            
        } catch (error) {
            console.error('Error saving question:', error);
        } finally {
            // Re-enable the button
            target.disabled = false;
            target.textContent = 'Save Changes';
        }
    }
   
    // Delete button handler
    if (target.classList.contains('js-delete-question')) {
        const questionItem = target.closest('.c-question-item');
        const id = parseInt(questionItem.dataset.id);
       
        showConfirmDialog('Are you sure you want to delete this question?', async () => {
            try {
                await deleteItem('questions', id);
                await loadQuestions(); // Make sure this completes before showing notification
                showNotification('Question deleted successfully', 'success');
            } catch (error) {
                console.error('Error deleting question:', error);
                showNotification(`Failed to delete question: ${error.message}`, 'error');
            }
        });
    }
};

// New function to send edit request
const sendEditRequest = async (questionId) => {
    console.log(`Sending edit request for question ID: ${questionId}`);
    
    try {
        // Here you would make an API call to get the latest data for this question
        // For now, we'll just use our local state
        const question = state.questions.find(q => q.id === questionId);
        
        if (question) {
            // Show edit modal with the question data
            showNotification('API request for editing would be sent here', 'info');
        }
    } catch (error) {
        console.error('Error sending edit request:', error);
        showNotification('Failed to send edit request', 'error');
    }
};

// Fix 3: Difficulty changes not working - Update handleQuestionFieldChanges function
const handleQuestionFieldChanges = (event) => {
    const target = event.target;
    const questionItem = target.closest('.c-question-item');
    
    if (!questionItem) return;
    
    const questionId = parseInt(questionItem.dataset.id);
    const question = state.questions.find(q => q.id === questionId);
    
    if (!question) return;
    
    // Handle answer count changes
    if (target.classList.contains('js-answer-count')) {
        const answerCount = parseInt(target.value);
        const answerList = questionItem.querySelector('.c-answer-list');
        
        // Get current answers to preserve them
        const currentAnswers = Array.from(answerList.querySelectorAll('.c-answer-item')).map(item => {
            return {
                answer_text: item.querySelector('.c-answer-text').value,
                is_correct: item.querySelector('input[type="checkbox"]').checked
            };
        });
        
        // Update the answer list with new count while preserving existing answers
        answerList.innerHTML = generateAnswersHTML(currentAnswers, answerCount);
        
        // Update question data
        question.answerCount = answerCount;
        if (!question.answers) {
            question.answers = [];
        }
        while (question.answers.length < answerCount) {
            question.answers.push({ answer_text: '', is_correct: false });
        }
        
        // Save changes to backend
        updateQuestion(question);
    }
    
    // Handle theme changes - Fix: Update themeId instead of theme
    if (target.classList.contains('js-theme-select')) {
        question.themeId = parseInt(target.value);
        // Also update the theme object for consistency
        question.theme = state.themes.find(t => t.id === question.themeId);
        console.log('Theme changed to:', question.themeId, question.theme?.name);
        updateQuestion(question);
    }
    
    // Handle difficulty changes - Fix: Update difficultyLevelId instead of difficulty
    if (target.classList.contains('js-difficulty-select')) {
        question.difficultyLevelId = parseInt(target.value);
        console.log('Difficulty changed to:', question.difficultyLevelId);
        updateQuestion(question);
    }
    
    // Handle other field changes
    if (target.classList.contains('js-think-time')) {
        question.think_time = parseInt(target.value) || 0;
        updateQuestion(question);
    }
    
    if (target.classList.contains('js-time-limit')) {
        question.time_limit = parseInt(target.value) || 30;
        updateQuestion(question);
    }
    
    if (target.classList.contains('js-points')) {
        question.points = parseInt(target.value) || 10;
        updateQuestion(question);
    }
    
    if (target.classList.contains('js-url')) {
        question.Url = target.value;
        updateQuestion(question);
    }
    
    if (target.classList.contains('js-is-active')) {
        question.is_active = target.checked;
        updateQuestion(question);
    }
    
    if (target.classList.contains('js-not-correct')) {
        question.no_answer_correct = target.checked;
        updateQuestion(question);
    }
    
    // Handle environmental constraints
    if (target.classList.contains('js-light-min')) {
        question.LightMin = parseFloat(target.value) || null;
        updateQuestion(question);
    }
    
    if (target.classList.contains('js-light-max')) {
        question.LightMax = parseFloat(target.value) || null;
        updateQuestion(question);
    }
    
    if (target.classList.contains('js-temp-min')) {
        question.TempMin = parseFloat(target.value) || null;
        updateQuestion(question);
    }
    
    if (target.classList.contains('js-temp-max')) {
        question.TempMax = parseFloat(target.value) || null;
        updateQuestion(question);
    }
    
    if (target.classList.contains('js-explanation')) {
        // Use blur event to avoid too many updates
        target.addEventListener('blur', () => {
            question.explanation = target.value;
            updateQuestion(question);
        }, { once: true });
    }
    
    // Handle question text changes
    if (target.classList.contains('c-question-text-edit')) {
        // Use blur event to avoid too many updates
        target.addEventListener('blur', () => {
            question.question_text = target.value;
            updateQuestion(question);
        }, { once: true });
    }
};

// Helper function to escape HTML (prevent XSS)
const escapeHTML = (str) => {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

const loadThemes = async () => {
    const themeList = document.querySelector('.c-theme-list');
    
    if (!themeList) return;
    
    showLoading(themeList);
    
    try {
        const themes = await fetchThemes();
        
        if (themes.length === 0) {
            themeList.innerHTML = '<div class="c-empty-state">No themes found. Add a new theme to get started.</div>';
            return;
        }
        
        themeList.innerHTML = themes.map(theme => `
            <div class="c-theme-item" data-id="${theme.id}">
                <div class="c-theme-info">
                    <div class="c-theme-name">${theme.name}</div>
                    <div class="c-theme-meta">
                        <span class="c-tag c-tag--count">${theme.questionCount} questions</span>
                    </div>
                </div>
                <div class="c-theme-actions">
                    <button class="c-btn c-btn--edit js-edit-theme">Edit</button>
                    <button class="c-btn c-btn--delete js-delete-theme">Delete</button>
                </div>
            </div>
        `).join('');
        
        // Add event listeners to new buttons
        themeList.querySelectorAll('.js-edit-theme').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = parseInt(btn.closest('.c-theme-item').dataset.id);
                const theme = themes.find(t => t.id === id);
                if (theme) {
                    showEditModal('themes', theme);
                }
            });
        });
        
        themeList.querySelectorAll('.js-delete-theme').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = parseInt(btn.closest('.c-theme-item').dataset.id);
                const theme = themes.find(t => t.id === id);
                
                if (theme && theme.questionCount > 0) {
                    showNotification(`Cannot delete theme "${theme.name}" because it contains questions.`, 'error');
                    return;
                }
                
                showConfirmDialog('Are you sure you want to delete this theme?', async () => {
                    await deleteItem('themes', id);
                    loadThemes();
                    showNotification('Theme deleted successfully');
                });
            });
        });
    } catch (error) {
        console.error('Error loading themes:', error);
        themeList.innerHTML = '<div class="c-error-state">Failed to load themes. Please try again.</div>';
    }
};

const loadUsers = async () => {
    const userTableBody = document.querySelector('.c-user-table tbody');
    if (!userTableBody) return;

    showLoading(userTableBody);

    try {
        const users = await fetchUsers();
        if (!users || users.length === 0) { // Check if users is null/undefined or empty
            userTableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="c-empty-state">No users found.</td>
                </tr>
            `;
            return;
        }

        userTableBody.innerHTML = users.map(user => {
            // Map userRoleId to a displayable role name
            // You'll need a mapping for userRoleId to role names, e.g., from your backend or a static client-side map.
            // For example, if userRoleId 1 = 'Admin', 2 = 'Manager', 3 = 'Standard User'
            // For now, let's just display the ID or map it to a placeholder.
            // A more robust solution involves fetching roles from the backend or having a global roles mapping.
            const roleName = getRoleName(user.userRoleId); // You need to define getRoleName
            const lastActiveDisplay = user.last_active ? new Date(user.last_active).toLocaleString() : 'Never';
            // Combine first_name and last_name for display username
            const displayName = `${user.first_name} ${user.last_name}`;

            return `
                <tr data-id="${user.id}">
                    <td data-label="Username">${displayName}</td>
                    <td data-label="Role">
                        <span class="c-tag c-tag--role c-tag--${roleName.toLowerCase()}">${roleName}</span>
                    </td>
                    <td data-label="Last Active">${lastActiveDisplay}</td>
                    <td>
                        <button class="c-btn c-btn--edit js-edit-user">
                            <span>Edit</span>
                        </button>
                    </td>
                    <td>
                        <button class="c-btn c-btn--delete js-delete-user">
                            <span>Delete</span>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        // Add event listeners to new buttons
        userTableBody.querySelectorAll('.js-edit-user').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = parseInt(btn.closest('tr').dataset.id);
                const user = users.find(u => u.id === id);
                if (user) {
                    showEditModal('users', user);
                }
            });
        });

        userTableBody.querySelectorAll('.js-delete-user').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = parseInt(btn.closest('tr').dataset.id);
                const user = users.find(u => u.id === id);
                
                // Removed the admin check - now allows deletion of any user
                showConfirmDialog('Are you sure you want to delete this user?', async () => {
                    await deleteItem('users', id);
                    loadUsers(); // Reload users after deletion
                    showNotification('User deleted successfully');
                });
            });
        });

    } catch (error) {
        console.error('Error loading users:', error);
        userTableBody.innerHTML = `
            <tr>
                <td colspan="5" class="c-error-state">Failed to load users. Please try again.</td>
            </tr>
        `;
    }
};

// --- Add this helper function to map userRoleId to a displayable role name ---
// You will need to define how userRoleId maps to actual role names.
// This is a placeholder; you might fetch roles from the backend or have a fixed map.
const getRoleName = (userRoleId) => {
    switch (userRoleId) {
        case 3: return 'Admin';
        case 2: return 'Manager';
        case 1: return 'Standard User';
        // Add more cases as needed for your user roles
        default: return 'Unknown Role';
    }
};

const saveCurrentItem = async (itemType) => {
    if (!currentEditItem) return;
    
    const form = domAdmin.editModal.querySelector('.c-edit-form');
    
    // Gather form data
if (itemType === 'questions') {
const form = currentForm;
const formData = new FormData(form);

// Convert form data to match backend's expected structure
const questionData = {
    question_text: formData.get('text') || "Default question",
    themeId: formData.get('theme') || "General",
    difficultyLevelId: formData.get('difficulty') || "Medium",
    explanation: formData.get('explanation') || "",
    Url: formData.get('Url') || "",
    time_limit: parseInt(formData.get('time_limit')) || 30,
    think_time: parseInt(formData.get('think_time')) || 0,
    points: parseInt(formData.get('points')) || 10,
    is_active: formData.get('is_active') === 'on',
    no_answer_correct: formData.get('no_answer_correct') === 'on',
    LightMax: parseFloat(formData.get('LightMax')) || null,
    LightMin: parseFloat(formData.get('LightMin')) || null,
    TempMax: parseFloat(formData.get('TempMax')) || null,
    TempMin: parseFloat(formData.get('TempMin')) || null,
    answers: Array.from(form.querySelectorAll('.c-answer-item')).map(item => ({
        answer_text: item.querySelector('input[type="text"]').value || "Default answer",
        is_correct: item.querySelector('input[type="checkbox"]').checked
    }))
};

try {
    // Get user credentials from session storage
    const userId = sessionStorage.getItem('admin_user_id');
    const rfidCode = sessionStorage.getItem('admin_rfid_code');
    
    if (!userId || !rfidCode) {
        throw new Error('User credentials not found. Please access this page with proper authentication.');
    }

    const response = await fetch(`${lanIP}/api/v1/questions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-User-ID': userId,        // Backend expects this header
            'X-RFID': rfidCode          // Backend expects this header
        },
        body: JSON.stringify(questionData)
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error("Backend error details:", errorData);
        throw new Error(`Server error: ${errorData.detail || response.status}`);
    }

    const result = await response.json();
    console.log("Question saved:", result);
    alert("Success!");
} catch (error) {
    console.error("Submission failed:", error);
    alert(`Error: ${error.message}`);
}

}else if (itemType === 'themes') {

const form = currentForm;
const formData = new FormData(form);

// Validate and sanitize form data
const themeName = formData.get('name')?.toString().trim();
if (!themeName || themeName.length < 3) {
    console.error('Theme name must be at least 3 characters long');
    return;
}

const themeData = {
    name: themeName,
    description: formData.get('description')?.toString().trim() || null,
    is_active: formData.get('is_active') === 'on'
};

try {
    // Get user credentials
    const userId = sessionStorage.getItem('admin_user_id');
    const rfidCode = sessionStorage.getItem('admin_rfid_code');
    
    if (!userId || !rfidCode) {
        console.error('Authentication required. Please log in again.');
        return;
    }

    const response = await fetch(`${lanIP}/api/v1/themes`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-User-ID': userId,
            'X-RFID': rfidCode,
            'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify(themeData)
        // Removed credentials: 'include' to fix CORS issue
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const errorMessage = errorData?.detail || errorData?.message || `HTTP error ${response.status}`;
        console.error('Theme creation failed:', errorMessage);
        return;
    }

    const result = await response.json();
    
    if (!result.theme_id) {
        console.error('Server did not return a valid theme ID');
        return;
    }

    // Success - log the created theme
    console.log(`Theme "${themeData.name}" created successfully with ID: ${result.theme_id}`);
    form.reset();
    
} catch (error) {
    console.error('Theme creation failed:', error.message);
}


    } else if (itemType === 'users') {
        currentEditItem.username = form.querySelector('[name="username"]').value;
        currentEditItem.role = form.querySelector('[name="role"]').value;
    }
    
    // Basic validation
    const requiredFields = Object.entries(currentEditItem).filter(([key]) => 
        key !== 'id' && key !== 'lastActive' && key !== 'questionCount'
    );
    
    for (const [key, value] of requiredFields) {
        if (!value || (typeof value === 'string' && value.trim() === '')) {
            showNotification(`${key.charAt(0).toUpperCase() + key.slice(1)} is required.`, 'error');
            return;
        }
    }
    
    try {
        await saveItem(itemType, currentEditItem);
        hideEditModal();
        loadTabData(currentTab);
        showNotification('Changes saved successfully');
    } catch (error) {
        console.error('Error saving item:', error);
        showNotification('Failed to save changes. Please try again.', 'error');
    }
};

// Enhanced filter function that handles all filters
const filterQuestions = () => {
    if (currentTab === 'questions') {
        loadQuestions();
    }
};

// Enhanced event listeners for filters
const listenToFilters = () => {
    // Search input listener (existing)
    if (domAdmin.searchInput) {
        domAdmin.searchInput.addEventListener('input', filterQuestions);
    }
    
    // Theme filter listener
    if (domAdmin.themeFilter) {
        domAdmin.themeFilter.addEventListener('change', filterQuestions);
    }
    
    // Difficulty filter listener
    if (domAdmin.difficultyFilter) {
        domAdmin.difficultyFilter.addEventListener('change', filterQuestions);
    }
};
// #endregion

// Debounce helper function
const debounce = (func, delay) => {
    let timeoutId;
    return function() {
        const context = this;
        const args = arguments;
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            func.apply(context, args);
        }, delay);
    };
};

// #region ***  Event Listeners - listenTo___            ***********
const listenToTabs = () => {
    domAdmin.tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            showTab(tabId);
        });
    });
};

const listenToLogout = () => {
    if (domAdmin.logoutBtn) {
        domAdmin.logoutBtn.addEventListener('click', () => {
            // Clear ALL session storage data
            sessionStorage.clear();
            console.log('Cleared all sessionStorage and logging out');
            window.location.href = 'login.html';
        });
    }
};

const listenToModal = () => {
    if (domAdmin.closeModal) {
        // Create debounced version with 2-second delay
        const debouncedFilter = debounce(filterQuestions, 500);
        domAdmin.searchInput.addEventListener('input', debouncedFilter);
    }
    
    if (domAdmin.cancelBtn) {
        domAdmin.cancelBtn.addEventListener('click', hideEditModal);
    }
    
    window.addEventListener('click', (event) => {
        if (event.target === domAdmin.editModal) {
            hideEditModal();
        }
    });
};

const listenToSearch = () => {
    if (domAdmin.searchInput) {
        // Create debounced version with 2-second delay
        const debouncedFilter = debounce(filterQuestions, 500);
        domAdmin.searchInput.addEventListener('input', debouncedFilter);
    }
};

const listenToAddButtons = () => {
    const addQuestionBtn = document.querySelector('.js-add-question');
    if (addQuestionBtn) {
        addQuestionBtn.addEventListener('click', () => {
            showEditModal('questions');
        });
    }
    
    const addThemeBtn = document.querySelector('.js-add-theme');
    if (addThemeBtn) {
        addThemeBtn.addEventListener('click', () => {
            showEditModal('themes');
        });
    }
    
    const addUserBtn = document.querySelector('.js-add-user');
    if (addUserBtn) {
        addUserBtn.addEventListener('click', () => {
            showEditModal('users');
        });
    }
};
// #endregion

// #region ***  Init / DOMContentLoaded                  ***********


// Enhanced initAdmin function
const initAdmin = async () => {
    listenToTabs();
    listenToLogout();
    listenToModal();
    listenToFilters(); // Updated to use the new function name
    listenToAddButtons();
    
    // Preload themes at initialization
    try {
        console.log('Preloading themes...');
        state.themes = await fetchThemes();
        console.log('Themes preloaded:', state.themes.length);
    } catch (error) {
        console.error('Failed to preload themes:', error);
        state.themes = [];
    }
    
    // Initialize first tab as active
    if (domAdmin.tabBtns.length > 0) {
        const firstTabId = domAdmin.tabBtns[0].dataset.tab;
        showTab(firstTabId);
    }
};

// Update the DOMContentLoaded listener to handle async initialization
document.addEventListener('DOMContentLoaded', async () => {
    if (window.location.pathname.includes('admin.html')) {
        console.log('Initial state:', state);
        await initAdmin(); // Make sure to await the async initialization
    }
});

// #endregion









// Function to populate the theme filter dropdown
const populateThemeFilter = () => {
    const themeFilter = domAdmin.themeFilter;
    
    if (!themeFilter || !state.themes) return;
    
    // Clear existing options except the first "All Themes" option
    themeFilter.innerHTML = '<option value="">All Themes</option>';
    
    // Add theme options
    state.themes.forEach(theme => {
        const option = document.createElement('option');
        option.value = theme.id;
        option.textContent = theme.name;
        themeFilter.appendChild(option);
    });
};







// Helper function to clear all filters
const clearAllFilters = () => {
    if (domAdmin.searchInput) domAdmin.searchInput.value = '';
    if (domAdmin.themeFilter) domAdmin.themeFilter.value = '';
    if (domAdmin.difficultyFilter) domAdmin.difficultyFilter.value = '';
    filterQuestions();
};

// Optional: Function to get current filter state (useful for debugging)
const getCurrentFilterState = () => {
    return {
        searchTerm: domAdmin.searchInput?.value || '',
        selectedTheme: domAdmin.themeFilter?.value || '',
        selectedDifficulty: domAdmin.difficultyFilter?.value || '',
    };}