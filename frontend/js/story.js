// 🎮 Story Weaver - Interactive Story Builder
// A complete CYOA creation tool with modern design and full functionality

class StoryWeaver {
    constructor() {
        // Minimal placeholder story — the full example story is loaded from the JSON file
        this.story = {
            meta: {
                title: "Untitled Story",
                startScene: "",
                version: "1.0",
                created: new Date().toISOString()
            },
            variables: {},
            scenes: {}
        };
        
        this.gameState = {
            currentScene: "start",
            variables: this.cloneVariables(),
            history: [],
            mode: "edit" // "edit" or "play"
        };
        
        this.currentEditingScene = null;
        this.undoStack = [];
        this.redoStack = [];
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.renderEditor();
        const loaded = this.loadFromStorage();
        if (!loaded) {
            // If no saved story in storage, fetch the example story (suppress confirmation)
            this.loadExampleStory(undefined, true);
        }
        // Load list of example stories (manifest.json) for the UI selector
        this.loadExamplesManifest();        // Apply previously saved collapsed state for sidebar
        try {
            const collapsed = localStorage.getItem('story-sidebar-collapsed');
            if (collapsed === '1') {
                document.body.classList.add('sidebar-collapsed');
            }
        } catch(e) {}
        // Update collapse button visual if present
        try {
            const sidebarCollapseBtn = document.getElementById('sidebarCollapseBtn');
            const isCollapsed = document.body.classList.contains('sidebar-collapsed');
            if (sidebarCollapseBtn) {
                sidebarCollapseBtn.setAttribute('aria-expanded', isCollapsed ? 'true' : 'false');
                sidebarCollapseBtn.textContent = isCollapsed ? '⯈' : '⯇';
            }
        } catch(e) {}
    }

    loadExamplesManifest(path = '../exampleStories/manifest.json') {
        fetch(path)
            .then(res => {
                if (!res.ok) throw new Error('Could not fetch examples manifest');
                return res.json();
            })
            .then(list => {
                if (!Array.isArray(list)) return;
                const select = document.getElementById('exampleSelect');
                if (!select) return;
                // remove any existing options and keep the default (disabled placeholder)
                select.innerHTML = '<option value="" disabled selected>Load Example...</option>' + list.map(item => `<option value="${item.file}">${item.title || item.file}</option>`).join('');
                const btn = document.getElementById('loadExampleBtn');
                const resetBtn = document.getElementById('resetExampleBtn');
                // Reveal buttons/select only after manifest loads
                select.style.display = '';
                if (btn) btn.style.display = '';
                if (resetBtn) resetBtn.style.display = '';
                // Reveal the select & button after populating
                select.style.display = '';
                if (btn) btn.style.display = '';
                if (btn) select.addEventListener('change', (e) => {
                    btn.disabled = !e.target.value;
                    if (resetBtn) resetBtn.disabled = !e.target.value;
                });
                if (btn) btn.addEventListener('click', () => {
                    const selected = select.value;
                    if (selected) this.loadExampleStory('../exampleStories/' + selected);
                });
                if (resetBtn) resetBtn.addEventListener('click', () => {
                    const selected = select.value;
                    if (selected) {
                        // Clear stored story and load the example
                        localStorage.removeItem('storyweaver_data');
                        localStorage.removeItem('storyweaver_save');
                        this.loadExampleStory('../exampleStories/' + selected, true);
                        // Close header menu and overlay after reset
                        document.body.classList.remove('header-open');
                        const overlay = document.getElementById('mobileOverlay');
                        if (overlay) overlay.style.display = 'none';
                    }
                });
            }).catch(err => console.warn('Failed to load examples manifest', err));
    }

    // 💾 Data Management
    cloneVariables() {
        const cloned = {};
        for (const [key, variable] of Object.entries(this.story.variables)) {
            cloned[key] = variable.value;
        }
        return cloned;
    }

    saveToStorage() {
        const data = {
            story: this.story,
            timestamp: new Date().toISOString()
        };
        localStorage.setItem('storyweaver_data', JSON.stringify(data));
    }

    showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            bottom: 24px;
            right: 24px;
            padding: 12px 20px;
            background: ${type === 'success' ? 'var(--success)' : type === 'error' ? 'var(--danger)' : 'var(--primary)'};
            color: white;
            border-radius: var(--radius-md);
            box-shadow: var(--shadow-lg);
            z-index: 10000;
            font-weight: 500;
            animation: slideInUp 0.3s ease;
        `;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.animation = 'slideOutDown 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    }

    loadFromStorage() {
        const saved = localStorage.getItem('storyweaver_data');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                this.story = data.story;
                this.renderEditor();
                document.getElementById('storyTitle').value = this.story.meta.title;
                // Update runtime variables
                this.gameState.currentScene = this.story.meta.startScene || this.gameState.currentScene;
                this.gameState.variables = this.cloneVariables();
                return true;
            } catch (e) {
                console.warn('Failed to load saved story:', e);
            }
        }
        return false;
    }

    loadExampleStory(path = '../exampleStories/enchantedForest.json', suppressConfirm = false) {
        // Gracefully fetch and apply the example story JSON
        document.body.classList.add('loading');
        fetch(path)
            .then(response => {
                if (!response.ok) throw new Error(`Failed to fetch story (${response.status})`);
                return response.json();
            })
            .then(data => {
                // If we already have a story in memory or a story in localStorage, optionally confirm replacement
                const hasCurrentStory = Object.keys(this.story.scenes || {}).length > 0;
                const hasSavedStory = !!localStorage.getItem('storyweaver_data');
                if (!suppressConfirm && (hasCurrentStory || hasSavedStory)) {
                    if (!confirm('Loading this example will replace your current story. Continue?')) {
                        return;
                    }
                }
                this.story = data;
                // Update runtime variables and UI
                this.gameState.currentScene = this.story.meta.startScene || this.gameState.currentScene;
                this.gameState.variables = this.cloneVariables();
                this.renderEditor();
                document.body.classList.remove('loading');
            })
            .catch(err => { console.warn('Failed to load example story:', err); document.body.classList.remove('loading'); });
    }

    // 🎨 UI Rendering
    renderEditor() {
        this.renderScenesList();
        this.renderVariablesList();
        this.updateStartingSceneSelect();
        const titleEl = document.getElementById('storyTitle');
        if (titleEl) titleEl.value = this.story.meta.title;
        // Update page title
        try { document.title = this.story.meta.title + ' - Story Weaver'; } catch(e) {}
        // Persist loaded example so it becomes editable
        this.saveToStorage();
        // Small UI animation to indicate new story loaded
        document.body.classList.add('story-loaded');
        setTimeout(() => document.body.classList.remove('story-loaded'), 700);
    }

    renderScenesList() {
        const container = document.getElementById('sceneList');
        if (!container) return;

        const searchTerm = (document.getElementById('sceneSearch')?.value || '').toLowerCase();

        container.innerHTML = '';

        const emojis = ['🌟', '🌙', '🔮', '⚔️', '🏰', '🌺', '🗝️', '💎', '🦋', '🌊'];
        let emojiIndex = 0;

        const scenes = Object.values(this.story.scenes)
            .filter(scene =>
                scene.title.toLowerCase().includes(searchTerm) ||
                scene.id.toLowerCase().includes(searchTerm)
            );
        
        if (scenes.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
                    <div style="font-size: 48px; margin-bottom: 16px;">📝</div>
                    <p>${searchTerm ? 'No scenes match your search.' : 'No scenes yet! Create your first scene to get started.'}</p>
                </div>
            `;
            return;
        }

        scenes.forEach(scene => {
                const sceneItem = document.createElement('div');
                sceneItem.className = 'scene-item';
                sceneItem.title = scene.title;
                sceneItem.setAttribute('aria-label', scene.title);
                sceneItem.dataset.sceneId = scene.id;

                if (this.currentEditingScene === scene.id) {
                    sceneItem.classList.add('active');
                }

                sceneItem.innerHTML = `
                    <div class="scene-emoji">${emojis[emojiIndex % emojis.length]}</div>
                    <div class="scene-info">
                        <div class="scene-title">${scene.title}</div>
                        <div class="scene-id">${scene.id}</div>
                    </div>
                    <div class="scene-actions">
                        <button class="btn btn-danger btn-icon btn-sm" onclick="app.deleteScene('${scene.id}')" title="Delete Scene">
                            <span style="font-size: 12px;">🗑️</span>
                        </button>
                    </div>
                `;

                sceneItem.addEventListener('click', (e) => {
                    if (!e.target.closest('.scene-actions')) {
                        this.editScene(scene.id);
                    }
                });

                container.appendChild(sceneItem);
                emojiIndex++;
            });
    }

    renderVariablesList() {
        const container = document.getElementById('variablesList');
        if (!container) return;
        
        container.innerHTML = '';
        
        if (Object.keys(this.story.variables).length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
                    <div style="font-size: 48px; margin-bottom: 16px;">🎯</div>
                    <p>No variables yet! Add some to track player state.</p>
                </div>
            `;
            return;
        }
        
        Object.entries(this.story.variables).forEach(([name, variable]) => {
            const varItem = document.createElement('div');
            varItem.className = 'variable-item';
            varItem.innerHTML = `
                <div class="variable-info">
                    <div class="variable-name">${name}</div>
                    <div class="variable-type">${variable.type}</div>
                </div>
                <div class="variable-controls">
                    <input 
                        type="${variable.type === 'number' ? 'number' : 'text'}" 
                        class="variable-value-input" 
                        value="${variable.value}"
                        data-var-name="${name}"
                        ${variable.type === 'boolean' ? 'style="display:none;"' : ''}
                    />
                    ${variable.type === 'boolean' ? `
                        <label class="variable-checkbox">
                            <input 
                                type="checkbox" 
                                ${variable.value ? 'checked' : ''}
                                data-var-name="${name}"
                                onchange="app.updateVariableValue('${name}', this.checked)"
                            />
                            <span>${variable.value ? 'true' : 'false'}</span>
                        </label>
                    ` : ''}
                    <button class="btn btn-danger btn-sm btn-icon" onclick="app.deleteVariable('${name}')" title="Delete">
                        ✕
                    </button>
                </div>
            `;
            
            // Add change listener for non-boolean inputs
            if (variable.type !== 'boolean') {
                const input = varItem.querySelector('.variable-value-input');
                input.addEventListener('change', (e) => {
                    let newValue = e.target.value;
                    if (variable.type === 'number') {
                        newValue = parseFloat(newValue) || 0;
                    }
                    this.updateVariableValue(name, newValue);
                });
            }
            
            container.appendChild(varItem);
        });
    }

    updateStartingSceneSelect() {
        const select = document.getElementById('startingScene');
        select.innerHTML = '';
        
        Object.values(this.story.scenes).forEach(scene => {
            const option = document.createElement('option');
            option.value = scene.id;
            option.textContent = scene.title;
            option.selected = scene.id === this.story.meta.startScene;
            select.appendChild(option);
        });
    }

    // ✏️ Scene Editing
    editScene(sceneId) {
        const scene = this.story.scenes[sceneId];
        if (!scene) return;

        this.currentEditingScene = sceneId;

        // Update UI
        const titleEl = document.getElementById('currentSceneTitle');
        const idEl = document.getElementById('currentSceneId');
        const titleInput = document.getElementById('sceneTitleInput');
        const textInput = document.getElementById('sceneTextInput');

        if (titleEl) titleEl.textContent = scene.title;
        if (idEl) idEl.textContent = scene.id;
        if (titleInput) titleInput.value = scene.title;
        if (textInput) textInput.value = scene.text;

        // Update scene list highlighting
        document.querySelectorAll('.scene-item').forEach(item => {
            item.classList.toggle('active', item.dataset.sceneId === sceneId);
        });

        this.renderChoices(scene);
    }

    saveScene() {
        if (!this.currentEditingScene) return;
        
        const scene = this.story.scenes[this.currentEditingScene];
        if (!scene) return;

        const titleInput = document.getElementById('sceneTitleInput');
        const textInput = document.getElementById('sceneTextInput');

        if (titleInput) scene.title = titleInput.value.trim() || 'Untitled Scene';
        if (textInput) scene.text = textInput.value;

        // Update the header to reflect changes
        const titleEl = document.getElementById('currentSceneTitle');
        if (titleEl) titleEl.textContent = scene.title;

        // Re-render the scenes list to show updated title
        this.renderScenesList();
        this.saveToStorage();
        
        // Show toast notification
        this.showToast('Scene saved successfully!');
    }

    renderChoices(scene) {
        const container = document.getElementById('choicesContainer');
        container.innerHTML = '';
        
        if (!scene.choices || scene.choices.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
                    <div style="font-size: 24px; margin-bottom: 16px;">🎭</div>
                    <p>No choices yet! Add some to create branching paths in your story.</p>
                </div>
            `;
            return;
        }
        
        scene.choices.forEach((choice, index) => {
            const choiceItem = document.createElement('div');
            choiceItem.className = 'choice-item';
            
            // Check if conditions or effects exist
            const hasConditions = choice.conditions && choice.conditions.length > 0;
            const hasEffects = choice.effects && choice.effects.length > 0;
            const conditionsBadge = hasConditions ? ` <span style="background: var(--primary); color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 600;">${choice.conditions.length}</span>` : '';
            const effectsBadge = hasEffects ? ` <span style="background: var(--success); color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 600;">${choice.effects.length}</span>` : '';
            
            choiceItem.innerHTML = `
                <div class="choice-header">
                    <div class="choice-number">${index + 1}</div>
                    <input type="text" class="form-input" style="flex: 1;" 
                            value="${choice.text}" 
                            onchange="app.updateChoiceText('${choice.id}', this.value)"
                            placeholder="Enter choice text...">
                </div>
                <div class="form-group">
                    <label class="form-label">Target Scene</label>
                    <select class="form-select" onchange="app.updateChoiceTarget('${choice.id}', this.value)">
                        <option value="">Select target scene...</option>
                        ${Object.values(this.story.scenes).map(s => 
                            `<option value="${s.id}" ${s.id === choice.target ? 'selected' : ''}>${s.title}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="choice-actions">
                    <button class="btn btn-secondary btn-sm" onclick="app.editChoiceConditions('${choice.id}')">
                        <span>🎯</span> Conditions${conditionsBadge}
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="app.editChoiceEffects('${choice.id}')">
                        <span>⚡</span> Effects${effectsBadge}
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="app.deleteChoice('${scene.id}', '${choice.id}')">
                        <span>🗑️</span> Delete
                    </button>
                </div>
            `;
            container.appendChild(choiceItem);
        });
    }

    // 🎮 Game Play Mode
    renderPlayView() {
        // Initialize game state if not already in play mode
        if (this.gameState.mode !== "play") {
            this.startNewGame();
        } else {
            // Just reload the current scene
            this.loadPlayScene(this.gameState.currentScene);
        }
    }

    startNewGame() {
        this.gameState.mode = "play";
        if (!this.story.meta.startScene || !this.story.scenes[this.story.meta.startScene]) {
            this.showModal('Cannot Play', 'No valid starting scene is set. Please choose a starting scene in Settings.');
            this.switchView('dashboard');
            return;
        }
        this.gameState.currentScene = this.story.meta.startScene;
        this.gameState.variables = this.cloneVariables();
        this.gameState.history = [];
        this.loadPlayScene(this.gameState.currentScene);
    }

    enterEditMode() {
        this.gameState.mode = "edit";
        this.switchView('scenes');
    }

    loadPlayScene(sceneId) {
        const scene = this.story.scenes[sceneId];
        if (!scene) {
            this.showModal('Scene Not Found', 'The target scene could not be found. The story may be incomplete.');
            return;
        }
        
        this.gameState.currentScene = sceneId;
        this.gameState.history.push(sceneId);
        
        // Update UI
        document.getElementById('playStoryTitle').textContent = this.story.meta.title;
        document.getElementById('playSceneId').textContent = scene.id;
        document.getElementById('playSceneText').textContent = scene.text;
        
        this.renderPlayChoices(scene);
        this.renderGameStats();
    }

    renderPlayChoices(scene) {
        const container = document.getElementById('playChoices');
        container.innerHTML = '';
        
        if (!scene.choices || scene.choices.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
                    <div style="font-size: 32px; margin-bottom: 16px;">🎊</div>
                    <h3 style="margin-bottom: 16px; color: var(--text-primary);">The End</h3>
                    <p>You've reached the end of this story path. What an adventure!</p>
                </div>
            `;
            return;
        }
        
        const availableChoices = scene.choices.filter(choice => 
            this.checkChoiceConditions(choice.conditions)
        );
        
        if (availableChoices.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
                    <div style="font-size: 32px; margin-bottom: 16px;">🚫</div>
                    <h3 style="margin-bottom: 16px; color: var(--text-primary);">No Options Available</h3>
                    <p>Your current stats don't meet the requirements for any available choices.</p>
                </div>
            `;
            return;
        }
        
        availableChoices.forEach((choice, index) => {
            const choiceBtn = document.createElement('button');
            choiceBtn.className = 'choice-btn';
            choiceBtn.innerHTML = `
                <div class="choice-btn-number">${index + 1}</div>
                <div>${choice.text}</div>
            `;
            
            choiceBtn.addEventListener('click', () => {
                this.selectChoice(choice);
            });
            
            container.appendChild(choiceBtn);
        });
    }

    renderGameStats() {
        const container = document.getElementById('statsGrid');
        container.innerHTML = '';
        
        Object.entries(this.gameState.variables).forEach(([name, value]) => {
            const statItem = document.createElement('div');
            statItem.className = 'stat-item';
            statItem.innerHTML = `
                <div class="stat-value">${value}</div>
                <div class="stat-label">${name}</div>
            `;
            container.appendChild(statItem);
        });
    }

    selectChoice(choice) {
        // Apply effects
        this.applyChoiceEffects(choice.effects);
        
        // Navigate to target scene
        if (choice.target) {
            this.loadPlayScene(choice.target);
        }
    }

    checkChoiceConditions(conditions) {
        if (!conditions || conditions.length === 0) return true;
        
        return conditions.every(condition => {
            const value = this.gameState.variables[condition.variable];
            if (value === undefined) return false;
            
            // Support both 'operator' (symbol) and 'comparison' (string) formats
            let operator = condition.operator;
            if (!operator && condition.comparison) {
                // Convert comparison string to operator symbol
                const comparisonMap = {
                    'equals': '==',
                    'not_equals': '!=',
                    'greater_than': '>',
                    'less_than': '<',
                    'greater_or_equal': '>=',
                    'less_or_equal': '<='
                };
                operator = comparisonMap[condition.comparison] || '==';
            }
            
            switch (operator) {
                case '==': return value == condition.value;
                case '!=': return value != condition.value;
                case '>': return value > condition.value;
                case '<': return value < condition.value;
                case '>=': return value >= condition.value;
                case '<=': return value <= condition.value;
                default: return false;
            }
        });
    }

    applyChoiceEffects(effects) {
        if (!effects || effects.length === 0) return;
        
        effects.forEach(effect => {
            const currentValue = this.gameState.variables[effect.variable];
            if (currentValue === undefined) return;
            
            let newValue = currentValue;
            
            switch (effect.operation) {
                case 'set':
                    newValue = effect.value;
                    break;
                case 'add':
                    newValue = currentValue + effect.value;
                    break;
                case 'subtract':
                    newValue = currentValue - effect.value;
                    break;
                case 'multiply':
                    newValue = currentValue * effect.value;
                    break;
                case 'toggle':
                    newValue = !currentValue;
                    break;
            }
            
            // Apply min/max constraints if they exist
            const variable = this.story.variables[effect.variable];
            if (variable) {
                if (variable.min !== undefined) newValue = Math.max(newValue, variable.min);
                if (variable.max !== undefined) newValue = Math.min(newValue, variable.max);
            }
            
            this.gameState.variables[effect.variable] = newValue;
        });
    }

    // 🛠️ Story Management
    createScene() {
        const sceneId = 'scene_' + Date.now().toString(36);
        const newScene = {
            id: sceneId,
            title: 'New Scene',
            text: 'Describe what happens in this scene...',
            choices: []
        };
        
        this.story.scenes[sceneId] = newScene;
        // Ensure there is a starting scene set if none exists
        if (!this.story.meta.startScene) {
            this.story.meta.startScene = sceneId;
        }
        this.renderEditor();
        this.editScene(sceneId);
        this.saveToStorage();
        this.showToast('New scene created!');
    }

    deleteScene(sceneId) {
        if (!confirm(`Are you sure you want to delete this scene? This action cannot be undone.`)) {
            return;
        }
        
        delete this.story.scenes[sceneId];
        
        // Update start scene if necessary
        if (this.story.meta.startScene === sceneId) {
            const remainingScenes = Object.keys(this.story.scenes);
            this.story.meta.startScene = remainingScenes.length > 0 ? remainingScenes[0] : '';
        }
        
        // Clear editor if this scene was being edited
        if (this.currentEditingScene === sceneId) {
            this.currentEditingScene = null;
            document.getElementById('sceneEditor').classList.add('hidden');
            document.getElementById('welcomeMessage').classList.remove('hidden');
        }
        
        this.renderEditor();
        this.saveToStorage();
        this.showToast('Scene deleted', 'info');
    }

    deleteCurrentScene() {
        if (this.currentEditingScene) {
            this.deleteScene(this.currentEditingScene);
        }
    }

    duplicateScene(sceneId) {
        const originalScene = this.story.scenes[sceneId];
        if (!originalScene) return;
        
        const newSceneId = sceneId + '_copy_' + Date.now().toString(36).slice(-4);
        const duplicatedScene = JSON.parse(JSON.stringify(originalScene));
        duplicatedScene.id = newSceneId;
        // Generate new IDs for copied choices to avoid duplicates
        if (Array.isArray(duplicatedScene.choices)) {
            duplicatedScene.choices = duplicatedScene.choices.map(choice => {
                const newChoice = JSON.parse(JSON.stringify(choice));
                newChoice.id = 'choice_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
                return newChoice;
            });
        }
        duplicatedScene.title = originalScene.title + ' (Copy)';
        
        this.story.scenes[newSceneId] = duplicatedScene;
        this.renderEditor();
        this.editScene(newSceneId);
        this.saveToStorage();
    }

    addChoice() {
        if (!this.currentEditingScene) return;
        
        const scene = this.story.scenes[this.currentEditingScene];
        if (!scene) return;
        
        if (!scene.choices) scene.choices = [];
        
        const choiceId = 'choice_' + Date.now().toString(36);
        const newChoice = {
            id: choiceId,
            text: 'New choice...',
            target: '',
            conditions: [],
            effects: []
        };
        
        scene.choices.push(newChoice);
        this.renderChoices(scene);
        this.saveToStorage();
        this.showToast('Choice added!');
    }

    deleteChoice(sceneId, choiceId) {
        if (!confirm('Delete this choice?')) return;
        
        const scene = this.story.scenes[sceneId];
        if (!scene) return;
        
        scene.choices = scene.choices.filter(choice => choice.id !== choiceId);
        this.renderChoices(scene);
        this.saveToStorage();
    }

    updateChoiceText(choiceId, newText) {
        const scene = this.story.scenes[this.currentEditingScene];
        if (!scene) return;
        
        const choice = scene.choices.find(c => c.id === choiceId);
        if (choice) {
            choice.text = newText;
            this.saveToStorage();
        }
    }

    updateChoiceTarget(choiceId, newTarget) {
        const scene = this.story.scenes[this.currentEditingScene];
        if (!scene) return;
        
        const choice = scene.choices.find(c => c.id === choiceId);
        if (choice) {
            choice.target = newTarget;
            this.saveToStorage();
        }
    }

    // 🎯 Variables Management
    createVariable() {
        this.showVariableModal();
    }

    updateVariableValue(varName, newValue) {
        if (this.story.variables[varName]) {
            this.story.variables[varName].value = newValue;
            this.saveToStorage();
            // Update the display for boolean checkboxes
            if (this.story.variables[varName].type === 'boolean') {
                const label = document.querySelector(`[data-var-name="${varName}"]`).nextElementSibling;
                if (label) {
                    label.textContent = newValue ? 'true' : 'false';
                }
            }
        }
    }

    deleteVariable(varName) {
        if (!confirm(`Delete variable "${varName}"? This may break story logic.`)) return;
        
        delete this.story.variables[varName];
        this.renderVariablesList();
        this.saveToStorage();
        this.showToast(`Variable "${varName}" deleted`, 'info');
    }

    // 📤 Import/Export
    exportStory() {
        const dataStr = JSON.stringify(this.story, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        const safeTitle = (this.story.meta && this.story.meta.title) ? this.story.meta.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'story';
        link.download = `${safeTitle}.json`;
        link.click();
        
        URL.revokeObjectURL(url);
    }

    importStory(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const imported = JSON.parse(e.target.result);
                
                if (!imported.meta || !imported.scenes) {
                    throw new Error('Invalid story file format');
                }
                
                if (confirm('This will replace your current story. Continue?')) {
                    this.story = imported;
                    this.renderEditor();
                    document.getElementById('storyTitle').value = this.story.meta.title;
                    this.saveToStorage();
                    this.showModal('Import Successful', 'Your story has been imported successfully!');
                }
            } catch (error) {
                this.showModal('Import Error', 'Failed to import story: ' + error.message);
            }
        };
        reader.readAsText(file);
    }

    // 🪟 Modal System
    showModal(title, content, buttons = [{ text: 'OK', action: 'close' }]) {
        const modalId = 'modal_' + Date.now();
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = modalId;
        
        modal.innerHTML = `
            <div class="modal">
                <div class="modal-header">
                    <h3 class="modal-title">${title}</h3>
                    <button class="btn btn-secondary btn-sm" onclick="app.closeModal('${modalId}')">✕</button>
                </div>
                <div class="modal-body">
                    ${content}
                </div>
                <div class="modal-footer">
                    ${buttons.map(btn => 
                        `<button class="btn btn-${btn.type || 'primary'}" onclick="app.handleModalAction('${modalId}', '${btn.action}')">${btn.text}</button>`
                    ).join('')}
                </div>
            </div>
        `;
        
        document.getElementById('modalContainer').appendChild(modal);
        setTimeout(() => modal.classList.add('active'), 10);
        
        return modalId;
    }

    showVariableModal() {
        const content = `
            <div class="form-group">
                <label class="form-label">Variable Name</label>
                <input type="text" id="newVarName" class="form-input" placeholder="e.g., playerHealth">
            </div>
            <div class="form-group">
                <label class="form-label">Type</label>
                <select id="newVarType" class="form-select">
                    <option value="number">Number</option>
                    <option value="boolean">Boolean (true/false)</option>
                    <option value="string">Text</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Default Value</label>
                <input type="text" id="newVarValue" class="form-input" placeholder="e.g., 100">
            </div>
        `;
        
        this.showModal('Create Variable', content, [
            { text: 'Cancel', type: 'secondary', action: 'close' },
            { text: 'Create', type: 'primary', action: 'create-variable' }
        ]);
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        }
    }

    handleModalAction(modalId, action) {
        switch (action) {
            case 'close':
                this.closeModal(modalId);
                break;
            case 'create-variable':
                this.handleCreateVariable(modalId);
                break;
        }
    }

    handleCreateVariable(modalId) {
        const name = document.getElementById('newVarName').value.trim();
        const type = document.getElementById('newVarType').value;
        const valueInput = document.getElementById('newVarValue').value;
        
        if (!name) {
            alert('Please enter a variable name');
            return;
        }
        
        if (this.story.variables[name]) {
            alert('A variable with this name already exists');
            return;
        }
        
        let value;
        switch (type) {
            case 'number':
                value = parseFloat(valueInput) || 0;
                break;
            case 'boolean':
                value = valueInput.toLowerCase() === 'true';
                break;
            case 'string':
                value = valueInput || '';
                break;
        }
        
        this.story.variables[name] = {
            type: type,
            value: value,
            ...(type === 'number' && { min: 0, max: 999 })
        };
        
        this.renderVariablesList();
        this.saveToStorage();
        this.closeModal(modalId);
        this.showToast(`Variable "${name}" created!`);
    }

    // 🎧 Event Listeners
    setupEventListeners() {
        // Sidebar navigation
        this.setupSidebarNavigation();

        // Header actions
        document.getElementById('exportBtn').addEventListener('click', () => this.exportStory());
        document.getElementById('importFile').addEventListener('change', (e) => {
            if (e.target.files[0]) {
                this.importStory(e.target.files[0]);
                e.target.value = ''; // Reset input
            }
        });

        // Sidebar toggle
        const sidebarToggle = document.getElementById('sidebarToggle');
        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', () => {
                const dashboardContainer = document.querySelector('.dashboard-container');
                const isCollapsed = dashboardContainer.classList.toggle('sidebar-collapsed');
                sidebarToggle.innerHTML = isCollapsed ? '<span>▷</span>' : '<span>◁</span>';
                sidebarToggle.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
                localStorage.setItem('storyweaver-sidebar-collapsed', isCollapsed ? '1' : '0');
            });
        }

        // Load sidebar collapse state
        const sidebarCollapsed = localStorage.getItem('storyweaver-sidebar-collapsed') === '1';
        if (sidebarCollapsed) {
            const dashboardContainer = document.querySelector('.dashboard-container');
            const sidebarToggle = document.getElementById('sidebarToggle');
            dashboardContainer.classList.add('sidebar-collapsed');
            if (sidebarToggle) {
                sidebarToggle.innerHTML = '<span>▷</span>';
                sidebarToggle.setAttribute('aria-expanded', 'false');
            }
        }

        // Mobile header menu toggle
        const headerMenuBtn = document.getElementById('headerMenuBtn');
        if (headerMenuBtn) {
            headerMenuBtn.addEventListener('click', (e) => {
                document.body.classList.toggle('header-open');
                const expanded = document.body.classList.contains('header-open');
                headerMenuBtn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
            });
        }
        // Close header menu when clicking outside the header-actions area
        document.addEventListener('click', (e) => {
            const header = document.querySelector('.header');
            const isOpen = document.body.classList.contains('header-open');
            if (!isOpen) return;
            const isInsideHeader = header && header.contains(e.target);
            if (!isInsideHeader) {
                document.body.classList.remove('header-open');
            }
        });
        const overlay = document.getElementById('mobileOverlay');
        if (overlay) {
            overlay.addEventListener('click', () => {
                document.body.classList.remove('left-open');
                document.body.classList.remove('right-open');
                document.body.classList.remove('header-open');
                if (headerMenuBtn) headerMenuBtn.setAttribute('aria-expanded', 'false');
                overlay.style.display = 'none';
            });
        }

        // Story settings
        document.getElementById('storyTitle').addEventListener('change', (e) => {
            this.story.meta.title = e.target.value;
            this.saveToStorage();
        });

        document.getElementById('startingScene').addEventListener('change', (e) => {
            this.story.meta.startScene = e.target.value;
            this.saveToStorage();
        });

        // Scene management
        const sceneSearch = document.getElementById('sceneSearch');
        if (sceneSearch) {
            sceneSearch.addEventListener('input', () => this.renderScenesList());
        }
        const addSceneBtn = document.getElementById('addSceneBtn');
        if (addSceneBtn) {
            addSceneBtn.addEventListener('click', () => this.createScene());
        }
        const createFirstScene = document.getElementById('createFirstScene');
        if (createFirstScene) {
            createFirstScene.addEventListener('click', () => this.createScene());
        }

        // Scene editor
        const sceneTitleInput = document.getElementById('sceneTitleInput');
        if (sceneTitleInput) {
            sceneTitleInput.addEventListener('change', (e) => {
                if (!this.currentEditingScene) return;
                const scene = this.story.scenes[this.currentEditingScene];
                if (scene) {
                    scene.title = e.target.value;
                    this.renderScenesList();
                    this.saveToStorage();
                }
            });
        }

        const sceneTextInput = document.getElementById('sceneTextInput');
        if (sceneTextInput) {
            sceneTextInput.addEventListener('change', (e) => {
                if (!this.currentEditingScene) return;
                const scene = this.story.scenes[this.currentEditingScene];
                if (scene) {
                    scene.text = e.target.value;
                    this.saveToStorage();
                }
            });
        }

        const addChoiceBtn = document.getElementById('addChoiceBtn');
        if (addChoiceBtn) {
            addChoiceBtn.addEventListener('click', () => this.addChoice());
        }
        
        const deleteSceneBtn = document.getElementById('deleteSceneBtn');
        if (deleteSceneBtn) {
            deleteSceneBtn.addEventListener('click', () => {
                if (this.currentEditingScene) {
                    this.deleteScene(this.currentEditingScene);
                }
            });
        }

        const duplicateSceneBtn = document.getElementById('duplicateSceneBtn');
        if (duplicateSceneBtn) {
            duplicateSceneBtn.addEventListener('click', () => {
                if (this.currentEditingScene) {
                    this.duplicateScene(this.currentEditingScene);
                }
            });
        }

        // Variables
        const addVariableBtn = document.getElementById('addVariableBtn');
        if (addVariableBtn) {
            addVariableBtn.addEventListener('click', () => this.createVariable());
        }

        // Play mode controls
        const restartBtn = document.getElementById('restartBtn');
        if (restartBtn) {
            restartBtn.addEventListener('click', () => {
                if (confirm('Restart the story from the beginning?')) {
                    this.startNewGame();
                }
            });
        }

        const saveProgressBtn = document.getElementById('saveProgressBtn');
        if (saveProgressBtn) {
            saveProgressBtn.addEventListener('click', () => {
                const saveData = {
                    gameState: this.gameState,
                    timestamp: new Date().toISOString()
                };
                localStorage.setItem('storyweaver_save', JSON.stringify(saveData));
                this.showModal('Progress Saved', 'Your game progress has been saved successfully!');
            });
        }

        const loadProgressBtn = document.getElementById('loadProgressBtn');
        if (loadProgressBtn) {
            loadProgressBtn.addEventListener('click', () => {
            const saved = localStorage.getItem('storyweaver_save');
            if (saved) {
                try {
                    const data = JSON.parse(saved);
                    this.gameState = data.gameState;
                    this.loadPlayScene(this.gameState.currentScene);
                    this.showModal('Progress Loaded', 'Your game progress has been restored!');
                } catch (e) {
                    this.showModal('Load Error', 'Failed to load saved progress.');
                }
            } else {
                this.showModal('No Save Found', 'No saved progress was found.');
            }
            });
        }

        // Scene editor actions
        document.getElementById('addChoiceBtn')?.addEventListener('click', () => this.addChoice());
        document.getElementById('deleteSceneBtn')?.addEventListener('click', () => this.deleteCurrentScene());
        document.getElementById('duplicateSceneBtn')?.addEventListener('click', () => this.duplicateScene());

        // Mobile bottom actions (if visible)
        const playBtnMobile = document.getElementById('playBtnMobile');
        const addSceneBtnMobile = document.getElementById('addSceneBtnMobile');
        const previewBtnMobile = document.getElementById('previewBtnMobile');
        if (playBtnMobile) playBtnMobile.addEventListener('click', () => this.enterPlayMode());
        if (addSceneBtnMobile) addSceneBtnMobile.addEventListener('click', () => this.createScene());
        if (previewBtnMobile) previewBtnMobile.addEventListener('click', () => this.validateStory());

        const validateBtn = document.getElementById('validateBtn');
        if (validateBtn) {
            validateBtn.addEventListener('click', () => this.validateStory());
        }
        
        const statsBtn = document.getElementById('statsBtn');
        if (statsBtn) {
            statsBtn.addEventListener('click', () => this.showStoryStats());
        }
    }

    setupSidebarNavigation() {
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', () => {
                const view = item.dataset.view;
                this.switchView(view);
            });
        });

        // Set default view
        this.switchView('dashboard');
    }

    switchView(viewName) {
        // Remove active class from all nav items
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });

        // Add active class to selected nav item
        const activeNavItem = document.querySelector(`[data-view="${viewName}"]`);
        if (activeNavItem) {
            activeNavItem.classList.add('active');
        }

        // Hide all views
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });

        // Show selected view
        const selectedView = document.getElementById(`${viewName}View`);
        if (selectedView) {
            selectedView.classList.add('active');
        }

        // Update current view
        this.currentView = viewName;

        // Handle view-specific logic
        switch (viewName) {
            case 'dashboard':
                this.renderDashboard();
                break;
            case 'scenes':
                this.renderScenesView();
                break;
            case 'variables':
                this.renderVariablesView();
                break;
            case 'play':
                this.renderPlayView();
                break;
            case 'settings':
                this.renderSettingsView();
                break;
        }
    }

    renderDashboard() {
        const dashboardView = document.getElementById('dashboardView');
        if (!dashboardView) return;

        const sceneCount = Object.keys(this.story.scenes).length;
        const variableCount = Object.keys(this.story.variables).length;
        const choiceCount = Object.values(this.story.scenes).reduce((total, scene) => 
            total + (scene.choices ? scene.choices.length : 0), 0);

        dashboardView.innerHTML = `
            <div class="view-header">
                <h1>Welcome to Story Weaver</h1>
                <p>Create interactive choose-your-own-adventure stories with ease.</p>
                <div class="view-actions">
                    <button class="btn btn-primary" onclick="app.switchView('scenes')">
                        <span>📝</span> Start Creating
                    </button>
                    <button class="btn btn-secondary" onclick="app.switchView('play')">
                        <span>▶️</span> Play Story
                    </button>
                </div>
            </div>

            <div class="dashboard-grid">
                <div class="dashboard-card">
                    <h3>📊 Story Stats</h3>
                    <div class="stats">
                        <div class="stat">
                            <div class="stat-number">${sceneCount}</div>
                            <div class="stat-label">Scenes</div>
                        </div>
                        <div class="stat">
                            <div class="stat-number">${choiceCount}</div>
                            <div class="stat-label">Choices</div>
                        </div>
                        <div class="stat">
                            <div class="stat-number">${variableCount}</div>
                            <div class="stat-label">Variables</div>
                        </div>
                    </div>
                </div>

                <div class="dashboard-card">
                    <h3>🚀 Quick Actions</h3>
                    <div class="quick-actions">
                        <button class="btn btn-secondary" onclick="app.createScene()">
                            <span>➕</span> Add Scene
                        </button>
                        <button class="btn btn-secondary" onclick="app.exportStory()">
                            <span>💾</span> Export Story
                        </button>
                        <button class="btn btn-secondary" onclick="app.validateStory()">
                            <span>✅</span> Validate
                        </button>
                    </div>
                </div>

                <div class="dashboard-card">
                    <h3>📚 Recent Scenes</h3>
                    <div class="recent-list">
                        ${Object.values(this.story.scenes).slice(0, 5).map(scene => 
                            `<div class="recent-item" onclick="app.switchView('scenes'); app.editScene('${scene.id}');">
                                ${scene.title}
                            </div>`
                        ).join('')}
                        ${sceneCount === 0 ? '<div class="recent-item">No scenes yet</div>' : ''}
                    </div>
                </div>
            </div>
        `;
        
        // Setup event listeners for dynamically created dashboard buttons
        const createSceneQuick = document.getElementById('createSceneQuick');
        if (createSceneQuick) {
            createSceneQuick.addEventListener('click', () => {
                this.switchView('scenes');
                this.createScene();
            });
        }
        
        const createVariableQuick = document.getElementById('createVariableQuick');
        if (createVariableQuick) {
            createVariableQuick.addEventListener('click', () => {
                this.switchView('variables');
                this.createVariable();
            });
        }
        
        const validateQuick = document.getElementById('validateQuick');
        if (validateQuick) {
            validateQuick.addEventListener('click', () => this.validateStory());
        }
    }

    renderScenesView() {
        const scenesView = document.getElementById('scenesView');
        if (!scenesView) return;

        scenesView.innerHTML = `
            <div class="view-header">
                <h1>Scenes</h1>
                <p>Manage your story scenes and their connections.</p>
                <div class="view-actions">
                    <button class="btn btn-primary" onclick="app.createScene()">
                        <span>➕</span> Add Scene
                    </button>
                </div>
            </div>

            <div class="scenes-container">
                <div class="scenes-list">
                    <div style="padding: 20px; border-bottom: 1px solid var(--border-light);">
                        <input type="text" id="sceneSearch" class="form-input" placeholder="Search scenes..." style="margin-bottom: 16px;">
                    </div>
                    <div id="sceneList" style="padding: 0;">
                        <!-- Scenes will be rendered here -->
                    </div>
                </div>

                <div class="scene-editor" id="sceneEditorContainer">
                    <div class="editor-header">
                        <h2 id="currentSceneTitle">Select a scene to edit</h2>
                        <p id="currentSceneId" style="color: var(--text-light); font-family: monospace;"></p>
                    </div>
                    <div class="editor-content">
                        <div class="form-group">
                            <label class="form-label">Scene Title</label>
                            <input type="text" id="sceneTitleInput" class="form-input" placeholder="Enter scene title">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Scene Text</label>
                            <textarea id="sceneTextInput" class="form-textarea" placeholder="Enter scene content" rows="8"></textarea>
                        </div>
                        <div class="choices-section">
                            <div class="section-header">
                                <h3>Choices</h3>
                                <button class="btn btn-secondary btn-sm" onclick="app.addChoice()" title="Add a new choice (Ctrl+Enter)">
                                    <span>➕</span> Add Choice
                                </button>
                            </div>
                            <div id="choicesContainer">
                                <!-- Choices will be rendered here -->
                            </div>
                        </div>
                        <div class="editor-actions">
                            <button class="btn btn-success" onclick="app.saveScene()" title="Save changes (Ctrl+S)">
                                <span>💾</span> Save Scene
                            </button>
                            <button class="btn btn-danger" onclick="app.deleteCurrentScene()">
                                <span>🗑️</span> Delete Scene
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Re-setup scene-related event listeners
        const sceneSearch = document.getElementById('sceneSearch');
        if (sceneSearch) {
            sceneSearch.addEventListener('input', () => this.renderScenesList());
        }
        this.renderScenesList();
        
        // Setup auto-save for scene inputs
        const sceneTitleInput = document.getElementById('sceneTitleInput');
        const sceneTextInput = document.getElementById('sceneTextInput');
        
        if (sceneTitleInput) {
            let titleUpdateTimeout;
            sceneTitleInput.addEventListener('input', () => {
                if (this.currentEditingScene) {
                    const scene = this.story.scenes[this.currentEditingScene];
                    if (scene) {
                        scene.title = sceneTitleInput.value.trim() || 'Untitled Scene';
                        this.saveToStorage();
                        // Update header in real-time
                        const titleEl = document.getElementById('currentSceneTitle');
                        if (titleEl) titleEl.textContent = scene.title;
                        // Debounce scene list update (wait 500ms after user stops typing)
                        clearTimeout(titleUpdateTimeout);
                        titleUpdateTimeout = setTimeout(() => {
                            this.renderScenesList();
                        }, 500);
                    }
                }
            });
        }
        
        if (sceneTextInput) {
            sceneTextInput.addEventListener('input', () => {
                if (this.currentEditingScene) {
                    const scene = this.story.scenes[this.currentEditingScene];
                    if (scene) {
                        scene.text = sceneTextInput.value;
                        this.saveToStorage();
                    }
                }
            });
        }
        
        // Add keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + S to save scene
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                if (this.currentView === 'scenes' && this.currentEditingScene) {
                    this.saveScene();
                }
            }
            // Ctrl/Cmd + Enter to add choice in scene editor
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                if (this.currentView === 'scenes' && this.currentEditingScene) {
                    e.preventDefault();
                    this.addChoice();
                }
            }
        });
    }

    renderVariablesView() {
        const variablesView = document.getElementById('variablesView');
        if (!variablesView) return;

        variablesView.innerHTML = `
            <div class="view-header">
                <h1>Variables</h1>
                <p>Manage story variables that track player choices and state.</p>
                <div class="view-actions">
                    <button class="btn btn-primary" onclick="app.addVariable()">
                        <span>➕</span> Add Variable
                    </button>
                </div>
            </div>

            <div class="variables-container">
                <div class="variables-list" id="variablesList">
                    <!-- Variables will be rendered here -->
                </div>
            </div>
        `;

        this.renderVariablesList();
    }

    renderSettingsView() {
        const settingsView = document.getElementById('settingsView');
        if (!settingsView) return;

        settingsView.innerHTML = `
            <div class="view-header">
                <h1>Settings</h1>
                <p>Configure your story settings and preferences.</p>
            </div>

            <div class="settings-container">
                <div class="settings-card">
                    <h3>📖 Story Information</h3>
                    <div class="form-group">
                        <label class="form-label">Story Title</label>
                        <input type="text" id="storyTitle" class="form-input" value="${this.story.meta.title}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Starting Scene</label>
                        <select id="startingScene" class="form-select">
                            <!-- Options will be populated -->
                        </select>
                    </div>
                </div>

                <div class="settings-card">
                    <h3>🎨 Theme</h3>
                    <div class="form-group">
                        <button class="btn btn-secondary" onclick="app.toggleTheme()">
                            <span>🌓</span> Toggle Dark Mode
                        </button>
                    </div>
                </div>
            </div>
        `;

        this.updateStartingSceneSelect();
        document.getElementById('storyTitle').addEventListener('change', (e) => {
            this.story.meta.title = e.target.value;
            this.saveToStorage();
        });
        document.getElementById('startingScene').addEventListener('change', (e) => {
            this.story.meta.startScene = e.target.value;
            this.saveToStorage();
        });
    }

    // 🔍 Preview & Validation
    previewScene(sceneId) {
        const scene = this.story.scenes[sceneId];
        if (!scene) return;

        const content = `
            <div style="margin-bottom: 20px;">
                <h4 style="margin-bottom: 8px; color: var(--text-primary);">${scene.title}</h4>
                <p style="white-space: pre-line; margin-bottom: 16px;">${scene.text}</p>
                ${scene.choices && scene.choices.length > 0 ? 
                    `<div style="border-top: 1px solid var(--border); padding-top: 16px;">
                        <h5 style="margin-bottom: 12px; color: var(--text-primary);">Choices:</h5>
                        <ul style="padding-left: 20px;">
                            ${scene.choices.map(choice => 
                                `<li style="margin-bottom: 8px;">
                                    ${choice.text} → ${this.story.scenes[choice.target]?.title || 'No target'}
                                </li>`
                            ).join('')}
                        </ul>
                    </div>` : 
                    '<p style="color: var(--text-secondary);">No choices in this scene</p>'
                }
            </div>
        `;

        this.showModal('Scene Preview', content);
    }

    validateStory() {
        let errors = [];
        let warnings = [];

        // Check for empty scenes
        Object.values(this.story.scenes).forEach(scene => {
            if (!scene.text.trim()) {
                warnings.push(`Scene "${scene.title}" has no description`);
            }
        });

        // Check for choices with invalid targets
        Object.values(this.story.scenes).forEach(scene => {
            if (scene.choices) {
                scene.choices.forEach(choice => {
                    if (choice.target && !this.story.scenes[choice.target]) {
                        errors.push(`Choice "${choice.text}" in scene "${scene.title}" points to non-existent scene`);
                    }
                });
            }
        });

        // Check for unreachable scenes
        const reachableScenes = new Set([this.story.meta.startScene]);
        Object.values(this.story.scenes).forEach(scene => {
            if (scene.choices) {
                scene.choices.forEach(choice => {
                    if (choice.target) {
                        reachableScenes.add(choice.target);
                    }
                });
            }
        });

        Object.keys(this.story.scenes).forEach(sceneId => {
            if (!reachableScenes.has(sceneId) && sceneId !== this.story.meta.startScene) {
                warnings.push(`Scene "${this.story.scenes[sceneId].title}" is not reachable from the starting scene`);
            }
        });

        // Check for unused variables
        const usedVariables = new Set();
        Object.values(this.story.scenes).forEach(scene => {
            if (scene.choices) {
                scene.choices.forEach(choice => {
                    if (choice.conditions) {
                        choice.conditions.forEach(cond => usedVariables.add(cond.variable));
                    }
                    if (choice.effects) {
                        choice.effects.forEach(effect => usedVariables.add(effect.variable));
                    }
                });
            }
        });

        Object.keys(this.story.variables).forEach(varName => {
            if (!usedVariables.has(varName)) {
                warnings.push(`Variable "${varName}" is defined but never used`);
            }
        });

        // Prepare validation report
        let report = '<div style="max-height: 400px; overflow-y: auto;">';
        
        if (errors.length === 0 && warnings.length === 0) {
            report += '<p style="color: var(--primary-solid); font-weight: bold;">🎉 Your story is valid with no issues found!</p>';
        } else {
            if (errors.length > 0) {
                report += '<h4 style="margin-bottom: 8px; color: var(--danger);">Errors</h4>';
                report += '<ul style="margin-bottom: 16px; color: var(--danger);">';
                errors.forEach(error => report += `<li style="margin-bottom: 4px;">${error}</li>`);
                report += '</ul>';
            }
            
            if (warnings.length > 0) {
                report += '<h4 style="margin-bottom: 8px; color: var(--warning);">Warnings</h4>';
                report += '<ul style="margin-bottom: 8px; color: var(--text-secondary);">';
                warnings.forEach(warning => report += `<li style="margin-bottom: 4px;">${warning}</li>`);
                report += '</ul>';
            }
        }

        report += '</div>';

        this.showModal('Story Validation', report, [
            { text: 'OK', action: 'close' }
        ]);
    }

    // 🎯 Conditions Editor
    editChoiceConditions(choiceId) {
        if (!this.currentEditingScene) return;
        
        const scene = this.story.scenes[this.currentEditingScene];
        if (!scene) return;
        
        const choice = scene.choices.find(c => c.id === choiceId);
        if (!choice) return;
        
        if (!choice.conditions) choice.conditions = [];
        
        // Helper function to get operator value (supports both formats)
        const getOperator = (cond) => {
            if (cond.operator) return cond.operator;
            if (cond.comparison) {
                const comparisonMap = {
                    'equals': '==',
                    'not_equals': '!=',
                    'greater_than': '>',
                    'less_than': '<',
                    'greater_or_equal': '>=',
                    'less_or_equal': '<='
                };
                return comparisonMap[cond.comparison] || '==';
            }
            return '==';
        };
        
        const conditionsHTML = choice.conditions.map((cond, index) => {
            const currentOp = getOperator(cond);
            return `
            <div class="choice-item" style="margin-bottom: 12px; padding: 12px; background: var(--surface-hover); border-radius: var(--radius-md);">
                <div style="display: flex; gap: 8px; margin-bottom: 8px;">
                    <select class="form-select" style="flex: 1;" data-index="${index}" data-field="variable" onchange="app.updateConditionField('${choiceId}', ${index}, 'variable', this.value)">
                        ${Object.keys(this.story.variables).map(varName => 
                            `<option value="${varName}" ${varName === cond.variable ? 'selected' : ''}>${varName}</option>`
                        ).join('')}
                    </select>
                    <select class="form-select" style="width: 140px;" data-index="${index}" data-field="operator" onchange="app.updateConditionField('${choiceId}', ${index}, 'operator', this.value)">
                        <option value="==" ${currentOp === '==' ? 'selected' : ''}>Equals</option>
                        <option value="!=" ${currentOp === '!=' ? 'selected' : ''}>Not Equals</option>
                        <option value=">" ${currentOp === '>' ? 'selected' : ''}>Greater Than</option>
                        <option value="<" ${currentOp === '<' ? 'selected' : ''}>Less Than</option>
                        <option value=">=" ${currentOp === '>=' ? 'selected' : ''}>Greater or Equal</option>
                        <option value="<=" ${currentOp === '<=' ? 'selected' : ''}>Less or Equal</option>
                    </select>
                    <input type="text" class="form-input" style="width: 80px;" data-index="${index}" data-field="value" 
                            value="${cond.value}" placeholder="Value" onchange="app.updateConditionField('${choiceId}', ${index}, 'value', this.value)">
                </div>
                <div style="display: flex; justify-content: flex-end;">
                    <button class="btn btn-danger btn-sm" onclick="app.removeCondition('${choiceId}', ${index})">
                        <span>🗑️</span> Remove
                    </button>
                </div>
            </div>
        `}).join('') || '<p style="color: var(--text-secondary); text-align: center;">No conditions yet</p>';
        
        const content = `
            <div style="margin-bottom: 16px;">
                <h4 style="margin-bottom: 12px;">Conditions for Choice</h4>
                <p style="color: var(--text-secondary); margin-bottom: 16px;">${choice.text}</p>
                <div id="conditionsList" style="margin-bottom: 20px; max-height: 300px; overflow-y: auto;">
                    ${conditionsHTML}
                </div>
                <div style="display: flex; gap: 8px;">
                    <select id="newConditionVar" class="form-select" style="flex: 1;">
                        ${Object.keys(this.story.variables).map(varName => 
                            `<option value="${varName}">${varName}</option>`
                        ).join('')}
                    </select>
                    <select id="newConditionOp" class="form-select" style="width: 120px;">
                        <option value="==">Equals</option>
                        <option value="!=">Not Equals</option>
                        <option value=">">Greater Than</option>
                        <option value="<">Less Than</option>
                        <option value=">=">Greater or Equal</option>
                        <option value="<=">Less or Equal</option>
                    </select>
                    <input type="text" id="newConditionValue" class="form-input" style="width: 80px;" placeholder="Value">
                    <button class="btn btn-primary btn-sm" onclick="app.addCondition('${choiceId}')">
                        <span>➕</span> Add
                    </button>
                </div>
            </div>
        `;
        
        this.showModal('Edit Conditions', content, [
            { text: 'Done', action: 'close' }
        ]);
    }

    addCondition(choiceId) {
        const variable = document.getElementById('newConditionVar').value;
        const operator = document.getElementById('newConditionOp').value;
        const value = document.getElementById('newConditionValue').value;
        
        if (!variable || !operator || value === '') {
            alert('Please fill all condition fields');
            return;
        }
        
        const scene = this.story.scenes[this.currentEditingScene];
        if (!scene) return;
        
        const choice = scene.choices.find(c => c.id === choiceId);
        if (!choice) return;
        
        if (!choice.conditions) choice.conditions = [];
        
        // Convert value based on variable type
        const varType = this.story.variables[variable]?.type;
        let parsedValue = value;
        
        if (varType === 'number') {
            parsedValue = parseFloat(value) || 0;
        } else if (varType === 'boolean') {
            parsedValue = value.toLowerCase() === 'true';
        }
        
        // Convert operator to comparison string format (to match JSON structure)
        const operatorToComparison = {
            '==': 'equals',
            '!=': 'not_equals',
            '>': 'greater_than',
            '<': 'less_than',
            '>=': 'greater_or_equal',
            '<=': 'less_or_equal'
        };
        
        choice.conditions.push({
            variable,
            comparison: operatorToComparison[operator] || 'equals',
            value: parsedValue
        });
        
        this.saveToStorage();
        this.editChoiceConditions(choiceId); // Refresh the modal
    }

    updateConditionField(choiceId, index, field, value) {
        if (!this.currentEditingScene) return;
        
        const scene = this.story.scenes[this.currentEditingScene];
        if (!scene) return;
        
        const choice = scene.choices.find(c => c.id === choiceId);
        if (!choice || !choice.conditions || !choice.conditions[index]) return;
        
        const condition = choice.conditions[index];
        
        if (field === 'variable') {
            condition.variable = value;
        } else if (field === 'operator') {
            // Convert operator symbol to comparison string
            const operatorToComparison = {
                '==': 'equals',
                '!=': 'not_equals',
                '>': 'greater_than',
                '<': 'less_than',
                '>=': 'greater_or_equal',
                '<=': 'less_or_equal'
            };
            // Remove old operator field if exists and set comparison
            delete condition.operator;
            condition.comparison = operatorToComparison[value] || 'equals';
        } else if (field === 'value') {
            // Parse value based on variable type
            const variable = this.story.variables[condition.variable];
            if (variable && variable.type === 'number') {
                condition.value = parseFloat(value);
            } else if (variable && variable.type === 'boolean') {
                condition.value = value === 'true';
            } else {
                condition.value = value;
            }
        }
        
        this.saveToStorage();
    }

    removeCondition(choiceId, index) {
        const scene = this.story.scenes[this.currentEditingScene];
        if (!scene) return;
        
        const choice = scene.choices.find(c => c.id === choiceId);
        if (!choice || !choice.conditions) return;
        
        choice.conditions.splice(index, 1);
        this.saveToStorage();
        this.editChoiceConditions(choiceId); // Refresh the modal
    }

    // ⚡ Effects Editor
    editChoiceEffects(choiceId) {
        if (!this.currentEditingScene) return;
        
        const scene = this.story.scenes[this.currentEditingScene];
        if (!scene) return;
        
        const choice = scene.choices.find(c => c.id === choiceId);
        if (!choice) return;
        
        if (!choice.effects) choice.effects = [];
        
        const effectsHTML = choice.effects.map((effect, index) => `
            <div class="choice-item" style="margin-bottom: 12px; padding: 12px; background: var(--surface-hover); border-radius: var(--radius-md);">
                <div style="display: flex; gap: 8px; margin-bottom: 8px; align-items: center;">
                    <select class="form-select" style="flex: 1;" data-index="${index}" data-field="variable">
                        ${Object.keys(this.story.variables).map(varName => 
                            `<option value="${varName}" ${varName === effect.variable ? 'selected' : ''}>${varName}</option>`
                        ).join('')}
                    </select>
                    <select class="form-select" style="width: 140px;" data-index="${index}" data-field="operation">
                        <option value="set" ${effect.operation === 'set' ? 'selected' : ''}>Set To</option>
                        <option value="add" ${effect.operation === 'add' ? 'selected' : ''}>Add</option>
                        <option value="subtract" ${effect.operation === 'subtract' ? 'selected' : ''}>Subtract</option>
                        <option value="multiply" ${effect.operation === 'multiply' ? 'selected' : ''}>Multiply By</option>
                        <option value="toggle" ${effect.operation === 'toggle' ? 'selected' : ''}>Toggle</option>
                    </select>
                    ${effect.operation !== 'toggle' ? `
                        <input type="text" class="form-input" style="width: 80px;" data-index="${index}" data-field="value" 
                                value="${effect.value}" placeholder="Value">
                    ` : ''}
                </div>
                <div style="display: flex; justify-content: flex-end;">
                    <button class="btn btn-danger btn-sm" onclick="app.removeEffect('${choiceId}', ${index})">
                        <span>🗑️</span> Remove
                    </button>
                </div>
            </div>
        `).join('') || '<p style="color: var(--text-secondary); text-align: center;">No effects yet</p>';
        
        const content = `
            <div style="margin-bottom: 16px;">
                <h4 style="margin-bottom: 12px;">Effects for Choice</h4>
                <p style="color: var(--text-secondary); margin-bottom: 16px;">${choice.text}</p>
                <div id="effectsList" style="margin-bottom: 20px; max-height: 300px; overflow-y: auto;">
                    ${effectsHTML}
                </div>
                <div style="display: flex; gap: 8px;">
                    <select id="newEffectVar" class="form-select" style="flex: 1;">
                        ${Object.keys(this.story.variables).map(varName => 
                            `<option value="${varName}">${varName}</option>`
                        ).join('')}
                    </select>
                    <select id="newEffectOp" class="form-select" style="width: 140px;">
                        <option value="set">Set To</option>
                        <option value="add">Add</option>
                        <option value="subtract">Subtract</option>
                        <option value="multiply">Multiply By</option>
                        <option value="toggle">Toggle</option>
                    </select>
                    <input type="text" id="newEffectValue" class="form-input" style="width: 80px;" placeholder="Value">
                    <button class="btn btn-primary btn-sm" onclick="app.addEffect('${choiceId}')">
                        <span>➕</span> Add
                    </button>
                </div>
            </div>
        `;
        
        this.showModal('Edit Effects', content, [
            { text: 'Done', action: 'close' }
        ]);
    }

    addEffect(choiceId) {
        const variable = document.getElementById('newEffectVar').value;
        const operation = document.getElementById('newEffectOp').value;
        const valueInput = document.getElementById('newEffectValue');
        
        if (!variable) {
            alert('Please select a variable');
            return;
        }
        
        if (operation !== 'toggle' && !valueInput.value) {
            alert('Please enter a value');
            return;
        }
        
        const scene = this.story.scenes[this.currentEditingScene];
        if (!scene) return;
        
        const choice = scene.choices.find(c => c.id === choiceId);
        if (!choice) return;
        
        if (!choice.effects) choice.effects = [];
        
        // Convert value based on variable type
        const varType = this.story.variables[variable]?.type;
        let parsedValue = operation === 'toggle' ? true : valueInput.value;
        
        if (varType === 'number' && operation !== 'toggle') {
            parsedValue = parseFloat(valueInput.value) || 0;
        } else if (varType === 'boolean' && operation !== 'toggle') {
            parsedValue = valueInput.value.toLowerCase() === 'true';
        }
        
        choice.effects.push({
            variable,
            operation,
            value: parsedValue
        });
        
        this.saveToStorage();
        this.editChoiceEffects(choiceId); // Refresh the modal
    }

    removeEffect(choiceId, index) {
        const scene = this.story.scenes[this.currentEditingScene];
        if (!scene) return;
        
        const choice = scene.choices.find(c => c.id === choiceId);
        if (!choice || !choice.effects) return;
        
        choice.effects.splice(index, 1);
        this.saveToStorage();
        this.editChoiceEffects(choiceId); // Refresh the modal
    }

    // 📊 Story Statistics
    showStoryStats() {
        const sceneCount = Object.keys(this.story.scenes).length;
        let choiceCount = 0;
        let variableCount = Object.keys(this.story.variables).length;
        let endpointCount = 0;

        Object.values(this.story.scenes).forEach(scene => {
            if (scene.choices) {
                choiceCount += scene.choices.length;
            } else {
                endpointCount++;
            }
        });

        const content = `
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-top: 16px;">
                <div style="background: var(--surface-hover); padding: 16px; border-radius: var(--radius-md); text-align: center;">
                    <div style="font-size: 24px; font-weight: bold; color: var(--primary-solid);">${sceneCount}</div>
                    <div style="font-size: 12px; color: var(--text-secondary);">Scenes</div>
                </div>
                <div style="background: var(--surface-hover); padding: 16px; border-radius: var(--radius-md); text-align: center;">
                    <div style="font-size: 24px; font-weight: bold; color: var(--primary-solid);">${choiceCount}</div>
                    <div style="font-size: 12px; color: var(--text-secondary);">Choices</div>
                </div>
                <div style="background: var(--surface-hover); padding: 16px; border-radius: var(--radius-md); text-align: center;">
                    <div style="font-size: 24px; font-weight: bold; color: var(--primary-solid);">${variableCount}</div>
                    <div style="font-size: 12px; color: var(--text-secondary);">Variables</div>
                </div>
                <div style="background: var(--surface-hover); padding: 16px; border-radius: var(--radius-md); text-align: center;">
                    <div style="font-size: 24px; font-weight: bold; color: var(--primary-solid);">${endpointCount}</div>
                    <div style="font-size: 12px; color: var(--text-secondary);">Endpoints</div>
                </div>
            </div>
        `;

        this.showModal('Story Statistics', content);
    }

    // 🏁 Initialize the app
    static init() {
        if (!window.app) {
            window.app = new StoryWeaver();
        }
        return window.app;
    }

    toggleTheme() {
        // Delegate to themeManager
        if (window.themeManager) {
            window.themeManager.toggleTheme();
        }
    }
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    StoryWeaver.init();
});

// Separate Drum Game class to avoid conflicts
class DrumGame {
    constructor() {
        this.beatInterval = null;
        this.currentBeat = 0;
        this.expectedPressTime = 0;
        this.lastPressTime = 0;
        this.score = 0;
        this.requiredScore = 5;
        this.countdown = 3;
        this.bpm = 120;
        this.beatDuration = 60000 / this.bpm;
        this.isGameActive = false;
        
        this.init();
    }
    
    init() {
        this.createModal();
        this.setupEventListeners();
        this.scheduleRandomModal();
    }
    
    createModal() {
        const style = document.createElement('style');
        style.textContent = `
            #drumModal {
                display: none;
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                padding: 20px;
                background: #333;
                color: white;
                border-radius: 10px;
                text-align: center;
                z-index: 1000;
                box-shadow: 0 0 20px rgba(0,0,0,0.5);
            }
            
            #drumButton {
                padding: 15px 30px;
                font-size: 20px;
                background: #2e7d32;
                color: white;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                transition: all 0.1s;
            }
            
            #drumButton:active {
                transform: scale(0.95);
                background: #45a049;
            }
            
            #beatIndicator {
                height: 20px;
                width: 100%;
                background: #555;
                margin: 20px 0;
                border-radius: 10px;
                overflow: hidden;
            }
            
            #beatProgress {
                height: 100%;
                width: 0%;
                background: #2e7d32;
                transition: width 0.1s;
            }
            
            #countdown {
                font-size: 24px;
                margin: 10px 0;
            }
        `;
        document.head.appendChild(style);
        
        const modal = document.createElement('div');
        modal.id = 'drumModal';
        modal.innerHTML = `
            <h2>Drum Rhythm Game!</h2>
            <p>Press the button in rhythm with the beats!</p>
            <div id="beatIndicator"><div id="beatProgress"></div></div>
            <div id="countdown">3</div>
            <button id="drumButton">DRUM</button>
        `;
        document.body.appendChild(modal);
        
        this.drumButton = document.getElementById('drumButton');
        this.beatProgress = document.getElementById('beatProgress');
        this.countdownElement = document.getElementById('countdown');
        this.drumModal = document.getElementById('drumModal');
    }
    
    setupEventListeners() {
        this.drumButton.addEventListener('click', () => this.handleDrumPress());
        
        document.addEventListener('keydown', (e) => {
            if (e.key === '$' && !this.isGameActive) {
                this.startDrumGame();
            }
        });
    }
    
    startDrumGame() {
        if (this.isGameActive) return;
        
        this.isGameActive = true;
        this.drumModal.style.display = 'block';
        this.score = 0;
        this.countdown = 3;
        this.countdownElement.textContent = this.countdown;
        
        // Initial countdown
        const countdownInterval = setInterval(() => {
            this.countdown--;
            this.countdownElement.textContent = this.countdown;
            
            if (this.countdown <= 0) {
                clearInterval(countdownInterval);
                this.startBeats();
            }
        }, 1000);
    }
    
    startBeats() {
        this.countdownElement.textContent = "GO!";
        
        // Start the beat indicator animation
        this.beatInterval = setInterval(() => {
            this.currentBeat++;
            this.expectedPressTime = Date.now() + this.beatDuration;
            
            // Animate the beat indicator
            this.beatProgress.style.width = '100%';
            setTimeout(() => {
                this.beatProgress.style.width = '0%';
            }, this.beatDuration * 0.9);
            
            // Play a sound
            this.playDrumSound();
            
        }, this.beatDuration);
        
        // Set a timeout to end the game if the player doesn't succeed
        setTimeout(() => {
            if (this.score < this.requiredScore) {
                this.endGame(false);
            }
        }, this.requiredScore * this.beatDuration * 2);
    }
    
    playDrumSound() {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.type = 'sine';
            oscillator.frequency.value = this.currentBeat % 4 === 0 ? 220 : 440;
            gainNode.gain.value = 0.1;
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.1);
        } catch (e) {
            console.warn('Could not play drum sound:', e);
        }
    }
    
    handleDrumPress() {
        if (!this.isGameActive) return;
        
        const now = Date.now();
        const timingAccuracy = Math.abs(now - this.expectedPressTime);
        
        // Allow some leeway in timing (20% of beat duration)
        if (timingAccuracy < this.beatDuration * 0.2) {
            this.score++;
            this.drumButton.style.backgroundColor = '#2e7d32';
            
            if (this.score >= this.requiredScore) {
                this.endGame(true);
            }
        } else {
            this.drumButton.style.backgroundColor = '#f44336';
        }
        
        setTimeout(() => {
            this.drumButton.style.backgroundColor = '#2e7d32';
        }, 200);
        
        this.lastPressTime = now;
    }
    
    endGame(success) {
        clearInterval(this.beatInterval);
        this.isGameActive = false;
        
        if (success) {
            this.countdownElement.textContent = "Success!";
            setTimeout(() => {
                this.drumModal.style.display = 'none';
            }, 1500);
        } else {
            this.countdownElement.textContent = "Failed!";
            setTimeout(() => {
                this.drumModal.style.display = 'none';
                alert('You failed the rhythm challenge!');
            }, 1500);
        }
    }
    
    scheduleRandomModal() {
        const randomTime = Math.random() * (30000000 - 300000) + 300000; // 5-500 minutes in milliseconds
        setTimeout(() => {
            this.startDrumGame();
            this.scheduleRandomModal(); // Schedule the next one
        }, randomTime);
    }
}

// Initialize the drum game when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize the drum game if it's not already initialized
    if (!window.drumGame) {
        window.drumGame = new DrumGame();
    }
});