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
    // Migration elements
    sourceThemeSelect: document.querySelector('.js-source-theme-select'),
    targetThemeSelect: document.querySelector('.js-target-theme-select'),
    migrateButton: document.querySelector('.js-migrate-questions')
};

let currentForm = null;
// #endregion

// #region ***  Data & State Management                  ***********
let currentEditItem = null;
let currentTab = 'questions';

// Make sure 'lanIP' is correctly defined in your JavaScript, e.g.:
const lanIP = `https://${window.location.hostname}`; // Or your actual server IP/domain

// #endregion

const fetchFreshQuestions = async (activeOnly = false) => {
    const questionsEndpoint = `${lanIP}/api/v1/questions/`;
    const answersBaseEndpoint = `${lanIP}/api/v1/questions/`;
    const themesEndpoint = `${lanIP}/api/v1/themes/`;

    // Step 1: Fetch all questions
    const questionsUrl = activeOnly ? `${questionsEndpoint}?active_only=true` : questionsEndpoint;
    const [questionsResponse, themesResponse] = await Promise.all([
        fetch(questionsUrl),
        fetch(themesEndpoint)
    ]);
    if (!questionsResponse.ok) {
        console.error(`HTTP error fetching questions! Status: ${questionsResponse.status}`);
        return [];
    }
    if (!themesResponse.ok) {
        console.error(`HTTP error fetching themes! Status: ${themesResponse.status}`);
        return [];
    }
    const questions = await questionsResponse.json();
    const themes = await themesResponse.json();

    // Step 2: Create a theme lookup map for quick access
    const themeMap = themes.reduce((map, theme) => {
        map[theme.id] = theme;
        return map;
    }, {});

    // Step 3: Fetch all answers in parallel (batch if possible)
    // If backend supports batch, use it. Otherwise, parallelize per-question
    const answerPromises = questions.map(async (question) => {
        try {
            const answersResponse = await fetch(`${answersBaseEndpoint}${question.id}/answers`);
            if (!answersResponse.ok) {
                console.warn(`HTTP error fetching answers for question ID ${question.id}! Status: ${answersResponse.status}`);
                return [];
            }
            const answersData = await answersResponse.json();
            return answersData.answers || [];
        } catch (error) {
            console.warn(`Failed to fetch answers for question ID ${question.id}:`, error);
            return [];
        }
    });
    const answersList = await Promise.all(answerPromises);

    // Step 4: Assemble questions with answers and themes
    const questionsWithAnswersAndThemes = questions.map((question, idx) => {
        const theme = themeMap[question.themeId] || {
            id: question.themeId,
            name: 'Unknown Theme',
            error: true
        };
        return {
            ...question,
            answers: answersList[idx],
            theme: theme
        };
    });

    console.log('[API Fetch] Successfully fetched new data from API.');

    return questionsWithAnswersAndThemes;
};

const fetchQuestions = async (activeOnly = false) => {
    const CACHE_KEY = `myApp_questionsCache_${activeOnly ? 'active' : 'all'}`;
    const CACHE_DURATION = 60 * 1000; // 1 minute

    try {
        // --- ATTEMPT TO RETURN FROM CACHE FIRST ---
        const cachedDataString = sessionStorage.getItem(CACHE_KEY);
        if (cachedDataString) {
            const { timestamp, data } = JSON.parse(cachedDataString);
            const now = new Date().getTime();
            console.log(`[Cache Hit] Returning data from local cache for key: ${CACHE_KEY}`);
            
            // Schedule background update if cache is outdated
            if (now - timestamp >= CACHE_DURATION) {
                console.log(`[Cache Background Update] Cache is stale, fetching fresh data in background for key: ${CACHE_KEY}`);
                fetchFreshQuestions(activeOnly).then(freshData => {
                    const dataToCache = {
                        timestamp: new Date().getTime(),
                        data: freshData
                    };
                    sessionStorage.setItem(CACHE_KEY, JSON.stringify(dataToCache));
                    console.log(`[Cache Update] New data saved to local cache for key: ${CACHE_KEY}`);
                    // Update state and refresh UI if on questions tab
                    state.questions = freshData;
                    if (currentTab === 'questions') {
                        loadQuestions();
                    }
                }).catch(err => console.error('Background fetch failed:', err));
            }
            
            return data;
        } else {
            console.log(`[Cache Miss] No data found in local cache for key: ${CACHE_KEY}. Fetching new data...`);
        }

        // --- IF WE REACH THIS POINT, IT MEANS CACHE IS INVALID OR NON-EXISTENT. ---
        // --- PROCEED WITH API CALLS. ---
        const freshData = await fetchFreshQuestions(activeOnly);

        // Step 5: Save the newly fetched data to local cache with a timestamp
        const dataToCache = {
            timestamp: new Date().getTime(),
            data: freshData
        };
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(dataToCache));
        console.log(`[Cache Update] New data saved to local cache for key: ${CACHE_KEY}`);

        return freshData;

    } catch (error) {
        console.error('Failed to fetch questions, answers, or themes:', error);
        // if fetching fails, you might want to return the stale cache if available
        const cachedDataString = sessionStorage.getItem(CACHE_KEY);
        if (cachedDataString) {
            const { data } = JSON.parse(cachedDataString);
            console.warn('Returning stale data due to fetch error:', data);
            return data;
        }
        return [];
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

const fetchUsers = async () => {
    // Use the new endpoint with IP information
    const url = `${lanIP}/api/v1/users/`; // or `/api/v1/users/with-ip/` if you want the separate endpoint
    console.log("Attempting to fetch users from:", url);
    
    try {
        // Get authentication headers like other functions
        const userId = sessionStorage.getItem('admin_user_id');
        const rfidCode = sessionStorage.getItem('admin_rfid_code');
        
        const headers = {
            'Accept': 'application/json',
        };
        
        // Add auth headers if available
        if (userId && rfidCode) {
            headers['X-User-ID'] = userId;
            headers['X-RFID'] = rfidCode;
        }
        
        const response = await fetch(url, {
            method: 'GET',
            mode: 'cors',
            credentials: 'omit',
            headers: headers,
        });
        
        console.log("Response status for users:", response.status);
        console.log("Response headers for users:", Array.from(response.headers.entries()));
        
        if (!response.ok) {
            // Handle authentication errors specifically
            if (response.status === 401) {
                console.warn('Authentication failed for users endpoint. Redirecting to login...');
                sessionStorage.clear();
                window.location.href = '/pages/login/';
                return [];
            }
            
            if (response.status === 403) {
                console.warn('Admin access required for IP information. Falling back to basic user info.');
                // Fall back to basic user info without IP addresses
                return await fetchUsersBasic();
            }
            
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
        
        // Check if users have IP addresses
        users.forEach(user => {
            console.log(`User ${user.first_name} ${user.last_name} (ID: ${user.id}, Role: ${user.userRoleId}):`);
            if (user.ip_addresses) {
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
            } else {
                console.log(`  No IP addresses available`);
            }
        });
        
        return users;
    } catch (error) {
        console.error("Critical Error in fetchUsers:", error);
        const finalError = new Error(`Failed to fetch users from ${url}. Original error: ${error.message}`);
        throw finalError;
    }
};

// Fetch stories list for Stories tab and story filters (renamed to avoid collision with articles.js)
const fetchStoriesAdmin = async () => {
    const url = `${lanIP}/api/v1/stories/`;
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return Array.isArray(data) ? data : [];
    } catch (err) {
        console.error('Failed to fetch stories:', err);
        return [];
    }
};

// Create story if not exists
const createStoryIfNotExists = async (name, description = '', slug = '') => {
    const url = `${lanIP}/api/v1/stories/create-if-not-exists`;
    const payload = { name, description };
    if (slug && typeof slug === 'string') payload.slug = slug;
    
    // Get authentication headers
    const userId = sessionStorage.getItem('admin_user_id');
    const rfidCode = sessionStorage.getItem('admin_rfid_code');
    
    const headers = { 'Content-Type': 'application/json' };
    if (userId && rfidCode) {
        headers['X-User-ID'] = userId;
        headers['X-RFID'] = rfidCode;
    }
    
    const res = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload)
    });
    if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`Failed to create story: HTTP ${res.status} ${txt}`);
    }
    return res.json();
};

// Fallback function to fetch basic user info without IP addresses
const fetchUsersBasic = async () => {
    const url = `${lanIP}/api/v1/users/basic/`;
    console.log("Fetching basic user info from:", url);
    
    try {
        // Get authentication headers like other functions
        const userId = sessionStorage.getItem('admin_user_id');
        const rfidCode = sessionStorage.getItem('admin_rfid_code');
        
        const headers = {
            'Accept': 'application/json',
        };
        
        // Add auth headers if available
        if (userId && rfidCode) {
            headers['X-User-ID'] = userId;
            headers['X-RFID'] = rfidCode;
        }
        
        const response = await fetch(url, {
            method: 'GET',
            mode: 'cors',
            credentials: 'omit',
            headers: headers,
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                console.warn('Authentication failed for basic users endpoint. Redirecting to login...');
                sessionStorage.clear();
                window.location.href = '/pages/login/';
                return [];
            }
            
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
        console.log("Successfully fetched basic users:", users);
        
        return users;
    } catch (error) {
        console.error("Error fetching basic users:", error);
        throw error;
    }
};

// Example function to display user IP information in your UI
const displayUserIpInfo = (user) => {
    console.log(`displayUserIpInfo called for user ${user.first_name} ${user.last_name} (ID: ${user.id})`);
    console.log(`User has ip_addresses:`, user.ip_addresses);
    
    if (!user.ip_addresses || !Array.isArray(user.ip_addresses)) {
        console.log(`No IP addresses available, returning 'Access restricted'`);
        return 'Access restricted';
    }

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

    console.log(`Returning IP info:`, ipInfo);
    return ipInfo || 'No IP addresses recorded';
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






const saveItem = async (itemType, item) => {
    if (itemType === 'questions') {
        // Question updates are handled by updateQuestion() directly
        return await updateQuestion(item);
    } else if (itemType === 'themes') {
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
                showNotification('Access denied. Only admins can delete themes.', 'error');
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
    
    // If switching to themes tab, set up migration listeners
    if (tabId === 'themes') {
        // Use a small delay to ensure DOM is ready
        setTimeout(() => {
            listenToMigration();
            populateMigrationDropdowns();
            updateMigrationButtonState();
        }, 100);
    }
    
    // Load data for the selected tab
    loadTabData(tabId);
};

const showEditModal = async (itemType, item = null) => {
    const modal = domAdmin.editModal;
    const modalTitle = modal.querySelector('.c-modal-title');
    const form = modal.querySelector('.c-edit-form');
    
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
    
    // Uses module-scope generateAnswersHTML (with answer_text / is_correct property names)

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
    <select name="userRoleId" class="c-form-select">
        <!-- numeric values must correspond to the database table (1=Admin,2=Moderator,3=User) -->
        <option value="1" ${item && item.userRoleId === 1 ? 'selected' : ''}>Admin</option>
        <option value="2" ${item && item.userRoleId === 2 ? 'selected' : ''}>Moderator</option>
        <option value="3" ${item && item.userRoleId === 3 ? 'selected' : ''}>User</option>
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
        <button type="button" class="c-btn c-btn--primary js-ban-ip-btn" onclick="banIpAddress()">Ban IP Address</button>
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
                showNotification('Please select an IP address to ban', 'error');
                return;
            }

            if (!banReasonTextarea.value.trim()) {
                showNotification('Please enter a ban reason', 'error');
                return;
            }

            const banDurationValue = parseInt(banDurationValueInput.value);
            if (banDurationValue < 1) {
                showNotification('Ban duration must be at least 1', 'error');
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
                showNotification('Admin credentials not found. Please log in again.', 'error');
                return;
            }

            try {
                // Get the button element
                const banButton = document.querySelector('.js-ban-ip-btn');
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
                showNotification(`IP address ${banData.ip_address} has been banned successfully!`, 'success');
                console.log('Ban result:', result);
                
                // Optionally refresh the user data or close the form
                // You might want to call your refresh function here
                
            } catch (error) {
                console.error('Error banning IP address:', error);
                showNotification(`Failed to ban IP address: ${error.message}`, 'error');
            } finally {
                // Re-enable button
                const banButton = document.querySelector('.js-ban-ip-btn');
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
    
    // Apply theme to the modal content
    if (window.themeManager) {
        window.themeManager.applyThemeToNewElements(modal);
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
    // Create a custom modal instead of using browser confirm()
    const modal = document.createElement('div');
    modal.className = 'c-modal';
    modal.style.display = 'flex';
    
    modal.innerHTML = `
        <div class="c-modal__content c-modal__content--confirm">
            <h3 class="c-modal-title">Confirm Action</h3>
            <p class="c-confirm-message"></p>
            <div class="c-form-actions">
                <button class="c-btn c-btn--cancel c-confirm-cancel">Cancel</button>
                <button class="c-btn c-btn--delete c-confirm-ok">Confirm</button>
            </div>
        </div>
    `;
    modal.querySelector('.c-confirm-message').textContent = message;
    
    document.body.appendChild(modal);
    
    // Handle button clicks
    const cancelBtn = modal.querySelector('.c-confirm-cancel');
    const okBtn = modal.querySelector('.c-confirm-ok');
    
    const cleanup = () => {
        document.body.removeChild(modal);
    };
    
    cancelBtn.addEventListener('click', cleanup);
    okBtn.addEventListener('click', () => {
        cleanup();
        onConfirm();
    });
    
    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            cleanup();
        }
    });
};

const showNotification = (message, type = 'success') => {
    const notification = document.createElement('div');
    notification.className = `c-notification c-notification--${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Apply theme to notification
    if (window.themeManager) {
        window.themeManager.applyThemeToNewElements(notification);
    }
    
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

// Expose shared helpers/globals for other scripts (e.g., articles.js)
try {
    window.hideEditModal = hideEditModal;
    window.showNotification = showNotification;
    window.showConfirmDialog = showConfirmDialog;
    window.domAdmin = domAdmin;
} catch (e) {
    // no-op if window is not available
}
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
        case 'stories':
            if (typeof loadStoriesTab === 'function') {
                await loadStoriesTab();
            }
            break;
        case 'articles':
            if (typeof loadArticles === 'function') {
                await loadArticles();
            }
            break;
        case 'users':
            await loadUsers();
            break;
        case 'community':
            if (typeof loadCommunityTab === 'function') {
                await loadCommunityTab();
            }
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
        
        // Apply theme to newly created elements
        if (window.themeManager) {
            window.themeManager.applyThemeToNewElements(questionList);
        }
        
        // Add event delegation for better performance (remove first to prevent duplicates)
        questionList.removeEventListener('click', handleQuestionActions);
        questionList.removeEventListener('change', handleQuestionFieldChanges);
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

    // Apply theme to this newly created element
    if (window.themeManager) {
        window.themeManager.applyThemeToNewElements(element);
    }

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
        
        // Apply theme to newly generated answer elements
        if (window.themeManager) {
            window.themeManager.applyThemeToNewElements(answerList);
        }        // Update question data
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
        question.explanation = target.value;
        updateQuestion(question);
    }
    
    // Handle question text changes
    if (target.classList.contains('c-question-text-edit')) {
        question.question_text = target.value;
        updateQuestion(question);
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
                    <div class="c-theme-name">${escapeHTML(theme.name)}</div>
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
        
        // Update state and populate migration dropdowns
        state.themes = themes;
        populateMigrationDropdowns();
        updateMigrationButtonState();
        
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
                    <td colspan="6" class="c-empty-state">No users found.</td>
                </tr>
            `;
            return;
        }

        userTableBody.innerHTML = users.map(user => {
            // Map userRoleId to a displayable role name
            const roleName = getRoleName(user.userRoleId);
            const lastActiveDisplay = user.last_active ? new Date(user.last_active).toLocaleString() : 'Never';
            const displayName = escapeHTML(`${user.first_name} ${user.last_name}`);
            
            // Check if user has IP addresses (admin access)
            const hasIpInfo = user.ip_addresses && user.ip_addresses.length > 0;
            const ipInfo = hasIpInfo ? escapeHTML(displayUserIpInfo(user)) : 'no ip';
            
            return `
                <tr data-id="${user.id}">
                    <td>
                        <button class="c-btn c-btn--delete js-delete-user">
                            <span>Delete</span>
                        </button>
                    </td>
                    <td data-label="Username">${displayName}</td>
                    <td data-label="IP Addresses">${ipInfo}</td>
                    <td data-label="Role">
                        <span class="c-tag c-tag--role c-tag--${roleName.toLowerCase()}">${roleName}</span>
                    </td>
                    <td data-label="Last Active">${lastActiveDisplay}</td>
                    <td>
                        <button class="c-btn c-btn--edit js-edit-user">
                            <span>Edit</span>
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
                
                // Prevent deletion of admin users (role 3)
                if (user && user.userRoleId === 3) {
                    showNotification('Cannot delete admin users for security reasons.', 'error');
                    return;
                }
                
                showConfirmDialog('Are you sure you want to delete this user?', async () => {
                    await deleteItem('users', id);
                    loadUsers(); // Reload users after deletion
                    showNotification('User deleted successfully');
                });
            });
        });

    } catch (error) {
        console.error('Error loading users:', error);
        showNotification('Failed to load users. Please check your connection.', 'error');
        userTableBody.innerHTML = `
            <tr>
                <td colspan="6" class="c-error-state">Failed to load users. Please try again.</td>
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
        case 2: return 'Moderator';
        case 1: return 'User';
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
    showNotification("Question created successfully!", 'success');
} catch (error) {
    console.error("Submission failed:", error);
    showNotification(`Error: ${error.message}`, 'error');
}

}else if (itemType === 'themes') {

const form = currentForm;
const formData = new FormData(form);

// Validate and sanitize form data
const themeName = formData.get('name')?.toString().trim();
if (!themeName || themeName.length < 3) {
    showNotification('Theme name must be at least 3 characters long', 'error');
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
        showNotification('Authentication required. Please log in again.', 'error');
        return;
    }

    const isEditing = currentEditItem && currentEditItem.id;
    const url = isEditing ? `${lanIP}/api/v1/themes/${currentEditItem.id}` : `${lanIP}/api/v1/themes`;
    const method = isEditing ? 'PATCH' : 'POST';

    const response = await fetch(url, {
        method: method,
        headers: {
            'Content-Type': 'application/json',
            'X-User-ID': userId,
            'X-RFID': rfidCode,
            'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify(themeData)
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const errorMessage = errorData?.detail || errorData?.message || `HTTP error ${response.status}`;
        showNotification(`Theme save failed: ${errorMessage}`, 'error');
        return;
    }

    const result = await response.json();
    
    if (!result.theme_id) {
        showNotification('Server did not return a valid theme ID', 'error');
        return;
    }

    // Success
    showNotification(isEditing ? 'Theme updated successfully!' : 'Theme created successfully!', 'success');
    hideEditModal();
    loadTabData(currentTab);
    return;
    
} catch (error) {
    showNotification(`Theme save failed: ${error.message}`, 'error');
    return;
}


    } else if (itemType === 'users') {
        currentEditItem.username = form.querySelector('[name="username"]').value;
        // read numeric role id instead of string name
        const roleVal = form.querySelector('[name="userRoleId"]').value;
        currentEditItem.userRoleId = roleVal ? parseInt(roleVal, 10) : null;
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
    // Search input listener with debounce to avoid excessive DOM rebuilds
    if (domAdmin.searchInput) {
        domAdmin.searchInput.addEventListener('input', debounce(filterQuestions, 300));
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
            localStorage.clear(); // Also clear localStorage to remove cache
            console.log('Cleared all sessionStorage and localStorage, logging out');
            
            // Redirect to login page
            window.location.href = '/pages/login/';
        });
    }
};

const listenToModal = () => {
    if (domAdmin.closeModal) {
        domAdmin.closeModal.addEventListener('click', hideEditModal);
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

    // Articles functionality is handled in articles.js
    // The articles tab will be initialized when that script loads
};

let _migrationListenersAttached = false;

const listenToMigration = () => {
    // Guard against duplicate initialization (called on every Themes tab switch)
    if (_migrationListenersAttached) return;
    _migrationListenersAttached = true;

    // Migration dropdown change listeners
    const sourceSelect = document.querySelector('.js-source-theme-select');
    const targetSelect = document.querySelector('.js-target-theme-select');
    const migrateButton = document.querySelector('.js-migrate-questions');
    
    if (sourceSelect) {
        sourceSelect.addEventListener('change', () => {
            updateMigrationButtonState();
        });
    }
    
    if (targetSelect) {
        targetSelect.addEventListener('change', () => {
            updateMigrationButtonState();
        });
    }
    
    if (migrateButton) {
        migrateButton.addEventListener('click', handleMigrationClick);
    } else {
        console.warn('Migration button not found during listener setup');
    }
};

// #endregion

// #region ***  Init / DOMContentLoaded                  ***********


// Enhanced initAdmin function
const initAdmin = async () => {
    // Check authentication first
    const userId = sessionStorage.getItem('admin_user_id');
    const rfidCode = sessionStorage.getItem('admin_rfid_code');
    
    if (!userId || !rfidCode) {
        console.warn('No admin credentials found. Redirecting to login...');
        window.location.href = '/pages/login/';
        return;
    }
    
    listenToTabs();
    listenToLogout();
    listenToModal();
    listenToFilters(); // Updated to use the new function name
    listenToAddButtons();
    
    // Initialize articles functionality if available
    if (typeof listenToArticles === 'function') {
        listenToArticles();
        console.log('Articles functionality initialized');
    }
    
    // Preload themes at initialization
    try {
        console.log('Preloading themes...');
        state.themes = await fetchThemes();
        console.log('Themes preloaded:', state.themes.length);
    } catch (error) {
        console.error('Failed to preload themes:', error);
        showNotification('Failed to load themes. Some features may not work correctly.', 'error');
        state.themes = [];
    }
    
    // Initialize first tab as active
    if (domAdmin.tabBtns.length > 0) {
        const firstTabId = domAdmin.tabBtns[0].dataset.tab;
        showTab(firstTabId);
    }
};

// Add global error handler to catch unhandled errors
window.addEventListener('error', (event) => {
    console.error('Unhandled error:', event.error);
    showNotification('An unexpected error occurred. Please refresh the page.', 'error');
});

// Add unhandled promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    showNotification('An unexpected error occurred. Please refresh the page.', 'error');
    event.preventDefault(); // Prevent the default action (logging to console)
});

// Update the DOMContentLoaded listener to handle async initialization
document.addEventListener('DOMContentLoaded', async () => {
    if (window.location.pathname.startsWith('/pages/admin')) {
        console.log('Initial state:', state);
        try {
            await initAdmin(); // Make sure to await the async initialization
        } catch (error) {
            console.error('Failed to initialize admin:', error);
            showNotification('Failed to initialize admin panel. Please refresh the page.', 'error');
        }
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
    };
};

// #region ***  Migration Functions                      ***********

/**
 * Populate the migration theme dropdowns
 */
const populateMigrationDropdowns = () => {
    const sourceSelect = document.querySelector('.js-source-theme-select');
    const targetSelect = document.querySelector('.js-target-theme-select');
    
    console.log('Populating migration dropdowns:', {
        sourceSelect: !!sourceSelect,
        targetSelect: !!targetSelect,
        themes: state.themes?.length || 0
    });
    
    if (!sourceSelect || !targetSelect || !state.themes) {
        console.warn('Cannot populate dropdowns:', {
            sourceSelect: !!sourceSelect,
            targetSelect: !!targetSelect,
            themes: !!state.themes
        });
        return;
    }
    
    // Clear existing options (except the first placeholder)
    sourceSelect.innerHTML = '<option value="">Select source theme...</option>';
    targetSelect.innerHTML = '<option value="">Select target theme...</option>';
    
    // Add themes to both dropdowns
    state.themes.forEach(theme => {
        const sourceOption = new Option(`${theme.name} (${theme.questionCount || 0} questions)`, theme.id);
        const targetOption = new Option(theme.name, theme.id);
        
        sourceSelect.appendChild(sourceOption);
        targetSelect.appendChild(targetOption);
    });
    
    console.log('Migration dropdowns populated with', state.themes.length, 'themes');
};

/**
 * Update migration button state based on dropdown selections
 */
const updateMigrationButtonState = () => {
    const sourceSelect = document.querySelector('.js-source-theme-select');
    const targetSelect = document.querySelector('.js-target-theme-select');
    const migrateButton = document.querySelector('.js-migrate-questions');
    const migrationInfo = document.querySelector('.js-migration-info');
    
    // Debug logging
    console.log('Migration Debug:', {
        sourceSelect: !!sourceSelect,
        targetSelect: !!targetSelect,
        migrateButton: !!migrateButton,
        migrationInfo: !!migrationInfo,
        sourceValue: sourceSelect?.value,
        targetValue: targetSelect?.value,
        themes: state.themes?.length || 0
    });
    
    if (!sourceSelect || !targetSelect || !migrateButton) {
        console.warn('Essential migration elements not found:', {
            sourceSelect: !!sourceSelect,
            targetSelect: !!targetSelect, 
            migrateButton: !!migrateButton,
            migrationInfo: !!migrationInfo
        });
        return;
    }
    
    const sourceValue = sourceSelect.value;
    const targetValue = targetSelect.value;
    
    // Check if both are selected and different
    const canMigrate = sourceValue && targetValue && sourceValue !== targetValue;
    
    migrateButton.disabled = !canMigrate;
    
    // Update migration info if element exists
    if (migrationInfo) {
        if (!sourceValue || !targetValue) {
            migrationInfo.textContent = 'Select both source and target themes to enable migration';
            migrationInfo.className = 'c-migration-info';
        } else if (sourceValue === targetValue) {
            migrationInfo.textContent = 'Source and target themes must be different';
            migrationInfo.className = 'c-migration-info c-migration-info--error';
        } else {
            const sourceTheme = state.themes.find(t => t.id == sourceValue);
            const targetTheme = state.themes.find(t => t.id == targetValue);
            const questionCount = sourceTheme?.questionCount || 0;
            
            if (questionCount === 0) {
                migrationInfo.textContent = `Source theme "${sourceTheme?.name}" has no questions to migrate`;
                migrationInfo.className = 'c-migration-info c-migration-info--warning';
                migrateButton.disabled = true;
            } else {
                migrationInfo.textContent = `Ready to migrate ${questionCount} question${questionCount !== 1 ? 's' : ''} from "${sourceTheme?.name}" to "${targetTheme?.name}"`;
                migrationInfo.className = 'c-migration-info c-migration-info--ready';
            }
        }
    }
};

/**
 * Perform the migration API call
 */
const migrateQuestionsToTheme = async (sourceThemeId, targetThemeId) => {
    try {
        const userId = sessionStorage.getItem('admin_user_id');
        const rfidCode = sessionStorage.getItem('admin_rfid_code');
        
        if (!userId || !rfidCode) {
            throw new Error('Authentication required. Please log in again.');
        }
        
        const response = await fetch(`${lanIP}/api/v1/themes/${sourceThemeId}/migrate-to/${targetThemeId}`, {
            method: 'POST',
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
            
            const errorMessage = errorData.detail || errorData.message || `HTTP error! status: ${response.status}`;
            throw new Error(errorMessage);
        }
        
        const result = await response.json();
        console.log('Migration successful:', result);
        
        // Show success notification
        showNotification(`Successfully migrated ${result.migrated_count} questions from "${result.source_theme.name}" to "${result.target_theme.name}"`, 'success');
        
        return result;
        
    } catch (error) {
        console.error('Migration failed:', error);
        
        // Handle specific error cases
        if (error.message.includes('403')) {
            showNotification('Access denied. Only admins can migrate questions.', 'error');
        } else if (error.message.includes('404')) {
            showNotification('Theme not found. Please refresh and try again.', 'error');
        } else if (error.message.includes('400')) {
            showNotification(error.message, 'error');
        } else {
            showNotification(`Failed to migrate questions: ${error.message}`, 'error');
        }
        
        throw error;
    }
};

/**
 * Handle migration button click with confirmation
 */
const handleMigrationClick = async () => {
    const sourceSelect = document.querySelector('.js-source-theme-select');
    const targetSelect = document.querySelector('.js-target-theme-select');
    
    if (!sourceSelect || !targetSelect) return;
    
    const sourceThemeId = parseInt(sourceSelect.value);
    const targetThemeId = parseInt(targetSelect.value);
    
    const sourceTheme = state.themes.find(t => t.id === sourceThemeId);
    const targetTheme = state.themes.find(t => t.id === targetThemeId);
    
    if (!sourceTheme || !targetTheme) {
        showNotification('Invalid theme selection. Please try again.', 'error');
        return;
    }
    
    // Confirmation dialog
    const questionCount = sourceTheme.questionCount || 0;
    const confirmMessage = `Are you sure you want to migrate ${questionCount} question${questionCount !== 1 ? 's' : ''} from "${sourceTheme.name}" to "${targetTheme.name}"? This action cannot be undone.`;
    
    showConfirmDialog(confirmMessage, async () => {
        // Disable button during migration
        const migrateButton = document.querySelector('.js-migrate-questions');
        if (migrateButton) {
            migrateButton.disabled = true;
            migrateButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Migrating...';
        }
        
        try {
            await migrateQuestionsToTheme(sourceThemeId, targetThemeId);
            
            // Refresh data after successful migration
            await loadTabData('themes');
            await loadTabData('questions');
            
            // Reset form
            sourceSelect.value = '';
            targetSelect.value = '';
            updateMigrationButtonState();
            
        } catch (error) {
            // Error already handled in migrateQuestionsToTheme
        } finally {
            // Re-enable button
            if (migrateButton) {
                migrateButton.disabled = false;
                migrateButton.innerHTML = '<i class="fas fa-arrows-alt-h"></i> Migrate All Questions';
            }
        }
    });
};

// #endregion

// #region ***  Stories Initialization                   ***********
// Initialize story filter dropdown when DOM is ready
window.addEventListener('DOMContentLoaded', async () => {
  try {
    const storyFilter = document.querySelector('.js-story-filter');
        if (storyFilter) {
            const stories = await fetchStoriesAdmin();
      storyFilter.innerHTML = '<option value="">All Stories</option>' +
        stories.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
      storyFilter.addEventListener('change', async (e) => {
        if (window.articlesState) {
          window.articlesState.filters.storyId = e.target.value;
        }
        if (typeof loadArticles === 'function') {
          await loadArticles();
        }
      });
    }
  } catch (e) {
    console.warn('Failed to initialize story filter:', e);
  }
});

// Basic Stories tab loader: lists stories and, when clicked, shows their ordered articles
async function loadStoriesTab() {
  const container = document.querySelector('.c-story-list');
  if (!container) return;
    container.innerHTML = '<div class="c-loading">Loading stories...</div>';
  try {
    const stories = await fetchStoriesAdmin();
    if (!stories || stories.length === 0) {
            container.innerHTML = `
                <div class="c-admin-header" style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:12px;">
                    <h2 class="c-admin-title" style="margin:0;">Stories</h2>
                    <button class="c-btn c-btn--primary js-create-story"><i class="fas fa-plus"></i> Create Story</button>
                </div>
                <div class="c-empty-state"><i class="fas fa-book-open"></i><h3>No stories yet</h3><p>Create a story to start grouping articles.</p></div>
            `;
            const createBtn = container.querySelector('.js-create-story');
            if (createBtn) {
                createBtn.addEventListener('click', () => {
                    const overlay = document.createElement('div');
                    overlay.className = 'c-modal-overlay c-modal-overlay--active';
                    overlay.innerHTML = `
                      <div class="c-modal c-modal--sm">
                        <div class="c-modal__header">
                          <h2 class="c-modal__title"><i class="fas fa-plus"></i> Create Story</h2>
                          <button class="c-modal__close js-close-create-story">&times;</button>
                        </div>
                        <div class="c-modal__body">
                          <div class="c-form-group">
                            <label class="c-form-label" for="create-story-name">Name <span style="color:var(--admin-danger)">*</span></label>
                            <input class="c-form-input" type="text" id="create-story-name" placeholder="Enter story name" maxlength="200" />
                          </div>
                          <div class="c-form-group">
                            <label class="c-form-label" for="create-story-desc">Description</label>
                            <textarea class="c-form-input" id="create-story-desc" rows="4" placeholder="Optional description" maxlength="2000"></textarea>
                          </div>
                        </div>
                        <div class="c-modal__footer">
                          <button class="c-btn c-btn--sm c-btn--secondary js-close-create-story">Cancel</button>
                          <button class="c-btn c-btn--sm c-btn--primary js-save-create-story">Create Story</button>
                        </div>
                      </div>
                    `;
                    document.body.appendChild(overlay);

                    const closeModal = () => overlay.remove();
                    overlay.querySelectorAll('.js-close-create-story').forEach(b => b.addEventListener('click', closeModal));
                    overlay.addEventListener('click', (ev) => { if (ev.target === overlay) closeModal(); });

                    const nameInput = overlay.querySelector('#create-story-name');
                    if (nameInput) nameInput.focus();

                    overlay.querySelector('.js-save-create-story').addEventListener('click', async () => {
                        const name = overlay.querySelector('#create-story-name').value.trim();
                        const description = overlay.querySelector('#create-story-desc').value.trim();
                        if (!name) { showNotification('Story name is required', 'error'); return; }
                        try {
                            const result = await createStoryIfNotExists(name, description);
                            closeModal();
                            showNotification(result.created ? 'Story created' : 'Story already existed', 'success');
                            await loadStoriesTab();
                        } catch (e) {
                            console.error(e);
                            showNotification(e.message || 'Failed to create story', 'error');
                        }
                    });
                });
            }
      return;
    }
        container.innerHTML = `
            <div class="c-admin-header" style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:12px;">
                <h2 class="c-admin-title" style="margin:0;">Stories</h2>
                <button class="c-btn c-btn--primary js-create-story"><i class="fas fa-plus"></i> Create Story</button>
            </div>
      <div class="c-stories-grid">
        ${stories.map(s => `
          <div class="c-story-card" data-story-id="${s.id}">
            <div class="c-story-card__header">
              <h3 class="c-story-card__title">${escapeHTML(s.name)}</h3>
            </div>
            <div class="c-story-card__body">
              <div class="c-story-card__desc">${escapeHTML(s.description || '')}</div>
              <div class="c-story-card__actions">
                <button class="c-btn c-btn--sm c-btn--primary js-view-story" data-id="${s.id}">
                  <i class="fas fa-list-ol"></i> View Articles
                </button>
                <button class="c-btn c-btn--sm c-btn--edit js-edit-story" data-id="${s.id}" data-name="${escapeHTML(s.name)}" data-desc="${escapeHTML(s.description || '')}">
                  <i class="fas fa-pen"></i> Edit
                </button>
                <button class="c-btn c-btn--sm c-btn--danger js-delete-story" data-id="${s.id}" data-name="${escapeHTML(s.name)}">
                  <i class="fas fa-trash"></i> Delete
                </button>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
      <div class="c-story-articles js-story-articles" style="margin-top:16px;">
        <div class="c-empty-state" style="padding:2rem;">
          <i class="fas fa-hand-pointer" style="font-size:1.5rem;opacity:0.4;margin-bottom:0.5rem;"></i>
          <p>Click "View Articles" on a story to see its articles here.</p>
        </div>
      </div>
    `;

        // Hook up Create Story button
        const createBtn = container.querySelector('.js-create-story');
        if (createBtn) {
            createBtn.addEventListener('click', () => {
                const overlay = document.createElement('div');
                overlay.className = 'c-modal-overlay c-modal-overlay--active';
                overlay.innerHTML = `
                  <div class="c-modal c-modal--sm">
                    <div class="c-modal__header">
                      <h2 class="c-modal__title"><i class="fas fa-plus"></i> Create Story</h2>
                      <button class="c-modal__close js-close-create-story">&times;</button>
                    </div>
                    <div class="c-modal__body">
                      <div class="c-form-group">
                        <label class="c-form-label" for="create-story-name">Name <span style="color:var(--admin-danger)">*</span></label>
                        <input class="c-form-input" type="text" id="create-story-name" placeholder="Enter story name" maxlength="200" />
                      </div>
                      <div class="c-form-group">
                        <label class="c-form-label" for="create-story-desc">Description</label>
                        <textarea class="c-form-input" id="create-story-desc" rows="4" placeholder="Optional description" maxlength="2000"></textarea>
                      </div>
                    </div>
                    <div class="c-modal__footer">
                      <button class="c-btn c-btn--sm c-btn--secondary js-close-create-story">Cancel</button>
                      <button class="c-btn c-btn--sm c-btn--primary js-save-create-story">Create Story</button>
                    </div>
                  </div>
                `;
                document.body.appendChild(overlay);

                const closeModal = () => overlay.remove();
                overlay.querySelectorAll('.js-close-create-story').forEach(b => b.addEventListener('click', closeModal));
                overlay.addEventListener('click', (ev) => { if (ev.target === overlay) closeModal(); });

                // Auto-focus the name input
                const nameInput = overlay.querySelector('#create-story-name');
                if (nameInput) nameInput.focus();

                overlay.querySelector('.js-save-create-story').addEventListener('click', async () => {
                    const name = overlay.querySelector('#create-story-name').value.trim();
                    const description = overlay.querySelector('#create-story-desc').value.trim();
                    if (!name) { showNotification('Story name is required', 'error'); return; }
                    try {
                        const result = await createStoryIfNotExists(name, description);
                        closeModal();
                        showNotification(result.created ? 'Story created' : 'Story already existed', 'success');
                        await loadStoriesTab();
                    } catch (e) {
                        console.error(e);
                        showNotification(e.message || 'Failed to create story', 'error');
                    }
                });
            });
        }

    // Delete story buttons
    container.querySelectorAll('.js-delete-story').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const storyId = e.currentTarget.getAttribute('data-id');
            const storyName = e.currentTarget.getAttribute('data-name');
            if (!storyId) return;
            showConfirmDialog(
                `Delete story "${storyName}"? Articles within the story will NOT be deleted.`,
                async () => {
                    try {
                        const userId = sessionStorage.getItem('admin_user_id');
                        const rfidCode = sessionStorage.getItem('admin_rfid_code');
                        const headers = { 'Accept': 'application/json' };
                        if (userId && rfidCode) { headers['X-User-ID'] = userId; headers['X-RFID'] = rfidCode; }
                        const res = await fetch(`${lanIP}/api/v1/stories/${encodeURIComponent(storyId)}`, { method: 'DELETE', headers });
                        if (!res.ok) {
                            const data = await res.json().catch(() => null);
                            throw new Error(data?.detail || `HTTP ${res.status}`);
                        }
                        showNotification('Story deleted', 'success');
                        await loadStoriesTab();
                    } catch (err) {
                        console.error('Failed to delete story:', err);
                        showNotification(err.message || 'Failed to delete story', 'error');
                    }
                }
            );
        });
    });

    // Edit story buttons
    container.querySelectorAll('.js-edit-story').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const storyId = e.currentTarget.getAttribute('data-id');
            const currentName = e.currentTarget.getAttribute('data-name');
            const currentDesc = e.currentTarget.getAttribute('data-desc');
            if (!storyId) return;

            // Show edit modal
            const overlay = document.createElement('div');
            overlay.className = 'c-modal-overlay c-modal-overlay--active';
            overlay.innerHTML = `
              <div class="c-modal c-modal--sm">
                <div class="c-modal__header">
                  <h2 class="c-modal__title"><i class="fas fa-pen"></i> Edit Story</h2>
                  <button class="c-modal__close js-close-edit-story">&times;</button>
                </div>
                <div class="c-modal__body">
                  <div class="c-form-group">
                    <label class="c-form-label" for="edit-story-name">Name</label>
                    <input class="c-form-input" type="text" id="edit-story-name" maxlength="200" />
                  </div>
                  <div class="c-form-group">
                    <label class="c-form-label" for="edit-story-desc">Description</label>
                    <textarea class="c-form-input" id="edit-story-desc" rows="4" maxlength="2000"></textarea>
                  </div>
                </div>
                <div class="c-modal__footer">
                  <button class="c-btn c-btn--sm c-btn--secondary js-close-edit-story">Cancel</button>
                  <button class="c-btn c-btn--sm c-btn--primary js-save-edit-story">Save Changes</button>
                </div>
              </div>
            `;
            document.body.appendChild(overlay);

            // Set values safely via DOM (avoids HTML injection from special chars)
            overlay.querySelector('#edit-story-name').value = currentName || '';
            overlay.querySelector('#edit-story-desc').value = currentDesc || '';

            const closeModal = () => overlay.remove();
            overlay.querySelectorAll('.js-close-edit-story').forEach(b => b.addEventListener('click', closeModal));
            overlay.addEventListener('click', (ev) => { if (ev.target === overlay) closeModal(); });

            overlay.querySelector('.js-save-edit-story').addEventListener('click', async () => {
                const newName = overlay.querySelector('#edit-story-name').value.trim();
                const newDesc = overlay.querySelector('#edit-story-desc').value.trim();
                if (!newName) { showNotification('Story name cannot be empty', 'error'); return; }
                try {
                    const userId = sessionStorage.getItem('admin_user_id');
                    const rfidCode = sessionStorage.getItem('admin_rfid_code');
                    const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
                    if (userId && rfidCode) { headers['X-User-ID'] = userId; headers['X-RFID'] = rfidCode; }
                    const res = await fetch(`${lanIP}/api/v1/stories/${encodeURIComponent(storyId)}`, {
                        method: 'PUT',
                        headers,
                        body: JSON.stringify({ name: newName, description: newDesc })
                    });
                    if (!res.ok) {
                        const data = await res.json().catch(() => null);
                        throw new Error(data?.detail || `HTTP ${res.status}`);
                    }
                    closeModal();
                    showNotification('Story updated', 'success');
                    await loadStoriesTab();
                } catch (err) {
                    console.error('Failed to update story:', err);
                    showNotification(err.message || 'Failed to update story', 'error');
                }
            });
        });
    });

    container.querySelectorAll('.js-view-story').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const storyId = e.currentTarget.getAttribute('data-id');
        const storyCard = e.currentTarget.closest('.c-story-card');
        const storyName = storyCard ? storyCard.querySelector('.c-story-card__title')?.textContent : 'Story';
        const target = container.querySelector('.js-story-articles');
        if (!storyId || !target) return;

        // Highlight the selected story card
        container.querySelectorAll('.c-story-card').forEach(c => c.classList.remove('c-story-card--selected'));
        if (storyCard) storyCard.classList.add('c-story-card--selected');

        target.innerHTML = '<div class="c-loading">Loading articles in story...</div>';
        try {
          const res = await fetch(`${lanIP}/api/v1/articles/by-story/${encodeURIComponent(storyId)}/`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const list = await res.json();
          // Ensure ordered by story_order ascending
          list.sort((a, b) => (a.story_order ?? 0) - (b.story_order ?? 0));
          
          if (list.length === 0) {
            target.innerHTML = `
              <div class="c-story-articles__header">
                <h3 class="c-story-articles__title"><i class="fas fa-book-open"></i> ${escapeHTML(storyName)}</h3>
                <span class="c-story-articles__count">0 articles</span>
              </div>
              <div class="c-empty-state">
                <i class="fas fa-book-open" style="font-size:2rem;opacity:0.4;margin-bottom:0.5rem;"></i>
                <p>No articles in this story yet.</p>
                <p style="font-size:0.85rem;opacity:0.7;">Add articles and assign them to this story from the Articles tab.</p>
              </div>`;
            return;
          }

          // Parse content and render articles like articles.js does
          const articlesHtml = list.map(a => {
            const createdAt = new Date(a.created_at).toLocaleDateString();
            const updatedAt = new Date(a.updated_at).toLocaleDateString();
            
            // Parse the JSON content
            let contentData = {};
            try {
              contentData = typeof a.content === 'string' ? JSON.parse(a.content) : (a.content || {});
            } catch (e) {
              console.warn('Failed to parse article content JSON:', e);
              contentData = {};
            }
            
            // Get highlights from parsed content (up to 3)
            const highlights = Array.isArray(contentData.highlights) 
              ? contentData.highlights.slice(0, 3).map(h => {
                  const title = typeof h === 'object' ? h.title : h;
                  return `<span class="c-article-highlight">${escapeHTML(title)}</span>`;
                }).join('')
              : '';
            
            // Get intro from parsed content, fall back to story field, then excerpt
            const intro = contentData.intro || a.story || a.excerpt || 'No introduction available';
            
            // Determine article status
            const status = a.is_active ? 'published' : 'draft';
            
            return `
              <div class="c-article-item" data-id="${a.id}">
                <div class="c-article-header">
                  <h3 class="c-article-title">${escapeHTML(a.title)}</h3>
                  <span class="c-article-status c-article-status--${status}">
                    <i class="fas fa-${status === 'published' ? 'globe' : 'edit'}"></i>
                    ${status}
                  </span>
                </div>
                
                <div class="c-article-meta">
                  <span class="c-article-meta-item">
                    <i class="fas fa-hashtag"></i>
                    Order: ${a.story_order ?? 0}
                  </span>
                  <span class="c-article-meta-item">
                    <i class="fas fa-user"></i>
                    ${escapeHTML(a.author)}
                  </span>
                  <span class="c-article-meta-item">
                    <i class="fas fa-calendar-alt"></i>
                    Written: ${a.date_written || 'Not specified'}
                  </span>
                  <span class="c-article-meta-item">
                    <i class="fas fa-calendar"></i>
                    Created: ${createdAt}
                  </span>
                  <span class="c-article-meta-item">
                    <i class="fas fa-edit"></i>
                    Updated: ${updatedAt}
                  </span>
                  ${a.category ? `
                  <span class="c-article-meta-item">
                    <i class="fas fa-tag"></i>
                    ${escapeHTML(a.category)}
                  </span>
                  ` : ''}
                  ${a.view_count !== undefined ? `
                  <span class="c-article-meta-item">
                    <i class="fas fa-eye"></i>
                    ${a.view_count} views
                  </span>
                  ` : ''}
                </div>
                
                <div class="c-article-intro">${escapeHTML(intro)}</div>
                
                ${highlights ? `<div class="c-article-highlights">${highlights}</div>` : ''}
                
                <div class="c-article-actions">
                  <button class="c-btn c-btn--primary js-view-article-story" data-id="${a.id}">
                    <i class="fas fa-eye"></i> View
                  </button>
                </div>
              </div>
            `;
          }).join('');

          target.innerHTML = `
            <div class="c-story-articles__header">
              <h3 class="c-story-articles__title"><i class="fas fa-book-open"></i> ${escapeHTML(storyName)}</h3>
              <span class="c-story-articles__count">${list.length} article${list.length !== 1 ? 's' : ''}</span>
            </div>
            <div class="c-article-list">${articlesHtml}</div>
          `;
          
          // Attach click listeners to view buttons
          target.querySelectorAll('.js-view-article-story').forEach(btn => {
            btn.addEventListener('click', async () => {
              const id = btn.getAttribute('data-id');
              try {
                const viewRes = await fetch(`${lanIP}/api/v1/articles/${encodeURIComponent(id)}/`);
                if (!viewRes.ok) throw new Error(`HTTP ${viewRes.status}`);
                const art = await viewRes.json();
                
                // Use the same showArticleDetails function from articles.js if available
                if (typeof showArticleDetails === 'function') {
                  showArticleDetails(art);
                } else {
                  console.log('Viewed article:', art);
                  showNotification('Article loaded (view modal not available)', 'info');
                }
              } catch (e) {
                console.error('View article failed:', e);
                showNotification('Failed to load article', 'error');
              }
            });
          });
        } catch (err) {
          console.error('Failed to load story articles:', err);
          target.innerHTML = '<div class="c-error-state">Failed to load articles for this story.</div>';
        }
      });
    });
  } catch (err) {
    console.error('Failed to load stories:', err);
    container.innerHTML = '<div class="c-error-state">Failed to load stories.</div>';
  }
}
// #endregion
