const description = 'Open Box Drive';
const applicationName = `com.github.inouetmhr.${description.toLowerCase().replace(/ /g, '_')}`
const extensionName = chrome.runtime.getManifest().name;

const showNotification = info => {
	chrome.notifications.create({
		type: 'basic',
		iconUrl: '/icons/icon128.png',
		title: chrome.i18n.getMessage(`result_${info.resultCode}`) || info.resultMessage, // "resultMessage" is for compatibility before i18n support
		message: info.path,
		contextMessage: extensionName,
	});
};

export default {
	applicationName,
	description,
	showNotification
};
