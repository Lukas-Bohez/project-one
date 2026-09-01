/**
 * offline-progress.patch.js
 * -----------------------------------------------------------------------
 * Same calculateOfflineProgress(offlineSeconds) signature, same
 * 60-second floor, same 50% offline-efficiency design, same resource
 * math and variable names as the current implementation (around line
 * 4348) — the only change is a capped elapsed time, so a player away
 * for a week doesn't get a week's worth of resources. Right now there's
 * no upper bound at all.
 *
 * Scoped the same way the original is: only stone/coal/iron/silver from
 * miners. It does NOT cover gold, crafted items, or city-building
 * production while offline — that's true of the code today too, not a
 * regression introduced here. Worth a separate product decision on
 * whether that scope should widen.
 */
calculateOfflineProgress(offlineSeconds) {
  const OFFLINE_CAP_SECONDS = 12 * 3600; // 12h placeholder — pick the real value with Lukas
  const cappedSeconds = Math.min(offlineSeconds, OFFLINE_CAP_SECONDS);
  const wasCapped = offlineSeconds > OFFLINE_CAP_SECONDS;

  if (cappedSeconds > 60) {
    // Calculate offline stone production from miners
    const stoneMinerRate =
      (this.state.workers?.stoneMiners || 0) *
      1 *
      this.state.efficiency.mining *
      this.state.efficiency.global;
    const coalMinerRate =
      (this.state.workers?.coalMiners || 0) *
      0.5 *
      this.state.efficiency.mining *
      this.state.efficiency.global;
    const ironMinerRate =
      (this.state.workers?.ironMiners || 0) *
      0.25 *
      this.state.efficiency.mining *
      this.state.efficiency.global;
    const silverMinerRate =
      (this.state.workers?.silverMiners || 0) *
      0.1 *
      this.state.efficiency.mining *
      this.state.efficiency.global;

    // Apply 50% offline efficiency penalty
    const offlineEfficiency = 0.5;
    const stoneGained = stoneMinerRate * cappedSeconds * offlineEfficiency;
    const coalGained = coalMinerRate * cappedSeconds * offlineEfficiency;
    const ironGained = ironMinerRate * cappedSeconds * offlineEfficiency;
    const silverGained = silverMinerRate * cappedSeconds * offlineEfficiency;

    this.state.resources.stone += stoneGained;
    this.state.resources.coal += coalGained;
    this.state.resources.iron += ironGained;
    this.state.resources.silver += silverGained;

    const totalGained = stoneGained + coalGained + ironGained + silverGained;
    if (totalGained > 0) {
      const capNote = wasCapped ? ` (capped at ${OFFLINE_CAP_SECONDS / 3600}h)` : '';
      this.showNotification(
        `⏰ Offline for ${this.formatTime(offlineSeconds)}${capNote} - gained resources at 50% rate!`
      );
      console.log(
        `Offline for ${this.formatTime(offlineSeconds)}${capNote}, gained ${Math.floor(stoneGained)} stone, ${Math.floor(coalGained)} coal, ${Math.floor(ironGained)} iron, ${Math.floor(silverGained)} silver`
      );
    }
  }
}

// Note: the display label uses the UNCAPPED offlineSeconds (via
// formatTime) so the player still sees an honest "you were away for
// 4 days" even though the resource math only counted the first 12
// hours of it — that distinction is deliberate, not a bug.
