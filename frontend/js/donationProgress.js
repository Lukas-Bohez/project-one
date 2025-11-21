/* donationProgress.js
   Donation progress bar updater with idle game account integration
   Updates via UserServer account using idle game backend
*/

(function () {
  'use strict';

  // ==================================================================
  // 🎯 CONFIGURATION
  // ==================================================================
  const CONFIG = {
    baseUrl: window.location.origin,
    apiEndpoint: '/api/v1/game',
    adminUsername: 'UserServer', // The account that stores donation progress
    fallbackCurrent: 114,
    fallbackGoal: 150
  };
  // ==================================================================

  let cachedProgress = null;

  // Fetch donation progress from idle game save data
  async function fetchDonationProgress() {
    try {
      console.log('🔍 FETCH: Starting donation progress fetch');
      const loginUrl = `${CONFIG.baseUrl}${CONFIG.apiEndpoint}/auth/login`;
      
      // Get stored admin credentials
      const adminPassword = localStorage.getItem('donationAdminPassword');
      if (!adminPassword) {
        console.warn('⚠️ FETCH: No admin password stored, using fallback values');
        return { currentAmount: CONFIG.fallbackCurrent, goalAmount: CONFIG.fallbackGoal };
      }

      console.log('🔍 FETCH: Attempting login to', loginUrl);
      // Login as admin to fetch save data
      const loginResponse = await fetch(loginUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: CONFIG.adminUsername,
          password: adminPassword
        })
      });

      console.log('🔍 FETCH: Login response status:', loginResponse.status);
      if (!loginResponse.ok) {
        const errorText = await loginResponse.text();
        console.warn('⚠️ FETCH: Login failed with status', loginResponse.status, 'Response:', errorText);
        return { currentAmount: CONFIG.fallbackCurrent, goalAmount: CONFIG.fallbackGoal };
      }

      const loginData = await loginResponse.json();
      console.log('🔍 FETCH: Login successful, got token');
      const authToken = loginData.access_token;

      // Load game save data (GET request to /save endpoint)
      const loadUrl = `${CONFIG.baseUrl}${CONFIG.apiEndpoint}/save`;
      console.log('🔍 FETCH: Loading save from', loadUrl);
      const loadResponse = await fetch(loadUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('🔍 FETCH: Load response status:', loadResponse.status);
      if (!loadResponse.ok) {
        const errorText = await loadResponse.text();
        console.warn('⚠️ FETCH: Load failed with status', loadResponse.status, 'Response:', errorText);
        return { currentAmount: CONFIG.fallbackCurrent, goalAmount: CONFIG.fallbackGoal };
      }

      const response = await loadResponse.json();
      console.log('🔍 FETCH: Got response:', response);
      
      // The response has save_data field from backend
      let saveData = response.save_data || response;
      console.log('🔍 FETCH: Save data keys:', Object.keys(saveData));
      console.log('🔍 FETCH: custom_data type:', typeof saveData.custom_data);
      
      // Extract donation progress from custom_data
      let donationData = {
        currentAmount: CONFIG.fallbackCurrent,
        goalAmount: CONFIG.fallbackGoal
      };
      
      if (saveData.custom_data) {
        // Handle if custom_data is string (from database)
        let customData = saveData.custom_data;
        if (typeof customData === 'string') {
          console.log('🔍 FETCH: Parsing custom_data from string');
          try {
            customData = JSON.parse(customData);
            console.log('🔍 FETCH: Parsed custom_data:', customData);
          } catch (e) {
            console.error('❌ FETCH: Failed to parse custom_data:', e);
          }
        }
        
        if (customData && customData.donationProgress) {
          console.log('✅ FETCH: Found donation progress:', customData.donationProgress);
          donationData = customData.donationProgress;
        } else {
          console.warn('⚠️ FETCH: No donationProgress in custom_data');
        }
      } else {
        console.warn('⚠️ FETCH: No custom_data in save');
      }

      cachedProgress = donationData;
      console.log('✅ FETCH: Returning donation data:', donationData);
      return donationData;

    } catch (error) {
      console.error('❌ FETCH: Error fetching donation progress:', error);
      console.error('❌ FETCH: Error stack:', error.stack);
      return { currentAmount: CONFIG.fallbackCurrent, goalAmount: CONFIG.fallbackGoal };
    }
  }

  // Update donation progress (admin only)
  async function updateDonationProgress(currentAmount, goalAmount) {
    try {
      console.log('💾 SAVE: Starting donation progress update');
      console.log('💾 SAVE: Current:', currentAmount, 'Goal:', goalAmount);
      
      const adminPassword = localStorage.getItem('donationAdminPassword');
      if (!adminPassword) {
        throw new Error('Admin password not set');
      }

      // Login
      const loginUrl = `${CONFIG.baseUrl}${CONFIG.apiEndpoint}/auth/login`;
      console.log('💾 SAVE: Logging in to', loginUrl);
      const loginResponse = await fetch(loginUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: CONFIG.adminUsername,
          password: adminPassword
        })
      });

      console.log('💾 SAVE: Login status:', loginResponse.status);
      if (!loginResponse.ok) {
        const errorData = await loginResponse.json();
        console.error('❌ SAVE: Login failed:', errorData);
        throw new Error(errorData.detail || 'Login failed');
      }

      const loginData = await loginResponse.json();
      const authToken = loginData.access_token;

      // Load current save
      const loadUrl = `${CONFIG.baseUrl}${CONFIG.apiEndpoint}/save`;
      const loadResponse = await fetch(loadUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      // Start with defaults
      let saveData = {
        game_version: '1.0.0',
        play_time: 0,
        last_save: new Date().toISOString(),
        resources: { stone: 0, crystals: 0, gold: 0, royal_favor: 0 },
        characters: [],
        buildings: {},
        upgrades: { mining_speed: 1, transport_speed: 1, market_efficiency: 1, storage_capacity: 1 },
        unlocked_vehicles: ['hand_cart'],
        achievements: [],
        prestige_level: 0,
        offline_time: 0,
        settings: { sound_enabled: true, auto_save: true, notifications: true, graphics_quality: 'high' },
        custom_data: {}
      };
      
      // Try to load existing save
      if (loadResponse.ok) {
        const loadedData = await loadResponse.json();
        if (loadedData.save_data) {
          saveData = loadedData.save_data;
        }
      }

      // Ensure custom_data is object
      if (typeof saveData.custom_data === 'string') {
        try {
          saveData.custom_data = JSON.parse(saveData.custom_data);
        } catch (e) {
          saveData.custom_data = {};
        }
      }
      
      if (!saveData.custom_data) {
        saveData.custom_data = {};
      }

      // Update donation progress
      saveData.custom_data.donationProgress = {
        currentAmount: parseFloat(currentAmount),
        goalAmount: parseFloat(goalAmount),
        lastUpdated: new Date().toISOString()
      };

      // Wrap for backend
      const savePayload = {
        save_data: saveData,
        backup: false
      };

      // Save updated data
      const saveUrl = `${CONFIG.baseUrl}${CONFIG.apiEndpoint}/save`;
      const saveResponse = await fetch(saveUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(savePayload)
      });

      if (!saveResponse.ok) {
        let errorMsg = 'Save failed';
        try {
          const errorData = await saveResponse.json();
          errorMsg = errorData.detail || errorData.message || 'Save failed';
        } catch (e) {
          errorMsg = `Save failed with status ${saveResponse.status}`;
        }
        throw new Error(errorMsg);
      }

      cachedProgress = saveData.custom_data.donationProgress;
      updateProgressBar(saveData.custom_data.donationProgress);
      
      return { success: true, message: 'Donation progress updated!' };

    } catch (error) {
      console.error('❌ Error updating donation progress:', error);
      return { success: false, message: error.message };
    }
  }

  // Update the progress bar display
  function updateProgressBar(progress) {
    const progressBar = document.getElementById('donation-progress');
    if (progressBar) {
      progressBar.max = progress.goalAmount;
      progressBar.value = Math.min(progress.currentAmount, progress.goalAmount);
      progressBar.setAttribute('aria-valuenow', String(Math.min(progress.currentAmount, progress.goalAmount)));
      progressBar.setAttribute('aria-valuemax', String(progress.goalAmount));
      progressBar.setAttribute('aria-label', `Funding progress ${progress.currentAmount} of ${progress.goalAmount}`);
    }
  }

  // Initialize on page load
  document.addEventListener('DOMContentLoaded', async function () {
    const progress = await fetchDonationProgress();
    updateProgressBar(progress);
  });

  // Expose functions globally for admin interface
  window.DonationProgress = {
    fetch: fetchDonationProgress,
    update: updateDonationProgress,
    getCached: () => cachedProgress
  };

})();
