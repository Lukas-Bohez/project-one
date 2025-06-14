let adInterval;
let adDurationTimeout;
const AD_SPAWN_FREQUENCY_MS = 1500;
const AD_SLOT_ID = 'YOUR_AD_SLOT_ID';
const lanIP = `http://${window.location.hostname}:8000`;
const socket = io(lanIP, {
    transports: ["websocket", "polling"],
    timeout: 20000,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000
});

// Listen for the B2F_addItem event and automatically activate
socket.on('B2F_addItem', () => {
    activateAdvertFlood(60); // Fixed 60-second duration
});

function activateAdvertFlood(durationSeconds) {
    if (adInterval) clearInterval(adInterval);
    if (adDurationTimeout) clearTimeout(adDurationTimeout);

    function createAdContainer() {
        const adContainer = document.createElement('div');
        adContainer.className = 'random-ad-container';
        adContainer.style.position = 'fixed';
        adContainer.style.zIndex = '9999';
        adContainer.style.left = `${Math.random() * (window.innerWidth - 300)}px`;
        adContainer.style.top = `${Math.random() * (window.innerHeight - 250)}px`;
        adContainer.style.width = '300px';
        adContainer.style.height = '250px';
        adContainer.style.overflow = 'hidden';

        const insElement = document.createElement('ins');
        insElement.className = 'adsbygoogle';
        insElement.style.display = 'block';
        insElement.setAttribute('data-ad-client', 'ca-pub-8418485814964449');
        insElement.setAttribute('data-ad-slot', AD_SLOT_ID);

        adContainer.appendChild(insElement);
        document.body.appendChild(adContainer);
        (adsbygoogle = window.adsbygoogle || []).push({});
    }

    adInterval = setInterval(createAdContainer, AD_SPAWN_FREQUENCY_MS);
    adDurationTimeout = setTimeout(() => {
        clearInterval(adInterval);
        document.querySelectorAll('.random-ad-container').forEach(ad => ad.remove());
    }, durationSeconds * 1000);
}