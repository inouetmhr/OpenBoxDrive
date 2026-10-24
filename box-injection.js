/* Injection code. This file will be serialized before injection. */
/* It can be injected into the same page many times: use only function declarations and var at the top level. */

// DOM selectors for the Box web UI, tried in order. Add a new candidate here when Box changes its pages.
var BOX_SELECTORS = {
	fileParentFolderLink: [
		"[data-resin-target='parentfoldername']",
	],
	fileName: [
		"h1.item-name",
		"div.PreviewHeaderTitle > h1",
		"div.preview-header-title-section > h1",
	],
	canvasParentFolderLink: [
		"[data-testid='board-info-parent-folder-link']",
	],
};

// Match Box item pages:
// https://*.app.box.com/(file|folder|notes|canvas|officeonline)/<id>
// and also https://*.app.box.com/integrations/(file|folder|...)/<id>
// The host check matches isBoxUrl in path-utils.js.
function parseBoxItemUrl(url) {
	const found = url.match(
		/^(https:\/\/(?:[a-z0-9-]+\.)*app\.box\.com)(?:\/integrations)?\/(file|folder|notes|canvas|officeonline)\/(?:openOfficeOnline\?fileId=)?(\d+)/i
	);
	if (!found) return null;
	return { origin: found[1], type: found[2], id: found[3] };
}

function queryFirst(doc, selectors) {
	for (const selector of selectors) {
		const element = doc.querySelector(selector);
		if (element) return element;
	}
	return null;
}

function folderIdFromLink(link) {
	return link?.href ? link.href.split("/").pop() : null;
}

// The file page embeds its item data as JSON in the last <script>; take the first item from it.
function parseEmbeddedItem(scriptText) {
	const start = scriptText.indexOf("{");
	const end = scriptText.lastIndexOf("}") + 1;
	if (start < 0 || end <= start) throw Error("Cannot slice embedded JSON.");
	const data = JSON.parse(scriptText.substring(start, end));
	const firstKey = Object.keys(data)[0];
	const item = data?.[firstKey]?.items?.[0];
	if (!item) throw Error("Unexpected JSON structure while reading notes/officeonline info.");
	return { folderId: item.parentFolderID, name: item.name };
}

async function fetchEmbeddedItem(origin, id) {
	const html = await fetch(`${origin}/file/${id}`).then((response) => response.text());
	const lastScript = new DOMParser().parseFromString(html, "text/html").querySelector("script:last-of-type");
	if (!lastScript) throw Error("Cannot find embedded JSON script on file page.");
	return parseEmbeddedItem(lastScript.innerHTML);
}

// Returns { folderId, name } for the item; name is null when the page itself is the folder.
async function resolveBoxItem(doc, { origin, type, id }) {
	switch (type) {
		case "folder":
			return { folderId: id, name: null };
		case "file":
			return {
				folderId: folderIdFromLink(queryFirst(doc, BOX_SELECTORS.fileParentFolderLink)),
				name: queryFirst(doc, BOX_SELECTORS.fileName)?.innerText ?? null,
			};
		case "notes":
		case "officeonline":
			return fetchEmbeddedItem(origin, id);
		case "canvas": {
			const title = doc.querySelector("title");
			return {
				folderId: folderIdFromLink(queryFirst(doc, BOX_SELECTORS.canvasParentFolderLink)),
				name: title ? `${title.innerText}.boxcanvas` : null,
			};
		}
	}
}

// Folder names from the root ("All Files") down to the folder itself.
async function fetchFolderPath(origin, folderId) {
	const json = await fetch(`${origin}/app-api/enduserapp/folder/${folderId}`).then((response) => response.json());
	const names = json?.folder?.path?.map((i) => i.name);
	if (!Array.isArray(names)) throw Error("Unexpected folder API response shape.");
	return names;
}

// reason is a key suffix of result_* in _locales, shown by background.js
function boxDriveError(reason, message) {
	return Object.assign(Error(message), { reason });
}

async function getBoxDrivePath() {
	const page = parseBoxItemUrl(document.URL);
	if (!page) {
		throw boxDriveError("unsupported_page", document.URL);
	}

	const item = await resolveBoxItem(document, page);
	if (!item.folderId) {
		throw Error(`Failed to resolve folder id for type=${page.type}`);
	}

	const path = await fetchFolderPath(page.origin, item.folderId);
	if (page.type !== "folder") {
		// Last fallback for file-like pages whose own lookup found no name
		const name = item.name ?? queryFirst(document, BOX_SELECTORS.fileName)?.innerText;
		if (name) path.push(name);
	}

	console.log("derived BoxDrive path:", path);
	return path;
}

// The value of the last expression is passed back to executeScript, so it must be serializable
async function runBoxDrivePath() {
	try {
		return { ok: true, path: await getBoxDrivePath() };
	} catch (e) {
		console.error(e);
		return { ok: false, reason: e.reason ?? "box_lookup_failed", detail: e.message };
	}
}

runBoxDrivePath();
