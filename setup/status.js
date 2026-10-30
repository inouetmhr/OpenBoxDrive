// Turn the answer to a {ping: true} request into what the setup page should show.
// result is what common.requestNativeHost resolves with.

// Messages of chrome.runtime.lastError from Chromium's native messaging
const HOST_NOT_FOUND = /native messaging host not found/i;
const HOST_FORBIDDEN = /native messaging host is forbidden/i;

export const SETUP_STATES = [
	'checking',
	'unsupported',
	'not_installed',
	'wrong_extension_id',
	'host_failed',
	'host_legacy',
	'host_outdated',
	'box_drive_missing',
	'ready',
];

// Helpers from 1.x don't know ping and exit without answering, just like a broken helper. They answer a filePath
// request for a path that doesn't exist with does_not_exist without opening anything, and an empty path can't exist.
// Current helpers reject filePath (bad_request), so this is sent only after ping got no answer.
export const LEGACY_PROBE = { filePath: '' };
// What a 1.x helper counts as when compared with the required version
const LEGACY_HOST_VERSION = 1;

// probeResult is the answer to LEGACY_PROBE, asked only when ping got no answer
export const diagnoseHost = (result, requiredVersion, probeResult) => {
	if (result?.resultCode === 'native_host_error') {
		if (HOST_NOT_FOUND.test(result.path)) return { state: 'not_installed' };
		if (HOST_FORBIDDEN.test(result.path)) return { state: 'wrong_extension_id' };
		// A 1.x helper, which opens Box folders as long as the extension doesn't need anything newer
		if (probeResult?.resultCode === 'does_not_exist') {
			return LEGACY_HOST_VERSION >= requiredVersion
				? { state: 'host_legacy' }
				: { state: 'host_outdated', hostVersion: LEGACY_HOST_VERSION };
		}
		// Python missing, or a broken helper
		return { state: 'host_failed', detail: result.path };
	}
	if (result?.resultCode === 'unsupported_platform') return { state: 'unsupported' };
	// Version 1 hosts answer ping with bad_request
	if (result?.resultCode !== 'pong' || !(result.version >= requiredVersion)) {
		return { state: 'host_outdated', hostVersion: result?.version ?? null };
	}
	const found = { hostVersion: result.version, boxDrivePath: result.path };
	return result.boxDriveFound ? { state: 'ready', ...found } : { state: 'box_drive_missing', ...found };
};

// Asks the helper with request (common.requestNativeHost) and diagnoses the answers
export const checkHost = async (request, requiredVersion) => {
	const result = await request({ ping: true });
	const status = diagnoseHost(result, requiredVersion);
	return status.state === 'host_failed' ? diagnoseHost(result, requiredVersion, await request(LEGACY_PROBE)) : status;
};

// Helpers that work but are older than latestVersion, which the setup page suggests updating
export const suggestsHelperUpdate = (status, latestVersion) =>
	['ready', 'box_drive_missing'].includes(status.state) && status.hostVersion < latestVersion;

// States in which the page keeps asking the host until the user fixes things
export const needsPolling = state => !['ready', 'unsupported'].includes(state);
