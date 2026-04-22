(function syncAppVersion() {
  'use strict';

  var REPO = 'Lukas-Bohez/ConvertTheSpireFlutter';
  var API = 'https://api.github.com/repos/' + REPO + '/releases/latest';
  var DOWNLOAD_BASE = 'https://github.com/' + REPO + '/releases/download';

  fetch(API)
    .then(function (response) {
      if (!response.ok) throw new Error('Version sync failed');
      return response.json();
    })
    .then(function (payload) {
      var tag = payload && payload.tag_name;
      if (!tag) return;

      document.querySelectorAll('[data-version]').forEach(function (node) {
        node.textContent = tag;
      });

      document.querySelectorAll('[data-release-link]').forEach(function (link) {
        link.href = 'https://github.com/' + REPO + '/releases/tag/' + tag;
      });

      var downloads = {
        '[data-download-win]': tag + '/ConvertTheSpireReborn-windows-x64.zip',
        '[data-download-android]': tag + '/ConvertTheSpireReborn.apk',
        '[data-download-linux]': tag + '/ConvertTheSpireReborn-linux-x64.zip',
        '[data-download-mac]': tag + '/ConvertTheSpireReborn-macOS.zip',
        '[data-download-sha]': tag + '/SHA256SUMS.txt'
      };

      Object.keys(downloads).forEach(function (selector) {
        document.querySelectorAll(selector).forEach(function (link) {
          link.href = DOWNLOAD_BASE + '/' + downloads[selector];
        });
      });
    })
    .catch(function () {
      // Keep HTML fallback values when API is unavailable.
    });
}());