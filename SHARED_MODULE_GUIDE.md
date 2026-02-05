# Shared Module Architecture - Task Management Integration

## Overview
The demo and production app now share a common codebase through `manage-shared.js`, ensuring consistency and reducing maintenance.

## Architecture

### File Structure
```
frontend/js/
├── manage-shared.js    # ⭐ NEW - Shared models, utilities, and business logic
├── demo-app.js         # Updated to use shared module
├── manage.js           # Can now use shared module
├── employee.js         # Can now use shared module  
└── schedule.js         # Can now use shared module
```

### What's Shared

#### 1. **Data Models** (`ManageShared.models`)
- `Employee` - Employee data structure with color generation
- `Shift` - Shift with duration/cost calculations
- `TimeOffRequest` - Time-off request management
- `Task` - **NEW** Task model with priority, status, overdue detection

#### 2. **Utility Functions** (`ManageShared.utils`)
- `formatTime()` - Convert 24hr to 12hr format
- `formatDate()` - Short date formatting
- `formatDateWithDay()` - Date with weekday
- `formatDateTime()` - Full date-time formatting
- `capitalizeFirst()` - String capitalization
- `calculateHoursBetweenDates()` - Time-off hour calculations
- `getWeekStart()` - Week boundary calculations
- `getWeekDates()` - Generate array of week dates

#### 3. **Task Management** (`ManageShared.taskManager`)
- Priority labels: low, medium, high, urgent
- Status labels: todo, in_progress, completed
- Category labels: general, opening, closing, cleaning, training
- Category icons (Font Awesome)
- Priority icons (Font Awesome)
- Filter functions: by employee, status, overdue
- Statistics generation

#### 4. **Notification System** (`ManageShared.notification`)
- Consistent notification UI across demo and production
- Auto-dismissing toasts with color coding

#### 5. **Sample Data Generators** (`ManageShared.generators`)
- `generateSampleTasks()` - Creates realistic task data for demo

## Task Management Features

### Boss View
```
┌─────────────────────────────────────┐
│  Task Management                    │
│  ┌──────────┬──────────┬──────────┐│
│  │ To Do: 5 │ Progress │ Complete ││
│  ├──────────┼──────────┼──────────┤│
│  │ Task 1   │ Task 3   │ Task 6   ││
│  │ Task 2   │ Task 4   │ Task 7   ││
│  └──────────┴──────────┴──────────┘│
│  [+ Create Task]                    │
└─────────────────────────────────────┘
```

**Features:**
- 4 stats: To Do, In Progress, Completed, Overdue
- Kanban-style board with 2 columns (To Do, In Progress)
- Click tasks to move through statuses
- Color-coded priorities (low=green, medium=blue, high=orange, urgent=red)
- Category icons (opening, closing, cleaning, training)
- Overdue detection with red badges
- Employee assignment display

### Employee View
```
┌─────────────────────────────────────┐
│  My Tasks (3 active)                │
│  ┌─────────────────────────────────┐│
│  │ ⚠️ Clean espresso machine      ││
│  │ High Priority • Due: Feb 5      ││
│  │ [▶ Start] [✓ Complete]          ││
│  └─────────────────────────────────┘│
│  ┌─────────────────────────────────┐│
│  │ ✅ Opening checklist            ││
│  │ Completed                        ││
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘
```

**Features:**
- See only assigned tasks
- Active task count badge
- Click tasks to update status
- Start/Complete action buttons
- Color-coded status borders
- Completed tasks marked with checkmark
- Overdue tasks highlighted in red

## How It Works

### 1. Loading Order (manage.html)
```html
<script src="../js/manage-shared.js" defer></script>  <!-- Load FIRST -->
<script src="../js/demo-app.js" defer></script>       <!-- Then demo -->
<script src="../js/manage.js" defer></script>         <!-- Then main app -->
```

### 2. Using Shared Models
```javascript
// In demo-app.js
const task = new ManageShared.models.Task({
    id: 1,
    title: "Clean espresso machine",
    assigned_to: 2,
    priority: "high",
    status: "todo"
});

// Check if overdue
if (task.isOverdue()) {
    console.log('Task is overdue!');
}
```

### 3. Using Utilities
```javascript
// Format time consistently
const timeStr = ManageShared.utils.formatTime("14:30"); // "2:30pm"

// Calculate hours
const hours = ManageShared.utils.calculateHoursBetweenDates(
    "2026-02-05", 
    "2026-02-07",
    6  // 6 hour shifts
); // Returns 18
```

### 4. Task Filtering
```javascript
// Get employee's tasks
const myTasks = ManageShared.taskManager.getTasksForEmployee(
    allTasks, 
    employeeId
);

// Get overdue tasks
const overdue = ManageShared.taskManager.getOverdueTasks(allTasks);

// Get statistics
const stats = ManageShared.taskManager.getTaskStats(allTasks);
// { total: 10, todo: 3, in_progress: 4, completed: 2, overdue: 1 }
```

### 5. Notifications
```javascript
// Show notification
ManageShared.notification.show(
    'Task completed successfully!',
    'success'  // or 'error', 'info'
);
```

## Integration with Production

### employee.js Integration
```javascript
// At top of employee.js, after it loads:
const taskManager = window.ManageShared?.taskManager;

// Fetch and display employee tasks
async function loadMyTasks() {
    const response = await fetch(`${API_BASE}/tasks/my-tasks`);
    const tasks = await response.json();
    
    // Use shared utilities
    tasks.forEach(task => {
        const taskObj = new ManageShared.models.Task(task);
        if (taskObj.isOverdue()) {
            // Highlight overdue
        }
    });
}
```

### schedule.js Integration
```javascript
// Use shared date utilities
const weekStart = ManageShared.utils.getWeekStart();
const weekDates = ManageShared.utils.getWeekDates(weekStart);

// Use shared formatters
const shiftTimeDisplay = ManageShared.utils.formatTime(shift.start_time);
```

## Benefits

### ✅ Single Source of Truth
- Change task priority labels once, updates everywhere
- Modify date formatting once, consistent across demo and production
- Add new task categories once, available to all

### ✅ Type Safety
- Models enforce structure
- Methods ensure consistent calculations
- Reduces bugs from inconsistent data

### ✅ Easier Testing
- Test business logic once in shared module
- Demo automatically validates production logic
- Changes propagate automatically

### ✅ Faster Development
- Reuse utilities instead of rewriting
- Copy-paste from demo to production
- Shared components reduce code duplication

## Demo vs Production

### Demo (demo-app.js)
```javascript
// Uses shared module for data generation
demoData.business.tasks = ManageShared.generators.generateSampleTasks(employees);

// Renders using shared utilities
function renderTask(task) {
    const priorityColor = task.getPriorityColor();  // From shared model
    const isOverdue = task.isOverdue();              // From shared model
    // ... render UI
}
```

### Production (employee.js, schedule.js, manage.js)
```javascript
// Fetch real data from API
const tasks = await fetchTasks();

// Transform to shared models
const taskObjects = tasks.map(t => new ManageShared.models.Task(t));

// Render using SAME utilities as demo
function renderTask(task) {
    const priorityColor = task.getPriorityColor();  // Same as demo!
    const isOverdue = task.isOverdue();              // Same as demo!
    // ... render UI (can copy from demo!)
}
```

## Example: Adding New Task Category

### 1. Update Shared Module
```javascript
// In manage-shared.js
taskManager: {
    categoryLabels: {
        general: 'General',
        opening: 'Opening Tasks',
        closing: 'Closing Tasks',
        cleaning: 'Cleaning',
        training: 'Training',
        inventory: 'Inventory'  // ⭐ NEW
    },
    categoryIcons: {
        // ... existing
        inventory: 'fa-boxes'    // ⭐ NEW
    }
}
```

### 2. It Works Everywhere
- Demo task generation includes new category ✅
- Demo UI shows inventory icon ✅
- Production API can return inventory tasks ✅
- Production UI automatically supports it ✅
- No changes needed in demo-app.js or employee.js! ✅

## File Sizes
- **manage-shared.js**: 330 lines (shared utilities)
- **demo-app.js**: 870 lines (demo logic + task rendering)
- **Combined**: 1,200 lines vs 2,400 lines if duplicated

## Next Steps

### To Use in Production:
1. Update employee.js to load manage-shared.js
2. Update schedule.js to load manage-shared.js
3. Create tasks API endpoints
4. Copy task rendering from demo-app.js
5. Everything just works! 🎉

The demo now serves as a **live reference implementation** - whatever works in the demo will work in production because they share the same code!
