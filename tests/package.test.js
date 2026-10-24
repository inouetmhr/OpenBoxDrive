import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { listPackageFiles, findReservedNames } from '../scripts/package.mjs';

const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n').filter(Boolean);

test('package contains the extension and the native host sources', () => {
	const files = listPackageFiles(tracked);
	for (const file of ['manifest.json', 'background.js', 'box-injection.js', '_locales/ja/messages.json',
		'setup/index.html', 'setup/zip.mjs', 'host-app-src/native-messaging-host-app.py', 'LICENSE']) {
		assert.ok(files.includes(file), file);
	}
});

test('package leaves out development files', () => {
	const files = listPackageFiles([...tracked, 'tests/x.test.js', 'scripts/package.mjs', 'package.json', '.editorconfig', 'README_ja.md']);
	assert.deepEqual(files.filter(file => /^(tests|scripts)\/|^package\.json$|^\.|^README|^PrivacyPolicy/.test(file)), []);
});

test('reserved names starting with "_" are detected except _locales', () => {
	assert.deepEqual(findReservedNames(['_locales/en/messages.json', 'tests/__pycache__/x.pyc', '_metadata/a']), ['tests/__pycache__/x.pyc', '_metadata/a']);
});
