/**
 * Manage the Spire - Shared Module
 * Common data structures, utilities, and business logic used by both demo and production
 */

// Export for module systems
const ManageShared = {
    // Data Models
    models: {
        Employee: class {
            constructor(data) {
                this.id = data.id;
                this.name = data.name;
                this.role = data.role;
                this.hourly_rate = data.hourly_rate;
                this.email = data.email || '';
                this.color = data.color || this.generateColor();
            }
            
            generateColor() {
                const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#8b5cf6'];
                return colors[Math.floor(Math.random() * colors.length)];
            }
        },
        
        Shift: class {
            constructor(data) {
                this.id = data.id;
                this.employee_id = data.employee_id;
                this.employee_name = data.employee_name;
                this.employee_color = data.employee_color;
                this.date = data.date;
                this.start_time = data.start_time;
                this.end_time = data.end_time;
                this.hourly_rate = data.hourly_rate;
                this.role = data.role;
            }
            
            getDuration() {
                const start = parseFloat(this.start_time.split(':')[0]);
                const end = parseFloat(this.end_time.split(':')[0]);
                return end - start;
            }
            
            getCost() {
                return this.getDuration() * this.hourly_rate;
            }
        },
        
        TimeOffRequest: class {
            constructor(data) {
                this.id = data.id;
                this.employee_id = data.employee_id;
                this.employee_name = data.employee_name;
                this.start_date = data.start_date;
                this.end_date = data.end_date;
                this.request_type = data.request_type; // vacation, sick, personal
                this.total_hours = data.total_hours;
                this.status = data.status || 'pending'; // pending, approved, denied
                this.notes = data.notes || '';
                this.created_at = data.created_at || new Date().toISOString();
            }
        },
        
        Task: class {
            constructor(data) {
                this.id = data.id;
                this.title = data.title;
                this.description = data.description || '';
                this.assigned_to = data.assigned_to; // employee_id
                this.assigned_name = data.assigned_name || '';
                this.created_by = data.created_by || null;
                this.priority = data.priority || 'medium'; // low, medium, high, urgent
                this.status = data.status || 'todo'; // todo, in_progress, completed
                this.due_date = data.due_date || null;
                this.created_at = data.created_at || new Date().toISOString();
                this.completed_at = data.completed_at || null;
                this.category = data.category || 'general'; // general, opening, closing, cleaning, training
                this.parent_id = data.parent_id || null; // For nested tasks
                this.subtasks = data.subtasks || []; // Array of child Task objects
            }
            
            isOverdue() {
                if (!this.due_date || this.status === 'completed') return false;
                return new Date(this.due_date) < new Date();
            }
            
            getPriorityColor() {
                const colors = {
                    low: '#10b981',
                    medium: '#3b82f6',
                    high: '#f59e0b',
                    urgent: '#ef4444'
                };
                return colors[this.priority] || colors.medium;
            }
            
            getCompletionPercentage() {
                if (this.subtasks.length === 0) {
                    return this.status === 'completed' ? 100 : 0;
                }
                const completed = this.subtasks.filter(st => st.status === 'completed').length;
                return Math.round((completed / this.subtasks.length) * 100);
            }
            
            addSubtask(subtask) {
                subtask.parent_id = this.id;
                this.subtasks.push(subtask);
            }
            
            hasSubtasks() {
                return this.subtasks.length > 0;
            }
        }
    },
    
    // Utility Functions
    utils: {
        formatTime(time) {
            const [hours, minutes] = time.split(':');
            const h = parseInt(hours);
            return `${h % 12 || 12}:${minutes}${h < 12 ? 'am' : 'pm'}`;
        },
        
        formatDate(dateStr) {
            const date = new Date(dateStr + 'T12:00:00');
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        },
        
        formatDateWithDay(dateStr) {
            const date = new Date(dateStr + 'T12:00:00');
            return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        },
        
        formatDateTime(dateStr) {
            const date = new Date(dateStr);
            return date.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit'
            });
        },
        
        capitalizeFirst(str) {
            return str.charAt(0).toUpperCase() + str.slice(1);
        },
        
        calculateHoursBetweenDates(startDate, endDate, dailyHours = 6) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
            return days * dailyHours;
        },
        
        getWeekStart(date = new Date()) {
            const d = new Date(date);
            d.setDate(d.getDate() - d.getDay());
            d.setHours(0, 0, 0, 0);
            return d;
        },
        
        getWeekDates(startDate) {
            const dates = [];
            for (let i = 0; i < 7; i++) {
                const date = new Date(startDate);
                date.setDate(startDate.getDate() + i);
                dates.push(date);
            }
            return dates;
        }
    },
    
    // Task Management Functions
    taskManager: {
        priorityLabels: {
            low: 'Low Priority',
            medium: 'Medium Priority',
            high: 'High Priority',
            urgent: 'Urgent'
        },
        
        statusLabels: {
            todo: 'To Do',
            in_progress: 'In Progress',
            completed: 'Completed'
        },
        
        categoryLabels: {
            general: 'General',
            opening: 'Opening Tasks',
            closing: 'Closing Tasks',
            cleaning: 'Cleaning',
            training: 'Training'
        },
        
        categoryIcons: {
            general: 'fa-list-check',
            opening: 'fa-door-open',
            closing: 'fa-door-closed',
            cleaning: 'fa-broom',
            training: 'fa-graduation-cap'
        },
        
        priorityIcons: {
            low: 'fa-angle-down',
            medium: 'fa-minus',
            high: 'fa-angle-up',
            urgent: 'fa-triangle-exclamation'
        },
        
        getTasksForEmployee(tasks, employeeId) {
            return tasks.filter(t => t.assigned_to === employeeId);
        },
        
        getTasksByStatus(tasks, status) {
            return tasks.filter(t => t.status === status);
        },
        
        getOverdueTasks(tasks) {
            return tasks.filter(t => {
                if (!t.due_date || t.status === 'completed') return false;
                return new Date(t.due_date) < new Date();
            });
        },
        
        getTaskStats(tasks) {
            return {
                total: tasks.length,
                todo: tasks.filter(t => t.status === 'todo').length,
                in_progress: tasks.filter(t => t.status === 'in_progress').length,
                completed: tasks.filter(t => t.status === 'completed').length,
                overdue: this.getOverdueTasks(tasks).length
            };
        }
    },
    
    // Notification System
    notification: {
        show(message, type = 'info') {
            const notification = document.createElement('div');
            notification.className = `manage-notification manage-notification-${type}`;
            notification.textContent = message;
            
            Object.assign(notification.style, {
                position: 'fixed',
                top: '-100px',
                right: '20px',
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderLeft: `4px solid ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'}`,
                borderRadius: '10px',
                padding: '1rem 1.5rem',
                boxShadow: '0 12px 28px rgba(0, 0, 0, 0.15)',
                zIndex: '10000',
                transition: 'top 0.3s ease',
                maxWidth: '350px'
            });
            
            document.body.appendChild(notification);
            
            setTimeout(() => {
                notification.style.top = '20px';
            }, 10);
            
            setTimeout(() => {
                notification.style.top = '-100px';
                setTimeout(() => notification.remove(), 300);
            }, 3000);
        }
    },
    
    // Sample Data Generators
    generators: {
        generateSampleTasks(employees) {
            const tasks = [];
            
            const taskTemplates = [
                { 
                    title: 'Complete opening checklist', 
                    category: 'opening', 
                    priority: 'high',
                    subtasks: [
                        'Unlock doors and disable alarm',
                        'Turn on all lights and equipment',
                        'Check temperature settings',
                        'Count starting cash drawer'
                    ]
                },
                { 
                    title: 'Clean espresso machine', 
                    category: 'cleaning', 
                    priority: 'high',
                    subtasks: [
                        'Grab cleaning equipment from storage',
                        'Backflush group heads',
                        'Clean drip trays and surfaces',
                        'Wipe down steam wands'
                    ]
                },
                { 
                    title: 'Restock coffee beans', 
                    category: 'general', 
                    priority: 'medium',
                    subtasks: [
                        'Check current inventory levels',
                        'Pull beans from back storage',
                        'Refill hoppers',
                        'Update inventory log'
                    ]
                },
                { 
                    title: 'Train on new POS system', 
                    category: 'training', 
                    priority: 'high',
                    subtasks: [
                        'Watch training video',
                        'Complete practice orders',
                        'Learn refund process',
                        'Pass knowledge quiz'
                    ]
                },
                { 
                    title: 'Prepare pastry display', 
                    category: 'opening', 
                    priority: 'medium',
                    subtasks: [
                        'Clean display case',
                        'Arrange fresh pastries',
                        'Add price labels',
                        'Stock napkins and plates'
                    ]
                },
                { 
                    title: 'Count cash register', 
                    category: 'closing', 
                    priority: 'urgent',
                    subtasks: [
                        'Close out current shift',
                        'Count drawer total',
                        'Fill out deposit slip',
                        'Prepare safe deposit'
                    ]
                }
            ];
            
            let taskId = 1;
            const today = new Date();
            
            // Assign tasks to employees
            employees.forEach((emp, index) => {
                const numTasks = Math.floor(Math.random() * 2) + 1; // 1-2 main tasks per employee
                
                for (let i = 0; i < numTasks; i++) {
                    const template = taskTemplates[(index + i) % taskTemplates.length];
                    const dueDate = new Date(today);
                    dueDate.setDate(today.getDate() + Math.floor(Math.random() * 7));
                    
                    const statuses = ['todo', 'in_progress', 'completed'];
                    const status = statuses[Math.floor(Math.random() * statuses.length)];
                    
                    const mainTask = new ManageShared.models.Task({
                        id: taskId++,
                        title: template.title,
                        description: `Task assigned to ${emp.name}`,
                        assigned_to: emp.id,
                        assigned_name: emp.name,
                        category: template.category,
                        priority: template.priority,
                        status: status === 'completed' ? 'completed' : 'todo',
                        due_date: dueDate.toISOString().split('T')[0],
                        completed_at: status === 'completed' ? new Date().toISOString() : null,
                        subtasks: []
                    });
                    
                    // Add subtasks
                    if (template.subtasks) {
                        template.subtasks.forEach((subtaskTitle, subIndex) => {
                            const subtaskStatus = status === 'completed' ? 'completed' :
                                                 (subIndex < 2 && status === 'in_progress') ? 'completed' :
                                                 (subIndex === 2 && status === 'in_progress') ? 'in_progress' :
                                                 'todo';
                            
                            const subtask = new ManageShared.models.Task({
                                id: taskId++,
                                title: subtaskTitle,
                                description: '',
                                assigned_to: emp.id,
                                assigned_name: emp.name,
                                category: template.category,
                                priority: template.priority,
                                status: subtaskStatus,
                                due_date: dueDate.toISOString().split('T')[0],
                                completed_at: subtaskStatus === 'completed' ? new Date().toISOString() : null,
                                parent_id: mainTask.id
                            });
                            
                            mainTask.subtasks.push(subtask);
                        });
                        
                        // Update parent status based on subtasks
                        const completedSubtasks = mainTask.subtasks.filter(st => st.status === 'completed').length;
                        if (completedSubtasks === mainTask.subtasks.length) {
                            mainTask.status = 'completed';
                        } else if (completedSubtasks > 0) {
                            mainTask.status = 'in_progress';
                        }
                    }
                    
                    tasks.push(mainTask);
                }
            });
            
            return tasks;
        }
    }
};

// Make available globally for both demo and production
if (typeof window !== 'undefined') {
    window.ManageShared = ManageShared;
}

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ManageShared;
}
