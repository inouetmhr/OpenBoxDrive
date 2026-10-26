import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../box-injection.js', import.meta.url), 'utf8');

const BASE = 'https://example.app.box.com';

const folderApi = (...names) => ({
	json: async () => ({ folder: { path: names.map(name => ({ name })) } }),
});

/**
 * Run box-injection.js in a sandbox with a fake page.
 * @param {object} page
 * @param {string} page.url document.URL
 * @param {object} [page.elements] selector -> element returned by document.querySelector
 * @param {object} [page.responses] url -> fetch response
 * @param {object} [page.parsedDocs] html text -> elements map for DOMParser results
 * @returns {{ result: Promise<object>, fetched: string[], context: object }}
 */
const runInjection = ({ url, elements = {}, responses = {}, parsedDocs = {} }) => {
	const fetched = [];
	const fakeDoc = map => ({ querySelector: sel => map[sel] ?? null });
	const context = vm.createContext({
		document: { URL: url, ...fakeDoc(elements) },
		fetch: async target => {
			fetched.push(target);
			if (!(target in responses)) throw new Error(`unexpected fetch: ${target}`);
			return responses[target];
		},
		DOMParser: class {
			parseFromString(text) {
				return fakeDoc(parsedDocs[text] ?? {});
			}
		},
		// no alert(): failures are reported to background.js through the returned value
		console: { log: () => {}, error: () => {} },
	});
	const result = vm.runInContext(source, context);
	return { result, fetched, context };
};

const pathOf = async result => {
	const value = await result;
	assert.equal(value.ok, true, `lookup failed: ${value.reason} ${value.detail}`);
	return [...value.path];
};

const failureOf = async result => {
	const value = await result;
	assert.equal(value.ok, false);
	return { ...value };
};

test('folder page resolves path from folder API', async () => {
	const { result, fetched } = runInjection({
		url: `${BASE}/folder/111`,
		responses: {
			[`${BASE}/app-api/enduserapp/folder/111`]: folderApi('All Files', 'Team', 'Docs'),
		},
	});
	assert.deepEqual(await pathOf(result), ['All Files', 'Team', 'Docs']);
	assert.deepEqual(fetched, [`${BASE}/app-api/enduserapp/folder/111`]);
});

test('file page appends file name to parent folder path', async () => {
	const { result } = runInjection({
		url: `${BASE}/file/999`,
		elements: {
			"[data-resin-target='parentfoldername']": { href: `${BASE}/folder/222` },
			'h1.item-name': { innerText: 'report.xlsx' },
		},
		responses: {
			[`${BASE}/app-api/enduserapp/folder/222`]: folderApi('All Files', 'Team'),
		},
	});
	assert.deepEqual(await pathOf(result), ['All Files', 'Team', 'report.xlsx']);
});

test('file page falls back to preview header title', async () => {
	const { result } = runInjection({
		url: `${BASE}/file/999`,
		elements: {
			"[data-resin-target='parentfoldername']": { href: `${BASE}/folder/222` },
			'div.PreviewHeaderTitle > h1': { innerText: 'memo.pdf' },
		},
		responses: {
			[`${BASE}/app-api/enduserapp/folder/222`]: folderApi('All Files'),
		},
	});
	assert.deepEqual(await pathOf(result), ['All Files', 'memo.pdf']);
});

test('integrations url is supported', async () => {
	const { result } = runInjection({
		url: `${BASE}/integrations/folder/333`,
		responses: {
			[`${BASE}/app-api/enduserapp/folder/333`]: folderApi('All Files', 'X'),
		},
	});
	assert.deepEqual(await pathOf(result), ['All Files', 'X']);
});

test('officeonline page reads parent folder from embedded JSON on file page', async () => {
	const embedded = 'Box.postStreamData = {"/app-api/x":{"items":[{"parentFolderID":"444","name":"plan.docx"}]}};';
	const { result } = runInjection({
		url: `${BASE}/integrations/officeonline/openOfficeOnline?fileId=555&sharedAccessCode=`,
		responses: {
			[`${BASE}/file/555`]: { text: async () => 'FILE_PAGE_HTML' },
			[`${BASE}/app-api/enduserapp/folder/444`]: folderApi('All Files', 'Y'),
		},
		parsedDocs: {
			FILE_PAGE_HTML: { 'script:last-of-type': { innerHTML: embedded } },
		},
	});
	assert.deepEqual(await pathOf(result), ['All Files', 'Y', 'plan.docx']);
});

test('canvas page uses board parent link and title', async () => {
	const { result } = runInjection({
		url: `${BASE}/canvas/666`,
		elements: {
			"[data-testid='board-info-parent-folder-link']": { href: `${BASE}/folder/777` },
			title: { innerText: 'Brainstorm' },
		},
		responses: {
			[`${BASE}/app-api/enduserapp/folder/777`]: folderApi('All Files'),
		},
	});
	assert.deepEqual(await pathOf(result), ['All Files', 'Brainstorm.boxcanvas']);
});

test('unsupported page returns unsupported_page with the url', async () => {
	const { result, fetched } = runInjection({ url: `${BASE}/recents` });
	assert.deepEqual(await failureOf(result), { ok: false, reason: 'unsupported_page', detail: `${BASE}/recents` });
	assert.deepEqual(fetched, []);
});

test('file page without parent folder link returns box_lookup_failed', async () => {
	const { result } = runInjection({ url: `${BASE}/file/999` });
	const failure = await failureOf(result);
	assert.equal(failure.reason, 'box_lookup_failed');
	assert.match(failure.detail, /Failed to resolve folder id for type=file/);
});

test('unexpected folder API response returns box_lookup_failed', async () => {
	const { result } = runInjection({
		url: `${BASE}/folder/111`,
		responses: {
			[`${BASE}/app-api/enduserapp/folder/111`]: { json: async () => ({ error: 'forbidden' }) },
		},
	});
	const failure = await failureOf(result);
	assert.equal(failure.reason, 'box_lookup_failed');
	assert.match(failure.detail, /Unexpected folder API response shape/);
});

test('falls back to the older preview header selector', async () => {
	const { result } = runInjection({
		url: `${BASE}/file/999`,
		elements: {
			"[data-resin-target='parentfoldername']": { href: `${BASE}/folder/222` },
			'div.preview-header-title-section > h1': { innerText: 'old.pdf' },
		},
		responses: {
			[`${BASE}/app-api/enduserapp/folder/222`]: folderApi('All Files'),
		},
	});
	assert.deepEqual(await pathOf(result), ['All Files', 'old.pdf']);
});

test('box url in a query string of another site is not supported', async () => {
	const { result } = runInjection({ url: `https://example.com/?next=${BASE}/folder/1` });
	assert.equal((await failureOf(result)).reason, 'unsupported_page');
});

test('can be injected again into the same page', async () => {
	const page = {
		url: `${BASE}/folder/111`,
		responses: {
			[`${BASE}/app-api/enduserapp/folder/111`]: folderApi('All Files'),
		},
	};
	const { result, context } = runInjection(page);
	await pathOf(result);
	const again = vm.runInContext(source, context);
	assert.deepEqual(await pathOf(again), ['All Files']);
});

test('parseBoxItemUrl', async t => {
	const { context, result } = runInjection({ url: `${BASE}/recents` });
	await result;
	const parse = url => {
		const parsed = context.parseBoxItemUrl(url);
		return parsed && { ...parsed };
	};
	await t.test('item pages', () => {
		assert.deepEqual(parse('https://app.box.com/folder/0'), { origin: 'https://app.box.com', type: 'folder', id: '0' });
		assert.deepEqual(parse(`${BASE}/notes/12?s=abc`), { origin: BASE, type: 'notes', id: '12' });
		assert.deepEqual(parse(`${BASE}/integrations/officeonline/openOfficeOnline?fileId=34`), { origin: BASE, type: 'officeonline', id: '34' });
	});
	await t.test('other pages and hosts', () => {
		assert.equal(parse(`${BASE}/recents`), null);
		assert.equal(parse('https://app.box.com.example.com/folder/1'), null);
		assert.equal(parse('http://app.box.com/folder/1'), null);
	});
});

test('parseEmbeddedItem', async t => {
	const { context, result } = runInjection({ url: `${BASE}/recents` });
	await result;
	await t.test('reads parent folder and name of the first item', () => {
		const item = context.parseEmbeddedItem('x = {"k":{"items":[{"parentFolderID":"1","name":"a.boxnote"}]}};');
		assert.deepEqual({ ...item }, { folderId: '1', name: 'a.boxnote' });
	});
	await t.test('rejects scripts without the expected JSON', () => {
		assert.throws(() => context.parseEmbeddedItem('no json here'), /Cannot slice embedded JSON/);
		assert.throws(() => context.parseEmbeddedItem('x = {"k":{}};'), /Unexpected JSON structure/);
	});
});
