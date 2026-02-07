/**
 * Manage the Spire - Frontend JavaScript
 * Handles authentication, business setup, and dashboard interactions
 */

// API Base URL
const API_BASE = '/api/v1/manage';

// State Management
let currentUser = null;
let currentBusiness = null;

// DOM Elements
const welcomeSection = document.getElementById('welcomeSection');
const dashboardSection = document.getElementById('dashboardSection');
const loginModal = document.getElementById('loginModal');
const setupModal = document.getElementById('setupModal');
const loginForm = document.getElementById('loginForm');
const setupForm = document.getElementById('setupForm');

// Button Elements
const getStartedBtn = document.getElementById('getStartedBtn');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const signupLink = document.getElementById('signupLink');

// Modal Close Buttons
const modalCloses = document.querySelectorAll('.c-modal__close');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    attachEventListeners();
});

/**
 * Initialize the application
 */
function initializeApp() {
    // Check if user is already logged in (from localStorage or session)
    const savedUser = localStorage.getItem('manage_user');
    const savedBusiness = localStorage.getItem('manage_business');
    
    if (savedUser && savedBusiness) {
        currentUser = JSON.parse(savedUser);
        currentBusiness = JSON.parse(savedBusiness);
        showDashboard();
    } else {
        showWelcome();
    }
    
    // Check API health
    checkApiHealth();
}

/**
 * Attach event listeners
 */
function attachEventListeners() {
    // Button clicks
    getStartedBtn?.addEventListener('click', () => openModal(setupModal));
    loginBtn?.addEventListener('click', () => openModal(loginModal));
    logoutBtn?.addEventListener('click', handleLogout);
    signupLink?.addEventListener('click', (e) => {
        e.preventDefault();
        closeModal(loginModal);
        openModal(setupModal);
    });
    
    // Form submissions
    loginForm?.addEventListener('submit', handleLogin);
    setupForm?.addEventListener('submit', handleBusinessSetup);
    
    // Modal close buttons
    modalCloses.forEach(btn => {
        btn.addEventListener('click', () => {
            closeModal(btn.closest('.c-modal'));
        });
    });
    
    // Close modal on outside click
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('c-modal')) {
            closeModal(e.target);
        }
    });
    
    // Quick action buttons
    document.getElementById('addEmployeeBtn')?.addEventListener('click', () => {
        showNotification('Employee management UI coming soon!', 'info');
    });
    
    document.getElementById('createShiftBtn')?.addEventListener('click', () => {
        showNotification('Scheduling UI coming soon!', 'info');
    });
    
    document.getElementById('viewScheduleBtn')?.addEventListener('click', () => {
        showNotification('Schedule calendar coming soon!', 'info');
    });
    
    document.getElementById('timeOffBtn')?.addEventListener('click', () => {
        showNotification('Time-off management UI coming soon!', 'info');
    });
}

/**
 * Check API health status
 */
async function checkApiHealth() {
    try {
        const response = await fetch(`${API_BASE}/health`);
        if (response.ok) {
            const data = await response.json();
            console.log('Manage API is healthy:', data);
        }
    } catch (error) {
        console.error('Manage API health check failed:', error);
    }
}

/**
 * Handle login form submission
 */
async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('loginError');
    
    // Clear previous errors
    errorDiv.style.display = 'none';
    
    try {
        // Call the main Quiz The Spire login endpoint
        const response = await fetch('/api/v1/quiz/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        if (!response.ok) {
            throw new Error('Invalid email or password');
        }
        
        const data = await response.json();
        const token = data.token || data.access_token;
        
        // Save authentication token
        localStorage.setItem('manage_token', token);
        
        // Fetch user details from manage API
        const userResponse = await fetch(`${API_BASE}/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (userResponse.ok) {
            const userData = await userResponse.json();
            currentUser = userData;
            
            // If user has a business, load it
            if (userData.business_id) {
                const businessResponse = await fetch(`${API_BASE}/businesses/${userData.business_id}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                if (businessResponse.ok) {
                    currentBusiness = await businessResponse.json();
                }
            }
        } else {
            // User exists but no Manage account yet
            currentUser = {
                id: data.user_id || data.id,
                email: email,
                role: 'owner'
            };
        }
        
        // Save to localStorage
        localStorage.setItem('manage_user', JSON.stringify(currentUser));
        if (currentBusiness) {
            localStorage.setItem('manage_business', JSON.stringify(currentBusiness));
        }
        
        closeModal(loginModal);
        showDashboard();
        showNotification('Login successful!', 'success');
        
    } catch (error) {
        console.error('Login error:', error);
        errorDiv.textContent = `Login failed: ${error.message}. Make sure you have a Quiz The Spire account.`;
        errorDiv.style.display = 'block';
    }
}

/**
 * Handle business setup form submission
 */
async function handleBusinessSetup(e) {
    e.preventDefault();
    
    const businessName = document.getElementById('businessName').value.trim();
    const contactEmail = document.getElementById('contactEmail').value.trim();
    const contactPhone = document.getElementById('contactPhone').value.trim();
    const timezone = document.getElementById('timezone').value;
    
    const errorDiv = document.getElementById('setupError');
    const successDiv = document.getElementById('setupSuccess');
    
    // Clear previous messages
    errorDiv.style.display = 'none';
    successDiv.style.display = 'none';
    
    try {
        // First, check if user needs to be created in Quiz The Spire
        let userId = null;
        
        // Check if user exists
        const userCheckResponse = await fetch('/api/v1/quiz/user/check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: contactEmail })
        });
        
        if (userCheckResponse.ok) {
            const userData = await userCheckResponse.json();
            userId = userData.id;
        } else {
            // User doesn't exist, we'll create the business with owner_user_id to be filled later
            userId = null;
        }
        
        const businessData = {
            owner_user_id: userId || 1, // Use 1 as placeholder if not found
            business_name: businessName,
            tier: 'free',
            max_employees: 10,
            timezone: timezone,
            contact_email: contactEmail,
            contact_phone: contactPhone || null
        };
        
        // Get token if available
        const token = localStorage.getItem('manage_token');
        const headers = {
            'Content-Type': 'application/json'
        };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        // Call the API
        const response = await fetch(`${API_BASE}/businesses`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(businessData)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to create business');
        }
        
        const result = await response.json();
        
        successDiv.textContent = `Business "${businessName}" created successfully!`;
        successDiv.style.display = 'block';
        
        // Set current business
        currentBusiness = result;
        currentUser = {
            id: userId || 1,
            email: contactEmail,
            role: 'owner'
        };
        
        // Save to localStorage
        localStorage.setItem('manage_user', JSON.stringify(currentUser));
        localStorage.setItem('manage_business', JSON.stringify(currentBusiness));
        
        // Show success and redirect to dashboard
        setTimeout(() => {
            closeModal(setupModal);
            showDashboard();
            showNotification('Business account created successfully!', 'success');
        }, 2000);
        
    } catch (error) {
        console.error('Business setup error:', error);
        errorDiv.textContent = `Error: ${error.message}`;
        errorDiv.style.display = 'block';
    }
}

/**
 * Handle logout
 */
function handleLogout() {
    currentUser = null;
    currentBusiness = null;
    localStorage.removeItem('manage_user');
    localStorage.removeItem('manage_business');
    showWelcome();
    showNotification('Logged out successfully', 'info');
}

/**
 * Show welcome section
 */
function showWelcome() {
    welcomeSection.style.display = 'block';
    dashboardSection.style.display = 'none';
}

/**const token = localStorage.getItem('manage_token');
        const headers = {};
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        // Fetch dashboard data from API
        const response = await fetch(`${API_BASE}/businesses/${currentBusiness.id}/dashboard`, {
            headers: headers
        });
        
        if (response.ok) {
            const data = await response.json();
            
            // Update stats
            document.getElementById('statActiveEmployees').textContent = data.active_employees || 0;
            document.getElementById('statShiftsToday').textContent = data.shifts_today || 0;
            document.getElementById('statPendingRequests').textContent = data.pending_time_off_requests || 0;
            document.getElementById('statWeekHours').textContent = (data.weekly_hours || 0).toFixed(1);
        } else {
            // If API call fails, show placeholder data
            console.warn('Dashboard API call failed, showing placeholder data');
}

/**
 * Load dashboard statistics
 */
async function loadDashboardData() {
    if (!currentBusiness?.id) return;
    
    try {
        // Fetch dashboard data from API
        const response = await fetch(`${API_BASE}/businesses/${currentBusiness.id}/dashboard`);
        
        if (response.ok) {
            const data = await response.json();
            
            // Update stats
            document.getElementById('statActiveEmployees').textContent = data.active_employees || 0;
            document.getElementById('statShiftsToday').textContent = data.shifts_today || 0;
            document.getElementById('statPendingRequests').textContent = data.pending_time_off_requests || 0;
            document.getElementById('statWeekHours').textContent = (data.weekly_hours || 0).toFixed(1);
        } else {
            // If API call fails, show placeholder data
            document.getElementById('statActiveEmployees').textContent = '0';
            document.getElementById('statShiftsToday').textContent = '0';
            document.getElementById('statPendingRequests').textContent = '0';
            document.getElementById('statWeekHours').textContent = '0.0';
        }
    } catch (error) {
        console.error('Failed to load dashboard data:', error);
        // Show placeholder data on error
        document.getElementById('statActiveEmployees').textContent = '-';
        document.getElementById('statShiftsToday').textContent = '-';
        document.getElementById('statPendingRequests').textContent = '-';
        document.getElementById('statWeekHours').textContent = '-';
    }
}

/**
 * Open a modal
 */
function openModal(modal) {
    if (!modal) return;
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    // Focus first input
    const firstInput = modal.querySelector('input');
    if (firstInput) {
        setTimeout(() => firstInput.focus(), 100);
    }
}

/**
 * Close a modal
 */
function closeModal(modal) {
    if (!modal) return;
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    // Clear form if it exists
    const form = modal.querySelector('form');
    if (form) {
        form.reset();
        // Clear error messages
        const errorDiv = modal.querySelector('.error-message');
        const successDiv = modal.querySelector('.success-message');
        if (errorDiv) errorDiv.style.display = 'none';
        if (successDiv) successDiv.style.display = 'none';
    }
}

/**
 * Show notification (basic implementation)
 */
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#007bff'};
        color: white;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    // Remove after 4 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 4000);
}

// Add CSS animations for notifications
const manageStyle = document.createElement('style');
manageStyle.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
if (!document.head.querySelector('style[data-manage-animations]')) {
    manageStyle.setAttribute('data-manage-animations', 'true');
    document.head.appendChild(manageStyle);
}

// Export for potential use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        showNotification,
        openModal,
        closeModal
    };
}
