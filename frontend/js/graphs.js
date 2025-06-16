// #region *** DOM references ***********
const lanIP = `http://${window.location.hostname}`;
let domGraphs = {};
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
      max: (max) => Math.max(max, Math.max(...data.map(d => d.y)) + 5)
    },
    tooltip: { enabled: false },
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
  const chart = createNonInteractiveChart(element, data, 'Temperature', '#d32f2f');
  element.chart = chart; // Attach chart reference to DOM element
  return chart;
};

const showLightChart = (element, data) => {
  const chart = createNonInteractiveChart(element, data, 'Light', '#0d9edb');
  element.chart = chart; // Attach chart reference to DOM element
  return chart;
};

const showSoundChart = (element, data) => {
  const chart = createNonInteractiveChart(element, data, 'Servo degrees', '#e65100');
  element.chart = chart; // Attach chart reference to DOM element
  return chart;
};
// #endregion

// #region *** UI Components ***********
const createChatDisplay = (chatMessages) => {
  if (!chatMessages || chatMessages.length === 0) {
    return '<p style="color: #0e1827; opacity: 0.6; font-style: italic;">No chat messages</p>';
  }

  const chatHTML = chatMessages.map(msg => {
    const timestamp = msg.created_at ? new Date(msg.created_at).toLocaleString() : 'Unknown time';
    const username = msg.username || 'Anonymous';
    const message = msg.message || '';
    
    return `
      <div style="margin-bottom: 12px; padding: 8px; background: #f4f8fc; border-left: 3px solid #0d9edb; border-radius: 4px;">
        <div style="font-size: 12px; color: #2c4c7c; font-weight: 600; margin-bottom: 4px;">
          ${username} • ${timestamp}
        </div>
        <div style="color: #0e1827; font-size: 14px;">${message}</div>
      </div>
    `;
  }).join('');

  return `
    <div style="max-height: 200px; overflow-y: auto; padding: 8px;">
      ${chatHTML}
    </div>
  `;
};

const createPlayerAnswersDisplay = (playerAnswers) => {
  if (!playerAnswers || playerAnswers.length === 0) {
    return '<p style="color: #0e1827; opacity: 0.6; font-style: italic;">No player answers</p>';
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
      
      const correctnessColor = isCorrect ? '#2e8b34' : '#d32f2f';
      const correctnessText = isCorrect ? '✓' : '✗';
      
      return `
        <div style="margin-bottom: 8px; padding: 6px 8px; background: #f4f8fc; border-radius: 4px; border-left: 3px solid ${correctnessColor};">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <span style="font-weight: 600; color: #2c4c7c; font-size: 13px;">${playerName}</span>
            <span style="color: ${correctnessColor}; font-weight: bold; font-size: 16px;">${correctnessText}</span>
          </div>
          <div style="color: #0e1827; font-size: 12px; margin-bottom: 2px;">${answerText}</div>
          <div style="font-size: 11px; color: #0c4061;">
            Points: ${points} • Time: ${timeFormatted} • ${timestamp}
          </div>
        </div>
      `;
    }).join('');
    
    return `
      <div style="margin-bottom: 16px;">
        <h4 style="color: #2c4c7c; margin-bottom: 8px; font-size: 14px; font-weight: 600;">${questionText}</h4>
        ${answersListHTML}
      </div>
    `;
  }).join('');

  return `
    <div style="max-height: 300px; overflow-y: auto; padding: 8px;">
      ${answersHTML}
    </div>
  `;
};

const createToggleContainer = (sessionId, chatMessages, playerAnswers) => {
  const containerId = `toggleContainer${sessionId}`;
  const headerId = `toggleHeader${sessionId}`;
  const contentId = `toggleContent${sessionId}`;
  
  // Determine initial state (show chat if it has messages, otherwise show answers)
  const initialShowChat = chatMessages.length > 0;
  
  return `
    <div id="${containerId}" tabindex="0" 
         style="margin-top: 20px; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(14, 24, 39, 0.1);">
      <div id="${headerId}" class="gamepad"
           style="padding: 12px 16px; background: #0d9edb; color: white; border-radius: 8px 8px 0 0; 
                  cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
        <h3 style="margin: 0; font-size: 16px; font-weight: 600;">
          ${initialShowChat ? 'Chat Messages' : 'Player Answers'}
        </h3>
        <span style="font-size: 14px;">
          ${initialShowChat ? `(${chatMessages.length})` : `(${playerAnswers.length})`}
        </span>
      </div>
      <div id="${contentId}" style="padding: 16px; border-radius: 0 0 8px 8px;">
        ${initialShowChat ? createChatDisplay(chatMessages) : createPlayerAnswersDisplay(playerAnswers)}
      </div>
    </div>
  `;
};

const initToggleContainer = (sessionId, chatMessages, playerAnswers) => {
  const container = document.getElementById(`toggleContainer${sessionId}`);
  const header = document.getElementById(`toggleHeader${sessionId}`);
  const content = document.getElementById(`toggleContent${sessionId}`);
  
  if (!container || !header || !content) return;
  
  let showChat = chatMessages.length > 0; // Initial state
  
  const toggleContent = () => {
    showChat = !showChat;
    
    if (showChat) {
      header.innerHTML = `
        <h3 style="margin: 0; font-size: 16px; font-weight: 600;">Chat Messages</h3>
        <span style="font-size: 14px;">(${chatMessages.length})</span>
      `;
      content.innerHTML = createChatDisplay(chatMessages);
      header.style.background = '#0d9edb';
    } else {
      header.innerHTML = `
        <h3 style="margin: 0; font-size: 16px; font-weight: 600;">Player Answers</h3>
        <span style="font-size: 14px;">(${playerAnswers.length})</span>
      `;
      content.innerHTML = createPlayerAnswersDisplay(playerAnswers);
      header.style.background = '#2c4c7c';
    }
    
    // Update gamepad navigation after content change
    if (window.gamepadNavigator) {
      window.gamepadNavigator.updateNavigableElements();
    }
  };
  
  // Click handler
  header.addEventListener('click', toggleContent);
  
  // Keyboard/gamepad handler
  container.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleContent();
    }
  });
};
// #endregion

// #region *** Initialization ***********
const initGraphs = async () => {
  const dom = {
    infoBtn: document.getElementById('infoBtn'),
    infoModal: document.getElementById('infoModal'),
    closeModal: document.querySelector('.c-modal__close'),
    quizSessionsContainer: document.querySelector('.c-quiz-sessions-container')
  };

  if (!dom.quizSessionsContainer) {
    console.error('Quiz sessions container not found.');
    return;
  }

  try {
    const response = await fetch(`${lanIP}/api/v1/sensor-data?include_chat=true&include_answers=true`);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    
    dom.quizSessionsContainer.innerHTML = '';
    domGraphs = {};

    data.sessions.forEach((session) => {
      const sessionId = session.session_id;
      const sessionName = session.session_name;
      const chatMessages = session.chat_messages || [];
      const playerAnswers = session.player_answers || [];

      const sessionEl = document.createElement('div');
      sessionEl.classList.add('c-quiz-session', 'gamepad-section');
      sessionEl.style.marginBottom = '32px';
      sessionEl.style.padding = '20px';
      sessionEl.style.backgroundColor = 'white';
      sessionEl.style.borderRadius = '8px';
      sessionEl.style.boxShadow = '0 2px 8px rgba(14, 24, 39, 0.1)';
      
      sessionEl.innerHTML = `
        <h2 style="color: #2c4c7c; margin-bottom: 20px; font-size: 24px; font-weight: 700; border-bottom: 2px solid #0d9edb; padding-bottom: 8px;">
          ${sessionName}
        </h2>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 20px;">
          <div class="gamepad-chart-container" tabindex="0" style="background: #f4f8fc; padding: 16px; border-radius: 6px; border: 1px solid rgba(13, 158, 219, 0.2);">
            <h3 style="color: #2c4c7c; margin-bottom: 12px; font-size: 16px; font-weight: 600;">Temperature (°C)</h3>
            <div id="tempChart${sessionId}" style="height: 200px;"></div>
          </div>
          <div class="gamepad-chart-container" tabindex="0" style="background: #f4f8fc; padding: 16px; border-radius: 6px; border: 1px solid rgba(13, 158, 219, 0.2);">
            <h3 style="color: #2c4c7c; margin-bottom: 12px; font-size: 16px; font-weight: 600;">Light Intensity (lux)</h3>
            <div id="lightChart${sessionId}" style="height: 200px;"></div>
          </div>
          <div class="gamepad-chart-container" tabindex="0" style="background: #f4f8fc; padding: 16px; border-radius: 6px; border: 1px solid rgba(13, 158, 219, 0.2);">
            <h3 style="color: #2c4c7c; margin-bottom: 12px; font-size: 16px; font-weight: 600;">Servo Position (°)</h3>
            <div id="servoChart${sessionId}" style="height: 200px;"></div>
          </div>
        </div>
        ${createToggleContainer(sessionId, chatMessages, playerAnswers)}
      `;
      dom.quizSessionsContainer.appendChild(sessionEl);

      // Initialize toggle container
      initToggleContainer(sessionId, chatMessages, playerAnswers);

      // Store chart elements
      const tempChartEl = document.getElementById(`tempChart${sessionId}`);
      const lightChartEl = document.getElementById(`lightChart${sessionId}`);
      const servoChartEl = document.getElementById(`servoChart${sessionId}`);

      // Create charts and attach to containers
      const tempData = transformSensorData(session.temperatures);
      const lightData = transformSensorData(session.light_intensities);
      const servoData = transformSensorData(session.servo_positions);

      showTemperatureChart(tempChartEl, tempData);
      showLightChart(lightChartEl, lightData);
      showSoundChart(servoChartEl, servoData);

      // Add gamepad class to chart containers
      const chartContainers = sessionEl.querySelectorAll('.gamepad-chart-container');
      chartContainers.forEach(container => {
        container.classList.add('gamepad');
      });

      // Store references
      domGraphs[`session${sessionId}`] = {
        tempChartEl,
        lightChartEl,
        servoChartEl,
        sessionEl
      };
    });

    // Update gamepad navigation after all elements are created
    if (window.gamepadNavigator) {
      window.gamepadNavigator.updateNavigableElements();
    }
  } catch (error) {
    console.error('Error fetching or processing sensor data:', error);
  }
};

document.addEventListener('DOMContentLoaded', () => {
  if (document.querySelector('.c-quiz-sessions-container')) {
    initGraphs();
  }
});
// #endregion

// Helper function to transform sensor data
const transformSensorData = (sensorData) => {
  return sensorData.map(item => ({
    x: new Date(item.timestamp).getTime(),
    y: parseFloat(item.value)
  }));
};