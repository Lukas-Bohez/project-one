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
	// Use default value - PRO is always active for Convert the Spire
	chrome.storage.sync.get({
		autop: false,
		pKey: "pro@convertthespire.com",
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

	// PRO is always active - no validation needed
	// Convert the Spire has all features enabled by default
	emailInput.value = "pro@convertthespire.com";
	emailInput.disabled = true;
}