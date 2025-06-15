/**
 * Compact Audit Logs Manager
 * Optimized for narrow, tall containers with vertical layout
 */

class AuditLogsManager {
  constructor(options = {}) {
    // Configuration
    this.baseUrl = options.baseUrl || `http://${window.location.hostname}`;
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
   * Inject CSS styles optimized for narrow containers
   */
  injectStyles() {
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
  }

  /**
   * Initialize the audit logs manager
   */
  init() {
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
  }

  /**
   * Setup the container structure
   */
  setupContainer() {
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
  }

  /**
   * Start the update cycle
   */
  start() {
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
  }

  /**
   * Stop the update cycle
   */
  stop() {
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
  }

  /**
   * Handle page visibility changes
   */
  handleVisibilityChange() {
    if (document.hidden) {
      this.stop();
    } else {
      this.start();
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

      const auditLogs = await response.json();
      console.log('Audit Logs Manager: Received data:', auditLogs);

      // Update the display
      this.renderAuditLogs(auditLogs);
      
      // Reset retry count on success
      this.retryCount = 0;
      
      // Dispatch success event
      this.dispatchEvent('auditLogsUpdated', {
        count: Array.isArray(auditLogs) ? auditLogs.length : 0,
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
    const statusElement = this.containerElement?.querySelector('.audit-logs-status span');
    if (statusElement) {
      statusElement.innerHTML = '<span class="loading-spinner"></span>';
    }
  }

  /**
   * Hide loading state
   */
  hideLoadingState() {
    const statusElement = this.containerElement?.querySelector('.audit-logs-status span');
    if (statusElement) {
      statusElement.textContent = 'Live';
    }
  }

  /**
   * Render audit logs in the container
   */
  renderAuditLogs(auditLogs) {
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

    auditLogs.forEach((log, index) => {
      try {
        const logElement = this.createCompactLogElement(log);
        this.logsListElement.appendChild(logElement);
      } catch (logError) {
        console.error(`Audit Logs Manager: Error processing log ${index}:`, logError, log);
      }
    });

    console.log(`Audit Logs Manager: Successfully rendered ${auditLogs.length} audit logs`);
  }

  /**
   * Create a compact DOM element for a single audit log
   */
  createCompactLogElement(log) {
    const logDiv = document.createElement('div');
    logDiv.classList.add('audit-log-item');

    const action = (log.action || 'unknown').toLowerCase();
    const iconClass = this.getAuditLogIcon(action);
    const message = this.generateCompactMessage(log);
    const timestamp = this.formatTimestamp(log.new_values.timestamp);
    
    logDiv.innerHTML = `
      <div class="audit-log-header">
        <span class="audit-log-badge badge-${action}">${log.action || 'Unknown'}</span>
        <span class="audit-log-id">#${log.id}</span>
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
              <span class="detail-value">${this.escapeHtml(log.table_name || 'Unknown')}</span>
            </div>
            <div class="audit-log-detail">
              <span class="detail-label">ID:</span>
              <span class="detail-value">${this.escapeHtml(log.record_id || 'N/A')}</span>
            </div>
            <div class="audit-log-detail">
              <span class="detail-label">User:</span>
              <span class="detail-value">${this.escapeHtml(log.changed_by || 'System')}</span>
            </div>
            ${log.ip_address ? `
            <div class="audit-log-detail">
              <span class="detail-label">IP:</span>
              <span class="detail-value">${this.escapeHtml(log.ip_address)}</span>
            </div>
            ` : ''}
          </div>
          
          ${this.renderCompactChanges(log)}
        </div>
      </div>
      
      <div class="audit-log-meta">
        ${timestamp}
      </div>
    `;

    return logDiv;
  }

  /**
   * Render compact changes section
   */
  renderCompactChanges(log) {
    const hasChanges = (log.old_values && Object.keys(log.old_values).length > 0) ||
                      (log.new_values && Object.keys(log.new_values).length > 0);
    
    if (!hasChanges) return '';

    const changeCount = Object.keys(log.new_values || {}).length + Object.keys(log.old_values || {}).length;
    
    return `
      <div class="audit-log-changes">
        <div class="changes-title">
          <i class="fas fa-list"></i>
          ${changeCount} field${changeCount !== 1 ? 's' : ''} changed
        </div>
        <div class="changes-content">${this.formatCompactChanges(log)}</div>
      </div>
    `;
  }

  /**
   * Format changes for compact display
   */
  formatCompactChanges(log) {
    const changes = [];
    
    if (log.new_values) {
      Object.keys(log.new_values).forEach(key => {
        const value = log.new_values[key];
        const displayValue = typeof value === 'string' && value.length > 20 
          ? value.substring(0, 20) + '...' 
          : String(value);
        changes.push(`${key}: ${displayValue}`);
      });
    }
    
    return changes.join('\n');
  }

  /**
   * Generate compact message for audit logs
   */
  generateCompactMessage(log) {
    const action = log.action ? log.action.toLowerCase() : 'unknown';
    const tableName = this.singularize(log.table_name || 'item');
    
    switch (action) {
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
      default:
        return `${this.capitalize(action)} on ${tableName}`;
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
      return `Invalid: ${timestamp}`;
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
    if (!this.logsListElement) return;
    
    this.logsListElement.innerHTML = `
      <div class="error-message">
        <i class="fas fa-exclamation-triangle"></i>
        <div>
          <div style="font-weight: 600; margin-bottom: 2px;">Error Loading Logs</div>
          <div>${this.escapeHtml(errorMessage.substring(0, 100))}${errorMessage.length > 100 ? '...' : ''}</div>
        </div>
      </div>
    `;
  }

  /**
   * Handle retry logic with exponential backoff
   */
  handleRetry() {
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
  }

  /**
   * Helper function to singularize table names
   */
  singularize(word) {
    if (!word || typeof word !== 'string') return 'item';
    
    const singularRules = {
      'users': 'user',
      'questions': 'question', 
      'answers': 'answer',
      'categories': 'category',
      'themes': 'theme'
    };
    
    if (singularRules[word]) return singularRules[word];
    if (word.endsWith('ies')) return word.slice(0, -3) + 'y';
    if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
    return word;
  }

  /**
   * Helper function to capitalize first letter
   */
  capitalize(word) {
    if (!word || typeof word !== 'string') return '';
    return word.charAt(0).toUpperCase() + word.slice(1);
  }

  /**
   * Get Font Awesome icon class based on action
   */
  getAuditLogIcon(action) {
    const iconMap = {
      'create': 'fas fa-plus',
      'update': 'fas fa-edit',
      'delete': 'fas fa-trash',
      'login': 'fas fa-sign-in-alt',
      'logout': 'fas fa-sign-out-alt',
      'register': 'fas fa-user-plus',
      'unknown': 'fas fa-question'
    };
    
    return iconMap[action] || 'fas fa-circle';
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    if (typeof text !== 'string') {
      text = String(text || '');
    }
    
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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
    Object.assign(this, newConfig);
    console.log('Audit Logs Manager: Configuration updated:', newConfig);
    
    if (this.updateIntervalId) {
      this.start();
    }
  }

  /**
   * Get current status
   */
  getStatus() {
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