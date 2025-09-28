// Enhanced solar sonar effect - now integrated with theme system
document.addEventListener('DOMContentLoaded', function() {
    const servoBtn = document.getElementById('servoTestBtn');
    const body = document.body;
    
    // Available pulse color themes (for visual variety)
    const pulseThemes = [
        { name: 'blue', color: '#4a86e8', glow: 'rgba(74, 134, 232, 0.7)' },
        { name: 'orange', color: '#ff8c00', glow: 'rgba(255, 140, 0, 0.7)' },
    { name: 'green', color: '#2e7d32', glow: 'rgba(46, 125, 50, 0.7)' },
        { name: 'purple', color: '#9c27b0', glow: 'rgba(156, 39, 176, 0.7)' },
        { name: 'red', color: '#f44336', glow: 'rgba(244, 67, 54, 0.7)' },
        { name: 'cyan', color: '#00bcd4', glow: 'rgba(0, 188, 212, 0.7)' }
    ];
    
    let currentPulseTheme = pulseThemes[0];
    let isAnimating = false;
    
    // Initialize with a random pulse theme
    const initialIndex = Math.floor(Math.random() * pulseThemes.length);
    currentPulseTheme = pulseThemes[initialIndex];
    updatePulseColors();
    
    // Listen for theme manager events
    window.addEventListener('themeChanged', function() {
        // Create sonar effect when theme changes
        if (servoBtn) {
            createSonarSweep();
            cyclePulseTheme();
        }
    });
    
    function cyclePulseTheme() {
        // Cycle to next pulse theme for visual variety
        const currentIndex = pulseThemes.findIndex(theme => theme.name === currentPulseTheme.name);
        const nextIndex = (currentIndex + 1) % pulseThemes.length;
        currentPulseTheme = pulseThemes[nextIndex];
        updatePulseColors();
    }
    
    function updatePulseColors() {
        const root = document.documentElement;
        root.style.setProperty('--pulse-color', currentPulseTheme.color);
        root.style.setProperty('--pulse-glow', currentPulseTheme.glow);
    }
    
    function createSonarSweep() {
        // Create the sonar element
        const sonar = document.createElement('div');
        sonar.className = 'sonar-sweep';
        
        // Position at center of button
        const rect = servoBtn.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        sonar.style.left = centerX + 'px';
        sonar.style.top = centerY + 'px';
        
        // Add to document
        document.body.appendChild(sonar);
        
        // Animate the sonar
        sonar.style.animation = 'solarSonar 2s linear';
        
        // Create additional visual effects
        createPulseRing(centerX, centerY);
        createParticles(centerX, centerY);
        
        // Remove after animation completes
        setTimeout(() => {
            if (document.body.contains(sonar)) {
                document.body.removeChild(sonar);
            }
        }, 2000);
    }
    
    function createPulseRing(centerX, centerY) {
        const ring = document.createElement('div');
        ring.style.position = 'fixed';
        ring.style.left = centerX + 'px';
        ring.style.top = centerY + 'px';
        ring.style.width = '0';
        ring.style.height = '0';
        ring.style.borderRadius = '50%';
        ring.style.transform = 'translate(-50%, -50%)';
        ring.style.boxShadow = '0 0 0 0 var(--pulse-glow)';
        ring.style.zIndex = '9997';
        ring.style.pointerEvents = 'none';
        
        document.body.appendChild(ring);
        
        // Animate the ring
        setTimeout(() => {
            ring.style.transition = 'all 2s ease-out';
            ring.style.width = '1000px';
            ring.style.height = '1000px';
            ring.style.boxShadow = '0 0 30px 10px var(--pulse-glow)';
            ring.style.opacity = '0';
        }, 10);
        
        // Remove after animation completes
        setTimeout(() => {
            if (document.body.contains(ring)) {
                document.body.removeChild(ring);
            }
        }, 2000);
    }
    
    function createParticles(centerX, centerY) {
        const particles = 30;
        
        for (let i = 0; i < particles; i++) {
            setTimeout(() => {
                const particle = document.createElement('div');
                particle.style.position = 'fixed';
                particle.style.left = centerX + 'px';
                particle.style.top = centerY + 'px';
                particle.style.width = '4px';
                particle.style.height = '4px';
                particle.style.backgroundColor = 'var(--pulse-color)';
                particle.style.borderRadius = '50%';
                particle.style.zIndex = '9999';
                particle.style.pointerEvents = 'none';
                
                document.body.appendChild(particle);
                
                // Random direction
                const angle = Math.random() * Math.PI * 2;
                const distance = 50 + Math.random() * 150;
                const duration = 800 + Math.random() * 700;
                
                // Animate particle
                setTimeout(() => {
                    particle.style.transition = `all ${duration}ms ease-out`;
                    particle.style.transform = `translate(${Math.cos(angle) * distance}px, ${Math.sin(angle) * distance}px)`;
                    particle.style.opacity = '0';
                }, 10);
                
                // Remove after animation completes
                setTimeout(() => {
                    if (document.body.contains(particle)) {
                        document.body.removeChild(particle);
                    }
                }, duration);
            }, i * 50);
        }
    }
});