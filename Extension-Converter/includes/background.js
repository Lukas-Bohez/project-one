// Download all visible checked links.
chrome.runtime.onMessage.addListener(function (message) {


  let fname = message.filename
    .trim()
    .replace(/[`~!@#$%^&*()_|+\-=?;:'",<>{}[\]\\/]/gi, "-")
    .replace(/[\\/:*?"<>|]/g, "_")
    .substring(0, 240)
    .replace(/\s+/g, " ");
  //alert("fname = " + fname);

  chrome.downloads.download({
    url: message.url,
    filename: fname,
    conflictAction: "uniquify"
  }, function (downloadId) {
    // If 'downloadId' is undefined, then there is an error
    // so making sure it is not so before proceeding.
    if (typeof downloadId !== 'undefined') {
      console.log('Download initiated, ID is: ' + downloadId);
    } else {
      console.error('EYTD Download : ' + chrome.runtime.lastError.message);
      alert(chrome.runtime.lastError.message + ", This could be due to illegal chracters in video title, try right-click and 'Save Link As' to download.")
    }
  });


});
