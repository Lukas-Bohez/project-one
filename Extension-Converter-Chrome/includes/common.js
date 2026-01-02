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

var FORMAT_TYPE = {
  17: "3gp",
  18: "mp4",
  22: "mp4",
  43: "webm",
  44: "webm",
  45: "webm",
  46: "webm",
  135: "mp4",
  136: "mp4",
  137: "mp4",
  138: "mp4",
  140: "m4a",
  247: "webm",
  264: "mp4",
  266: "mp4",
  298: "mp4",
  299: "mp4",
};

const version = 19.1;
const browser = chrome || browser;
var proKey;
var noNotify;
var is1080p = false;
var is720p = false;
var is720pDash = false;
var doNotAutoclosePopup = false;
var videoId;

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

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parseDecsig = (data) => {
  try {
    const fnnameresult = /=([a-zA-Z0-9\$]+?)\(decodeURIComponent/.exec(data);
    const fnname = fnnameresult[1];
    const _argnamefnbodyresult = new RegExp(
      escapeRegExp(fnname) + "=function\\((.+?)\\){((.+)=\\2.+?)}"
    ).exec(data);
    const [_, argname, fnbody] = _argnamefnbodyresult;
    const helpernameresult = /;(.+?)\..+?\(/.exec(fnbody);
    const helpername = helpernameresult[1];
    const helperresult = new RegExp(
      "var " + escapeRegExp(helpername) + "={[\\s\\S]+?};"
    ).exec(data);
    const helper = helperresult[0];
    console.log(`parsedecsig result: %s=>{%s\n%s}`, argname, helper, fnbody);
    return new Function([argname], helper + "\n" + fnbody);
  } catch (e) {
    console.error("parsedecsig error: %o", e);
    console.info("script content: %s", data);
    console.info(
      'If you encounter this error, please copy the full "script content" to https://pastebin.com/ for me.'
    );
  }
};

async function getRawPageData() {
  injectScript(
    "var storage=window.localStorage;const videoPage = window?.ytplayer?.config?.args?.raw_player_response;storage.setItem('videoPage',JSON.stringify(videoPage));const $ = (s, x = document) => x.querySelector(s);const basejs =(typeof ytplayer !== 'undefined' && 'config' in ytplayer && ytplayer.config.assets? 'https://' + location.host + ytplayer.config.assets.js: 'web_player_context_config' in ytplayer? 'https://' + location.host + ytplayer.web_player_context_config.jsUrl: null) || $('script[src$=\"base.js\"]').src;storage.setItem('basejs',basejs);"
  );

  let videoPage = window.localStorage.getItem("videoPage");
  console.log("Fetched Raw Page Data:" + videoPage);
  return videoPage;
}

async function getInnerApijson(videoId, clientName, isAgeRestricted) {
  // Define client configurations with apiKey defined separately
  const clients = {
    "IOS_CREATOR": {
      clientDetails: {
        clientName: "IOS_CREATOR",
        clientVersion: "22.33.101",
        deviceModel: "iPhone14,3",
        userAgent: "com.google.ios.ytcreator/22.33.101 (iPhone14,3; U; CPU iOS 15_6 like Mac OS X)",
        hl: "en",
        timeZone: "UTC",
        utcOffsetMinutes: 0
      },
      apiKey: "AIzaSyA8eiZmM1FaDVjRy-dfKTyQ_vz_yYM39w"  // API key for IOS_CREATOR
    },
    "WEB": {
      clientDetails: {
        clientName: "WEB",
        clientVersion: "2.20201021.00.00",
        deviceModel: "",
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.111 Safari/537.36",
        hl: "en",
        timeZone: "UTC",
        utcOffsetMinutes: 0
      },
      apiKey: "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8"  // API key for WEB
    },
    "IOS": {
      clientDetails: {
        "clientName": "IOS",
        "clientVersion": "19.09.3",
        "deviceModel": "iPhone14,3",
        "userAgent": "com.google.ios.youtube/19.09.3 (iPhone14,3; U; CPU iOS 15_6 like Mac OS X)",
        "hl": "en",
        "timeZone": "UTC",
        "utcOffsetMinutes": 0
      },
      apiKey: "AIzaSyB-63vPrdThhKuerbB2N_l7Kwwcxj6yUAc"  // API key for IOS
    }
  };

  // Select the appropriate client configuration based on the input
  const { clientDetails, apiKey } = clients[clientName] || clients["IOS_CREATOR"]; // Default to IOS_CREATOR if clientName is not found

  // Customize client information based on age restriction
  const clientInfo = { ...clientDetails };
  if (isAgeRestricted) {
    clientInfo.clientVersion = clientDetails.clientVersion + "_restricted"; // Example suffix for age-restricted content
    clientInfo.clientScreen = "EMBED"; // This detail may be adjusted based on your needs
  }

  // Construct the request body
  const requestBody = {
    context: { client: clientInfo },
    videoId: videoId,
    playbackContext: {
      contentPlaybackContext: {
        html5Preference: "HTML5_PREF_WANTS"
      }
    },
    contentCheckOk: true,
    racyCheckOk: true
  };

  // Log the full request body for debugging
  //console.log("Full Request Body:", JSON.stringify(requestBody, null, 2));

  // Define the fetch request details with the updated body structure
  const requestOptions = {
    method: "post",
    headers: {
      Accept: "application/json, text/plain, */*",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody)
  };

  // Construct the fetch URL using the client's API key
  const url = `https://youtubei.googleapis.com/youtubei/v1/player?key=${apiKey}`;

  try {
    // Execute the fetch request
    const response = await fetch(url, requestOptions);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Failed to fetch video page:", error);
    return null; // Optionally return an error object or handle error differently
  }
}





async function displayFMT(finalFmt, videoTitle) {
  let jsonData = {};
  let downloadCodeList = [];

  const fmtMap1 = finalFmt.map((format) => {
    jsonData[format.itag] = format._decryptedURL;

    let fmt_url = format._decryptedURL;

    if (fmt_url != undefined && FORMAT_LABEL[format.itag] != undefined) {
      downloadCodeList.push({
        url: DOMPurify.sanitize(fmt_url),
        format: format.itag,
        label: FORMAT_LABEL[format.itag],
        download: videoTitle + "." + FORMAT_TYPE[format.itag],
      });
    }

    //Check 720p Dash availibility
    if (format.itag == "22") {
      is720p = true;
    }

    if (format.itag == "136" || format.itag == "247") {
      is720pDash = true;
    }

    //Check 1080p availibility
    if (format.itag == "137" || format.itag == "299" || format.itag == "303" || format.itag == "335" || format.itag == "617" || format.itag == "636") {
      is1080p = true;
    }
  });

  //Add addtional buttons to the list
  //720p
  if (is720pDash && !is720p) {
    downloadCodeList.push({
      url: DOMPurify.sanitize("https://videodroid.org/"),
      format: "720P",
      label: "MP4 720p (HD)",
    });
  }

  //Full-HD
  if (is1080p) {
    downloadCodeList.push({
      url: DOMPurify.sanitize("https://videodroid.org/"),
      format: "1080p3",
      label: "Full-HD 1080p",
    });
    //reset the value just in case
    is1080p = false;
  }

  downloadCodeList.push({
    url: DOMPurify.sanitize("https://videodroid.org/"),
    format: "mp3256",
    label: "MP3 HQ (256 Kbps)",
  });
  downloadCodeList.push({
    url: DOMPurify.sanitize("https://videodroid.org/"),
    format: "mp3128",
    label: "MP3 HQ (128 Kbps)",
  });

  //Options
  let lnk = browser.runtime.getURL("options/options.html");
  downloadCodeList.push({
    url: lnk,
    format: "Settings",
    label: "Settings",
    external: true,
  });
  //About-Help
  downloadCodeList.push({
    url: DOMPurify.sanitize(
      "https://www.yourvideofile.org/support.html?&ver=" + version
    ),
    format: "About",
    label: "Contact/Bug Report",
    external: true,
  });

  //Donation
  downloadCodeList.push({
    url: DOMPurify.sanitize(
      "https://videodroid.org/pro_upgrade.html?&ver=" + version
    ),
    format: "Donate",
    label: "Donate",
    external: true,
  });

  return downloadCodeList;
}

function live(event, selector, callback, context) {
  addEvent(context || document, event, function (e) {
    var found,
      el = e.target || e.srcElement;
    while (el && !(found = el.id == selector)) el = el.parentElement;
    if (found) callback.call(el, e);
  });
}

function addEvent(el, type, handler) {
  if (el.attachEvent) el.attachEvent("on" + type, handler);
  else el.addEventListener(type, handler);
}

function addFileSize(url, format) {
  function updateVideoLabel(size, format) {
    var elem = document.getElementById("ytdl_link_" + format);
    if (elem) {
      size = parseInt(size, 10);
      if (size >= 1073741824) {
        size = parseFloat((size / 1073741824).toFixed(1)) + " GB";
      } else if (size >= 1048576) {
        size = parseFloat((size / 1048576).toFixed(1)) + " MB";
      } else {
        size = parseFloat((size / 1024).toFixed(1)) + " KB";
      }
      if (elem.childNodes.length > 1) {
        elem.lastChild.nodeValue = " (" + size + ")";
      } else if (elem.childNodes.length == 1) {
        elem.appendChild(document.createTextNode(" (" + size + ")"));
      }
    }
  }
  let matchSize = findMatch(url, /[&\?]clen=([0-9]+)&/i);
  //let isYTurl = findMatch(url, /[&\?]clen=([0-9]+)&/i);
  if (matchSize) {
    updateVideoLabel(matchSize, format);
  } else {
    if (url.indexOf("googlevideo.com") !== -1) {
      fetch(url, {
        method: "HEAD",
      })
        .then((response) => {
          // handle the response
          let size = 0;
          size = response.headers.get("content-length");
          if (size) {
            updateVideoLabel(size, format);
          }
        })
        .catch((error) => {
          // handle the error
          console.log("Error Fetch Filesize URL : " + error);
        });
    }
  }
}

function injectScript(code) {
  let script = document.createElement("script");
  script.type = "application/javascript";
  script.textContent = code;
  document.body.appendChild(script);
  document.body.removeChild(script);
}

function findMatch(text, regexp) {
  var matches = text.match(regexp);
  return matches ? matches[1] : null;
}

//GET SETTINGS
function restoreOptions() {
  function getAutoplayChoice(result) {
    //console.log(result.autop);
    if (result.autop) {
      //TRUE
      injectScript(
        `var myplayer = document.getElementById("movie_player");if (myplayer) {myplayer.pauseVideo()}`
      );
    }
  }

  function getProKey(result) {
    if (result.pKey) {
      proKey = result.pKey;
      proKey = encodeURIComponent(window.btoa(proKey)); //Safe transport
    }
  }

  function getNotify(result) {
    if (result.noNotify) {
      noNotify = result.noNotify;
    }
  }

  function onError(error) {
    console.log("Settings Error: " + error);
  }

  var getting = browser.storage.sync.get("autop", getAutoplayChoice);
  var getting = browser.storage.sync.get("pKey", getProKey);
  var getting = browser.storage.sync.get("noNotify", getNotify);

  //getting.then(getAutoplayChoice, onError);
}
//END SETTINGS

function insertAfter(el, referenceNode) {
  referenceNode.parentNode.insertBefore(el, referenceNode.nextSibling);
}
