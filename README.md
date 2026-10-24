( **English** / [日本語(Japanese)](README_ja.md) )

# Open Box Drive (Chrome / Edge extension)

Opens the folder or file you are viewing on the Box website in Box Drive, using Explorer (Windows) or Finder (macOS).

## Features
- On a Box folder page, click the toolbar icon (or press `Ctrl+Shift+B` / `⌘⇧B`) to open that folder in Box Drive.
- On a file page, the parent folder opens with the file selected.
- Supported pages: folders, files, Box Notes, Box Canvas, and files opened in Office Online.
- If the folder can't be opened, the reason appears under the icon.
- Also opens `file:` pages, `file:` links, and selected local paths from the context menu.

## Requirements
- Windows or macOS with Box Drive installed and signed in
- Google Chrome or Microsoft Edge
- Python 3 on Windows; `/usr/bin/python3` on macOS

## Setup
The extension needs a small helper program (a native messaging host) to open Explorer or Finder.
After installing the extension, the setup page opens and guides you through installing the helper.
It also tells you when the helper needs to be set up again, for example after the extension ID changes.

## Privacy
The extension sends nothing to the developer or third parties. See [PrivacyPolicy.md](PrivacyPolicy.md) (Japanese).

## Development: tests
No dependencies needed (Node.js 18+ `node:test` and Python `unittest`).

```bash
npm test
```

## Development: store package
```bash
npm run package
```

Creates `dist/open-box-drive-<version>.zip` from the git-tracked files, without tests, scripts and other development files.

See [README_ja.md](README_ja.md) for where the extension depends on the Box web page and how to fix it when Box changes.

## Note
This is a fork of the following extension.
- https://chrome.google.com/webstore/detail/open-local-folder-by-expl/ehidkllolkmedbkjbdkcgabdadcfppfg?hl=ja
- https://github.com/tksugimoto/chrome-extension_open-local-folder-by-explorer
