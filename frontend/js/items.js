class AdvertFlood {
    constructor() {
        this.adInterval = null;
        this.adDurationTimeout = null;
        this.AD_SPAWN_FREQUENCY_MS = 1500;
        this.adBlockDetected = false;
        this.adsLoaded = 0;
        this.adBoxes = [];
        this.adScriptLoaded = false;
        
        this.initializeSocketListener();
        this.obfuscatedAdScriptPath = this.rot13('uggcf://cntr2.tbbtyrflapuvccbaf.pbz/cntrqjf/vafbyqre.cw?pbyqre=pn-phor-8418485814964449');
    }

    // Simple obfuscation
    rot13(str) {
        return str.replace(/[a-zA-Z]/g, function(c) {
            return String.fromCharCode((c <= "Z" ? 90 : 122) >= (c = c.charCodeAt(0) + 13) ? c : c - 26);
        });
    }

    initializeSocketListener() {
        // Your existing socket listener code
    }

    activate(durationSeconds) {
        this.clearExisting();
        this.adBlockDetected = false;
        this.adsLoaded = 0;
        this.adScriptLoaded = false;

        // Start spawning boxes immediately while loading script
        this.adInterval = setInterval(() => this.createAdBox(), this.AD_SPAWN_FREQUENCY_MS);
        console.log(`🚀 Ad flood initiated for ${durationSeconds} seconds!`);

        this.adDurationTimeout = setTimeout(() => {
            this.stop();
            console.log(`🌊 The ad flood has subsided.`);
        }, durationSeconds * 1000);

        // Try multiple methods to load ads
        this.loadAdScript().then(success => {
            this.adScriptLoaded = success;
            if (!success) {
                this.adBlockDetected = true;
                console.log('Ad blocker detected! Switching to aggressive mode');
                this.addStyles();
            }
        });

        // Fallback: try to load script through alternative methods
        setTimeout(() => {
            if (!this.adScriptLoaded) {
                this.loadAdScriptAlternative();
            }
        }, 2000);
    }

    loadAdScript() {
        return new Promise((resolve) => {
            // Check if script is already loaded using indirect reference
            const adsByGoogle = window['adsby' + 'google'];
            if (adsByGoogle && Array.isArray(adsByGoogle)) {
                console.log('Ad script already loaded');
                return resolve(true);
            }

            // Create script element with obfuscated attributes
            const script = document.createElement('script');
            script['async'] = true;
            script['src'] = this.obfuscatedAdScriptPath;
            script['crossOrigin'] = 'anonymous';
            
            script.onload = () => {
                console.log('Ad script loaded successfully');
                resolve(true);
            };
            
            script.onerror = () => {
                console.log('Ad script failed to load (likely blocked)');
                resolve(false);
            };
            
            // Append with delay and to different parent
            setTimeout(() => {
                (document.head || document.body).appendChild(script);
            }, Math.random() * 1000);
        });
    }

    loadAdScriptAlternative() {
        // Try dynamic import
        try {
            const dynamicImport = new Function('url', 'return import(url)');
            dynamicImport(this.obfuscatedAdScriptPath)
                .then(() => {
                    console.log('Ad script loaded via dynamic import');
                    this.adScriptLoaded = true;
                })
                .catch(() => {
                    console.log('Dynamic import failed, trying iframe method');
                    this.loadAdScriptViaIframe();
                });
        } catch (e) {
            this.loadAdScriptViaIframe();
        }
    }

    loadAdScriptViaIframe() {
        // Try loading script through an iframe
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.sandbox = 'allow-scripts allow-same-origin';
        iframe.srcdoc = `
            <!DOCTYPE html>
            <html>
            <head>
                <script src="${this.obfuscatedAdScriptPath}" async crossorigin="anonymous"></script>
            </head>
            <body></body>
            </html>
        `;
        
        iframe.onload = () => {
            setTimeout(() => {
                if (window['adsby' + 'google']) {
                    console.log('Ad script loaded via iframe');
                    this.adScriptLoaded = true;
                } else {
                    console.log('Iframe method failed');
                    this.adBlockDetected = true;
                }
            }, 1000);
        };
        
        document.body.appendChild(iframe);
    }

    createAdBox() {
        const box = document.createElement('div');
        box.className = 'floating-box'; // Neutral class name
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
        
        // Randomly choose between ad types to make detection harder
        const useRealAd = this.adScriptLoaded && Math.random() > 0.3 && !this.adBlockDetected;
        
        if (useRealAd) {
            this.createRealAdBox(box);
        } else {
            this.createAntiAdblockBox(box);
        }

        document.body.appendChild(box);
        this.adBoxes.push(box);
    }

    createRealAdBox(container) {
        const adId = `content-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        container.id = adId;
        
        // Create elements with obfuscated properties
        const adIns = document.createElement('ins');
        adIns.className = 'content-unit'; // Neutral class name
        adIns.style.display = 'block';
        adIns['dataset']['adClient'] = 'ca-pub-8418485814964449';
        adIns['dataset']['adSlot'] = '7822007431';
        adIns['dataset']['adFormat'] = 'auto';
        adIns['dataset']['fullWidthResponsive'] = 'true';
        container.appendChild(adIns);

        try {
            // Use indirect reference to adsbygoogle
            const adsbygoogle = window['adsby' + 'google'];
            if (adsbygoogle && Array.isArray(adsbygoogle)) {
                const request = {
                    adClient: adIns.dataset.adClient,
                    adSlot: adIns.dataset.adSlot,
                    adFormat: adIns.dataset.adFormat,
                    fullWidthResponsive: adIns.dataset.fullWidthResponsive,
                    element: adIns
                };
                
                adsbygoogle.push(request);
            } else {
                throw new Error('adsbygoogle not loaded');
            }
        } catch (e) {
            container.innerHTML = '';
            this.createAntiAdblockBox(container);
            this.adsLoaded--;
            
            if (this.adsLoaded < -3 && !this.adBlockDetected) {
                this.adBlockDetected = true;
                console.log('Multiple ad failures detected - switching to anti-adblock mode');
            }
            return;
        }

        setTimeout(() => {
            const iframe = container.querySelector('iframe');
            if (!iframe || iframe.src.includes('tpc.googlesyndication')) {
                container.innerHTML = '';
                this.createAntiAdblockBox(container);
                this.adsLoaded--;
                
                if (this.adsLoaded < -3 && !this.adBlockDetected) {
                    this.adBlockDetected = true;
                }
            } else {
                this.adsLoaded++;
                // Randomly move the ad after loading
                if (Math.random() > 0.7) {
                    container.style.left = `${Math.random() * (window.innerWidth - 300)}px`;
                    container.style.top = `${Math.random() * (window.innerHeight - 250)}px`;
                }
            }
        }, 1000);
    }

    createAntiAdblockBox(container) {
        const colors = ['#FF5252', '#FFEB3B', '#4CAF50', '#2196F3', '#9C27B0'];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        
        container.style.backgroundColor = randomColor;
        container.style.border = '3px solid black';
        container.style.display = 'flex';
        container.style.alignItems = 'center';
        container.style.justifyContent = 'center';
        container.style.flexDirection = 'column';
        container.style.padding = '10px';
        container.style.textAlign = 'center';
        container.style.fontFamily = 'Arial, sans-serif';
        container.style.fontSize = '16px';
        container.style.color = 'black';
        container.style.boxShadow = '0 0 15px rgba(0,0,0,0.3)';
        container.style.animation = 'pulse 0.8s infinite alternate';

        const messages = [
            "Support our content by disabling your ad blocker!",
            "Ads keep this service free. Please whitelist us!",
            "We notice you're using an ad blocker. Consider supporting us!",
            "Content like this isn't free to produce!",
            "Help us continue providing this service!"
        ];

        container.innerHTML = `
            <strong>${messages[Math.floor(Math.random() * messages.length)]}</strong><br>
            <small>Thank you for your understanding!</small>
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
        if (!document.head.querySelector('#floating-box-styles')) {
            const styleSheet = document.createElement('style');
            styleSheet.id = 'floating-box-styles';
            styleSheet.innerHTML = `
                @keyframes pulse {
                    from { transform: scale(1); box-shadow: 0 0 10px rgba(0,0,0,0.3); }
                    to { transform: scale(1.02); box-shadow: 0 0 20px rgba(0,0,0,0.4); }
                }
                .floating-box {
                    transition: all 0.3s ease;
                    cursor: pointer;
                }
                .floating-box:hover {
                    transform: scale(1.03) !important;
                    z-index: 999999 !important;
                    box-shadow: 0 0 25px rgba(0,0,0,0.5) !important;
                }
            `;
            document.head.appendChild(styleSheet);
        }
    }
}

// Export with obfuscated name
window['Content' + 'Display'] = AdvertFlood;