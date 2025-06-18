class AdvertFlood {
    constructor() {
        this.adInterval = null;
        this.adDurationTimeout = null;
        this.AD_SPAWN_FREQUENCY_MS = 1500;
        this.adBlockDetected = false;
        this.adsLoaded = 0;
        this.adBoxes = [];
        
        this.initializeSocketListener();
    }

    initializeSocketListener() {
        // Your existing socket listener code
    }

    activate(durationSeconds) {
        this.clearExisting();
        this.adBlockDetected = false;
        this.adsLoaded = 0;

        // First try to load the ad script
        this.loadAdScript().then(success => {
            if (!success) {
                this.adBlockDetected = true;
                durationSeconds *= 2;
                console.log('Ad blocker detected! Doubling duration to', durationSeconds);
            }

            // Start spawning boxes
            this.adInterval = setInterval(() => this.createAdBox(), this.AD_SPAWN_FREQUENCY_MS);
            console.log(`🚀 ${this.adBlockDetected ? 'Anti-adblock' : 'Ad'} flood initiated for ${durationSeconds} seconds!`);

            this.adDurationTimeout = setTimeout(() => {
                this.stop();
                console.log(`🌊 The ${this.adBlockDetected ? 'anti-adblock' : 'ad'} flood has subsided.`);
            }, durationSeconds * 1000);

            if (this.adBlockDetected) {
                this.addStyles();
            }
        });
    }

    loadAdScript() {
        return new Promise((resolve) => {
            const script = document.createElement('script');
            script.async = true;
            script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8418485814964449';
            script.crossOrigin = 'anonymous';
            
            script.onload = () => {
                console.log('Ad script loaded successfully');
                resolve(true);
            };
            
            script.onerror = () => {
                console.log('Ad script failed to load (likely blocked)');
                resolve(false);
            };
            
            document.body.appendChild(script);
        });
    }

    createAdBox() {
        const box = document.createElement('div');
        box.className = 'ad-box';
        box.style.position = 'fixed';
        box.style.zIndex = '99999';
        box.style.left = `${Math.random() * (window.innerWidth - 300)}px`;
        box.style.top = `${Math.random() * (window.innerHeight - 250)}px`;
        box.style.width = '300px';
        box.style.height = '250px';
        box.style.backgroundColor = 'white';
        box.style.border = '2px solid #ccc';
        box.style.borderRadius = '5px';
        box.style.overflow = 'hidden';
        
        if (this.adBlockDetected) {
            this.createAntiAdblockBox(box);
        } else {
            this.createRealAdBox(box);
        }

        document.body.appendChild(box);
        this.adBoxes.push(box);
    }

    createRealAdBox(container) {
        const adId = `ad-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        container.id = adId;
        
        const adIns = document.createElement('ins');
        adIns.className = 'adsbygoogle';
        adIns.style.display = 'block';
        adIns.dataset.adClient = 'ca-pub-8418485814964449';
        adIns.dataset.adSlot = '7822007431';
        adIns.dataset.adFormat = 'auto';
        adIns.dataset.fullWidthResponsive = 'true';
        container.appendChild(adIns);

        // Push the ad
        (adsbygoogle = window.adsbygoogle || []).push({});

        // Check if ad loaded after a delay
        setTimeout(() => {
            const iframe = container.querySelector('iframe');
            if (!iframe || iframe.src.includes('tpc.googlesyndication')) {
                // Ad failed to load - convert to anti-adblock
                container.innerHTML = '';
                this.createAntiAdblockBox(container);
                this.adsLoaded--;
                
                // If most ads are failing, switch to anti-adblock mode
                if (this.adsLoaded < 0 && !this.adBlockDetected) {
                    this.adBlockDetected = true;
                    console.log('Multiple ad failures detected - switching to anti-adblock mode');
                }
            } else {
                this.adsLoaded++;
            }
        }, 1000);
    }

    createAntiAdblockBox(container) {
        container.style.backgroundColor = `hsl(${Math.random() * 360}, 100%, 70%)`;
        container.style.border = '3px solid black';
        container.style.display = 'flex';
        container.style.alignItems = 'center';
        container.style.justifyContent = 'center';
        container.style.flexDirection = 'column';
        container.style.padding = '10px';
        container.style.textAlign = 'center';
        container.style.fontFamily = 'Impact, sans-serif';
        container.style.fontSize = '18px';
        container.style.color = 'black';
        container.style.textShadow = '1px 1px 0px white';
        container.style.animation = 'screamPulse 0.5s infinite alternate';

        container.innerHTML = `
            <strong>HEY! TURN OFF THAT AD BLOCKER!</strong><br>
            <small>WE NEED YOUR CLICKS!</small><br>
            <small>THIS CONTENT ISN'T FREE!</small>
        `;
    }

    stop() {
        this.clearExisting();
        this.adBoxes.forEach(box => box.remove());
        this.adBoxes = [];
    }

    clearExisting() {
        if (this.adInterval) clearInterval(this.adInterval);
        if (this.adDurationTimeout) clearTimeout(this.adDurationTimeout);
    }

    addStyles() {
        if (!document.head.querySelector('#scream-box-styles')) {
            const styleSheet = document.createElement('style');
            styleSheet.id = 'scream-box-styles';
            styleSheet.innerHTML = `
                @keyframes screamPulse {
                    from { transform: scale(1); opacity: 1; }
                    to { transform: scale(1.05); opacity: 0.9; }
                }
                .ad-box {
                    box-shadow: 3px 3px 10px rgba(0,0,0,0.3);
                    transition: transform 0.2s;
                }
                .ad-box:hover {
                    transform: scale(1.05);
                    z-index: 999999;
                }
            `;
            document.head.appendChild(styleSheet);
        }
    }
}

window.AdvertFlood = AdvertFlood;