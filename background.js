import common from './common.js';
import {
	CONTEXT_MENU,
	createContextMenu,
} from './context-menu.js';

// --- Helpers ---

const isBoxUrl = (url) => url && url.match(/(https:\/\/.*\.?app\.box\.com)/);
const isFileUrl = (url) => url && url.startsWith('file://');

const sendNativeRequest = (message) => {
	chrome.runtime.sendNativeMessage(common.applicationName, message, response => {
		console.info(response);
		common.showNotification(response);
	});
};

// --- Setup declarativeContent Rule ---

const setupDeclarativeContent = () => {
	// サービスワーカー内ではDOM (Image) が使えないため、OffscreenCanvas と fetch を使って画像データを生成する
	const createIconImageData = async (imageUrl) => {
		const response = await fetch(imageUrl);
		const blob = await response.blob();
		const imageBitmap = await createImageBitmap(blob);
		const canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
		const ctx = canvas.getContext('2d');
		ctx.drawImage(imageBitmap, 0, 0);
		return ctx.getImageData(0, 0, imageBitmap.width, imageBitmap.height);
	};

	chrome.declarativeContent.onPageChanged.removeRules(undefined, async () => {
		try {
			// カラーアイコンの ImageData を非同期生成
			const icon48ImageData = await createIconImageData('/icons/icon48.png');
			const icon128ImageData = await createIconImageData('/icons/icon128.png');

			const rule = {
				conditions: [
					new chrome.declarativeContent.PageStateMatcher({
						pageUrl: { hostSuffix: 'app.box.com' },
					}),
					new chrome.declarativeContent.PageStateMatcher({
						pageUrl: { schemes: ['file'] },
					})
				],
				actions: [
					new chrome.declarativeContent.SetIcon({
						imageData: {
							"48": icon48ImageData,
							"128": icon128ImageData
						}
					})
				]
			};

			chrome.declarativeContent.onPageChanged.addRules([rule]);
			console.info("DeclarativeContent rules registered.");
		} catch (e) {
			console.error("Failed to setup declarative rule:", e);
		}
	});
};

// --- Lifecycle & Initialization ---

chrome.runtime.onInstalled.addListener(details => {
	if (details.reason === 'update') {
		const updateRequiredPreviousVersions = ['0.0.1'];
		if (updateRequiredPreviousVersions.includes(details.previousVersion)) {
			chrome.tabs.create({ url: `${chrome.runtime.getManifest().options_page}#update-notification` });
		}
	}
	if (details.reason === 'install') {
		chrome.runtime.openOptionsPage();
	}

	setupDeclarativeContent();
});

chrome.runtime.onInstalled.addListener(createContextMenu);
chrome.runtime.onStartup.addListener(createContextMenu);

// --- User Actions ---

chrome.contextMenus.onClicked.addListener((info) => {
	const extractResult = extractFilePath(info);
	if (!extractResult.isSucceeded) {
		common.showNotification({
			resultMessage: chrome.i18n.getMessage('not_a_file_path'),
			path: extractResult.target,
		});
		return;
	}
	sendNativeRequest({ filePath: extractResult.path });
});

chrome.action.onClicked.addListener(async (tab) => {
	console.info("onClicked on: " + tab.url);
	const result = await clickedAction(tab);
	if (result.result === "unsupported") {
		common.showNotification({
			resultMessage: '',
			path: 'This extension works only with box pages or file:// urls.'
		});
	}
});

// --- Action Logic ---

async function clickedAction(tab) {
	if (!tab) [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
	console.info("onclick message on tab: " + tab.url);

	if (isBoxUrl(tab.url)) {
		await chrome.scripting.executeScript({
			target: { tabId: tab.id },
			files: ["box-injection.js"]
		}, openBoxDrive);
		return { result: "handled" };
	}
	if (isFileUrl(tab.url)) {
		sendNativeRequest({ filePath: convertUrl2FilePath(tab.url) });
		return { result: "handled" };
	}
	return { result: "unsupported" };
}

function openBoxDrive(result) {
	const path = result?.[0]?.result;
	console.info("Target path:", path);
	if (path) {
		sendNativeRequest({ boxPath: path });
	}
}

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