# Shared Components Architecture Guide

## Overview

The Manage the Spire application now uses a **shared component architecture** where the same code runs in both the interactive demo and production environment. This ensures consistency, reduces maintenance, and makes the demo a true representation of the actual application.

## Architecture

### 3-Layer System

```
┌─────────────────────────────────────────────┐
│         Application Layer                   │
│  (demo-app.js, employee.js, schedule.js)    │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│         UI Components Layer                 │
│      (manage-ui-components.js)              │
│  • Task cards with nested subtasks          │
│  • Modal system                              │
│  • Notification system                       │
│  • Form components                           │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│         Data & Business Logic Layer         │
│        (manage-shared.js)                   │
│  • Task model with subtask support          │
│  • Data generators                           │
│  • Utility functions                         │
│  • Constants & enums                         │
└─────────────────────────────────────────────┘
```

## File Structure

### Core Files

1. **manage-shared.js** (317 lines)
   - Data models (Task, Shift, Employee, etc.)
   - Business logic
   - Sample data generators
   - Shared utilities

2. **manage-ui-components.js** (335 lines)
   - Reusable UI rendering functions
   - Modal system
   - Notification system
   - Interactive components

3. **manage-ui-components.css** (650 lines)
   - Styling for all shared components
   - Dark theme support
   - Responsive design

4. **demo-app.js** (932 lines)
   - Interactive demo implementation
   - Boss and employee views
   - Uses shared components

## Key Features

### 1. Nested Task System

Tasks can now contain subtasks, creating a hierarchical task structure:

```javascript
// Parent Task Example
{
    id: 1,
    title: "Clean espresso machine",
    status: "in_progress",
    subtasks: [
        {
            id: 1,
            title: "Grab cleaning equipment from storage",
            status: "completed"
        },
        {
            id: 2,
            title: "Backflush group heads",
            status: "completed"
        },
        {
            id: 3,
            title: "Clean drip trays and surfaces",
            status: "in_progress"
        },
        {
            id: 4,
            title: "Wipe down steam wands",
            status: "todo"
        }
    ]
}
```

**Features:**
- Automatic progress calculation based on completed subtasks
- Visual progress bar showing completion percentage
- Expand/collapse subtask sections
- Individual subtask completion tracking
- Parent task auto-completion when all subtasks done

### 2. Shared UI Components

All rendering uses `ManageUI` components from manage-ui-components.js:

```javascript
// Render a task card (works identically in demo and production)
const html = ManageUI.tasks.renderTaskCard(task, {
    onClick: `handleTaskClick(${task.id})`,
    onSubtaskComplete: (subtaskId) => completeSubtask(task.id, subtaskId),
    onSubtaskUndo: (subtaskId) => undoSubtask(task.id, subtaskId)
});

// Show a modal
ManageUI.modal.show('Create Task', formHtml, 'medium');

// Show a notification
ManageUI.notification.show('Task completed!', 'success');
```

### 3. Interactive Demo

The demo is now **fully interactive**:

✅ **Boss View:**
- View task overview with Kanban board
- Create new tasks with subtasks
- Track task completion
- Manage employee assignments
- View team statistics

✅ **Employee View:**
- See assigned tasks
- Mark subtasks as complete
- Track progress on multi-step tasks
- View upcoming shifts
- Request time off

## How to Use

### Including in HTML

```html
<!-- Load in this order -->
<link rel="stylesheet" href="../css/manage-ui-components.css">
<script src="../js/manage-shared.js" defer></script>
<script src="../js/manage-ui-components.js" defer></script>
<script src="../js/your-app.js" defer></script>
```

### Creating a Task with Subtasks

```javascript
const task = new ManageShared.models.Task({
    title: "Prepare cafe for opening",
    description: "Complete opening checklist",
    priority: "high",
    category: "operations",
    assigned_to: 1,
    due_date: "2024-01-15T08:00:00Z"
});

// Add subtasks
task.addSubtask({
    id: 1,
    title: "Turn on espresso machine",
    status: "todo"
});

task.addSubtask({
    id: 2,
    title: "Stock pastry display",
    status: "todo"
});

task.addSubtask({
    id: 3,
    title: "Clean outdoor seating",
    status: "todo"
});

// Check completion
console.log(task.getCompletionPercentage()); // 0%
console.log(task.hasSubtasks()); // true
```

### Rendering Tasks

```javascript
// Render a single task
const taskHtml = ManageUI.tasks.renderTaskCard(task, {
    onClick: 'handleTaskClick(taskId)',
    onSubtaskComplete: completeHandler,
    onSubtaskUndo: undoHandler
});

document.getElementById('taskContainer').innerHTML = taskHtml;
```

### Creating Interactive Forms

```javascript
function showNewTaskModal() {
    const employees = getEmployees(); // Your function
    
    const formHtml = ManageUI.tasks.renderTaskForm({
        employees: employees.map(e => ({
            value: e.id,
            label: e.name
        })),
        onSubmit: (taskData) => {
            // Handle form submission
            createTask(taskData);
            ManageUI.modal.close();
        }
    });
    
    ManageUI.modal.show('Create New Task', formHtml, 'medium');
}
```

## Component Reference

### ManageUI.tasks

**renderTaskCard(task, options)**
- Renders a complete task card with subtasks
- Options:
  - `onClick`: Click handler for main card
  - `onSubtaskComplete`: Handler for completing subtask
  - `onSubtaskUndo`: Handler for undoing subtask

**renderSubtaskCard(subtask, options)**
- Renders a single subtask with checkbox
- Auto-styling based on status

**renderTaskForm(options)**
- Renders task creation/edit form
- Includes subtask builder
- Options:
  - `employees`: Array of {value, label} objects
  - `task`: Existing task for editing
  - `onSubmit`: Form submission handler

### ManageUI.modal

**show(title, content, size)**
- Shows a modal dialog
- Sizes: 'small', 'medium', 'large'

**close()**
- Closes the current modal

### ManageUI.notification

**show(message, type, duration)**
- Shows toast notification
- Types: 'info', 'success', 'error'
- Default duration: 3000ms

## Sample Data

The `ManageShared.generators.generateSampleTasks()` function creates 6 realistic task templates:

1. **Clean espresso machine** → 4 subtasks
2. **Stock inventory** → 4 subtasks
3. **Prep for morning rush** → 4 subtasks
4. **Monthly deep clean** → 4 subtasks
5. **Train new barista** → 4 subtasks
6. **Complete weekly report** → 4 subtasks

Each template includes detailed subtasks representing real workflow steps.

## Benefits

### For Development
- ✅ Write once, run everywhere (demo + production)
- ✅ Consistent UI across all views
- ✅ Easier testing and debugging
- ✅ Faster feature development

### For Users
- ✅ Demo accurately represents real app
- ✅ No surprises between demo and production
- ✅ Better evaluation of features
- ✅ Smoother onboarding

### For Maintenance
- ✅ Single source of truth
- ✅ Changes propagate everywhere automatically
- ✅ Reduced code duplication
- ✅ Easier bug fixes

## Next Steps

### To Use in Production

1. **Include the files:**
   ```html
   <link rel="stylesheet" href="../css/manage-ui-components.css">
   <script src="../js/manage-shared.js" defer></script>
   <script src="../js/manage-ui-components.js" defer></script>
   ```

2. **Replace old rendering code:**
   ```javascript
   // OLD
   function renderTask(task) {
       return `<div class="task">...</div>`;
   }
   
   // NEW
   function renderTask(task) {
       return ManageUI.tasks.renderTaskCard(task, {
           onClick: `selectTask(${task.id})`
       });
   }
   ```

3. **Update task data structure:**
   ```javascript
   // Add subtasks array to existing tasks
   task.subtasks = [
       { id: 1, title: "Step 1", status: "todo" },
       { id: 2, title: "Step 2", status: "todo" }
   ];
   ```

4. **Wire up handlers:**
   ```javascript
   function completeSubtask(taskId, subtaskId) {
       // Your backend API call
       fetch(`/api/tasks/${taskId}/subtasks/${subtaskId}/complete`, {
           method: 'POST'
       }).then(() => {
           ManageUI.notification.show('Subtask completed!', 'success');
           refreshTasks();
       });
   }
   ```

## Examples

### Example 1: Task List View

```javascript
function renderTaskList(tasks) {
    const container = document.getElementById('taskList');
    
    container.innerHTML = tasks.map(task => 
        ManageUI.tasks.renderTaskCard(task, {
            onClick: `viewTaskDetails(${task.id})`,
            onSubtaskComplete: (stId) => markSubtaskDone(task.id, stId),
            onSubtaskUndo: (stId) => reopenSubtask(task.id, stId)
        })
    ).join('');
}
```

### Example 2: Creating a Task

```javascript
function showCreateTaskModal() {
    const formHtml = ManageUI.tasks.renderTaskForm({
        employees: getEmployeeList(),
        onSubmit: async (data) => {
            const response = await fetch('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            if (response.ok) {
                ManageUI.modal.close();
                ManageUI.notification.show('Task created!', 'success');
                loadTasks();
            }
        }
    });
    
    ManageUI.modal.show('Create New Task', formHtml, 'medium');
}
```

### Example 3: Progress Tracking

```javascript
function displayTaskProgress(task) {
    const percentage = task.getCompletionPercentage();
    const completedSubtasks = task.subtasks.filter(st => st.status === 'completed').length;
    const totalSubtasks = task.subtasks.length;
    
    console.log(`Task: ${task.title}`);
    console.log(`Progress: ${percentage}% (${completedSubtasks}/${totalSubtasks} subtasks)`);
    
    if (percentage === 100) {
        ManageUI.notification.show(`${task.title} is complete!`, 'success');
    }
}
```

## Troubleshooting

### Task cards not displaying
- Check that manage-ui-components.js is loaded
- Verify `window.ManageUI` exists in console
- Check browser console for errors

### Subtasks not showing
- Verify task has `subtasks` array
- Check that subtasks have `id`, `title`, and `status` properties
- Ensure task card is expanded (click expand button)

### Styling issues
- Confirm manage-ui-components.css is loaded
- Check for CSS conflicts with existing styles
- Verify correct class names (`.ui-task-card`, not `.demo-task-card`)

### Modal not appearing
- Check z-index conflicts (modals use z-index: 10000)
- Verify ManageUI.modal.show() is called correctly
- Check for JS errors preventing execution

## Support

For issues or questions about the shared component system:
1. Check browser console for errors
2. Verify file load order in HTML
3. Test with sample data from `ManageShared.generators`
4. Review this guide's examples

---

**Version:** 1.0  
**Last Updated:** January 2024  
**Status:** Production Ready ✅
