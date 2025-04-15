import common from './common.js';
import {
	CONTEXT_MENU,
	createContextMenu,
} from './context-menu.js';

chrome.runtime.onInstalled.addListener(details => {
	if (details.reason === 'update') {
		const updateRequiredPreviousVersions = [
			'0.0.1',
		];
		if (updateRequiredPreviousVersions.includes(details.previousVersion)) {
			chrome.tabs.create({
				url: `${chrome.runtime.getManifest().options_page}#update-notification`,
			});
		}
		return;
	}
	if (details.reason === 'install') {
		chrome.runtime.openOptionsPage();
	}
});

chrome.runtime.onInstalled.addListener(createContextMenu);
chrome.runtime.onStartup.addListener(createContextMenu);

chrome.contextMenus.onClicked.addListener((info) => {
	const extractResult = extractFilePath(info);
	if (!extractResult.isSucceeded) {
		common.showNotification({
			resultMessage: chrome.i18n.getMessage('not_a_file_path'),
			path: extractResult.target,
		});
		return;
	}
	const messageToNative = {
		filePath: extractResult.path,
	};
	chrome.runtime.sendNativeMessage(common.applicationName, messageToNative, response => {
		console.info(response);

		common.showNotification(response);
	});
});

chrome.action.onClicked.addListener(tab => { // not fired since default_popup is defined
	console.info("onClicked on: " + tab.ubrl);
	const result = clickedAction().then((result) => {
		if (result.result === "unsupported") {
			common.showNotification({
				resultMessage: '',
				path:  'This extension works only with box pages or file:// urls.'
			});
		}
	});
});

class ExtractResult {
	constructor(target, path) {
		this.target = target;
		this.isSucceeded = !!path;
		this.path = path;
	}

	static ofFailure(target) {
		return new this(target, null);
	}
}

const extractFilePath = info => {
	if (info.menuItemId === CONTEXT_MENU.PAGE.id) {
		const pageUrl = info.pageUrl;
		return new ExtractResult(pageUrl, convertUrl2FilePath(pageUrl));
	}
	if (info.menuItemId === CONTEXT_MENU.LINK.id) {
		const linkUrl = info.linkUrl;
		if (!linkUrl.startsWith('file://')) {
			// link 要素用の右クリックメニューの表示対象を <all_urls> にしているため fileスキーマ以外を無視する
			return ExtractResult.ofFailure(linkUrl);
		}
		return new ExtractResult(linkUrl, convertUrl2FilePath(linkUrl));
	}
	if (info.menuItemId === CONTEXT_MENU.SELECTION.id) {
		const selectionText = info.selectionText;
		if (selectionText.startsWith('"') && selectionText.endsWith('"')) {
			return new ExtractResult(selectionText, selectionText.slice(1, -1));
		}
		return new ExtractResult(selectionText, selectionText);
	}
};

const convertUrl2FilePath = encodedUrl => {
	// 1. Remove hash (e.g., #page=12 for PDF pages)
	// 2. Use decodeURIComponent instead of decodeURI for %23 to # conversion
	const decodedURI = decodeURIComponent(encodedUrl.replace(/#.*/, ''));
	if (decodedURI.startsWith('file:///')) {
		return decodedURI.replace(/^file:\/\/\//, '').replace(/\//g, '\\');
	}
	// UNC path ( "\\server_name\path\to\file" )
	// file://server_name/path/to/file
	return decodedURI.replace(/^file:/, '').replace(/\//g, '\\');
};

function openBoxDrive(result){
	//console.log(result);
	let path = result[0].result; 
    console.info(path);
	if (path) {
		const messageToNative = {boxPath: path	};
		chrome.runtime.sendNativeMessage(common.applicationName, messageToNative, response => {
			console.info(response);
			common.showNotification(response);
		});
	}
};

chrome.runtime.onMessage.addListener(
	// Need to be a sync function. https://stackoverflow.com/questions/44056271/chrome-runtime-onmessage-response-with-async-await
	function(request, sender, sendResponse) {
		if (sender.tab) {
			console.info("message from a content script:" + sender.tab.url);
		} else {
			console.info("message from the extension popup");
			if (request.action === "onclick")	{
				(async () => { 
					const result = await clickedAction();
					console.log(result);
					sendResponse(result);
				})();
			}
		}
		return true; // also need this one
	}
  );

async function clickedAction(tab)  {
	if (! tab) [tab] = await chrome.tabs.query({active: true, lastFocusedWindow: true});
	console.info("onclick message on tab: " + tab.url);
	if (tab.url.match(/(https:\/\/.*\.?app.box.com)\/(file|folder)\/(\d+)/)){
		const injectionResults = await chrome.scripting.executeScript({
				target: { tabId: tab.id },
				files: ["box-injection.js"]
			},
			openBoxDrive);
		//console.log(injectionResults);
		return {result: "handled"};
	} 
	else if (tab.url.startsWith('file://')) { // in case of file://
		const messageToNative = {
			filePath: convertUrl2FilePath(tab.url),
		};
		chrome.runtime.sendNativeMessage(common.applicationName, messageToNative, response => {
			console.info(response);
			common.showNotification(response);
		});
		return {result: "handled"};
	}
	else { // in case of not supported pages. 
		// do nothing (popup shows the error mesage).
		return {result: "unsupported"};
	}
}