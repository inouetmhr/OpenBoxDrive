import common from '../common.js';
import { zip } from './zip.mjs';
import { diagnoseHost, needsPolling } from './status.js';
import { buildMacSetupScript, buildWindowsSetupFiles } from './installer.js';

const POLL_INTERVAL_MS = 2000;

// Detect OS and browser
const ua = window.navigator.userAgent.toLowerCase();
const os = ua.includes('windows') ? 'windows'
	: (ua.includes('macintosh') || ua.includes('mac os')) ? 'mac'
	: 'unsupported';
const browser = (ua.indexOf(" edg/") !== -1) ? 'edge' : 'chrome';
const localeCode = chrome.i18n.getMessage('_locale_code');
console.log(`Setup is running for ${browser} on ${os}`);

const setText = (selector, text) => {
	document.querySelectorAll(selector).forEach(e => {
		e.textContent = text;
	});
};

// Show only elements for the current locale (lang), OS (data-os) and state (data-state); the last two are space separated lists
const render = status => {
	document.querySelectorAll('[lang], [data-os], [data-state]').forEach(e => {
		const langMatches = !e.hasAttribute('lang') || e.getAttribute('lang') === localeCode;
		const osMatches = !e.dataset.os || e.dataset.os.split(' ').includes(os);
		const stateMatches = !e.dataset.state || e.dataset.state.split(' ').includes(status.state);
		e.hidden = !(langMatches && osMatches && stateMatches);
	});
	setText('.host-version', status.hostVersion ?? '');
	setText('.box-drive-path', status.boxDrivePath ?? '');
	setText('.error-detail', status.detail ?? '');
	document.body.classList.add('rendered');
};

{
	document.title = chrome.i18n.getMessage('setup_page_title');
	setText('.os-name', os === 'mac' ? 'macOS' : 'Windows');
	setText('.os-shell', os === 'mac' ? 'Finder' : 'Explorer');
	setText('.browser-name', browser === 'edge' ? 'Microsoft Edge' : 'Google Chrome');
	setText('.extension-id', chrome.runtime.id);
	// The user may have changed the shortcut in the browser's extension settings
	const commands = await chrome.commands.getAll();
	const shortcut = commands.find(command => command.name === '_execute_action')?.shortcut;
	setText('.shortcut', shortcut ?? '');
	document.querySelectorAll('.shortcut-line').forEach(e => {
		e.style.display = shortcut ? '' : 'none';
	});
}

// --- Checking the helper ---

let pollTimer;
const check = async () => {
	clearTimeout(pollTimer);
	const status = os === 'unsupported'
		? { state: 'unsupported' }
		: diagnoseHost(await common.requestNativeHost({ ping: true }), common.REQUIRED_HOST_VERSION);
	render(status);
	// Each check starts the helper process, so stop while the page is in the background
	if (needsPolling(status.state) && !document.hidden) {
		pollTimer = setTimeout(check, POLL_INTERVAL_MS);
	}
};
document.addEventListener('visibilitychange', () => {
	if (!document.hidden) check();
});
render({ state: 'checking' });
check();

// --- Downloading the setup file ---

const fetchText = async url => (await fetch(url)).text();

const download = (name, blob) => {
	const a = document.createElement('a');
	a.href = URL.createObjectURL(blob);
	a.download = name;
	a.click();
	setTimeout(() => URL.revokeObjectURL(a.href), 60 * 1000);
};

// Built on click from the extension's current files, so a page left open doesn't hand out an old helper
const downloadSetup = async () => {
	const options = {
		browser,
		applicationName: common.applicationName,
		description: common.description,
		extensionId: chrome.runtime.id,
	};
	if (os === 'mac') {
		const [template, hostPy, hostSh] = await Promise.all([
			fetchText('setup.template.sh'),
			fetchText('../host-app-src/native-messaging-host-app.py'),
			fetchText('../host-app-src/native-messaging-host-app.sh'),
		]);
		const script = buildMacSetupScript({ ...options, template, hostPy, hostSh });
		download('open-box-drive-setup.sh', new Blob([script], { type: 'text/x-sh' }));
		return;
	}
	const [template, hostPy, hostBat] = await Promise.all([
		fetchText('setup.template.bat'),
		fetchText('../host-app-src/native-messaging-host-app.py'),
		fetchText('../host-app-src/native-messaging-host-app.bat'),
	]);
	const files = buildWindowsSetupFiles({ ...options, template, hostPy, hostBat });
	download('nativehost-setup.zip', await zip(files.map(({ name, content }) => ({ name, buffer: new Blob([content]) }))));
};
document.getElementById('download-setup').addEventListener('click', downloadSetup);

document.getElementById('copy-mac-command').addEventListener('click', () => {
	navigator.clipboard.writeText(document.getElementById('mac-command').textContent);
});

// --- Trying it out ---

{
	const openResult = document.getElementById('open-result');
	document.getElementById('open-box-drive').addEventListener('click', async () => {
		openResult.textContent = '';
		// Also notifies, which shows the user whether notifications reach them
		const result = await common.sendNativeRequest({ boxPath: ['All Files'] });
		const succeeded = ['directory_opened', 'file_opened'].includes(result.resultCode);
		openResult.dataset.status = succeeded ? 'ok' : 'error';
		openResult.textContent = `${chrome.i18n.getMessage(`result_${result.resultCode}`) || result.resultCode}: ${result.path ?? ''}`;
	});
}
