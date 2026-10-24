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
	'host_outdated',
	'box_drive_missing',
	'ready',
];

export const diagnoseHost = (result, requiredVersion) => {
	if (result?.resultCode === 'native_host_error') {
		if (HOST_NOT_FOUND.test(result.path)) return { state: 'not_installed' };
		if (HOST_FORBIDDEN.test(result.path)) return { state: 'wrong_extension_id' };
		// Python missing, or a host older than ping support that exits without answering
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

// States in which the page keeps asking the host until the user fixes things
export const needsPolling = state => !['ready', 'unsupported'].includes(state);
