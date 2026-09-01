/**
 * ArcadeManager.js - Manages DOS games arcade integration
 * Players can play classic DOS games to boost their idle game progress
 *
 * FIXED (see code_quality_audit.md, "Arcade / DOS games integration"):
 *  1. `executable` is now `launchCommands` (a string array). The old single
 *     string used shell-style `cd X && Y.EXE` chaining - COMMAND.COM has no
 *     `&&` operator, so that whole line was passed to DOS as one invalid
 *     command for every game except digger (which had no `cd` in it and so
 *     happened to work). js-dos runs one DOS command per "-c" flag it's
 *     given (see openDosGame() in idlegame.html), so a game that needs a
 *     directory change now lists that as its own array element.
 *  2. Added `controls` to each game so the pre-launch tutorial overlay can
 *     show real, game-specific instructions instead of nothing.
 *  3. Added ARCADE_PLAYTESTING_MODE as one named switch instead of four
 *     scattered "FREE for playtesting" comments. The unlock-gating logic
 *     below (canUnlockGame/unlockGame) already fully implements real
 *     cost/level gating - flip this one flag off, and fill in real
 *     unlockCost/unlockLevel values per game, when arcade is ready to be a
 *     progression reward rather than an always-on bonus. That's a game
 *     design decision (what the costs/levels should actually be), so it's
 *     left as an explicit decision point rather than guessed at here.
 */

// Set to false once real unlock costs/levels (below) are decided and
// filled in. While true, every game in `games` is unlocked at zero cost
// regardless of its configured unlockCost/unlockLevel.
const ARCADE_PLAYTESTING_MODE = true;

class ArcadeManager {
  constructor(gameEngine) {
    this.gameEngine = gameEngine;
    this.state = gameEngine.state;

    // Initialize arcade state
    if (!this.state.arcade) {
      this.state.arcade = {
        unlockedGames: ARCADE_PLAYTESTING_MODE
          ? ['doom', 'digger', 'commander', 'prince']
          : [],
        playTime: {}, // Track time played per game
        highScores: {}, // Future: track high scores
        totalPlayTime: 0,
        activeGame: null,
        gameStartTime: null,
      };
    }

    // Define available games
    this.games = {
      doom: {
        id: 'doom',
        name: 'DOOM',
        icon: '👾',
        cost: 0,
        unlockCost: 0,
        unlockLevel: 0,
        description: 'Classic FPS that defined a generation',
        zipUrl: 'dos-games/doom.zip',
        launchCommands: ['DOOM.EXE'],
        controls: 'Arrow keys to move/turn, Ctrl to fire, Space to use doors/switches, Alt (held) to strafe',
        resourceInterval: 2.5,
        bonusType: 'resourceBonus',
        bonusAmount: 0.05, // 5% resource bonus per hour
      },
      digger: {
        id: 'digger',
        name: 'Digger',
        icon: '⛏️',
        cost: 0,
        unlockCost: 0,
        unlockLevel: 0,
        description: 'Classic arcade digging action',
        zipUrl: 'dos-games/digger.zip',
        launchCommands: ['cd Digger83', 'DIGGER.COM'],
        controls: 'Arrow keys to move and dig, F1 to fire',
        cyclesLimit: 500, // Limit CPU cycles to slow down the game
        resourceInterval: 1.5, // Faster resource ticks for Digger (it IS the mining game)
        bonusType: 'craftingBonus',
        bonusAmount: 0.03, // 3% crafting bonus per hour
      },
      commander: {
        id: 'commander',
        name: 'Commander Keen 4',
        icon: '🚀',
        cost: 0,
        unlockCost: 0,
        unlockLevel: 0,
        description: 'Side-scrolling platform adventure',
        zipUrl: 'dos-games/keen4.zip',
        launchCommands: ['cd CKeen1', 'KEEN1.EXE'],
        controls: 'Arrow keys to move, Space to jump, Ctrl to fire, Alt for the pogo stick',
        resourceInterval: 3.0,
        bonusType: 'efficiencyBonus',
        bonusAmount: 0.04, // 4% efficiency bonus per hour
      },
      prince: {
        id: 'prince',
        name: 'Prince of Persia',
        icon: '🔱',
        cost: 0,
        unlockCost: 0,
        unlockLevel: 0,
        description: 'Legendary platformer with fluid animation',
        zipUrl: 'dos-games/prince.zip',
        launchCommands: ['cd Ppersia', 'PRINCE.EXE'],
        controls: 'Arrow keys to move/jump/crouch, Shift to grab ledges, draw your sword, or drink a potion',
        resourceInterval: 3.0,
        bonusType: 'goldBonus',
        bonusAmount: 0.02, // 2% gold bonus per hour
      },
    };
  }

  // Check if a game is unlocked
  isGameUnlocked(gameId) {
    return this.state.arcade.unlockedGames.includes(gameId);
  }

  // Check if a game can be unlocked
  canUnlockGame(gameId) {
    const game = this.games[gameId];
    if (!game) return false;

    const rebirths = this.state.city?.rebirths || 0;
    return (
      !this.isGameUnlocked(gameId) &&
      rebirths >= game.unlockLevel &&
      this.state.resources.gold >= game.unlockCost
    );
  }

  // Unlock a game
  unlockGame(gameId) {
    if (!this.canUnlockGame(gameId)) return false;

    const game = this.games[gameId];
    this.state.resources.gold -= game.unlockCost;
    this.state.arcade.unlockedGames.push(gameId);
    this.state.arcade.playTime[gameId] = 0;

    console.log(`🎮 Unlocked arcade game: ${game.name}`);
    if (this.gameEngine.showNotification) {
      this.gameEngine.showNotification(`🎮 Unlocked: ${game.name}!`);
    }

    return true;
  }

  // Start playing a game
  startGame(gameId) {
    if (!this.isGameUnlocked(gameId)) return false;

    this.state.arcade.activeGame = gameId;
    this.state.arcade.gameStartTime = Date.now();

    const game = this.games[gameId];
    console.log(`🎮 Starting game: ${game.name}`);

    return true;
  }

  // Stop playing a game
  stopGame() {
    if (!this.state.arcade.activeGame) return;

    const gameId = this.state.arcade.activeGame;
    const game = this.games[gameId];

    if (this.state.arcade.gameStartTime) {
      const playTime = (Date.now() - this.state.arcade.gameStartTime) / 1000; // in seconds
      this.state.arcade.playTime[gameId] = (this.state.arcade.playTime[gameId] || 0) + playTime;
      this.state.arcade.totalPlayTime += playTime;

      console.log(`🎮 Stopped ${game.name}. Played for ${Math.round(playTime)}s`);
    }

    this.state.arcade.activeGame = null;
    this.state.arcade.gameStartTime = null;
  }

  // Update arcade bonuses and generate resources (called each game tick)
  update(deltaTime) {
    // Safety check
    if (!this.state || !this.state.arcade) {
      console.warn('Arcade state not initialized');
      return;
    }

    // If a game is active, accumulate play time and generate resources
    if (this.state.arcade.activeGame && this.state.arcade.gameStartTime) {
      const gameId = this.state.arcade.activeGame;
      this.state.arcade.playTime[gameId] = (this.state.arcade.playTime[gameId] || 0) + deltaTime;
      this.state.arcade.totalPlayTime += deltaTime;

      // --- DOS GAME RESOURCE GENERATION ---
      // While a DOS game is actively being played, simulate in-game events
      // that yield real resources. This replaces the old "time = generic %"
      // system with actual materials you can see and use immediately.
      this._generateGameResources(gameId, deltaTime);
    }
  }

  /**
   * Generate real resources while a DOS game is actively being played.
   * Simulates the event-driven system described in dos-arcade-bridge.js.
   * Each game yields different resource types based on its gameplay genre:
   *
   *   Digger    – mining → Stone, Coal, Iron, Silver, Gold
   *   DOOM      – combat → hire workers
   *   Prince    – exploration → Iron, Silver, Gold
   *   Keen      – platformer → Stone, Iron, Gold (smaller amounts)
   */
  _generateGameResources(gameId, deltaTime) {
    if (!this.gameEngine || !this.gameEngine.state) return;

    const game = this.games[gameId];
    if (!game) return;

    if (!this.state.arcade._resAccum) this.state.arcade._resAccum = {};
    if (!this.state.arcade._materialsGathered) this.state.arcade._materialsGathered = {};
    this.state.arcade._resAccum[gameId] = (this.state.arcade._resAccum[gameId] || 0) + deltaTime;

    const interval = game.resourceInterval || 2.0;
    const state = this.gameEngine.state;
    const res = state.resources;
    const workers = state.workers;

    while (this.state.arcade._resAccum[gameId] >= interval) {
      this.state.arcade._resAccum[gameId] -= interval;

      switch (gameId) {
        case 'digger':
          if (Math.random() < 0.65) {
            const pick = ['stone', 'coal'][Math.floor(Math.random() * 2)];
            res[pick] = (res[pick] || 0) + 1;
            this._trackMaterial(gameId, pick, 1);
          } else {
            const pick = ['silver', 'gold'][Math.floor(Math.random() * 2)];
            const amt = pick === 'gold' ? 1 : 2;
            res[pick] = (res[pick] || 0) + amt;
            this._trackMaterial(gameId, pick, amt);
          }
          if (Math.random() < 0.10 && res.gold >= 5) {
            workers.stoneMiners = (workers.stoneMiners || 0) + 1;
            res.gold -= 5;
            this._trackMaterial(gameId, 'workers', 1);
          }
          break;

        case 'doom':
          if (Math.random() < 0.70) {
            const workerPick = ['stoneMiner', 'coalMiner'][Math.floor(Math.random() * 2)];
            workers[workerPick] = (workers[workerPick] || 0) + 1;
            this._trackMaterial(gameId, 'workers', 1);
          } else if (Math.random() < 0.50) {
            workers.ironMiners = (workers.ironMiners || 0) + 1;
            this._trackMaterial(gameId, 'workers', 1);
          } else {
            res.gold = (res.gold || 0) + 10;
            this._trackMaterial(gameId, 'gold', 10);
          }
          break;

        case 'prince':
          if (Math.random() < 0.60) {
            const pick = ['iron', 'silver'][Math.floor(Math.random() * 2)];
            res[pick] = (res[pick] || 0) + (pick === 'silver' ? 1 : 2);
            this._trackMaterial(gameId, pick, pick === 'silver' ? 1 : 2);
          } else {
            res.gold = (res.gold || 0) + 5;
            this._trackMaterial(gameId, 'gold', 5);
          }
          break;

        case 'commander':
          if (Math.random() < 0.70) {
            const pick = ['stone', 'iron'][Math.floor(Math.random() * 2)];
            res[pick] = (res[pick] || 0) + 1;
            this._trackMaterial(gameId, pick, 1);
          } else if (Math.random() < 0.30 && res.gold >= 5) {
            workers.stoneMiners = (workers.stoneMiners || 0) + 1;
            res.gold -= 5;
            this._trackMaterial(gameId, 'workers', 1);
          }
          break;
      }
    }
  }

  _trackMaterial(gameId, type, amount) {
    if (!this.state.arcade._materialsGathered) this.state.arcade._materialsGathered = {};
    if (!this.state.arcade._materialsGathered[gameId]) this.state.arcade._materialsGathered[gameId] = {};
    this.state.arcade._materialsGathered[gameId][type] = (this.state.arcade._materialsGathered[gameId][type] || 0) + amount;
  }

  getMaterialsGathered() {
    if (!this.state.arcade._materialsGathered) return {};
    const totals = {};
    Object.values(this.state.arcade._materialsGathered).forEach((perGame) => {
      Object.entries(perGame).forEach(([type, amt]) => {
        totals[type] = (totals[type] || 0) + amt;
      });
    });
    return totals;
  }

  // Calculate total arcade bonuses
  getArcadeBonuses() {
    const bonuses = {
      resourceBonus: 1.0,
      efficiencyBonus: 1.0,
      goldBonus: 1.0,
      craftingBonus: 1.0,
    };

    // Get rebirth upgrade arcade bonus multiplier
    const rebirthEffects = this.gameEngine.rebirthRewards
      ? this.gameEngine.rebirthRewards.getActiveEffects(this.state.rebirthUpgrades || {})
      : { arcadeBonus: 1, arcadeResourceGen: 0 };

    // Calculate bonuses from each game based on play time
    Object.keys(this.games).forEach((gameId) => {
      if (this.isGameUnlocked(gameId)) {
        const game = this.games[gameId];
        const playTimeHours = (this.state.arcade.playTime[gameId] || 0) / 3600; // Convert to hours

        // Each hour played adds the bonus amount, with diminishing returns (cap at 10 hours)
        const effectiveHours = Math.min(10, playTimeHours);
        const bonus = effectiveHours * game.bonusAmount * rebirthEffects.arcadeBonus;

        // Apply bonus to the appropriate category
        if (game.bonusType === 'resourceBonus') {
          bonuses.resourceBonus += bonus;
        } else if (game.bonusType === 'efficiencyBonus') {
          bonuses.efficiencyBonus += bonus;
        } else if (game.bonusType === 'goldBonus') {
          bonuses.goldBonus += bonus;
        } else if (game.bonusType === 'craftingBonus') {
          bonuses.craftingBonus += bonus;
        }
      }
    });

    // Passive resource generation from playing arcade (if upgrade purchased)
    if (rebirthEffects.arcadeResourceGen > 0 && this.state.arcade.activeGame) {
      bonuses.passiveGen = rebirthEffects.arcadeResourceGen;
    }

    return bonuses;
  }

  // Get formatted play time for a game
  getFormattedPlayTime(gameId) {
    const seconds = this.state.arcade.playTime[gameId] || 0;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }

  // Get available games to unlock
  getAvailableGames() {
    const rebirths = this.state.city?.rebirths || 0;
    return Object.entries(this.games)
      .filter(([id, game]) => rebirths >= game.unlockLevel)
      .map(([id, game]) => ({
        id,
        ...game,
        unlocked: this.isGameUnlocked(id),
        canUnlock: this.canUnlockGame(id),
        playTime: this.getFormattedPlayTime(id),
      }));
  }
}

// Export for use in other modules
window.ArcadeManager = ArcadeManager;
