// #region ***  DOM references                           ***********
const dom = {
    startQuizBtn: document.getElementById('startQuizBtn'),
    joinQuizBtn: document.getElementById('joinQuizBtn'),
    viewGraphsBtn: document.getElementById('viewGraphsBtn'),
    manageQuizBtn: document.getElementById('manageQuizBtn'),
    infoBtn: document.getElementById('infoBtn'),
    infoModal: document.getElementById('infoModal'),
    closeModal: document.querySelector('.c-modal__close'),
    tempValue: document.getElementById('tempValue'),
    soundValue: document.getElementById('soundValue'),
    lightValue: document.getElementById('lightValue'),
    playerCount: document.getElementById('playerCount'),
    servoTestBtn: document.getElementById('servoTestBtn'),
    servoVisual: document.getElementById('servoVisual')
};
// #endregion

// #region ***  Callback-Visualisation - show___         ***********
const showSensorData = (temp, light, sound, players) => {
    if (dom.tempValue) dom.tempValue.textContent = temp;
    if (dom.lightValue) dom.lightValue.textContent = light;
    if (dom.soundValue) dom.soundValue.textContent = sound;
    if (dom.playerCount) dom.playerCount.textContent = players;
};

const showServoMovement = (angle) => {
    if (dom.servoVisual) dom.servoVisual.style.transform = `rotate(${angle}deg)`;
};
// #endregion

// #region ***  Callback-No Visualisation - callback___  ***********
const callbackUpdateDifficulty = (temp, light, sound) => {
    console.log(`Updating difficulty based on temp: ${temp}°C, light: ${light} lux, sound: ${sound} dB`);
};
// #endregion

// #region ***  Data Access - get___                     ***********
const getClientIP = async () => {
    try {
        const response = await fetch('/api/get-client-ip');
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        console.log('Client IP:', data.ip_address);
        return data.ip_address;
    } catch (error) {
        console.error('Error fetching IP:', error);
        return null;
    }
};

const getRandomSensorData = () => {
    return {
        temp: (20 + Math.random() * 10).toFixed(1),  // 20-30°C
        light: Math.floor(Math.random() * 1000),     // 0-1000 lux
        sound: (30 + Math.random() * 70).toFixed(1), // 30-100 dB
        players: Math.floor(Math.random() * 10)      // 0-10 players
    };
};
// #endregion

// #region ***  Event Listeners - listenTo___            ***********
const listenToButtons = () => {
    // Info button and modal (works on all pages)
    if (dom.infoBtn && dom.infoModal) {
        dom.infoBtn.addEventListener('click', () => {
            dom.infoModal.style.display = 'block';
        });
    }

    if (dom.closeModal) {
        dom.closeModal.addEventListener('click', () => {
            if (dom.infoModal) dom.infoModal.style.display = 'none';
        });
    }

    window.addEventListener('click', (event) => {
        if (dom.infoModal && event.target === dom.infoModal) {
            dom.infoModal.style.display = 'none';
        }
    });

    // Index page specific buttons
    if (window.location.pathname.includes('index.html')) {
        if (dom.startQuizBtn) {
            dom.startQuizBtn.addEventListener('click', () => {
                window.location.href = 'html/quiz.html';
            });
        }

        if (dom.joinQuizBtn) {
            dom.joinQuizBtn.addEventListener('click', () => {
                alert('Joining quiz... This would connect you to an existing session in the full implementation.');
            });
        }

        if (dom.viewGraphsBtn) {
            dom.viewGraphsBtn.addEventListener('click', () => {
                window.location.href = 'html/graphs.html';
            });
        }

        if (dom.manageQuizBtn) {
            dom.manageQuizBtn.addEventListener('click', () => {
                window.location.href = 'html/login.html';
            });
        }

        if (dom.servoTestBtn && dom.servoVisual) {
            dom.servoTestBtn.addEventListener('click', testServoMovement);
        }
    }
};

const testServoMovement = () => {
    let angle = 0;
    const interval = setInterval(() => {
        angle = angle >= 180 ? 0 : angle + 10;
        showServoMovement(angle);
        if (angle === 0) clearInterval(interval);
    }, 100);
};
// #endregion

// #region ***  Init / DOMContentLoaded                  ***********
const initIndexPage = () => {
    const { temp, light, sound, players } = getRandomSensorData();
    showSensorData(temp, light, sound, players);
    callbackUpdateDifficulty(temp, light, sound);
};

const initQuizPage = () => {
    // Quiz specific initialization
    console.log('Quiz page initialized');
};

const initLoginPage = () => {
    // Login specific initialization
    console.log('Login page initialized');
};

document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;
    
    // Common functionality for all pages
    listenToButtons();
    
    // Page-specific initialization
    if (path.includes('index.html')) {
        initIndexPage();
    } else if (path.includes('quiz.html')) {
        initQuizPage();
    } else if (path.includes('login.html')) {
        initLoginPage();
    } else if (path.includes('graphs.html')) {
        // Graphs initialization would be in graphs.js
    }
});
// #endregion