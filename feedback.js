// Feedback for the toolbar action without OS notifications and without touching the page:
// a badge on the icon while waiting, and the action popup, anchored to the icon, when something goes wrong.
// A successful open needs no message: the Explorer/Finder window is the feedback.
import common from './common.js';

const BUSY_COLOR = '#5f5e5a';
const ERROR_COLOR = '#c5221f';
const POPUP = 'feedback-popup.html';
// Read by feedback-popup.js
export const FEEDBACK_KEY = 'feedback';

// Without a tab id the badge would change for every tab
const setBadge = async (tabId, text, color, title) => tabId != null && Promise.all([
	chrome.action.setBadgeText({ tabId, text }),
	chrome.action.setBadgeBackgroundColor({ tabId, color }),
	chrome.action.setTitle({ tabId, title }),
]);

export const showBusy = tabId => setBadge(tabId, '…', BUSY_COLOR, common.extensionName);

export const clearFeedback = tabId => setBadge(tabId, '', BUSY_COLOR, common.extensionName);

// resultCode selects the result_<code> message in _locales
export const showError = async (tabId, resultCode, detail = '') => {
	if (tabId == null) return;
	const title = chrome.i18n.getMessage(`result_${resultCode}`) || common.extensionName;
	await clearFeedback(tabId);
	try {
		await chrome.storage.session.set({ [FEEDBACK_KEY]: { title, detail } });
		const { windowId } = await chrome.tabs.get(tabId);
		await chrome.action.setPopup({ tabId, popup: POPUP });
		await chrome.action.openPopup({ windowId });
	} catch (e) {
		// openPopup needs Chrome/Edge 127+ and a focused window: explain on the icon instead
		console.error(e);
		await setBadge(tabId, '!', ERROR_COLOR, detail ? `${title}\n${detail}` : title);
	} finally {
		// The next click on the icon should run the action again, not reopen this message
		await chrome.action.setPopup({ tabId, popup: '' });
	}
};
