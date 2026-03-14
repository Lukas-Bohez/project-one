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

  // Retrieve or obtain an auth token.
  // Preferred sources (in order):
  // 1. `industrialEmpire_auth` (saved by SaveManager)
  // 2. `gamePassword` (saved password) or `donationAdminPassword` -> perform login
  async function getAuthToken() {
    try {
      // 1) Check for saved token object
      const savedAuth = localStorage.getItem('industrialEmpire_auth');
      if (savedAuth) {
        try {
          const parsed = JSON.parse(savedAuth);
          if (parsed && parsed.token) {
            // Check token expiry if it's a JWT
            try {
              const parts = parsed.token.split('.');
              if (parts.length === 3) {
                const payload = JSON.parse(atob(parts[1]));
                if (payload.exp && payload.exp * 1000 < Date.now()) {
                  console.log('🔐 getAuthToken: Saved token expired');
                } else {
                  console.log('🔐 getAuthToken: Using token from industrialEmpire_auth');
                  return parsed.token;
                }
              } else {
                console.log('🔐 getAuthToken: Using non-JWT token from industrialEmpire_auth');
                return parsed.token;
              }
            } catch (e) {
              console.warn('🔐 getAuthToken: Failed to parse token expiry, using token anyway');
              return parsed.token;
            }
          }
        } catch (e) {
          // ignore parse errors
        }
      }

      // 2) Check for token on any global SaveManager instance if present
      try {
        // Common instances may attach to window.app.gameEngine.saveManager
        if (window.app && window.app.gameEngine && window.app.gameEngine.saveManager && window.app.gameEngine.saveManager.authToken) {
          console.log('🔐 getAuthToken: Using token from window.app.gameEngine.saveManager');
          return window.app.gameEngine.saveManager.authToken;
        }

        // Also check a few other possible globals
        const candidates = [window.saveManager, window.SaveManagerInstance, window.saveManagerInstance];
        for (const c of candidates) {
          if (c && c.authToken) {
            console.log('🔐 getAuthToken: Using token from SaveManager instance');
            return c.authToken;
          }
        }
      } catch (e) {
        // ignore
      }

      // 3) Try to login with a stored password
      const password = localStorage.getItem('gamePassword') || localStorage.getItem('donationAdminPassword');
      if (!password) {
        return null;
      }

      // Prefer username from saved auth or explicit donationAdminUsername in localStorage
      let username = CONFIG.adminUsername;
      try {
        const storedName = localStorage.getItem('donationAdminUsername');
        if (storedName) username = storedName;
        else if (savedAuth) {
          const parsed = JSON.parse(savedAuth);
          if (parsed && parsed.username) username = parsed.username;
        }
      } catch (e) { /* ignore */ }

      const loginUrl = `${CONFIG.baseUrl}${CONFIG.apiEndpoint}/auth/login`;
      console.log('🔐 getAuthToken: Attempting login for', username);
      const resp = await fetch(loginUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username, password: password })
      });

      if (!resp.ok) {
        console.warn('🔐 getAuthToken: Login failed with status', resp.status);
        return null;
      }

      const data = await resp.json();
      if (data && (data.access_token || data.token)) {
        const token = data.access_token || data.token;
        try {
          localStorage.setItem('industrialEmpire_auth', JSON.stringify({ token: token, username: username, timestamp: Date.now() }));
        } catch (e) {
          // ignore storage errors
        }
        console.log('🔐 getAuthToken: Login succeeded, token saved');
        return token;
      }

      return null;
    } catch (error) {
      console.error('🔐 getAuthToken: Error obtaining token', error);
      return null;
    }
  }

  // Fetch donation progress from idle game save data
  async function fetchDonationProgress() {
    try {
      console.log('🔍 FETCH: Starting donation progress fetch');
      // First try the public, unauthenticated endpoint for the admin account
      const publicUrl = `${CONFIG.baseUrl}/api/v1/donationprogress`;
      console.log('🔍 FETCH: Attempting public load from', publicUrl);
      try {
        const controller = new AbortController();
        const start = Date.now();
        let warned = false;

        // Warn at 10s if still pending
        const warnTimer = setTimeout(() => {
          warned = true;
          console.warn('⏱️ FETCH: Public endpoint taking longer than 10s... still waiting:', publicUrl);
        }, 10000);

        // Abort at 30s to avoid hanging forever
        const abortTimer = setTimeout(() => {
          controller.abort();
          console.error('⏳ FETCH: Public endpoint aborted after 30s:', publicUrl);
        }, 30000);

        const publicResp = await fetch(publicUrl, { method: 'GET', headers: { 'Content-Type': 'application/json' }, signal: controller.signal });

        const elapsed = Date.now() - start;
        clearTimeout(warnTimer);
        clearTimeout(abortTimer);

        console.log(`🔍 FETCH: Public endpoint response received in ${elapsed}ms, status:`, publicResp.status);

        if (publicResp.ok) {
          const publicBody = await publicResp.json().catch(() => null);
          console.log('🔍 FETCH: Public endpoint returned:', publicBody);
          const save = publicBody?.save_data || publicBody;
          if (save) {
            // parse custom_data if string
            let custom = save.custom_data || save;
            if (typeof custom === 'string') {
              try { custom = JSON.parse(custom); } catch (e) { custom = null; }
            }
            if (custom && custom.donationProgress) {
              cachedProgress = custom.donationProgress;
              console.log('✅ FETCH: Using donationProgress from public endpoint:', cachedProgress);
              return cachedProgress;
            } else {
              console.warn('⚠️ FETCH: Public endpoint returned save but no donationProgress');
              // fall through to authenticated attempt
            }
          }
        } else {
          console.log('🔍 FETCH: Public endpoint responded with status', publicResp.status);
        }
      } catch (err) {
        // Distinguish abort vs other errors
        if (err && err.name === 'AbortError') {
          console.error('❌ FETCH: Public endpoint fetch aborted (timeout)');
        } else {
          console.warn('⚠️ FETCH: Public endpoint request failed:', err);
        }
        // continue to authenticated flow
      }

      // Fallback: Try to reuse an existing token (saved by SaveManager) or re-login with stored password
      const authToken = await getAuthToken();
      if (!authToken) {
        console.warn('⚠️ FETCH: No auth token available, using fallback values');
        return { currentAmount: CONFIG.fallbackCurrent, goalAmount: CONFIG.fallbackGoal };
      }

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
      // Prefer using an existing SaveManager instance if available (it produces the same payload SaveManager uses)
      let saveManagerUsed = null;
      if (window.app && window.app.gameEngine && window.app.gameEngine.saveManager) {
        saveManagerUsed = window.app.gameEngine.saveManager;
        console.log('💾 SAVE: Using SaveManager instance for save (preferred path)');
      }

      // Get a token (try SaveManager token, saved token, or login if needed)
      let authToken = null;
      if (saveManagerUsed && saveManagerUsed.authToken) {
        authToken = saveManagerUsed.authToken;
      } else {
        authToken = await getAuthToken();
      }

      if (!authToken) {
        throw new Error('Admin credentials not available for saving');
      }

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

      // If we have a SaveManager, prefer to use its prepareSaveData() to match payload exactly
      let savePayload = { save_data: saveData, backup: false };
      if (saveManagerUsed && typeof saveManagerUsed.prepareSaveData === 'function') {
        try {
          const prepared = saveManagerUsed.prepareSaveData();
          // Ensure we preserve existing prepared data but inject our donationProgress
          if (!prepared.custom_data) prepared.custom_data = {};
          prepared.custom_data.donationProgress = {
            currentAmount: parseFloat(currentAmount),
            goalAmount: parseFloat(goalAmount),
            lastUpdated: new Date().toISOString()
          };
          savePayload = { save_data: prepared, backup: false };
          console.log('💾 SAVE: Using SaveManager.prepareSaveData() payload (size:', JSON.stringify(savePayload).length, 'bytes)');
        } catch (e) {
          console.warn('💾 SAVE: Failed to use SaveManager.prepareSaveData(), falling back to manual payload', e);
        }
      }

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

      console.log('💾 SAVE: Save response status:', saveResponse.status);
      let saveRespBody = null;
      try { saveRespBody = await saveResponse.json(); } catch (e) { /* ignore parse errors */ }
      console.log('💾 SAVE: Save response body:', saveRespBody);

      if (!saveResponse.ok) {
        let errorMsg = 'Save failed';
        if (saveRespBody) {
          errorMsg = saveRespBody.detail || saveRespBody.message || JSON.stringify(saveRespBody);
        } else {
          errorMsg = `Save failed with status ${saveResponse.status}`;
        }
        console.error('❌ SAVE: Error response:', errorMsg);
        throw new Error(errorMsg);
      }

      // Verify by reloading the saved data from server
      try {
        console.log('🔁 SAVE: Verifying saved data by reloading from server');
        const verifyResp = await fetch(loadUrl, { method: 'GET', headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' } });
        const verifyBody = await verifyResp.json().catch(() => null);
        console.log('🔁 SAVE: Verify response status:', verifyResp.status, 'body:', verifyBody);

        let verifiedProgress = null;
        const verifySave = verifyBody?.save_data || verifyBody;
        if (verifySave && verifySave.custom_data) {
          let cd = verifySave.custom_data;
          if (typeof cd === 'string') {
            try { cd = JSON.parse(cd); } catch (e) { cd = null; }
          }
          if (cd && cd.donationProgress) {
            verifiedProgress = cd.donationProgress;
          }
        }

        if (verifiedProgress) {
          console.log('✅ SAVE: Verified donation progress on server:', verifiedProgress);
          cachedProgress = verifiedProgress;
          updateProgressBar(verifiedProgress);
          return { success: true, message: 'Donation progress updated and verified!' };
        } else {
          console.warn('⚠️ SAVE: Could not verify donation progress after save. Server response:', verifyBody);
          // Still update local cached value and UI so admin sees it
          cachedProgress = saveData.custom_data.donationProgress;
          updateProgressBar(saveData.custom_data.donationProgress);
          return { success: true, message: 'Donation progress updated (verification failed)' };
        }
      } catch (err) {
        console.error('❌ SAVE: Verification request failed:', err);
        cachedProgress = saveData.custom_data.donationProgress;
        updateProgressBar(saveData.custom_data.donationProgress);
        return { success: true, message: 'Donation progress updated (verification request failed)' };
      }

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
    getCached: () => cachedProgress,
    // Set admin credentials at runtime (stores in localStorage). Use this instead of hardcoding.
    setAdminCredentials: (username, password) => {
      try {
        // Never store admin passwords in persistent storage. Keep username in sessionStorage
        if (username) sessionStorage.setItem('donationAdminUsername', username);
        // Password is kept in-memory only and not persisted. Caller should handle it.
        console.warn('🔐 DonationProgress: Admin password will not be persisted for security reasons');
        return { success: true };
      } catch (e) {
        console.error('🔐 DonationProgress: Failed to set admin username', e);
        return { success: false, message: e.message };
      }
    }
  };

})();
