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
    if (request.msg == "loadFrame") { //Load frame from from popup menu
      var mp3_clean_url = "https://videodroid.org/v3/authenticate.php?vid=" + request.vid + "&stoken=" + request.key + "&format=" + request.data + "&title=" + request.videoTitle;
      //alert(mp3_clean_url);

      mp3_clean_url = encodeURI(mp3_clean_url);

      let iframeHTML = "<div id='popupIFRAME'>";
      doNotAutoclosePopup = true;
      noNotify = false; //bypass notification setting as this is important
      showPopup("VideoDroid", iframeHTML, true)
      addiframe(mp3_clean_url, "250", 'popupIFRAME'); //210 */

      /*       var frm_div = document.getElementById("EXT_DIV");
      
            if (frm_div) {
              frm_div.parentElement.removeChild(frm_div);
            };
      
            //console.log("message.js - " + request.data);
            var mp3_clean_url = "https://videodroid.org/v3/authenticate.php?vid=" + request.vid + "&stoken=" + request.key + "&format=" + request.data + "&title='" + request.videoTitle + "'";
      
            mp3_clean_url = encodeURI(mp3_clean_url);
            let msgCont =
              "<p>Pls. check download progress below the video player.</a><br><br>";
            showPopup("", msgCont, true);
      
      
            //console.log(mp3_clean_url);
            addiframe(mp3_clean_url, "250"); //210 */

    }


  }
});


