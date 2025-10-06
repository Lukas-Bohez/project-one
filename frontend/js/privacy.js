// script.js - Improved privacy modal implementation

document.addEventListener('DOMContentLoaded', () => {
    // Check if user agent is a crawler/bot
    const isCrawler = () => {
        const userAgent = navigator.userAgent.toLowerCase();
        const bots = [
            'googlebot', 'bingbot', 'slurp', 'duckduckbot', 'baiduspider',
            'yandexbot', 'sogou', 'exabot', 'facebookexternalhit', 'twitterbot',
            'rogerbot', 'linkedinbot', 'embedly', 'quora link preview',
            'showyoubot', 'outbrain', 'pinterest', 'developers.google.com/+/web/snippet'
        ];
        return bots.some(bot => userAgent.includes(bot));
    };

    // Skip privacy modal for crawlers
    if (isCrawler()) {
        console.log('Crawler detected - skipping privacy modal');
        return;
    }

    // Function to check consent validity
    const isConsentValid = () => {
        const consentData = localStorage.getItem('privacyConsent');
        if (!consentData) {
            return false;
        }
        try {
            const { timestamp, accepted } = JSON.parse(consentData);
            const now = new Date().getTime();
            const oneYear = 365 * 24 * 60 * 60 * 1000; // 1 year in milliseconds

            if (accepted && (now - timestamp < oneYear)) {
                return true;
            }
        } catch (e) {
            console.error("Error parsing privacyConsent from localStorage:", e);
            localStorage.removeItem('privacyConsent'); // Remove invalid data
        }
        return false;
    };

    // Check if user has already given consent
    if (!isConsentValid() && window.location.pathname.indexOf('privacy.html') === -1) {
        // Use setTimeout to allow page content to load first
        setTimeout(showPrivacyModal, 1000);
    }

    // Function to show privacy modal
    function showPrivacyModal() {
        // Don't show if already visible
        if (document.getElementById('privacy-modal-overlay')) {
            return;
        }

        // Create modal overlay with improved styling
        const modalOverlay = document.createElement('div');
        modalOverlay.id = 'privacy-modal-overlay';
        modalOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.85);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 9999;
            animation: fadeIn 0.3s ease;
        `;

        // Create modal container with larger size for desktop
        const modalContainer = document.createElement('div');
        modalContainer.id = 'privacy-modal-container';
        modalContainer.style.cssText = `
            background-color: white;
            width: 90%;
            max-width: 900px;
            height: 80vh;
            border-radius: 12px;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
            animation: scaleIn 0.3s ease;
        `;

        // Create modal header
        const modalHeader = document.createElement('div');
        // Default header styles, will be overridden for dark mode if needed
        modalHeader.style.cssText = `
            padding: 20px;
            background: #f8f9fa;
            border-bottom: 1px solid #e9ecef;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-shrink: 0;
        `;
        
        const modalTitle = document.createElement('h2');
        modalTitle.textContent = 'Privacy Settings';
        modalTitle.style.cssText = `
            margin: 0;
            font-size: 1.8rem;
            color: #333;
            font-weight: 600;
        `;
        
        modalHeader.appendChild(modalTitle);
        modalContainer.appendChild(modalHeader);

        // Create iframe container with proper scrolling
        const iframeContainer = document.createElement('div');
        iframeContainer.style.cssText = `
            flex: 1;
            overflow: hidden;
            position: relative;
            min-height: 0;
        `;

        // Create iframe for privacy.html
        const iframe = document.createElement('iframe');
        iframe.id = 'privacy-iframe';
        iframe.src = '../html/privacy.html';
        iframe.style.cssText = `
            width: 100%;
            height: 100%;
            border: none;
            display: block;
        `;
        
        // Handle iframe load event to ensure content is properly loaded
        iframe.onload = () => {
            try {
                // Send a message to the iframe content to set up communication
                iframe.contentWindow.postMessage('modalReady', window.location.origin);
                // Also post current theme so iframe can apply it
                // Determine current theme: prefer data-theme or body class, fallback to localStorage or system
                const theme = (document.documentElement.getAttribute('data-theme') === 'dark' || document.body.classList.contains('theme-dark')) ? 'dark' : (localStorage.getItem('theme') || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
                iframe.contentWindow.postMessage({ type: 'applyTheme', theme }, window.location.origin);
            } catch (e) {
                console.warn('Could not communicate with iframe:', e);
            }
        };

        // Handle iframe load errors
        iframe.onerror = () => {
            console.error('Failed to load privacy.html');
            // Fallback: show inline content if iframe fails
            showInlinePrivacyContent(iframeContainer);
        };
        
        // Create modal footer with only Accept button
        const modalFooter = document.createElement('div');
        modalFooter.style.cssText = `
            padding: 20px;
            background: #f8f9fa;
            border-top: 1px solid #e9ecef;
            display: flex;
            justify-content: flex-end;
            flex-shrink: 0;
        `;
        
        const acceptButton = document.createElement('button');
        acceptButton.textContent = 'Accept All';
        acceptButton.style.cssText = `
            padding: 12px 30px;
            background-color: #2e7d32; /* darker green for AA contrast */
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: bold;
            font-size: 1.1rem;
            transition: background-color 0.2s;
        `;
        acceptButton.onmouseover = () => acceptButton.style.backgroundColor = '#1b5e20';
        acceptButton.onmouseout = () => acceptButton.style.backgroundColor = '#2e7d32';
        acceptButton.onclick = () => {
            // Save consent
            const consentData = {
                accepted: true,
                timestamp: new Date().getTime()
            };
            localStorage.setItem('privacyConsent', JSON.stringify(consentData));
            
            // Remove modal
            removePrivacyModal();
        };
        
        modalFooter.appendChild(acceptButton);
        
        // Add elements to DOM
        iframeContainer.appendChild(iframe);
        modalContainer.appendChild(iframeContainer);
        modalContainer.appendChild(modalFooter);
        modalOverlay.appendChild(modalContainer);
        document.body.appendChild(modalOverlay);
        
        // Prevent background scrolling more effectively
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';

        // Add keydown event listener for ESC key (disabled)
        const handleKeydown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                // Disable ESC key to close modal
            }
        };
        document.addEventListener('keydown', handleKeydown);
        
        // Store reference to remove later
        modalOverlay._keydownHandler = handleKeydown;

        // Disable click outside to close
        modalOverlay.onclick = (e) => {
            // Prevent closing when clicking outside the modal
            if (e.target === modalOverlay) {
                e.preventDefault();
                e.stopPropagation();
            }
        };

        // Listen for messages from the iframe
        const messageHandler = (event) => {
            // Security check - verify message origin
            if (event.origin !== window.location.origin) return;
            
            if (event.data === 'privacyConsentAccepted') {
                // Save consent
                const consentData = {
                    accepted: true,
                    timestamp: new Date().getTime()
                };
                localStorage.setItem('privacyConsent', JSON.stringify(consentData));
                
                // Remove modal
                removePrivacyModal();
            } else if (event.data === 'privacyConsentRejected') {
                // Handle rejection from iframe
                const consentData = {
                    accepted: false,
                    timestamp: new Date().getTime()
                };
                localStorage.setItem('privacyConsent', JSON.stringify(consentData));
                
                // Remove modal
                removePrivacyModal();
            }
        };
        
        window.addEventListener('message', messageHandler);
        modalOverlay._messageHandler = messageHandler;

        // Add CSS animations
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes scaleIn {
                from { transform: scale(0.95); opacity: 0; }
                to { transform: scale(1); opacity: 1; }
            }
            @media (max-width: 768px) {
                #privacy-modal-container {
                    width: 95%;
                    height: 90vh;
                    max-height: none;
                }
            }
            /* Ensure iframe scrolling works properly */
            #privacy-iframe {
                scrollbar-width: thin;
            }
            #privacy-iframe::-webkit-scrollbar {
                width: 8px;
            }
            #privacy-iframe::-webkit-scrollbar-track {
                background: #f1f1f1;
            }
            #privacy-iframe::-webkit-scrollbar-thumb {
                background: #888;
                border-radius: 4px;
            }
            #privacy-iframe::-webkit-scrollbar-thumb:hover {
                background: #555;
            }
        `;
        document.head.appendChild(style);
        modalOverlay._style = style;

        // If current page/theme indicates dark mode, apply dark inline styles to modal elements
        try {
            const current = (document.documentElement.getAttribute('data-theme') === 'dark' || document.body.classList.contains('theme-dark')) ? 'dark' : null;
            const saved = current || localStorage.getItem('theme') || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
            if (saved === 'dark') {
                modalContainer.style.backgroundColor = '#0b1220';
                modalContainer.style.boxShadow = '0 10px 40px rgba(0,0,0,0.6)';
                modalHeader.style.background = '#071029';
                modalHeader.style.borderBottom = '1px solid rgba(255,255,255,0.04)';
                modalTitle.style.color = '#e6eef9';
                modalFooter.style.background = '#071029';
                modalFooter.style.borderTop = '1px solid rgba(255,255,255,0.04)';
                acceptButton.style.backgroundColor = '#2563eb';
                acceptButton.onmouseover = () => acceptButton.style.backgroundColor = '#1e40af';
                acceptButton.onmouseout = () => acceptButton.style.backgroundColor = '#2563eb';
            }
        } catch (e) {
            // ignore
        }
    }

    // Fallback function to show inline content if iframe fails
    function showInlinePrivacyContent(container) {
        container.innerHTML = `
            <div style="padding: 20px; overflow-y: auto; height: 100%;">
                <h2>Privacy Policy</h2>
                <p>We value your privacy and are committed to protecting your personal information.</p>
                
                <h3>What information do we collect?</h3>
                <ul>
                    <li><strong>Environmental Sensor Data:</strong> Temperature and light levels to adjust game difficulty</li>
                    <li><strong>Game Data:</strong> Performance metrics and progress</li>
                    <li><strong>Technical Data:</strong> Browser and device information</li>
                </ul>

                <h3>Terms of Service</h3>
                <ul>
                    <li>You will not attempt to cheat or manipulate the game system</li>
                    <li>You are responsible for maintaining account confidentiality</li>
                    <li>We reserve the right to modify or terminate the service</li>
                    <li>You must be at least 13 years old to use this service</li>
                </ul>

                <p><strong>Contact:</strong> lukasbohez@gmail.com</p>
            </div>
        `;
    }

    // Remove modal and all event listeners
    function removePrivacyModal() {
        const modal = document.getElementById('privacy-modal-overlay');
        if (modal) {
            // Remove event listeners
            if (modal._keydownHandler) {
                document.removeEventListener('keydown', modal._keydownHandler);
            }
            if (modal._messageHandler) {
                window.removeEventListener('message', modal._messageHandler);
            }
            if (modal._style) {
                document.head.removeChild(modal._style);
            }
            
            // Add fade out animation
            modal.style.animation = 'fadeOut 0.3s ease';
            modal.firstChild.style.animation = 'scaleOut 0.3s ease';
            
            // Add fadeOut animation
            const style = document.createElement('style');
            style.textContent = `
                @keyframes fadeOut {
                    from { opacity: 1; }
                    to { opacity: 0; }
                }
                @keyframes scaleOut {
                    from { transform: scale(1); opacity: 1; }
                    to { transform: scale(0.95); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
            
            // Remove after animation completes
            setTimeout(() => {
                modal.remove();
                // Restore scrolling on both body and html
                document.body.style.overflow = '';
                document.documentElement.style.overflow = '';
                document.head.removeChild(style);
            }, 300);
        }
    }
});