/**
 * ApiClient.js - Handles communication with the FastAPI backend
 * Manages API calls for saving, loading, and syncing game data
 */

class ApiClient {
    constructor() {
        this.baseUrl = '/api';
        this.timeout = 10000; // 10 second timeout
        this.retryAttempts = 3;
        this.retryDelay = 1000; // 1 second
    }
    
    // Generic API request method
    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            timeout: this.timeout,
            ...options
        };
        
        // Add timeout support
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        defaultOptions.signal = controller.signal;
        
        try {
            const response = await fetch(url, defaultOptions);
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            } else {
                return await response.text();
            }
        } catch (error) {
            clearTimeout(timeoutId);
            
            if (error.name === 'AbortError') {
                throw new Error('Request timeout');
            }
            
            throw error;
        }
    }
    
    // Retry mechanism for failed requests
    async requestWithRetry(endpoint, options = {}) {
        let lastError;
        
        for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
            try {
                return await this.request(endpoint, options);
            } catch (error) {
                lastError = error;
                console.warn(`API request attempt ${attempt} failed:`, error.message);
                
                if (attempt < this.retryAttempts) {
                    await this.delay(this.retryDelay * attempt); // Exponential backoff
                }
            }
        }
        
        throw new Error(`API request failed after ${this.retryAttempts} attempts: ${lastError.message}`);
    }
    
    // Utility method for delays
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    // Game save/load endpoints
    async saveGame(gameData, playerId = null) {
        try {
            const payload = {
                gameData,
                playerId,
                timestamp: Date.now(),
                version: '1.0.0'
            };
            
            const response = await this.requestWithRetry('/game/save', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            
            console.log('Game saved to server');
            return response;
        } catch (error) {
            console.error('Failed to save game to server:', error);
            throw error;
        }
    }
    
    async loadGame(playerId = null) {
        try {
            const endpoint = playerId ? `/game/load/${playerId}` : '/game/load';
            const response = await this.requestWithRetry(endpoint);
            
            console.log('Game loaded from server');
            return response;
        } catch (error) {
            console.error('Failed to load game from server:', error);
            throw error;
        }
    }
    
    // Player management
    async createPlayer(playerName, email = null) {
        try {
            const payload = {
                name: playerName,
                email,
                createdAt: Date.now()
            };
            
            const response = await this.requestWithRetry('/player/create', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            
            console.log('Player created:', response);
            return response;
        } catch (error) {
            console.error('Failed to create player:', error);
            throw error;
        }
    }
    
    async getPlayer(playerId) {
        try {
            const response = await this.requestWithRetry(`/player/${playerId}`);
            return response;
        } catch (error) {
            console.error('Failed to get player:', error);
            throw error;
        }
    }
    
    // Leaderboard and statistics
    async getLeaderboard(type = 'totalGold', limit = 100) {
        try {
            const response = await this.requestWithRetry(`/leaderboard/${type}?limit=${limit}`);
            return response;
        } catch (error) {
            console.error('Failed to get leaderboard:', error);
            throw error;
        }
    }
    
    async submitScore(playerId, scoreData) {
        try {
            const payload = {
                playerId,
                ...scoreData,
                timestamp: Date.now()
            };
            
            const response = await this.requestWithRetry('/leaderboard/submit', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            
            return response;
        } catch (error) {
            console.error('Failed to submit score:', error);
            throw error;
        }
    }
    
    // Game analytics (optional)
    async trackEvent(eventType, eventData, playerId = null) {
        try {
            const payload = {
                eventType,
                eventData,
                playerId,
                timestamp: Date.now()
            };
            
            // Don't retry analytics events - they're not critical
            const response = await this.request('/analytics/track', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            
            return response;
        } catch (error) {
            // Silently fail analytics - don't disrupt gameplay
            console.warn('Analytics tracking failed:', error);
            return null;
        }
    }
    
    // Sync check - verify server connection
    async ping() {
        try {
            const startTime = Date.now();
            await this.request('/ping');
            const endTime = Date.now();
            
            return {
                success: true,
                latency: endTime - startTime,
                timestamp: Date.now()
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                timestamp: Date.now()
            };
        }
    }
    
    // Server status and health
    async getServerStatus() {
        try {
            const response = await this.request('/status');
            return response;
        } catch (error) {
            console.error('Failed to get server status:', error);
            throw error;
        }
    }
    
    // Conflict resolution for simultaneous saves
    async resolveConflict(localData, serverData, resolution = 'merge') {
        try {
            const payload = {
                localData,
                serverData,
                resolution,
                timestamp: Date.now()
            };
            
            const response = await this.requestWithRetry('/game/resolve-conflict', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            
            console.log('Conflict resolved');
            return response;
        } catch (error) {
            console.error('Failed to resolve conflict:', error);
            throw error;
        }
    }
    
    // Batch operations for efficiency
    async batchRequest(requests) {
        try {
            const payload = {
                requests,
                timestamp: Date.now()
            };
            
            const response = await this.requestWithRetry('/batch', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            
            return response;
        } catch (error) {
            console.error('Batch request failed:', error);
            throw error;
        }
    }
}

// Export for use in other modules
window.ApiClient = ApiClient;