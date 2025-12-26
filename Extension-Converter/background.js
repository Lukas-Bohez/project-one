// Background script: handle requests from content scripts (e.g., fetch cookies)

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	if (request && request.action === 'getCookies') {
		const url = request.url || (sender.tab && sender.tab.url) || '';
		try {
			chrome.cookies.getAll({ url }, (cookies) => {
				sendResponse({ success: true, cookies });
			});
			return true; // indicate async response
		} catch (error) {
			sendResponse({ success: false, message: error.message });
			return false;
		}
	}
});