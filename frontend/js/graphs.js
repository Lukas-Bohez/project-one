// #region *** DOM references ***********
const lanIP = `http://${window.location.hostname}:8000`;
// domGraphs will now be populated dynamically
let domGraphs = {};
// #endregion

// #region *** Callback-Visualisation - show___ ***********
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
      foreColor: '#333',
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
          colors: '#666'
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
          colors: '#666'
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
      borderColor: 'rgba(0, 0, 0, 0.05)',
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
  return createNonInteractiveChart(element, data, 'Temperature', '#FF6384');
};

const showLightChart = (element, data) => {
  return createNonInteractiveChart(element, data, 'Light', '#36A2EB');
};

const showSoundChart = (element, data) => { // Renamed from showSoundChart for clarity, if it's always servo
  return createNonInteractiveChart(element, data, 'Servo degrees', '#FFCE56');
};
// #endregion

const listenToInfoModal = (domElements) => {
  const { infoBtn, infoModal, closeModal } = domElements;

  if (!infoBtn || !infoModal || !closeModal) {
    console.warn('Missing required DOM elements for info modal');
    return;
  }

  infoBtn.addEventListener('click', () => {
    infoModal.style.display = 'block';
  });

  closeModal.addEventListener('click', () => {
    infoModal.style.display = 'none';
  });

  window.addEventListener('click', (event) => {
    if (event.target === infoModal) {
      infoModal.style.display = 'none';
    }
  });
};

// #region *** Data Access - get___ ***********
const transformSensorData = (sensorData) => {
  // Ensure that item.value is treated as a number for charting
  return sensorData.map(item => ({
    x: new Date(item.timestamp).getTime(),
    y: parseFloat(item.value) // Explicitly parse to float just in case
  }));
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

  listenToInfoModal(dom);

  if (!dom.quizSessionsContainer) {
    console.error('Quiz sessions container not found.');
    return;
  }

  try {
    const response = await fetch(`${lanIP}/api/v1/sensor-data`);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();

    dom.quizSessionsContainer.innerHTML = '';
    domGraphs = {};

    data.sessions.forEach((session) => {
      const sessionId = session.session_id;
      const sessionName = session.session_name;

      const sessionEl = document.createElement('div');
      sessionEl.classList.add('c-quiz-session');
      sessionEl.innerHTML = `
        <h2 class="c-quiz-session__title">${sessionName}</h2>
        <div class="c-quiz-session__charts">
          <div class="c-chart-card">
            <h3>Temperature (°C)</h3>
            <div id="tempChart${sessionId}" class="c-chart-card__chart js-graph-temp"></div>
          </div>
          <div class="c-chart-card">
            <h3>Light Intensity (lux)</h3>
            <div id="lightChart${sessionId}" class="c-chart-card__chart js-graph-light"></div>
          </div>
          <div class="c-chart-card">
            <h3>Servo Position (°)</h3>
            <div id="servoChart${sessionId}" class="c-chart-card__chart js-graph-servo"></div>
          </div>
        </div>
      `;
      dom.quizSessionsContainer.appendChild(sessionEl);

      domGraphs[`session${sessionId}`] = {
        tempChartEl: document.getElementById(`tempChart${sessionId}`),
        lightChartEl: document.getElementById(`lightChart${sessionId}`),
        servoChartEl: document.getElementById(`servoChart${sessionId}`), // Changed from soundChartEl for consistency
      };

      const tempData = transformSensorData(session.temperatures);
      const lightData = transformSensorData(session.light_intensities);
      const servoData = transformSensorData(session.servo_positions); // Changed from soundData

      showTemperatureChart(domGraphs[`session${sessionId}`].tempChartEl, tempData);
      showLightChart(domGraphs[`session${sessionId}`].lightChartEl, lightData);
      showSoundChart(domGraphs[`session${sessionId}`].servoChartEl, servoData); // Still uses showSoundChart, but passes servoData
    });
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