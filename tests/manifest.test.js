import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));

// Chrome refuses to install the extension on a platform that has neither its own key nor "default"
// ("Could not find key specification for 'command[1].suggested_key'"), as the store review on Linux/ChromeOS showed
test('every suggested shortcut has a default key for platforms not listed', () => {
	for (const [name, command] of Object.entries(manifest.commands ?? {})) {
		if (command.suggested_key) {
			assert.ok(command.suggested_key.default, `${name} needs suggested_key.default`);
		}
	}
});
