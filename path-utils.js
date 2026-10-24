import { CONTEXT_MENU } from './context-menu.js';

// app.box.com or an enterprise subdomain such as example.app.box.com
export const isBoxUrl = (url) => {
	let parsed;
	try {
		parsed = new URL(url);
	} catch {
		return false;
	}
	return parsed.protocol === 'https:' &&
		(parsed.hostname === 'app.box.com' || parsed.hostname.endsWith('.app.box.com'));
};
export const isFileUrl = (url) => url && url.startsWith('file://');

// Paths copied from Explorer ("Copy as path") are wrapped in double quotes
export const stripSurroundingQuotes = text => {
	if (text.length >= 2 && text.startsWith('"') && text.endsWith('"')) {
		return text.slice(1, -1);
	}
	return text;
};

export class ExtractResult {
	constructor(target, path) {
		this.target = target;
		this.isSucceeded = !!path;
		this.path = path;
	}

	static ofFailure(target) {
		return new this(target, null);
	}
}

export const extractFilePath = info => {
	if (info.menuItemId === CONTEXT_MENU.PAGE.id) {
		const pageUrl = info.pageUrl;
		return new ExtractResult(pageUrl, convertUrl2FilePath(pageUrl));
	}
	if (info.menuItemId === CONTEXT_MENU.LINK.id) {
		const linkUrl = info.linkUrl;
		if (!linkUrl.startsWith('file://')) {
			// link 要素用の右クリックメニューの表示対象を <all_urls> にしているため fileスキーマ以外を無視する
			return ExtractResult.ofFailure(linkUrl);
		}
		return new ExtractResult(linkUrl, convertUrl2FilePath(linkUrl));
	}
	if (info.menuItemId === CONTEXT_MENU.SELECTION.id) {
		const selectionText = info.selectionText;
		return new ExtractResult(selectionText, stripSurroundingQuotes(selectionText));
	}
};

export const convertUrl2FilePath = encodedUrl => {
	// 1. Remove hash (e.g., #page=12 for PDF pages)
	// 2. Use decodeURIComponent instead of decodeURI for %23 to # conversion
	const decodedURI = decodeURIComponent(encodedUrl.replace(/#.*/, ''));
	if (decodedURI.startsWith('file:///')) {
		return decodedURI.replace(/^file:\/\/\//, '').replace(/\//g, '\\');
	}
	// UNC path ( "\\server_name\path\to\file" )
	// file://server_name/path/to/file
	return decodedURI.replace(/^file:/, '').replace(/\//g, '\\');
};
