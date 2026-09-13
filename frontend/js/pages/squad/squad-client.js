/**
 * Warframe Squad Finder - WebSocket Client
 */

(function() {
  'use strict';

  class SquadFinderClient {
    constructor() {
      this.ws = null;
      this.player = null;
      this.currentSquad = null;
      this.filterOptions = {};
      this.reconnectAttempts = 0;
      this.maxReconnectAttempts = 5;
      this.reconnectDelay = 3000;
      this.activeProfile = null;
      this.initElements();
      this.initEventListeners();
      this.initSavedProfile();
    }

    initElements() {
      this.setupPanel = document.getElementById('setupPanel');
      this.mainPanel = document.getElementById('mainPanel');
      this.playerNameInput = document.getElementById('playerName');
      this.playerPlatformSelect = document.getElementById('playerPlatform');
      this.playerRegionSelect = document.getElementById('playerRegion');
      this.playerMRInput = document.getElementById('playerMR');
      this.playerClanInput = document.getElementById('playerClan');
      this.playerForm = document.getElementById('playerForm');
      this.statusIndicator = document.getElementById('statusIndicator');
      this.statusText = document.getElementById('statusText');
      this.switchPlayerBtn = document.getElementById('switchPlayerBtn');
      this.onlineCount = document.getElementById('onlineCount');
      this.squadListContainer = document.getElementById('squadListContainer');
      this.squadList = document.getElementById('squadList');
      this.createSquadBtn = document.getElementById('createSquadBtn');
      this.quickMatchBtn = document.getElementById('quickMatchBtn');
      this.quickMatchModal = document.getElementById('quickMatchModal');
      this.closeQuickMatchBtn = document.getElementById('closeQuickMatchBtn');
      this.cancelQuickMatchBtn = document.getElementById('cancelQuickMatchBtn');
      this.confirmQuickMatchBtn = document.getElementById('confirmQuickMatchBtn');
      this.quickModeSelect = document.getElementById('quickModeSelect');
      this.quickSizeSelect = document.getElementById('quickSizeSelect');
      this.quickMissionSelect = document.getElementById('quickMissionSelect');
      this.quickPlanetSelect = document.getElementById('quickPlanetSelect');
      this.quickDifficultySelect = document.getElementById('quickDifficultySelect');
      this.quickRegionSelect = document.getElementById('quickRegionSelect');
      this.quickSizeNote = document.getElementById('quickSizeNote');
      this.quickRegionRow = document.getElementById('quickRegionRow');
      this.findingMatch = false;
      this.filterMission = document.getElementById('filterMission');
      this.filterPlanet = document.getElementById('filterPlanet');
      this.filterDifficulty = document.getElementById('filterDifficulty');
      this.filterRegion = document.getElementById('filterRegion');
      this.filterOpenOnly = document.getElementById('filterOpenOnly');
      this.filterMode = document.getElementById('filterMode');
      this.filterSize = document.getElementById('filterSize');
      this.squadDetails = document.getElementById('squadDetails');
      this.squadName = document.getElementById('squadName');
      this.squadStatus = document.getElementById('squadStatus');
      this.squadMission = document.getElementById('squadMission');
      this.squadPlanet = document.getElementById('squadPlanet');
      this.squadDifficulty = document.getElementById('squadDifficulty');
      this.squadLanguage = document.getElementById('squadLanguage');
      this.squadMeta = document.getElementById('squadMeta');
      this.leaderName = document.getElementById('leaderName');
      this.leaderMeta = document.getElementById('leaderMeta');
      this.leaderBadges = document.getElementById('leaderBadges');
      this.playerCount = document.getElementById('playerCount');
      this.playersList = document.getElementById('playersList');
      this.readyBtn = document.getElementById('readyBtn');
      this.leaveBtn = document.getElementById('leaveBtn');
      this.chatMessages = document.getElementById('chatMessages');
      this.chatInput = document.getElementById('chatInput');
      this.sendChatBtn = document.getElementById('sendChatBtn');
      this.createSquadModal = document.getElementById('createSquadModal');
      this.closeModalBtn = document.getElementById('closeModalBtn');
      this.cancelCreateBtn = document.getElementById('cancelCreateBtn');
      this.confirmCreateBtn = document.getElementById('confirmCreateBtn');
      this.squadNameInput = document.getElementById('squadNameInput');
      this.squadMissionSelect = document.getElementById('squadMissionSelect');
      this.squadPlanetSelect = document.getElementById('squadPlanetSelect');
      this.squadDifficultySelect = document.getElementById('squadDifficultySelect');
      this.squadRegionSelect = document.getElementById('squadRegionSelect');
      this.squadLanguageSelect = document.getElementById('squadLanguageSelect');
      this.squadSizeSelect = document.getElementById('squadSizeSelect');
      this.squadModeSelect = document.getElementById('squadModeSelect');
      this.closeSquadBtn = document.getElementById('closeSquadBtn');
      this.squadActions = document.getElementById('squadActions');
      this.updateSquadBtn = document.getElementById('updateSquadBtn');
      this.kickPlayerBtn = document.getElementById('kickPlayerBtn');
      this.kickModal = document.getElementById('kickModal');
      this.closeKickModalBtn = document.getElementById('closeKickModalBtn');
      this.cancelKickBtn = document.getElementById('cancelKickBtn');
      this.confirmKickBtn = document.getElementById('confirmKickBtn');
      this.kickPlayerSelect = document.getElementById('kickPlayerSelect');
      this.squadCount = document.getElementById('squadCount');
    }

    initEventListeners() {
      this.playerForm.addEventListener('submit', (e) => { e.preventDefault(); this.connect(); });
      if (this.switchPlayerBtn) this.switchPlayerBtn.addEventListener('click', () => this.switchProfile());
      this.createSquadBtn.addEventListener('click', () => this.openCreateModal());
      if (this.quickMatchBtn) this.quickMatchBtn.addEventListener('click', () => this.openQuickMatchModal());
      if (this.closeQuickMatchBtn) this.closeQuickMatchBtn.addEventListener('click', () => this.closeQuickMatchModal());
      if (this.cancelQuickMatchBtn) this.cancelQuickMatchBtn.addEventListener('click', () => this.closeQuickMatchModal());
      if (this.confirmQuickMatchBtn) this.confirmQuickMatchBtn.addEventListener('click', () => this.confirmQuickMatch());
      if (this.quickSizeSelect) this.quickSizeSelect.addEventListener('change', () => this.updateQuickSizeFields());
      this.closeModalBtn.addEventListener('click', () => this.closeCreateModal());
      this.cancelCreateBtn.addEventListener('click', () => this.closeCreateModal());
      this.confirmCreateBtn.addEventListener('click', () => this.createSquad());
      this.squadNameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.createSquad(); });
      this.chatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.sendChat(); });
      this.sendChatBtn.addEventListener('click', () => this.sendChat());
      this.readyBtn.addEventListener('click', () => this.toggleReady());
      this.leaveBtn.addEventListener('click', () => this.leaveSquad());
      this.closeSquadBtn.addEventListener('click', () => this.backToList());
      this.filterMission.addEventListener('change', () => this.applyFilters());
      this.filterPlanet.addEventListener('change', () => this.applyFilters());
      this.filterDifficulty.addEventListener('change', () => this.applyFilters());
      this.filterOpenOnly.addEventListener('change', () => this.applyFilters());
      this.filterMode.addEventListener('change', () => this.applyFilters());
      this.filterSize.addEventListener('change', () => this.applyFilters());
      this.updateSquadBtn.addEventListener('click', () => this.openUpdateModal());
      this.kickPlayerBtn.addEventListener('click', () => this.openKickModal());
      this.closeKickModalBtn.addEventListener('click', () => this.closeKickModal());
      this.cancelKickBtn.addEventListener('click', () => this.closeKickModal());
      this.confirmKickBtn.addEventListener('click', () => this.confirmKick());
    }

    // ---- Remembered profile (auto-login / remember me) ----
    loadSavedProfile() {
      try {
        const raw = localStorage.getItem('squad_finder_profile');
        if (!raw) return null;
        const p = JSON.parse(raw);
        if (!p || !p.username || !this.isValidTennoName(p.username)) return null;
        return p;
      } catch (e) {
        return null;
      }
    }

    saveProfile(profile) {
      try {
        localStorage.setItem('squad_finder_profile', JSON.stringify({
          username: profile.username,
          masteryRank: profile.masteryRank,
          platform: profile.platform,
          region: profile.region,
          clanTag: profile.clanTag,
          savedAt: Date.now()
        }));
      } catch (e) { /* storage unavailable (e.g. private mode) — auto-login just stays off */ }
    }

    clearSavedProfile() {
      try { localStorage.removeItem('squad_finder_profile'); } catch (e) { /* ignore */ }
    }

    isValidTennoName(name) {
      return typeof name === 'string' && name.length >= 2 && name.length <= 20 &&
        /^[a-zA-Z0-9_\-\[\]]+$/.test(name);
    }

    initSavedProfile() {
      const saved = this.loadSavedProfile();
      if (!saved) return;
      this.prefillForm(saved);
      // Auto-login: skip the setup screen and reconnect with the remembered profile.
      this.connect(saved);
    }

    prefillForm(profile) {
      if (!profile) return;
      this.playerNameInput.value = profile.username || '';
      this.playerMRInput.value = profile.masteryRank != null ? profile.masteryRank : '';
      this.playerPlatformSelect.value = profile.platform || 'PC';
      this.playerRegionSelect.value = profile.region || 'EU';
      if (this.playerClanInput) this.playerClanInput.value = profile.clanTag || '';
    }

    profileFromForm() {
      const name = this.playerNameInput.value.trim();
      if (!name) { this.showNotification('Please enter your Tenno name', 'warning'); return null; }
      if (name.length < 2 || name.length > 20) {
        this.showNotification('Name must be 2-20 characters', 'warning');
        return null;
      }
      if (!/^[a-zA-Z0-9_\-\[\]]+$/.test(name)) {
        this.showNotification('Name can only contain letters, numbers, underscores, hyphens, and brackets', 'warning');
        return null;
      }
      return {
        username: name,
        masteryRank: parseInt(this.playerMRInput.value, 10) || 1,
        platform: this.playerPlatformSelect.value,
        region: this.playerRegionSelect.value,
        clanTag: this.playerClanInput ? this.playerClanInput.value.trim() : ''
      };
    }

    buildPlayer(profile) {
      return {
        id: 'player_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11),
        username: profile.username,
        masteryRank: profile.masteryRank || 1,
        platform: profile.platform || 'PC',
        region: profile.region || 'EU',
        language: 'English',
        clanTag: profile.clanTag || '',
        verificationLevel: 'none',
        trustScore: 50,
        totalMissions: 0,
        onlineStatus: 'online',
        lastActive: new Date().toISOString(),
        isPremium: false,
        reports: 0,
        banned: false
      };
    }

    connect(savedProfile) {
      const profile = savedProfile || this.profileFromForm();
      if (!profile) return;
      this.activeProfile = profile;
      this.player = this.buildPlayer(profile);

      this.setupPanel.style.display = 'none';
      this.mainPanel.style.display = 'block';
      this.updateStatus('connecting', 'Connecting...');

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = protocol + '//' + window.location.host + '/api/v1/squad/ws';

      try {
        this.ws = new WebSocket(wsUrl);
        this.ws.onopen = () => {
          this.updateStatus('connected', 'Connected');
          this.reconnectAttempts = 0;
          this.send('join_finder', { player: this.player });
          this.send('get_filter_options', {});
          if (this.switchPlayerBtn) this.switchPlayerBtn.style.display = 'inline-flex';
          this.saveProfile(profile); // remember me — auto-login on the next visit
        };
        this.ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            this.handleMessage(msg);
          } catch (e) {
            console.error('Failed to parse message:', e);
          }
        };
        this.ws.onerror = () => this.updateStatus('error', 'Connection error');
        this.ws.onclose = () => { this.updateStatus('disconnected', 'Disconnected'); this.attemptReconnect(); };
      } catch (error) {
        this.updateStatus('error', 'Failed to connect');
        this.attemptReconnect();
      }
    }

    attemptReconnect() {
      if (this.reconnectAttempts < this.maxReconnectAttempts && this.activeProfile) {
        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
        this.updateStatus('reconnecting', 'Reconnecting in ' + (delay / 1000) + 's...');
        setTimeout(() => {
          if (this.activeProfile) this.connect(this.activeProfile);
        }, delay);
      } else {
        // Give up: drop back to the setup screen with the profile prefilled.
        this.showSetup();
        this.updateStatus('error', 'Connection failed — try again');
      }
    }

    showSetup() {
      this.player = null;
      if (this.activeProfile) this.prefillForm(this.activeProfile);
      this.setupPanel.style.display = 'block';
      this.mainPanel.style.display = 'none';
      if (this.switchPlayerBtn) this.switchPlayerBtn.style.display = 'none';
    }

    switchProfile() {
      if (this.activeProfile) this.prefillForm(this.activeProfile); // keep values editable
      this.clearSavedProfile();
      this.activeProfile = null;
      if (this.ws) {
        this.ws.onclose = null; // don't auto-reconnect while switching
        try { this.ws.close(); } catch (e) { /* already closed */ }
        this.ws = null;
      }
      this.currentSquad = null;
      this.showSetup();
      this.updateStatus('disconnected', 'Offline');
    }

    send(event, data) {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ event: event, data: data }));
      }
    }

    handleMessage(msg) {
      if (!msg || !msg.event) return;
      const { event, data } = msg;
      switch (event) {
        case 'squad_list': this.renderSquadList(data.squads || []); break;
        case 'squad_created': this.onSquadCreated(data); break;
        case 'squad_joined': this.onSquadJoined(data); break;
        case 'squad_left': this.onSquadLeft(); break;
        case 'player_joined': this.onPlayerJoined(data); break;
        case 'player_left': this.onPlayerLeft(data); break;
        case 'player_kicked': this.onPlayerKicked(data); break;
        case 'ready_update': this.onReadyUpdate(data); break;
        case 'squad_updated': this.onSquadUpdated(data); break;
        case 'chat_message': this.onChatMessage(data); break;
        case 'player_count': this.onlineCount.textContent = (data.online || 0) + ' online'; break;
        case 'filter_options': this.onFilterOptions(data); break;
        case 'kicked': this.onKicked(); this.updateStatus('disconnected', 'Kicked'); break;
        case 'match_found': this.onMatchFound(data); break;
        case 'error': this.showNotification(data && data.message ? data.message : 'An error occurred', 'error'); break;
        default: console.log('Unknown event:', event, data);
      }
    }

    renderSquadList(squads) {
      const filtered = this.filterSquads(squads);
      if (filtered.length === 0) {
        this.squadList.innerHTML = '<div class="squad-empty"><i class="fa-solid fa-search"></i><p>No squads found. Create one to get started!</p></div>';
        this.squadCount.textContent = '0';
        return;
      }
      this.squadCount.textContent = filtered.length;
      this.squadList.innerHTML = filtered.map((s) => this.renderSquadCard(s)).join('');
    }

    renderSquadCard(squad) {
      const players = squad.players || [];
      const leader = players.find((p) => p.id === squad.leaderId);
      const leaderName = leader ? leader.username : 'Unknown';
      const readyCount = players.filter((p) => p.isReady).length;
      const openSlot = squad.maxPlayers - players.length;
      const isFull = squad.status === 'full';
      return '<div class="squad-card" data-squad-id="' + squad.id + '">' +
        '<div class="squad-card-header">' +
          '<h4 class="squad-card-name">' + this.escapeHtml(squad.name || 'Unnamed Squad') + '</h4>' +
          '<span class="squad-card-status ' + (isFull ? 'full' : 'open') + '">' + (isFull ? 'Full' : openSlot + ' slot' + (openSlot !== 1 ? 's' : '')) + '</span>' +
        '</div>' +
        '<div class="squad-card-mission"><i class="fa-solid fa-flag"></i> ' + this.escapeHtml(squad.missionType || '') + '</div>' +
        '<div class="squad-card-planet"><i class="fa-solid fa-globe"></i> ' + this.escapeHtml(squad.planet || '') + '</div>' +
        '<div class="squad-card-diff"><i class="fa-solid fa-lock"></i> ' + this.escapeHtml(squad.difficulty || '') + '</div>' +
        '<div class="squad-card-mode"><i class="fa-solid fa-gavel"></i> ' + (squad.mode === 'serious' ? 'Serious' : 'Casual') + '</div>' +
        '<div class="squad-card-meta">' +
          '<span class="squad-card-size"><i class="fa-solid fa-user-group"></i> ' + players.length + '/' + squad.maxPlayers + ' ' + (squad.maxPlayers === 4 ? '4-player' : '6-player') + '</span>' +
          '<span class="squad-card-ready"><i class="fa-solid fa-check-circle"></i> ' + readyCount + ' ready</span>' +
        '</div>' +
        '<div class="squad-card-leader">' +
          '<i class="fa-solid fa-user-check"></i> Led by ' + this.escapeHtml(leaderName) +
        '</div>' +
      '</div>';
    }

    filterSquads(squads) {
      return squads.filter((s) => {
        if (this.filterOpenOnly.checked && s.status === 'full') return false;
        if (this.filterMission.value && s.missionType !== this.filterMission.value) return false;
        if (this.filterPlanet.value && s.planet !== this.filterPlanet.value) return false;
        if (this.filterDifficulty.value && s.difficulty !== this.filterDifficulty.value) return false;
        if (this.filterMode.value && s.mode !== this.filterMode.value) return false;
        if (this.filterSize.value) {
          const size = parseInt(this.filterSize.value);
          if (s.squadSize && s.squadSize !== size) return false;
        }
        return true;
      });
    }

    applyFilters() {
      if (this.currentSquad) this.backToList();
      this.send('get_squad_list', { filters: this.getFilterState() });
    }

    getFilterState() {
      return {
        missionType: this.filterMission.value,
        planet: this.filterPlanet.value,
        difficulty: this.filterDifficulty.value,
        mode: this.filterMode.value,
        squadSize: this.filterSize.value ? parseInt(this.filterSize.value) : 0,
        openOnly: this.filterOpenOnly.checked
      };
    }

    openCreateModal() {
      this.squadNameInput.value = '';
      this.populateSelect(this.squadMissionSelect, this.filterOptions.missions || []);
      this.populateSelect(this.squadPlanetSelect, this.filterOptions.planets || []);
      this.populateSelect(this.squadDifficultySelect, this.filterOptions.difficulties || []);
      this.populateSelect(this.squadRegionSelect, this.filterOptions.regions || []);
      this.populateSelect(this.squadLanguageSelect, this.filterOptions.languages || []);
      // Populate squad size and mode
      if (!this.squadSizeSelect.options.length || this.squadSizeSelect.options[0].text !== '4 Players') {
        this.squadSizeSelect.innerHTML = '<option value="6">6 Players (Standard)</option><option value="4">4 Players (Quick)</option>';
      }
      if (!this.squadModeSelect.options.length || this.squadModeSelect.options[0].text !== 'Casual') {
        this.squadModeSelect.innerHTML = '<option value="casual">Casual</option><option value="serious">Serious</option>';
      }
      this.createSquadModal.style.display = 'flex';
    }

    closeCreateModal() {
      this.createSquadModal.style.display = 'none';
    }

    openQuickMatchModal() {
      if (this.currentSquad) { this.showNotification('You are already in a squad', 'warning'); return; }
      if (!this.quickMatchModal) return;
      this.populateQuickSelect(this.quickMissionSelect, this.filterOptions.missions || []);
      this.populateQuickSelect(this.quickPlanetSelect, this.filterOptions.planets || []);
      this.populateQuickSelect(this.quickDifficultySelect, this.filterOptions.difficulties || []);
      this.populateQuickSelect(this.quickRegionSelect, this.filterOptions.regions || []);
      this.updateQuickSizeFields();
      this.quickMatchModal.style.display = 'flex';
    }

    closeQuickMatchModal() {
      if (this.quickMatchModal) this.quickMatchModal.style.display = 'none';
    }

    populateQuickSelect(select, options) {
      if (!select) return;
      select.innerHTML = '<option value="">Any</option>' + options.map((o) => '<option>' + this.escapeHtml(o) + '</option>').join('');
    }

    // 6-player squads always run the same fixed mission/planet/difficulty,
    // so those filters are hidden and replaced with a "not relevant" note.
    updateQuickSizeFields() {
      const standard = this.quickSizeSelect && parseInt(this.quickSizeSelect.value, 10) === 6;
      document.querySelectorAll('.squad-quick-optional').forEach((el) => { el.style.display = standard ? 'none' : ''; });
      if (this.quickSizeNote) this.quickSizeNote.style.display = standard ? 'flex' : 'none';
      if (this.quickRegionRow) this.quickRegionRow.classList.toggle('squad-form-row--single', !!standard);
    }

    confirmQuickMatch() {
      if (this.findingMatch) return;
      if (this.currentSquad) { this.showNotification('You are already in a squad', 'warning'); return; }
      this.findingMatch = true;
      if (this.confirmQuickMatchBtn) { this.confirmQuickMatchBtn.disabled = true; }
      const size = this.quickSizeSelect ? parseInt(this.quickSizeSelect.value, 10) || 6 : 6;
      const standard = size === 6; // mission/planet/difficulty are fixed for 6-player squads
      this.send('find_match', {
        mode: this.quickModeSelect ? this.quickModeSelect.value : 'casual',
        squadSize: size,
        mission: standard ? '' : (this.quickMissionSelect ? this.quickMissionSelect.value : ''),
        planet: standard ? '' : (this.quickPlanetSelect ? this.quickPlanetSelect.value : ''),
        difficulty: standard ? '' : (this.quickDifficultySelect ? this.quickDifficultySelect.value : ''),
        region: this.quickRegionSelect ? this.quickRegionSelect.value : ''
      });
      this.closeQuickMatchModal();
      this.showNotification('Searching for a squad...', 'info');
      setTimeout(() => this.resetQuickMatchBtn(), 9000);
    }

    resetQuickMatchBtn() {
      this.findingMatch = false;
      if (this.confirmQuickMatchBtn) { this.confirmQuickMatchBtn.disabled = false; }
    }

    populateSelect(select, options) {
      select.innerHTML = '<option value="">Select...</option>' + options.map((o) => '<option value="' + this.escapeHtml(o) + '">' + this.escapeHtml(o) + '</option>').join('');
    }

    createSquad() {
      const name = this.squadNameInput.value.trim();
      const mission = this.squadMissionSelect.value;
      const planet = this.squadPlanetSelect.value;
      const difficulty = this.squadDifficultySelect.value;
      const region = this.squadRegionSelect.value;
      const language = this.squadLanguageSelect.value;

      if (!name) { this.showNotification('Please enter a squad name', 'warning'); return; }
      if (!mission) { this.showNotification('Please select a mission type', 'warning'); return; }
      if (!planet) { this.showNotification('Please select a planet', 'warning'); return; }
      if (!difficulty) { this.showNotification('Please select a difficulty', 'warning'); return; }
      if (!region) { this.showNotification('Please select a region', 'warning'); return; }

      this.send('create_squad', {
        name: name,
        missionType: mission,
        planet: planet,
        difficulty: difficulty,
        region: region,
        language: language || 'English',
        maxPlayers: parseInt(this.squadSizeSelect.value) || 6,
        mode: this.squadModeSelect.value || 'casual',
        squadSize: parseInt(this.squadSizeSelect.value) || 6
      });
      this.closeCreateModal();
    }

    joinSquad(squadId) {
      this.send('join_squad', { squadId: squadId });
    }

    leaveSquad() {
      if (this.currentSquad) {
        this.send('leave_squad', { squadId: this.currentSquad.id });
      }
    }

    toggleReady() {
      if (this.currentSquad) {
        this.send('toggle_ready', { squadId: this.currentSquad.id });
      }
    }

    sendChat() {
      const message = this.chatInput.value.trim();
      if (!message) return;
      if (message.length > 500) {
        this.showNotification('Message too long (max 500 chars)', 'warning');
        return;
      }
      this.send('chat_message', { squadId: this.currentSquad ? this.currentSquad.id : '', content: message });
      this.chatInput.value = '';
    }

    onSquadCreated(data) {
      this.currentSquad = data;
      this.squadDetails.style.display = 'block';
      this.squadListContainer.style.display = 'none';
      this.renderSquadDetails(data);
      this.addSystemMessage('Squad "' + data.name + '" created!')
    }

    onMatchFound(data) {
      this.resetQuickMatchBtn();
      const squad = (data && data.squad) ? data.squad : data;
      if (!squad || !squad.id) { this.showNotification('No match found, try again', 'warning'); return; }
      this.currentSquad = squad;
      this.squadDetails.style.display = 'block';
      this.squadListContainer.style.display = 'none';
      this.renderSquadDetails(squad);
      this.enableChat();
      if (data && data.created) { this.addSystemMessage('No open squad matched, started a new one for you!'); }
      else { this.addSystemMessage('Quick match found! Welcome!'); }
    }

        onSquadJoined(data) {
      this.currentSquad = data;
      this.squadDetails.style.display = 'block';
      this.squadListContainer.style.display = 'none';
      this.renderSquadDetails(data);
      this.addSystemMessage('Joined ' + data.name + '! Welcome!');
    }

    onSquadLeft() {
      this.currentSquad = null;
      this.squadDetails.style.display = 'none';
      this.squadListContainer.style.display = 'block';
      this.disableChat();
      this.send('get_squad_list', { filters: this.getFilterState() });
    }

    onPlayerJoined(data) {
      if (data.squad) { this.currentSquad = data.squad; }
      if (this.currentSquad) {
        this.renderSquadDetails(this.currentSquad);
        const name = data.username || (data.player && data.player.username) || 'Someone';
        this.addSystemMessage(name + ' joined the squad!');
      }
    }

    onPlayerLeft(data) {
      if (data.squad) { this.currentSquad = data.squad; }
      if (this.currentSquad) {
        this.renderSquadDetails(this.currentSquad);
        this.addSystemMessage(data.username + ' left the squad.');
      }
    }

    onPlayerKicked(data) {
      if (data.squad) { this.currentSquad = data.squad; }
      if (this.currentSquad) {
        this.renderSquadDetails(this.currentSquad);
        const name = data.kickedUsername || data.username || 'A player';
        this.addSystemMessage(name + ' was kicked from the squad.');
      }
      if ((data.kickedUsername || data.username) === this.player.username) {
        this.onSquadLeft();
        this.showNotification('You were kicked from the squad', 'error');
      }
    }

    onReadyUpdate(data) {
      if (data.squad) { this.currentSquad = data.squad; }
      if (this.currentSquad) {
        this.renderSquadDetails(this.currentSquad);
      }
    }

    onSquadUpdated(data) {
      if (this.currentSquad && this.currentSquad.id === data.id) {
        this.currentSquad = data;
        this.renderSquadDetails(data);
        this.addSystemMessage('Squad settings updated!');
      }
    }

    onChatMessage(data) {
      if (this.currentSquad && this.currentSquad.id === data.squadId) {
        this.addChatMessage(data);
      }
    }

    onFilterOptions(data) {
      this.filterOptions = data;
      this.populateSelect(this.filterMission, data.missions || []);
      this.populateSelect(this.filterPlanet, data.planets || []);
      this.populateSelect(this.filterDifficulty, data.difficulties || []);
      this.populateSelect(this.filterRegion, data.regions || []);
    }

    onKicked() {
      this.player = null;
      this.setupPanel.style.display = 'block';
      this.mainPanel.style.display = 'none';
      this.updateStatus('disconnected', 'Disconnected');
    }

    renderSquadDetails(squad) {
      if (!squad) return;
      this.squadName.textContent = squad.name || 'Unnamed Squad';
      this.squadMission.textContent = squad.missionType || 'Unknown';
      this.squadPlanet.textContent = squad.planet || 'Unknown';
      this.squadDifficulty.textContent = squad.difficulty || 'Unknown';
      this.squadLanguage.textContent = squad.language || 'English';
      this.squadStatus.textContent = squad.status === 'full' ? 'Squad Full' : 'Searching...';

      this.squadMeta.innerHTML = '<span>' + (squad.players ? squad.players.length : 0) + '/' + squad.maxPlayers + ' players</span>' +
        '<span class="squad-card-ready"><i class="fa-solid fa-check-circle"></i> ' + (squad.players ? squad.players.filter((p) => p.isReady).length : 0) + ' ready</span>';

      const leader = squad.players ? squad.players.find((p) => p.id === squad.leaderId) : null;
      if (leader) {
        this.leaderName.textContent = leader.username;
        this.leaderMeta.textContent = 'MR' + leader.masteryRank + ' | ' + leader.platform + ' | ' + leader.region;
        const trustClass = this.getTrustClass(leader.trustScore || 50);
        this.leaderBadges.innerHTML = '<span class="squad-trust ' + trustClass + '"><i class="fa-solid fa-shield"></i> ' + Math.round(leader.trustScore || 50) + '</span>';
      }

      const players = squad.players || [];
      this.playerCount.textContent = players.length + '/' + squad.maxPlayers;
      const me = players.find((p) => p.id === this.player.id);
      const isLeader = me && me.id === squad.leaderId;
      this.squadActions.style.display = isLeader ? 'block' : 'none';

      if (isLeader && this.currentSquad) {
        this.kickPlayerSelect.innerHTML = players.filter((p) => p.id !== this.player.id).map((p) =>
          '<option value="' + p.id + '">' + this.escapeHtml(p.username) + ' (MR' + p.masteryRank + ')</option>'
        ).join('');
      }

      this.playersList.innerHTML = players.map((p) => this.renderPlayerCard(p, squad.leaderId, me && me.id === p.id)).join('');

      this.readyBtn.style.display = squad.status !== 'full' ? 'inline-flex' : 'none';
      this.leaveBtn.style.display = 'inline-flex';

      if (me && me.isReady) {
        this.readyBtn.innerHTML = '<i class="fa-solid fa-check-double"></i> Ready!';
        this.readyBtn.classList.remove('squad-btn--success');
        this.readyBtn.classList.add('squad-btn--secondary');
      } else {
        this.readyBtn.innerHTML = '<i class="fa-solid fa-check"></i> Mark Ready';
        this.readyBtn.classList.remove('squad-btn--secondary');
        this.readyBtn.classList.add('squad-btn--success');
      }
      this.enableChat();
    }

    renderPlayerCard(player, leaderId, isSelf) {
      const initials = player.username.substring(0, 2).toUpperCase();
      const trustScore = player.trustScore || 50;
      const trustClass = this.getTrustClass(trustScore);
      return '<div class="squad-player">' +
        '<div class="squad-player-avatar">' + initials + '</div>' +
        '<div class="squad-player-info">' +
          '<div class="squad-player-name">' + this.escapeHtml(player.username) +
            (player.id === leaderId ? ' <span class="squad-leader-badge"><i class="fa-solid fa-crown"></i> Leader</span>' : '') +
            (isSelf ? ' <span class="squad-self-badge">You</span>' : '') +
            ' ' + verBadge + '</div>' +
          '<div class="squad-player-meta">MR' + player.masteryRank + ' | ' + player.platform + ' | ' + player.region + '</div>' +
          '<div class="squad-trust ' + trustClass + '"><i class="fa-solid fa-shield"></i> ' + Math.round(trustScore) + '</div>' +
        '</div>' +
        '<div class="squad-player-ready ' + (player.isReady ? 'ready' : '') + '" title="' + (player.isReady ? 'Ready' : 'Not ready') + '"></div>' +
      '</div>';
    }

    enableChat() {
      this.chatInput.disabled = false;
      this.sendChatBtn.disabled = false;
      this.chatInput.placeholder = 'Type a message...';
      this.chatInput.focus();
    }

    disableChat() {
      this.chatInput.disabled = true;
      this.sendChatBtn.disabled = true;
      this.chatInput.placeholder = 'Join a squad to chat...';
    }

    addChatMessage(msg) {
      const isSystem = msg.type === 'system' || msg.type === 'join' || msg.type === 'leave';
      const time = new Date(msg.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const el = document.createElement('div');
      el.className = 'squad-chat-message' + (isSystem ? ' system' : '');
      if (isSystem) {
        el.innerHTML = '<div class="squad-chat-system-text">' + this.escapeHtml(msg.content) + '</div>';
      } else {
        el.innerHTML = '<div class="squad-chat-message-header">' +
          '<span class="squad-chat-sender">' + this.escapeHtml(msg.senderName || 'Unknown') + '</span>' +
          '<span class="squad-chat-time">' + time + '</span>' +
        '</div>' +
        '<div class="squad-chat-text">' + this.escapeHtml(msg.content) + '</div>';
      }
      this.chatMessages.appendChild(el);
      this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    addSystemMessage(content) {
      this.addChatMessage({ senderName: 'System', content: content, timestamp: new Date().toISOString(), type: 'system' });
    }

    clearChat() {
      this.chatMessages.innerHTML = '<div class="squad-chat-system"><p>Welcome to the Squad Finder! Join or create a squad to start chatting.</p></div>';
    }

    updateStatus(status, text) {
      this.statusIndicator.className = 'squad-status-indicator' + (status === 'connected' ? ' connected' : '');
      this.statusText.textContent = text;
    }

    showNotification(message, type) {
      const existing = document.querySelector('.squad-notification');
      if (existing) existing.remove();
      const el = document.createElement('div');
      el.className = 'squad-notification squad-notification--' + type;
      el.textContent = message;
      const top = window.innerWidth < 768 ? 120 : 80;
      el.style.cssText = 'position:fixed;top:' + top + 'px;right:20px;z-index:99999;padding:12px 20px;border-radius:8px;' +
        'font-size:14px;max-width:320px;animation:slideIn 0.3s ease;box-shadow:0 4px 12px rgba(0,0,0,0.15);';
      document.body.appendChild(el);
      setTimeout(() => {
        el.style.opacity = '0';
        el.style.transition = 'opacity 0.3s';
        setTimeout(() => el.remove(), 300);
      }, 3000);
    }

    getTrustClass(score) {
      if (score >= 70) return 'squad-trust--high';
      if (score >= 40) return 'squad-trust--medium';
      return 'squad-trust--low';
    }

    escapeHtml(str) {
      const div = document.createElement('div');
      div.appendChild(document.createTextNode(str));
      return div.innerHTML;
    }

    openKickModal() {
      this.kickModal.style.display = 'flex';
    }

    closeKickModal() {
      this.kickModal.style.display = 'none';
    }

    confirmKick() {
      const playerId = this.kickPlayerSelect.value;
      if (playerId) {
        this.send('kick_player', { squadId: this.currentSquad.id, playerId: playerId });
        this.closeKickModal();
      }
    }

    openUpdateModal() {
      this.squadNameInput.value = this.currentSquad ? this.currentSquad.name : '';
      this.populateSelect(this.squadMissionSelect, this.filterOptions.missions || []);
      this.populateSelect(this.squadPlanetSelect, this.filterOptions.planets || []);
      this.populateSelect(this.squadDifficultySelect, this.filterOptions.difficulties || []);
      this.populateSelect(this.squadRegionSelect, this.filterOptions.regions || []);
      this.populateSelect(this.squadLanguageSelect, this.filterOptions.languages || []);
      // Populate squad size and mode
      if (!this.squadSizeSelect.options.length || this.squadSizeSelect.options[0].text !== '4 Players') {
        this.squadSizeSelect.innerHTML = '<option value="6">6 Players (Standard)</option><option value="4">4 Players (Quick)</option>';
      }
      if (!this.squadModeSelect.options.length || this.squadModeSelect.options[0].text !== 'Casual') {
        this.squadModeSelect.innerHTML = '<option value="casual">Casual</option><option value="serious">Serious</option>';
      }
      if (this.currentSquad) {
        this.squadMissionSelect.value = this.currentSquad.missionType || '';
        this.squadPlanetSelect.value = this.currentSquad.planet || '';
        this.squadDifficultySelect.value = this.currentSquad.difficulty || '';
        this.squadRegionSelect.value = this.currentSquad.region || '';
        this.squadLanguageSelect.value = this.currentSquad.language || '';
      }
      this.createSquadModal.style.display = 'flex';
      this.confirmCreateBtn.textContent = 'Update Squad';
      this.confirmCreateBtn.onclick = () => this.updateSquad();
    }

    updateSquad() {
      if (!this.currentSquad) return;
      const name = this.squadNameInput.value.trim();
      if (!name) { this.showNotification('Please enter a squad name', 'warning'); return; }
      this.send('update_squad', {
        squadId: this.currentSquad.id,
        name: name,
        missionType: this.squadMissionSelect.value,
        planet: this.squadPlanetSelect.value,
        difficulty: this.squadDifficultySelect.value,
        region: this.squadRegionSelect.value,
        language: this.squadLanguageSelect.value,
        squadSize: parseInt(this.squadSizeSelect.value) || 6,
        mode: this.squadModeSelect.value || 'casual'
      });
      this.closeCreateModal();
      this.confirmCreateBtn.textContent = 'Create Squad';
      this.confirmCreateBtn.onclick = () => this.createSquad();
    }

    backToList() {
      this.currentSquad = null;
      this.squadDetails.style.display = 'none';
      this.squadListContainer.style.display = 'block';
      this.disableChat();
      this.send('get_squad_list', { filters: this.getFilterState() });
    }
  }

  // Initialize when DOM is ready
  document.addEventListener('DOMContentLoaded', function() {
    window.squadFinder = new SquadFinderClient();

    // Info button
    document.getElementById('infoBtn').addEventListener('click', function() {
      document.getElementById('infoModal').style.display = 'flex';
    });

    document.getElementById('closeInfoModalBtn').addEventListener('click', function() {
      document.getElementById('infoModal').style.display = 'none';
    });

    // Close modals on outside click
    document.querySelectorAll('.squad-modal').forEach(function(modal) {
      modal.addEventListener('click', function(e) {
        if (e.target === modal) {
          modal.style.display = 'none';
        }
      });
    });

    // Close modals on Escape
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        document.querySelectorAll('.squad-modal[style*="flex"]').forEach(function(modal) {
          modal.style.display = 'none';
        });
      }
    });

    // Add CSS animations
    var style = document.createElement('style');
    style.textContent = '@keyframes slideIn { from { transform: translateX(400px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }';
    document.head.appendChild(style);

    // Handle squad card clicks (delegated)
    document.getElementById('squadList').addEventListener('click', function(e) {
      var card = e.target.closest('.squad-card');
      if (card && window.squadFinder) {
        var squadId = card.getAttribute('data-squad-id');
        if (squadId) window.squadFinder.joinSquad(squadId);
      }
    });

    // Request filter options on load
    setTimeout(function() {
      if (window.squadFinder && window.squadFinder.ws && window.squadFinder.ws.readyState === WebSocket.OPEN) {
        window.squadFinder.send('get_filter_options', {});
      }
    }, 500);
  });
})();
