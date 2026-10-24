import './helpers/chrome-stub.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Capture listeners that background.js registers at load time; the first one of each event is the one under test
const listeners = {};
const event = name => ({ addListener: fn => { listeners[name] ??= fn; } });
Object.assign(chrome.runtime, {
	onInstalled: event('onInstalled'),
	onStartup: event('onStartup'),
});
chrome.contextMenus = { onClicked: event('contextMenus.onClicked') };
chrome.declarativeContent = { onPageChanged: { removeRules: () => {} } };

let nativeMessages;
let nativeReply;
let injection;
let optionsPageOpened;
let toasts;
let badges;
let scriptable;

const badge = (key, field) => async options => {
	badges[options.tabId] = { ...badges[options.tabId], [key]: options[field] };
};
chrome.action = {
	onClicked: event('action.onClicked'),
	setBadgeText: badge('text', 'text'),
	setBadgeBackgroundColor: badge('color', 'color'),
	setTitle: badge('title', 'title'),
};

beforeEach(() => {
	nativeMessages = [];
	nativeReply = { response: { resultCode: 'directory_opened', path: 'opened' } };
	optionsPageOpened = 0;
	toasts = [];
	badges = {};
	scriptable = true;
	chrome.runtime.openOptionsPage = () => { optionsPageOpened++; };
	chrome.runtime.sendNativeMessage = (name, message, callback) => {
		nativeMessages.push(message);
		chrome.runtime.lastError = nativeReply.lastError;
		callback(nativeReply.response);
		delete chrome.runtime.lastError;
	};
	chrome.scripting = {
		executeScript: async ({ files, func, args }) => {
			if (!scriptable) throw new Error('Cannot access contents of the page.');
			if (files) return injection();
			assert.equal(func.name, 'showToast');
			toasts.push({ title: args[0], detail: args[1] });
			return [];
		},
	};
});

await import('../background.js');

// Let the fire-and-forget host request and the feedback after it finish
const settle = () => new Promise(resolve => setTimeout(resolve, 0));
const clickAction = async tab => {
	await listeners['action.onClicked']({ id: 1, ...tab });
	await settle();
};

test('box page: opens the path found by box-injection.js without any message', async () => {
	injection = () => [{ result: { ok: true, path: ['All Files', 'Team'] } }];
	await clickAction({ url: 'https://app.box.com/folder/1' });
	assert.deepEqual(nativeMessages, [{ boxPath: ['All Files', 'Team'] }]);
	assert.deepEqual(toasts, []);
	assert.equal(badges[1].text, '', 'busy badge is cleared');
});

test('box page: shows the reason in the page when box-injection.js fails', async () => {
	injection = () => [{ result: { ok: false, reason: 'unsupported_page', detail: 'https://app.box.com/recents' } }];
	await clickAction({ url: 'https://app.box.com/recents' });
	assert.deepEqual(nativeMessages, []);
	assert.deepEqual(toasts, [{ title: 'result_unsupported_page', detail: 'https://app.box.com/recents' }]);
});

test('box page: shows a toast when the script cannot be injected or returns nothing', async () => {
	injection = () => { throw new Error('Frame with ID 0 was removed.'); };
	await clickAction({ url: 'https://app.box.com/folder/1' });
	injection = () => [];
	await clickAction({ url: 'https://app.box.com/folder/1' });
	assert.deepEqual(toasts.map(t => t.title), ['result_box_lookup_failed', 'result_box_lookup_failed']);
	assert.equal(toasts[0].detail, 'Frame with ID 0 was removed.');
});

test('box page: shows a toast when the item is not in Box Drive yet', async () => {
	injection = () => [{ result: { ok: true, path: ['All Files', 'New'] } }];
	nativeReply = { response: { resultCode: 'does_not_exist', path: 'C:\\Users\\me\\Box\\New' } };
	await clickAction({ url: 'https://app.box.com/folder/1' });
	assert.deepEqual(toasts, [{ title: 'result_does_not_exist', detail: 'C:\\Users\\me\\Box\\New' }]);
});

test('file url: opens the local path', async () => {
	await clickAction({ url: 'file:///C:/ProgramData/' });
	assert.deepEqual(nativeMessages, [{ filePath: 'C:\\ProgramData\\' }]);
	assert.deepEqual(toasts, []);
});

test('other pages: the icon stays clickable and explains itself in a toast', async () => {
	await clickAction({ url: 'https://example.com/' });
	assert.deepEqual(nativeMessages, []);
	assert.deepEqual(toasts, [{ title: 'result_unsupported_page', detail: 'https://example.com/' }]);
});

test('pages that cannot be scripted get a badge with the reason as tooltip', async () => {
	scriptable = false;
	await clickAction({ url: 'chrome://newtab/' });
	assert.deepEqual(toasts, []);
	assert.equal(badges[1].text, '!');
	assert.equal(badges[1].title, 'result_unsupported_page\nchrome://newtab/');
});

test('context menu: shows a toast when the link is not a local file', async () => {
	listeners['contextMenus.onClicked']({ menuItemId: 'link', linkUrl: 'https://example.com/' }, { id: 2 });
	await settle();
	assert.deepEqual(nativeMessages, []);
	assert.deepEqual(toasts, [{ title: 'result_not_a_file_path', detail: 'https://example.com/' }]);
});

test('opens the setup page instead of a toast when the native host cannot be reached', async () => {
	nativeReply = { lastError: { message: 'Specified native messaging host not found.' } };
	await clickAction({ url: 'file:///C:/ProgramData/' });
	assert.equal(optionsPageOpened, 1);
	assert.deepEqual(toasts, []);
});

test('opens the setup page when the native host is too old to understand the request', async () => {
	nativeReply = { response: { resultCode: 'bad_request', path: '' } };
	await clickAction({ url: 'file:///C:/ProgramData/' });
	assert.equal(optionsPageOpened, 1);
});

test('update: opens the setup page only when the installed helper is outdated', async () => {
	nativeReply = { response: { resultCode: 'bad_request', path: '' } };
	await listeners.onInstalled({ reason: 'update' });
	assert.equal(optionsPageOpened, 1);
	nativeReply = { response: { resultCode: 'pong', version: 2, path: '/Box', boxDriveFound: true } };
	await listeners.onInstalled({ reason: 'update' });
	assert.equal(optionsPageOpened, 1);
});
