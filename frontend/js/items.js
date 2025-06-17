class AdvertFlood {
    constructor() {
        this.adInterval = null;
        this.adDurationTimeout = null;
        this.AD_SPAWN_FREQUENCY_MS = 1500; // How often a new "ad" box pops up (1.5 seconds)
        
        // Initialize socket listener in constructor
        this.initializeSocketListener();
    }

    initializeSocketListener() {
        
    }

    /**
     * Activates a flood of custom "scream boxes" that urge users to turn off ad blockers.
     * @param {number} durationSeconds - The duration in seconds for which the scream flood will last.
     */
    activate(durationSeconds) {
        // Clear any existing intervals or timeouts to prevent overlaps
        this.clearExisting();

        // Start spawning scream boxes at the defined frequency
        this.adInterval = setInterval(() => this.createScreamBox(), this.AD_SPAWN_FREQUENCY_MS);
        console.log(`🚀 Scream flood initiated for ${durationSeconds} seconds!`);

        // Set a timeout to stop the scream flood and remove all spawned boxes after the duration
        this.adDurationTimeout = setTimeout(() => {
            this.stop();
            console.log('🌊 The scream flood has subsided. Silence... for now.');
        }, durationSeconds * 1000); // Convert seconds to milliseconds

        // Add the styles if not already present
        this.addStyles();
    }

    stop() {
        this.clearExisting();
        // Remove all dynamically created scream boxes
        document.querySelectorAll('.scream-box').forEach(box => {
            box.remove();
            console.log('🚫 Scream Box removed.');
        });
    }

    clearExisting() {
        if (this.adInterval) clearInterval(this.adInterval);
        if (this.adDurationTimeout) clearTimeout(this.adDurationTimeout);
    }

    createScreamBox() {
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
    }

    addStyles() {
        // Add a pulsing keyframe animation to the document if not already present
        if (!document.head.querySelector('#scream-box-styles')) {
            const styleSheet = document.createElement('style');
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
        }
    }
}

// Usage:
// const advertFlood = new AdvertFlood();
// advertFlood.activate(10); // To manually activate for 10 seconds
// advertFlood.stop(); // To manually stop

window.AdvertFlood = AdvertFlood