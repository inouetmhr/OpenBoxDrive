// Minimal `chrome` global so extension modules can be imported under Node.
// Import this module before any module that touches `chrome` at load time.
globalThis.chrome = {
	i18n: {
		// Returns the key, followed by the substitutions for $1... if any
		getMessage: (key, substitutions) => substitutions === undefined ? key : `${key}(${[].concat(substitutions).join(',')})`,
	},
	runtime: {
		getManifest: () => ({ name: 'Open Box Drive' }),
		getPlatformInfo: async () => ({ os: globalThis.chromeStubOs ?? 'win' }),
	},
};
