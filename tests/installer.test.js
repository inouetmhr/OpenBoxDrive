import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildMacSetupScript, buildWindowsSetupFiles } from '../setup/installer.js';

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const options = {
	browser: 'edge',
	applicationName: 'com.github.inouetmhr.open_box_drive',
	description: 'Open Box Drive',
	extensionId: 'abcdefghijklmnopabcdefghijklmnop',
};

test('macOS setup script installs the host files and the manifest', { skip: process.platform !== 'darwin' && 'runs the script with /bin/sh on macOS' }, () => {
	const hostPy = read('host-app-src/native-messaging-host-app.py');
	const hostSh = read('host-app-src/native-messaging-host-app.sh');
	const script = buildMacSetupScript({ ...options, template: read('setup/setup.template.sh'), hostPy, hostSh });
	const home = mkdtempSync(path.join(tmpdir(), 'obd-home-'));
	try {
		execFileSync('/bin/sh', ['-s'], { input: script, env: { ...process.env, HOME: home } });
		const destDir = path.join(home, 'Library/Application Support/OpenBoxDrive');
		assert.equal(readFileSync(path.join(destDir, 'native-messaging-host-app.py'), 'utf8'), hostPy);
		assert.equal(readFileSync(path.join(destDir, 'native-messaging-host-app.sh'), 'utf8'), hostSh);
		assert.ok(statSync(path.join(destDir, 'native-messaging-host-app.sh')).mode & 0o100, 'launcher is executable');
		const manifest = JSON.parse(readFileSync(path.join(home, 'Library/Application Support/Microsoft Edge/NativeMessagingHosts', `${options.applicationName}.json`), 'utf8'));
		assert.deepEqual(manifest, {
			name: options.applicationName,
			description: 'Open Box Drive',
			path: path.join(destDir, 'native-messaging-host-app.sh'),
			type: 'stdio',
			allowed_origins: [`chrome-extension://${options.extensionId}/`],
		});
	} finally {
		rmSync(home, { recursive: true, force: true });
	}
});

test('macOS setup script keeps "$" in embedded files literal', () => {
	const script = buildMacSetupScript({ ...options, template: read('setup/setup.template.sh'), hostPy: 'price = "$1 $&"\n', hostSh: 'echo "$0"\n' });
	assert.match(script, /^price = "\$1 \$&"$/m);
	assert.doesNotMatch(script, /___[A-Z_]+___/);
});

test('macOS setup script rejects files containing the heredoc delimiter', () => {
	assert.throws(() => buildMacSetupScript({ ...options, template: read('setup/setup.template.sh'), hostPy: 'x\nOPEN_BOX_DRIVE_EOF\n', hostSh: '' }), /delimiter/);
});

test('Windows setup files fill the templates and point the manifest at the .bat', () => {
	const files = Object.fromEntries(buildWindowsSetupFiles({ ...options, template: read('setup/setup.template.bat'), hostPy: 'py', hostBat: 'bat' }).map(f => [f.name, f.content]));
	assert.deepEqual(Object.keys(files), ['native-messaging-host-app.bat', 'native-messaging-host-app.py', 'manifest-template.json', 'setup.bat']);
	assert.equal(JSON.parse(files['manifest-template.json']).path, 'native-messaging-host-app.bat');
	assert.match(files['setup.bat'], /set "BROWSER=edge"/);
	assert.match(files['setup.bat'], /NativeMessagingHosts\\com\.github\.inouetmhr\.open_box_drive"/);
	assert.doesNotMatch(files['setup.bat'], /___[A-Z_]+___/);
	assert.match(files['setup.bat'], /\r\n/, 'keeps CRLF from the template');
});
