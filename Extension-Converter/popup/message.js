chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request) {
    if (request.msg == "getList") {
      //console.log(request.data);
      let r = sessionStorage.getItem("dList_" + request.data);
      //console.log("Sender = " + r);
      sendResponse({ data: r });
    }
  }
});

chrome.runtime.onMessage.addListener((request) => {
  if (request) {
    if (request.msg == "loadFrame") { //Direct download - no external service needed
      // Convert the Spire handles downloads directly
      // No external authentication needed
      console.log("Convert the Spire: Direct download initiated");
    }
  }
});


