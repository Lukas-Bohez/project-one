function save_options(e) {
	console.log('[Convert the Spire] Save options clicked');
	e.preventDefault();
	var autop = document.getElementById('autoplay').checked;
	var pKey = document.getElementById('prokey').value;
	var noNotify = document.getElementById('notification').checked;
	console.log('[Convert the Spire] Saving:', { autop, pKey, noNotify });
	chrome.storage.sync.set({
		autop: autop,
		pKey: pKey,
		noNotify: noNotify
	}, function () {
		// Update status to let user know options were saved.
		var status = document.getElementById('status');
		status.textContent = 'Options saved.';
		status.style.display = 'block';
		status.className = 'success';
		console.log('[Convert the Spire] Options saved successfully');
		setTimeout(function () {
			status.textContent = '';
			status.style.display = 'none';
		}, 1750);
	});

}

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
function restore_options() {
	console.log('[Convert the Spire] Restoring options from storage');
	// Use default value - PRO is always active for Convert the Spire
	chrome.storage.sync.get({
		autop: false,
		pKey: "pro@convertthespire.com",
		noNotify: false,
	}, function (items) {
		console.log('[Convert the Spire] Retrieved storage:', items);
		document.getElementById('autoplay').checked = items.autop;
		document.getElementById('prokey').value = items.pKey;
		document.getElementById('notification').checked = items.noNotify;
	});

	//do other common check tasks
	bootstart();
}
document.addEventListener('DOMContentLoaded', function() {
	console.log('=================================================');
	console.log('[Convert the Spire] OPTIONS PAGE LOADED - Version 19.2');
	console.log('[Convert the Spire] Document title:', document.title);
	console.log('[Convert the Spire] Location:', window.location.href);
	
	// LOG WHAT HTML WE ACTUALLY HAVE
	console.log('[Convert the Spire] Checking DOM elements...');
	console.log('[Convert the Spire] Has .header?', !!document.querySelector('.header'));
	console.log('[Convert the Spire] Has .container?', !!document.querySelector('.container'));
	console.log('[Convert the Spire] Has .card?', !!document.querySelector('.card'));
	console.log('[Convert the Spire] Has #optionsArea?', !!document.querySelector('#optionsArea'));
	console.log('[Convert the Spire] Has .brand-card?', !!document.querySelector('.brand-card'));
	
	// LOG THE ACTUAL CONTENT
	const h1 = document.querySelector('h1');
	const h2 = document.querySelector('h2');
	console.log('[Convert the Spire] H1 text:', h1 ? h1.textContent : 'NOT FOUND');
	console.log('[Convert the Spire] H2 text:', h2 ? h2.textContent : 'NOT FOUND');
	
	// COUNT BUTTONS
	const buttons = document.querySelectorAll('button');
	console.log('[Convert the Spire] Number of buttons:', buttons.length);
	buttons.forEach((btn, i) => {
		console.log(`[Convert the Spire] Button ${i}:`, btn.textContent.trim());
	});
	
	// CHECK FOR CLEAR CACHE BUTTON
	const clearCacheBtn = Array.from(buttons).find(b => b.textContent.includes('Clear Cache'));
	console.log('[Convert the Spire] Clear Cache button exists?', !!clearCacheBtn);
	
	// CHECK FOR OLD HTML MARKERS
	const hasOldHTML = !!document.querySelector('.dashboard-card') || 
	                   !!document.querySelector('.brand-card') ||
	                   document.title.includes('Easy Youtube');
	console.log('[Convert the Spire] OLD HTML DETECTED?', hasOldHTML);
	
	// LOG ALL LINKS
	const links = document.querySelectorAll('a');
	console.log('[Convert the Spire] Number of links:', links.length);
	links.forEach((link, i) => {
		console.log(`[Convert the Spire] Link ${i}:`, link.href, link.textContent.trim());
	});
	
	console.log('=================================================');
	
	restore_options();
});
document.querySelector("form").addEventListener("submit", save_options);

function bootstart() {
	console.log('[Convert the Spire] Bootstart called');
	const emailInput = document.getElementById("prokey");
	if (emailInput) {
		emailInput.style.display = 'none';
	}
}

function clearExtensionCache() {
	console.log('[Convert the Spire] Clearing extension cache');
	// Clear all extension storage
	chrome.storage.sync.clear(function() {
		console.log('[Convert the Spire] Sync storage cleared');
		chrome.storage.local.clear(function() {
			console.log('[Convert the Spire] Local storage cleared');
			// Show success message
			var status = document.getElementById('status');
			status.textContent = 'Cache cleared! Reloading...';
			status.style.display = 'block';
			status.className = 'success';
			
			// Reload the extension after a short delay
			setTimeout(function() {
				console.log('[Convert the Spire] Reloading extension...');
				chrome.runtime.reload();
			}, 1000);
		});
	});
}