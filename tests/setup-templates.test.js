import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

// setup/main.js fills these placeholders when generating nativehost-setup.zip
for (const template of ['setup/setup.template.bat', 'setup/setup.template.sh']) {
	test(`${template} takes browser and application name from placeholders`, () => {
		const content = read(template);
		assert.match(content, /___BROWSER___/);
		assert.match(content, /___APPLICATIONNAME___/);
		assert.doesNotMatch(content, /com\.github\.inouetmhr/);
	});
}

test('setup page has every element setup/main.js looks up', () => {
	const html = read('setup/index.html');
	const ids = [...read('setup/main.js').matchAll(/getElementById\('([^']+)'\)/g)].map(m => m[1]);
	assert.ok(ids.length > 0);
	for (const id of ids) {
		assert.match(html, new RegExp(`id="${id}"`), `missing #${id}`);
	}
});

test('setup page has no duplicate ids', () => {
	const ids = [...read('setup/index.html').matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
	assert.deepEqual(ids.filter((id, i) => ids.indexOf(id) !== i), []);
});
