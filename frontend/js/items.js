class CompliantAdSystem {
    constructor() {
        this.containers = [];
        this.colorInterval = null;
        this.durationTimeout = null;
        this.isActive = false;
        
        this.config = {
            colorChangeRate: 5000, // 5 seconds between color changes
            displayDuration: 20000, // 20 seconds total display
            maxContainers: 3
        };
        
        this.colorPalette = [
            '#FFD6E7', // Soft pink
            '#D4F0FF', // Light blue
            '#FFF5D6', // Pale yellow
            '#E2FFDB', // Mint green
            '#F0E6FF', // Lavender
            '#FFE8D9'  // Peach
        ];
        
        this.placements = [
            { insertAfter: '.c-quiz-header' },
            { insertAfter: '.c-question-container' },
            { insertAfter: '.c-answers-container' }
        ];
    }

    activate() {
        if (this.isActive) return;
        
        this.isActive = true;
        this.createContainers();
        this.startColorRotation();
        
        this.durationTimeout = setTimeout(() => {
            this.deactivate();
        }, this.config.displayDuration);
    }

    createContainers() {
        this.placements.forEach(placement => {
            const targetElement = document.querySelector(placement.insertAfter);
            if (!targetElement) return;

            const container = document.createElement('div');
            container.className = 'color-container';
            container.style.cssText = `
                margin: 20px 0;
                padding: 15px;
                border-radius: 8px;
                min-height: 100px;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: background-color 0.5s ease;
            `;

            // Set initial random color
            container.style.backgroundColor = this.getRandomColor();
            
            targetElement.parentNode.insertBefore(container, targetElement.nextSibling);
            this.containers.push(container);
        });
    }

    startColorRotation() {
        this.colorInterval = setInterval(() => {
            this.changeColors();
        }, this.config.colorChangeRate);
    }

    changeColors() {
        this.containers.forEach(container => {
            container.style.backgroundColor = this.getRandomColor();
        });
    }

    getRandomColor() {
        return this.colorPalette[Math.floor(Math.random() * this.colorPalette.length)];
    }

    deactivate() {
        if (!this.isActive) return;
        
        this.isActive = false;
        
        if (this.colorInterval) {
            clearInterval(this.colorInterval);
            this.colorInterval = null;
        }
        
        if (this.durationTimeout) {
            clearTimeout(this.durationTimeout);
            this.durationTimeout = null;
        }
        
        this.containers.forEach(container => {
            if (container && container.parentNode) {
                container.parentNode.removeChild(container);
            }
        });
        
        this.containers = [];
    }
}

// Initialize the system
window.CompliantAdSystem = CompliantAdSystem;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.colorSystem = new CompliantAdSystem();
    });
} else {
    window.colorSystem = new CompliantAdSystem();
}

// Expose activation method
window.activateColorBars = function() {
    if (window.colorSystem) {
        window.colorSystem.activate();
    }
};