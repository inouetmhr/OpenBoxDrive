// Menu titles are messages that take the file manager's name as their placeholder
export const CONTEXT_MENU = {
	PAGE: {
		id: 'page',
		defaultTitleMessage: 'context_menu_page_default_title',
	},
	LINK: {
		id: 'link',
		defaultTitleMessage: 'context_menu_link_default_title',
	},
	SELECTION: {
		id: 'selection',
		defaultTitleMessage: 'context_menu_selection_default_title',
	},
};

// What the native host opens folders in
export const fileManagerName = os => os === 'mac' ? 'Finder' : 'Explorer';

export const getContextMenuTitle = async () => {
	const { os } = await chrome.runtime.getPlatformInfo();
	const contextMenuTitlePair = Object.entries(CONTEXT_MENU).map(([key, { defaultTitleMessage }]) => [
		key,
		chrome.i18n.getMessage(defaultTitleMessage, fileManagerName(os)),
	]);
	return Object.fromEntries(contextMenuTitlePair);
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
