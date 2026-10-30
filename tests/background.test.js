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
chrome.declarativeContent = { onPageChanged: { removeRules: () => {} } };

let nativeMessages;
let nativeReply;
let injection;
let optionsPageOpened;
let popups;
let badges;
let popupAvailable;
let actionPopup;

const badge = (key, field) => async options => {
	badges[options.tabId] = { ...badges[options.tabId], [key]: options[field] };
};
let storedFeedback;
chrome.storage = { session: { set: async items => { storedFeedback = items.feedback; } } };
chrome.tabs = { get: async tabId => ({ id: tabId, windowId: 7 }) };
chrome.action = {
	onClicked: event('action.onClicked'),
	setBadgeText: badge('text', 'text'),
	setBadgeBackgroundColor: badge('color', 'color'),
	setTitle: badge('title', 'title'),
	setPopup: async ({ tabId, popup }) => { actionPopup[tabId] = popup; },
	openPopup: async ({ windowId }) => {
		if (!popupAvailable) throw new Error('Could not find an active browser window.');
		assert.equal(windowId, 7);
		popups.push({ ...storedFeedback, popup: Object.values(actionPopup).find(Boolean) });
	},
};

beforeEach(() => {
	nativeMessages = [];
	nativeReply = { response: { resultCode: 'directory_opened', path: 'opened' } };
	optionsPageOpened = 0;
	popups = [];
	badges = {};
	actionPopup = {};
	popupAvailable = true;
	chrome.runtime.openOptionsPage = () => { optionsPageOpened++; };
	// nativeReply is a reply, or a function from the message to one
	chrome.runtime.sendNativeMessage = (name, message, callback) => {
		nativeMessages.push(message);
		const reply = typeof nativeReply === 'function' ? nativeReply(message) : nativeReply;
		chrome.runtime.lastError = reply.lastError;
		callback(reply.response);
		delete chrome.runtime.lastError;
	};
	chrome.scripting = {
		executeScript: async ({ files }) => {
			assert.deepEqual(files, ['box-injection.js'], 'nothing else is injected into pages');
			return injection();
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
	assert.deepEqual(popups, []);
	assert.equal(badges[1].text, '', 'busy badge is cleared');
});

test('box page: shows the reason in the popup when box-injection.js fails', async () => {
	injection = () => [{ result: { ok: false, reason: 'unsupported_page', detail: 'https://app.box.com/recents' } }];
	await clickAction({ url: 'https://app.box.com/recents' });
	assert.deepEqual(nativeMessages, []);
	assert.deepEqual(popups.map(({ title, detail }) => ({ title, detail })), [{ title: 'result_unsupported_page', detail: 'https://app.box.com/recents' }]);
});

test('box page: shows the popup when the script cannot be injected or returns nothing', async () => {
	injection = () => { throw new Error('Frame with ID 0 was removed.'); };
	await clickAction({ url: 'https://app.box.com/folder/1' });
	injection = () => [];
	await clickAction({ url: 'https://app.box.com/folder/1' });
	assert.deepEqual(popups.map(t => t.title), ['result_box_lookup_failed', 'result_box_lookup_failed']);
	assert.equal(popups[0].detail, 'Frame with ID 0 was removed.');
});

test('box page: shows the popup when the item is not in Box Drive yet', async () => {
	injection = () => [{ result: { ok: true, path: ['All Files', 'New'] } }];
	nativeReply = { response: { resultCode: 'does_not_exist', path: 'C:\\Users\\me\\Box\\New' } };
	await clickAction({ url: 'https://app.box.com/folder/1' });
	assert.deepEqual(popups.map(({ title, detail }) => ({ title, detail })), [{ title: 'result_does_not_exist', detail: 'C:\\Users\\me\\Box\\New' }]);
});

test('other pages: the icon stays clickable and explains itself in the popup, without injecting', async () => {
	await clickAction({ url: 'https://example.com/' });
	assert.deepEqual(nativeMessages, []);
	assert.deepEqual(popups, [{ title: 'result_unsupported_page', detail: 'https://example.com/', popup: 'feedback-popup.html' }]);
	assert.equal(actionPopup[1], '', 'the next click runs the action again');
});

test('without openPopup the reason goes on the icon badge and tooltip', async () => {
	popupAvailable = false;
	await clickAction({ url: 'chrome://newtab/' });
	assert.deepEqual(popups, []);
	assert.equal(badges[1].text, '!');
	assert.equal(badges[1].title, 'result_unsupported_page\nchrome://newtab/');
	assert.equal(actionPopup[1], '');
});

const boxFolder = () => { injection = () => [{ result: { ok: true, path: ['All Files', 'Team'] } }]; };

test('opens the setup page instead of a message when the native host cannot be reached', async () => {
	boxFolder();
	nativeReply = { lastError: { message: 'Specified native messaging host not found.' } };
	await clickAction({ url: 'https://app.box.com/folder/1' });
	assert.equal(optionsPageOpened, 1);
	assert.deepEqual(popups, []);
});

test('opens the setup page when the native host is too old to understand the request', async () => {
	boxFolder();
	nativeReply = { response: { resultCode: 'bad_request', path: '' } };
	await clickAction({ url: 'https://app.box.com/folder/1' });
	assert.equal(optionsPageOpened, 1);
});

test('update: opens the setup page only when the installed helper is not the latest', async () => {
	nativeReply = { response: { resultCode: 'bad_request', path: '' } };
	await listeners.onInstalled({ reason: 'update' });
	assert.equal(optionsPageOpened, 1);
	nativeReply = { response: { resultCode: 'pong', version: 3, path: '/Box', boxDriveFound: true } };
	await listeners.onInstalled({ reason: 'update' });
	assert.equal(optionsPageOpened, 1);
});

test('update: suggests a newer helper when the installed one still works', async () => {
	nativeReply = { response: { resultCode: 'pong', version: 2, path: 'C:\\Users\\me\\Box', boxDriveFound: true } };
	await listeners.onInstalled({ reason: 'update' });
	assert.equal(optionsPageOpened, 1);
	nativeReply = { response: { resultCode: 'pong', version: 3, path: 'C:\\Users\\me\\Box', boxDriveFound: true } };
	await listeners.onInstalled({ reason: 'update' });
	assert.equal(optionsPageOpened, 1);
});

test('update: opens the setup page when the helper doesn\'t start', async () => {
	nativeReply = { lastError: { message: 'Native host has exited.' } };
	await listeners.onInstalled({ reason: 'update' });
	assert.equal(optionsPageOpened, 1);
});

test('update: suggests updating 1.x helpers, which exit on ping but keep opening Box folders', async () => {
	// 1.x helpers answer only filePath and boxPath
	nativeReply = message => (message.filePath === ''
		? { response: { resultCode: 'does_not_exist', path: '' } }
		: { lastError: { message: 'Native host has exited.' } });
	await listeners.onInstalled({ reason: 'update' });
	assert.deepEqual(nativeMessages, [{ ping: true }, { filePath: '' }]);
	assert.equal(optionsPageOpened, 1);
	boxFolder();
	nativeReply = { response: { resultCode: 'directory_opened', path: 'C:\\Users\\me\\Box\\Team' } };
	await clickAction({ url: 'https://app.box.com/folder/1' });
	assert.deepEqual(nativeMessages.at(-1), { boxPath: ['All Files', 'Team'] });
	assert.equal(optionsPageOpened, 1);
});
