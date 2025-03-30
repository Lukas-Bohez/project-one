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
    userTable: document.querySelector('.c-user-table tbody')
};
// #endregion

// #region ***  Data & State Management                  ***********
let currentEditItem = null;
let currentTab = 'questions';

const state = {
    questions: [
        { id: 1, text: 'What is the capital of France?', theme: 'Geography', difficulty: 'Easy' },
        { id: 2, text: 'Which planet is known as the Red Planet?', theme: 'Science', difficulty: 'Easy' },
        { id: 3, text: 'Who wrote "Romeo and Juliet"?', theme: 'Literature', difficulty: 'Medium' }
    ],
    themes: [
        { id: 1, name: 'Geography', questionCount: 12 },
        { id: 2, name: 'Science', questionCount: 15 },
        { id: 3, name: 'Literature', questionCount: 8 },
        { id: 4, name: 'History', questionCount: 10 }
    ],
    users: [
        { id: 1, username: 'admin1', role: 'Admin', lastActive: '2023-05-15' },
        { id: 2, username: 'moderator1', role: 'Moderator', lastActive: '2023-05-20' },
        { id: 3, username: 'user1', role: 'User', lastActive: '2023-05-22' }
    ],
    stats: {
        activeQuizzes: 42,
        totalQuestions: 128,
        registeredUsers: 24,
        avgScore: '85%'
    }
};
// #endregion

// #region ***  API Calls                                ***********
const fetchQuestions = async () => {
    // In a real app, this would be an API call
    // Example: const response = await fetch('/api/questions');
    // const data = await response.json();
    // return data;
    
    return new Promise(resolve => {
        setTimeout(() => resolve(state.questions), 300);
    });
};

const fetchThemes = async () => {
    return new Promise(resolve => {
        setTimeout(() => resolve(state.themes), 300);
    });
};

const fetchUsers = async () => {
    return new Promise(resolve => {
        setTimeout(() => resolve(state.users), 300);
    });
};

const updateQuestion = async (question) => {
    // API call to update question
    // In a real app this would be:
    // const response = await fetch(`/api/questions/${question.id}`, {
    //   method: 'PUT',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(question)
    // });
    // return await response.json();
    
    console.log('Updating question:', question);
    return new Promise(resolve => {
        setTimeout(() => {
            const index = state.questions.findIndex(q => q.id === question.id);
            if (index >= 0) {
                state.questions[index] = question;
            }
            resolve(question);
        }, 300);
    });
};

const saveItem = async (itemType, item) => {
    // In a real app, this would be an API call
    // Example: const response = await fetch(`/api/${itemType}/${item.id}`, {
    //   method: 'PUT',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(item)
    // });
    // return await response.json();
    
    console.log(`Saving ${itemType}:`, item);
    return new Promise(resolve => {
        setTimeout(() => {
            if (itemType === 'questions') {
                const index = state.questions.findIndex(q => q.id === item.id);
                if (index >= 0) {
                    state.questions[index] = item;
                } else {
                    item.id = state.questions.length + 1;
                    state.questions.push(item);
                }
            } else if (itemType === 'themes') {
                const index = state.themes.findIndex(t => t.id === item.id);
                if (index >= 0) {
                    state.themes[index] = item;
                } else {
                    item.id = state.themes.length + 1;
                    item.questionCount = 0;
                    state.themes.push(item);
                }
            } else if (itemType === 'users') {
                const index = state.users.findIndex(u => u.id === item.id);
                if (index >= 0) {
                    state.users[index] = item;
                } else {
                    item.id = state.users.length + 1;
                    state.users.push(item);
                }
            }
            resolve(item);
        }, 300);
    });
};

const deleteItem = async (itemType, itemId) => {
    // In a real app, this would be an API call
    // Example: const response = await fetch(`/api/${itemType}/${itemId}`, {
    //   method: 'DELETE'
    // });
    // return response.ok;
    
    console.log(`Deleting ${itemType} with ID:`, itemId);
    return new Promise(resolve => {
        setTimeout(() => {
            if (itemType === 'questions') {
                state.questions = state.questions.filter(q => q.id !== itemId);
            } else if (itemType === 'themes') {
                state.themes = state.themes.filter(t => t.id !== itemId);
            } else if (itemType === 'users') {
                state.users = state.users.filter(u => u.id !== itemId);
            }
            resolve(true);
        }, 300);
    });
};
// #endregion

// #region ***  Callback-Visualisation - show___         ***********
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
    
    // Load data for the selected tab
    loadTabData(tabId);
};

const showEditModal = (itemType, item = null) => {
    const modal = domAdmin.editModal;
    const modalTitle = modal.querySelector('.c-modal-title');
    const form = modal.querySelector('.c-edit-form');
    
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
        form.innerHTML = `
            <div class="c-form-group">
                <label>Question Text</label>
                <input type="text" name="text" class="c-form-input" value="${item ? item.text : ''}">
            </div>
            <div class="c-form-group">
                <label>Theme</label>
                <select name="theme" class="c-form-select">
                    ${state.themes.map(theme => `
                        <option value="${theme.name}" ${item && item.theme === theme.name ? 'selected' : ''}>
                            ${theme.name}
                        </option>
                    `).join('')}
                </select>
            </div>
            <div class="c-form-group">
                <label>Difficulty</label>
                <select name="difficulty" class="c-form-select">
                    <option value="Easy" ${item && item.difficulty === 'Easy' ? 'selected' : ''}>Easy</option>
                    <option value="Medium" ${item && item.difficulty === 'Medium' ? 'selected' : ''}>Medium</option>
                    <option value="Hard" ${item && item.difficulty === 'Hard' ? 'selected' : ''}>Hard</option>
                </select>
            </div>
        `;
    } else if (itemType === 'themes') {
        form.innerHTML = `
            <div class="c-form-group">
                <label>Theme Name</label>
                <input type="text" name="name" class="c-form-input" value="${item ? item.name : ''}">
            </div>
        `;
    } else if (itemType === 'users') {
        form.innerHTML = `
            <div class="c-form-group">
                <label>Username</label>
                <input type="text" name="username" class="c-form-input" value="${item ? item.username : ''}">
            </div>
            <div class="c-form-group">
                <label>Role</label>
                <select name="role" class="c-form-select">
                    <option value="Admin" ${item && item.role === 'Admin' ? 'selected' : ''}>Admin</option>
                    <option value="Moderator" ${item && item.role === 'Moderator' ? 'selected' : ''}>Moderator</option>
                    <option value="User" ${item && item.role === 'User' ? 'selected' : ''}>User</option>
                </select>
            </div>
        `;
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

const loadQuestions = async () => {
    const questionList = document.querySelector('.c-question-list');
    
    if (!questionList) return;
    
    showLoading(questionList);
    
    try {
        const questions = await fetchQuestions();
        const searchTerm = domAdmin.searchInput?.value.toLowerCase() || '';
        
        // Filter questions once
        const filteredQuestions = searchTerm 
            ? questions.filter(q => q.text.toLowerCase().includes(searchTerm))
            : questions;
        
        // Handle empty states more efficiently
        if (!questions.length || !filteredQuestions.length) {
            const message = !questions.length 
                ? 'No questions found. Add a new question to get started.'
                : 'No questions match your search.';
                
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

// Helper function to create question element
const createQuestionElement = (question) => {
    const element = document.createElement('div');
    element.className = 'c-question-item';
    element.dataset.id = question.id;
    
    const answerCount = question.answerCount || 4;
    const answersHTML = generateAnswersHTML(question.answers || [], answerCount);
    
    // Get themes for dropdown
    const themesOptions = state.themes.map(theme => 
        `<option value="${theme.name}" ${question.theme === theme.name ? 'selected' : ''}>${theme.name}</option>`
    ).join('');
    
    element.innerHTML = `
        <div class="c-question-info">
            <div class="c-question-edit">
                <input type="text" class="c-question-text-edit" value="${escapeHTML(question.text)}" placeholder="Enter question">
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
                        <option value="Easy" ${question.difficulty === 'Easy' ? 'selected' : ''}>Easy</option>
                        <option value="Medium" ${question.difficulty === 'Medium' ? 'selected' : ''}>Medium</option>
                        <option value="Hard" ${question.difficulty === 'Hard' ? 'selected' : ''}>Hard</option>
                    </select>
                </div>
            </div>
            
            <div class="c-answer-options">
                <div class="c-answer-count">
                    <label for="answer-count-${question.id}">Number of answers:</label>
                    <select id="answer-count-${question.id}" class="js-answer-count" data-question-id="${question.id}">
                        ${[4, 5, 6, 7, 8, 9, 10].map(num => 
                            `<option value="${num}" ${answerCount === num ? 'selected' : ''}>${num}</option>`
                        ).join('')}
                    </select>
                </div>
                
                <div class="c-answer-list">
                    ${answersHTML}
                </div>
            </div>
        </div>
        <div class="c-question-actions">
            <button class="c-btn c-btn--edit js-edit-question" data-id="${question.id}">Edit</button>
            <button class="c-btn c-btn--delete js-delete-question">Delete</button>
        </div>
    `;
    
    return element;
};

// Helper function to generate answers HTML
const generateAnswersHTML = (answers, count) => {
    return Array.from({length: count}, (_, i) => {
        const answer = answers[i] || {text: '', isCorrect: false};
        return `
            <div class="c-answer-item">
                <input type="text" 
                       class="c-answer-text" 
                       value="${escapeHTML(answer.text)}" 
                       placeholder="Answer option ${i+1}">
                <label class="c-answer-correct">
                    <input type="checkbox" ${answer.isCorrect ? 'checked' : ''}>
                    <span>Correct</span>
                </label>
            </div>
        `;
    }).join('');
};

// Event delegation handler for question actions
const handleQuestionActions = (event) => {
    const target = event.target;
    
    // Edit button handler
    if (target.classList.contains('js-edit-question')) {
        const questionId = parseInt(target.dataset.id);
        sendEditRequest(questionId);
    }
    
    // Delete button handler
    if (target.classList.contains('js-delete-question')) {
        const questionItem = target.closest('.c-question-item');
        const id = parseInt(questionItem.dataset.id);
        
        showConfirmDialog('Are you sure you want to delete this question?', async () => {
            await deleteItem('questions', id);
            loadQuestions();
            showNotification('Question deleted successfully');
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

// Handler for question field changes (theme, difficulty, text)
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
                text: item.querySelector('.c-answer-text').value,
                isCorrect: item.querySelector('input[type="checkbox"]').checked
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
            question.answers.push({ text: '', isCorrect: false });
        }
        
        // Save changes to backend
        updateQuestion(question);
    }
    
    // Handle theme changes
    if (target.classList.contains('js-theme-select')) {
        question.theme = target.value;
        updateQuestion(question);
    }
    
    // Handle difficulty changes
    if (target.classList.contains('js-difficulty-select')) {
        question.difficulty = target.value;
        updateQuestion(question);
    }
    
    // Handle question text changes
    if (target.classList.contains('c-question-text-edit')) {
        // Use blur event to avoid too many updates
        target.addEventListener('blur', () => {
            question.text = target.value;
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
        
        if (users.length === 0) {
            userTableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="c-empty-state">No users found.</td>
                </tr>
            `;
            return;
        }
        
        userTableBody.innerHTML = users.map(user => `
            <tr data-id="${user.id}">
                <td data-label="Username">${user.username}</td>
                <td data-label="Role">
                    <span class="c-tag c-tag--role c-tag--${user.role.toLowerCase()}">${user.role}</span>
                </td>
                <td data-label="Last Active">${user.lastActive}</td>
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
        `).join('');
        
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
                
                if (user && user.role === 'Admin' && state.users.filter(u => u.role === 'Admin').length === 1) {
                    showNotification('Cannot delete the last admin user.', 'error');
                    return;
                }
                
                showConfirmDialog('Are you sure you want to delete this user?', async () => {
                    await deleteItem('users', id);
                    loadUsers();
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

const saveCurrentItem = async (itemType) => {
    if (!currentEditItem) return;
    
    const form = domAdmin.editModal.querySelector('.c-edit-form');
    
    // Gather form data
    if (itemType === 'questions') {
        currentEditItem.text = form.querySelector('[name="text"]').value;
        currentEditItem.theme = form.querySelector('[name="theme"]').value;
        currentEditItem.difficulty = form.querySelector('[name="difficulty"]').value;
    } else if (itemType === 'themes') {
        currentEditItem.name = form.querySelector('[name="name"]').value;
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

const filterQuestions = () => {
    if (currentTab === 'questions') {
        loadQuestions();
    }
};
// #endregion

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
            window.location.href = 'login.html';
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
        domAdmin.searchInput.addEventListener('input', filterQuestions);
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
const initStats = () => {
    const statItems = document.querySelectorAll('.c-stat-item');
    statItems.forEach(item => {
        const label = item.querySelector('.c-stat-label').textContent;
        const value = item.querySelector('.c-stat-value');
        
        switch (label) {
            case 'Active Quizzes':
                value.textContent = state.stats.activeQuizzes;
                break;
            case 'Total Questions':
                value.textContent = state.stats.totalQuestions;
                break;
            case 'Registered Users':
                value.textContent = state.stats.registeredUsers;
                break;
            case 'Avg. Score':
                value.textContent = state.stats.avgScore;
                break;
        }
    });
};

const initAdmin = () => {
    listenToTabs();
    listenToLogout();
    listenToModal();
    listenToSearch();
    listenToAddButtons();
    initStats();
    
    // Initialize first tab as active
    if (domAdmin.tabBtns.length > 0) {
        const firstTabId = domAdmin.tabBtns[0].dataset.tab;
        showTab(firstTabId);
    }
    
    
};


document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('create.html')) {
        initAdmin();
    }
});
// #endregion
