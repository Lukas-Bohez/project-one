/**
 * Manage the Spire - Frontend JavaScript
 * Handles authentication, business setup, and dashboard interactions
 */

// API Base URL
const API_BASE = '/api/v1/manage';

// Escape HTML to prevent XSS
function escapeHTML(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// State Management
let currentUser = null;
let currentBusiness = null;
let employees = [];
let employeeRoles = [];

// DOM Elements
const welcomeSection = document.getElementById('welcomeSection');
const dashboardSection = document.getElementById('dashboardSection');
const loginModal = document.getElementById('loginModal');
const setupModal = document.getElementById('setupModal');
const employeeModal = document.getElementById('employeeModal');
const employeeForm = document.getElementById('employeeForm');
const loginForm = document.getElementById('loginForm');
const setupForm = document.getElementById('setupForm');
const employeeList = document.getElementById('employeeList');
const employeeSearch = document.getElementById('employeeSearch');
const employeeStatusFilter = document.getElementById('employeeStatusFilter');

// Button Elements
const getStartedBtn = document.getElementById('getStartedBtn');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const signupLink = document.getElementById('signupLink');
const addEmployeeBtnSecondary = document.getElementById('addEmployeeBtnSecondary');
const generatePasswordBtn = document.getElementById('generatePasswordBtn');
const togglePasswordBtn = document.getElementById('togglePasswordBtn');
const cancelEmployeeBtn = document.getElementById('cancelEmployeeBtn');

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
        try {
            currentUser = JSON.parse(savedUser);
            currentBusiness = JSON.parse(savedBusiness);
            showDashboard();
        } catch (e) {
            console.error('Failed to parse saved user/business data:', e);
            localStorage.removeItem('manage_user');
            localStorage.removeItem('manage_business');
            showWelcome();
        }
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
        openEmployeeModal('create');
    });

    addEmployeeBtnSecondary?.addEventListener('click', () => {
        openEmployeeModal('create');
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

    employeeForm?.addEventListener('submit', handleEmployeeSubmit);
    cancelEmployeeBtn?.addEventListener('click', () => closeModal(employeeModal));
    employeeSearch?.addEventListener('input', applyEmployeeFilters);
    employeeStatusFilter?.addEventListener('change', applyEmployeeFilters);
    generatePasswordBtn?.addEventListener('click', generateTempPassword);
    togglePasswordBtn?.addEventListener('click', togglePasswordVisibility);
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
        
        if (!userId) {
            errorDiv.textContent = 'Could not verify user account. Please log in first.';
            errorDiv.style.display = 'block';
            return;
        }

        const businessData = {
            owner_user_id: userId,
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

/**
 * Show dashboard section
 */
function showDashboard() {
    welcomeSection.style.display = 'none';
    dashboardSection.style.display = 'block';
    loadDashboardData();
    loadEmployeeRoles();
    loadEmployees();
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
 * Load employee directory
 */
async function loadEmployees() {
    if (!currentBusiness?.id) return;

    if (employeeList) {
        employeeList.innerHTML = '<div class="loading-state">Loading employees...</div>';
    }

    try {
        const response = await fetch(`${API_BASE}/businesses/${currentBusiness.id}/employees`);
        if (!response.ok) {
            throw new Error('Failed to load employees');
        }
        employees = await response.json();
        applyEmployeeFilters();
    } catch (error) {
        console.error('Failed to load employees:', error);
        if (employeeList) {
            employeeList.innerHTML = '<div class="empty-state">Unable to load employees.</div>';
        }
    }
}

async function loadEmployeeRoles() {
    try {
        const response = await fetch(`${API_BASE}/employee-roles`);
        if (!response.ok) {
            throw new Error('Failed to load roles');
        }
        employeeRoles = await response.json();
    } catch (error) {
        console.error('Failed to load employee roles:', error);
        employeeRoles = [];
    }
}

function applyEmployeeFilters() {
    if (!employeeList) return;
    const query = (employeeSearch?.value || '').trim().toLowerCase();
    const status = employeeStatusFilter?.value || '';

    const filtered = employees.filter(emp => {
        const matchesStatus = !status || emp.status === status;
        const haystack = `${emp.first_name} ${emp.last_name} ${emp.email} ${emp.role_name || ''}`.toLowerCase();
        const matchesQuery = !query || haystack.includes(query);
        return matchesStatus && matchesQuery;
    });

    renderEmployeeList(filtered);
}

function renderEmployeeList(list) {
    if (!employeeList) return;

    const roleMap = employeeRoles.reduce((acc, role) => {
        acc[role.id] = role.role_name;
        return acc;
    }, {});

    if (!list.length) {
        employeeList.innerHTML = '<div class="empty-state">No employees found.</div>';
        return;
    }

    employeeList.innerHTML = list.map(emp => {
        const name = escapeHTML(`${emp.first_name} ${emp.last_name}`);
        const role = escapeHTML(emp.position_title || emp.role_name || roleMap[emp.role_id] || 'Employee');
        const status = emp.status || 'active';
        const rate = emp.hourly_rate ? `$${emp.hourly_rate.toFixed(2)}/hr` : 'Rate not set';
        const statusLabel = escapeHTML(status.replace('_', ' '));
        const toggleLabel = status === 'active' ? 'Deactivate' : 'Activate';
        const toggleAction = status === 'active' ? 'deactivate' : 'activate';
        const email = escapeHTML(emp.email || 'No email');
        const phone = emp.phone ? ` • ${escapeHTML(emp.phone)}` : '';
        const department = escapeHTML(emp.department || 'Not set');

        return `
            <div class="employee-card" data-employee-id="${emp.id}">
                <div class="employee-meta">
                    <div class="employee-name">${name}</div>
                    <div class="employee-role">${role}</div>
                    <div class="employee-contact">${email}${phone}</div>
                </div>
                <div class="employee-badges">
                    <span class="employee-badge status-${status}">${statusLabel}</span>
                    <span class="employee-badge">${rate}</span>
                </div>
                <div class="employee-meta">
                    <div class="employee-role">Hire Date: ${escapeHTML(emp.hire_date || 'N/A')}</div>
                    <div class="employee-role">Dept: ${department}</div>
                </div>
                <div class="employee-actions">
                    <button class="c-btn c-btn--secondary c-btn--sm" data-action="edit">Edit</button>
                    <button class="c-btn c-btn--tertiary c-btn--sm" data-action="${toggleAction}">${toggleLabel}</button>
                    <button class="c-btn c-btn--danger c-btn--sm" data-action="delete">Delete</button>
                </div>
            </div>
        `;
    }).join('');

    employeeList.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', () => {
            const card = btn.closest('.employee-card');
            const employeeId = parseInt(card.dataset.employeeId, 10);
            const employee = employees.find(emp => emp.id === employeeId);
            const action = btn.dataset.action;

            if (action === 'edit') {
                openEmployeeModal('edit', employee);
                return;
            }

            if (action === 'deactivate') {
                updateEmployeeStatus(employeeId, 'terminated');
                return;
            }

            if (action === 'activate') {
                updateEmployeeStatus(employeeId, 'active');
                return;
            }

            if (action === 'delete') {
                deleteEmployee(employeeId, employee);
            }
        });
    });
}

function openEmployeeModal(mode, employee = null) {
    if (!employeeModal || !employeeForm) return;

    const title = document.getElementById('employeeModalTitle');
    const passwordInput = document.getElementById('employeePassword');
    const hireDateInput = document.getElementById('employeeHireDate');

    employeeForm.dataset.mode = mode;
    employeeForm.dataset.employeeId = employee?.id || '';

    if (title) {
        title.textContent = mode === 'edit' ? 'Edit Employee' : 'Add Employee';
    }

    employeeForm.reset();
    if (passwordInput) {
        passwordInput.type = 'password';
    }
    if (togglePasswordBtn) {
        togglePasswordBtn.textContent = 'Show password';
    }
    const today = new Date().toISOString().split('T')[0];

    if (mode === 'edit' && employee) {
        document.getElementById('employeeFirstName').value = employee.first_name || '';
        document.getElementById('employeeLastName').value = employee.last_name || '';
        document.getElementById('employeeEmail').value = employee.email || '';
        document.getElementById('employeePhone').value = employee.phone || '';
        populateRoleSelect(employee.role_id || '');
        document.getElementById('employeeStatus').value = employee.status || 'active';
        document.getElementById('employeePosition').value = employee.position_title || '';
        document.getElementById('employeeDepartment').value = employee.department || '';
        document.getElementById('employeeHireDate').value = employee.hire_date || today;
        document.getElementById('employeeHourlyRate').value = employee.hourly_rate || '';
        document.getElementById('employeeCode').value = employee.employee_code || '';
        document.getElementById('employeeEmergencyName').value = employee.emergency_contact_name || '';
        document.getElementById('employeeEmergencyPhone').value = employee.emergency_contact_phone || '';
        if (passwordInput) passwordInput.required = false;
    } else {
        populateRoleSelect('');
        if (hireDateInput) hireDateInput.value = today;
        if (passwordInput) passwordInput.required = true;
    }

    const errorDiv = document.getElementById('employeeFormError');
    if (errorDiv) errorDiv.style.display = 'none';

    openModal(employeeModal);
}

function populateRoleSelect(selectedId) {
    const roleSelect = document.getElementById('employeeRole');
    if (!roleSelect) return;

    if (!employeeRoles.length) {
        roleSelect.innerHTML = `
            <option value="1">Owner</option>
            <option value="2">Manager</option>
            <option value="3">Employee</option>
        `;
        roleSelect.value = selectedId || '3';
        return;
    }

    roleSelect.innerHTML = employeeRoles.map(role => {
        return `<option value="${role.id}">${role.role_name}</option>`;
    }).join('');
    roleSelect.value = selectedId || employeeRoles[0]?.id || '';
}

async function handleEmployeeSubmit(e) {
    e.preventDefault();
    if (!currentBusiness?.id) return;

    const mode = employeeForm.dataset.mode || 'create';
    const employeeId = employeeForm.dataset.employeeId;
    const errorDiv = document.getElementById('employeeFormError');

    const basePayload = {
        first_name: document.getElementById('employeeFirstName').value.trim(),
        last_name: document.getElementById('employeeLastName').value.trim(),
        email: document.getElementById('employeeEmail').value.trim(),
        phone: document.getElementById('employeePhone').value.trim() || null,
        role_id: parseInt(document.getElementById('employeeRole').value, 10),
        status: document.getElementById('employeeStatus').value,
        position_title: document.getElementById('employeePosition').value.trim() || null,
        department: document.getElementById('employeeDepartment').value.trim() || null,
        hire_date: document.getElementById('employeeHireDate').value,
        hourly_rate: document.getElementById('employeeHourlyRate').value ? parseFloat(document.getElementById('employeeHourlyRate').value) : null,
        employee_code: document.getElementById('employeeCode').value.trim() || null,
        emergency_contact_name: document.getElementById('employeeEmergencyName').value.trim() || null,
        emergency_contact_phone: document.getElementById('employeeEmergencyPhone').value.trim() || null
    };

    const payload = mode === 'edit'
        ? {
            email: basePayload.email,
            first_name: basePayload.first_name,
            last_name: basePayload.last_name,
            phone: basePayload.phone,
            role_id: basePayload.role_id,
            employee_code: basePayload.employee_code,
            hire_date: basePayload.hire_date,
            position_title: basePayload.position_title,
            department: basePayload.department,
            hourly_rate: basePayload.hourly_rate,
            status: basePayload.status,
            emergency_contact_name: basePayload.emergency_contact_name,
            emergency_contact_phone: basePayload.emergency_contact_phone
        }
        : {
            business_id: currentBusiness.id,
            email: basePayload.email,
            first_name: basePayload.first_name,
            last_name: basePayload.last_name,
            phone: basePayload.phone,
            role_id: basePayload.role_id,
            status: basePayload.status,
            position_title: basePayload.position_title,
            department: basePayload.department,
            hire_date: basePayload.hire_date,
            hourly_rate: basePayload.hourly_rate,
            employee_code: basePayload.employee_code,
            emergency_contact_name: basePayload.emergency_contact_name,
            emergency_contact_phone: basePayload.emergency_contact_phone
        };

    const passwordValue = document.getElementById('employeePassword').value;
    if (passwordValue) {
        payload.password = passwordValue;
    }

    try {
        const response = await fetch(
            mode === 'edit' ? `${API_BASE}/employees/${employeeId}` : `${API_BASE}/employees`,
            {
                method: mode === 'edit' ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to save employee');
        }

        await response.json();
        closeModal(employeeModal);
        showNotification(mode === 'edit' ? 'Employee updated!' : 'Employee added!', 'success');
        loadEmployees();
    } catch (error) {
        console.error('Employee save error:', error);
        if (errorDiv) {
            errorDiv.textContent = `Error: ${error.message}`;
            errorDiv.style.display = 'block';
        }
    }
}

function generateTempPassword() {
    const passwordInput = document.getElementById('employeePassword');
    if (!passwordInput) return;

    const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    let password = '';
    for (let i = 0; i < 12; i += 1) {
        password += charset.charAt(Math.floor(Math.random() * charset.length));
    }

    passwordInput.value = password;

    if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(password).then(() => {
            showNotification('Temporary password copied to clipboard', 'success');
        }).catch(() => {
            showNotification('Password generated (copy failed)', 'info');
        });
    } else {
        showNotification('Password generated. Copy it manually.', 'info');
    }
}

function togglePasswordVisibility() {
    const passwordInput = document.getElementById('employeePassword');
    if (!passwordInput || !togglePasswordBtn) return;

    const isHidden = passwordInput.type === 'password';
    passwordInput.type = isHidden ? 'text' : 'password';
    togglePasswordBtn.textContent = isHidden ? 'Hide password' : 'Show password';
}

async function updateEmployeeStatus(employeeId, status) {
    try {
        const response = await fetch(`${API_BASE}/employees/${employeeId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to update employee status');
        }

        await response.json();
        showNotification('Employee status updated', 'success');
        loadEmployees();
    } catch (error) {
        console.error('Status update error:', error);
        showNotification(`Error: ${error.message}`, 'error');
    }
}

async function deleteEmployee(employeeId, employee) {
    const name = employee ? `${employee.first_name} ${employee.last_name}` : 'this employee';
    const typed = window.prompt(`Type DELETE to confirm deleting ${name}. This cannot be undone.`);
    if (typed !== 'DELETE') {
        showNotification('Delete cancelled', 'info');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/employees/${employeeId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to delete employee');
        }

        showNotification('Employee deleted', 'success');
        loadEmployees();
    } catch (error) {
        console.error('Delete employee error:', error);
        showNotification(`Error: ${error.message}`, 'error');
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
