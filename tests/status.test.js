import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diagnoseHost, needsPolling } from '../setup/status.js';

const error = message => ({ resultCode: 'native_host_error', path: message });
const pong = (fields = {}) => ({ resultCode: 'pong', version: 2, path: '/Users/me/Library/CloudStorage/Box-Box', boxDriveFound: true, ...fields });

test('Chromium errors map to what the user has to do', () => {
	assert.deepEqual(diagnoseHost(error('Specified native messaging host not found.'), 2), { state: 'not_installed' });
	assert.deepEqual(diagnoseHost(error('Access to the specified native messaging host is forbidden.'), 2), { state: 'wrong_extension_id' });
	assert.deepEqual(diagnoseHost(error('Native host has exited.'), 2), { state: 'host_failed', detail: 'Native host has exited.' });
	assert.deepEqual(diagnoseHost(error('Error when communicating with the native messaging host.'), 2).state, 'host_failed');
});

test('hosts without ping or with an older version need an update', () => {
	assert.deepEqual(diagnoseHost({ resultCode: 'bad_request', path: '' }, 2), { state: 'host_outdated', hostVersion: null });
	assert.deepEqual(diagnoseHost(pong({ version: 1 }), 2), { state: 'host_outdated', hostVersion: 1 });
	assert.equal(diagnoseHost(undefined, 2).state, 'host_outdated');
});

test('a current host reports Box Drive', () => {
	assert.deepEqual(diagnoseHost(pong(), 2), { state: 'ready', hostVersion: 2, boxDrivePath: '/Users/me/Library/CloudStorage/Box-Box' });
	assert.deepEqual(diagnoseHost(pong({ version: 3, boxDriveFound: false }), 2), { state: 'box_drive_missing', hostVersion: 3, boxDrivePath: '/Users/me/Library/CloudStorage/Box-Box' });
});

test('unsupported platform', () => {
	assert.deepEqual(diagnoseHost({ resultCode: 'unsupported_platform', version: 2 }, 2), { state: 'unsupported' });
});

test('the page keeps checking until everything is ready', () => {
	for (const state of ['checking', 'not_installed', 'wrong_extension_id', 'host_failed', 'host_outdated', 'box_drive_missing']) {
		assert.equal(needsPolling(state), true, state);
	}
	assert.equal(needsPolling('ready'), false);
	assert.equal(needsPolling('unsupported'), false);
});
