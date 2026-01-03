console.log('[Convert the Spire] Background script loaded - Version 20.0');
console.log('[Convert the Spire] Extension ID:', chrome.runtime.id);

// Download all visible checked links.
chrome.runtime.onMessage.addListener(function (message) {
  console.log('[Convert the Spire] Background received message:', message);
  
  if (!message || !message.url || !message.filename) {
    console.error('[Convert the Spire] Invalid message:', message);
    return;
  }

  let fname = message.filename
    .trim()
    .replace(/[`~!@#$%^&*()_|+\-=?;:'",<>{}[\]\\/]/gi, "-")
    .replace(/[\\/:*?"<>|]/g, "_")
    .substring(0, 240)
    .replace(/\s+/g, " ");
  
  console.log('[Convert the Spire] Download filename:', fname);
  console.log('[Convert the Spire] Download URL:', message.url);

  chrome.downloads.download({
    url: message.url,
    filename: fname,
    conflictAction: "uniquify"
  }, function (downloadId) {
    // If 'downloadId' is undefined, then there is an error
    // so making sure it is not so before proceeding.
    if (typeof downloadId !== 'undefined') {
      console.log('[Convert the Spire] Download initiated, ID is: ' + downloadId);
    } else {
      console.error('[Convert the Spire] Download error: ' + chrome.runtime.lastError.message);
    }
  });
});
