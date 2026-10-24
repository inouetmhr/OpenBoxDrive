// Feedback for the toolbar action without OS notifications:
// a badge on the icon while waiting, and a toast in the page when something goes wrong.
// A successful open needs no message: the Explorer/Finder window is the feedback.
import common from './common.js';

const BUSY_COLOR = '#5f5e5a';
const ERROR_COLOR = '#c5221f';

// Runs in the page through executeScript({ func }), which serializes it: keep it self-contained
export function showToast(title, detail) {
	const tag = 'open-box-drive-toast';
	document.querySelector(tag)?.remove();
	// A custom tag matches no page selector such as "div", and the shadow root keeps our styles in
	const host = document.createElement(tag);
	const root = host.attachShadow({ mode: 'open' });
	root.innerHTML = `
		<style>
			/* Important declarations in a shadow tree win over the page's, even its !important ones */
			:host { all: initial !important; }
			.toast {
				position: fixed;
				right: 16px;
				bottom: 16px;
				z-index: 2147483647;
				max-width: 380px;
				box-sizing: border-box;
				padding: 12px 40px 12px 16px;
				border-radius: 10px;
				background: #2c2c2a;
				color: #ffffff;
				font: 13px/1.5 system-ui, -apple-system, "Segoe UI", "Hiragino Sans", "Yu Gothic UI", sans-serif;
				box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
				/* Only movement: an opacity fade would leave the toast invisible where animations don't run */
				animation: slide-in 0.15s ease-out;
			}
			.title { font-weight: 600; }
			.detail { margin-top: 2px; color: #d3d1c7; overflow-wrap: anywhere; }
			.detail:empty { display: none; }
			button {
				position: absolute;
				top: 6px;
				right: 8px;
				padding: 2px 6px;
				border: 0;
				background: none;
				color: inherit;
				font-size: 16px;
				cursor: pointer;
			}
			@keyframes slide-in { from { transform: translateY(8px); } }
		</style>
		<div class="toast" role="alert">
			<div class="title"></div>
			<div class="detail"></div>
			<button type="button" aria-label="Close">×</button>
		</div>`;
	root.querySelector('.title').textContent = title;
	root.querySelector('.detail').textContent = detail;
	root.querySelector('button').addEventListener('click', () => host.remove());
	document.documentElement.append(host);
	setTimeout(() => host.remove(), 8000);
}

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
	try {
		await chrome.scripting.executeScript({ target: { tabId }, func: showToast, args: [title, detail] });
		await clearFeedback(tabId);
	} catch (e) {
		// Pages the extension can't script, such as chrome:// pages or file:// without file access: explain on the icon
		console.error(e);
		await setBadge(tabId, '!', ERROR_COLOR, detail ? `${title}\n${detail}` : title);
	}
};
