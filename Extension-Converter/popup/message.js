chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request) {
    if (request.msg == "getList") {
      let r = sessionStorage.getItem("dList_" + request.data);
      sendResponse({ data: r });
    }
  }
});

chrome.runtime.onMessage.addListener((request) => {
  if (request) {
    if (request.msg == "loadFrame") { //Load frame from from popup menu
      var mp3_clean_url = "https://videodroid.org/v3/authenticate.php?vid=" + request.vid + "&stoken=" + request.key + "&format=" + request.data + "&title=" + request.videoTitle;
      mp3_clean_url = encodeURI(mp3_clean_url);
      let iframeHTML = "<div id='popupIFRAME'>";
      doNotAutoclosePopup = true;
      noNotify = false;
      showPopup("VideoDroid", iframeHTML, true)
      addiframe(mp3_clean_url, "250", 'popupIFRAME');
    }
  }
});


