// #region ***  DOM references                           ***********
const domGraphs = {
    tempChartEl: document.getElementById('tempChart'),
    lightChartEl: document.getElementById('lightChart'),
    soundChartEl: document.getElementById('soundChart')
};
// #endregion

// #region ***  Callback-Visualisation - show___         ***********
const showTemperatureChart = (data) => {
    const options = {
        chart: { type: 'line', height: '100%' },
        series: [{ name: 'Temperature', data }],
        stroke: { curve: 'straight' },
        colors: ['#FF6384'],
        xaxis: { type: 'datetime' }
    };
    new ApexCharts(domGraphs.tempChartEl, options).render();
};

const showLightChart = (data) => {
    const options = {
        chart: { type: 'line', height: '100%' },
        series: [{ name: 'Light', data }],
        stroke: { curve: 'straight' },
        colors: ['#36A2EB'],
        xaxis: { type: 'datetime' }
    };
    new ApexCharts(domGraphs.lightChartEl, options).render();
};

const showSoundChart = (data) => {
    const options = {
        chart: { type: 'line', height: '100%' },
        series: [{ name: 'Sound', data }],
        stroke: { curve: 'straight' },
        colors: ['#FFCE56'],
        xaxis: { type: 'datetime' }
    };
    new ApexCharts(domGraphs.soundChartEl, options).render();
};
// #endregion

// #region ***  Data Access - get___                     ***********
const getRandomGraphData = (count = 10, min = 30, max = 100) => {
    const now = new Date();
    return Array.from({ length: count }, (_, i) => ({
        x: new Date(now.getTime() - (count - i) * 60000).getTime(),
        y: (min + Math.random() * (max - min)).toFixed(1)
    }));
};
// #endregion

// #region ***  Initialization                           ***********
const initGraphs = () => {
    if (!document.querySelector('.js-graph-temp')) return;
    
    const tempData = getRandomGraphData(10, 20, 30);   // 20-30°C
    const lightData = getRandomGraphData(10, 0, 1000); // 0-1000 lux
    const soundData = getRandomGraphData(10, 30, 100); // 30-100 dB
    
    showTemperatureChart(tempData);
    showLightChart(lightData);
    showSoundChart(soundData);
};

document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('graphs.html')) {
        initGraphs();
    }
});
// #endregion