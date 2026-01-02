var FORMAT_LABEL = {
  17: "3GP 144p",
  18: "MP4 360p",
  22: "MP4 720p",
  44: "WebM 480p",
  45: "WebM 720p",
  46: "WebM 1080p",
  mp3128: "mp3128",
  mp3256: "mp3256",
  "720P": "720P",
  "1080p3": "1080p3",
  Settings: "Settings",
  About: "About",
  Donate: "Donate",
};

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

function notifyExtension(e) {
  var elem = e.currentTarget;
  var fileSaveName = elem.getAttribute("download");
  fileSaveName = fileSaveName.replace(/[/\\?%*:|"<>]/g, '-');
  fileSaveName = fileSaveName.replace(/[\u200B-\u200D\uFEFF]/g, '-');//Mitigate zero width joiner filename issue
  e.returnValue = false;

  if (e.preventDefault) {
    e.preventDefault();
  }
  var loop = elem.getAttribute("loop");
  if (loop) {
    chrome.runtime.sendMessage({
      url: elem.getAttribute("href"),
      filename: fileSaveName,
    });
  }
  return false;
}

var CurrentTabID;
var videoId;
var videoTitle;
var proKey;

function loadFrame(e) {
  var elem = e.currentTarget;
  e.returnValue = false;
  if (e.preventDefault) {
    e.preventDefault();
  }
  var loop = elem.getAttribute("loop");
  var format = elem.getAttribute("id");

  videoTitle = videoTitle.replace(/[/\\?%*:|"<>]/g, '-');
  videoTitle = videoTitle.replace(/[\u200B-\u200D\uFEFF]/g, '-');//Mitigate zero width joiner filename issue

  format = format.substring(10);
  if (loop) {
    chrome.tabs.sendMessage(
      CurrentTabID,
      { msg: "loadFrame", data: format, vid: videoId, videoTitle: videoTitle, key: proKey }
    );
  }

  window.close();
  return false;


}

//############

$(document).ready(function () {
  $(".Loading").show();
  $(".notYoutube").hide();
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (tabs[0].url.indexOf("youtube.com/watch") !== -1 || tabs[0].url.indexOf("youtube.com/shorts/") !== -1) {
      CurrentTabID = tabs[0].id;

      if (tabs[0].url.indexOf("shorts/") > -1) { videoId = tabs[0].url.split("shorts/")[1]; }
      else {
        const query = parseQueryString(tabs[0].url.split("?")[1]);
        videoId = query["v"];
      };

      chrome.tabs.sendMessage(
        CurrentTabID,
        { msg: "getList", data: videoId },
        function (response) {
          //console.log("Executed...");
          // If this message's recipient sends a response it will be handled here
          if (response) {
            ShowLinks(response.data);
          }
        }
      );
    } else {
      $(".Loading").hide();
      $(".notYoutube").show();
    }
  });
});

function ShowLinks(r) {
  r = JSON.parse(r);
  videoTitle = r.videoTitle;
  proKey = r.key;
  $(".VideoTitle").text(videoTitle);
  var downloadCodeList = r.VideoData;

  //console.log("downloadCodeList = " + downloadCodeList);
  var links = '';
  for (let i = 0; i < downloadCodeList.length; i++) {
    var getF = downloadCodeList[i].format;
    if (FORMAT_LABEL[getF]) {
      let dLink = document.createElement("a");
      let url = downloadCodeList[i].url;
      dLink.setAttribute("id", "ytdl_link_" + downloadCodeList[i].format);
      dLink.setAttribute("class", "list-group-item list-group-item-action");
      dLink.setAttribute("loop", i + "");
      dLink.innerText = downloadCodeList[i].label;

      //Treat links as direct or extra
      if (downloadCodeList[i].download || downloadCodeList[i].external) {
        dLink.setAttribute("href", url);
        dLink.setAttribute("target", "_blank");
        if (!downloadCodeList[i].external) {
          dLink.addEventListener("click", notifyExtension, false);
          dLink.setAttribute("download", downloadCodeList[i].download);
        }
      } else { //The iframe links
        //dLink.setAttribute("href", "#");
        dLink.addEventListener("click", loadFrame, false);
      }
      links += dLink;
      $(dLink).appendTo('.LinkContainer');
      //console.log(dLink);
    }
  }
  $('.Loading').hide();
};