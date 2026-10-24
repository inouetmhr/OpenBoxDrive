import common from '../common.js';
import { zip } from './zip.mjs';
import { stripSurroundingQuotes } from '../path-utils.js';

{
	const localeCode = chrome.i18n.getMessage('_locale_code');
	document.querySelectorAll(`[lang="${localeCode}"]`).forEach(e => {
		e.style.display = 'inline';
	});
	document.title = chrome.i18n.getMessage('setup_page_title');
}
// Detect OS and browser
const ua = window.navigator.userAgent.toLowerCase();
const isMac = ua.includes('macintosh') || ua.includes('mac os');
const isWindows = ua.includes('windows');
const isLinux = ua.includes('linux');
const browser = (ua.indexOf(" edg/") !== -1) ? 'edge' : 'chrome';
console.log(`Setup is running for ${browser} on ${isMac ? 'MacOS' : isWindows ? 'Windows' : isLinux ? 'Linux' : 'Unknown OS'}`);

if (isMac) {
	document.getElementById('prerequisite').style.display = 'none';
	document.getElementById('install-instruction').innerHTML = "ターミナルで <code>sh setup.sh</code> を実行";
	document.getElementById('filePathToOpen').value = '/Applications/';
    document.querySelectorAll('.os-shell').forEach(e => {
		e.innerText = 'Finder';
	});
	document.getElementById('optional-feature').style.display = 'none';
}

async function getTextFromURL(url) {
	const response = await fetch(url);
	const blob = await response.blob();
	const reader = new FileReader();
  
	return new Promise((resolve, reject) => {
		reader.onload = function() {
			const text = reader.result;
			resolve(text);
		};
		reader.onerror = function() {
			reject(new Error('Failed to read Blob'));
		};
		reader.readAsText(blob);
	});
}

async function getBlobArrayBuffer(url) {
	const response = await fetch(url);
	const blob = await response.blob();
	const arrayBuffer = await blob.arrayBuffer();
	return arrayBuffer;
}

async function generateSetupZip() {
	const nativePyFileName = 'native-messaging-host-app.py';
	let nativeAppFileName, manifestJsonContent, setupTemplateUrl;
	if (isMac) {
		nativeAppFileName = 'native-messaging-host-app.sh';
		manifestJsonContent = generateManifestJson('___INSTDIR___/' + nativeAppFileName);
		setupTemplateUrl = "setup.template.sh";
	} else {
		nativeAppFileName = 'native-messaging-host-app.bat';
		manifestJsonContent = generateManifestJson(nativeAppFileName);
		setupTemplateUrl = "setup.template.bat";
	}

	const filePromises = [
		getBlobArrayBuffer(`../host-app-src/${nativeAppFileName}`),
		getBlobArrayBuffer(`../host-app-src/${nativePyFileName}`),
		getTextFromURL(setupTemplateUrl)
	];

	const [nativeAppBuffer, nativePyBuffer, setupTemplate] = await Promise.all(filePromises);
	const setupScript = setupTemplate.replaceAll("___BROWSER___", browser).replaceAll("___APPLICATIONNAME___", common.applicationName);

	const files = [
		{name: nativeAppFileName, buffer: nativeAppBuffer},
		{name: nativePyFileName, buffer: nativePyBuffer},
		{name: "manifest-template.json", buffer: new Blob([manifestJsonContent])},
		{name: isMac ? 'setup.sh' : 'setup.bat', buffer: new Blob([setupScript])},
	];
	return zip(files);
}

const generateManifestJson = (nativeMessagingHostPath) => {
	const value = {
		name: common.applicationName,
		description: common.description,
		path: nativeMessagingHostPath,
		type: 'stdio',
		allowed_origins: [
			`chrome-extension://${chrome.runtime.id}/`,
		],
	};
	const replacer = null;
	const space = '\t';
	return JSON.stringify(value, replacer, space);
};

{
	const setupZip = await generateSetupZip();
	const zipLink = document.getElementById('setup-zip-download-link');
	zipLink.href = URL.createObjectURL(setupZip);
}

{
	const filePathToOpen = document.getElementById('filePathToOpen');
	const openButton = document.getElementById('test-open');
	const execOpen = () => {
		const filePath = stripSurroundingQuotes(String(filePathToOpen.value));
		const message = {
			filePath,
		};
		common.sendNativeRequest(message);
	};
	openButton.addEventListener('click', execOpen);
	filePathToOpen.addEventListener('keydown', evt => {
		if (evt.key === 'Enter') {
			execOpen();
		}
	});
}
