// Enhanced solar sonar effect with balanced theme cycling
document.addEventListener('DOMContentLoaded', function() {
    const servoBtn = document.getElementById('servoTestBtn');
    const body = document.body;
    const themes = [
        'theme-blue', 
        'theme-orange', 
        'theme-green', 
        'theme-purple',
        'theme-red',
        'theme-cyan',
        'theme-banana-yellow',
        'theme-blueberry-blue',
        'theme-orange-orange',
        'theme-strawberry-red',
        'theme-kiwi-green',
        'theme-grape-purple'
    ];
    
    let availableThemes = [...themes]; // Clone of themes array
    let currentTheme = null;
    let isAnimating = false;
    
    // Initialize with a random theme
    const initialThemeIndex = Math.floor(Math.random() * themes.length);
    currentTheme = themes[initialThemeIndex];
    body.classList.add(currentTheme);
    // Remove the initial theme from available themes
    availableThemes = availableThemes.filter(theme => theme !== currentTheme);
    
    servoBtn.addEventListener('click', function() {
        if (isAnimating) return;
        isAnimating = true;
        
        // Create sonar sweep effect
        createSonarSweep();
        
        // Cycle through themes after a short delay
        setTimeout(() => {
            // Remove current theme
            if (currentTheme) {
                body.classList.remove(currentTheme);
            }
            
            // If no themes left, reset the available themes
            if (availableThemes.length === 0) {
                availableThemes = [...themes];
            }
            
            // Select a random theme from available ones
            const randomIndex = Math.floor(Math.random() * availableThemes.length);
            currentTheme = availableThemes[randomIndex];
            
            // Remove the selected theme from available themes
            availableThemes = availableThemes.filter(theme => theme !== currentTheme);
            
            // Apply the new theme
            body.classList.add(currentTheme);
            isAnimating = false;
        }, 1800);
    });
    
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