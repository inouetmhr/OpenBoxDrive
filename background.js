import common from './common.js';
import { createContextMenu } from './context-menu.js';
import {
	isBoxUrl,
	isFileUrl,
	extractFilePath,
	convertUrl2FilePath,
} from './path-utils.js';
import { diagnoseHost } from './setup/status.js';

// Send to the native host; when it is missing or too old, open the setup page, which tells what to do
const sendToHost = async message => {
	const result = await common.sendNativeRequest(message);
	if (['native_host_error', 'bad_request'].includes(result?.resultCode)) {
		chrome.runtime.openOptionsPage();
	}
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

chrome.runtime.onInstalled.addListener(async details => {
	setupDeclarativeContent();

	if (details.reason === 'install') {
		chrome.runtime.openOptionsPage();
	}
	if (details.reason === 'update') {
		// An update may need a newer helper than the one installed
		const status = diagnoseHost(await common.requestNativeHost({ ping: true }), common.REQUIRED_HOST_VERSION);
		if (['host_outdated', 'host_failed'].includes(status.state)) {
			chrome.runtime.openOptionsPage();
		}
	}
});

chrome.runtime.onInstalled.addListener(createContextMenu);
chrome.runtime.onStartup.addListener(createContextMenu);

// --- User Actions ---

chrome.contextMenus.onClicked.addListener((info) => {
	const extractResult = extractFilePath(info);
	if (!extractResult.isSucceeded) {
		common.showNotification({
			resultCode: 'not_a_file_path',
			path: extractResult.target,
		});
		return;
	}
	sendToHost({ filePath: extractResult.path });
});

chrome.action.onClicked.addListener(async (tab) => {
	console.info("onClicked on: " + tab.url);
	const result = await clickedAction(tab);
	if (result.result === "unsupported") {
		common.showNotification({
			resultCode: 'unsupported_page',
			path: tab.url,
		});
	}
});

// --- Action Logic ---

async function clickedAction(tab) {
	if (!tab) [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
	console.info("onclick message on tab: " + tab.url);

	if (isBoxUrl(tab.url)) {
		let injection;
		try {
			[injection] = await chrome.scripting.executeScript({
				target: { tabId: tab.id },
				files: ["box-injection.js"]
			});
		} catch (e) {
			// e.g. the tab navigated away or the page cannot be scripted
			console.error(e);
			common.showNotification({ resultCode: 'box_lookup_failed', path: e.message });
			return { result: "handled" };
		}
		openBoxDrive(injection?.result);
		return { result: "handled" };
	}
	if (isFileUrl(tab.url)) {
		sendToHost({ filePath: convertUrl2FilePath(tab.url) });
		return { result: "handled" };
	}
	return { result: "unsupported" };
}

// result is what box-injection.js returns: { ok: true, path } or { ok: false, reason, detail }
function openBoxDrive(result) {
	console.info("Box lookup result:", result);
	if (result?.ok) {
		sendToHost({ boxPath: result.path });
		return;
	}
	common.showNotification({
		resultCode: result?.reason ?? 'box_lookup_failed',
		path: result?.detail ?? '',
	});
}
