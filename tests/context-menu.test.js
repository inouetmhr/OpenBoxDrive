import './helpers/chrome-stub.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getContextMenuTitle } from '../context-menu.js';

test('menu titles name Finder on macOS', async () => {
	globalThis.chromeStubOs = 'mac';
	assert.deepEqual(await getContextMenuTitle(), {
		PAGE: 'context_menu_page_default_title(Finder)',
		LINK: 'context_menu_link_default_title(Finder)',
		SELECTION: 'context_menu_selection_default_title(Finder)',
	});
});

test('menu titles name Explorer on Windows', async () => {
	globalThis.chromeStubOs = 'win';
	assert.equal((await getContextMenuTitle()).PAGE, 'context_menu_page_default_title(Explorer)');
});

test('every default title message takes the file manager name as a placeholder', async () => {
	const { readFileSync } = await import('node:fs');
	for (const locale of ['en', 'ja']) {
		const messages = JSON.parse(readFileSync(new URL(`../_locales/${locale}/messages.json`, import.meta.url), 'utf8'));
		for (const key of ['context_menu_page_default_title', 'context_menu_link_default_title', 'context_menu_selection_default_title']) {
			assert.match(messages[key].message, /\$SHELL\$/, `${locale} ${key}`);
			assert.equal(messages[key].placeholders.shell.content, '$1', `${locale} ${key}`);
			assert.doesNotMatch(messages[key].message, /Explorer|Finder/, `${locale} ${key}`);
		}
	}
});
