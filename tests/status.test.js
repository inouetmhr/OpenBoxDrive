import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkHost, diagnoseHost, needsPolling, suggestsHelperUpdate, LEGACY_PROBE } from '../setup/status.js';

const error = message => ({ resultCode: 'native_host_error', path: message });
const pong = (fields = {}) => ({ resultCode: 'pong', version: 2, path: '/Users/me/Library/CloudStorage/Box-Box', boxDriveFound: true, ...fields });

test('Chromium errors map to what the user has to do', () => {
	assert.deepEqual(diagnoseHost(error('Specified native messaging host not found.'), 2), { state: 'not_installed' });
	assert.deepEqual(diagnoseHost(error('Access to the specified native messaging host is forbidden.'), 2), { state: 'wrong_extension_id' });
	assert.deepEqual(diagnoseHost(error('Native host has exited.'), 2), { state: 'host_failed', detail: 'Native host has exited.' });
	assert.deepEqual(diagnoseHost(error('Error when communicating with the native messaging host.'), 2).state, 'host_failed');
});

test('a helper that exits on ping but answers the probe is a working 1.x helper', () => {
	const exited = error('Native host has exited.');
	const legacy = { resultCode: 'does_not_exist', path: '' };
	assert.deepEqual(diagnoseHost(exited, 1, legacy), { state: 'host_legacy' });
	assert.deepEqual(diagnoseHost(exited, 1, exited), { state: 'host_failed', detail: 'Native host has exited.' });
	// The probe only matters when ping got no answer
	assert.equal(diagnoseHost(pong(), 1, legacy).state, 'ready');
});

test('a 1.x helper counts as version 1 against the required version', () => {
	const legacy = { resultCode: 'does_not_exist', path: '' };
	assert.deepEqual(diagnoseHost(error('Native host has exited.'), 4, legacy), { state: 'host_outdated', hostVersion: 1 });
	assert.deepEqual(diagnoseHost(pong({ version: 3 }), 4), { state: 'host_outdated', hostVersion: 3 });
});

test('checkHost probes for a 1.x helper only when ping gets no answer', async () => {
	const ask = replies => {
		const sent = [];
		const request = async message => { sent.push(message); return replies(message); };
		return { sent, request };
	};
	const current = ask(() => pong());
	assert.equal((await checkHost(current.request, 2)).state, 'ready');
	assert.deepEqual(current.sent, [{ ping: true }]);

	const missing = ask(() => error('Specified native messaging host not found.'));
	assert.equal((await checkHost(missing.request, 2)).state, 'not_installed');
	assert.deepEqual(missing.sent, [{ ping: true }]);

	const legacy = ask(message => (message === LEGACY_PROBE ? { resultCode: 'does_not_exist', path: '' } : error('Native host has exited.')));
	assert.equal((await checkHost(legacy.request, 1)).state, 'host_legacy');
	assert.deepEqual(legacy.sent, [{ ping: true }, { filePath: '' }]);

	const broken = ask(() => error('Native host has exited.'));
	assert.deepEqual(await checkHost(broken.request, 2), { state: 'host_failed', detail: 'Native host has exited.' });
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
	for (const state of ['checking', 'not_installed', 'wrong_extension_id', 'host_failed', 'host_legacy', 'host_outdated', 'box_drive_missing']) {
		assert.equal(needsPolling(state), true, state);
	}
	assert.equal(needsPolling('ready'), false);
	assert.equal(needsPolling('unsupported'), false);
});

test('a working but older helper gets an update suggestion', () => {
	assert.equal(suggestsHelperUpdate(diagnoseHost(pong(), 2), 3), true);
	assert.equal(suggestsHelperUpdate(diagnoseHost(pong({ boxDriveFound: false }), 2), 3), true);
	assert.equal(suggestsHelperUpdate(diagnoseHost(pong({ version: 3 }), 2), 3), false);
	// Setting up the helper comes first in these states anyway
	assert.equal(suggestsHelperUpdate(diagnoseHost(pong({ version: 1 }), 2), 3), false);
	assert.equal(suggestsHelperUpdate({ state: 'not_installed' }, 3), false);
});
