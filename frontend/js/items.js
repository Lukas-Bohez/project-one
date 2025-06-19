class AdvertFlood {
    constructor() {
        this.adInterval = null;
        this.adDurationTimeout = null;
        this.AD_SPAWN_FREQUENCY_MS = 3000; // Slower frequency
        this.adBoxes = [];
        this.adScriptLoaded = false;
        
        // Acceptable Ads compliant parameters
        this.adConfig = {
            format: 'auto',
            responsive: true,
            textOnly: false,
            label: 'Advertisement',
            borderColor: '#eeeeee',
            backgroundColor: '#ffffff',
            textColor: '#000000',
            titleColor: '#0066cc',
            maxWidth: '300px'
        };
    }

    activate(durationSeconds) {
        this.clearExisting();
        this.adScriptLoaded = false;

        // Start with a polite message first
        this.showInitialMessage();

        // Check for ad blocker before loading ads
        setTimeout(() => {
            this.checkAdBlocker().then(blockerDetected => {
                if (!blockerDetected) {
                    this.loadAdScript();
                    this.adInterval = setInterval(() => this.createAdBox(), this.AD_SPAWN_FREQUENCY_MS);
                } else {
                    this.showAcceptableAdsMessage();
                }
            });
        }, 1000);

        console.log(`✅ Ethical ad display initiated for ${durationSeconds} seconds`);

        this.adDurationTimeout = setTimeout(() => {
            this.stop();
            console.log(`⏹ Ad display completed`);
        }, durationSeconds * 1000);
    }

    showInitialMessage() {
        const messageBox = document.createElement('div');
        messageBox.className = 'ethical-ad-message';
        messageBox.innerHTML = `
            <div style="position: fixed; bottom: 20px; right: 20px; background: #f8f9fa; 
                        padding: 15px; border-radius: 5px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                        max-width: 300px; z-index: 9999; border-left: 4px solid #4CAF50;">
                <p style="margin: 0;">We use ethical advertising to support our content. 
                These ads comply with Acceptable Ads standards.</p>
            </div>
        `;
        document.body.appendChild(messageBox);
        setTimeout(() => messageBox.remove(), 5000);
    }

    async checkAdBlocker() {
        try {
            const testAdURL = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';
            const response = await fetch(testAdURL, { method: 'HEAD', mode: 'no-cors' });
            return false;
        } catch (e) {
            return true;
        }
    }

    loadAdScript() {
        return new Promise((resolve) => {
            if (window.adsbygoogle && Array.isArray(window.adsbygoogle)) {
                return resolve(true);
            }

            const script = document.createElement('script');
            script.async = true;
            script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8418485814964449';
            script.crossOrigin = 'anonymous';
            
            script.onload = () => {
                console.log('Ad script loaded successfully');
                this.adScriptLoaded = true;
                resolve(true);
            };
            
            script.onerror = () => {
                console.log('Ad script failed to load');
                resolve(false);
            };
            
            document.head.appendChild(script);
        });
    }

    createAdBox() {
        if (!this.adScriptLoaded) return;

        const box = document.createElement('div');
        box.className = 'ethical-ad-container';
        Object.assign(box.style, {
            position: 'fixed',
            zIndex: '9999',
            left: `${10 + Math.random() * (window.innerWidth - 320)}px`,
            top: `${10 + Math.random() * (window.innerHeight - 270)}px`,
            width: '300px',
            minHeight: '50px',
            backgroundColor: this.adConfig.backgroundColor,
            border: `1px solid ${this.adConfig.borderColor}`,
            borderRadius: '4px',
            overflow: 'hidden',
            boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
            transition: 'all 0.3s ease'
        });

        // Ad label
        const label = document.createElement('div');
        label.textContent = this.adConfig.label;
        Object.assign(label.style, {
            padding: '4px 8px',
            fontSize: '11px',
            color: '#666666',
            backgroundColor: '#f5f5f5',
            borderBottom: `1px solid ${this.adConfig.borderColor}`
        });
        box.appendChild(label);

        // Ad content container
        const adContent = document.createElement('div');
        adContent.style.padding = '8px';
        box.appendChild(adContent);

        // Create the actual ad
        this.createAcceptableAd(adContent);

        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '×';
        Object.assign(closeBtn.style, {
            position: 'absolute',
            top: '2px',
            right: '5px',
            background: 'transparent',
            border: 'none',
            fontSize: '16px',
            cursor: 'pointer',
            color: '#999'
        });
        closeBtn.onclick = () => box.remove();
        box.appendChild(closeBtn);

        document.body.appendChild(box);
        this.adBoxes.push(box);
    }

    createAcceptableAd(container) {
        const adId = `ad-${Date.now()}`;
        
        const adIns = document.createElement('ins');
        adIns.className = 'adsbygoogle';
        Object.assign(adIns.style, {
            display: 'block',
            width: '100%',
            height: 'auto'
        });
        
        adIns.dataset.adClient = 'ca-pub-8418485814964449';
        adIns.dataset.adSlot = '7822007431';
        adIns.dataset.adFormat = this.adConfig.format;
        adIns.dataset.fullWidthResponsive = this.adConfig.responsive.toString();
        
        container.appendChild(adIns);

        try {
            if (window.adsbygoogle && Array.isArray(window.adsbygoogle)) {
                window.adsbygoogle.push({});
            } else {
                this.showTextAd(container);
            }
        } catch (e) {
            this.showTextAd(container);
        }
    }

    showTextAd(container) {
        container.innerHTML = `
            <div style="text-align: center; padding: 10px;">
                <h4 style="color: ${this.adConfig.titleColor}; margin: 0 0 8px 0; font-size: 14px;">
                    Support Our Content
                </h4>
                <p style="color: ${this.adConfig.textColor}; margin: 0 0 8px 0; font-size: 12px;">
                    This space helps fund our free content. Thank you for your support!
                </p>
                <a href="/support" style="color: ${this.adConfig.titleColor}; font-size: 12px;">
                    Learn more about our funding
                </a>
            </div>
        `;
    }

    showAcceptableAdsMessage() {
        const box = document.createElement('div');
        Object.assign(box.style, {
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            backgroundColor: '#f8f9fa',
            padding: '15px',
            borderRadius: '5px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            maxWidth: '300px',
            zIndex: '9999',
            borderLeft: '4px solid #FFC107'
        });
        
        box.innerHTML = `
            <h4 style="margin-top: 0;">We Value Your Privacy</h4>
            <p>We use Acceptable Ads to support our content. These are:</p>
            <ul style="padding-left: 20px; margin-bottom: 10px;">
                <li>Non-animated</li>
                <li>Clearly labeled</li>
                <li>Limited in number</li>
            </ul>
            <p>Would you consider whitelisting us?</p>
            <div style="display: flex; gap: 10px;">
                <button style="padding: 5px 10px; background: #4CAF50; color: white; border: none; border-radius: 3px; cursor: pointer;">
                    Whitelist Us
                </button>
                <button style="padding: 5px 10px; background: #f1f1f1; border: none; border-radius: 3px; cursor: pointer;">
                    No Thanks
                </button>
            </div>
        `;
        
        document.body.appendChild(box);
        this.adBoxes.push(box);
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
}

// Initialize
window['Content' + 'Display'] = AdvertFlood;