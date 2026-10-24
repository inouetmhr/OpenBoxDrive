import './helpers/chrome-stub.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import common from '../common.js';

let notifications;
let nativeReply;

beforeEach(() => {
	notifications = [];
	chrome.notifications = { create: options => notifications.push(options) };
	chrome.runtime.sendNativeMessage = (name, message, callback) => {
		assert.equal(name, 'com.github.inouetmhr.open_box_drive');
		chrome.runtime.lastError = nativeReply.lastError;
		callback(nativeReply.response);
		delete chrome.runtime.lastError;
	};
});

test('sendNativeRequest notifies host result', () => {
	nativeReply = { response: { resultCode: 'directory_opened', path: 'C:\\Box\\Team' } };
	common.sendNativeRequest({ boxPath: ['All Files', 'Team'] });
	assert.equal(notifications.length, 1);
	assert.equal(notifications[0].title, 'result_directory_opened');
	assert.equal(notifications[0].message, 'C:\\Box\\Team');
});

test('sendNativeRequest notifies when native host is unavailable', () => {
	nativeReply = { lastError: { message: 'Specified native messaging host not found.' } };
	common.sendNativeRequest({ filePath: 'C:\\' });
	assert.equal(notifications.length, 1);
	assert.equal(notifications[0].title, 'result_native_host_error');
	assert.equal(notifications[0].message, 'Specified native messaging host not found.');
});

test('sendNativeRequest resolves with the host result', async () => {
	nativeReply = { response: { resultCode: 'file_opened', path: 'C:\\a.txt' } };
	assert.deepEqual(await common.sendNativeRequest({ filePath: 'C:\\a.txt' }), { resultCode: 'file_opened', path: 'C:\\a.txt' });
});

test('sendNativeRequest resolves with native_host_error when the host is unavailable', async () => {
	nativeReply = { lastError: { message: 'Specified native messaging host not found.' } };
	assert.deepEqual(await common.sendNativeRequest({ filePath: 'C:\\' }), {
		resultCode: 'native_host_error',
		path: 'Specified native messaging host not found.',
	});
});
