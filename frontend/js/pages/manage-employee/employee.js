/**
 * Employee Portal - Self-Service JavaScript
 */

const API_BASE = '/api/v1/manage';

// State
let currentEmployee = null;
let currentBusiness = null;
let shifts = [];
let timeOffRequests = [];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadEmployeeFromStorage();
    loadEmployeeData();
    attachEventListeners();
});

/**
 * Load employee from localStorage
 */
function loadEmployeeFromStorage() {
    const savedUser = sessionStorage.getItem('manage_user');
    const savedBusiness = sessionStorage.getItem('manage_business');
    
    if (savedUser && savedBusiness) {
        const user = JSON.parse(savedUser);
        currentBusiness = JSON.parse(savedBusiness);
        
        // In real app, would fetch employee details from API
        currentEmployee = {
            id: 1,
            first_name: user.email?.split('@')[0] || 'Employee',
            last_name: 'User',
            employee_code: 'EMP001',
            role: 'Cashier',
            hourly_rate: 15.50,
            pto_balance: 40,
            hire_date: '2025-01-01'
        };
        
        document.getElementById('employeeName').textContent = `${currentEmployee.first_name} ${currentEmployee.last_name}`;
        document.getElementById('welcomeName').textContent = currentEmployee.first_name;
    } else {
        showNotification('Please log in to access the employee portal', 'error');
        setTimeout(() => window.location.href = '/pages/manage/', 2000);
    }
}

/**
 * Load employee data
 */
async function loadEmployeeData() {
    loadShifts();
    loadTimeOffRequests();
    updateQuickStats();
    updateProfileInfo();
}

/**
 * Attach event listeners
 */
function attachEventListeners() {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
    
    // Buttons
    document.getElementById('requestTimeOffBtn').addEventListener('click', openTimeOffModal);
    document.getElementById('downloadScheduleBtn').addEventListener('click', downloadSchedule);
    document.getElementById('offerSwapBtn').addEventListener('click', () => {
        showNotification('Shift swap feature coming soon!', 'info');
    });
    document.getElementById('updateAvailabilityBtn').addEventListener('click', () => {
        showNotification('Availability update feature coming soon!', 'info');
    });
    
    // Forms
    document.getElementById('timeOffForm').addEventListener('submit', handleTimeOffSubmit);
    
    // Modal close
    document.querySelectorAll('.c-modal__close').forEach(btn => {
        btn.addEventListener('click', () => closeModal(btn.closest('.c-modal')));
    });
    
    // Date change for time off calculation
    document.getElementById('startDate').addEventListener('change', calculateTimeOff);
    document.getElementById('endDate').addEventListener('change', calculateTimeOff);
}

/**
 * Switch tabs
 */
function switchTab(tabName) {
    // Update buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    
    // Update content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `${tabName}-tab`);
    });
}

/**
 * Load shifts
 */
async function loadShifts() {
    if (!currentEmployee?.id) return;
    
    try {
        const token = sessionStorage.getItem('manage_token');
        const headers = {};
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        // Get next 14 days of shifts for this employee
        const today = new Date();
        const startDate = formatDate(today);
        const twoWeeksLater = new Date();
        twoWeeksLater.setDate(twoWeeksLater.getDate() + 14);
        const endDate = formatDate(twoWeeksLater);
        
        const response = await fetch(`${API_BASE}/employees/${currentEmployee.id}/shifts?start_date=${startDate}&end_date=${endDate}`, {
            headers: headers
        });
        
        if (response.ok) {
            shifts = await response.json();
        } else {
            shifts = [];
        }
        renderShifts();
    } catch (error) {
        console.error('Failed to load shifts:', error);
        shifts = [];
        renderShifts();
    }
}

/**
 * Render shifts list
 */
function renderShifts() {
    const container = document.getElementById('shiftsList');
    
    if (shifts.length === 0) {
        container.innerHTML = '<div class="empty-state">No upcoming shifts scheduled</div>';
        return;
    }
    
    container.innerHTML = '';
    
    shifts.forEach(shift => {
        const date = new Date(shift.shift_date);
        const duration = calculateDuration(shift.start_time, shift.end_time, shift.break_minutes);
        const pay = (duration * currentEmployee.hourly_rate).toFixed(2);
        
        const item = document.createElement('div');
        item.className = 'shift-item';
        item.innerHTML = `
            <div class="shift-info">
                <div class="shift-date">${formatDateLong(date)}</div>
                <div class="shift-time">${formatTime(shift.start_time)} - ${formatTime(shift.end_time)}</div>
                <div class="shift-details">
                    <span class="shift-duration"><i class="fa-regular fa-clock" aria-hidden="true"></i> ${duration} hours</span>
                    <span class="shift-pay"><i class="fa-solid fa-dollar-sign" aria-hidden="true"></i> $${pay}</span>
                </div>
                ${shift.notes ? `<div class="shift-notes">${shift.notes}</div>` : ''}
            </div>
            <div class="shift-badge ${shift.status}">${shift.status}</div>
        `;
        container.appendChild(item);
    });
}

/**
 * Load time off requests
 */
async function loadTimeOffRequests() {
    if (!currentEmployee?.id) return;
    
    try {
        const token = sessionStorage.getItem('manage_token');
        const headers = {};
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        const response = await fetch(`${API_BASE}/employees/${currentEmployee.id}/time-off`, {
            headers: headers
        });
        
        if (response.ok) {
            timeOffRequests = await response.json();
        } else {
            timeOffRequests = [];
        }
        renderTimeOffRequests();
    } catch (error) {
        console.error('Failed to load time-off requests:', error);
        timeOffRequests = [];
        renderTimeOffRequests();
    }
}

/**
 * Render time off requests
 */
function renderTimeOffRequests() {
    const container = document.getElementById('requestsList');
    
    if (timeOffRequests.length === 0) {
        container.innerHTML = '<div class="empty-state">No time-off requests yet</div>';
        return;
    }
    
    container.innerHTML = '';
    
    const typeLabels = {
        pto: 'Paid Time Off',
        sick: 'Sick Leave',
        unpaid: 'Unpaid Time Off',
        vacation: 'Vacation',
        personal: 'Personal Day'
    };

    timeOffRequests.forEach(request => {
        const item = document.createElement('div');
        item.className = 'request-item';
        item.innerHTML = `
            <div class="request-header">
                <div class="request-type">${typeLabels[request.request_type] || capitalizeFirst(request.request_type || 'Request')}</div>
                <div class="request-status ${request.status}">${capitalizeFirst(request.status)}</div>
            </div>
            <div class="request-dates">
                ${formatDateShort(request.start_date)} - ${formatDateShort(request.end_date)}
                (${request.total_hours ?? request.hours_requested ?? 0} hours)
            </div>
            ${request.reason ? `<div class="request-reason">${request.reason}</div>` : ''}
        `;
        container.appendChild(item);
    });
    
    // Update pending count
    const pendingCount = timeOffRequests.filter(r => r.status === 'pending').length;
    document.getElementById('pendingRequests').textContent = pendingCount;
}

/**
 * Update quick stats
 */
function updateQuickStats() {
    if (!currentEmployee) {
        return;
    }
    // Calculate this week's hours
    const today = new Date();
    const weekStart = getWeekStart(today);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    const weekShifts = shifts.filter(s => {
        const date = new Date(s.shift_date);
        return date >= weekStart && date <= weekEnd;
    });
    
    let weekHours = 0;
    weekShifts.forEach(s => {
        weekHours += calculateDuration(s.start_time, s.end_time, s.break_minutes);
    });
    
    const estimatedPay = weekHours * currentEmployee.hourly_rate;
    
    document.getElementById('weekHours').textContent = weekHours.toFixed(1);
    document.getElementById('estimatedPay').textContent = `$${estimatedPay.toFixed(2)}`;
    document.getElementById('ptoBalance').textContent = `${currentEmployee.pto_balance} hrs`;
    
    // Next shift
    const nextShift = shifts[0];
    if (nextShift) {
        const date = new Date(nextShift.shift_date);
        document.getElementById('nextShift').textContent = formatDateShort(date);
    }
}

/**
 * Update profile info
 */
function updateProfileInfo() {
    document.getElementById('profileName').textContent = `${currentEmployee.first_name} ${currentEmployee.last_name}`;
    document.getElementById('profileCode').textContent = currentEmployee.employee_code;
    document.getElementById('profileRole').textContent = currentEmployee.role;
    document.getElementById('profileRate').textContent = `$${currentEmployee.hourly_rate.toFixed(2)}/hr`;
    document.getElementById('profileHireDate').textContent = formatDateShort(currentEmployee.hire_date);
    document.getElementById('availablePTO').textContent = currentEmployee.pto_balance;
    
    // Calculate totals (mock data)
    document.getElementById('totalHours').textContent = '520';
    document.getElementById('shiftsCompleted').textContent = '67';
    document.getElementById('attendanceRate').textContent = '98%';
}

/**
 * Open time off modal
 */
function openTimeOffModal() {
    const modal = document.getElementById('timeOffModal');
    const form = document.getElementById('timeOffForm');
    form.reset();
    
    // Set default dates
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    document.getElementById('startDate').value = formatDate(tomorrow);
    document.getElementById('endDate').value = formatDate(tomorrow);
    
    calculateTimeOff();
    openModal(modal);
}

/**
 * Calculate time off days/hours
 */
function calculateTimeOff() {
    const startDate = new Date(document.getElementById('startDate').value);
    const endDate = new Date(document.getElementById('endDate').value);
    
    if (startDate && endDate && endDate >= startDate) {
        const diffTime = Math.abs(endDate - startDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        const hours = diffDays * 8; // Assume 8 hour days
        
        document.getElementById('totalDays').textContent = diffDays;
        document.getElementById('totalRequestHours').textContent = hours;
        document.getElementById('remainingPTO').textContent = Math.max(0, currentEmployee.pto_balance - hours);
    }
}

/**
 * Handle time off form submission
 */
async function handleTimeOffSubmit(e) {
    e.preventDefault();

    try {
        const requestType = document.getElementById('requestType').value;
        const requestTypeMap = {
            vacation: 'pto',
            personal: 'pto',
            sick: 'sick',
            unpaid: 'unpaid'
        };

        const requestData = {
            employee_id: currentEmployee.id,
            business_id: currentBusiness.id,
            request_type: requestTypeMap[requestType] || requestType,
            start_date: document.getElementById('startDate').value,
            end_date: document.getElementById('endDate').value,
            total_hours: parseInt(document.getElementById('totalRequestHours').textContent, 10),
            reason: document.getElementById('requestReason').value.trim()
        };

        const token = sessionStorage.getItem('manage_token');
        const headers = {
            'Content-Type': 'application/json'
        };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${API_BASE}/time-off`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestData)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to submit request');
        }

        await response.json();
        showNotification('Time-off request submitted!', 'success');
        closeModal(document.getElementById('timeOffModal'));
        loadTimeOffRequests();
        switchTab('timeoff');
    } catch (error) {
        console.error('Failed to submit request:', error);
        showNotification(`Error: ${error.message}`, 'error');
    }
}

/**
 * Download schedule
 */
function downloadSchedule() {
    showNotification('Schedule download feature coming soon!', 'info');
}

/**
 * Helper functions
 */
function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
}

function calculateDuration(startTime, endTime, breakMinutes) {
    const start = new Date(`2000-01-01 ${startTime}`);
    const end = new Date(`2000-01-01 ${endTime}`);
    const diffMs = end - start;
    const diffHours = diffMs / (1000 * 60 * 60);
    return Math.max(0, diffHours - (breakMinutes / 60));
}

function formatTime(time) {
    const parts = time.split(':');
    const hour = parseInt(parts[0]);
    const min = parts[1];
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${min}${ampm}`;
}

function formatDate(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatDateLong(date) {
    return new Intl.DateTimeFormat('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    }).format(date);
}

function formatDateShort(dateStr) {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
    }).format(date);
}

function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function openModal(modal) {
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
}

function closeModal(modal) {
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
}

function showNotification(message, type = 'info') {
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
    setTimeout(() => notification.remove(), 4000);
}
