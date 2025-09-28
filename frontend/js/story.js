// 🎮 Story Weaver - Interactive Story Builder
// A complete CYOA creation tool with modern design and full functionality

class StoryWeaver {
    constructor() {
        this.story = {
            meta: {
                title: "The Enchanted Forest",
                startScene: "start",
                version: "1.0",
                created: new Date().toISOString()
            },
            variables: {
                health: { type: "number", value: 100, min: 0, max: 100 },
                courage: { type: "number", value: 50, min: 0, max: 100 },
                hasMap: { type: "boolean", value: false },
                gold: { type: "number", value: 25, min: 0, max: 999 }
            },
            scenes: {
                start: {
                    id: "start",
                    title: "The Forest's Edge",
                    text: "You stand at the edge of a mysterious forest. Ancient trees tower above you, their branches intertwined to form a canopy so thick that only scattered beams of sunlight reach the forest floor. A worn path disappears into the shadows ahead, while to your left, you notice strange glowing flowers that seem to pulse with their own inner light.",
                    choices: [
                        {
                            id: "choice_1",
                            text: "Follow the worn path deeper into the forest",
                            target: "deep_forest",
                            conditions: [],
                            effects: [{ variable: "courage", operation: "add", value: 5 }]
                        },
                        {
                            id: "choice_2", 
                            text: "Investigate the glowing flowers",
                            target: "magic_flowers",
                            conditions: [],
                            effects: [{ variable: "health", operation: "add", value: 10 }]
                        },
                        {
                            id: "choice_3",
                            text: "Turn back - this place feels too dangerous",
                            target: "safe_retreat",
                            conditions: [],
                            effects: [{ variable: "courage", operation: "subtract", value: 10 }]
                        }
                    ]
                },
                deep_forest: {
                    id: "deep_forest",
                    title: "Into the Heart of Mystery",
                    text: "The path winds deeper into the forest, and you notice the air growing cooler and more mysterious. Strange sounds echo from the darkness between the trees. Suddenly, you come across a fork in the path - one way leads to what looks like ruins of an ancient temple, while the other descends toward the sound of running water.",
                    choices: [
                        {
                            id: "choice_4",
                            text: "Explore the ancient temple ruins",
                            target: "temple_ruins",
                            conditions: [{ variable: "courage", operator: ">=", value: 40 }],
                            effects: [{ variable: "gold", operation: "add", value: 50 }]
                        },
                        {
                            id: "choice_5",
                            text: "Follow the path to the water source",
                            target: "hidden_spring",
                            conditions: [],
                            effects: [{ variable: "health", operation: "set", value: 100 }]
                        }
                    ]
                },
                magic_flowers: {
                    id: "magic_flowers",
                    title: "The Enchanted Garden",
                    text: "As you approach the glowing flowers, you feel a warm, tingling sensation. These are healing blossoms - rare magical plants that can restore vitality. You carefully pick a few, feeling your strength renewed. But as you do, you hear a gentle voice warning you that taking too much magic from the forest comes with a price.",
                    choices: [
                        {
                            id: "choice_6",
                            text: "Take only what you need and continue respectfully",
                            target: "wise_path",
                            conditions: [],
                            effects: [{ variable: "hasMap", operation: "set", value: true }]
                        },
                        {
                            id: "choice_7",
                            text: "Gather as many flowers as possible",
                            target: "greedy_path",
                            conditions: [],
                            effects: [{ variable: "health", operation: "subtract", value: 20 }]
                        }
                    ]
                }
            }
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
        this.loadFromStorage();
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

    loadFromStorage() {
        const saved = localStorage.getItem('storyweaver_data');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                this.story = data.story;
                this.renderEditor();
                document.getElementById('storyTitle').value = this.story.meta.title;
            } catch (e) {
                console.warn('Failed to load saved story:', e);
            }
        }
    }

    // 🎨 UI Rendering
    renderEditor() {
        this.renderScenesList();
        this.renderVariablesList();
        this.updateStartingSceneSelect();
    }

    renderScenesList() {
        const container = document.getElementById('sceneList');
        const searchTerm = document.getElementById('sceneSearch').value.toLowerCase();
        
        container.innerHTML = '';
        
        const emojis = ['🌟', '🌙', '🔮', '⚔️', '🏰', '🌺', '🗝️', '💎', '🦋', '🌊'];
        let emojiIndex = 0;
        
        Object.values(this.story.scenes)
            .filter(scene => 
                scene.title.toLowerCase().includes(searchTerm) || 
                scene.id.toLowerCase().includes(searchTerm)
            )
            .forEach(scene => {
                const sceneItem = document.createElement('div');
                sceneItem.className = 'scene-item';
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
        container.innerHTML = '';
        
        Object.entries(this.story.variables).forEach(([name, variable]) => {
            const varItem = document.createElement('div');
            varItem.className = 'variable-item';
            varItem.innerHTML = `
                <div class="variable-info">
                    <div class="variable-name">${name}</div>
                    <div class="variable-type">${variable.type}</div>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <div class="variable-value">${variable.value}</div>
                    <button class="btn btn-danger btn-icon btn-sm" onclick="app.deleteVariable('${name}')" title="Delete Variable">
                        <span style="font-size: 10px;">❌</span>
                    </button>
                </div>
            `;
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
        
        // Hide welcome message and show editor
        document.getElementById('welcomeMessage').classList.add('hidden');
        document.getElementById('sceneEditor').classList.remove('hidden');
        
        // Update UI
        document.getElementById('currentSceneTitle').textContent = scene.title;
        document.getElementById('currentSceneId').textContent = scene.id;
        document.getElementById('sceneTitleInput').value = scene.title;
        document.getElementById('sceneTextInput').value = scene.text;
        
        // Update scene list highlighting
        document.querySelectorAll('.scene-item').forEach(item => {
            item.classList.toggle('active', item.dataset.sceneId === sceneId);
        });
        
        this.renderChoices(scene);
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
                        <span>🎯</span> Conditions
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="app.editChoiceEffects('${choice.id}')">
                        <span>⚡</span> Effects
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
    enterPlayMode() {
        this.gameState.mode = "play";
        this.gameState.currentScene = this.story.meta.startScene;
        this.gameState.variables = this.cloneVariables();
        this.gameState.history = [];
        
        document.getElementById('editorMode').classList.add('hidden');
        document.getElementById('playMode').classList.remove('hidden');
        document.getElementById('playBtn').classList.add('hidden');
        document.getElementById('editBtn').classList.remove('hidden');
        
        this.loadPlayScene(this.gameState.currentScene);
    }

    enterEditMode() {
        this.gameState.mode = "edit";
        
        document.getElementById('editorMode').classList.remove('hidden');
        document.getElementById('playMode').classList.add('hidden');
        document.getElementById('playBtn').classList.remove('hidden');
        document.getElementById('editBtn').classList.add('hidden');
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
            
            switch (condition.operator) {
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
        this.renderEditor();
        this.editScene(sceneId);
        this.saveToStorage();
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
    }

    duplicateScene(sceneId) {
        const originalScene = this.story.scenes[sceneId];
        if (!originalScene) return;
        
        const newSceneId = sceneId + '_copy_' + Date.now().toString(36).slice(-4);
        const duplicatedScene = JSON.parse(JSON.stringify(originalScene));
        duplicatedScene.id = newSceneId;
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

    deleteVariable(varName) {
        if (!confirm(`Delete variable "${varName}"? This may break story logic.`)) return;
        
        delete this.story.variables[varName];
        this.renderVariablesList();
        this.saveToStorage();
    }

    // 📤 Import/Export
    exportStory() {
        const dataStr = JSON.stringify(this.story, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `${this.story.meta.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
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
    }

    // 🎧 Event Listeners
    setupEventListeners() {
        // Header actions
        document.getElementById('playBtn').addEventListener('click', () => this.enterPlayMode());
        document.getElementById('editBtn').addEventListener('click', () => this.enterEditMode());
        document.getElementById('exportBtn').addEventListener('click', () => this.exportStory());
        document.getElementById('importFile').addEventListener('change', (e) => {
            if (e.target.files[0]) {
                this.importStory(e.target.files[0]);
                e.target.value = ''; // Reset input
            }
        });

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
        document.getElementById('sceneSearch').addEventListener('input', () => this.renderScenesList());
        document.getElementById('addSceneBtn').addEventListener('click', () => this.createScene());
        document.getElementById('createFirstScene').addEventListener('click', () => this.createScene());

        // Scene editor
        document.getElementById('sceneTitleInput').addEventListener('change', (e) => {
            if (!this.currentEditingScene) return;
            const scene = this.story.scenes[this.currentEditingScene];
            if (scene) {
                scene.title = e.target.value;
                this.renderScenesList();
                this.saveToStorage();
            }
        });

        document.getElementById('sceneTextInput').addEventListener('change', (e) => {
            if (!this.currentEditingScene) return;
            const scene = this.story.scenes[this.currentEditingScene];
            if (scene) {
                scene.text = e.target.value;
                this.saveToStorage();
            }
        });

        document.getElementById('addChoiceBtn').addEventListener('click', () => this.addChoice());
        document.getElementById('deleteSceneBtn').addEventListener('click', () => {
            if (this.currentEditingScene) {
                this.deleteScene(this.currentEditingScene);
            }
        });

        document.getElementById('duplicateSceneBtn').addEventListener('click', () => {
            if (this.currentEditingScene) {
                this.duplicateScene(this.currentEditingScene);
            }
        });

        // Variables
        document.getElementById('addVariableBtn').addEventListener('click', () => this.createVariable());

        // Play mode controls
        document.getElementById('restartBtn').addEventListener('click', () => {
            if (confirm('Restart the story from the beginning?')) {
                this.enterPlayMode(); // This will reset the game state
            }
        });

        document.getElementById('saveProgressBtn').addEventListener('click', () => {
            const saveData = {
                gameState: this.gameState,
                timestamp: new Date().toISOString()
            };
            localStorage.setItem('storyweaver_save', JSON.stringify(saveData));
            this.showModal('Progress Saved', 'Your game progress has been saved successfully!');
        });

        document.getElementById('loadProgressBtn').addEventListener('click', () => {
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

        // Quick actions
        document.getElementById('previewBtn').addEventListener('click', () => {
            if (!this.currentEditingScene) {
                this.showModal('No Scene Selected', 'Please select a scene to preview.');
                return;
            }
            this.previewScene(this.currentEditingScene);
        });

        document.getElementById('validateBtn').addEventListener('click', () => this.validateStory());
        document.getElementById('statsBtn').addEventListener('click', () => this.showStoryStats());
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
        
        const conditionsHTML = choice.conditions.map((cond, index) => `
            <div class="choice-item" style="margin-bottom: 12px; padding: 12px; background: var(--surface-hover); border-radius: var(--radius-md);">
                <div style="display: flex; gap: 8px; margin-bottom: 8px;">
                    <select class="form-select" style="flex: 1;" data-index="${index}" data-field="variable">
                        ${Object.keys(this.story.variables).map(varName => 
                            `<option value="${varName}" ${varName === cond.variable ? 'selected' : ''}>${varName}</option>`
                        ).join('')}
                    </select>
                    <select class="form-select" style="width: 120px;" data-index="${index}" data-field="operator">
                        <option value="==" ${cond.operator === '==' ? 'selected' : ''}>Equals</option>
                        <option value="!=" ${cond.operator === '!=' ? 'selected' : ''}>Not Equals</option>
                        <option value=">" ${cond.operator === '>' ? 'selected' : ''}>Greater Than</option>
                        <option value="<" ${cond.operator === '<' ? 'selected' : ''}>Less Than</option>
                        <option value=">=" ${cond.operator === '>=' ? 'selected' : ''}>Greater or Equal</option>
                        <option value="<=" ${cond.operator === '<=' ? 'selected' : ''}>Less or Equal</option>
                    </select>
                    <input type="text" class="form-input" style="width: 80px;" data-index="${index}" data-field="value" 
                            value="${cond.value}" placeholder="Value">
                </div>
                <div style="display: flex; justify-content: flex-end;">
                    <button class="btn btn-danger btn-sm" onclick="app.removeCondition('${choiceId}', ${index})">
                        <span>🗑️</span> Remove
                    </button>
                </div>
            </div>
        `).join('') || '<p style="color: var(--text-secondary); text-align: center;">No conditions yet</p>';
        
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
        
        choice.conditions.push({
            variable,
            operator,
            value: parsedValue
        });
        
        this.saveToStorage();
        this.editChoiceConditions(choiceId); // Refresh the modal
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