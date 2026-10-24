export const CONTEXT_MENU = {
	PAGE: {
		id: 'page',
		defaultTitle: chrome.i18n.getMessage('context_menu_page_default_title'),
	},
	LINK: {
		id: 'link',
		defaultTitle: chrome.i18n.getMessage('context_menu_link_default_title'),
	},
	SELECTION: {
		id: 'selection',
		defaultTitle: chrome.i18n.getMessage('context_menu_selection_default_title'),
	},
};

const generateStorageKey = key => `contextMenus.title.${key}`;

export const getContextMenuTitle = () => {
	const keys = Object.keys(CONTEXT_MENU).map(generateStorageKey);
	return new Promise(resolve => {
		chrome.storage.local.get(keys, items => {
			const contextMenuTitlePair = Object.entries(CONTEXT_MENU).map(([key, { defaultTitle }]) => {
				const storageKey = generateStorageKey(key);
				const title = items[storageKey] || defaultTitle;
				return [
					key,
					title,
				];
			});
			const contextMenuTitle = Object.fromEntries(contextMenuTitlePair);
			resolve(contextMenuTitle);
		});
	});
};

export const createContextMenu = () => {
	getContextMenuTitle().then(contextMenuTitle => {
		chrome.contextMenus.create({
			title: contextMenuTitle.PAGE,
			contexts: ['page'],
			documentUrlPatterns: [
				'file:///*',
			],
			id: CONTEXT_MENU.PAGE.id,
		});
		chrome.contextMenus.create({
			title: contextMenuTitle.LINK,
			contexts: ['link'],
			targetUrlPatterns: [
				// If "file:///*" is specified, the menu is not displayed on the local file link, so <all_urls> is specified.
				// * It is also good to delete the targetUrlPatterns specification.
				'<all_urls>',
			],
			id: CONTEXT_MENU.LINK.id,
		});
		chrome.contextMenus.create({
			title: contextMenuTitle.SELECTION,
			contexts: ['selection'],
			id: CONTEXT_MENU.SELECTION.id,
		});
	});
};
