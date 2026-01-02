addEventListener("yt-page-data-updated", (event) => {

  restoreOptions();
  parseDetails(window.location.href);

  //removeOldElements
  removeOldElements();
  let frm_div = document.getElementById("EXT_DIV");
  if (frm_div) {
    isthere = document.getElementById("EXT_DIV");
    isthere.remove();
  }
});

const parseQueryString = (queryString) =>
  Object.assign(
    {},
    ...queryString.split("&").map((kvp) => {
      kva = kvp.split("=").map(decodeURIComponent);
      return {
        [kva[0]]: kva[1],
      };
    })
  );

/**
 * Respond to the request
 */
async function parseDetails(url) {

  if (window.location.href.indexOf("shorts/") > -1) {
    let msgCont = "Youtube Shorts video uses a different UI and to download these videos you can use the Download menu provided via the Browser toolbar button.";
    showPopup("", msgCont, true);
    videoId = window.location.href.split("shorts/")[1];
  } else {
    const query = parseQueryString(url.split("?")[1]);
    videoId = query["v"];
  };



  let videoPage = await getInnerApijson(videoId, "IOS_CREATOR", false);
  //console.log("Not Age Gated");
  //console.log("Not Age Gated :" + JSON.stringify(videoPage));

  if (!videoPage.streamingData) {
    //Seems age gated video, refetch data
    videoPage = await getInnerApijson(videoId, "IOS_CREATOR", true);
    console.log("Using Age gated Android");
    // console.log("Using Age gated Android :" + JSON.stringify(videoPage));
  }



  //If it still fails, try using page data
  if (!videoPage.streamingData) {
    videoPage = await getRawPageData();
    videoPage = JSON.parse(videoPage);

    //save decsig function for usage later
    var basejs = window.localStorage.getItem("basejs");
    console.log("Scraping page data, and getting base.js : " + basejs)
    var decsig = await fetch(basejs)
      .then((res) => res.text())
      .then((body) => {
        return body;
      });

    var decsig = await parseDecsig(decsig);
    console.log("Youtube Code Changed API Failed");
  }

  //we still have a failure, display error
  if (!videoPage.streamingData.formats) {
    let msgCont = "Error!!";
    //this could be a live video check and inform
    if (
      videoPage.videoDetails.isLive ||
      videoPage.playabilityStatus.reason == "This live event has ended."
    ) {
      msgCont =
        "<p>This is either an ongoing or recently finished Live stream, it can take upto 12-72 hours to generate download links for such videos, pls. try later after 12-72 hours and the links should be availble by then.</p>";
      showPopup("", msgCont, true);
    } else {
      msgCont =
        "<p>We were not able to parse the download links from this page, try a page refresh. If this happens with all videos do report this to us.";
      showPopup("", msgCont, true);
    }
  }

  //console.log(videoPage);

  let videoTitle = document.title
    .replace(/^\(\d+\)\s*/, "")
    .replace(/\s*\-\s*YouTube$|'/g, "")
    .replace(/^\s+|\s+$|\.+$/g, "")
    .replace(/[\\/:"*?<>|]/g, "")
    .replace(/[\x00-\x1f\x7f]/g, "")
    .replace(/[\|\\\/]/g, window.navigator.userAgent.indexOf("Win") >= 0 || window.navigator.userAgent.indexOf("Mac") >= 0 ? "-" : "")
    .replace(/^(con|prn|aux|nul|com\d|lpt\d)$/i, "")
    .replace(/#/g, window.navigator.userAgent.indexOf("Win") >= 0 ? "" : "%23")
    .replace(/&/g, window.navigator.userAgent.indexOf("Win") >= 0 ? "_" : "%26");

  const formatURLs = videoPage.streamingData.formats.map((format) => {
    let url = format.url;
    //console.log(videoPage.streamingData.formats);

    const cipher = format.signatureCipher || format.cipher;

    if (!!cipher) {
      const components = parseQueryString(cipher);

      //decode signature
      //const sig = applyActions(extractActions(jsPlayer), components.s);
      const sig = decsig(components.s);
      url =
        components.url +
        `&${encodeURIComponent(components.sp)}=${encodeURIComponent(sig)}`;
    }

    return {
      //...format,
      itag: format.itag,
      _decryptedURL: url,
    };
  });

  //Populate Adaptive
  let adaptiveFormats;
  if (videoPage.streamingData.adaptiveFormats) {
    adaptiveFormats = videoPage.streamingData.adaptiveFormats;
  } else {
    // Fetch using another Client if adaptiveFormats are not available
    videoPage = await getInnerApijson(videoId, "IOS", false);
    //console.log("AdaptiveFormat IOS : " + JSON.stringify(videoPage))
    adaptiveFormats = videoPage.streamingData.adaptiveFormats ? videoPage.streamingData.adaptiveFormats : [];

  }
  const adaptiveFormatURLs = videoPage.streamingData.adaptiveFormats.map(
    (format) => {
      let url = format.url;
      const cipher = format.signatureCipher || format.cipher;

      if (!!cipher) {
        const components = parseQueryString(cipher);

        //decode signature
        //const sig = applyActions(extractActions(jsPlayer), components.s);
        const sig = decsig(components.s);
        url =
          components.url +
          `&${encodeURIComponent(components.sp)}=${encodeURIComponent(sig)}`;
      }

      return {
        //...format,
        itag: format.itag,
        _decryptedURL: url,
      };
    }
  );

  const finalFmt = [...formatURLs, ...adaptiveFormatURLs];
  //console.log(formatURLs);
  //console.log(adaptiveFormatURLs);
  var downloadCodeList = await displayFMT(finalFmt, videoTitle);

  //console.info(videoId);
  //console.info(videoTitle);
  //console.info(downloadCodeList);
  let data = { VideoData: downloadCodeList, videoTitle: videoTitle, key: proKey };
  sessionStorage.setItem("dList_" + videoId, JSON.stringify(data));
  //let r = sessionStorage.getItem("dList_" + videoId);
  //console.log(r);

  var language = document.documentElement.getAttribute("lang");
  language = language.substring(0, 2);
  var buttonText = BUTTON_TEXT[language]
    ? BUTTON_TEXT[language]
    : BUTTON_TEXT["en"];
  var buttonLabel = BUTTON_TOOLTIP[language]
    ? BUTTON_TOOLTIP[language]
    : BUTTON_TOOLTIP["en"];

  let dButton = document.createElement("button");
  dButton.setAttribute("id", "ytdl_btn");
  dButton.setAttribute("class", "ytdl_btn");
  dButton.textContent = " " + buttonText + ": ▼" + " ";
  dButton.setAttribute("data-tooltip-text", buttonLabel);

  let firstTopRow = document.getElementById("secondary-info");
  if (firstTopRow) {
    firstTopRow.remove();
  }

  let parentElement = document.getElementById("top-row");

  //Check if we are on new UI
  let isOldUI = true;
  if (document.getElementById("comment-teaser")) {
    isOldUI = false;
  }

  if (parentElement && isOldUI) {
    //OLD UI
    parentElement.childNodes[0].appendChild(dButton);
  }

  //Are we on a new design, genrate and add new style button
  if (parentElement && !isOldUI) {
    console.log("Inside new UI");

    //attach button to rectnagle new exp ui
    parentElement = document.getElementById("owner");
    parentElement.appendChild(dButton);

    //Pill shaped button
    buttonEle = document.getElementById("ytdl_btn");
    buttonEle.setAttribute("style", "border-radius: 30px;");


    /*HACK TO SHOW POPUP
    //We still do not have a place to attach, ask user to report
    doNotAutoclosePopup = true;
    let msgCont =
      "<p>Oops, unable to attach button to the original location on the page - this seems to be some code/layout change by Youtube, for the time-being you can use the button on the Browser Toolbar to download. Once this design is finalised and pushed to all by Youtube, an updated addon version will place the button to usual location.<br><br>You can read more about this <a href='https://bit.ly/YoutubeNewCode' target='_blank'>here.</a><br><br>";
    showPopup("", msgCont, true);
    parentElement = document.getElementById("notificationPopup");
    parentElement.childNodes[2].appendChild(dButton);
*/

  }

  if (!parentElement) {
    //We still do not have a place to attach, ask user to report
    let msgCont =
      "<p>Oops, unable to attach button to the original location on the page - this seems to be some code/layout change by Youtube, for the time-being you can use the button below. Once this design is finalised and pushed to all by Youtube, an updated addon version will place the button to usual location.<br><br>You can read more about this <a href='https://bit.ly/YoutubeNewCode' target='_blank'>here.</a><br><br>";
    showPopup("", msgCont, true);
    parentElement = document.getElementById("notificationPopup");
    parentElement.childNodes[2].appendChild(dButton);
  }

  // create download list
  let dList = document.createElement("div");
  dList.setAttribute("id", "ytdl_list");
  dList.setAttribute("status", "hide");
  dList.classList.add("ytdl_list", "ytdl_list_hide");
  dButton.appendChild(dList);

  for (let i = 0; i < downloadCodeList.length; i++) {
    let getF = downloadCodeList[i].format;
    //console.log(getF);
    if (FORMAT_LABEL[getF]) {
      let linkDiv = document.createElement("div");
      linkDiv.setAttribute("class", "eytd_list_item");

      let dLink = document.createElement("a");
      let url = DOMPurify.sanitize(downloadCodeList[i].url);
      dLink.setAttribute("id", "ytdl_link_" + downloadCodeList[i].format);
      //dLink.setAttribute("class", "ytdl_link");
      dLink.setAttribute("loop", i + "");
      dLink.innerText = downloadCodeList[i].label;

      //Treat links as direct or extra
      if (downloadCodeList[i].download || downloadCodeList[i].external) {
        dLink.setAttribute("href", url);
        if (downloadCodeList[i].label != "Settings") {
          //mitigate download options page firefox
          dLink.setAttribute("download", downloadCodeList[i].download);
        }
        dLink.setAttribute("target", "_blank");
        if (!downloadCodeList[i].external) {
          dLink.addEventListener("click", notifyExtension, false);
        }
      } else {
        live("click", "ytdl_link_" + downloadCodeList[i].format, function () {
          var frm_div = document.getElementById("EXT_DIV");
          if (frm_div) {
            frm_div.parentElement.removeChild(frm_div);
          }
          var mp3_clean_url =
            "https://videodroid.org/v3/authenticate.php?vid=" +
            videoId +
            "&stoken=" +
            proKey +
            "&format=" +
            FORMAT_LABEL[getF] +
            "&title=" +
            videoTitle +
            "&ver=" +
            version;
          //console.info(mp3_clean_url);
          mp3_clean_url = encodeURI(mp3_clean_url);
          addiframe(mp3_clean_url, "250"); //210
          return false;
        });
      }

      //let createBR1 = document.createElement("br");
      //let createBR2 = document.createElement("br");

      linkDiv.appendChild(dLink);
      dList.appendChild(linkDiv);
      //dList.appendChild(createBR1);
      //dList.appendChild(createBR2);
      //save dlist
      //window.localStorage.setItem("list", dList.outerHTML);
    }
  }

  var downloadBtn = document.getElementById("ytdl_btn");
  downloadBtn.addEventListener("click", expandList);

  //AFTER LIST ATTACH
  for (var i = 0; i < downloadCodeList.length; i++) {
    addFileSize(downloadCodeList[i].url, downloadCodeList[i].format);
  }
}
