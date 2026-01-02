var BUTTON_TEXT = {
  ar: "تنزيل",
  cs: "Stáhnout",
  de: "Herunterladen",
  en: "Download As",
  es: "Descargar",
  fr: "Télécharger",
  hi: "डाउनलोड",
  hu: "Letöltés",
  id: "Unduh",
  it: "Scarica",
  ja: "ダウンロード",
  ko: "내려받기",
  pl: "Pobierz",
  pt: "Baixar",
  ro: "Descărcați",
  ru: "Скачать",
  tr: "İndir",
  zh: "下载",
};
var BUTTON_TOOLTIP = {
  ar: "تنزيل هذا الفيديو",
  cs: "Stáhnout toto video",
  de: "Dieses Video herunterladen",
  en: "Download this video",
  es: "Descargar este vídeo",
  fr: "Télécharger cette vidéo",
  hi: "वीडियो डाउनलोड करें",
  hu: "Videó letöltése",
  id: "Unduh video ini",
  it: "Scarica questo video",
  ja: "このビデオをダウンロードする",
  ko: "이 비디오를 내려받기",
  pl: "Pobierz plik wideo",
  pt: "Baixar este vídeo",
  ro: "Descărcați acest videoclip",
  ru: "Скачать это видео",
  tr: "Bu videoyu indir",
  zh: "下载此视频",
};

var dList;

//Hide on click outside
document.addEventListener("click", function (e) {
  let t = e.target,
    id = t.getAttribute("id"),
    css = t.getAttribute("class");
  if (
    !(
      id === "ytdl_btn" ||
      id === "ytdl_list" ||
      (css && css.includes("ytdl_link"))
    )
  ) {
    let getDownloadList = document.getElementById("ytdl_list");
    getDownloadList.classList.remove("ytdl_list_show");
    getDownloadList.classList.add("ytdl_list_hide");
    getDownloadList.setAttribute("status", "hide");
  }
});

function removeOldElements() {
  //alert(document.getElementById("ytdl_btn"));
  try {
    let isthere = document.getElementById("ytdl_btn");
    if (isthere) {
      isthere.remove();
      isthere = document.getElementById("ytdl_list");
      isthere.remove();
      isthere = document.getElementById("EXT_DIV");
      isthere.remove();
    }

    let isAlreadyNotification = document.getElementById("notificationPopup");
    if (isAlreadyNotification) {
      isAlreadyNotification.remove();
    }
  } catch (err) {
    //console.error(err.message);
  }
}

//Frame Code
function addiframe(src, height, pegPlace) {
  try {
    //console.log("inside iframe");
    pegPlace = document.getElementById(pegPlace) || document.getElementById("meta-skeleton");
    //var pegPlace = document.getElementById("meta-skeleton");
    if (pegPlace == null) {
      pegPlace = document.getElementById("playnav-video-details");
      if (pegPlace == null)
        pegPlace = document.getElementById("watch7-action-panels");
      if (pegPlace == null)
        pegPlace = document.getElementById("watch8-secondary-actions");
      console.log("WTF!! No PegPlace");
    }

    var iframe = document.getElementById("EXT_FRAME");

    if (iframe == null) {
      //console.log("Element Success");
      div = CreateIframeDiv(height);
      iframe = CreateIframe(height);
      div.appendChild(iframe);
      pegPlace.parentNode.insertBefore(div, pegPlace.nextSibling);
    }
    //console.log(pegPlace.nextSibling.innerHTML);

    src += "&tcode=120";
    //src += "&stoken=" + proKey;
    var date = new Date();
    var time = date.getTime();
    iframe.setAttribute("src", src + "&t=" + time);
  } catch (err) {
    console.log(err);
  }
}

function CreateIframe(height) {
  iframe = document.createElement("iframe");
  iframe.setAttribute("id", "EXT_FRAME");
  iframe.setAttribute("width", "100%");
  iframe.setAttribute("height", height);
  iframe.setAttribute("border", "0");
  iframe.setAttribute("scrolling", "no");
  iframe.setAttribute("style", "border: 0 none;");
  return iframe;
}

function CreateIframeDiv(height) {
  var div = document.createElement("div");
  div.setAttribute("id", "EXT_DIV");
  div.style.width = "100%";
  div.style.margin = "0px 0px 5px 0px";
  div.style.padding = "0px";
  div.style.height = height;
  div.style.overflow = "hidden";
  return div;
}

function expandList() {
  var getDownloadList = document.getElementById("ytdl_list");
  var checkListStatus = getDownloadList.getAttribute("status");
  if (checkListStatus == "hide") {
    getDownloadList.classList.remove("ytdl_list_hide");
    getDownloadList.classList.add("ytdl_list_show");
    getDownloadList.setAttribute("status", "show");
  } else if (checkListStatus == "show") {
    getDownloadList.classList.remove("ytdl_list_show");
    getDownloadList.classList.add("ytdl_list_hide");
    getDownloadList.setAttribute("status", "hide");
  }
}
