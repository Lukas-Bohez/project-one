/**
 * Compact Audit Logs Manager
 * Optimized for narrow, tall containers with vertical layout
 * CRASH-RESISTANT VERSION - Never fails on malformed data
 */

class AuditLogsManager {
  constructor(options = {}) {
    // Configuration
    this.baseUrl = options.baseUrl || `https://${window.location.hostname}`;
    this.apiEndpoint = options.apiEndpoint || '/api/v1/audit-logs/';
    this.containerSelector = options.containerSelector || '.js-auditlog';
    this.updateInterval = options.updateInterval || 30000; // 30 seconds
    this.maxRetries = options.maxRetries || 3;
    this.baseRetryDelay = options.baseRetryDelay || 1000; // 1 second
    this.requestTimeout = options.requestTimeout || 10000; // 10 seconds
    
    // State management
    this.isUpdateRunning = false;
    this.retryCount = 0;
    this.updateIntervalId = null;
    this.containerElement = null;
    this.abortController = null;
    
    // Bind methods to preserve context
    this.update = this.update.bind(this);
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    
    // Initialize styles and component
    this.injectStyles();
    this.init();
  }

  /**
   * Safe property access with fallback values
   */
  safeGet(obj, path, fallback = null) {
    try {
      if (!obj || typeof obj !== 'object') return fallback;
      
      const keys = Array.isArray(path) ? path : path.split('.');
      let result = obj;
      
      for (const key of keys) {
        if (result === null || result === undefined || typeof result !== 'object') {
          return fallback;
        }
        result = result[key];
      }
      
      return result !== undefined ? result : fallback;
    } catch (error) {
      console.warn('SafeGet error:', error, 'for path:', path);
      return fallback;
    }
  }

  /**
   * Validate and sanitize log object
   */
  sanitizeLog(log) {
    try {
      if (!log || typeof log !== 'object') {
        return {
          id: 'unknown',
          action: 'unknown',
          table_name: 'unknown',
          record_id: null,
          changed_by: 'system',
          ip_address: null,
          old_values: {},
          new_values: { timestamp: new Date().toISOString() },
          _sanitized: true,
          _original_invalid: true
        };
      }

      // Create a safe copy with fallbacks
      const sanitized = {
        id: this.safeGet(log, 'id', 'unknown'),
        action: this.safeGet(log, 'action', 'unknown'),
        table_name: this.safeGet(log, 'table_name', 'unknown'),
        record_id: this.safeGet(log, 'record_id', null),
        changed_by: this.safeGet(log, 'changed_by', 'system'),
        ip_address: this.safeGet(log, 'ip_address', null),
        old_values: {},
        new_values: {},
        _sanitized: true
      };

      // Safely handle old_values
      try {
        const oldValues = this.safeGet(log, 'old_values', {});
        sanitized.old_values = (oldValues && typeof oldValues === 'object') ? oldValues : {};
      } catch (error) {
        console.warn('Error sanitizing old_values:', error);
        sanitized.old_values = {};
      }

      // Safely handle new_values with timestamp fallback
      try {
        const newValues = this.safeGet(log, 'new_values', {});
        sanitized.new_values = (newValues && typeof newValues === 'object') ? newValues : {};
        
        // Ensure timestamp exists
        if (!sanitized.new_values.timestamp) {
          // Try to find timestamp in various places
          const possibleTimestamps = [
            this.safeGet(log, 'timestamp'),
            this.safeGet(log, 'created_at'),
            this.safeGet(log, 'updated_at'),
            this.safeGet(log, 'new_values.created_at'),
            this.safeGet(log, 'new_values.updated_at'),
            this.safeGet(log, 'old_values.timestamp'),
            this.safeGet(log, 'old_values.created_at'),
            new Date().toISOString() // Ultimate fallback
          ];
          
          for (const ts of possibleTimestamps) {
            if (ts) {
              sanitized.new_values.timestamp = ts;
              break;
            }
          }
        }
      } catch (error) {
        console.warn('Error sanitizing new_values:', error);
        sanitized.new_values = { timestamp: new Date().toISOString() };
      }

      return sanitized;
    } catch (error) {
      console.error('Critical error in sanitizeLog:', error);
      return {
        id: 'error',
        action: 'error',
        table_name: 'error',
        record_id: null,
        changed_by: 'system',
        ip_address: null,
        old_values: {},
        new_values: { timestamp: new Date().toISOString() },
        _sanitized: true,
        _error: error.message
      };
    }
  }

  /**
   * Inject CSS styles optimized for narrow containers
   */
  injectStyles() {
    try {
      if (document.getElementById('audit-logs-styles')) return;
      
      const styles = `
        <style id="audit-logs-styles">
          :root {
            --admin-primary: #E67E22;
            --admin-secondary: #D35400;
            --admin-accent: #F39C12;
            --admin-dark: #2C3E50;
            --admin-light: #FDF2E9;
            --admin-bg: #F8F9FA;
            --admin-card: #FFFFFF;
            --admin-success: #27AE60;
            --admin-danger: #E74C3C;
            --admin-warning: #F1C40F;
            --admin-text: #333333;
            --admin-muted: #6C757D;
          }

          .audit-logs-container {
            background: var(--admin-bg);
            border-radius: 8px;
            padding: 8px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            height: 100%;
            display: flex;
            flex-direction: column;
            min-height: 200px;
          }

          .audit-logs-header {
            display: flex;
            flex-direction: column;
            align-items: center;
            margin-bottom: 8px;
            padding-bottom: 8px;
            border-bottom: 1px solid var(--admin-light);
            text-align: center;
          }

          .audit-logs-title {
            color: var(--admin-dark);
            font-size: 0.85em;
            font-weight: 600;
            margin-bottom: 4px;
          }

          .audit-logs-status {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
            font-size: 0.7em;
            color: var(--admin-success);
          }

          .status-indicator {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: var(--admin-success);
            animation: pulse 2s infinite;
          }

          @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
          }

          .audit-logs-list {
            flex: 1;
            overflow-y: auto;
            padding-right: 2px;
          }

          .audit-log-item {
            background: var(--admin-card);
            margin-bottom: 6px;
            border-radius: 6px;
            padding: 8px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            border-left: 3px solid var(--admin-primary);
            transition: all 0.2s ease;
            position: relative;
          }

          .audit-log-item:hover {
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
            transform: translateX(2px);
          }

          .audit-log-item.sanitized {
            border-left-color: var(--admin-warning);
            background: #fffbf0;
          }

          .audit-log-item.error {
            border-left-color: var(--admin-danger);
            background: #fff5f5;
          }

          .audit-log-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 6px;
          }

          .audit-log-badge {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 10px;
            font-size: 0.6em;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.3px;
          }

          .badge-create { background: var(--admin-success); color: white; }
          .badge-update { background: var(--admin-warning); color: var(--admin-dark); }
          .badge-delete { background: var(--admin-danger); color: white; }
          .badge-login { background: var(--admin-primary); color: white; }
          .badge-logout { background: var(--admin-secondary); color: white; }
          .badge-unknown { background: var(--admin-muted); color: white; }
          .badge-error { background: var(--admin-danger); color: white; }

          .audit-log-id {
            font-size: 0.6em;
            color: var(--admin-muted);
            font-family: monospace;
          }

          .audit-log-main {
            display: flex;
            align-items: flex-start;
            gap: 8px;
          }

          .audit-log-icon {
            width: 24px;
            height: 24px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            color: white;
            flex-shrink: 0;
            background: var(--admin-primary);
          }

          .audit-log-icon.create { background: var(--admin-success); }
          .audit-log-icon.update { background: var(--admin-warning); }
          .audit-log-icon.delete { background: var(--admin-danger); }
          .audit-log-icon.login { background: var(--admin-primary); }
          .audit-log-icon.logout { background: var(--admin-secondary); }
          .audit-log-icon.unknown { background: var(--admin-muted); }
          .audit-log-icon.error { background: var(--admin-danger); }

          .audit-log-content {
            flex: 1;
            min-width: 0;
          }

          .audit-log-message {
            font-size: 0.75em;
            font-weight: 600;
            color: var(--admin-dark);
            margin-bottom: 4px;
            line-height: 1.3;
            word-break: break-word;
          }

          .audit-log-details {
            display: flex;
            flex-direction: column;
            gap: 2px;
            margin-top: 4px;
          }

          .audit-log-detail {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 0.65em;
            padding: 2px 4px;
            background: var(--admin-light);
            border-radius: 3px;
          }

          .detail-label {
            font-weight: 600;
            color: var(--admin-secondary);
            flex-shrink: 0;
          }

          .detail-value {
            color: var(--admin-text);
            text-align: right;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            max-width: 60%;
          }

          .audit-log-meta {
            display: flex;
            justify-content: center;
            margin-top: 6px;
            padding-top: 4px;
            border-top: 1px solid var(--admin-light);
            font-size: 0.6em;
            color: var(--admin-muted);
          }

          .audit-log-changes {
            margin-top: 6px;
            padding: 4px;
            background: var(--admin-light);
            border-radius: 4px;
            border-left: 2px solid var(--admin-accent);
          }

          .changes-title {
            font-weight: 600;
            color: var(--admin-dark);
            margin-bottom: 3px;
            font-size: 0.65em;
            display: flex;
            align-items: center;
            gap: 4px;
          }

          .changes-content {
            font-family: 'Courier New', monospace;
            font-size: 0.6em;
            background: white;
            padding: 4px;
            border-radius: 3px;
            border: 1px solid #ddd;
            white-space: pre-wrap;
            max-height: 60px;
            overflow-y: auto;
            word-break: break-all;
          }

          .no-logs-message {
            text-align: center;
            padding: 20px 8px;
            color: var(--admin-muted);
            font-style: italic;
            font-size: 0.75em;
          }

          .no-logs-message i {
            font-size: 1.5em;
            color: var(--admin-primary);
            margin-bottom: 8px;
            display: block;
          }

          .error-message {
            background: var(--admin-danger);
            color: white;
            padding: 8px;
            border-radius: 6px;
            margin-bottom: 8px;
            display: flex;
            align-items: flex-start;
            gap: 6px;
            font-size: 0.7em;
          }

          .error-message i {
            flex-shrink: 0;
            margin-top: 1px;
          }

          .loading-spinner {
            display: inline-block;
            width: 10px;
            height: 10px;
            border: 1px solid var(--admin-light);
            border-radius: 50%;
            border-top-color: var(--admin-primary);
            animation: spin 1s ease-in-out infinite;
          }

          @keyframes spin {
            to { transform: rotate(360deg); }
          }

          .sanitization-notice {
            background: var(--admin-warning);
            color: var(--admin-dark);
            padding: 2px 4px;
            border-radius: 3px;
            font-size: 0.5em;
            margin-left: 4px;
          }

          /* Custom scrollbar for narrow container */
          .audit-logs-list::-webkit-scrollbar {
            width: 4px;
          }

          .audit-logs-list::-webkit-scrollbar-track {
            background: var(--admin-light);
            border-radius: 2px;
          }

          .audit-logs-list::-webkit-scrollbar-thumb {
            background: var(--admin-primary);
            border-radius: 2px;
          }

          .audit-logs-list::-webkit-scrollbar-thumb:hover {
            background: var(--admin-secondary);
          }

          /* Compact mode for very narrow containers */
          @media (max-width: 150px) {
            .audit-log-details {
              display: none;
            }
            
            .audit-log-header {
              flex-direction: column;
              align-items: flex-start;
              gap: 2px;
            }
            
            .audit-log-main {
              gap: 4px;
            }
            
            .audit-log-icon {
              width: 20px;
              height: 20px;
              font-size: 8px;
            }
            
            .audit-log-message {
              font-size: 0.7em;
            }
          }
        </style>
      `;
      
      document.head.insertAdjacentHTML('beforeend', styles);
    } catch (error) {
      console.error('Error injecting styles:', error);
    }
  }

  /**
   * Initialize the audit logs manager
   */
  init() {
    try {
      console.log('Initializing Compact Audit Logs Manager...');
      
      // Cache DOM element
      this.containerElement = document.querySelector(this.containerSelector);
      
      if (!this.containerElement) {
        console.warn(`Audit Logs Manager: Container element "${this.containerSelector}" not found`);
        return false;
      }
      
      // Setup container structure
      this.setupContainer();
      
      console.log('Audit Logs Manager: Container element found and configured');
      
      // Start updates if container exists
      this.start();
      
      // Add visibility change listener for better performance
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
      
      // Clean up on page unload
      window.addEventListener('beforeunload', () => this.stop());
      
      return true;
    } catch (error) {
      console.error('Error in init:', error);
      return false;
    }
  }

  /**
   * Setup the container structure
   */
  setupContainer() {
    try {
      this.containerElement.innerHTML = `
        <div class="audit-logs-container">
          <div class="audit-logs-header">
            <div class="audit-logs-title">
              Recent Activity
            </div>
            <div class="audit-logs-status">
              <div class="status-indicator"></div>
              <span>Live</span>
            </div>
          </div>
          <div class="audit-logs-list"></div>
        </div>
      `;
      
      this.logsListElement = this.containerElement.querySelector('.audit-logs-list');
    } catch (error) {
      console.error('Error setting up container:', error);
    }
  }

  /**
   * Start the update cycle
   */
  start() {
    try {
      if (!this.containerElement) {
        console.warn('Audit Logs Manager: Cannot start - no container element');
        return;
      }
      
      console.log('Audit Logs Manager: Starting update cycle');
      
      // Clear any existing interval
      this.stop();
      
      // Immediate update
      this.update();
      
      // Set up recurring updates
      this.updateIntervalId = setInterval(this.update, this.updateInterval);
    } catch (error) {
      console.error('Error starting audit logs manager:', error);
    }
  }

  /**
   * Stop the update cycle
   */
  stop() {
    try {
      if (this.updateIntervalId) {
        clearInterval(this.updateIntervalId);
        this.updateIntervalId = null;
        console.log('Audit Logs Manager: Stopped update cycle');
      }
      
      // Cancel any ongoing request
      if (this.abortController) {
        this.abortController.abort();
        this.abortController = null;
      }
    } catch (error) {
      console.error('Error stopping audit logs manager:', error);
    }
  }

  /**
   * Handle page visibility changes
   */
  handleVisibilityChange() {
    try {
      if (document.hidden) {
        this.stop();
      } else {
        this.start();
      }
    } catch (error) {
      console.error('Error handling visibility change:', error);
    }
  }

  /**
   * Fetch and update audit logs
   */
  async update() {
    if (this.isUpdateRunning) {
      console.log('Audit Logs Manager: Update already running, skipping...');
      return;
    }
    
    this.isUpdateRunning = true;
    this.showLoadingState();
    
    // Create new abort controller for this request
    this.abortController = new AbortController();
    
    try {
      console.log('Audit Logs Manager: Fetching audit logs...');
      
      const url = `${this.baseUrl}${this.apiEndpoint}?limit=15&_=${Date.now()}`;
      console.log('Audit Logs Manager: Request URL:', url);
      
      // Create timeout manually for better browser compatibility
      const timeoutId = setTimeout(() => {
        if (this.abortController) {
          this.abortController.abort();
        }
      }, this.requestTimeout);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        signal: this.abortController.signal
      });

      // Clear timeout on successful response
      clearTimeout(timeoutId);

      console.log('Audit Logs Manager: Response status:', response.status);

      if (!response.ok) {
        let errorDetail = '';
        try {
          const errorText = await response.text();
          try {
            const errorJson = JSON.parse(errorText);
            errorDetail = errorJson.detail || errorJson.message || errorText;
          } catch (parseError) {
            errorDetail = errorText;
          }
        } catch (textError) {
          errorDetail = 'Unknown error';
        }
        
        throw new Error(`HTTP ${response.status}: ${response.statusText}. ${errorDetail}`);
      }

      const rawData = await response.json();
      console.log('Audit Logs Manager: Received raw data:', rawData);

      // Ensure we have an array to work with
      let auditLogs = [];
      if (Array.isArray(rawData)) {
        auditLogs = rawData;
      } else if (rawData && typeof rawData === 'object') {
        // Maybe it's wrapped in a response object
        auditLogs = Array.isArray(rawData.data) ? rawData.data : 
                   Array.isArray(rawData.logs) ? rawData.logs : 
                   Array.isArray(rawData.results) ? rawData.results : [rawData];
      } else {
        console.warn('Unexpected data format:', rawData);
        auditLogs = [];
      }

      // Update the display
      this.renderAuditLogs(auditLogs);
      
      // Reset retry count on success
      this.retryCount = 0;
      
      // Dispatch success event
      this.dispatchEvent('auditLogsUpdated', {
        count: auditLogs.length,
        timestamp: Date.now(),
        success: true
      });

    } catch (error) {
      // Don't log errors if request was aborted
      if (error.name === 'AbortError') {
        console.log('Audit Logs Manager: Request was aborted');
        return;
      }
      
      console.error('Audit Logs Manager: Fetch error:', error);
      
      this.renderError(error.message);
      
      // Dispatch error event
      this.dispatchEvent('auditLogsError', {
        error: error.message,
        timestamp: Date.now()
      });

      // Implement retry logic
      this.handleRetry();

    } finally {
      this.isUpdateRunning = false;
      this.abortController = null;
      this.hideLoadingState();
    }
  }

  /**
   * Show loading state
   */
  showLoadingState() {
    try {
      const statusElement = this.containerElement?.querySelector('.audit-logs-status span');
      if (statusElement) {
        statusElement.innerHTML = '<span class="loading-spinner"></span>';
      }
    } catch (error) {
      console.error('Error showing loading state:', error);
    }
  }

  /**
   * Hide loading state
   */
  hideLoadingState() {
    try {
      const statusElement = this.containerElement?.querySelector('.audit-logs-status span');
      if (statusElement) {
        statusElement.textContent = 'Live';
      }
    } catch (error) {
      console.error('Error hiding loading state:', error);
    }
  }

  /**
   * Render audit logs in the container - CRASH RESISTANT
   */
  renderAuditLogs(auditLogs) {
    try {
      if (!this.logsListElement) {
        console.error('Audit Logs Manager: Cannot render - no logs list element');
        return;
      }

      // Clear existing content
      this.logsListElement.innerHTML = '';

      if (!Array.isArray(auditLogs) || auditLogs.length === 0) {
        this.logsListElement.innerHTML = `
          <div class="no-logs-message">
            <i class="fas fa-info-circle"></i>
            No recent activity
          </div>
        `;
        return;
      }

      let successCount = 0;
      let errorCount = 0;

      auditLogs.forEach((log, index) => {
        try {
          // Sanitize the log first
          const sanitizedLog = this.sanitizeLog(log);
          const logElement = this.createCompactLogElement(sanitizedLog);
          this.logsListElement.appendChild(logElement);
          successCount++;
        } catch (logError) {
          console.error(`Audit Logs Manager: Error processing log ${index}:`, logError, log);
          errorCount++;
          
          // Create error log element as fallback
          try {
            const errorLogElement = this.createErrorLogElement(index, logError);
            this.logsListElement.appendChild(errorLogElement);
          } catch (fallbackError) {
            console.error('Failed to create error log element:', fallbackError);
          }
        }
      });

      console.log(`Audit Logs Manager: Successfully rendered ${successCount} audit logs (${errorCount} errors)`);
    } catch (error) {
      console.error('Critical error in renderAuditLogs:', error);
      // Ultimate fallback
      if (this.logsListElement) {
        this.logsListElement.innerHTML = `
          <div class="error-message">
            <i class="fas fa-exclamation-triangle"></i>
            <div>Critical error rendering logs</div>
          </div>
        `;
      }
    }
  }

  /**
   * Create error log element for failed log processing
   */
  createErrorLogElement(index, error) {
    try {
      const logDiv = document.createElement('div');
      logDiv.classList.add('audit-log-item', 'error');
      
      logDiv.innerHTML = `
        <div class="audit-log-header">
          <span class="audit-log-badge badge-error">ERROR</span>
          <span class="audit-log-id">#${index}</span>
        </div>
        
        <div class="audit-log-main">
          <div class="audit-log-icon error">
            <i class="fas fa-exclamation-triangle"></i>
          </div>
          
          <div class="audit-log-content">
            <div class="audit-log-message">Failed to process log entry</div>
            
            <div class="audit-log-details">
              <div class="audit-log-detail">
                <span class="detail-label">Error:</span>
                <span class="detail-value">${this.escapeHtml(error.message || 'Unknown error')}</span>
              </div>
            </div>
          </div>
        </div>
        
        <div class="audit-log-meta">
          ${this.formatTimestamp(new Date().toISOString())}
        </div>
      `;

      return logDiv;
    } catch (error) {
      console.error('Error creating error log element:', error);
      const fallbackDiv = document.createElement('div');
      fallbackDiv.innerHTML = '<div class="error-message">Log processing failed</div>';
      return fallbackDiv;
    }
  }

  /**
   * Create a compact DOM element for a single audit log - CRASH RESISTANT
   */
  createCompactLogElement(log) {
    try {
      const logDiv = document.createElement('div');
      logDiv.classList.add('audit-log-item');
      
      // Add sanitization indicator
      if (log._sanitized) {
        logDiv.classList.add('sanitized');
      }

      const action = String(this.safeGet(log, 'action', 'unknown')).toLowerCase();
      const iconClass = this.getAuditLogIcon(action);
      const message = this.generateCompactMessage(log);
      const timestamp = this.safeGet(log, ['new_values', 'timestamp'], new Date().toISOString());
      const formattedTimestamp = this.formatTimestamp(timestamp);
      
      logDiv.innerHTML = `
        <div class="audit-log-header">
          <span class="audit-log-badge badge-${action}">${this.escapeHtml(String(this.safeGet(log, 'action', 'Unknown')))}</span>
          <span class="audit-log-id">#${this.escapeHtml(String(this.safeGet(log, 'id', 'unknown')))}${log._sanitized ? '<span class="sanitization-notice">FIXED</span>' : ''}</span>
        </div>
        
        <div class="audit-log-main">
          <div class="audit-log-icon ${action}">
            <i class="${iconClass}"></i>
          </div>
          
          <div class="audit-log-content">
            <div class="audit-log-message">${this.escapeHtml(message)}</div>
            
            <div class="audit-log-details">
              <div class="audit-log-detail">
                <span class="detail-label">Table:</span>
                <span class="detail-value">${this.escapeHtml(String(this.safeGet(log, 'table_name', 'Unknown')))}</span>
              </div>
              <div class="audit-log-detail">
                <span class="detail-label">ID:</span>
                <span class="detail-value">${this.escapeHtml(String(this.safeGet(log, 'record_id', 'N/A')))}</span>
              </div>
              <div class="audit-log-detail">
                <span class="detail-label">User:</span>
                <span class="detail-value">${this.escapeHtml(String(this.safeGet(log, 'changed_by', 'System')))}</span>
              </div>
              ${this.safeGet(log, 'ip_address') ? `
              <div class="audit-log-detail">
                <span class="detail-label">IP:</span>
                <span class="detail-value">${this.escapeHtml(String(this.safeGet(log, 'ip_address', '')))}</span>
              </div>
              ` : ''}
            </div>
            
            ${this.renderCompactChanges(log)}
          </div>
        </div>
        
        <div class="audit-log-meta">
          ${formattedTimestamp}
        </div>
      `;

      return logDiv;
    } catch (error) {
      console.error('Error creating compact log element:', error);
      // Return fallback element
      const fallbackDiv = document.createElement('div');
      fallbackDiv.classList.add('audit-log-item', 'error');
      fallbackDiv.innerHTML = `
        <div class="audit-log-header">
          <span class="audit-log-badge badge-error">ERROR</span>
          <span class="audit-log-id">#unknown</span>
        </div>
        <div class="audit-log-main">
          <div class="audit-log-icon error">
            <i class="fas fa-exclamation-triangle"></i>
          </div>
          <div class="audit-log-content">
            <div class="audit-log-message">Failed to render log entry</div>
          </div>
        </div>
        <div class="audit-log-meta">
          ${this.formatTimestamp(new Date().toISOString())}
        </div>
      `;
      return fallbackDiv;
    }
  }

  /**
   * Render compact changes section
   */
  renderCompactChanges(log) {
    try {
      const oldValues = this.safeGet(log, 'old_values', {});
      const newValues = this.safeGet(log, 'new_values', {});
      
      const hasChanges = (oldValues && typeof oldValues === 'object' && Object.keys(oldValues).length > 0) ||
                        (newValues && typeof newValues === 'object' && Object.keys(newValues).length > 0);
      
      if (!hasChanges) return '';

      const changeCount = Object.keys(newValues || {}).length + Object.keys(oldValues || {}).length;
      
      return `
        <div class="audit-log-changes">
          <div class="changes-title">
            <i class="fas fa-list"></i>
            ${changeCount} field${changeCount !== 1 ? 's' : ''} changed
          </div>
          <div class="changes-content">${this.formatCompactChanges(log)}</div>
        </div>
      `;
    } catch (error) {
      console.error('Error rendering compact changes:', error);
      return '';
    }
  }

  /**
   * Format changes for compact display
   */
  formatCompactChanges(log) {
    try {
      const changes = [];
      const newValues = this.safeGet(log, 'new_values', {});
      const oldValues = this.safeGet(log, 'old_values', {});
      
      if (newValues && typeof newValues === 'object') {
        Object.keys(newValues).forEach(key => {
          try {
            if (key === 'timestamp') return; // Skip timestamp in changes display
            
            const value = newValues[key];
            let displayValue = '';
            
            if (value === null || value === undefined) {
              displayValue = 'null';
            } else if (typeof value === 'string') {
              displayValue = value.length > 20 ? value.substring(0, 20) + '...' : value;
            } else {
              displayValue = String(value);
            }
            
            // Show old value if available
            const oldValue = oldValues && oldValues[key];
            if (oldValue !== undefined && oldValue !== value) {
              let oldDisplayValue = '';
              if (oldValue === null || oldValue === undefined) {
                oldDisplayValue = 'null';
              } else if (typeof oldValue === 'string') {
                oldDisplayValue = oldValue.length > 15 ? oldValue.substring(0, 15) + '...' : oldValue;
              } else {
                oldDisplayValue = String(oldValue);
              }
              changes.push(`${key}: ${oldDisplayValue} → ${displayValue}`);
            } else {
              changes.push(`${key}: ${displayValue}`);
            }
          } catch (fieldError) {
            console.warn('Error processing field change:', key, fieldError);
            changes.push(`${key}: [error]`);
          }
        });
      }
      
      return changes.join('\n') || 'No displayable changes';
    } catch (error) {
      console.error('Error formatting compact changes:', error);
      return 'Error formatting changes';
    }
  }

  /**
   * Generate compact message for audit logs
   */
  generateCompactMessage(log) {
    try {
      const action = this.safeGet(log, 'action', 'unknown');
      const actionLower = String(action).toLowerCase();
      const tableName = this.singularize(String(this.safeGet(log, 'table_name', 'item')));
      
      switch (actionLower) {
        case 'create':
          return `New ${tableName} created`;
        case 'update':
          return `${this.capitalize(tableName)} updated`;
        case 'delete':
          return `${this.capitalize(tableName)} deleted`;
        case 'login':
          return `User signed in`;
        case 'logout':
          return `User signed out`;
        case 'register':
          return `New user registered`;
        default:
          return `${this.capitalize(String(action))} on ${tableName}`;
      }
    } catch (error) {
      console.error('Error generating compact message:', error);
      return 'Activity recorded';
    }
  }

  /**
   * Format timestamp for display - Improved version with better date parsing
   */
  formatTimestamp(timestamp) {
    // Debug logging to see what we're actually getting
    console.log('formatTimestamp received:', timestamp, 'type:', typeof timestamp);
    
    if (!timestamp) {
      console.log('No timestamp provided');
      return 'Unknown time';
    }
    
    try {
      let date;
      
      // Try multiple parsing approaches
      if (typeof timestamp === 'string') {
        // Method 1: Clean the timestamp and try direct parsing
        let cleanTimestamp = timestamp.trim();
        
        // Handle microseconds by truncating to milliseconds
        if (cleanTimestamp.includes('.') && !cleanTimestamp.endsWith('Z')) {
          const parts = cleanTimestamp.split('.');
          if (parts[1] && parts[1].length > 3) {
            // Truncate microseconds to milliseconds
            cleanTimestamp = parts[0] + '.' + parts[1].substring(0, 3);
          }
        }
        
        // Try adding Z for UTC if no timezone info
        if (!cleanTimestamp.includes('Z') && !cleanTimestamp.includes('+') && !cleanTimestamp.includes('-', 10)) {
          date = new Date(cleanTimestamp + 'Z');
        } else {
          date = new Date(cleanTimestamp);
        }
        
        // Method 2: Manual parsing for problematic formats
        if (isNaN(date.getTime())) {
          const match = cleanTimestamp.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(?:Z|[+-]\d{2}:\d{2})?$/);
          if (match) {
            const [, year, month, day, hour, minute, second, fraction] = match;
            const milliseconds = fraction ? parseInt(fraction.padEnd(3, '0').substring(0, 3)) : 0;
            
            date = new Date(Date.UTC(
              parseInt(year), 
              parseInt(month) - 1, 
              parseInt(day), 
              parseInt(hour), 
              parseInt(minute), 
              parseInt(second),
              milliseconds
            ));
          }
        }
        
        // Method 3: Try as local time (remove T and Z)
        if (isNaN(date.getTime())) {
          const localFormat = cleanTimestamp.replace('T', ' ').replace('Z', '').replace(/\.\d+$/, '');
          date = new Date(localFormat);
        }
        
        // Method 4: Try epoch timestamp (if it's a string of numbers)
        if (isNaN(date.getTime()) && /^\d+$/.test(cleanTimestamp)) {
          const numTimestamp = parseInt(cleanTimestamp);
          // Check if it's in seconds (Unix timestamp) or milliseconds
          if (numTimestamp < 10000000000) { // Less than year 2286 in seconds
            date = new Date(numTimestamp * 1000);
          } else {
            date = new Date(numTimestamp);
          }
        }
        
      } else if (typeof timestamp === 'number') {
        // Handle numeric timestamps
        if (timestamp < 10000000000) { // Unix timestamp in seconds
          date = new Date(timestamp * 1000);
        } else {
          date = new Date(timestamp);
        }
      } else {
        // If it's already a Date object or other type
        date = new Date(timestamp);
      }
      
      console.log('Parsed date:', date, 'Valid:', !isNaN(date.getTime()));
      
      // Final validation
      if (isNaN(date.getTime())) {
        console.error('All parsing methods failed for timestamp:', timestamp);
        return `Invalid: ${String(timestamp).substring(0, 20)}`;
      }
      
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);
      const diffWeeks = Math.floor(diffDays / 7);
      const diffMonths = Math.floor(diffDays / 30);
      const diffYears = Math.floor(diffDays / 365);
      
      console.log('Time difference - Minutes:', diffMins, 'Hours:', diffHours, 'Days:', diffDays);
      
      // Handle future dates (negative differences)
      if (diffMs < 0) {
        const absDiffMs = Math.abs(diffMs);
        const futureHours = Math.floor(absDiffMs / 3600000);
        const futureDays = Math.floor(absDiffMs / 86400000);
        
        if (futureHours < 1) return 'in a few minutes';
        if (futureHours < 24) return `in ${futureHours}h`;
        if (futureDays < 7) return `in ${futureDays}d`;
        return `on ${date.toLocaleDateString()}`;
      }
      
      // Format based on time difference
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      if (diffWeeks < 4) return `${diffWeeks}w ago`;
      if (diffMonths < 12) return `${diffMonths}mo ago`;
      if (diffYears < 2) return '1y ago';
      
      // For very old dates, show the actual date
      return date.toLocaleDateString();
      
    } catch (error) {
      console.error('Error in formatTimestamp:', error, 'for timestamp:', timestamp);
      return `Error: ${String(timestamp).substring(0, 20)}`;
    }
  }

  /**
   * Render error message in the container
   */
  renderError(errorMessage) {
    try {
      if (!this.logsListElement) return;
      
      this.logsListElement.innerHTML = `
        <div class="error-message">
          <i class="fas fa-exclamation-triangle"></i>
          <div>
            <div style="font-weight: 600; margin-bottom: 2px;">Error Loading Logs</div>
            <div>${this.escapeHtml(String(errorMessage).substring(0, 100))}${String(errorMessage).length > 100 ? '...' : ''}</div>
          </div>
        </div>
      `;
    } catch (error) {
      console.error('Error rendering error message:', error);
    }
  }

  /**
   * Handle retry logic with exponential backoff
   */
  handleRetry() {
    try {
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        const retryDelay = this.baseRetryDelay * Math.pow(2, this.retryCount - 1);
        
        console.log(`Audit Logs Manager: Retrying in ${retryDelay}ms (attempt ${this.retryCount}/${this.maxRetries})`);

        setTimeout(() => {
          if (!this.isUpdateRunning) {
            this.update();
          }
        }, retryDelay);
      } else {
        console.error('Audit Logs Manager: Max retries reached. Giving up.');
      }
    } catch (error) {
      console.error('Error in handleRetry:', error);
    }
  }

  /**
   * Helper function to singularize table names
   */
  singularize(word) {
    try {
      if (!word || typeof word !== 'string') return 'item';
      
      const singularRules = {
        'users': 'user',
        'questions': 'question', 
        'answers': 'answer',
        'categories': 'category',
        'themes': 'theme',
        'logs': 'log',
        'entries': 'entry',
        'activities': 'activity'
      };
      
      const lowerWord = word.toLowerCase();
      if (singularRules[lowerWord]) return singularRules[lowerWord];
      if (lowerWord.endsWith('ies')) return lowerWord.slice(0, -3) + 'y';
      if (lowerWord.endsWith('s') && !lowerWord.endsWith('ss')) return lowerWord.slice(0, -1);
      return lowerWord;
    } catch (error) {
      console.error('Error in singularize:', error);
      return 'item';
    }
  }

  /**
   * Helper function to capitalize first letter
   */
  capitalize(word) {
    try {
      if (!word || typeof word !== 'string') return '';
      return word.charAt(0).toUpperCase() + word.slice(1);
    } catch (error) {
      console.error('Error in capitalize:', error);
      return String(word || '');
    }
  }

  /**
   * Get Font Awesome icon class based on action
   */
  getAuditLogIcon(action) {
    try {
      const actionLower = String(action || '').toLowerCase();
      const iconMap = {
        'create': 'fas fa-plus',
        'update': 'fas fa-edit',
        'delete': 'fas fa-trash',
        'login': 'fas fa-sign-in-alt',
        'logout': 'fas fa-sign-out-alt',
        'register': 'fas fa-user-plus',
        'unknown': 'fas fa-question',
        'error': 'fas fa-exclamation-triangle'
      };
      
      return iconMap[actionLower] || 'fas fa-circle';
    } catch (error) {
      console.error('Error getting audit log icon:', error);
      return 'fas fa-circle';
    }
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    try {
      if (typeof text !== 'string') {
        text = String(text || '');
      }
      
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    } catch (error) {
      console.error('Error escaping HTML:', error);
      return 'Error';
    }
  }

  /**
   * Dispatch custom events
   */
  dispatchEvent(eventName, detail) {
    try {
      document.dispatchEvent(new CustomEvent(eventName, { detail }));
    } catch (error) {
      console.error('Audit Logs Manager: Error dispatching event:', error);
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig) {
    try {
      Object.assign(this, newConfig);
      console.log('Audit Logs Manager: Configuration updated:', newConfig);
      
      if (this.updateIntervalId) {
        this.start();
      }
    } catch (error) {
      console.error('Error updating config:', error);
    }
  }

  /**
   * Get current status
   */
  getStatus() {
    try {
      return {
        isRunning: !!this.updateIntervalId,
        isUpdateRunning: this.isUpdateRunning,
        retryCount: this.retryCount,
        hasContainer: !!this.containerElement,
        config: {
          baseUrl: this.baseUrl,
          apiEndpoint: this.apiEndpoint,
          containerSelector: this.containerSelector,
          updateInterval: this.updateInterval
        }
      };
    } catch (error) {
      console.error('Error getting status:', error);
      return { error: error.message };
    }
  }
}

// Auto-initialize when DOM is ready
let auditLogsManager = null;

const initializeAuditLogsManager = () => {
  try {
    const container = document.querySelector('.js-auditlog');
    if (container) {
      auditLogsManager = new AuditLogsManager();
      console.log('Compact Audit Logs Manager: Auto-initialized');
    } else {
      console.log('Compact Audit Logs Manager: Container not found, skipping initialization');
    }
  } catch (error) {
    console.error('Compact Audit Logs Manager: Failed to initialize:', error);
  }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeAuditLogsManager);
} else {
  initializeAuditLogsManager();
}

// Export for global access
window.AuditLogsManager = AuditLogsManager;
window.auditLogsManager = auditLogsManager;

// Export API for external use
window.auditLogsAPI = {
  start: () => auditLogsManager?.start(),
  stop: () => auditLogsManager?.stop(),
  update: () => auditLogsManager?.update(),
  getStatus: () => auditLogsManager?.getStatus(),
  updateConfig: (config) => auditLogsManager?.updateConfig(config)
};