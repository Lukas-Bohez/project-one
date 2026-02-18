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
    if (!isConsentValid() && window.location.pathname.indexOf('/pages/privacy') === -1) {
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

        // Create content container with inline privacy content
        const contentContainer = document.createElement('div');
        contentContainer.style.cssText = `
            flex: 1;
            overflow: hidden;
            position: relative;
            min-height: 0;
        `;
        
        // Show inline privacy content directly
        showInlinePrivacyContent(contentContainer);
        
        // Create modal footer with no buttons (they're now in content)
        const modalFooter = document.createElement('div');
        modalFooter.style.cssText = `
            padding: 20px;
            background: #f8f9fa;
            border-top: 1px solid #e9ecef;
            display: flex;
            justify-content: flex-end;
            flex-shrink: 0;
        `;
        
        // Add elements to DOM
        modalContainer.appendChild(contentContainer);
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

        // No iframe message handling needed since we're using inline content

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
            /* Modal content scrolling */
            #privacy-modal-container div[style*="overflow-y: auto"] {
                scrollbar-width: thin;
            }
            #privacy-modal-container div[style*="overflow-y: auto"]::-webkit-scrollbar {
                width: 8px;
            }
            #privacy-modal-container div[style*="overflow-y: auto"]::-webkit-scrollbar-track {
                background: #f1f1f1;
            }
            #privacy-modal-container div[style*="overflow-y: auto"]::-webkit-scrollbar-thumb {
                background: #888;
                border-radius: 4px;
            }
            #privacy-modal-container div[style*="overflow-y: auto"]::-webkit-scrollbar-thumb:hover {
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
            }
        } catch (e) {
            // ignore
        }
    }

    // Fallback function to show inline content if iframe fails
    function showInlinePrivacyContent(container) {
        container.innerHTML = `
            <div style="padding: 20px; overflow-y: auto; height: 100%; background: var(--bg-primary); color: var(--text-primary);">
                <h2 style="color: var(--primary-color); margin-bottom: 1rem;">Privacy Policy</h2>
                <p style="margin-bottom: 2rem; line-height: 1.6;">
                    Welcome to Quiz The Spire! We value your privacy and transparency regarding how we collect, use, and share data. This Privacy Policy explains what information we collect when you use our quiz game, why we collect it, and how we protect it.
                </p>

                <div style="margin-bottom: 2rem;">
                    <h3 style="color: var(--primary-color); margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 2px solid var(--primary-color);">What information do we collect?</h3>
                    <p style="margin-bottom: 1rem; line-height: 1.6;">
                        We collect various types of information to enhance your gaming experience and optimize the functionality of Quiz The Spire:
                    </p>
                    <ul style="margin-bottom: 1rem; padding-left: 2rem; line-height: 1.6;">
                        <li style="margin-bottom: 0.5rem;">
                            <strong>Game Data:</strong> Information about your quiz performance, points scored, items used, and game progress is collected to improve the game and display your results.
                        </li>
                        <li style="margin-bottom: 0.5rem;">
                            <strong>Technical Data:</strong> Data such as your IP address, browser type, operating system, and device type may be automatically collected for diagnostic purposes and to ensure the stability of our service.
                        </li>
                    </ul>
                </div>

                <div style="margin-bottom: 2rem;">
                    <h3 style="color: var(--primary-color); margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 2px solid var(--primary-color);">How do we use your information?</h3>
                    <p style="margin-bottom: 1rem; line-height: 1.6;">
                        The collected information is used for the following purposes:
                    </p>
                    <ul style="margin-bottom: 1rem; padding-left: 2rem; line-height: 1.6;">
                        <li style="margin-bottom: 0.5rem;">
                            To <strong>personalize and improve gameplay</strong> and develop new features.
                        </li>
                        <li style="margin-bottom: 0.5rem;">
                            For <strong>internal analysis</strong> to understand game performance and develop new features.
                        </li>
                        <li style="margin-bottom: 0.5rem;">
                            To ensure the <strong>stability and security</strong> of our service.
                        </li>
                    </ul>
                </div>

                <div style="margin-bottom: 2rem;">
                    <h3 style="color: var(--primary-color); margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 2px solid var(--primary-color);">Sharing information with third parties</h3>
                    <p style="margin-bottom: 1rem; line-height: 1.6;">
                        We do not share your information with third parties, except as described below:
                    </p>
                    <ul style="margin-bottom: 1rem; padding-left: 2rem; line-height: 1.6;">
                        <li style="margin-bottom: 0.5rem;">
                            <strong>Google Products:</strong> We may use Google ad code to generate revenue. In this case, Google, as a third party, may place and read cookies in your browser, and use web beacons or IP addresses to collect information through the display of ads on our website. You can find more information about how Google uses data when you use our partners' sites or apps via this link: <a href="https://policies.google.com/technologies/partner-sites" target="_blank" style="color: var(--primary-color);">How Google uses data</a>.
                        </li>
                        <li style="margin-bottom: 0.5rem;">
                            <strong>Legal Obligations:</strong> We may disclose information if legally required, or if we believe in good faith that such action is necessary to comply with a legal obligation, protect our rights or property, or protect the safety of our users or the public.
                        </li>
                    </ul>
                </div>

                <div style="margin-bottom: 2rem;">
                    <h3 style="color: var(--primary-color); margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 2px solid var(--primary-color);">Your Choices and Rights</h3>
                    <p style="margin-bottom: 1rem; line-height: 1.6;">
                        You have the right to request access to the personal information we hold about you, to correct it, or to delete it. Please contact us at our support chat to exercise your rights.
                    </p>
                </div>

                <div style="margin-bottom: 2rem;">
                    <h3 style="color: var(--primary-color); margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 2px solid var(--primary-color);">Data Security</h3>
                    <p style="margin-bottom: 1rem; line-height: 1.6;">
                        We take reasonable measures to protect your information from unauthorized access, use, or disclosure. However, no method of transmission over the internet or electronic storage is 100% secure.
                    </p>
                </div>

                <div style="margin-bottom: 2rem;">
                    <h3 style="color: var(--primary-color); margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 2px solid var(--primary-color);">Changes to this Privacy Policy</h3>
                    <p style="margin-bottom: 1rem; line-height: 1.6;">
                        We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page. Changes are effective when they are posted on this page.
                    </p>
                </div>

                <div style="margin-bottom: 2rem;">
                    <h3 style="color: var(--primary-color); margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 2px solid var(--primary-color);">Contact Us</h3>
                    <p style="margin-bottom: 1rem; line-height: 1.6;">
                        If you have any questions about this Privacy Policy, please contact us at our support chat.
                    </p>
                </div>

                <div style="margin-bottom: 2rem;">
                    <h3 style="color: var(--primary-color); margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 2px solid var(--primary-color);">Terms of Service</h3>
                    <p style="margin-bottom: 1rem; line-height: 1.6;">By using Quiz The Spire, you agree to the following terms:</p>
                    <ul style="margin-bottom: 1rem; padding-left: 2rem; line-height: 1.6;">
                        <li style="margin-bottom: 0.5rem;">You will not attempt to cheat or manipulate the game system</li>
                        <li style="margin-bottom: 0.5rem;">You are responsible for maintaining the confidentiality of your account</li>
                        <li style="margin-bottom: 0.5rem;">We reserve the right to modify or terminate the service at any time</li>
                        <li style="margin-bottom: 0.5rem;">All user data will be handled in accordance with our privacy policy</li>
                        <li style="margin-bottom: 0.5rem;">You must be at least 13 years old to use this service</li>
                    </ul>
                </div>

                <div style="margin-bottom: 2rem;">
                    <h3 style="color: var(--primary-color); margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 2px solid var(--primary-color);">About Quiz The Spire</h3>
                    <p style="margin-bottom: 1rem; line-height: 1.6;">
                        Quiz The Spire is a <strong>completely free</strong> dynamic quiz game. Enjoy fun quizzes and questions with changing difficulty levels!
                    </p>
                </div>

                <div style="border-top: 1px solid var(--border-color); padding-top: 2rem;">
                    <h3 style="color: var(--primary-color); margin-bottom: 1rem;">Consent for Data Usage</h3>
                    <p style="margin-bottom: 1.5rem; line-height: 1.6;">
                        To fully enjoy "Quiz The Spire," we ask for your consent to use cookies and anonymized environmental data as described in this policy.
                    </p>
                    
                    <div style="text-align: center;">
                        <button class="accept-privacy-btn" style="padding: 12px 24px; background-color: #2e7d32 !important; color: white !important; border: 1px solid #2e7d32 !important; border-radius: 6px; cursor: pointer; font-size: 1rem; margin-right: 10px; box-shadow: 0 2px 4px rgba(46, 139, 50, 0.3); font-weight: 600;">Accept All</button>
                        <button class="reject-privacy-btn" style="padding: 12px 24px; background-color: #dc3545 !important; color: white !important; border: 1px solid #dc3545 !important; border-radius: 6px; cursor: pointer; font-size: 1rem; box-shadow: 0 2px 4px rgba(220, 53, 69, 0.3); font-weight: 600;">Reject All</button>
                    </div>
                </div>
            </div>
        `;
        
        // Add event listeners for both buttons
        setTimeout(() => {
            const acceptBtn = container.querySelector('.accept-privacy-btn');
            const rejectBtn = container.querySelector('.reject-privacy-btn');
            
            if (acceptBtn) {
                // Force the green styling for accept button
                acceptBtn.style.setProperty('background-color', '#2e7d32', 'important');
                acceptBtn.style.setProperty('color', 'white', 'important');
                acceptBtn.style.setProperty('border', '1px solid #2e7d32', 'important');
                acceptBtn.style.setProperty('box-shadow', '0 2px 4px rgba(46, 139, 50, 0.3)', 'important');
                acceptBtn.style.setProperty('font-weight', '600', 'important');
                
                acceptBtn.addEventListener('click', () => {
                    const consentData = {
                        accepted: true,
                        timestamp: new Date().getTime()
                    };
                    localStorage.setItem('privacyConsent', JSON.stringify(consentData));
                    try {
                        // Google Consent Mode v2 - grant consent
                        window.dataLayer = window.dataLayer || [];
                        function gtag(){dataLayer.push(arguments);} // eslint-disable-line no-inner-declarations
                        gtag('consent','update',{
                            'ad_storage': 'granted',
                            'analytics_storage': 'granted',
                            'ad_user_data': 'granted',
                            'ad_personalization': 'granted'
                        });
                    } catch(e) { /* noop */ }
                    
                    // Remove modal
                    removePrivacyModal();
                });
            }
            
            if (rejectBtn) {
                // Force the red styling for reject button
                rejectBtn.style.setProperty('background-color', '#dc3545', 'important');
                rejectBtn.style.setProperty('color', 'white', 'important');
                rejectBtn.style.setProperty('border', '1px solid #dc3545', 'important');
                rejectBtn.style.setProperty('box-shadow', '0 2px 4px rgba(220, 53, 69, 0.3)', 'important');
                rejectBtn.style.setProperty('font-weight', '600', 'important');
                
                rejectBtn.addEventListener('click', () => {
                    const consentData = {
                        accepted: false,
                        timestamp: new Date().getTime()
                    };
                    localStorage.setItem('privacyConsent', JSON.stringify(consentData));
                    try {
                        // Google Consent Mode v2 - deny consent
                        window.dataLayer = window.dataLayer || [];
                        function gtag(){dataLayer.push(arguments);} // eslint-disable-line no-inner-declarations
                        gtag('consent','update',{
                            'ad_storage': 'denied',
                            'analytics_storage': 'denied',
                            'ad_user_data': 'denied',
                            'ad_personalization': 'denied'
                        });
                    } catch(e) { /* noop */ }
                    
                    // Show reconsideration message
                    container.innerHTML = `
                        <div style="padding: 40px 20px; text-align: center; height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; background: var(--bg-primary); color: var(--text-primary);">
                            <h3 style="color: var(--primary-color); margin-bottom: 1rem;">Privacy Preferences Saved</h3>
                            <p style="margin-bottom: 2rem; line-height: 1.6; max-width: 400px;">
                                You have chosen to reject all data processing. If you change your mind, you can refresh this page to reconsider our privacy policy.
                            </p>
                            <button onclick="window.location.reload()" style="padding: 12px 24px; background-color: var(--primary-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 1rem;">Refresh Page</button>
                        </div>
                    `;
                });
            }
        }, 100);
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