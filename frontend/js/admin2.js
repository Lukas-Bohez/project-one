// Track if updates are currently running to prevent multiple simultaneous calls
let isUsersUpdateRunning = false;
let isQuestionsUpdateRunning = false;
let usersUpdateInterval = null;
let questionsUpdateInterval = null;
let usersRetryCount = 0;
let questionsRetryCount = 0;
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY = 1000; // 1 second
let lanIP = `http://${window.location.hostname}:8000`;

// Cache DOM elements for better performance
let usersCountElements = null;
let questionsCountElements = null;

// Initialize cached elements
function initializeElements() {
  usersCountElements = document.querySelectorAll('.js-users-count');
  questionsCountElements = document.querySelectorAll('.js-question-count');
  
  return {
    hasUsers: usersCountElements.length > 0,
    hasQuestions: questionsCountElements.length > 0
  };
}

// Function to fetch and update active users count
async function updateActiveUsersCount() {
  if (isUsersUpdateRunning) return;
  isUsersUpdateRunning = true;
  
  try {
    const response = await fetch(`${lanIP}/api/users/active/count?t=${Date.now()}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      },
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Check if the response contains an error
    if (data.error) {
      throw new Error(data.error);
    }
    
    // Validate count is a number
    const count = typeof data.count === 'number' ? data.count : 0;
    
    // Update elements if they exist
    if (usersCountElements && usersCountElements.length > 0) {
      usersCountElements.forEach(el => {
        el.textContent = count.toString();
        el.setAttribute('data-last-updated', new Date().toISOString());
      });
      
      console.log(`Updated users count: ${count}`);
      
      // Dispatch custom event
      document.dispatchEvent(new CustomEvent('usersCountUpdated', {
        detail: { 
          count, 
          timestamp: Date.now(),
          success: true 
        }
      }));
    }
    
    // Reset retry count on success
    usersRetryCount = 0;
    
  } catch (error) {
    console.error('Users count fetch error:', error);
    
    const errorMessage = error.name === 'TimeoutError' ? 'Timeout' : 'Error';
    
    if (usersCountElements && usersCountElements.length > 0) {
      usersCountElements.forEach(el => {
        el.textContent = errorMessage;
        el.setAttribute('data-error', error.message);
      });
    }
    
    document.dispatchEvent(new CustomEvent('usersCountError', {
      detail: { 
        error: error.message, 
        timestamp: Date.now() 
      }
    }));
    
    // Implement exponential backoff for retries
    if (usersRetryCount < MAX_RETRIES) {
      usersRetryCount++;
      const retryDelay = BASE_RETRY_DELAY * Math.pow(2, usersRetryCount - 1);
      console.log(`Retrying users count in ${retryDelay}ms (attempt ${usersRetryCount}/${MAX_RETRIES})`);
      
      setTimeout(() => {
        if (!isUsersUpdateRunning) {
          updateActiveUsersCount();
        }
      }, retryDelay);
    }
    
  } finally {
    isUsersUpdateRunning = false;
  }
}

// Function to fetch and update active questions count
async function updateActiveQuestionsCount() {
  if (isQuestionsUpdateRunning) return;
  isQuestionsUpdateRunning = true;
  
  try {
    const response = await fetch(`${lanIP}/api/questions/active/count?t=${Date.now()}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      },
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Check if the response contains an error
    if (data.error) {
      throw new Error(data.error);
    }
    
    // Validate count is a number
    const count = typeof data.count === 'number' ? data.count : 0;
    
    // Update elements if they exist
    if (questionsCountElements && questionsCountElements.length > 0) {
      questionsCountElements.forEach(el => {
        el.textContent = count.toString();
        el.setAttribute('data-last-updated', new Date().toISOString());
      });
      
      console.log(`Updated questions count: ${count}`);
      
      // Dispatch custom event
      document.dispatchEvent(new CustomEvent('questionCountUpdated', {
        detail: { 
          count, 
          timestamp: Date.now(),
          success: true 
        }
      }));
    }
    
    // Reset retry count on success
    questionsRetryCount = 0;
    
  } catch (error) {
    console.error('Questions count fetch error:', error);
    
    const errorMessage = error.name === 'TimeoutError' ? 'Timeout' : 'Error';
    
    if (questionsCountElements && questionsCountElements.length > 0) {
      questionsCountElements.forEach(el => {
        el.textContent = errorMessage;
        el.setAttribute('data-error', error.message);
      });
    }
    
    document.dispatchEvent(new CustomEvent('questionCountError', {
      detail: { 
        error: error.message, 
        timestamp: Date.now() 
      }
    }));
    
    // Implement exponential backoff for retries
    if (questionsRetryCount < MAX_RETRIES) {
      questionsRetryCount++;
      const retryDelay = BASE_RETRY_DELAY * Math.pow(2, questionsRetryCount - 1);
      console.log(`Retrying questions count in ${retryDelay}ms (attempt ${questionsRetryCount}/${MAX_RETRIES})`);
      
      setTimeout(() => {
        if (!isQuestionsUpdateRunning) {
          updateActiveQuestionsCount();
        }
      }, retryDelay);
    }
    
  } finally {
    isQuestionsUpdateRunning = false;
  }
}

// Start the update cycles
function startUpdateCycles(intervalMs = 30000) {
  const elements = initializeElements();
  
  // Start users count updates if elements exist
  if (elements.hasUsers) {
    if (usersUpdateInterval) clearInterval(usersUpdateInterval);
    updateActiveUsersCount();
    usersUpdateInterval = setInterval(updateActiveUsersCount, intervalMs);
  }
  
  // Start questions count updates if elements exist
  if (elements.hasQuestions) {
    if (questionsUpdateInterval) clearInterval(questionsUpdateInterval);
    updateActiveQuestionsCount();
    questionsUpdateInterval = setInterval(updateActiveQuestionsCount, intervalMs);
  }
}

// Stop the update cycles
function stopUpdateCycles() {
  if (usersUpdateInterval) {
    clearInterval(usersUpdateInterval);
    usersUpdateInterval = null;
  }
  if (questionsUpdateInterval) {
    clearInterval(questionsUpdateInterval);
    questionsUpdateInterval = null;
  }
}

// Visibility API to pause updates when page is hidden
function handleVisibilityChange() {
  if (document.hidden) {
    stopUpdateCycles();
  } else {
    startUpdateCycles();
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  const elements = initializeElements();
  
  if (elements.hasUsers || elements.hasQuestions) {
    startUpdateCycles();
    
    // Add visibility change listener for better performance
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    if (elements.hasUsers) console.log('Initialized users count tracking');
    if (elements.hasQuestions) console.log('Initialized questions count tracking');
  } else {
    console.warn('No elements with classes "js-users-count" or "js-question-count" found');
  }
});

// Clean up on page unload
window.addEventListener('beforeunload', stopUpdateCycles);

// Export functions for external use
window.countsAPI = {
  updateUsers: updateActiveUsersCount,
  updateQuestions: updateActiveQuestionsCount,
  start: startUpdateCycles,
  stop: stopUpdateCycles
};