/**
 * Manage the Spire - Shared UI Components
 * Reusable components that render identically in demo and production
 */

const ManageUI = {
    // Task rendering components
    tasks: {
        /**
         * Render a task card with nested subtasks
         */
        renderTaskCard(task, options = {}) {
            const {
                showAssignee = true,
                onClick = null,
                onSubtaskClick = null,
                expandable = true
            } = options;
            
            const shared = window.ManageShared;
            const priorityColor = task.getPriorityColor();
            const isOverdue = task.isOverdue();
            const categoryIcon = shared?.taskManager.categoryIcons[task.category] || 'fa-list';
            const priorityIcon = shared?.taskManager.priorityIcons[task.priority] || 'fa-minus';
            const hasSubtasks = task.hasSubtasks();
            const completionPct = task.getCompletionPercentage();
            
            const cardId = `task-card-${task.id}`;
            const subtasksId = `subtasks-${task.id}`;
            
            return `
                <div class="ui-task-card ${isOverdue ? 'overdue' : ''} ${task.status}" 
                     data-task-id="${task.id}"
                     ${onClick ? `onclick="${onClick}(${task.id})"` : ''}>
                    
                    <div class="ui-task-header">
                        <div class="ui-task-icon-priority">
                            <i class="fa-solid ${categoryIcon}" style="color: ${priorityColor}"></i>
                            <span class="ui-task-priority" style="color: ${priorityColor}">
                                <i class="fa-solid ${priorityIcon}"></i>
                                ${shared?.taskManager.priorityLabels[task.priority] || task.priority}
                            </span>
                        </div>
                        ${hasSubtasks ? `
                            <button class="ui-task-expand-btn" onclick="event.stopPropagation(); ManageUI.tasks.toggleSubtasks('${subtasksId}', this)">
                                <i class="fa-solid fa-chevron-down"></i>
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
                        ${showAssignee ? `
                            <span class="ui-task-assignee">
                                <i class="fa-solid fa-user"></i> ${task.assigned_name}
                            </span>
                        ` : ''}
                        ${task.due_date ? `
                            <span class="ui-task-due ${isOverdue ? 'overdue' : ''}">
                                <i class="fa-regular fa-calendar"></i> ${shared?.utils.formatDate(task.due_date)}
                            </span>
                        ` : ''}
                        <span class="ui-task-status-badge ${task.status}">
                            ${shared?.taskManager.statusLabels[task.status] || task.status}
                        </span>
                    </div>
                    
                    ${isOverdue ? '<div class="ui-overdue-badge"><i class="fa-solid fa-exclamation-triangle"></i> Overdue</div>' : ''}
                    
                    ${hasSubtasks ? `
                        <div class="ui-task-subtasks" id="${subtasksId}" style="display: none;">
                            <div class="ui-subtasks-header">
                                <i class="fa-solid fa-list-check"></i> Subtasks
                            </div>
                            ${task.subtasks.map(subtask => ManageUI.tasks.renderSubtaskCard(subtask, onSubtaskClick)).join('')}
                        </div>
                    ` : ''}
                </div>
            `;
        },
        
        /**
         * Render a subtask card
         */
        renderSubtaskCard(subtask, onClick = null) {
            const shared = window.ManageShared;
            const isCompleted = subtask.status === 'completed';
            const isInProgress = subtask.status === 'in_progress';
            
            return `
                <div class="ui-subtask-card ${subtask.status}" 
                     data-subtask-id="${subtask.id}"
                     ${onClick ? `onclick="event.stopPropagation(); ${onClick}(${subtask.id})"` : ''}>
                    
                    <div class="ui-subtask-checkbox ${isCompleted ? 'checked' : isInProgress ? 'in-progress' : ''}">
                        <i class="fa-solid ${isCompleted ? 'fa-check' : isInProgress ? 'fa-spinner fa-spin' : 'fa-circle'}"></i>
                    </div>
                    
                    <div class="ui-subtask-content">
                        <span class="ui-subtask-title ${isCompleted ? 'completed' : ''}">${subtask.title}</span>
                    </div>
                    
                    <div class="ui-subtask-actions">
                        ${!isCompleted ? `
                            <button class="ui-subtask-action-btn" 
                                    onclick="event.stopPropagation(); ManageUI.tasks.updateSubtaskStatus(${subtask.id}, 'completed')"
                                    title="Mark complete">
                                <i class="fa-solid fa-check"></i>
                            </button>
                        ` : `
                            <button class="ui-subtask-action-btn undo" 
                                    onclick="event.stopPropagation(); ManageUI.tasks.updateSubtaskStatus(${subtask.id}, 'todo')"
                                    title="Mark incomplete">
                                <i class="fa-solid fa-rotate-left"></i>
                            </button>
                        `}
                    </div>
                </div>
            `;
        },
        
        /**
         * Render task creation form
         */
        renderTaskForm(employees, onSubmit = 'ManageUI.tasks.handleTaskSubmit') {
            const shared = window.ManageShared;
            return `
                <form class="ui-task-form" onsubmit="event.preventDefault(); ${onSubmit}(event)">
                    <div class="ui-form-row">
                        <div class="ui-form-group full-width">
                            <label><i class="fa-solid fa-heading"></i> Task Title</label>
                            <input type="text" name="title" class="ui-input" required placeholder="e.g., Clean espresso machine">
                        </div>
                    </div>
                    
                    <div class="ui-form-row">
                        <div class="ui-form-group">
                            <label><i class="fa-solid fa-user"></i> Assign To</label>
                            <select name="assigned_to" class="ui-input" required>
                                <option value="">Select employee...</option>
                                ${employees.map(emp => `<option value="${emp.id}">${emp.name} - ${emp.role}</option>`).join('')}
                            </select>
                        </div>
                        
                        <div class="ui-form-group">
                            <label><i class="fa-solid fa-calendar"></i> Due Date</label>
                            <input type="date" name="due_date" class="ui-input" required>
                        </div>
                    </div>
                    
                    <div class="ui-form-row">
                        <div class="ui-form-group">
                            <label><i class="fa-solid fa-flag"></i> Priority</label>
                            <select name="priority" class="ui-input" required>
                                <option value="low">Low Priority</option>
                                <option value="medium" selected>Medium Priority</option>
                                <option value="high">High Priority</option>
                                <option value="urgent">Urgent</option>
                            </select>
                        </div>
                        
                        <div class="ui-form-group">
                            <label><i class="fa-solid fa-tag"></i> Category</label>
                            <select name="category" class="ui-input" required>
                                ${Object.entries(shared?.taskManager.categoryLabels || {}).map(([key, label]) => 
                                    `<option value="${key}">${label}</option>`
                                ).join('')}
                            </select>
                        </div>
                    </div>
                    
                    <div class="ui-form-row">
                        <div class="ui-form-group full-width">
                            <label><i class="fa-solid fa-align-left"></i> Description (Optional)</label>
                            <textarea name="description" class="ui-input" rows="2" placeholder="Additional details..."></textarea>
                        </div>
                    </div>
                    
                    <div class="ui-subtasks-builder">
                        <div class="ui-subtasks-header">
                            <label><i class="fa-solid fa-list-check"></i> Subtasks (Optional)</label>
                            <button type="button" class="ui-btn-small" onclick="ManageUI.tasks.addSubtaskInput()">
                                <i class="fa-solid fa-plus"></i> Add Subtask
                            </button>
                        </div>
                        <div id="subtasksContainer" class="ui-subtasks-inputs">
                            <!-- Subtask inputs will be added here -->
                        </div>
                    </div>
                    
                    <div class="ui-form-actions">
                        <button type="button" class="ui-btn ui-btn-secondary" onclick="ManageUI.tasks.closeTaskForm()">
                            Cancel
                        </button>
                        <button type="submit" class="ui-btn ui-btn-primary">
                            <i class="fa-solid fa-plus"></i> Create Task
                        </button>
                    </div>
                </form>
            `;
        },
        
        /**
         * Toggle subtasks visibility
         */
        toggleSubtasks(subtasksId, button) {
            const subtasksDiv = document.getElementById(subtasksId);
            const icon = button.querySelector('i');
            
            if (subtasksDiv.style.display === 'none') {
                subtasksDiv.style.display = 'block';
                icon.classList.remove('fa-chevron-down');
                icon.classList.add('fa-chevron-up');
            } else {
                subtasksDiv.style.display = 'none';
                icon.classList.remove('fa-chevron-up');
                icon.classList.add('fa-chevron-down');
            }
        },
        
        /**
         * Add subtask input to form
         */
        addSubtaskInput() {
            const container = document.getElementById('subtasksContainer');
            const index = container.children.length;
            
            const subtaskInput = document.createElement('div');
            subtaskInput.className = 'ui-subtask-input';
            subtaskInput.innerHTML = `
                <input type="text" name="subtask_${index}" class="ui-input" placeholder="Subtask ${index + 1}">
                <button type="button" class="ui-btn-icon-small" onclick="this.parentElement.remove()">
                    <i class="fa-solid fa-times"></i>
                </button>
            `;
            
            container.appendChild(subtaskInput);
        },
        
        /**
         * Placeholder for subtask status update (override in implementation)
         */
        updateSubtaskStatus(subtaskId, newStatus) {
            console.warn('ManageUI.tasks.updateSubtaskStatus not implemented. Override this in your app.');
        },
        
        /**
         * Placeholder for task form submission (override in implementation)
         */
        handleTaskSubmit(event) {
            console.warn('ManageUI.tasks.handleTaskSubmit not implemented. Override this in your app.');
        },
        
        /**
         * Placeholder for closing task form (override in implementation)
         */
        closeTaskForm() {
            console.warn('ManageUI.tasks.closeTaskForm not implemented. Override this in your app.');
        }
    },
    
    // Modal components
    modal: {
        /**
         * Create and show a modal
         */
        show(title, content, options = {}) {
            const {
                size = 'medium', // small, medium, large
                closeButton = true,
                onClose = null
            } = options;
            
            // Remove existing modal if any
            const existing = document.getElementById('ui-dynamic-modal');
            if (existing) existing.remove();
            
            const modal = document.createElement('div');
            modal.id = 'ui-dynamic-modal';
            modal.className = `ui-modal ui-modal-${size}`;
            modal.innerHTML = `
                <div class="ui-modal-overlay" onclick="ManageUI.modal.close()"></div>
                <div class="ui-modal-container">
                    <div class="ui-modal-header">
                        <h3>${title}</h3>
                        ${closeButton ? '<button class="ui-modal-close" onclick="ManageUI.modal.close()">&times;</button>' : ''}
                    </div>
                    <div class="ui-modal-body">
                        ${content}
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Add show class for animation
            setTimeout(() => modal.classList.add('show'), 10);
            
            // Store close callback
            modal._onClose = onClose;
        },
        
        /**
         * Close the modal
         */
        close() {
            const modal = document.getElementById('ui-dynamic-modal');
            if (!modal) return;
            
            modal.classList.remove('show');
            
            setTimeout(() => {
                if (modal._onClose) modal._onClose();
                modal.remove();
            }, 300);
        }
    },
    
    // Notification system
    notification: {
        /**
         * Show a notification
         */
        show(message, type = 'info', duration = 3000) {
            const notification = document.createElement('div');
            notification.className = `ui-notification ui-notification-${type}`;
            notification.innerHTML = `
                <div class="ui-notification-icon">
                    <i class="fa-solid ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
                </div>
                <div class="ui-notification-message">${message}</div>
                <button class="ui-notification-close" onclick="this.parentElement.remove()">
                    <i class="fa-solid fa-times"></i>
                </button>
            `;
            
            document.body.appendChild(notification);
            
            setTimeout(() => notification.classList.add('show'), 10);
            
            if (duration > 0) {
                setTimeout(() => {
                    notification.classList.remove('show');
                    setTimeout(() => notification.remove(), 300);
                }, duration);
            }
        }
    }
};

// Make available globally
if (typeof window !== 'undefined') {
    window.ManageUI = ManageUI;
}

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ManageUI;
}
