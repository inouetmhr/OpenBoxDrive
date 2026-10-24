import './helpers/chrome-stub.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Capture listeners that background.js registers at load time
const listeners = {};
const event = name => ({ addListener: fn => { listeners[name] = fn; } });
Object.assign(chrome.runtime, {
	onInstalled: event('onInstalled'),
	onStartup: event('onStartup'),
});
chrome.contextMenus = { onClicked: event('contextMenus.onClicked') };
chrome.action = { onClicked: event('action.onClicked') };

let notifications;
let nativeMessages;
let injection;

beforeEach(() => {
	notifications = [];
	nativeMessages = [];
	chrome.notifications = { create: options => notifications.push(options) };
	chrome.runtime.sendNativeMessage = (name, message, callback) => {
		nativeMessages.push(message);
		callback({ resultCode: 'directory_opened', path: 'opened' });
	};
	chrome.scripting = { executeScript: async () => injection() };
});

await import('../background.js');

const clickAction = tab => listeners['action.onClicked']({ id: 1, ...tab });

test('box page: sends the path found by box-injection.js to the native host', async () => {
	injection = () => [{ result: { ok: true, path: ['All Files', 'Team'] } }];
	await clickAction({ url: 'https://app.box.com/folder/1' });
	assert.deepEqual(nativeMessages, [{ boxPath: ['All Files', 'Team'] }]);
});

test('box page: notifies the reason when box-injection.js fails', async () => {
	injection = () => [{ result: { ok: false, reason: 'unsupported_page', detail: 'https://app.box.com/recents' } }];
	await clickAction({ url: 'https://app.box.com/recents' });
	assert.deepEqual(nativeMessages, []);
	assert.equal(notifications.length, 1);
	assert.equal(notifications[0].title, 'result_unsupported_page');
	assert.equal(notifications[0].message, 'https://app.box.com/recents');
	assert.equal(notifications[0].contextMessage, 'extension_name');
});

test('box page: notifies when the script cannot be injected', async () => {
	injection = () => { throw new Error('Frame with ID 0 was removed.'); };
	await clickAction({ url: 'https://app.box.com/folder/1' });
	assert.equal(notifications[0].title, 'result_box_lookup_failed');
	assert.equal(notifications[0].message, 'Frame with ID 0 was removed.');
});

test('box page: notifies when the script returns nothing', async () => {
	injection = () => [];
	await clickAction({ url: 'https://app.box.com/folder/1' });
	assert.equal(notifications[0].title, 'result_box_lookup_failed');
});

test('file url: sends the local path to the native host', async () => {
	await clickAction({ url: 'file:///C:/ProgramData/' });
	assert.deepEqual(nativeMessages, [{ filePath: 'C:\\ProgramData\\' }]);
});

test('other pages: notifies that the page is not supported', async () => {
	await clickAction({ url: 'https://example.com/' });
	assert.deepEqual(nativeMessages, []);
	assert.equal(notifications[0].title, 'result_unsupported_page');
	assert.equal(notifications[0].message, 'https://example.com/');
});

test('context menu: notifies when the link is not a local file', () => {
	listeners['contextMenus.onClicked']({ menuItemId: 'link', linkUrl: 'https://example.com/' });
	assert.deepEqual(nativeMessages, []);
	assert.equal(notifications[0].title, 'result_not_a_file_path');
	assert.equal(notifications[0].message, 'https://example.com/');
});
