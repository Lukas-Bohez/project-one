/**
 * Schedule Manager - Interactive Calendar
 */

const API_BASE = '/api/v1/manage';

// State
let currentBusiness = null;
let currentWeekStart = null;
let employees = [];
let shifts = [];
let draggedShift = null;

// DOM Elements
const calendarBody = document.getElementById('calendarBody');
const weekDisplay = document.getElementById('weekDisplay');
const shiftModal = document.getElementById('shiftModal');
const quickFillModal = document.getElementById('quickFillModal');
const shiftForm = document.getElementById('shiftForm');
const quickFillForm = document.getElementById('quickFillForm');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadBusinessFromStorage();
    setCurrentWeek(new Date());
    attachEventListeners();
    loadEmployees();
});

/**
 * Load business from localStorage
 */
function loadBusinessFromStorage() {
    const saved = localStorage.getItem('manage_business');
    if (saved) {
        currentBusiness = JSON.parse(saved);
        document.getElementById('businessName').textContent = currentBusiness.name;
    } else {
        showNotification('No business found. Please log in.', 'error');
        setTimeout(() => window.location.href = '/pages/manage/', 2000);
    }
}

/**
 * Set current week and update display
 */
function setCurrentWeek(date) {
    currentWeekStart = getWeekStart(date);
    updateWeekDisplay();
    updateDayHeaders();
    loadShifts();
}

/**
 * Get the start of the week (Sunday)
 */
function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
}

/**
 * Update week display text
 */
function updateWeekDisplay() {
    const endDate = new Date(currentWeekStart);
    endDate.setDate(endDate.getDate() + 6);
    
    const formatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    weekDisplay.textContent = `Week of ${formatter.format(currentWeekStart)} - ${formatter.format(endDate)}`;
}

/**
 * Update day headers with correct dates
 */
function updateDayHeaders() {
    const headers = document.querySelectorAll('.day-header');
    headers.forEach((header, index) => {
        const date = new Date(currentWeekStart);
        date.setDate(date.getDate() + index);
        
        const dateEl = header.querySelector('.day-date');
        const formatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
        dateEl.textContent = formatter.format(date);
        
        // Highlight today
        const today = new Date();
        if (date.toDateString() === today.toDateString()) {
            header.style.background = 'rgba(0, 123, 255, 0.2)';
        } else {
            header.style.background = '';
        }
    });
}

/**
 * Attach event listeners
 */
function attachEventListeners() {
    // Week navigation
    document.getElementById('prevWeekBtn').addEventListener('click', () => {
        const newDate = new Date(currentWeekStart);
        newDate.setDate(newDate.getDate() - 7);
        setCurrentWeek(newDate);
    });
    
    document.getElementById('nextWeekBtn').addEventListener('click', () => {
        const newDate = new Date(currentWeekStart);
        newDate.setDate(newDate.getDate() + 7);
        setCurrentWeek(newDate);
    });
    
    document.getElementById('todayBtn').addEventListener('click', () => {
        setCurrentWeek(new Date());
    });
    
    // Modal buttons
    document.getElementById('addShiftBtn').addEventListener('click', () => openShiftModal());
    document.getElementById('quickFillBtn').addEventListener('click', () => openQuickFillModal());
    
    // Form submissions
    shiftForm.addEventListener('submit', handleShiftSubmit);
    quickFillForm.addEventListener('submit', handleQuickFillSubmit);
    
    // Modal close
    document.querySelectorAll('.c-modal__close').forEach(btn => {
        btn.addEventListener('click', () => closeModal(btn.closest('.c-modal')));
    });
    
    // Calculate shift duration on time change
    document.getElementById('shiftStart').addEventListener('change', updateShiftDuration);
    document.getElementById('shiftEnd').addEventListener('change', updateShiftDuration);
    document.getElementById('shiftBreak').addEventListener('input', updateShiftDuration);
    
    // Delete shift button
    document.getElementById('deleteShiftBtn').addEventListener('click', handleDeleteShift);
}

/**
 * Load employees
 */
async function loadEmployees() {
    if (!currentBusiness?.id) return;
    
    try {
        const token = localStorage.getItem('manage_token');
        const headers = {};
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        const response = await fetch(`${API_BASE}/businesses/${currentBusiness.id}/employees`, {
            headers: headers
        });
        
        if (response.ok) {
            employees = await response.json();
            populateEmployeeSelects();
            renderCalendar();
        } else {
            throw new Error('Failed to load employees');
        }
    } catch (error) {
        console.error('Failed to load employees:', error);
        showNotification('Failed to load employees from server', 'error');
        renderCalendar();
    }
}

/**
 * Populate employee select dropdowns
 */
function populateEmployeeSelects() {
    const selects = [
        document.getElementById('shiftEmployee'),
        document.getElementById('fillEmployee')
    ];
    
    selects.forEach(select => {
        select.innerHTML = '<option value="">Select employee...</option>';
        employees.forEach(emp => {
            const option = document.createElement('option');
            option.value = emp.id;
            option.textContent = `${emp.first_name} ${emp.last_name} (${emp.role || 'Employee'})`;
            select.appendChild(option);
        });
    });
}

/**
 * Load shifts for current week
 */
async function loadShifts() {
    if (!currentBusiness?.id) return;
    
    const startDate = formatDate(currentWeekStart);
    const endDate = new Date(currentWeekStart);
    endDate.setDate(endDate.getDate() + 6);
    const endDateStr = formatDate(endDate);
    
    try {
        const token = localStorage.getItem('manage_token');
        const headers = {};
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        const response = await fetch(`${API_BASE}/shifts?business_id=${currentBusiness.id}&start_date=${startDate}&end_date=${endDateStr}`, {
            headers: headers
        });
        
        if (response.ok) {
            shifts = await response.json();
        } else {
            shifts = [];
        }
        renderCalendar();
        updateWeeklySummary();
    } catch (error) {
        console.error('Failed to load shifts:', error);
        shifts = [];
        renderCalendar();
    }
}

/**
 * Render calendar grid
 */
function renderCalendar() {
    if (employees.length === 0) {
        calendarBody.innerHTML = '<div class="loading-state"><p>No employees found. Add employees to start scheduling.</p></div>';
        return;
    }
    
    calendarBody.innerHTML = '';
    
    employees.forEach(employee => {
        const row = document.createElement('div');
        row.className = 'employee-row';
        row.dataset.employeeId = employee.id;
        
        // Employee cell
        const employeeCell = document.createElement('div');
        employeeCell.className = 'employee-cell';
        employeeCell.innerHTML = `
            <div class="employee-name">${employee.first_name} ${employee.last_name}</div>
            <div class="employee-role">${employee.role || 'Employee'}</div>
        `;
        row.appendChild(employeeCell);
        
        // Day cells (7 days)
        for (let i = 0; i < 7; i++) {
            const date = new Date(currentWeekStart);
            date.setDate(date.getDate() + i);
            const dateStr = formatDate(date);
            
            const dayCell = document.createElement('div');
            dayCell.className = 'day-cell';
            dayCell.dataset.employeeId = employee.id;
            dayCell.dataset.date = dateStr;
            
            // Find shifts for this employee on this date
            const employeeShifts = shifts.filter(s => 
                s.employee_id === employee.id && s.shift_date === dateStr
            );
            
            employeeShifts.forEach(shift => {
                const shiftCard = createShiftCard(shift);
                dayCell.appendChild(shiftCard);
            });
            
            // Add hint
            const hint = document.createElement('div');
            hint.className = 'add-shift-hint';
            hint.textContent = '+ Add shift';
            dayCell.appendChild(hint);
            
            // Click to add shift
            dayCell.addEventListener('click', (e) => {
                if (e.target === dayCell || e.target.classList.contains('add-shift-hint')) {
                    openShiftModal(employee.id, dateStr);
                }
            });
            
            // Drag and drop
            dayCell.addEventListener('dragover', handleDragOver);
            dayCell.addEventListener('drop', handleDrop);
            
            row.appendChild(dayCell);
        }
        
        calendarBody.appendChild(row);
    });
}

/**
 * Create shift card element
 */
function createShiftCard(shift) {
    const card = document.createElement('div');
    card.className = `shift-card status-${shift.status || 'scheduled'}`;
    card.dataset.shiftId = shift.id;
    card.draggable = true;
    
    const duration = calculateDuration(shift.start_time, shift.end_time, shift.break_minutes || 0);
    
    card.innerHTML = `
        <div class="shift-time">${formatTime(shift.start_time)} - ${formatTime(shift.end_time)}</div>
        <div class="shift-duration">${duration}hrs</div>
        ${shift.notes ? `<div class="shift-notes">${shift.notes}</div>` : ''}
    `;
    
    card.addEventListener('click', (e) => {
        e.stopPropagation();
        openShiftModal(shift.employee_id, shift.shift_date, shift);
    });
    
    card.addEventListener('dragstart', handleDragStart);
    card.addEventListener('dragend', handleDragEnd);
    
    return card;
}

/**
 * Drag and drop handlers
 */
function handleDragStart(e) {
    draggedShift = e.target;
    e.target.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    return false;
}

async function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }
    
    const newEmployeeId = parseInt(e.currentTarget.dataset.employeeId);
    const newDate = e.currentTarget.dataset.date;
    const shiftId = parseInt(draggedShift.dataset.shiftId);
    
    // Find the shift
    const shift = shifts.find(s => s.id === shiftId);
    if (!shift) return;
    
    // Update shift (would call API here)
    shift.employee_id = newEmployeeId;
    shift.shift_date = newDate;
    
    showNotification('Shift moved successfully!', 'success');
    renderCalendar();
    
    return false;
}

/**
 * Open shift modal
 */
function openShiftModal(employeeId = null, date = null, shift = null) {
    document.getElementById('shiftModalTitle').textContent = shift ? 'Edit Shift' : 'Add Shift';
    
    if (shift) {
        document.getElementById('shiftId').value = shift.id;
        document.getElementById('shiftEmployee').value = shift.employee_id;
        document.getElementById('shiftDate').value = shift.shift_date;
        document.getElementById('shiftStart').value = shift.start_time;
        document.getElementById('shiftEnd').value = shift.end_time;
        document.getElementById('shiftBreak').value = shift.break_minutes || 30;
        document.getElementById('shiftNotes').value = shift.notes || '';
        document.getElementById('deleteShiftBtn').style.display = 'block';
    } else {
        shiftForm.reset();
        document.getElementById('shiftId').value = '';
        if (employeeId) document.getElementById('shiftEmployee').value = employeeId;
        if (date) document.getElementById('shiftDate').value = date;
        document.getElementById('deleteShiftBtn').style.display = 'none';
    }
    
    updateShiftDuration();
    openModal(shiftModal);
}

/**
 * Handle shift form submission
 */
async function handleShiftSubmit(e) {
    e.preventDefault();
    const shiftId = document.getElementById('shiftId').value;
    const shiftError = document.getElementById('shiftError');

    const shiftData = {
        employee_id: parseInt(document.getElementById('shiftEmployee').value, 10),
        business_id: currentBusiness.id,
        shift_date: document.getElementById('shiftDate').value,
        start_time: document.getElementById('shiftStart').value,
        end_time: document.getElementById('shiftEnd').value,
        break_minutes: parseInt(document.getElementById('shiftBreak').value, 10) || 0,
        notes: document.getElementById('shiftNotes').value.trim(),
        status: 'scheduled'
    };

    if (!shiftData.employee_id || !shiftData.shift_date || !shiftData.start_time || !shiftData.end_time) {
        shiftError.textContent = 'Please fill in all required fields.';
        shiftError.style.display = 'block';
        return;
    }

    try {
        shiftError.style.display = 'none';

        const token = localStorage.getItem('manage_token');
        const headers = {
            'Content-Type': 'application/json'
        };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${API_BASE}/shifts${shiftId ? `/${shiftId}` : ''}`, {
            method: shiftId ? 'PUT' : 'POST',
            headers: headers,
            body: JSON.stringify(shiftData)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to save shift');
        }

        await response.json();
        showNotification(`Shift ${shiftId ? 'updated' : 'created'} successfully!`, 'success');
        closeModal(shiftModal);
        loadShifts();
    } catch (error) {
        console.error('Failed to save shift:', error);
        shiftError.textContent = error.message || 'Failed to save shift';
        shiftError.style.display = 'block';
    }
}

/**
 * Delete shift
 */
async function handleDeleteShift() {
    const shiftId = document.getElementById('shiftId').value;
    if (!shiftId || !confirm('Delete this shift?')) return;

    try {
        const token = localStorage.getItem('manage_token');
        const headers = {};
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${API_BASE}/shifts/${shiftId}`, {
            method: 'DELETE',
            headers: headers
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to delete shift');
        }

        showNotification('Shift deleted', 'success');
        closeModal(shiftModal);
        loadShifts();
    } catch (error) {
        console.error('Failed to delete shift:', error);
        showNotification(error.message || 'Failed to delete shift', 'error');
    }
}

/**
 * Open quick fill modal
 */
function openQuickFillModal() {
    quickFillForm.reset();
    openModal(quickFillModal);
}

/**
 * Handle quick fill submission
 */
async function handleQuickFillSubmit(e) {
    e.preventDefault();

    const quickFillError = document.getElementById('quickFillError');
    const employeeId = parseInt(document.getElementById('fillEmployee').value, 10);
    const startTime = document.getElementById('fillStart').value;
    const endTime = document.getElementById('fillEnd').value;
    const checkedDays = Array.from(document.querySelectorAll('input[name="days"]:checked'))
        .map(input => parseInt(input.value, 10));

    if (!employeeId || !startTime || !endTime || checkedDays.length === 0) {
        quickFillError.textContent = 'Please select an employee, days, and times.';
        quickFillError.style.display = 'block';
        return;
    }

    try {
        quickFillError.style.display = 'none';

        const token = localStorage.getItem('manage_token');
        const headers = {
            'Content-Type': 'application/json'
        };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        let created = 0;

        for (let i = 0; i < 7; i++) {
            const date = new Date(currentWeekStart);
            date.setDate(date.getDate() + i);

            if (checkedDays.includes(date.getDay())) {
                const shiftData = {
                    employee_id: employeeId,
                    business_id: currentBusiness.id,
                    shift_date: formatDate(date),
                    start_time: startTime,
                    end_time: endTime,
                    break_minutes: 30,
                    status: 'scheduled'
                };

                const response = await fetch(`${API_BASE}/shifts`, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify(shiftData)
                });

                if (response.ok) {
                    created++;
                }
            }
        }

        showNotification(`Created ${created} shifts`, 'success');
        closeModal(quickFillModal);
        loadShifts();
    } catch (error) {
        console.error('Failed to create shifts:', error);
        quickFillError.textContent = 'Failed to create shifts.';
        quickFillError.style.display = 'block';
    }
}

/**
 * Update shift duration preview
 */
function updateShiftDuration() {
    const start = document.getElementById('shiftStart').value;
    const end = document.getElementById('shiftEnd').value;
    const breakMins = parseInt(document.getElementById('shiftBreak').value) || 0;
    
    if (start && end) {
        const duration = calculateDuration(start + ':00', end + ':00', breakMins);
        document.getElementById('shiftDuration').textContent = `${duration} hours`;
    }
}

/**
 * Update weekly summary
 */
function updateWeeklySummary() {
    const weekShifts = shifts.filter(s => {
        const shiftDate = new Date(s.shift_date);
        const weekEnd = new Date(currentWeekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        return shiftDate >= currentWeekStart && shiftDate <= weekEnd;
    });
    
    let totalHours = 0;
    let totalCost = 0;
    let overtimeHours = 0;
    
    weekShifts.forEach(shift => {
        const duration = calculateDuration(shift.start_time, shift.end_time, shift.break_minutes || 0);
        const employee = employees.find(e => e.id === shift.employee_id);
        const rate = employee?.hourly_rate || 15;
        
        totalHours += duration;
        totalCost += duration * rate;
        
        if (duration > 8) {
            overtimeHours += (duration - 8);
        }
    });
    
    document.getElementById('totalHours').textContent = totalHours.toFixed(1);
    document.getElementById('laborCost').textContent = `$${totalCost.toFixed(2)}`;
    document.getElementById('shiftsCount').textContent = weekShifts.length;
    document.getElementById('overtimeHours').textContent = overtimeHours.toFixed(1);
}

/**
 * Calculate duration in hours
 */
function calculateDuration(startTime, endTime, breakMinutes) {
    const start = new Date(`2000-01-01 ${startTime}`);
    const end = new Date(`2000-01-01 ${endTime}`);
    const diffMs = end - start;
    const diffHours = diffMs / (1000 * 60 * 60);
    return Math.max(0, diffHours - (breakMinutes / 60));
}

/**
 * Format time for display
 */
function formatTime(time) {
    const parts = time.split(':');
    const hour = parseInt(parts[0]);
    const min = parts[1];
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${min}${ampm}`;
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDate(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Modal helpers
 */
function openModal(modal) {
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
}

function closeModal(modal) {
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    const form = modal.querySelector('form');
    if (form) form.reset();
}

/**
 * Show notification
 */
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
