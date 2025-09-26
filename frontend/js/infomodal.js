// Complete rewrite - Quiz The Spire Info Button
(function() {
    'use strict';
    
    // Remove any existing elements
    const cleanup = () => {
        ['infoBtn', 'infoModal', 'infoButtonStyles'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.remove();
        });
    };
    
    const createInfoSystem = () => {
        cleanup();
        
        // Inject styles
        const css = `
            #infoBtn {
                position: absolute;
                top: 16px;
                right: 25px;
                width: 42px;
                height: 42px;
                background: #007bff;
                color: white;
                border: none;
                border-radius: 50%;
                font-size: 18px;
                cursor: pointer;
                z-index: 999999;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 2px 10px rgba(0,123,255,0.3);
                transition: all 0.2s ease;
                font-family: system-ui, -apple-system, sans-serif;
            }
            
            #infoBtn:hover {
                background: #0056b3;
                transform: scale(1.05);
                box-shadow: 0 4px 15px rgba(0,123,255,0.4);
            }
            
            #infoModal {
                display: none;
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.7);
                z-index: 1000000;
                overflow-y: auto;
            }
            
            .modal-content {
                background: white;
                max-width: 1050px;
                margin: 50px auto;
                padding: 30px;
                border-radius: 12px;
                position: relative;
                box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                font-family: system-ui, -apple-system, sans-serif;
            }
            
            .close-btn {
                position: absolute;
                top: 15px;
                right: 15px;
                width: 35px;
                height: 35px;
                background: #f8f9fa;
                border: 1px solid #dee2e6;
                border-radius: 6px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 18px;
                color: #6c757d;
                transition: all 0.2s ease;
            }
            
            .close-btn:hover {
                background: #e9ecef;
                color: #495057;
                border-color: #adb5bd;
            }
            
            .modal-title {
                margin: 0 0 25px 0;
                font-size: 28px;
                color: #2c3e50;
                font-weight: 600;
            }
            
            .info-section {
                margin-bottom: 25px;
            }
            
            .section-title {
                font-size: 20px;
                color: #34495e;
                margin: 0 0 12px 0;
                font-weight: 600;
                border-bottom: 2px solid #e9ecef;
                padding-bottom: 5px;
            }
            
            .info-section p {
                margin: 0 0 12px 0;
                line-height: 1.6;
                color: #555;
            }
            
            .info-list {
                margin: 0;
                padding-left: 20px;
            }
            
            .info-list li {
                margin-bottom: 8px;
                line-height: 1.5;
                color: #555;
            }
            
            .info-list strong {
                color: #2c3e50;
            }
            
            @media (max-width: 768px) {
                #infoBtn {
                    top: 16px;
                    right: 15px;
                    width: 38px;
                    height: 38px;
                    font-size: 16px;
                }
                
                .modal-content {
                    margin: 30px 15px;
                    padding: 25px;
                }
                
                .modal-title {
                    font-size: 24px;
                }
                
                .close-btn {
                    width: 32px;
                    height: 32px;
                    font-size: 16px;
                }
            }
            
            @media (max-width: 480px) {
                #infoBtn {
                    top: 16px;
                    right: 10px;
                    width: 35px;
                    height: 35px;
                    font-size: 15px;
                }
                
                .modal-content {
                    margin: 20px 10px;
                    padding: 20px;
                }
                
                .modal-title {
                    font-size: 22px;
                    margin-bottom: 20px;
                }
                
                .section-title {
                    font-size: 18px;
                }
                
                .close-btn {
                    top: 12px;
                    right: 12px;
                    width: 30px;
                    height: 30px;
                    font-size: 15px;
                }
            }
        `;
        
        const style = document.createElement('style');
        style.id = 'infoButtonStyles';
        style.textContent = css;
        document.head.appendChild(style);
        
        // Create button
        const btn = document.createElement('button');
        btn.id = 'infoBtn';
        btn.innerHTML = 'ℹ';
        btn.type = 'button';
        
        // Create modal
        const modal = document.createElement('div');
        modal.id = 'infoModal';
        
        const content = document.createElement('div');
        content.className = 'modal-content';
        
        content.innerHTML = `
            <button class="close-btn" type="button">×</button>
            <h2 class="modal-title">Welcome to Quiz The Spire</h2>
            
            <div class="info-section">
                <h3 class="section-title">How to Play</h3>
                <p>Join a quiz session either locally using a SNES controller or online via this website. Answer questions correctly to earn points and items!</p>
            </div>
            
            <div class="info-section">
                <h3 class="section-title">Items</h3>
                <ul class="info-list">
                    <li><strong>Freeze:</strong> Lowers temperature by 15°C, slowing timer</li>
                    <li><strong>Fireball:</strong> Raises temperature by 15°C, speeding timer</li>
                    <li><strong>Answer Remove:</strong> Removes one wrong answer</li>
                </ul>
            </div>
            
            <div class="info-section">
                <h3 class="section-title">Sensor Effects</h3>
                <p>The game adapts based on your environment:</p>
                <ul class="info-list">
                    <li>Higher temperature = faster timer</li>
                    <li>Lower light = easier questions</li>
                </ul>
            </div>
            
            <div class="info-section">
                <h3 class="section-title">Terms of Service</h3>
                <p>By using Quiz The Spire, you agree to the following terms:</p>
                <ul class="info-list">
                    <li>You will not attempt to cheat or manipulate the game system</li>
                    <li>You are responsible for maintaining the confidentiality of your account</li>
                    <li>We reserve the right to modify or terminate the service at any time</li>
                    <li>All user data will be handled in accordance with our privacy policy</li>
                    <li>You must be at least 13 years old to use this service</li>
                </ul>
            </div>
        `;
        
        modal.appendChild(content);
        
        // Add to page
        document.body.appendChild(btn);
        document.body.appendChild(modal);
        
        // Event handlers
        const openModal = () => {
            modal.style.display = 'block';
            document.body.style.overflow = 'hidden';
        };
        
        const closeModal = () => {
            modal.style.display = 'none';
            document.body.style.overflow = '';
        };
        
        btn.addEventListener('click', openModal);
        content.querySelector('.close-btn').addEventListener('click', closeModal);
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.style.display === 'block') {
                closeModal();
            }
        });
        
        console.log('Info button created successfully at top: 16px');
    };
    
    // Initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createInfoSystem);
    } else {
        createInfoSystem();
    }
    
})();