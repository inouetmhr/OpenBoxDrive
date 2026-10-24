import common from '../common.js';
import { zip } from './zip.mjs';
import { stripSurroundingQuotes } from '../path-utils.js';

// Detect OS and browser
const ua = window.navigator.userAgent.toLowerCase();
const os = ua.includes('windows') ? 'windows'
	: (ua.includes('macintosh') || ua.includes('mac os')) ? 'mac'
	: 'unsupported';
const isMac = os === 'mac';
const browser = (ua.indexOf(" edg/") !== -1) ? 'edge' : 'chrome';
console.log(`Setup is running for ${browser} on ${os}`);

// Show elements for the current locale (lang) and OS (data-os, space separated)
{
	const localeCode = chrome.i18n.getMessage('_locale_code');
	document.querySelectorAll('[lang], [data-os]').forEach(e => {
		const langMatches = !e.hasAttribute('lang') || e.getAttribute('lang') === localeCode;
		const osMatches = !e.hasAttribute('data-os') || e.dataset.os.split(' ').includes(os);
		e.classList.toggle('visible', langMatches && osMatches);
	});
	document.title = chrome.i18n.getMessage('setup_page_title');
	document.querySelectorAll('.os-shell').forEach(e => {
		e.innerText = isMac ? 'Finder' : 'Explorer';
	});
	document.getElementById('filePathToOpen').value = isMac ? '/Applications/' : 'C:\\ProgramData\\';
	document.querySelectorAll('.extension-id').forEach(e => {
		e.textContent = chrome.runtime.id;
	});
}

async function getTextFromURL(url) {
	const response = await fetch(url);
	return response.text();
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

if (os !== 'unsupported') {
	const setupZip = await generateSetupZip();
	const zipLink = document.getElementById('setup-zip-download-link');
	zipLink.href = URL.createObjectURL(setupZip);
}

{
	const filePathToOpen = document.getElementById('filePathToOpen');
	const openButton = document.getElementById('test-open');
	const testResult = document.getElementById('test-result');
	// Show the result on the page too: notifications may be turned off in the OS
	const execOpen = async () => {
		const filePath = stripSurroundingQuotes(String(filePathToOpen.value));
		const message = {
			filePath,
		};
		testResult.textContent = '';
		const result = await common.sendNativeRequest(message);
		const succeeded = ['directory_opened', 'file_opened'].includes(result.resultCode);
		testResult.dataset.status = succeeded ? 'ok' : 'error';
		testResult.textContent = `${chrome.i18n.getMessage(`result_${result.resultCode}`) || result.resultCode}: ${result.path ?? ''}`;
	};
	openButton.addEventListener('click', execOpen);
	filePathToOpen.addEventListener('keydown', evt => {
		if (evt.key === 'Enter') {
			execOpen();
		}
	});
}
