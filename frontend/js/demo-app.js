/**
 * Interactive Full Application Demo
 * Simulates complete manager and employee experiences
 * Uses ManageShared module for consistency with production app
 */

// Track which tasks are expanded (persists through refreshes)
const demoState = {
    expandedTasks: new Set(), // Task IDs that are currently expanded
    currentUser: null, // Currently logged in employee
    employeeCredentials: [ // Employee login credentials
        { id: 1, username: "alex", password: "demo123" },
        { id: 2, username: "jamie", password: "demo123" },
        { id: 3, username: "morgan", password: "demo123" },
        { id: 4, username: "casey", password: "demo123" },
        { id: 5, username: "taylor", password: "demo123" }
    ]
};

// Demo data - uses shared models
const demoData = {
    business: {
        name: "Sunrise Cafe",
        employees: [
            { id: 1, name: "Alex Rivera", role: "Server", hourly_rate: 15.50, color: "#3b82f6", username: "alex" },
            { id: 2, name: "Jamie Lee", role: "Barista", hourly_rate: 16.00, color: "#8b5cf6", username: "jamie" },
            { id: 3, name: "Morgan Patel", role: "Server", hourly_rate: 15.50, color: "#ec4899", username: "morgan" },
            { id: 4, name: "Casey Kim", role: "Cook", hourly_rate: 18.00, color: "#f59e0b", username: "casey" },
            { id: 5, name: "Taylor Chen", role: "Manager", hourly_rate: 22.00, color: "#10b981", username: "taylor" }
        ],
        shifts: [],
        timeOffRequests: [],
        tasks: []
    },
    currentEmployee: { id: 2, name: "Jamie Lee", role: "Barista", hourly_rate: 16.00 }
};

// Initialize sample shifts for the week
function initializeDemoShifts() {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay()); // Sunday
    
    const shifts = [];
    let shiftId = 1;
    
    // Generate shifts for each employee
    demoData.business.employees.forEach((emp, empIndex) => {
        // Different patterns for different employees
        const daysWorking = empIndex === 4 ? [1, 2, 3, 4, 5] : // Manager works weekdays
                           empIndex % 2 === 0 ? [0, 2, 4, 6] : [1, 3, 5]; // Alternating schedules
        
        daysWorking.forEach(dayOffset => {
            const shiftDate = new Date(startOfWeek);
            shiftDate.setDate(startOfWeek.getDate() + dayOffset);
            
            const startHour = empIndex === 4 ? 8 : (empIndex % 3 === 0 ? 9 : empIndex % 3 === 1 ? 12 : 17);
            const duration = empIndex === 4 ? 8 : 6;
            
            shifts.push({
                id: shiftId++,
                employee_id: emp.id,
                employee_name: emp.name,
                employee_color: emp.color,
                date: shiftDate.toISOString().split('T')[0],
                start_time: `${String(startHour).padStart(2, '0')}:00`,
                end_time: `${String(startHour + duration).padStart(2, '0')}:00`,
                hourly_rate: emp.hourly_rate,
                role: emp.role
            });
        });
    });
    
    demoData.business.shifts = shifts;
}

// Initialize time-off requests
function initializeDemoTimeOff() {
    demoData.business.timeOffRequests = [
        {
            id: 1,
            employee_id: 1,
            employee_name: "Alex Rivera",
            start_date: "2026-02-12",
            end_date: "2026-02-14",
            request_type: "vacation",
            total_hours: 24,
            status: "pending",
            notes: "Family trip - planned months ago"
        },
        {
            id: 2,
            employee_id: 3,
            employee_name: "Morgan Patel",
            start_date: "2026-02-10",
            end_date: "2026-02-10",
            request_type: "sick",
            total_hours: 6,
            status: "approved",
            notes: "Doctor's appointment"
        },
        {
            id: 3,
            employee_id: 2,
            employee_name: "Jamie Lee",
            start_date: "2026-02-20",
            end_date: "2026-02-21",
            request_type: "vacation",
            total_hours: 12,
            status: "pending",
            notes: "Concert weekend"
        }
    ];
}

// Initialize tasks using shared generator
function initializeDemoTasks() {
    if (window.ManageShared && window.ManageShared.generators) {
        demoData.business.tasks = window.ManageShared.generators.generateSampleTasks(demoData.business.employees);
    } else {
        // Fallback if shared module not loaded
        console.warn('ManageShared not loaded, tasks will not be available');
        demoData.business.tasks = [];
    }
}

// Render Manager Dashboard
function renderBossView() {
    return `
        <div class="demo-boss-dashboard">
            <!-- Top Stats -->
            <div class="demo-stats-grid">
                <div class="demo-stat-card">
                    <i class="fa-solid fa-users demo-stat-icon"></i>
                    <div class="demo-stat-content">
                        <div class="demo-stat-value">${demoData.business.employees.length}</div>
                        <div class="demo-stat-label">Active Employees</div>
                    </div>
                </div>
                <div class="demo-stat-card">
                    <i class="fa-solid fa-calendar-check demo-stat-icon"></i>
                    <div class="demo-stat-content">
                        <div class="demo-stat-value">${getTodayShifts().length}</div>
                        <div class="demo-stat-label">Shifts Today</div>
                    </div>
                </div>
                <div class="demo-stat-card">
                    <i class="fa-solid fa-clock demo-stat-icon"></i>
                    <div class="demo-stat-content">
                        <div class="demo-stat-value">${getWeeklyHours()}</div>
                        <div class="demo-stat-label">Weekly Hours</div>
                    </div>
                </div>
                <div class="demo-stat-card pending">
                    <i class="fa-solid fa-umbrella-beach demo-stat-icon"></i>
                    <div class="demo-stat-content">
                        <div class="demo-stat-value">${getPendingRequests().length}</div>
                        <div class="demo-stat-label">Pending Requests</div>
                    </div>
                </div>
            </div>

            <!-- Main Content Area -->
            <div class="demo-boss-main">
                <!-- Weekly Schedule Calendar -->
                <div class="demo-schedule-section">
                    <div class="demo-section-header">
                        <h4><i class="fa-solid fa-calendar-week"></i> Weekly Schedule</h4>
                        <button class="demo-action-btn" onclick="showAddShiftForm()">
                            <i class="fa-solid fa-plus"></i> Add Shift
                        </button>
                    </div>
                    <div class="demo-calendar">
                        ${renderWeeklyCalendar()}
                    </div>
                </div>

                <!-- Pending Time-Off Requests -->
                <div class="demo-timeoff-section">
                    <div class="demo-section-header">
                        <h4><i class="fa-solid fa-inbox"></i> Time-Off Requests</h4>
                        <span class="demo-badge">${getPendingRequests().length} pending</span>
                    </div>
                    <div class="demo-timeoff-list">
                        ${renderTimeOffRequests()}
                    </div>
                </div>

                <!-- Task Management -->
                <div class="demo-tasks-section">
                    <div class="demo-section-header">
                        <h4><i class="fa-solid fa-list-check"></i> Task Management</h4>
                        <button class="demo-action-btn" onclick="showCreateTaskForm()">
                            <i class="fa-solid fa-plus"></i> Create Task
                        </button>
                    </div>
                    <div class="demo-tasks-overview">
                        ${renderTasksOverview()}
                    </div>
                </div>

                <!-- Team Overview -->
                <div class="demo-team-section">
                    <div class="demo-section-header">
                        <h4><i class="fa-solid fa-users-gear"></i> Team Overview</h4>
                        <button class="ui-btn-small" onclick="showAddTeamMemberModal()">
                            <i class="fa-solid fa-user-plus"></i> Add Team Member
                        </button>
                    </div>
                    <div class="demo-team-list">
                        ${renderTeamList()}
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Render Employee Portal
function renderEmployeeView() {
    const employee = demoData.currentEmployee;
    const myShifts = demoData.business.shifts.filter(s => s.employee_id === employee.id);
    const myRequests = demoData.business.timeOffRequests.filter(r => r.employee_id === employee.id);
    const weekHours = myShifts.reduce((sum, shift) => {
        const start = parseFloat(shift.start_time.split(':')[0]);
        const end = parseFloat(shift.end_time.split(':')[0]);
        return sum + (end - start);
    }, 0);

    return `
        <div class="demo-employee-portal">
            <!-- Employee Header -->
            <div class="demo-employee-header">
                <div class="demo-employee-info">
                    <div class="demo-avatar">${employee.name.split(' ').map(n => n[0]).join('')}</div>
                    <div>
                        <h4>${employee.name}</h4>
                        <p class="demo-role">${employee.role} • $${employee.hourly_rate.toFixed(2)}/hr</p>
                    </div>
                </div>
                <button class="ui-btn-small" onclick="showEmployeeLoginModal()" style="background: #64748b;">
                    <i class="fa-solid fa-right-from-bracket"></i> Switch Employee
                </button>
            </div>

            <!-- Employee Stats -->
            <div class="demo-employee-stats">
                <div class="demo-employee-stat">
                    <i class="fa-solid fa-calendar-days"></i>
                    <div>
                        <div class="stat-value">${myShifts.length}</div>
                        <div class="stat-label">Shifts This Week</div>
                    </div>
                </div>
                <div class="demo-employee-stat">
                    <i class="fa-solid fa-clock"></i>
                    <div>
                        <div class="stat-value">${weekHours}h</div>
                        <div class="stat-label">Scheduled Hours</div>
                    </div>
                </div>
                <div class="demo-employee-stat">
                    <i class="fa-solid fa-dollar-sign"></i>
                    <div>
                        <div class="stat-value">$${(weekHours * employee.hourly_rate).toFixed(0)}</div>
                        <div class="stat-label">Expected Pay</div>
                    </div>
                </div>
            </div>

            <!-- My Schedule -->
            <div class="demo-employee-section">
                <div class="demo-section-header">
                    <h4><i class="fa-solid fa-calendar"></i> My Schedule</h4>
                </div>
                <div class="demo-employee-shifts">
                    ${renderEmployeeShifts(myShifts)}
                </div>
            </div>

            <!-- My Tasks -->
            <div class="demo-employee-section">
                <div class="demo-section-header">
                    <h4><i class="fa-solid fa-list-check"></i> My Tasks</h4>
                    <span class="demo-badge">${getMyTasks(employee.id).filter(t => t.status !== 'completed').length} active</span>
                </div>
                <div class="demo-employee-tasks">
                    ${renderEmployeeTasks(employee.id)}
                </div>
            </div>

            <!-- Time-Off Request Form -->
            <div class="demo-employee-section">
                <div class="demo-section-header">
                    <h4><i class="fa-solid fa-umbrella-beach"></i> Request Time Off</h4>
                </div>
                <div class="demo-timeoff-form">
                    ${renderTimeOffForm()}
                </div>
            </div>

            <!-- My Time-Off Requests -->
            <div class="demo-employee-section">
                <div class="demo-section-header">
                    <h4><i class="fa-solid fa-list"></i> My Requests</h4>
                    <span class="demo-badge">${myRequests.filter(r => r.status === 'pending').length} pending</span>
                </div>
                <div class="demo-employee-requests">
                    ${renderEmployeeRequests(myRequests)}
                </div>
            </div>
        </div>
    `;
}

// Calendar rendering
function renderWeeklyCalendar() {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    let html = '<div class="demo-calendar-grid">';
    
    // Header row
    html += '<div class="demo-calendar-header">Time</div>';
    for (let i = 0; i < 7; i++) {
        const date = new Date(startOfWeek);
        date.setDate(startOfWeek.getDate() + i);
        const isToday = date.toDateString() === today.toDateString();
        html += `<div class="demo-calendar-header ${isToday ? 'today' : ''}">
            ${days[i]}<br><span class="date-num">${date.getDate()}</span>
        </div>`;
    }
    
    // Time slots (8 AM to 10 PM)
    for (let hour = 8; hour <= 22; hour += 2) {
        html += `<div class="demo-time-label">${hour % 12 || 12}${hour < 12 ? 'am' : 'pm'}</div>`;
        
        for (let day = 0; day < 7; day++) {
            const date = new Date(startOfWeek);
            date.setDate(startOfWeek.getDate() + day);
            const dateStr = date.toISOString().split('T')[0];
            
            const shiftsInSlot = demoData.business.shifts.filter(shift => {
                if (shift.date !== dateStr) return false;
                const shiftStart = parseInt(shift.start_time.split(':')[0]);
                return shiftStart >= hour && shiftStart < hour + 2;
            });
            
            html += `<div class="demo-calendar-cell">`;
            shiftsInSlot.forEach(shift => {
                html += renderShiftBlock(shift);
            });
            html += `</div>`;
        }
    }
    
    html += '</div>';
    return html;
}

function renderShiftBlock(shift) {
    return `
        <div class="demo-shift-block" style="border-left: 4px solid ${shift.employee_color}" 
             onclick="viewShiftDetails(${shift.id})" title="Click to view details">
            <div class="shift-employee">${shift.employee_name}</div>
            <div class="shift-time">${formatTime(shift.start_time)} - ${formatTime(shift.end_time)}</div>
        </div>
    `;
}

function renderTimeOffRequests() {
    const pending = getPendingRequests();
    
    if (pending.length === 0) {
        return '<div class="demo-empty-state"><i class="fa-regular fa-circle-check"></i> All caught up!</div>';
    }
    
    return pending.map(request => `
        <div class="demo-request-card">
            <div class="demo-request-header">
                <div class="demo-request-employee">
                    <div class="demo-avatar-sm">${request.employee_name.split(' ').map(n => n[0]).join('')}</div>
                    <div>
                        <div class="request-name">${request.employee_name}</div>
                        <div class="request-type">${capitalizeFirst(request.request_type)} • ${request.total_hours} hours</div>
                    </div>
                </div>
                <span class="demo-badge-status pending">Pending</span>
            </div>
            <div class="demo-request-body">
                <div class="request-dates">
                    <i class="fa-regular fa-calendar"></i>
                    ${formatDate(request.start_date)} ${request.start_date !== request.end_date ? `- ${formatDate(request.end_date)}` : ''}
                </div>
                ${request.notes ? `<div class="request-notes">"${request.notes}"</div>` : ''}
            </div>
            <div class="demo-request-actions">
                <button class="demo-btn demo-btn-success" onclick="approveRequest(${request.id})">
                    <i class="fa-solid fa-check"></i> Approve
                </button>
                <button class="demo-btn demo-btn-danger" onclick="denyRequest(${request.id})">
                    <i class="fa-solid fa-times"></i> Deny
                </button>
            </div>
        </div>
    `).join('');
}

function renderTeamList() {
    return demoData.business.employees.map(emp => {
        const shifts = demoData.business.shifts.filter(s => s.employee_id === emp.id);
        const hours = shifts.reduce((sum, shift) => {
            const start = parseFloat(shift.start_time.split(':')[0]);
            const end = parseFloat(shift.end_time.split(':')[0]);
            return sum + (end - start);
        }, 0);
        
        const myTasks = demoData.business.tasks.filter(t => t.assigned_to === emp.id);
        const busyTasks = myTasks.filter(t => t.status === 'in_progress');
        
        return `
            <div class="demo-team-card">
                <div class="demo-team-info">
                    <div class="demo-avatar" style="background: ${emp.color}">${emp.name.split(' ').map(n => n[0]).join('')}</div>
                    <div style="flex: 1;">
                        <div class="team-name">${emp.name}</div>
                        <div class="team-role">${emp.role}</div>
                        <div style="font-size: 0.75rem; color: #64748b; margin-top: 0.25rem;">
                            <i class="fa-solid fa-user-circle"></i> ${emp.username || 'No username'}
                        </div>
                    </div>
                    ${busyTasks.length > 0 ? `
                        <div style="background: #fef3c7; color: #92400e; padding: 0.375rem 0.75rem; border-radius: 20px; font-size: 0.75rem; font-weight: 700;">
                            <i class="fa-solid fa-briefcase"></i> BUSY (${busyTasks.length})
                        </div>
                    ` : ''}
                </div>
                <div class="demo-team-stats">
                    <div class="team-stat">
                        <i class="fa-solid fa-calendar"></i> ${shifts.length} shifts
                    </div>
                    <div class="team-stat">
                        <i class="fa-solid fa-clock"></i> ${hours}h
                    </div>
                    <div class="team-stat">
                        <i class="fa-solid fa-dollar-sign"></i> $${emp.hourly_rate.toFixed(2)}/hr
                    </div>
                </div>
                <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid #e2e8f0;">
                    <button class="ui-btn-small" onclick="quickLoginAs(${emp.id})" style="width: 100%;">
                        <i class="fa-solid fa-right-to-bracket"></i> Login as ${emp.name.split(' ')[0]}
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function renderEmployeeShifts(shifts) {
    if (shifts.length === 0) {
        return '<div class="demo-empty-state"><i class="fa-regular fa-calendar"></i> No shifts scheduled this week</div>';
    }
    
    return shifts.sort((a, b) => new Date(a.date) - new Date(b.date)).map(shift => {
        const hours = parseFloat(shift.end_time.split(':')[0]) - parseFloat(shift.start_time.split(':')[0]);
        const pay = hours * shift.hourly_rate;
        
        return `
            <div class="demo-employee-shift-card">
                <div class="shift-date-badge">${formatDateWithDay(shift.date)}</div>
                <div class="shift-details">
                    <div class="shift-time-large">
                        <i class="fa-regular fa-clock"></i>
                        ${formatTime(shift.start_time)} - ${formatTime(shift.end_time)}
                    </div>
                    <div class="shift-meta">
                        <span><i class="fa-solid fa-hourglass-half"></i> ${hours} hours</span>
                        <span><i class="fa-solid fa-dollar-sign"></i> $${pay.toFixed(2)}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function renderTimeOffForm() {
    return `
        <form class="demo-form" onsubmit="submitTimeOffRequest(event)">
            <div class="demo-form-row">
                <div class="demo-form-group">
                    <label><i class="fa-solid fa-calendar-day"></i> Start Date</label>
                    <input type="date" id="demoStartDate" class="demo-input" required>
                </div>
                <div class="demo-form-group">
                    <label><i class="fa-solid fa-calendar-day"></i> End Date</label>
                    <input type="date" id="demoEndDate" class="demo-input" required>
                </div>
            </div>
            <div class="demo-form-group">
                <label><i class="fa-solid fa-tag"></i> Request Type</label>
                <select id="demoRequestType" class="demo-input" required>
                    <option value="vacation">Vacation</option>
                    <option value="sick">Sick Leave</option>
                    <option value="personal">Personal Day</option>
                </select>
            </div>
            <div class="demo-form-group">
                <label><i class="fa-solid fa-message"></i> Notes (Optional)</label>
                <textarea id="demoNotes" class="demo-input" rows="3" placeholder="Any details you'd like to share..."></textarea>
            </div>
            <button type="submit" class="demo-btn demo-btn-primary demo-btn-block">
                <i class="fa-solid fa-paper-plane"></i> Submit Request
            </button>
        </form>
    `;
}

function renderEmployeeRequests(requests) {
    if (requests.length === 0) {
        return '<div class="demo-empty-state"><i class="fa-regular fa-folder-open"></i> No time-off requests yet</div>';
    }
    
    return requests.sort((a, b) => b.id - a.id).map(request => `
        <div class="demo-employee-request-card status-${request.status}">
            <div class="request-header-emp">
                <span class="demo-badge-status ${request.status}">${capitalizeFirst(request.status)}</span>
                <span class="request-type-badge">${capitalizeFirst(request.request_type)}</span>
            </div>
            <div class="request-dates-emp">
                <i class="fa-regular fa-calendar"></i>
                ${formatDate(request.start_date)} ${request.start_date !== request.end_date ? `- ${formatDate(request.end_date)}` : ''}
            </div>
            <div class="request-hours">${request.total_hours} hours</div>
            ${request.notes ? `<div class="request-notes-emp">"${request.notes}"</div>` : ''}
        </div>
    `).join('');
}

// Helper functions
function getTodayShifts() {
    const today = new Date().toISOString().split('T')[0];
    return demoData.business.shifts.filter(s => s.date === today);
}

function getWeeklyHours() {
    return demoData.business.shifts.reduce((sum, shift) => {
        const start = parseFloat(shift.start_time.split(':')[0]);
        const end = parseFloat(shift.end_time.split(':')[0]);
        return sum + (end - start);
    }, 0);
}

function getPendingRequests() {
    return demoData.business.timeOffRequests.filter(r => r.status === 'pending');
}

function formatTime(time) {
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours);
    return `${h % 12 || 12}:${minutes}${h < 12 ? 'am' : 'pm'}`;
}

function formatDate(dateStr) {
    const date = new Date(dateStr + 'T12:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDateWithDay(dateStr) {
    const date = new Date(dateStr + 'T12:00:00');
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// Interactive functions
function viewShiftDetails(shiftId) {
    const shift = demoData.business.shifts.find(s => s.id === shiftId);
    if (!shift) return;
    
    const hours = parseFloat(shift.end_time.split(':')[0]) - parseFloat(shift.start_time.split(':')[0]);
    const cost = hours * shift.hourly_rate;
    
    showDemoNotification(`
        <strong>${shift.employee_name}</strong><br>
        ${formatDateWithDay(shift.date)}<br>
        ${formatTime(shift.start_time)} - ${formatTime(shift.end_time)} (${hours}h)<br>
        Cost: $${cost.toFixed(2)}
    `, 'info');
}

function approveRequest(requestId) {
    const request = demoData.business.timeOffRequests.find(r => r.id === requestId);
    if (request) {
        request.status = 'approved';
        showDemoNotification(`✓ Approved ${request.employee_name}'s time-off request`, 'success');
        refreshDemo();
    }
}

function denyRequest(requestId) {
    const request = demoData.business.timeOffRequests.find(r => r.id === requestId);
    if (request) {
        request.status = 'denied';
        showDemoNotification(`Request denied for ${request.employee_name}`, 'info');
        refreshDemo();
    }
}

function submitTimeOffRequest(event) {
    event.preventDefault();
    
    const startDate = document.getElementById('demoStartDate').value;
    const endDate = document.getElementById('demoEndDate').value;
    const requestType = document.getElementById('demoRequestType').value;
    const notes = document.getElementById('demoNotes').value;
    
    // Calculate hours (simplified)
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    const hours = days * 6; // Assume 6 hour shifts
    
    const newRequest = {
        id: demoData.business.timeOffRequests.length + 1,
        employee_id: demoData.currentEmployee.id,
        employee_name: demoData.currentEmployee.name,
        start_date: startDate,
        end_date: endDate,
        request_type: requestType,
        total_hours: hours,
        status: 'pending',
        notes: notes
    };
    
    demoData.business.timeOffRequests.push(newRequest);
    showDemoNotification('✓ Time-off request submitted successfully!', 'success');
    
    // Reset form
    event.target.reset();
    
    setTimeout(refreshDemo, 500);
}

function showAddShiftForm() {
    const employees = demoData.business.employees || [];
    
    const formHTML = `
        <form class="ui-task-form" onsubmit="event.preventDefault(); handleAddShift(event)">
            <div class="ui-form-row">
                <div class="ui-form-group">
                    <label><i class="fa-solid fa-user"></i> Employee</label>
                    <select name="employee_id" class="ui-input" required>
                        <option value="">Select employee...</option>
                        ${employees.map(emp => `<option value="${emp.id}">${emp.name} - ${emp.role}</option>`).join('')}
                    </select>
                </div>
                
                <div class="ui-form-group">
                    <label><i class="fa-solid fa-calendar"></i> Shift Date</label>
                    <input type="date" name="shift_date" class="ui-input" required>
                </div>
            </div>
            
            <div class="ui-form-row">
                <div class="ui-form-group">
                    <label><i class="fa-solid fa-clock"></i> Start Time</label>
                    <input type="time" name="start_time" class="ui-input" required>
                </div>
                
                <div class="ui-form-group">
                    <label><i class="fa-solid fa-clock"></i> End Time</label>
                    <input type="time" name="end_time" class="ui-input" required>
                </div>
            </div>
            
            <div class="ui-form-row">
                <div class="ui-form-group full-width">
                    <label><i class="fa-solid fa-align-left"></i> Notes (Optional)</label>
                    <textarea name="notes" class="ui-input" rows="2" placeholder="e.g., Morning shift, Training..."></textarea>
                </div>
            </div>
            
            <div class="ui-form-actions">
                <button type="button" class="ui-btn ui-btn-secondary" onclick="ManageUI.modal.close()">
                    Cancel
                </button>
                <button type="submit" class="ui-btn ui-btn-primary">
                    <i class="fa-solid fa-calendar-plus"></i> Create Shift
                </button>
            </div>
        </form>
    `;
    
    if (window.ManageUI) {
        window.ManageUI.modal.show('Add Shift', formHTML, 'medium');
    }
}

// Task Management Functions
function renderTasksOverview() {
    const tasks = demoData.business.tasks || [];
    const stats = window.ManageShared?.taskManager.getTaskStats(tasks) || {
        total: 0, todo: 0, in_progress: 0, completed: 0, overdue: 0
    };
    
    const todoTasks = tasks.filter(t => t.status === 'todo');
    const inProgressTasks = tasks.filter(t => t.status === 'in_progress');
    const completedTasks = tasks.filter(t => t.status === 'completed');
    
    return `
        <div class="demo-task-stats">
            <div class="task-stat-card">
                <i class="fa-solid fa-circle"></i>
                <div>
                    <div class="stat-num">${stats.todo}</div>
                    <div class="stat-lbl">To Do</div>
                </div>
            </div>
            <div class="task-stat-card">
                <i class="fa-solid fa-spinner"></i>
                <div>
                    <div class="stat-num">${stats.in_progress}</div>
                    <div class="stat-lbl">In Progress</div>
                </div>
            </div>
            <div class="task-stat-card">
                <i class="fa-solid fa-check-circle"></i>
                <div>
                    <div class="stat-num">${stats.completed}</div>
                    <div class="stat-lbl">Completed</div>
                </div>
            </div>
            <div class="task-stat-card urgent">
                <i class="fa-solid fa-triangle-exclamation"></i>
                <div>
                    <div class="stat-num">${stats.overdue}</div>
                    <div class="stat-lbl">Overdue</div>
                </div>
            </div>
        </div>
        <div class="demo-tasks-grid">
            <div class="tasks-column">
                <h5><i class="fa-solid fa-list"></i> To Do (${todoTasks.length})</h5>
                <button class="ui-btn-small" onclick="showNewTaskModal()">
                    <i class="fa-solid fa-plus"></i> New Task
                </button>
                ${todoTasks.length > 0 ? todoTasks.map(t => renderTaskCard(t, 'boss')).join('') : '<div class="empty-tasks">No tasks</div>'}
            </div>
            <div class="tasks-column">
                <h5><i class="fa-solid fa-spinner"></i> In Progress (${inProgressTasks.length})</h5>
                ${inProgressTasks.length > 0 ? inProgressTasks.map(t => renderTaskCard(t, 'boss')).join('') : '<div class="empty-tasks">No tasks</div>'}
            </div>
            <div class="tasks-column">
                <h5><i class="fa-solid fa-check-circle"></i> Completed (${completedTasks.length})</h5>
                ${completedTasks.length > 0 ? completedTasks.map(t => renderTaskCard(t, 'boss')).join('') : '<div class="empty-tasks">No completed tasks</div>'}
            </div>
        </div>
    `;
}

function renderTaskCard(task, view = 'boss') {
    // Use shared UI component but add action buttons
    if (!window.ManageUI) return '';
    
    const shared = window.ManageShared;
    const priorityColor = task.getPriorityColor();
    const isOverdue = task.isOverdue();
    const categoryIcon = shared?.taskManager.categoryIcons[task.category] || 'fa-list';
    const priorityIcon = shared?.taskManager.priorityIcons[task.priority] || 'fa-minus';
    const hasSubtasks = task.hasSubtasks();
    const completionPct = task.getCompletionPercentage();
    const subtasksId = `subtasks-${task.id}`;
    
    return `
        <div class="ui-task-card ${isOverdue ? 'overdue' : ''} ${task.status}" 
             data-task-id="${task.id}"
             data-current-status="${task.status}">
            
            <div class="ui-task-header">
                <div class="ui-task-icon-priority">
                    <i class="fa-solid ${categoryIcon}" style="color: ${priorityColor}"></i>
                    <span class="ui-task-priority" style="color: ${priorityColor}">
                        <i class="fa-solid ${priorityIcon}"></i>
                        ${shared?.taskManager.priorityLabels[task.priority] || task.priority}
                    </span>
                </div>
                ${hasSubtasks ? `
                    <button class="ui-task-expand-btn" onclick="event.stopPropagation(); toggleSubtasksVisibility('${subtasksId}', this)">
                        <i class="fa-solid ${demoState.expandedTasks.has(task.id) ? 'fa-chevron-up' : 'fa-chevron-down'}"></i>
                    </button>
                ` : ''}
            </div>
            
            <h6 class="ui-task-title">${task.title}</h6>
            
            ${task.description ? `<p class="ui-task-description">${task.description}</p>` : ''}
            
            ${hasSubtasks ? `
                <div class="ui-task-progress">
                    <div class="ui-progress-bar">
                        <div class="ui-progress-fill" style="width: ${completionPct}%; background: ${priorityColor}"></div>
                    </div>
                    <span class="ui-progress-text">${completionPct}% Complete (${task.subtasks.filter(st => st.status === 'completed').length}/${task.subtasks.length})</span>
                </div>
            ` : ''}
            
            <div class="ui-task-meta">
                <span class="ui-task-assignee">
                    <i class="fa-solid fa-user"></i> ${task.assigned_name}
                </span>
                ${task.due_date ? `
                    <span class="ui-task-due ${isOverdue ? 'overdue' : ''}">
                        <i class="fa-regular fa-calendar"></i> ${shared?.utils.formatDate(task.due_date)}
                    </span>
                ` : ''}
                <span class="ui-task-status-badge ${task.status}">
                    ${shared?.taskManager.statusLabels[task.status] || task.status}
                </span>
            </div>
            
            ${isOverdue && task.status !== 'completed' ? '<div class="ui-overdue-badge"><i class="fa-solid fa-exclamation-triangle"></i> Overdue</div>' : ''}
            
            ${hasSubtasks ? `
                <div class="ui-task-subtasks" id="${subtasksId}" style="display: ${demoState.expandedTasks.has(task.id) ? 'block' : 'none'};">
                    <div class="ui-subtasks-header">
                        <i class="fa-solid fa-list-check"></i> Subtasks
                    </div>
                    ${task.subtasks.map(subtask => renderSubtaskCard(task.id, subtask)).join('')}
                </div>
            ` : ''}
            
            ${task.status !== 'completed' ? `
                <div style="display: flex; gap: 0.5rem; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--color-border, #e2e8f0);">
                    ${task.status === 'todo' ? `
                        <button class="ui-btn-small" onclick="event.stopPropagation(); changeTaskStatus(${task.id}, 'in_progress')" style="flex: 1;">
                            <i class="fa-solid fa-play"></i> Start Task
                        </button>
                    ` : ''}
                    ${task.status === 'in_progress' ? `
                        <button class="ui-btn-small" onclick="event.stopPropagation(); changeTaskStatus(${task.id}, 'todo')" style="flex: 1; background: #64748b;">
                            <i class="fa-solid fa-pause"></i> Pause
                        </button>
                    ` : ''}
                    <button class="ui-btn-small" onclick="event.stopPropagation(); changeTaskStatus(${task.id}, 'completed')" style="flex: 1; background: #10b981;">
                        <i class="fa-solid fa-check"></i> Complete
                    </button>
                </div>
            ` : `
                <div style="display: flex; gap: 0.5rem; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--color-border, #e2e8f0);">
                    <button class="ui-btn-small" onclick="event.stopPropagation(); changeTaskStatus(${task.id}, 'todo')" style="flex: 1; background: #64748b;">
                        <i class="fa-solid fa-rotate-left"></i> Reopen Task
                    </button>
                </div>
            `}
        </div>
    `;
}

function renderSubtaskCard(taskId, subtask) {
    const isCompleted = subtask.status === 'completed';
    const isInProgress = subtask.status === 'in_progress';
    
    return `
        <div class="ui-subtask-card ${subtask.status}" 
             data-task-id="${taskId}"
             data-subtask-id="${subtask.id}"
             onclick="toggleSubtaskStatus(${taskId}, ${subtask.id}, event)">
            
            <div class="ui-subtask-checkbox ${isCompleted ? 'checked' : isInProgress ? 'in-progress' : ''}">
                <i class="fa-solid ${isCompleted ? 'fa-check' : isInProgress ? 'fa-spinner fa-spin' : ''}" style="font-size: 0.75rem;"></i>
            </div>
            
            <div class="ui-subtask-content">
                <span class="ui-subtask-title ${isCompleted ? 'completed' : ''}">${subtask.title}</span>
            </div>
        </div>
    `;
}

function renderEmployeeTasks(employeeId) {
    const myTasks = getMyTasks(employeeId);
    
    if (myTasks.length === 0) {
        return '<div class="demo-empty-state"><i class="fa-regular fa-circle-check"></i> No tasks assigned</div>';
    }
    
    const sortedTasks = myTasks.sort((a, b) => {
        if (a.status === 'completed' && b.status !== 'completed') return 1;
        if (a.status !== 'completed' && b.status === 'completed') return -1;
        return 0;
    });
    
    return sortedTasks.map(task => renderTaskCard(task, 'employee')).join('');
}

function getMyTasks(employeeId) {
    return (demoData.business.tasks || []).filter(t => t.assigned_to === employeeId);
}

function changeTaskStatus(taskId, newStatus) {
    const task = demoData.business.tasks.find(t => t.id === taskId);
    if (!task) return;
    
    task.status = newStatus;
    
    if (newStatus === 'completed') {
        task.completed_at = new Date().toISOString();
        // Mark all subtasks as completed
        if (task.subtasks) {
            task.subtasks.forEach(st => {
                st.status = 'completed';
                st.completed_at = new Date().toISOString();
            });
        }
        showDemoNotification(`✓ Task "${task.title}" completed!`, 'success');
    } else {
        task.completed_at = null;
        const shared = window.ManageShared;
        showDemoNotification(
            `Task "${task.title}" moved to ${shared?.taskManager.statusLabels[newStatus] || newStatus}`,
            'info'
        );
    }
    
    refreshDemo();
}

function toggleSubtasksVisibility(subtasksId, button) {
    const subtasksEl = document.getElementById(subtasksId);
    if (!subtasksEl) return;
    
    const icon = button.querySelector('i');
    const taskId = parseInt(subtasksId.replace('subtasks-', ''));
    
    if (subtasksEl.style.display === 'none') {
        subtasksEl.style.display = 'block';
        icon.classList.remove('fa-chevron-down');
        icon.classList.add('fa-chevron-up');
        demoState.expandedTasks.add(taskId);
    } else {
        subtasksEl.style.display = 'none';
        icon.classList.remove('fa-chevron-up');
        icon.classList.add('fa-chevron-down');
        demoState.expandedTasks.delete(taskId);
    }
}

function toggleSubtaskStatus(taskId, subtaskId, event) {
    if (event) event.stopPropagation();
    
    const task = demoData.business.tasks.find(t => t.id === taskId);
    if (!task || !task.subtasks) return;
    
    const subtask = task.subtasks.find(st => st.id === subtaskId);
    if (!subtask) return;
    
    // Toggle ONLY between pending and completed (never in_progress for subtasks)
    const wasCompleted = subtask.status === 'completed';
    
    if (wasCompleted) {
        subtask.status = 'pending';
        subtask.completed_at = null;
        showDemoNotification(`Subtask "${subtask.title}" reopened`, 'info');
        
        // If task was completed, move it back to in_progress
        if (task.status === 'completed') {
            task.status = 'in_progress';
            task.completed_at = null;
        }
    } else {
        // Always go straight to completed, regardless of current status
        subtask.status = 'completed';
        subtask.completed_at = new Date().toISOString();
        showDemoNotification(`✓ Subtask "${subtask.title}" completed`, 'success');
        
        // If all subtasks completed, complete the task
        const allCompleted = task.subtasks.every(st => st.status === 'completed');
        if (allCompleted) {
            task.status = 'completed';
            task.completed_at = new Date().toISOString();
            showDemoNotification(`🎉 All subtasks done! Task "${task.title}" completed!`, 'success');
        } else if (task.status === 'todo') {
            task.status = 'in_progress';
        }
    }
    
    // Update just this subtask and progress bar in the DOM instead of full refresh
    updateSubtaskInDOM(taskId, subtaskId, subtask);
    updateTaskProgressInDOM(taskId, task);
}

function updateTaskStatus(taskId, newStatus = null) {
    const task = demoData.business.tasks.find(t => t.id === taskId);
    if (!task) return;
    
    if (newStatus) {
        task.status = newStatus;
    } else {
        const statuses = ['todo', 'in_progress', 'completed'];
        const currentIndex = statuses.indexOf(task.status);
        task.status = statuses[(currentIndex + 1) % statuses.length];
    }
    
    if (task.status === 'completed') {
        task.completed_at = new Date().toISOString();
        showDemoNotification(`✓ Task "${task.title}" completed!`, 'success');
    } else {
        task.completed_at = null;
        const shared = window.ManageShared;
        showDemoNotification(
            `Task updated to ${shared?.taskManager.statusLabels[task.status] || task.status}`,
            'info'
        );
    }
    
    refreshDemo();
}

function showCreateTaskForm() {
    showNewTaskModal();
}

function showDemoNotification(message, type = 'info') {
    if (window.ManageShared?.notification) {
        window.ManageShared.notification.show(message, type);
    } else {
        // Fallback
        const notification = document.createElement('div');
        notification.className = `demo-notification demo-notification-${type}`;
        notification.innerHTML = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

function refreshDemo() {
    const currentView = document.querySelector('.view-switch-btn.is-active').dataset.view;
    const container = document.getElementById('demoAppContainer');
    if (container) {
        container.innerHTML = currentView === 'boss' ? renderBossView() : renderEmployeeView();
    }
}

// Initialize demo when page loads
function initializeDemo() {
    initializeDemoShifts();
    initializeDemoTimeOff();
    initializeDemoTasks();
    
    const container = document.getElementById('demoAppContainer');
    if (!container) return;
    
    // Render initial boss view
    container.innerHTML = renderBossView();
    
    // Setup view switcher
    const viewButtons = document.querySelectorAll('.view-switch-btn');
    viewButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            viewButtons.forEach(b => b.classList.remove('is-active'));
            btn.classList.add('is-active');
            
            const view = btn.dataset.view;
            container.innerHTML = view === 'boss' ? renderBossView() : renderEmployeeView();
        });
    });
}

// ============================================
// INTERACTIVE TASK FUNCTIONS
// ============================================

// Update subtask in DOM without full refresh
function updateSubtaskInDOM(taskId, subtaskId, subtask) {
    const subtaskEl = document.querySelector(`.ui-subtask-card[data-task-id="${taskId}"][data-subtask-id="${subtaskId}"]`);
    if (!subtaskEl) return;
    
    const isCompleted = subtask.status === 'completed';
    const checkbox = subtaskEl.querySelector('.ui-subtask-checkbox');
    const icon = checkbox.querySelector('i');
    const title = subtaskEl.querySelector('.ui-subtask-title');
    
    // Update classes
    subtaskEl.className = `ui-subtask-card ${subtask.status}`;
    checkbox.className = `ui-subtask-checkbox ${isCompleted ? 'checked' : ''}`;
    title.className = `ui-subtask-title ${isCompleted ? 'completed' : ''}`;
    
    // Update icon
    icon.className = `fa-solid ${isCompleted ? 'fa-check' : ''}`;
    icon.style.fontSize = '0.75rem';
}

// Update task progress bar in DOM
function updateTaskProgressInDOM(taskId, task) {
    const taskCard = document.querySelector(`.ui-task-card[data-task-id="${taskId}"]`);
    if (!taskCard) return;
    
    const completionPct = task.getCompletionPercentage();
    const progressFill = taskCard.querySelector('.ui-progress-fill');
    const progressText = taskCard.querySelector('.ui-progress-text');
    const statusBadge = taskCard.querySelector('.ui-task-status-badge');
    
    if (progressFill) {
        progressFill.style.width = `${completionPct}%`;
    }
    
    if (progressText) {
        const completed = task.subtasks.filter(st => st.status === 'completed').length;
        progressText.textContent = `${completionPct}% Complete (${completed}/${task.subtasks.length})`;
    }
    
    if (statusBadge) {
        const shared = window.ManageShared;
        statusBadge.className = `ui-task-status-badge ${task.status}`;
        statusBadge.textContent = shared?.taskManager.statusLabels[task.status] || task.status;
    }
    
    // If task status changed significantly, do a refresh to move it to correct column
    const currentStatus = taskCard.getAttribute('data-current-status');
    if (currentStatus && currentStatus !== task.status) {
        setTimeout(() => refreshDemo(), 500); // Delay to show the animation first
    }
}

function showNewTaskModal() {
    if (!window.ManageUI || !window.ManageShared) return;
    
    const employees = demoData.business.employees || [];
    const employeeOptions = employees.map(e => ({
        id: e.id,
        name: e.name,
        role: e.role
    }));
    
    const formHTML = window.ManageUI.tasks.renderTaskForm(
        employeeOptions,
        'handleTaskFormSubmit'
    );
    
    window.ManageUI.modal.show(
        'Create New Task',
        formHTML,
        'medium'
    );
}

function handleTaskFormSubmit(event) {
    const formData = new FormData(event.target);
    const taskData = {
        title: formData.get('title'),
        description: formData.get('description'),
        assigned_to: formData.get('assigned_to'),
        priority: formData.get('priority'),
        category: formData.get('category'),
        due_date: formData.get('due_date')
    };
    createNewTask(taskData);
}

function createNewTask(taskData) {
    const employeeId = parseInt(taskData.assigned_to);
    const employee = demoData.business.employees.find(e => e.id === employeeId);
    
    const newTask = {
        id: demoData.business.tasks.length > 0 ? Math.max(...demoData.business.tasks.map(t => t.id)) + 1 : 1,
        title: taskData.title,
        description: taskData.description || '',
        assigned_to: employeeId,
        assigned_name: employee?.name || 'Unknown',
        priority: taskData.priority || 'medium',
        category: taskData.category || 'general',
        status: 'todo',
        due_date: taskData.due_date || null,
        created_at: new Date().toISOString(),
        completed_at: null,
        subtasks: []
    };
    
    demoData.business.tasks.push(newTask);
    
    if (window.ManageUI) {
        window.ManageUI.modal.close();
        window.ManageUI.notification.show(`✓ Task "${newTask.title}" created successfully!`, 'success');
    }
    
    refreshDemo();
}

function handleAddShift(event) {
    const formData = new FormData(event.target);
    const employeeId = parseInt(formData.get('employee_id'));
    const employee = demoData.business.employees.find(e => e.id === employeeId);
    
    const shiftDate = new Date(formData.get('shift_date'));
    const startTime = formData.get('start_time');
    const endTime = formData.get('end_time');
    
    // Create start and end datetime objects
    const [startHour, startMin] = startTime.split(':');
    const [endHour, endMin] = endTime.split(':');
    
    const startDatetime = new Date(shiftDate);
    startDatetime.setHours(parseInt(startHour), parseInt(startMin));
    
    const endDatetime = new Date(shiftDate);
    endDatetime.setHours(parseInt(endHour), parseInt(endMin));
    
    const newShift = {
        id: demoData.business.shifts.length > 0 ? Math.max(...demoData.business.shifts.map(s => s.id)) + 1 : 1,
        employee_id: employeeId,
        employee_name: employee?.name || 'Unknown',
        start_time: startDatetime.toISOString(),
        end_time: endDatetime.toISOString(),
        duration: (endDatetime - startDatetime) / (1000 * 60 * 60),
        notes: formData.get('notes') || '',
        created_at: new Date().toISOString()
    };
    
    demoData.business.shifts.push(newShift);
    
    if (window.ManageUI) {
        window.ManageUI.modal.close();
        window.ManageUI.notification.show(`✓ Shift added for ${employee?.name || 'employee'}!`, 'success');
    }
    
    refreshDemo();
}

// ============================================
// TEAM MEMBER MANAGEMENT
// ============================================

function showAddTeamMemberModal() {
    const formHTML = `
        <form class="ui-task-form" onsubmit="event.preventDefault(); addTeamMember(event)">
            <div class="ui-form-row">
                <div class="ui-form-group full-width">
                    <label><i class="fa-solid fa-user"></i> Full Name</label>
                    <input type="text" name="name" class="ui-input" required placeholder="e.g., John Smith">
                </div>
            </div>
            
            <div class="ui-form-row">
                <div class="ui-form-group">
                    <label><i class="fa-solid fa-briefcase"></i> Role</label>
                    <select name="role" class="ui-input" required>
                        <option value="">Select Role</option>
                        <option value="Server">Server</option>
                        <option value="Barista">Barista</option>
                        <option value="Cook">Cook</option>
                        <option value="Manager">Manager</option>
                        <option value="Cashier">Cashier</option>
                    </select>
                </div>
                <div class="ui-form-group">
                    <label><i class="fa-solid fa-dollar-sign"></i> Hourly Rate</label>
                    <input type="number" name="hourlyRate" class="ui-input" required min="7.25" step="0.25" placeholder="15.00">
                </div>
            </div>
            
            <div class="ui-form-row">
                <div class="ui-form-group">
                    <label><i class="fa-solid fa-user-circle"></i> Username</label>
                    <input type="text" name="username" class="ui-input" required placeholder="johnsmith" pattern="[a-z0-9]+" title="Lowercase letters and numbers only">
                </div>
                <div class="ui-form-group">
                    <label><i class="fa-solid fa-lock"></i> Password</label>
                    <input type="password" name="password" class="ui-input" required minlength="6" placeholder="Min 6 characters">
                </div>
            </div>
            
            <div class="ui-form-actions">
                <button type="button" class="ui-btn-secondary" onclick="if(window.ManageUI) window.ManageUI.modal.close()">
                    Cancel
                </button>
                <button type="submit" class="ui-btn-primary">
                    <i class="fa-solid fa-user-plus"></i> Add Team Member
                </button>
            </div>
        </form>
    `;
    
    if (window.ManageUI) {
        window.ManageUI.modal.show('Add Team Member', formHTML, 'medium');
    }
}

function addTeamMember(event) {
    const formData = new FormData(event.target);
    const newId = Math.max(...demoData.business.employees.map(e => e.id), 0) + 1;
    
    const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#ef4444'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    
    const newEmployee = {
        id: newId,
        name: formData.get('name'),
        role: formData.get('role'),
        hourly_rate: parseFloat(formData.get('hourlyRate')),
        color: randomColor,
        username: formData.get('username').toLowerCase()
    };
    
    const newCredentials = {
        id: newId,
        username: formData.get('username').toLowerCase(),
        password: formData.get('password')
    };
    
    // Check if username already exists
    if (demoState.employeeCredentials.some(c => c.username === newCredentials.username)) {
        if (window.ManageUI) {
            window.ManageUI.notification.show('Username already exists! Please choose another.', 'error');
        }
        return;
    }
    
    demoData.business.employees.push(newEmployee);
    demoState.employeeCredentials.push(newCredentials);
    
    if (window.ManageUI) {
        window.ManageUI.modal.close();
        window.ManageUI.notification.show(`${newEmployee.name} added to the team!`, 'success');
    }
    
    refreshDemo();
}

function showEmployeeLoginModal() {
    const formHTML = `
        <form class="ui-task-form" onsubmit="event.preventDefault(); employeeLogin(event)">
            <div style="text-align: center; margin-bottom: 1.5rem;">
                <i class="fa-solid fa-user-lock" style="font-size: 3rem; color: #3b82f6;"></i>
                <h3 style="margin-top: 0.5rem;">Employee Login</h3>
                <p style="color: #64748b;">Enter your credentials to view your tasks and schedule</p>
            </div>
            
            <div class="ui-form-group full-width">
                <label><i class="fa-solid fa-user-circle"></i> Username</label>
                <input type="text" name="username" class="ui-input" required placeholder="Enter username" autofocus>
            </div>
            
            <div class="ui-form-group full-width">
                <label><i class="fa-solid fa-lock"></i> Password</label>
                <input type="password" name="password" class="ui-input" required placeholder="Enter password">
            </div>
            
            <div style="background: #f0f9ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 1rem; margin: 1rem 0;">
                <p style="margin: 0; font-size: 0.875rem; color: #1e40af;">
                    <i class="fa-solid fa-info-circle"></i> <strong>Demo Credentials:</strong><br>
                    Any employee username (alex, jamie, morgan, etc.) with password: <code>demo123</code>
                </p>
            </div>
            
            <div class="ui-form-actions">
                <button type="button" class="ui-btn-secondary" onclick="if(window.ManageUI) window.ManageUI.modal.close()">
                    Cancel
                </button>
                <button type="submit" class="ui-btn-primary">
                    <i class="fa-solid fa-right-to-bracket"></i> Login
                </button>
            </div>
        </form>
    `;
    
    if (window.ManageUI) {
        window.ManageUI.modal.show('Employee Portal', formHTML, 'small');
    }
}

function employeeLogin(event) {
    const formData = new FormData(event.target);
    const username = formData.get('username').toLowerCase();
    const password = formData.get('password');
    
    const credentials = demoState.employeeCredentials.find(c => c.username === username && c.password === password);
    
    if (credentials) {
        const employee = demoData.business.employees.find(e => e.id === credentials.id);
        demoState.currentUser = employee;
        demoData.currentEmployee = employee;
        
        if (window.ManageUI) {
            window.ManageUI.modal.close();
            window.ManageUI.notification.show(`Welcome back, ${employee.name}!`, 'success');
        }
        
        // Switch to employee view
        const viewButtons = document.querySelectorAll('.view-switch-btn');
        viewButtons.forEach(b => b.classList.remove('is-active'));
        const employeeBtn = document.querySelector('.view-switch-btn[data-view="employee"]');
        if (employeeBtn) employeeBtn.classList.add('is-active');
        
        const container = document.getElementById('demoAppContainer');
        if (container) {
            container.innerHTML = renderEmployeeView();
        }
    } else {
        if (window.ManageUI) {
            window.ManageUI.notification.show('Invalid username or password', 'error');
        }
    }
}

function quickLoginAs(employeeId) {
    const employee = demoData.business.employees.find(e => e.id === employeeId);
    if (!employee) return;
    
    demoState.currentUser = employee;
    demoData.currentEmployee = employee;
    
    if (window.ManageUI) {
        window.ManageUI.notification.show(`Logged in as ${employee.name}`, 'success');
    }
    
    // Switch to employee view
    const viewButtons = document.querySelectorAll('.view-switch-btn');
    viewButtons.forEach(b => b.classList.remove('is-active'));
    const employeeBtn = document.querySelector('.view-switch-btn[data-view="employee"]');
    if (employeeBtn) employeeBtn.classList.add('is-active');
    
    const container = document.getElementById('demoAppContainer');
    if (container) {
        container.innerHTML = renderEmployeeView();
    }
}

// Auto-initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeDemo);
} else {
    initializeDemo();
}
