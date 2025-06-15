let adInterval;
let adDurationTimeout;
const AD_SPAWN_FREQUENCY_MS = 1500; // How often a new "ad" box pops up (1.5 seconds)

// We no longer need AD_SLOT_ID and AD_CLIENT_ID for the "scream box" version.
// const AD_SLOT_ID = '7822007431';
// const AD_CLIENT_ID = 'ca-pub-8418485814964449';

// Determine the local IP for the socket connection
const lanIP = `http://${window.location.hostname}`;
const socket = window.sharedSocket;

// Listen for the B2F_addItem event and automatically activate the flood
socket.on('B2F_addItem', () => {
    console.log('📢📢📢 Initiating the Anti-Adblocker Scream Flood! 📢📢📢');
    activateAdvertFlood(10); // Fixed 10-second duration for the scream flood
});

/**
 * Activates a flood of custom "scream boxes" that urge users to turn off ad blockers.
 * @param {number} durationSeconds - The duration in seconds for which the scream flood will last.
 */
const activateAdvertFlood = (durationSeconds) => {
    // Clear any existing intervals or timeouts to prevent overlaps
    if (adInterval) clearInterval(adInterval);
    if (adDurationTimeout) clearTimeout(adDurationTimeout);

    // Function to create and append a single scream box
    const createScreamBox = () => {
        const screamBox = document.createElement('div');
        screamBox.className = 'scream-box'; // Class for easy selection later
        screamBox.style.position = 'fixed'; // Position it absolutely relative to the viewport
        screamBox.style.zIndex = '99999'; // Even higher z-index to be SUPER intrusive
        
        // Random positioning within the viewport
        screamBox.style.left = `${Math.random() * (window.innerWidth - 350)}px`; // -350 for width of box
        screamBox.style.top = `${Math.random() * (window.innerHeight - 180)}px`; // -180 for height of box

        // Styling for maximum annoyance and visibility
        screamBox.style.width = '300px';
        screamBox.style.height = '150px';
        screamBox.style.backgroundColor = `hsl(${Math.random() * 360}, 100%, 70%)`; // Random bright color
        screamBox.style.border = '5px solid black';
        screamBox.style.borderRadius = '15px';
        screamBox.style.padding = '15px';
        screamBox.style.boxShadow = '5px 5px 15px rgba(0,0,0,0.5)';
        screamBox.style.fontFamily = 'Impact, sans-serif'; // Loud font
        screamBox.style.fontSize = `${20 + Math.random() * 10}px`; // Slightly varied font size
        screamBox.style.color = 'black';
        screamBox.style.textAlign = 'center';
        screamBox.style.display = 'flex';
        screamBox.style.alignItems = 'center';
        screamBox.style.justifyContent = 'center';
        screamBox.style.textShadow = '2px 2px 0px white';
        screamBox.style.animation = `screamPulse 0.5s infinite alternate ease-in-out`; // Pulsing animation

        screamBox.innerHTML = `
            <strong>HEY! TURN OFF THAT AD BLOCKER!</strong><br>
            <small>WE NEED YOUR CLICKS!</small><br>
            <small>THIS CONTENT ISN'T FREE!</small>
        `;

        document.body.appendChild(screamBox);
        console.log('💥 Anti-Adblocker Scream Box spawned!');
    };

    // Add a pulsing keyframe animation to the document if not already present
    const styleSheet = document.head.querySelector('#scream-box-styles') || document.createElement('style');
    styleSheet.id = 'scream-box-styles';
    styleSheet.innerHTML = `
        @keyframes screamPulse {
            from {
                transform: scale(1);
                opacity: 1;
            }
            to {
                transform: scale(1.05);
                opacity: 0.9;
            }
        }
    `;
    document.head.appendChild(styleSheet);


    // Start spawning scream boxes at the defined frequency
    adInterval = setInterval(createScreamBox, AD_SPAWN_FREQUENCY_MS);
    console.log(`🚀 Scream flood initiated for ${durationSeconds} seconds!`);

    // Set a timeout to stop the scream flood and remove all spawned boxes after the duration
    adDurationTimeout = setTimeout(() => {
        clearInterval(adInterval); // Stop spawning new boxes
        // Remove all dynamically created scream boxes
        document.querySelectorAll('.scream-box').forEach(box => {
            box.remove();
            console.log('🚫 Scream Box removed.');
        });
        console.log('🌊 The scream flood has subsided. Silence... for now.');
    }, durationSeconds * 1000); // Convert seconds to milliseconds
};