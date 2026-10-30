// Stand-in for the chrome.* APIs so that the real setup page and feedback popup can be rendered for screenshots.
// Query parameters: os=windows|mac, lang=ja|en, host=missing|legacy|broken|ok, version=<helper version, default 3> (setup page), title / detail (popup)
const params = new URLSearchParams(location.search);
const userAgents = {
	windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36',
	mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36',
};
const os = params.get('os') ?? 'mac';
Object.defineProperty(navigator, 'userAgent', { get: () => userAgents[os] });

const boxDrive = os === 'mac' ? '/Users/you/Library/CloudStorage/Box-Box' : 'C:\\Users\\you\\Box';
window.chrome = {
	i18n: {
		getMessage: key => ({ _locale_code: params.get('lang') ?? 'ja', setup_page_title: 'Setup', extension_name: 'Open Box Drive' })[key] ?? '',
	},
	commands: {
		getAll: async () => [{ name: '_execute_action', shortcut: os === 'mac' ? '⇧⌘B' : 'Ctrl+Shift+B' }],
	},
	runtime: {
		id: 'abcdefghijklmnopabcdefghijklmnop',
		sendNativeMessage: (name, message, callback) => {
			const fail = error => {
				chrome.runtime.lastError = { message: error };
				callback();
				delete chrome.runtime.lastError;
			};
			if (params.get('host') === 'missing') return fail('Specified native messaging host not found.');
			// legacy: a 1.x helper that answers only filePath; broken: a helper that doesn't start
			if (params.get('host') === 'legacy') {
				return message.filePath === '' ? callback({ resultCode: 'does_not_exist', path: '' }) : fail('Native host has exited.');
			}
			if (params.get('host') === 'broken') return fail('Native host has exited.');
			callback({ resultCode: 'pong', version: Number(params.get('version') ?? 3), path: boxDrive, boxDriveFound: true });
		},
	},
	storage: {
		session: {
			get: async () => ({ feedback: { title: params.get('title') ?? '', detail: params.get('detail') ?? '' } }),
		},
	},
};
