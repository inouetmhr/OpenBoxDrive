import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isBoxUrl } from '../path-utils.js';

test('isBoxUrl', async t => {
	await t.test('matches app.box.com and enterprise subdomains', () => {
		assert.ok(isBoxUrl('https://app.box.com/folder/0'));
		assert.ok(isBoxUrl('https://example.app.box.com/file/123'));
	});
	await t.test('rejects other urls', () => {
		assert.ok(!isBoxUrl('https://www.box.com/'));
		assert.ok(!isBoxUrl('http://app.box.com/folder/0'));
		assert.ok(!isBoxUrl('file:///C:/'));
		assert.ok(!isBoxUrl(undefined));
	});
	await t.test('checks the host name, not the whole url', () => {
		assert.ok(!isBoxUrl('https://example.com/?next=https://app.box.com/folder/0'));
		assert.ok(!isBoxUrl('https://app.box.com.example.com/folder/0'));
		assert.ok(!isBoxUrl('https://notapp.box.com/folder/0'));
	});
});
