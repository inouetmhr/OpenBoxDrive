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
 * @returns {{ result: Promise<string[]>, fetched: string[], alerts: string[] }}
 */
const runInjection = ({ url, elements = {}, responses = {}, parsedDocs = {} }) => {
	const fetched = [];
	const alerts = [];
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
		alert: message => alerts.push(message),
		console: { log: () => {} },
	});
	const result = vm.runInContext(source, context);
	return { result, fetched, alerts };
};

test('folder page resolves path from folder API', async () => {
	const { result, fetched } = runInjection({
		url: `${BASE}/folder/111`,
		responses: {
			[`${BASE}/app-api/enduserapp/folder/111`]: folderApi('All Files', 'Team', 'Docs'),
		},
	});
	assert.deepEqual([...await result], ['All Files', 'Team', 'Docs']);
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
	assert.deepEqual([...await result], ['All Files', 'Team', 'report.xlsx']);
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
	assert.deepEqual([...await result], ['All Files', 'memo.pdf']);
});

test('integrations url is supported', async () => {
	const { result } = runInjection({
		url: `${BASE}/integrations/folder/333`,
		responses: {
			[`${BASE}/app-api/enduserapp/folder/333`]: folderApi('All Files', 'X'),
		},
	});
	assert.deepEqual([...await result], ['All Files', 'X']);
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
	assert.deepEqual([...await result], ['All Files', 'Y', 'plan.docx']);
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
	assert.deepEqual([...await result], ['All Files', 'Brainstorm.boxcanvas']);
});

test('unsupported page alerts and rejects', async () => {
	const { result, alerts, fetched } = runInjection({ url: `${BASE}/recents` });
	await assert.rejects(result, /unsupported page/);
	assert.equal(alerts.length, 1);
	assert.deepEqual(fetched, []);
});

test('file page without parent folder link rejects', async () => {
	const { result } = runInjection({ url: `${BASE}/file/999` });
	await assert.rejects(result, /Failed to resolve folder id for type=file/);
});
