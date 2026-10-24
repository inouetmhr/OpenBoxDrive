const description = 'Open Box Drive';
const applicationName = `com.github.inouetmhr.${description.toLowerCase().replace(/ /g, '_')}`
// getManifest().name is the raw "__MSG_extension_name__" placeholder, so read the localized name instead
const extensionName = chrome.i18n.getMessage('extension_name');

const showNotification = info => {
	chrome.notifications.create({
		type: 'basic',
		iconUrl: '/icons/icon128.png',
		title: chrome.i18n.getMessage(`result_${info.resultCode}`) || extensionName,
		message: info.path ?? '',
		contextMessage: extensionName,
	});
};

// Bump together with HOST_VERSION in native-messaging-host-app.py when the extension needs a newer host
const REQUIRED_HOST_VERSION = 2;

// Resolves with the host's response, or { resultCode: 'native_host_error', path: <reason> } when it cannot be reached
const requestNativeHost = message => new Promise(resolve => {
	chrome.runtime.sendNativeMessage(applicationName, message, response => {
		// lastError is set when the native host is not installed or exits abnormally; response is undefined then
		const lastError = chrome.runtime.lastError;
		if (lastError) {
			console.error(lastError.message);
			resolve({ resultCode: 'native_host_error', path: lastError.message });
			return;
		}
		console.info(response);
		resolve(response);
	});
});

// Notifies the result and also resolves with it, for callers that react to it
const sendNativeRequest = async message => {
	const result = await requestNativeHost(message);
	showNotification(result);
	return result;
};

export default {
	applicationName,
	description,
	REQUIRED_HOST_VERSION,
	showNotification,
	requestNativeHost,
	sendNativeRequest,
};
