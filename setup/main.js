import common from '../common.js';
import { zip, dl } from './zip.mjs';
import {
	CONTEXT_MENU,
	saveContextMenuTitle,
	getContextMenuTitle,
	updateContextMenu,
} from '../context-menu.js';

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
	document.getElementById('manual-setup').style.display = 'none';
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
	const setupScript = setupTemplate.replace("___BROWSER___", browser).replace("___APPLICATIONNAME___", common.applicationName);

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

const generateRegistryInfo = (dirPath) => {
	const filePath = `${dirPath.replace(/[\\/]$/, '')}/manifest.json`;
	const key = `HKEY_CURRENT_USER/Software/${browser}/NativeMessagingHosts/${common.applicationName}`.replace(/[/]/g, '\\');
	const value = filePath.replace(/[/]/g, '\\');
	const regFileContent = `
Windows Registry Editor Version 5.00

[${key}]
@="${value.replace(/[\\]/g, '\\\\')}"
	`.trim();
	return {
		key,
		value,
		regFileContent,
	};
};

{
	const manifestJsonContent = generateManifestJson();
	const manifestBlob = new Blob([manifestJsonContent], {type: 'text/plain',});
	const manifestLink = document.getElementById('manifest-json-download-link');
	manifestLink.href = URL.createObjectURL(manifestBlob);

	const setupZip = await generateSetupZip();
	const zipLink = document.getElementById('setup-zip-download-link');
	zipLink.href = URL.createObjectURL(setupZip);
}

{
	/**
	 * Convert a string to a Uint16Array for UTF-16
	 * @param {String} str
	 * @returns {Uint16Array}
	 */
	const convertToUtf16 = str => {
		const codePointArray = Array.from(str).map(c => c.codePointAt(0));
		// TODO: Supports surrogate pairs (if codePoint is greater than 0xFFFF)
		return new Uint16Array(codePointArray);
	};

	const dirPath = document.getElementById('dirPath');
	const downloadLinks = document.querySelectorAll('.reg-download-link');
	downloadLinks.forEach(e => e.download = 'manifest.reg');
	const update = () => {
		const bom = '\uFEFF';
		const registryInfo = generateRegistryInfo(dirPath.value || dirPath.placeholder);
		const regFileContent = registryInfo.regFileContent;

		const blob = new Blob([convertToUtf16(bom + regFileContent).buffer], {
			type: 'text/plain',
		});
		downloadLinks.forEach(e => e.href = URL.createObjectURL(blob));

		document.getElementById('reg-content').innerText = regFileContent;
		document.getElementById('reg-key').innerText = registryInfo.key;
		document.getElementById('reg-value').innerText = registryInfo.value;
	};

	dirPath.addEventListener('change', update);
	dirPath.addEventListener('keyup', update);
	dirPath.addEventListener('paste', () => {
		setTimeout(update, 10);
	});
	update();
}

{
	const filePathToOpen = document.getElementById('filePathToOpen');
	const openButton = document.getElementById('test-open');
	const execOpen = () => {
		let filePath = String(filePathToOpen.value);
		if (filePath.startsWith('"') && filePath.endsWith('"')) {
			filePath = filePath.slice(1, -1);
		}
		const message = {
			filePath,
		};
		chrome.runtime.sendNativeMessage(common.applicationName, message, response => {
			console.info(response);
			common.showNotification(response);
		});
	};
	openButton.addEventListener('click', execOpen);
	filePathToOpen.addEventListener('keydown', evt => {
		if (evt.key === 'Enter') {
			execOpen();
		}
	});
}

{
	const container = document.getElementById('context-menu-title-setting-container');

	getContextMenuTitle().then(contextMenuTitle => {
		Object.entries(contextMenuTitle).map(([key, currentTitle]) => {
			const input = document.createElement('input');
			input.value = currentTitle;
			input.placeholder = CONTEXT_MENU[key].defaultTitle;
			input.title = chrome.i18n.getMessage('press_enter_to_save');
			input.addEventListener('keydown', evt => {
				if (evt.key === 'Enter') {
					saveContextMenuTitle(key, input.value).then(updateContextMenu);
				}
			});

			const li = document.createElement('li');
			li.append(CONTEXT_MENU[key].description);
			li.append(input);
			container.append(li);
		});
	});
}
