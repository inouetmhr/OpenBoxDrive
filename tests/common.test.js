import './helpers/chrome-stub.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import common from '../common.js';

let nativeReply;

beforeEach(() => {
	chrome.runtime.sendNativeMessage = (name, message, callback) => {
		assert.equal(name, 'com.github.inouetmhr.open_box_drive');
		chrome.runtime.lastError = nativeReply.lastError;
		callback(nativeReply.response);
		delete chrome.runtime.lastError;
	};
});

test('requestNativeHost resolves with the host result', async () => {
	nativeReply = { response: { resultCode: 'file_opened', path: 'C:\\a.txt' } };
	assert.deepEqual(await common.requestNativeHost({ boxPath: ['All Files', 'a.txt'] }), { resultCode: 'file_opened', path: 'C:\\a.txt' });
});

test('requestNativeHost resolves with native_host_error when the host is unavailable', async () => {
	nativeReply = { lastError: { message: 'Specified native messaging host not found.' } };
	assert.deepEqual(await common.requestNativeHost({ ping: true }), {
		resultCode: 'native_host_error',
		path: 'Specified native messaging host not found.',
	});
});

test('extension name is the localized one, not the manifest placeholder', () => {
	assert.equal(common.extensionName, 'extension_name');
});
