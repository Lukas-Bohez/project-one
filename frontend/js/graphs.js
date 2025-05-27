// #region ***  DOM references                           ***********
const domGraphs = {
  session1: {
    tempChartEl: document.getElementById('tempChart1'),
    lightChartEl: document.getElementById('lightChart1'),
    soundChartEl: document.getElementById('soundChart1'),
  },
  session2: {
    tempChartEl: document.getElementById('tempChart2'),
    lightChartEl: document.getElementById('lightChart2'),
    soundChartEl: document.getElementById('soundChart2'),
  },
};
// #endregion

// #region ***  Callback-Visualisation - show___         ***********
const showTemperatureChart = (element, data) => {
  const options = {
    chart: { type: 'line', height: '100%' },
    series: [{ name: 'Temperature', data }],
    stroke: { curve: 'straight' },
    colors: ['#FF6384'],
    xaxis: { type: 'datetime' },
  };
  new ApexCharts(element, options).render();
};

const showLightChart = (element, data) => {
  const options = {
    chart: { type: 'line', height: '100%' },
    series: [{ name: 'Light', data }],
    stroke: { curve: 'straight' },
    colors: ['#36A2EB'],
    xaxis: { type: 'datetime' },
  };
  new ApexCharts(element, options).render();
};

const showSoundChart = (element, data) => {
  const options = {
    chart: { type: 'line', height: '100%' },
    series: [{ name: 'Servo degrees', data }],
    stroke: { curve: 'straight' },
    colors: ['#FFCE56'],
    xaxis: { type: 'datetime' },
  };
  new ApexCharts(element, options).render();
};
// #endregion

// #region ***  Data Access - get___                     ***********
const getRandomGraphData = (count = 10, min = 30, max = 100) => {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => ({
    x: new Date(now.getTime() - (count - i) * 60000).getTime(),
    y: (min + Math.random() * (max - min)).toFixed(1),
  }));
};
// #endregion

// #region ***  Initialization                           ***********
const initGraphs = () => {
  if (!document.querySelector('.js-graph-temp')) return;

  // Session 1 data
  const tempData1 = getRandomGraphData(10, 20, 30); // 20-30°C
  const lightData1 = getRandomGraphData(10, 0, 1000); // 0-1000 lux
  const soundData1 = getRandomGraphData(10, 30, 100); // 30-100 dB

  // Session 2 data (slightly different ranges)
  const tempData2 = getRandomGraphData(10, 22, 32);
  const lightData2 = getRandomGraphData(10, 100, 1100);
  const soundData2 = getRandomGraphData(10, 40, 110);

  // Render Session 1 charts
  showTemperatureChart(domGraphs.session1.tempChartEl, tempData1);
  showLightChart(domGraphs.session1.lightChartEl, lightData1);
  showSoundChart(domGraphs.session1.soundChartEl, soundData1);

  // Render Session 2 charts
  showTemperatureChart(domGraphs.session2.tempChartEl, tempData2);
  showLightChart(domGraphs.session2.lightChartEl, lightData2);
  showSoundChart(domGraphs.session2.soundChartEl, soundData2);
};

document.addEventListener('DOMContentLoaded', () => {
  if (document.querySelector('.c-quiz-sessions-container')) {
    initGraphs();
  }
});
// #endregion
