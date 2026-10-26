// Minimal `chrome` global so extension modules can be imported under Node.
// Import this module before any module that touches `chrome` at load time.
globalThis.chrome = {
	i18n: {
		getMessage: key => key,
	},
	runtime: {
		getManifest: () => ({ name: 'Open Box Drive' }),
	},
};
