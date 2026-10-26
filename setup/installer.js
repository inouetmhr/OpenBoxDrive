// Build the files users download from the setup page: a single setup.sh on macOS,
// and a zip with setup.bat and the host files on Windows (a downloaded .bat alone triggers more warnings).

const HEREDOC_END = 'OPEN_BOX_DRIVE_EOF';

export const nativeHostManifest = ({ applicationName, description, extensionId, hostPath }) => JSON.stringify({
	name: applicationName,
	description,
	path: hostPath,
	type: 'stdio',
	allowed_origins: [
		`chrome-extension://${extensionId}/`,
	],
}, null, '\t');

// Replace ___KEY___ placeholders; a function replacement keeps "$" in values literal
const fill = (template, values) => Object.entries(values).reduce(
	(text, [key, value]) => text.replaceAll(`___${key}___`, () => value),
	template,
);

const heredocBody = (name, text) => {
	if (text.split('\n').includes(HEREDOC_END)) throw new Error(`${name} contains the heredoc delimiter`);
	// The template puts the delimiter on the next line, so drop the file's own final newline
	return text.replace(/\n$/, '');
};

export const buildMacSetupScript = ({ template, browser, applicationName, description, extensionId, hostPy, hostSh }) => {
	// Expanded by the shell: the manifest heredoc is unquoted so that $DEST_DIR becomes the real folder
	const manifest = nativeHostManifest({ applicationName, description, extensionId, hostPath: '$DEST_DIR/native-messaging-host-app.sh' });
	if (/[`\\]/.test(manifest)) throw new Error('manifest must not contain characters the shell expands');
	return fill(template, {
		BROWSER: browser,
		APPLICATIONNAME: applicationName,
		HOST_PY: heredocBody('host .py', hostPy),
		HOST_SH: heredocBody('host .sh', hostSh),
		MANIFEST: manifest,
	});
};

export const buildWindowsSetupFiles = ({ template, browser, applicationName, description, extensionId, hostPy, hostBat }) => [
	{ name: 'native-messaging-host-app.bat', content: hostBat },
	{ name: 'native-messaging-host-app.py', content: hostPy },
	// Relative path: setup.bat copies the manifest next to the .bat
	{ name: 'manifest-template.json', content: nativeHostManifest({ applicationName, description, extensionId, hostPath: 'native-messaging-host-app.bat' }) },
	{ name: 'setup.bat', content: fill(template, { BROWSER: browser, APPLICATIONNAME: applicationName }) },
];
