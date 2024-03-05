//'use strict';
//import common from './common.js';
//import notificationUtil from './notification-util.js';

async function onClicked(){
	//console.info("onClicked on: " + document.url);
	const [tab] = await chrome.tabs.query({active: true, lastFocusedWindow: true});
	console.info("onclicked on tab: " + tab.url);
	if (tab.url.match(/(https:\/\/.*\.?app.box.com)\/(file|folder)\/(\d+)/) ||
		tab.url.startsWith('file://')) {
		const response = await chrome.runtime.sendMessage({action: "onclick"});
		//await Promise.all([response]);
		console.info(response);
		if (!response ||response.result === "handled") {
			window.close();
		} else {
			//something went wrong. TODO: Show an error message.
		}
	} else { // in case of not supported pages. Show a popup message.
		console.info("clicked on an unsupported page.")
		document.querySelector('#icon').classList.remove("rotate-anime");
		document.querySelector('#message').textContent = "This extension works only with box pages or file:// urls.";
		return;
	}
	return;
}

onClicked();
