function save_options(e) {
	e.preventDefault();
	var autop = document.getElementById('autoplay').checked;
	var pKey = document.getElementById('prokey').value;
	var noNotify = document.getElementById('notification').checked;
	chrome.storage.sync.set({
		autop: autop,
		pKey: pKey,
		noNotify: noNotify
	}, function () {
		// Update status to let user know options were saved.
		var status = document.getElementById('status');
		status.textContent = 'Options saved.';
		setTimeout(function () {
			status.textContent = '';
		}, 1750);
	});

}

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
function restore_options() {
	// Use default value 
	chrome.storage.sync.get({
		autop: false,
		pKey: "",
		noNotify: false,
	}, function (items) {
		document.getElementById('autoplay').checked = items.autop;
		document.getElementById('prokey').value = items.pKey;
		document.getElementById('notification').checked = items.noNotify;
	});

	//do other common check tasks
	bootstart();
}
document.addEventListener('DOMContentLoaded', restore_options);
document.querySelector("form").addEventListener("submit", save_options);

function bootstart() {
	const emailInput = document.getElementById("prokey");

	// function to check if the email is valid
	function isValidEmail(email) {
		const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
		return re.test(String(email).toLowerCase());
	}


	// add event listener to email input
	emailInput.addEventListener("focus", (e) => {
		if (e.target.value === e.target.getAttribute("placeholder")) {
			e.target.value = "";
		}
		e.target.select();
	});

	const errorMessage = document.getElementById("status");

	emailInput.addEventListener("blur", (e) => {
		if (!isValidEmail(e.target.value) || e.target.value.trim() === "") {
			e.target.classList.add("is-invalid");
			errorMessage.innerText = "Invalid email address"
		} else {
			e.target.classList.remove("is-invalid");
			errorMessage.innerText = ""
		}
	});
}