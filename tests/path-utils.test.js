import './helpers/chrome-stub.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	isBoxUrl,
	isFileUrl,
	extractFilePath,
	convertUrl2FilePath,
	stripSurroundingQuotes,
} from '../path-utils.js';

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
});

test('isFileUrl', () => {
	assert.ok(isFileUrl('file:///C:/ProgramData/'));
	assert.ok(!isFileUrl('https://app.box.com/'));
	assert.ok(!isFileUrl(undefined));
});

test('stripSurroundingQuotes', () => {
	assert.equal(stripSurroundingQuotes('"C:\\a b"'), 'C:\\a b');
	assert.equal(stripSurroundingQuotes('C:\\a'), 'C:\\a');
	assert.equal(stripSurroundingQuotes('"C:\\a'), '"C:\\a');
	assert.equal(stripSurroundingQuotes('"'), '"');
});

test('convertUrl2FilePath', async t => {
	await t.test('local drive path', () => {
		assert.equal(convertUrl2FilePath('file:///C:/ProgramData/'), 'C:\\ProgramData\\');
	});
	await t.test('decodes percent-encoding including %23', () => {
		assert.equal(convertUrl2FilePath('file:///C:/a%20b/%E3%81%82%23.txt'), 'C:\\a b\\あ#.txt');
	});
	await t.test('strips hash fragment', () => {
		assert.equal(convertUrl2FilePath('file:///C:/doc.pdf#page=12'), 'C:\\doc.pdf');
	});
	await t.test('UNC path', () => {
		assert.equal(convertUrl2FilePath('file://server/share/dir'), '\\\\server\\share\\dir');
	});
});

test('extractFilePath', async t => {
	await t.test('page menu converts page url', () => {
		const result = extractFilePath({ menuItemId: 'page', pageUrl: 'file:///C:/x/' });
		assert.equal(result.isSucceeded, true);
		assert.equal(result.path, 'C:\\x\\');
	});
	await t.test('link menu accepts file links', () => {
		const result = extractFilePath({ menuItemId: 'link', linkUrl: 'file:///C:/x/y.txt' });
		assert.equal(result.path, 'C:\\x\\y.txt');
	});
	await t.test('link menu rejects non-file links', () => {
		const result = extractFilePath({ menuItemId: 'link', linkUrl: 'https://example.com/' });
		assert.equal(result.isSucceeded, false);
		assert.equal(result.target, 'https://example.com/');
	});
	await t.test('selection strips surrounding double quotes', () => {
		const result = extractFilePath({ menuItemId: 'selection', selectionText: '"C:\\a b\\"' });
		assert.equal(result.path, 'C:\\a b\\');
		assert.equal(result.target, '"C:\\a b\\"');
	});
	await t.test('selection keeps text without paired quotes', () => {
		const result = extractFilePath({ menuItemId: 'selection', selectionText: '"C:\\a' });
		assert.equal(result.path, '"C:\\a');
	});
});
