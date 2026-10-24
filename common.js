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

const sendNativeRequest = message => {
	chrome.runtime.sendNativeMessage(applicationName, message, response => {
		// lastError is set when the native host is not installed or exits abnormally; response is undefined then
		const lastError = chrome.runtime.lastError;
		if (lastError) {
			console.error(lastError.message);
			showNotification({
				resultCode: 'native_host_error',
				path: lastError.message,
			});
			return;
		}
		console.info(response);
		showNotification(response);
	});
};

export default {
	applicationName,
	description,
	showNotification,
	sendNativeRequest,
};
