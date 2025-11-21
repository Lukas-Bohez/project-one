/* donationProgress.js
   Simple donation progress bar updater
   Edit the EASY_CONFIG values below to update the progress bar
*/

(function () {
  'use strict';

  // ==================================================================
  // 🎯 EASY CONFIG - EDIT THESE VALUES TO UPDATE THE PROGRESS BAR
  // ==================================================================
  const EASY_CONFIG = {
    currentAmount: 114,  // 👈 UPDATE THIS: Current amount raised
    goalAmount: 150,    // 👈 UPDATE THIS: Goal amount
  };
  // ==================================================================

  // Update progress bar on page load
  document.addEventListener('DOMContentLoaded', function () {
    const progressBar = document.getElementById('donation-progress');
    if (progressBar) {
      progressBar.max = EASY_CONFIG.goalAmount;
      progressBar.value = Math.min(EASY_CONFIG.currentAmount, EASY_CONFIG.goalAmount);
      progressBar.setAttribute('aria-valuenow', String(Math.min(EASY_CONFIG.currentAmount, EASY_CONFIG.goalAmount)));
      progressBar.setAttribute('aria-valuemax', String(EASY_CONFIG.goalAmount));
      progressBar.setAttribute('aria-label', `Funding progress ${EASY_CONFIG.currentAmount} of ${EASY_CONFIG.goalAmount}`);
    }
  });

})();
