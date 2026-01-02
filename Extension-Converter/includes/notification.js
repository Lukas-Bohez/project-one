function showPopup(title, msg, top) {

  //Get rid of old

  const popup = document.getElementById("notificationPopup");
  if (popup) {
    popup.remove();
  };

  if (noNotify) {
    return;
  };

  let lnk = browser.runtime.getURL("options/options.html");

  msg = msg + "<br> <p style='color:blue;text-align:center'>You can disable these notifications permanently from Addon <a href='" + lnk + "'>Settings</a> page.</p>";

  let msgPopupCont = document.createElement("div");
  msgPopupCont.className = "msgPopup";
  msgPopupCont.id = "notificationPopup";
  document.body.appendChild(msgPopupCont);

  let open = false;

  //let contentainer = '<div class="popupContainer" />';
  let msgPopup = document.querySelector(".msgPopup");

  containerCont = [
    { type: "div", class: "appName" },
    { type: "div", class: "appNameContainer" },
    { type: "div", class: "msgTitle" },
    { type: "div", class: "msgContent" },
  ];

  containerCont.map((res) => {
    let elem = document.createElement(res.type);
    elem.className = res.class;
    msgPopup.appendChild(elem);
  });

  let appName = document.querySelector(".appName");
  let appNameContainer = document.querySelector(".appNameContainer");
  let msgTitle = document.querySelector(".msgTitle");
  let msgContent = document.querySelector(".msgContent");

  appName.appendChild(appNameContainer);

  let appNameIcon = document.createElement("div");
  appNameIcon.setAttribute("id", "appNameIcon");
  appNameContainer.appendChild(appNameIcon);

  let appNameSpan = document.createElement("span");
  appNameSpan.setAttribute("id", "appName");
  appNameContainer.appendChild(appNameSpan);

  let closeBtnDiv = document.createElement("div");
  closeBtnDiv.className = "closeBtn";
  appName.appendChild(closeBtnDiv);

  let msgTitleSpan = document.createElement("span");
  msgTitleSpan.setAttribute("id", "msgTitle");
  msgTitle.appendChild(msgTitleSpan);

  let msgContentSpan = document.createElement("span");
  msgContentSpan.setAttribute("id", "msgContent");
  msgContent.appendChild(msgContentSpan);

  //setIcon
  const promise = new Promise((resolve) => {
    let icon = "url('" + browser.runtime.getURL("icons/16.png") + "')";
    let closeIcon =
      "url('" + browser.runtime.getURL("icons/closeBtn.png") + "')";

    resolve({ appIcon: icon, closeBtnIcon: closeIcon });
  });
  promise.then((icons) => {
    document.querySelector(
      "#appNameIcon"
    ).style.backgroundImage = `${icons.appIcon}`;
    document.querySelector(
      ".closeBtn"
    ).style.backgroundImage = `${icons.closeBtnIcon}`;
  });

  if (top) {
    msgPopupCont.classList.remove("bottom");
    msgPopupCont.classList.add("top");
  } else {
    msgPopupCont.classList.remove("top");
    msgPopupCont.classList.add("bottom");
  }

  document.querySelector("#appName").textContent =
    "Easy Youtube Video Downloader";
  document.querySelector("#msgTitle").textContent = title;
  //msg = DOMPurify.sanitize(msg, { USE_PROFILES: { html: true } });
  document.querySelector("#msgContent").innerHTML = msg;
  msgPopupCont.style.right = "20px";

  //on close button click
  document.querySelector(".closeBtn").addEventListener("click", function () {
    msgPopup.classList.add("closed");
  });

  if (doNotAutoclosePopup == false) {
    //autohide
    var timer = 6;
    setTimeout(function () {
      msgPopup.classList.add("closed");
    }, 6000);

    var x = setInterval(function () {
      timer = timer - 1;
      document.querySelector("#appName").textContent =
        "Easy Youtube Video Downloader ( " + timer + " )";
      if (timer == 0) {
        clearInterval(x);
        timer = 0;
      }
    }, 1000);
  }
}
