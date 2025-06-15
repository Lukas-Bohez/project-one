let adInterval;
let adDurationTimeout;
const AD_SPAWN_FREQUENCY_MS = 1500; // How often a new ad pops up (1.5 seconds)
const AD_SLOT_ID = '7822007431'; // YOUR Ad Slot ID, directly from the AdSense code
const AD_CLIENT_ID = 'ca-pub-8418485814964449'; // Your AdSense Publisher ID

// Determine the local IP for the socket connection
const lanIP = `http://${window.location.hostname}`;
const socket = io(lanIP, {
    transports: ["websocket", "polling"],
    timeout: 20000,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000
});

// Load the AdSense script globally once
// This script needs to be present on the page where this JavaScript runs.
// It's usually placed in the <head> section.
// <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8418485814964449" crossorigin="anonymous"></script>

// Listen for the B2F_addItem event and automatically activate the flood
socket.on('B2F_addItem', () => {
    console.log('📢📢📢 Prepare for a torrent of advertisements! 📢📢📢');
    activateAdvertFlood(10); // Fixed 10-second duration for the flood
});

/**
 * Activates a flood of AdSense advertisements, spawning them randomly on the page.
 * @param {number} durationSeconds - The duration in seconds for which the ad flood will last.
 */
const activateAdvertFlood = (durationSeconds) => {
    // Clear any existing intervals or timeouts to prevent overlaps
    if (adInterval) clearInterval(adInterval);
    if (adDurationTimeout) clearTimeout(adDurationTimeout);

    // Function to create and append a single ad container
    const createAdContainer = () => {
        const adContainer = document.createElement('div');
        adContainer.className = 'random-ad-container'; // Class for easy selection later
        adContainer.style.position = 'fixed'; // Position it absolutely relative to the viewport
        adContainer.style.zIndex = '9999'; // Ensure it's on top of almost everything
        // Random positioning within the viewport, ensuring it's mostly visible
        adContainer.style.left = `${Math.random() * (window.innerWidth - 320)}px`; // -320 to keep it somewhat within bounds
        adContainer.style.top = `${Math.random() * (window.innerHeight - 270)}px`; // -270 to keep it somewhat within bounds
        adContainer.style.width = '300px'; // Standard AdSense unit width
        adContainer.style.height = '250px'; // Standard AdSense unit height
        adContainer.style.overflow = 'hidden'; // Hide anything that overflows
        adContainer.style.border = '2px dashed red'; // Make it visually distinct for testing!
        adContainer.style.backgroundColor = 'rgba(255, 255, 0, 0.2)'; // Semi-transparent yellow background

        const insElement = document.createElement('ins');
        insElement.className = 'adsbygoogle';
        insElement.style.display = 'block';
        insElement.setAttribute('data-ad-client', AD_CLIENT_ID); // Use your extracted client ID
        insElement.setAttribute('data-ad-slot', AD_SLOT_ID); // Use your extracted ad slot ID
        insElement.setAttribute('data-ad-format', 'auto'); // Auto format for flexibility
        insElement.setAttribute('data-full-width-responsive', 'true'); // Make it responsive

        adContainer.appendChild(insElement);
        document.body.appendChild(adContainer);

        // Push the ad to AdSense to be rendered. This is crucial!
        (adsbygoogle = window.adsbygoogle || []).push({});
        console.log('💰 Ad container spawned!');
    };

    // Start spawning ads at the defined frequency
    adInterval = setInterval(createAdContainer, AD_SPAWN_FREQUENCY_MS);
    console.log(`🚀 Ad flood initiated for ${durationSeconds} seconds!`);

    // Set a timeout to stop the ad flood and remove all spawned ads after the duration
    adDurationTimeout = setTimeout(() => {
        clearInterval(adInterval); // Stop spawning new ads
        // Remove all dynamically created ad containers
        document.querySelectorAll('.random-ad-container').forEach(ad => {
            ad.remove();
            console.log('❌ Ad container removed.');
        });
        console.log('🌊 Ad flood has subsided. The page breathes again.');
    }, durationSeconds * 1000); // Convert seconds to milliseconds
};