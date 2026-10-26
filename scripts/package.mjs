// Build the zip to upload to the Chrome Web Store / Edge Add-ons: dist/open-box-drive-<version>.zip
// Packs the git-tracked files of the extension, from the working tree, minus development-only files.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const EXCLUDED = [
	/^tests\//,
	/^scripts\//,
	/^store\//,
	/^dist\//,
	/^package(-lock)?\.json$/,
	/^README.*\.md$/,
	/^PrivacyPolicy\.md$/,
	/(^|\/)\.[^/]+$/, // .gitignore, .editorconfig, ...
];

export const listPackageFiles = trackedFiles => trackedFiles.filter(file => !EXCLUDED.some(re => re.test(file)));

// Chrome refuses to load an extension with a file or folder name starting with "_", except _locales
export const findReservedNames = files => files.filter(file =>
	file.split('/').some((part, i) => part.startsWith('_') && !(i === 0 && part === '_locales')));

const manifestReferences = manifest => [
	manifest.background.service_worker,
	manifest.options_page,
	...Object.values(manifest.icons),
	...Object.values(manifest.action.default_icon),
].map(file => file.replace(/^\//, ''));

const main = async () => {
	const tracked = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);
	const files = listPackageFiles(tracked);

	const reserved = findReservedNames(files);
	if (reserved.length) throw new Error(`Reserved file names: ${reserved.join(', ')}`);
	const manifest = JSON.parse(readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
	const missing = manifestReferences(manifest).filter(file => !files.includes(file) || !existsSync(path.join(ROOT, file)));
	if (missing.length) throw new Error(`Files referenced by manifest.json are not packed: ${missing.join(', ')}`);

	// PetitZip compresses with CompressionStream through `self`, which Node does not define
	globalThis.self ??= globalThis;
	const { zip } = await import('../setup/zip.mjs');
	// Wrap in Blob: Buffer#buffer of a small file is a shared pool larger than the file
	const blob = await zip(files.map(name => ({ name, buffer: new Blob([readFileSync(path.join(ROOT, name))]) })), undefined, true);

	const out = path.join(ROOT, 'dist', `open-box-drive-${manifest.version}.zip`);
	mkdirSync(path.dirname(out), { recursive: true });
	writeFileSync(out, Buffer.from(await blob.arrayBuffer()));
	console.log(`${path.relative(ROOT, out)}: ${files.length} files`);
	files.forEach(file => console.log(`  ${file}`));
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	await main();
}
