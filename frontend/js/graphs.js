// #region *** DOM references ***********
const lanIP = `http://${window.location.hostname}`;
// domGraphs will now store direct chart instances, indexed by an arbitrary key (e.g., 'temp', 'light', 'servo')
// to allow proper destruction.
let domGraphs = {
    temp: null,
    light: null,
    servo: null
}; 
let currentSessionData = null; // Will hold data for the single, currently displayed session
let availableSessions = []; // Will hold the list of all available sessions
let currentSessionId = null; // Current session ID being displayed
let totalSessions = 0; // Total sessions available
let isLoading = false;
// #endregion

// #region *** Utility Functions ***********
const formatSessionName = (session) => {
    // Handle case where name might be a datetime object or string
    if (session.name) {
        if (typeof session.name === 'string') {
            return session.name;
        } else if (session.name instanceof Date || (typeof session.name === 'object' && session.name.getTime)) {
            // If it's a Date object, format it nicely
            return new Date(session.name).toLocaleString();
        } else if (typeof session.name === 'object') {
            // If it's a datetime-like object from backend, try to parse it
            try {
                const dateStr = session.name.toString();
                const date = new Date(dateStr);
                if (!isNaN(date.getTime())) {
                    return date.toLocaleString();
                }
            } catch (e) {
                console.warn('Could not parse session name as date:', session.name);
            }
        }
    }
    
    // Fallback to session ID
    return `Session ${session.id}`;
};

const sanitizeSessionData = (sessions) => {
    if (!Array.isArray(sessions)) return [];
    
    return sessions.map(session => ({
        ...session,
        name: formatSessionName(session)
    }));
};
// #endregion

// #region *** Chart Creation Functions ***********
const createNonInteractiveChart = (element, data, seriesName, color) => {
    const options = {
        chart: {
            type: 'line',
            height: '100%',
            toolbar: { show: false },
            zoom: { enabled: false },
            selection: { enabled: false },
            animations: {
                enabled: true,
                easing: 'easeout',
                speed: 800
            },
            fontFamily: 'inherit',
            foreColor: '#0e1827',
            sparkline: { enabled: false },
            redrawOnParentResize: true
        },
        series: [{
            name: seriesName,
            data
        }],
        stroke: {
            curve: 'smooth',
            width: 2.5,
            lineCap: 'round',
            colors: [color]
        },
        colors: [color],
        fill: {
            type: 'solid',
            opacity: 1
        },
        xaxis: {
            type: 'datetime',
            tooltip: { enabled: false },
            labels: {
                style: {
                    fontSize: '11px',
                    colors: '#0e1827'
                }
            },
            axisBorder: {
                show: false
            },
            axisTicks: {
                show: false
            }
        },
        yaxis: {
            tooltip: { enabled: false },
            labels: {
                style: {
                    fontSize: '11px',
                    colors: '#0e1827'
                },
                offsetX: -5
            },
            axisBorder: {
                show: false
            },
            min: (min) => Math.min(min, Math.min(...data.map(d => d.y)) - 5),
            max: (max) => Math.max(max, Math.max(...data.map(d => d.y)) + 5),
        },
        tooltip: {
            enabled: true,
            custom: function({ series, seriesIndex, dataPointIndex, w }) {
                const date = new Date(w.globals.seriesX[seriesIndex][dataPointIndex]);
                return `
                    <div class="chart-tooltip">
                        <div class="tooltip-header" style="color: ${color};">
                            ${seriesName}
                        </div>
                        <div class="tooltip-body">
                            <div class="tooltip-date">${date.toLocaleString()}</div>
                            <div class="tooltip-value">${series[seriesIndex][dataPointIndex].toFixed(2)}</div>
                        </div>
                    </div>
                `;
            }
        },
        markers: {
            size: 0,
            strokeWidth: 0
        },
        grid: {
            borderColor: 'rgba(14, 24, 39, 0.1)',
            strokeDashArray: 0,
            position: 'back',
            padding: {
                bottom: 15
            },
            xaxis: {
                lines: { show: true }
            },
            yaxis: {
                lines: { show: true }
            }
        },
        dataLabels: {
            enabled: false
        }
    };

    const chart = new ApexCharts(element, options);
    chart.render();
    return chart;
};

const showTemperatureChart = (element, data) => {
    return createNonInteractiveChart(element, data, 'Temperature (°C)', '#d32f2f');
};

const showLightChart = (element, data) => {
    return createNonInteractiveChart(element, data, 'Light (lux)', '#0d9edb');
};

const showSoundChart = (element, data) => {
    return createNonInteractiveChart(element, data, 'Servo (degrees)', '#e65100');
};
// #endregion

// #region *** UI Components ***********
const createChatDisplay = (chatMessages) => {
    if (!chatMessages || chatMessages.length === 0) {
        return '<p class="empty-state">No chat messages</p>';
    }

    const chatHTML = chatMessages.map(msg => {
        const timestamp = msg.created_at ? new Date(msg.created_at).toLocaleString() : 'Unknown time';
        const username = msg.username || 'Anonymous';
        const message = msg.message || '';

        return `
            <div class="chat-message">
                <div class="message-header">
                    <span class="username">${username}</span>
                    <span class="timestamp">${timestamp}</span>
                </div>
                <div class="message-content">${message}</div>
            </div>
        `;
    }).join('');

    return `<div class="chat-display">${chatHTML}</div>`;
};

const createPlayerAnswersDisplay = (playerAnswers) => {
    if (!playerAnswers || playerAnswers.length === 0) {
        return '<p class="empty-state">No player answers</p>';
    }

    const answersHTML = playerAnswers.map(questionData => {
        const questionText = questionData.question_text || `Question ${questionData.question_id}`;
        const answers = questionData.player_answers || [];

        const answersListHTML = answers.map(answer => {
            const playerName = `${answer.first_name || ''} ${answer.last_name || ''}`.trim() || 'Unknown Player';
            const answerText = answer.answer_text || 'No answer';
            const isCorrect = answer.is_correct;
            const points = answer.points_earned || 0;
            const timeFormatted = answer.time_taken ? `${answer.time_taken}s` : 'N/A';
            const timestamp = answer.answered_at ? new Date(answer.answered_at).toLocaleString() : 'Unknown time';

            const correctnessClass = isCorrect ? 'correct' : 'incorrect';
            const correctnessIcon = isCorrect ? '✓' : '✗';

            return `
                <div class="player-answer ${correctnessClass}">
                    <div class="answer-header">
                        <span class="player-name">${playerName}</span>
                        <span class="points">${correctnessIcon} ${points} pts</span>
                    </div>
                    <div class="answer-text">${answerText}</div>
                    <div class="answer-footer">
                        <span>Time: ${timeFormatted}</span>
                        <span>${timestamp}</span>
                    </div>
                </div>
            `;
        }).join('');

        return `
            <div class="question-group">
                <h4 class="question-title">${questionText}</h4>
                ${answersListHTML}
            </div>
        `;
    }).join('');

    return `<div class="player-answers-display">${answersHTML}</div>`;
};

const createToggleContainer = (sessionId, chatMessages, playerAnswers) => {
    const containerId = `toggleContainer${sessionId}`;
    const headerId = `toggleHeader${sessionId}`;
    const contentId = `toggleContent${sessionId}`;

    const initialShowChat = chatMessages.length > 0;
    const hasChat = chatMessages.length > 0;
    const hasAnswers = playerAnswers.length > 0;

    if (!hasChat && !hasAnswers) return '';

    return `
        <div id="${containerId}" class="toggle-container" tabindex="0">
            <div id="${headerId}" class="toggle-header gamepad ${initialShowChat ? 'chat' : 'answers'}">
                <h3 class="toggle-title">${initialShowChat ? 'Chat Messages' : 'Player Answers'}</h3>
                <div class="toggle-meta">
                    ${hasChat ? `<span class="badge">${chatMessages.length}</span>` : ''}
                    ${hasAnswers ? `<span class="badge">${playerAnswers.length}</span>` : ''}
                    ${hasChat && hasAnswers ? '<span class="toggle-icon">↕</span>' : ''}
                </div>
            </div>
            <div id="${contentId}" class="toggle-content">
                ${initialShowChat ? createChatDisplay(chatMessages) : createPlayerAnswersDisplay(playerAnswers)}
            </div>
        </div>
    `;
};

const initToggleContainer = (sessionId, chatMessages, playerAnswers) => {
    const container = document.getElementById(`toggleContainer${sessionId}`);
    if (!container) return;

    const header = document.getElementById(`toggleHeader${sessionId}`);
    const content = document.getElementById(`toggleContent${sessionId}`);
    const title = header.querySelector('.toggle-title');

    let showChat = chatMessages.length > 0;
    const hasChat = chatMessages.length > 0;
    const hasAnswers = playerAnswers.length > 0;

    const toggleContent = () => {
        if (!hasChat || !hasAnswers) return;

        showChat = !showChat;
        header.classList.toggle('chat');
        header.classList.toggle('answers');

        if (showChat) {
            title.textContent = 'Chat Messages';
            content.innerHTML = createChatDisplay(chatMessages);
        } else {
            title.textContent = 'Player Answers';
            content.innerHTML = createPlayerAnswersDisplay(playerAnswers);
        }

        if (window.gamepadNavigator) {
            window.gamepadNavigator.updateNavigableElements();
        }
    };

    header.addEventListener('click', toggleContent);
    container.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleContent();
        }
    });
};

// #endregion

// #region *** Session Selection Functions ***********
const createSessionSelector = (availableSessions, currentSessionId) => {
    if (!availableSessions || availableSessions.length === 0) {
        return '<p class="empty-state">No sessions available</p>';
    }

    // Sanitize session data to ensure names are strings
    const sanitizedSessions = sanitizeSessionData(availableSessions);

    const options = sanitizedSessions.map(session => 
        `<option value="${session.id}" ${session.id === currentSessionId ? 'selected' : ''}>
            ${session.name}
        </option>`
    ).join('');

    return `
        <div class="session-selector-container">
            <label for="sessionSelect" class="session-selector-label">
                Choose Session (${sanitizedSessions.length} available):
            </label>
            <select id="sessionSelect" class="gamepad session-selector">
                ${options}
            </select>
        </div>
    `;
};

const fetchSessionData = async (sessionId = null) => {
    if (isLoading) {
        console.warn("Already loading, ignoring request for session", sessionId);
        return;
    }

    isLoading = true;
    const quizSessionsContainer = document.querySelector('.c-quiz-sessions-container');
    const sessionSelectorContainer = document.getElementById('sessionSelectorContainer');

    // Display loading state
    if (quizSessionsContainer) {
        quizSessionsContainer.innerHTML = `
            <div class="loading-state">
                <div class="spinner"></div>
                <p>Loading session${sessionId ? ` ${sessionId}` : ''}...</p>
            </div>
        `;
    }
    
    // Clear old charts properly
    if (domGraphs.temp && domGraphs.temp.destroy) {
        domGraphs.temp.destroy();
        domGraphs.temp = null;
    }
    if (domGraphs.light && domGraphs.light.destroy) {
        domGraphs.light.destroy();
        domGraphs.light = null;
    }
    if (domGraphs.servo && domGraphs.servo.destroy) {
        domGraphs.servo.destroy();
        domGraphs.servo = null;
    }

    try {
        const url = sessionId 
            ? `${lanIP}/api/v1/sensor-data?session_id=${sessionId}&include_chat=true&include_answers=true`
            : `${lanIP}/api/v1/sensor-data?include_chat=true&include_answers=true`;
        
        console.log(`Fetching: ${url}`);
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        if (data) {
            // Update available sessions and current session info with sanitized data
            availableSessions = sanitizeSessionData(data.available_sessions || []);
            currentSessionId = data.current_session_id;
            totalSessions = data.total_sessions || 0;

            // Update session selector
            if (sessionSelectorContainer) {
                sessionSelectorContainer.innerHTML = createSessionSelector(availableSessions, currentSessionId);
                initSessionSelector();
            }

            if (data.sessions && data.sessions.length > 0) {
                currentSessionData = data.sessions[0];
                renderSession(currentSessionData);
            } else {
                currentSessionData = null;
                quizSessionsContainer.innerHTML = '<div class="empty-state">No session data found.</div>';
            }
        } else {
            console.error('API response missing data:', data);
            quizSessionsContainer.innerHTML = `
                <div class="error-state">
                    <p>Error: Invalid data from server.</p>
                    <button id="retryLoad" class="gamepad retry-btn">Retry</button>
                </div>
            `;
            document.getElementById('retryLoad')?.addEventListener('click', () => fetchSessionData(currentSessionId));
        }

    } catch (error) {
        console.error('Error loading session data:', error);
        currentSessionData = null;
        if (quizSessionsContainer) {
            quizSessionsContainer.innerHTML = `
                <div class="error-state">
                    <p>Error loading session. Please try again.</p>
                    <button id="retryLoad" class="gamepad retry-btn">Retry</button>
                </div>
            `;
            document.getElementById('retryLoad')?.addEventListener('click', () => fetchSessionData(currentSessionId));
        }
    } finally {
        isLoading = false;
        if (window.gamepadNavigator) {
            window.gamepadNavigator.updateNavigableElements();
        }
    }
};

const initSessionSelector = () => {
    const sessionSelect = document.getElementById('sessionSelect');
    if (!sessionSelect) return;

    sessionSelect.addEventListener('change', (e) => {
        const selectedSessionId = parseInt(e.target.value);
        if (selectedSessionId && selectedSessionId !== currentSessionId && !isLoading) {
            fetchSessionData(selectedSessionId);
        }
    });

    // Add keyboard navigation
    sessionSelect.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const selectedSessionId = parseInt(sessionSelect.value);
            if (selectedSessionId && selectedSessionId !== currentSessionId && !isLoading) {
                fetchSessionData(selectedSessionId);
            }
        }
    });
};

// #endregion

// #region *** Session Rendering Functions ***********
const renderSession = (session) => {
    const quizSessionsContainer = document.querySelector('.c-quiz-sessions-container');
    if (!quizSessionsContainer || !session) return;

    const sessionId = session.session_id;
    const sessionName = session.session_name || formatSessionName({ id: sessionId, name: session.session_name });
    const chatMessages = session.chat_messages || [];
    const playerAnswers = session.player_answers || [];
    const temperatures = session.temperatures || [];
    const lightIntensities = session.light_intensities || [];
    const servoPositions = session.servo_positions || [];

    quizSessionsContainer.innerHTML = '';

    const sessionEl = document.createElement('div');
    sessionEl.className = 'c-quiz-session gamepad-section';
    sessionEl.innerHTML = `
        <h2 class="session-title">${sessionName}</h2>
        <div class="charts-grid">
            <div class="gamepad-chart-container gamepad" tabindex="0">
                <h3 class="chart-title">Temperature (°C)</h3>
                <div id="tempChart${sessionId}" class="chart-placeholder"></div>
            </div>
            <div class="gamepad-chart-container gamepad" tabindex="0">
                <h3 class="chart-title">Light Intensity (lux)</h3>
                <div id="lightChart${sessionId}" class="chart-placeholder"></div>
            </div>
            <div class="gamepad-chart-container gamepad" tabindex="0">
                <h3 class="chart-title">Servo Position (°)</h3>
                <div id="servoChart${sessionId}" class="chart-placeholder"></div>
            </div>
        </div>
        ${createToggleContainer(sessionId, chatMessages, playerAnswers)}
    `;
    quizSessionsContainer.appendChild(sessionEl);

    if (chatMessages.length > 0 || playerAnswers.length > 0) {
        initToggleContainer(sessionId, chatMessages, playerAnswers);
    }

    const tempChartEl = document.getElementById(`tempChart${sessionId}`);
    const lightChartEl = document.getElementById(`lightChart${sessionId}`);
    const servoChartEl = document.getElementById(`servoChart${sessionId}`);

    // Render all three charts for the current session and store them in domGraphs
    if (temperatures.length > 0 && tempChartEl) {
        domGraphs.temp = showTemperatureChart(tempChartEl, transformSensorData(temperatures));
    } else if (tempChartEl) {
        tempChartEl.innerHTML = '<p class="empty-state">No temperature data available.</p>';
        domGraphs.temp = null;
    }

    if (lightIntensities.length > 0 && lightChartEl) {
        domGraphs.light = showLightChart(lightChartEl, transformSensorData(lightIntensities));
    } else if (lightChartEl) {
        lightChartEl.innerHTML = '<p class="empty-state">No light data available.</p>';
        domGraphs.light = null;
    }

    if (servoPositions.length > 0 && servoChartEl) {
        domGraphs.servo = showSoundChart(servoChartEl, transformSensorData(servoPositions));
    } else if (servoChartEl) {
        servoChartEl.innerHTML = '<p class="empty-state">No servo data available.</p>';
        domGraphs.servo = null;
    }
};

const transformSensorData = (sensorData) => {
    if (!sensorData || !Array.isArray(sensorData)) return [];

    return sensorData.map(item => ({
        x: item.timestamp ? new Date(item.timestamp).getTime() : Date.now(),
        y: parseFloat(item.value || 0)
    })).sort((a, b) => a.x - b.x);
};

// #endregion

// #region *** Initialization ***********
const injectCSS = () => {
    if (!document.head.querySelector('style[data-injected-css]')) {
        const style = document.createElement('style');
        style.setAttribute('data-injected-css', 'true');
        style.textContent = `
            /* --- General & Layout --- */
            :root {
                --primary-color: #0d9edb;
                --secondary-color: #2c4c7c;
                --text-color: #0e1827;
                --light-text-color: #666;
                --bg-color: #f4f8fc;
                --card-bg-color: white;
                --border-color: rgba(14, 24, 39, 0.1);
                --success-color: #2e8b34;
                --error-color: #d32f2f;
                --border-radius: 8px;
                --shadow: 0 2px 8px rgba(14, 24, 39, 0.08);
            }

            .c-graphs-container {
                display: block;
                width: 100%;
            }

            .c-quiz-sessions-container {
                margin-bottom: 2rem !important;
                display: block !important;
                width: 100% !important;
            }
            .c-quiz-session { 
                margin-bottom: 2rem; 
                padding: 1.5rem; 
                background-color: var(--card-bg-color); 
                border-radius: var(--border-radius); 
                box-shadow: var(--shadow); 
            }
            .session-title { 
                color: var(--secondary-color); 
                margin-bottom: 1.5rem; 
                font-size: 1.5rem; 
                font-weight: 700; 
                border-bottom: 2px solid var(--primary-color); 
                padding-bottom: 0.5rem; 
            }
            
            /* --- Session Selector --- */
            #sessionSelectorContainer {
                margin-bottom: 2rem !important;
                display: block !important;
                width: 100% !important;
            }
            .session-selector-container {
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
                padding: 1rem;
                background: var(--card-bg-color);
                border-radius: var(--border-radius);
                box-shadow: var(--shadow);
                max-width: 400px;
                margin: 0 auto;
            }
            .session-selector-label {
                font-weight: 600;
                color: var(--secondary-color);
                font-size: 0.95rem;
            }
            .session-selector {
                padding: 10px 12px;
                border: 2px solid var(--border-color);
                border-radius: 6px;
                background: white;
                color: var(--text-color);
                font-size: 1rem;
                cursor: pointer;
                transition: border-color 0.2s;
            }
            .session-selector:focus {
                outline: none;
                border-color: var(--primary-color);
                box-shadow: 0 0 0 2px rgba(13, 158, 219, 0.2);
            }

            /* --- Charts Grid --- */
            .charts-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                gap: 1.5rem;
                margin-bottom: 2rem;
            }
            .gamepad-chart-container {
                background: var(--card-bg-color);
                border-radius: var(--border-radius);
                box-shadow: var(--shadow);
                padding: 1rem;
                border: 2px solid transparent;
                transition: border-color 0.2s;
            }
            .gamepad-chart-container:focus {
                outline: none;
                border-color: var(--primary-color);
            }
            .chart-title {
                color: var(--secondary-color);
                margin-bottom: 1rem;
                font-size: 1.1rem;
                font-weight: 600;
            }
            .chart-placeholder {
                height: 300px;
                width: 100%;
            }

            /* --- Loading & Error States --- */
            .loading-state, .error-state, .empty-state {
                text-align: center;
                padding: 2rem;
                color: var(--light-text-color);
            }
            .spinner {
                border: 3px solid var(--border-color);
                border-top: 3px solid var(--primary-color);
                border-radius: 50%;
                width: 40px;
                height: 40px;
                animation: spin 1s linear infinite;
                margin: 0 auto 1rem;
            }
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            .retry-btn {
                background: var(--primary-color);
                color: white;
                border: none;
                padding: 0.5rem 1rem;
                border-radius: 4px;
                cursor: pointer;
                font-size: 0.9rem;
                transition: background-color 0.2s;
            }
            .retry-btn:hover {
                background: var(--secondary-color);
            }

            /* --- Toggle Container --- */
            .toggle-container {
                margin-top: 2rem;
                background: var(--card-bg-color);
                border-radius: var(--border-radius);
                box-shadow: var(--shadow);
                overflow: hidden;
                border: 2px solid transparent;
                transition: border-color 0.2s;
            }
            .toggle-container:focus-within {
                border-color: var(--primary-color);
            }
            .toggle-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 1rem 1.5rem;
                cursor: pointer;
                transition: background-color 0.2s;
                border-bottom: 1px solid var(--border-color);
            }
            .toggle-header:hover {
                background: rgba(13, 158, 219, 0.05);
            }
            .toggle-header.chat {
                background: rgba(13, 158, 219, 0.1);
            }
            .toggle-header.answers {
                background: rgba(230, 81, 0, 0.1);
            }
            .toggle-title {
                margin: 0;
                font-size: 1.1rem;
                font-weight: 600;
                color: var(--secondary-color);
            }
            .toggle-meta {
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }
            .badge {
                background: var(--primary-color);
                color: white;
                padding: 0.2rem 0.5rem;
                border-radius: 12px;
                font-size: 0.8rem;
                font-weight: 600;
            }
            .toggle-icon {
                font-size: 1.2rem;
                color: var(--light-text-color);
            }
            .toggle-content {
                max-height: 400px;
                overflow-y: auto;
                padding: 1rem;
            }

            /* --- Chat Display --- */
            .chat-display {
                display: flex;
                flex-direction: column;
                gap: 1rem;
            }
            .chat-message {
                padding: 1rem;
                background: rgba(13, 158, 219, 0.05);
                border-radius: 8px;
                border-left: 4px solid var(--primary-color);
            }
            .message-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 0.5rem;
            }
            .username {
                font-weight: 600;
                color: var(--secondary-color);
            }
            .timestamp {
                font-size: 0.8rem;
                color: var(--light-text-color);
            }
            .message-content {
                color: var(--text-color);
                line-height: 1.4;
            }

            /* --- Player Answers Display --- */
            .player-answers-display {
                display: flex;
                flex-direction: column;
                gap: 1.5rem;
            }
            .question-group {
                border: 1px solid var(--border-color);
                border-radius: 8px;
                overflow: hidden;
            }
            .question-title {
                background: rgba(230, 81, 0, 0.1);
                margin: 0;
                padding: 1rem;
                font-size: 1rem;
                font-weight: 600;
                color: var(--secondary-color);
                border-bottom: 1px solid var(--border-color);
            }
            .player-answer {
                padding: 1rem;
                border-bottom: 1px solid var(--border-color);
            }
            .player-answer:last-child {
                border-bottom: none;
            }
            .player-answer.correct {
                background: rgba(46, 139, 52, 0.05);
                border-left: 4px solid var(--success-color);
            }
            .player-answer.incorrect {
                background: rgba(211, 47, 47, 0.05);
                border-left: 4px solid var(--error-color);
            }
            .answer-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 0.5rem;
            }
            .player-name {
                font-weight: 600;
                color: var(--secondary-color);
            }
            .points {
                font-weight: 600;
                padding: 0.2rem 0.5rem;
                border-radius: 4px;
                font-size: 0.9rem;
            }
            .correct .points {
                background: var(--success-color);
                color: white;
            }
            .incorrect .points {
                background: var(--error-color);
                color: white;
            }
            .answer-text {
                margin-bottom: 0.5rem;
                color: var(--text-color);
                line-height: 1.4;
            }
            .answer-footer {
                display: flex;
                justify-content: space-between;
                font-size: 0.8rem;
                color: var(--light-text-color);
            }

            /* --- Tooltip Styles --- */
            .chart-tooltip {
                background: white;
                border: 1px solid var(--border-color);
                border-radius: 6px;
                padding: 0.5rem;
                box-shadow: var(--shadow);
                font-family: inherit;
            }
            .tooltip-header {
                font-weight: 600;
                margin-bottom: 0.25rem;
                font-size: 0.9rem;
            }
            .tooltip-body {
                font-size: 0.8rem;
            }
            .tooltip-date {
                color: var(--light-text-color);
                margin-bottom: 0.25rem;
            }
            .tooltip-value {
                font-weight: 600;
                color: var(--text-color);
            }

            /* --- Responsive Design --- */
            @media (max-width: 768px) {
                .toggle-header {
                    padding: 0.75rem 1rem;
                }
                .toggle-title {
                    font-size: 1rem;
                }
                .charts-grid {
                    grid-template-columns: 1fr;
                    gap: 1rem;
                }
                .gamepad-chart-container {
                    padding: 0.75rem;
                }
                .chart-placeholder {
                    height: 250px;
                }
                .session-selector-container {
                    margin: 0 1rem;
                    max-width: none;
                }
            }

            /* --- Gamepad Focus Styles --- */
            .gamepad:focus {
                outline: 2px solid var(--primary-color);
                outline-offset: 2px;
            }
            .gamepad-section:focus {
                outline: 2px solid var(--primary-color);
                outline-offset: 2px;
            }
        `;
        document.head.appendChild(style);
    }
};

const initializeDashboard = () => {
    // Inject CSS first
    injectCSS();

    // Create session selector container if it doesn't exist
    let sessionSelectorContainer = document.getElementById('sessionSelectorContainer');
    if (!sessionSelectorContainer) {
        sessionSelectorContainer = document.createElement('div');
        sessionSelectorContainer.id = 'sessionSelectorContainer';
        
        // Find the quiz sessions container and insert the selector before it
        const quizSessionsContainer = document.querySelector('.c-quiz-sessions-container');
        if (quizSessionsContainer && quizSessionsContainer.parentNode) {
            quizSessionsContainer.parentNode.insertBefore(sessionSelectorContainer, quizSessionsContainer);
        } else {
            // Fallback: append to body
            document.body.appendChild(sessionSelectorContainer);
        }
    }

    // Load initial data (newest session by default)
    fetchSessionData();
};

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeDashboard);
} else {
    initializeDashboard();
}

// Refresh functionality
const refreshData = () => {
    if (!isLoading) {
        fetchSessionData(currentSessionId);
    }
};

// Add refresh button functionality if needed
const addRefreshButton = () => {
    const sessionSelectorContainer = document.getElementById('sessionSelectorContainer');
    if (sessionSelectorContainer && !document.getElementById('refreshButton')) {
        const refreshButton = document.createElement('button');
        refreshButton.id = 'refreshButton';
        refreshButton.className = 'gamepad retry-btn';
        refreshButton.textContent = 'Refresh Data';
        refreshButton.style.marginTop = '0.5rem';
        refreshButton.addEventListener('click', refreshData);
        
        const selectorContainer = sessionSelectorContainer.querySelector('.session-selector-container');
        if (selectorContainer) {
            selectorContainer.appendChild(refreshButton);
        }
    }
};

// Keyboard navigation support
document.addEventListener('keydown', (e) => {
    // Add keyboard shortcut for refresh (Ctrl/Cmd + R is handled by browser)
    if ((e.ctrlKey || e.metaKey) && e.key === 'r' && !isLoading) {
        e.preventDefault();
        refreshData();
    }
});

// Auto-refresh every 30 seconds (optional)
const enableAutoRefresh = (intervalSeconds = 30) => {
    setInterval(() => {
        if (!isLoading && document.visibilityState === 'visible') {
            refreshData();
        }
    }, intervalSeconds * 1000);
};

// Expose functions globally for external access
window.quizDashboard = {
    refresh: refreshData,
    loadSession: fetchSessionData,
    enableAutoRefresh,
    addRefreshButton,
    getCurrentSessionId: () => currentSessionId,
    getCurrentSessionData: () => currentSessionData,
    getAvailableSessions: () => availableSessions,
    isLoading: () => isLoading
};

// #endregion