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
  console.log('[Convert the Spire] POPUP - Download clicked');
  var elem = e.currentTarget;
  var fileSaveName = elem.getAttribute("download");
  console.log('[Convert the Spire] POPUP - Raw filename:', fileSaveName);
  fileSaveName = fileSaveName.replace(/[/\\?%*:|"<>]/g, '-');
  fileSaveName = fileSaveName.replace(/[\u200B-\u200D\uFEFF]/g, '-');//Mitigate zero width joiner filename issue
  console.log('[Convert the Spire] POPUP - Cleaned filename:', fileSaveName);
  e.returnValue = false;

  if (e.preventDefault) {
    e.preventDefault();
  }
  var loop = elem.getAttribute("loop");
  console.log('[Convert the Spire] POPUP - Loop value:', loop);
  console.log('[Convert the Spire] POPUP - href:', elem.getAttribute("href"));
  
  if (loop) {
    console.log('[Convert the Spire] POPUP - Sending download message...');
    chrome.runtime.sendMessage({
      url: elem.getAttribute("href"),
      filename: fileSaveName,
    }, function(response) {
      console.log('[Convert the Spire] POPUP - Download message sent, response:', response);
    });
  } else {
    console.log('[Convert the Spire] POPUP - Loop not set, not sending message');
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
          } else if (chrome.runtime.lastError) {
            // Content script not yet injected, show helpful message
            $(".Loading").hide();
            $(".notYoutube").html("<p style='padding: 20px; color: #f44336;'><strong>Extension not ready</strong><br>Please refresh this YouTube page (F5 or Ctrl+R) and try again.</p>").show();
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
  console.log('=================================================');
  console.log('[Convert the Spire] POPUP - ShowLinks called');
  console.log('[Convert the Spire] POPUP - Raw data:', r);
  
  // Handle null/missing data
  if (!r) {
    console.error('[Convert the Spire] POPUP - No data received from content script');
    $(".Loading").hide();
    $(".notYoutube").html("<p style='padding: 20px; color: #f44336;'><strong>Extension not ready</strong><br>Please refresh this YouTube page (F5 or Ctrl+R) and try again.<br><br>If the problem persists, the video may not have downloadable streams available.</p>").show();
    return;
  }
  
  r = JSON.parse(r);
  videoTitle = r.videoTitle;
  proKey = r.key;
  
  console.log('[Convert the Spire] POPUP - Parsed data:', r);
  console.log('[Convert the Spire] POPUP - Video title:', videoTitle);
  console.log('[Convert the Spire] POPUP - VideoData array length:', r.VideoData ? r.VideoData.length : 'MISSING');
  
  // Display video metadata
  if (r.thumbnail) {
    console.log("Setting thumbnail:", r.thumbnail);
    $('#videoThumbnail').attr('src', r.thumbnail);
    $('.video-info').show();
  } else {
    console.log("No thumbnail in data");
  }
  
  if (r.author) {
    console.log("Setting author:", r.author);
    $('#channelName').text(r.author);
    // Set first letter as channel icon
    const firstLetter = r.author.charAt(0).toUpperCase();
    $('#channelIcon').text(firstLetter);
    $('.video-info').show();
  } else {
    console.log("No author in data");
  }
  
  if (videoTitle) {
    $('#videoTitleText').text(videoTitle);
    $('.video-info').show();
  }
  
  $(".VideoTitle").text(videoTitle);
  var downloadCodeList = r.VideoData;

  console.log('[Convert the Spire] POPUP - Building link list...');
  //console.log("downloadCodeList = " + downloadCodeList);
  var links = '';
  for (let i = 0; i < downloadCodeList.length; i++) {
    var getF = downloadCodeList[i].format;
    console.log(`[Convert the Spire] POPUP - Link ${i}: format="${getF}", label="${downloadCodeList[i].label}", url="${downloadCodeList[i].url}"`);
    
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
        dLink.addEventListener("click", loadFrame, false);
      }
      links += dLink;
      $(dLink).appendTo('.LinkContainer');
      //console.log(dLink);
    }
  }
  
  console.log('[Convert the Spire] POPUP - Total links added to UI:', downloadCodeList.length);
  console.log('[Convert the Spire] POPUP - Links in DOM:', $('.LinkContainer a').length);
  
  // LOG ALL FINAL LINKS IN THE UI
  $('.LinkContainer a').each(function(i, link) {
    console.log(`[Convert the Spire] POPUP - Final link ${i}: text="${$(link).text()}" href="${$(link).attr('href')}"`);
  });
  
  console.log('=================================================');
  
  $('.Loading').hide();
};

// Clear extension cache function
function clearExtensionCache() {
  console.log("[Convert the Spire] Clearing extension cache...");
  
  // Clear all extension storage
  if (chrome.storage && chrome.storage.local) {
    chrome.storage.local.clear(() => {
      console.log("[Convert the Spire] Local storage cleared");
    });
  }
  
  if (chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.clear(() => {
      console.log("[Convert the Spire] Sync storage cleared");
    });
  }
  
  // Reload the extension
  if (chrome.runtime && chrome.runtime.reload) {
    console.log("[Convert the Spire] Reloading extension...");
    setTimeout(() => {
      chrome.runtime.reload();
    }, 500);
  } else {
    // Fallback: just close and alert user
    alert("Cache cleared! Please manually reload the extension from about:addons");
    window.close();
  }
}

// Attach event listener when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  const clearCacheBtn = document.getElementById('clearCacheBtn');
  if (clearCacheBtn) {
    clearCacheBtn.addEventListener('click', clearExtensionCache);
    console.log('[Convert the Spire] Clear cache button event listener attached');
  }
});
