import common from './common.js';
import { createContextMenu } from './context-menu.js';
import {
	isBoxUrl,
	isFileUrl,
	extractFilePath,
	convertUrl2FilePath,
} from './path-utils.js';
import { diagnoseHost } from './setup/status.js';
import { showBusy, clearFeedback, showError } from './feedback.js';

const OPENED = ['directory_opened', 'file_opened'];
// The setup page tells what to do about these, so open it instead of showing an error
const SETUP_PROBLEMS = ['native_host_error', 'bad_request'];

const sendToHost = async (tabId, message) => {
	showBusy(tabId);
	const result = await common.requestNativeHost(message);
	if (OPENED.includes(result?.resultCode)) {
		clearFeedback(tabId);
		return;
	}
	if (SETUP_PROBLEMS.includes(result?.resultCode)) {
		clearFeedback(tabId);
		chrome.runtime.openOptionsPage();
		return;
	}
	showError(tabId, result?.resultCode, result?.path);
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
		// Older versions kept user-renamed context menu titles here, the only thing they stored
		chrome.storage.local.clear();
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

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
	const { os } = await chrome.runtime.getPlatformInfo();
	const extractResult = extractFilePath(info, os);
	if (!extractResult.isSucceeded) {
		showError(tab?.id, 'not_a_file_path', extractResult.target);
		return;
	}
	sendToHost(tab?.id, { filePath: extractResult.path });
});

chrome.action.onClicked.addListener(async (tab) => {
	console.info("onClicked on: " + tab.url);
	const result = await clickedAction(tab);
	if (result.result === "unsupported") {
		showError(tab.id, 'unsupported_page', tab.url);
	}
});

// --- Action Logic ---

async function clickedAction(tab) {
	if (!tab) [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
	console.info("onclick message on tab: " + tab.url);

	if (isBoxUrl(tab.url)) {
		// Reading the Box page and waiting for Box Drive to sync can take seconds
		showBusy(tab.id);
		let injection;
		try {
			[injection] = await chrome.scripting.executeScript({
				target: { tabId: tab.id },
				files: ["box-injection.js"]
			});
		} catch (e) {
			// e.g. the tab navigated away or the page cannot be scripted
			console.error(e);
			showError(tab.id, 'box_lookup_failed', e.message);
			return { result: "handled" };
		}
		openBoxDrive(tab.id, injection?.result);
		return { result: "handled" };
	}
	if (isFileUrl(tab.url)) {
		const { os } = await chrome.runtime.getPlatformInfo();
		sendToHost(tab.id, { filePath: convertUrl2FilePath(tab.url, os) });
		return { result: "handled" };
	}
	return { result: "unsupported" };
}

// result is what box-injection.js returns: { ok: true, path } or { ok: false, reason, detail }
function openBoxDrive(tabId, result) {
	console.info("Box lookup result:", result);
	if (result?.ok) {
		sendToHost(tabId, { boxPath: result.path });
		return;
	}
	showError(tabId, result?.reason ?? 'box_lookup_failed', result?.detail ?? '');
}
