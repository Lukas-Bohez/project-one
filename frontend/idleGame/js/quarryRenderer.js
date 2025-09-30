// =============================================================================
// KINGDOM QUARRY - QUARRY RENDERER (Canvas Graphics)
// =============================================================================

class QuarryRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.quality = 'medium';
        this.animationTime = 0;
        
        this.setupCanvas();
        this.initializeAssets();
    }
    
    setupCanvas() {
        // Setup canvas for crisp pixel art
        this.ctx.imageSmoothingEnabled = false;
        this.ctx.webkitImageSmoothingEnabled = false;
        this.ctx.mozImageSmoothingEnabled = false;
        this.ctx.msImageSmoothingEnabled = false;
    }
    
    initializeAssets() {
        // Create pixel art assets programmatically
        this.assets = {
            stone: this.createStoneSprite(),
            worker: this.createWorkerSprite(),
            cart: this.createCartSprite(),
            background: this.createBackgroundPattern()
        };
    }
    
    render(gameState) {
        this.animationTime += 16; // ~60fps
        
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw background
        this.drawBackground();
        
        // Draw quarry elements
        this.drawQuarry(gameState);
        
        // Draw workers
        this.drawWorkers(gameState);
        
        // Draw transport
        this.drawTransport(gameState);
        
        // Draw effects
        this.drawEffects(gameState);
    }
    
    drawBackground() {
        // Draw medieval stone pattern
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        gradient.addColorStop(0, '#A0522D');
        gradient.addColorStop(0.5, '#8B4513');
        gradient.addColorStop(1, '#654321');
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Add stone texture
        this.drawStoneTexture();
    }
    
    drawStoneTexture() {
        this.ctx.save();
        this.ctx.globalAlpha = 0.3;
        
        for (let i = 0; i < 20; i++) {
            const x = Math.random() * this.canvas.width;
            const y = Math.random() * this.canvas.height;
            const size = 5 + Math.random() * 10;
            
            this.ctx.fillStyle = '#666';
            this.ctx.fillRect(x, y, size, size);
        }
        
        this.ctx.restore();
    }
    
    drawQuarry(gameState) {
        // Draw quarry pit
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const radius = 150;
        
        // Draw pit shadow
        this.ctx.save();
        this.ctx.globalAlpha = 0.5;
        this.ctx.fillStyle = '#000';
        this.ctx.beginPath();
        this.ctx.ellipse(centerX + 5, centerY + 5, radius, radius * 0.6, 0, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
        
        // Draw pit
        this.ctx.fillStyle = '#4A4A4A';
        this.ctx.beginPath();
        this.ctx.ellipse(centerX, centerY, radius, radius * 0.6, 0, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Draw stone deposits
        this.drawStoneDeposits(centerX, centerY, radius);
    }
    
    drawStoneDeposits(centerX, centerY, radius) {
        const stoneCount = 8;
        for (let i = 0; i < stoneCount; i++) {
            const angle = (i / stoneCount) * Math.PI * 2;
            const distance = radius * 0.3 + Math.sin(this.animationTime / 1000 + i) * 10;
            const x = centerX + Math.cos(angle) * distance;
            const y = centerY + Math.sin(angle) * distance * 0.6;
            
            this.drawStone(x, y, 8 + Math.sin(this.animationTime / 500 + i) * 2);
        }
    }
    
    drawWorkers(gameState) {
        const totalWorkers = Object.values(gameState.characters).reduce((sum, char) => sum + char.count, 0);
        const maxDisplay = Math.min(totalWorkers, 10); // Don't show more than 10 workers
        
        for (let i = 0; i < maxDisplay; i++) {
            const angle = (i / maxDisplay) * Math.PI * 2;
            const distance = 200;
            const x = this.canvas.width / 2 + Math.cos(angle) * distance;
            const y = this.canvas.height / 2 + Math.sin(angle) * distance * 0.6;
            
            this.drawWorker(x, y, this.animationTime / 1000 + i);
        }
    }
    
    drawTransport(gameState) {
        // Draw transport vehicles if unlocked
        const transport = gameState.transport;
        let vehicleCount = 0;
        
        for (const [type, data] of Object.entries(transport)) {
            if (data.level > 0) {
                vehicleCount += data.level;
            }
        }
        
        // Draw vehicles around the quarry
        const maxVehicles = Math.min(vehicleCount, 5);
        for (let i = 0; i < maxVehicles; i++) {
            const angle = (i / maxVehicles) * Math.PI * 2 + this.animationTime / 5000;
            const distance = 250;
            const x = this.canvas.width / 2 + Math.cos(angle) * distance;
            const y = this.canvas.height / 2 + Math.sin(angle) * distance * 0.6;
            
            this.drawCart(x, y);
        }
    }
    
    drawEffects(gameState) {
        // Draw floating particles for active production
        const stonePerSecond = this.calculateProductionRate(gameState);
        const particleCount = Math.min(stonePerSecond / 5, 20);
        
        for (let i = 0; i < particleCount; i++) {
            const x = this.canvas.width / 2 + (Math.random() - 0.5) * 300;
            const y = this.canvas.height / 2 + (Math.random() - 0.5) * 200;
            const life = (this.animationTime / 50 + i * 100) % 100;
            
            this.drawParticle(x, y - life, Math.max(0, 1 - life / 100));
        }
    }
    
    // Sprite creation methods
    createStoneSprite() {
        const canvas = document.createElement('canvas');
        canvas.width = 16;
        canvas.height = 16;
        const ctx = canvas.getContext('2d');
        
        // Draw simple stone sprite
        ctx.fillStyle = '#696969';
        ctx.fillRect(2, 6, 12, 8);
        ctx.fillStyle = '#808080';
        ctx.fillRect(4, 4, 8, 6);
        ctx.fillStyle = '#555';
        ctx.fillRect(3, 7, 2, 2);
        ctx.fillRect(8, 5, 2, 2);
        
        return canvas;
    }
    
    createWorkerSprite() {
        const canvas = document.createElement('canvas');
        canvas.width = 16;
        canvas.height = 16;
        const ctx = canvas.getContext('2d');
        
        // Draw simple worker sprite
        ctx.fillStyle = '#F5DEB3'; // Head
        ctx.fillRect(6, 2, 4, 4);
        ctx.fillStyle = '#8B4513'; // Body
        ctx.fillRect(5, 6, 6, 6);
        ctx.fillStyle = '#654321'; // Arms
        ctx.fillRect(3, 7, 2, 3);
        ctx.fillRect(11, 7, 2, 3);
        ctx.fillStyle = '#4A4A4A'; // Legs
        ctx.fillRect(6, 12, 2, 3);
        ctx.fillRect(8, 12, 2, 3);
        
        return canvas;
    }
    
    createCartSprite() {
        const canvas = document.createElement('canvas');
        canvas.width = 24;
        canvas.height = 16;
        const ctx = canvas.getContext('2d');
        
        // Draw simple cart sprite
        ctx.fillStyle = '#8B4513'; // Cart body
        ctx.fillRect(4, 6, 16, 6);
        ctx.fillStyle = '#654321'; // Cart details
        ctx.fillRect(6, 4, 12, 2);
        ctx.fillStyle = '#4A4A4A'; // Wheels
        ctx.beginPath();
        ctx.arc(8, 14, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(16, 14, 3, 0, Math.PI * 2);
        ctx.fill();
        
        return canvas;
    }
    
    createBackgroundPattern() {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');
        
        // Create a stone brick pattern
        ctx.fillStyle = '#A0522D';
        ctx.fillRect(0, 0, 32, 32);
        
        // Add brick lines
        ctx.strokeStyle = '#654321';
        ctx.lineWidth = 1;
        
        // Horizontal lines
        ctx.beginPath();
        ctx.moveTo(0, 8);
        ctx.lineTo(32, 8);
        ctx.moveTo(0, 24);
        ctx.lineTo(32, 24);
        ctx.stroke();
        
        // Vertical lines (offset pattern)
        ctx.beginPath();
        ctx.moveTo(8, 0);
        ctx.lineTo(8, 8);
        ctx.moveTo(24, 0);
        ctx.lineTo(24, 8);
        ctx.moveTo(16, 8);
        ctx.lineTo(16, 24);
        ctx.moveTo(8, 24);
        ctx.lineTo(8, 32);
        ctx.moveTo(24, 24);
        ctx.lineTo(24, 32);
        ctx.stroke();
        
        // Add some texture
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        for (let i = 0; i < 10; i++) {
            const x = Math.random() * 32;
            const y = Math.random() * 32;
            ctx.fillRect(x, y, 1, 1);
        }
        
        return canvas;
    }
    
    // Drawing helper methods
    drawStone(x, y, size) {
        this.ctx.save();
        this.ctx.fillStyle = '#696969';
        this.ctx.fillRect(x - size/2, y - size/2, size, size);
        this.ctx.fillStyle = '#808080';
        this.ctx.fillRect(x - size/2 + 1, y - size/2 + 1, size - 2, size - 2);
        this.ctx.restore();
    }
    
    drawWorker(x, y, animOffset) {
        this.ctx.save();
        this.ctx.translate(x, y);
        
        // Simple animated worker
        const bobOffset = Math.sin(animOffset * 3) * 2;
        this.ctx.translate(0, bobOffset);
        
        // Head
        this.ctx.fillStyle = '#F5DEB3';
        this.ctx.fillRect(-2, -6, 4, 4);
        
        // Body
        this.ctx.fillStyle = '#8B4513';
        this.ctx.fillRect(-3, -2, 6, 6);
        
        // Tool (pickaxe)
        this.ctx.strokeStyle = '#654321';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(3, -1);
        this.ctx.lineTo(6, -4);
        this.ctx.stroke();
        
        this.ctx.restore();
    }
    
    drawCart(x, y) {
        this.ctx.save();
        this.ctx.translate(x, y);
        
        // Simple cart
        this.ctx.fillStyle = '#8B4513';
        this.ctx.fillRect(-8, -4, 16, 6);
        this.ctx.fillStyle = '#4A4A4A';
        this.ctx.beginPath();
        this.ctx.arc(-5, 4, 2, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.arc(5, 4, 2, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.restore();
    }
    
    drawParticle(x, y, alpha) {
        this.ctx.save();
        this.ctx.globalAlpha = alpha;
        this.ctx.fillStyle = '#DAA520';
        this.ctx.beginPath();
        this.ctx.arc(x, y, 2, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
    }
    
    calculateProductionRate(gameState) {
        let total = 0;
        for (const [type, data] of Object.entries(gameState.characters)) {
            if (data.count > 0 && GAME_CONFIG.characters[type]) {
                total += GAME_CONFIG.characters[type].baseProduction.stone * data.count;
            }
        }
        return total;
    }
    
    updateQuality(quality) {
        this.quality = quality;
        // Adjust rendering quality based on setting
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = QuarryRenderer;
}