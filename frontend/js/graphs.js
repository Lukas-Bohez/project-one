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

const createTabSystem = (sessionId, chatMessages, playerAnswers) => {
  const tabsId = `tabs${sessionId}`;
  const chatTabId = `chatTab${sessionId}`;
  const answersTabId = `answersTab${sessionId}`;
  const chatContentId = `chatContent${sessionId}`;
  const answersContentId = `answersContent${sessionId}`;
  
  const tabsHTML = `
    <div style="margin-top: 20px;">
      <div style="border-bottom: 2px solid #f4f8fc; margin-bottom: 16px;">
        <button id="${chatTabId}" class="gamepad tab-button" 
                tabindex="0" role="tab" aria-selected="true" aria-controls="${chatContentId}"
                style="padding: 8px 16px; margin-right: 8px; border: none; background: #0d9edb; color: white; border-radius: 4px 4px 0 0; cursor: pointer; font-size: 14px; font-weight: 600;">
          Chat Messages (${chatMessages.length})
        </button>
        <button id="${answersTabId}" class="gamepad tab-button" 
                tabindex="0" role="tab" aria-selected="false" aria-controls="${answersContentId}"
                style="padding: 8px 16px; border: none; background: #f4f8fc; color: #2c4c7c; border-radius: 4px 4px 0 0; cursor: pointer; font-size: 14px; font-weight: 600;">
          Player Answers (${playerAnswers.length})
        </button>
      </div>
      <div id="${chatContentId}" class="tab-content" role="tabpanel" aria-labelledby="${chatTabId}" style="display: block;">
        ${createChatDisplay(chatMessages)}
      </div>
      <div id="${answersContentId}" class="tab-content" role="tabpanel" aria-labelledby="${answersTabId}" style="display: none;">
        ${createPlayerAnswersDisplay(playerAnswers)}
      </div>
    </div>
  `;
  
  return tabsHTML;
};

const initTabListeners = (sessionId) => {
  const chatTabId = `chatTab${sessionId}`;
  const answersTabId = `answersTab${sessionId}`;
  const chatContentId = `chatContent${sessionId}`;
  const answersContentId = `answersContent${sessionId}`;
  
  const chatTab = document.getElementById(chatTabId);
  const answersTab = document.getElementById(answersTabId);
  const chatContent = document.getElementById(chatContentId);
  const answersContent = document.getElementById(answersContentId);
  
  if (chatTab && answersTab && chatContent && answersContent) {
    const switchToTab = (selectedTab, otherTab, selectedContent, otherContent) => {
      selectedTab.style.background = '#0d9edb';
      selectedTab.style.color = 'white';
      selectedTab.setAttribute('aria-selected', 'true');
      
      otherTab.style.background = '#f4f8fc';
      otherTab.style.color = '#2c4c7c';
      otherTab.setAttribute('aria-selected', 'false');
      
      selectedContent.style.display = 'block';
      otherContent.style.display = 'none';
      
      // Update gamepad navigation elements
      if (window.gamepadNavigator) {
        window.gamepadNavigator.updateNavigableElements();
      }
    };
    
    chatTab.addEventListener('click', () => {
      switchToTab(chatTab, answersTab, chatContent, answersContent);
    });
    
    answersTab.addEventListener('click', () => {
      switchToTab(answersTab, chatTab, answersContent, chatContent);
    });
    
    // Add keyboard/gamepad navigation
    [chatTab, answersTab].forEach(tab => {
      tab.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (tab === chatTab) {
            switchToTab(chatTab, answersTab, chatContent, answersContent);
          } else {
            switchToTab(answersTab, chatTab, answersContent, chatContent);
          }
        }
      });
    });
  }
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
        ${createTabSystem(sessionId, chatMessages, playerAnswers)}
      `;
      dom.quizSessionsContainer.appendChild(sessionEl);

      // Initialize tab listeners after DOM is created
      initTabListeners(sessionId);

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