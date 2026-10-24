( **English** / [日本語(Japanese)](README_ja.md) )

# Chrome/Edge extension: Open in Box Drive

## Function.
- Clicking the extension button in the browser opens the folder in Explorer (Box Drive) that corresponds to the page open in Box at the time.
- If the file opened in the browser is a file, the parent folder will be opened in Explorer with the file selected.

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

## Note.
This is a fork of the following extension.
- https://chrome.google.com/webstore/detail/open-local-folder-by-expl/ehidkllolkmedbkjbdkcgabdadcfppfg?hl=ja
- https://github.com/tksugimoto/chrome-extension_open-local-folder-by-explorer

