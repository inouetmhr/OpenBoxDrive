// Render the Chrome Web Store images into store/screenshots/<lang>/ with headless Chrome.
// The real setup page and feedback popup are served with store/screenshots/chrome-stub.js in place of the chrome.* APIs.
// Set CHROME_PATH when Chrome isn't in its default location.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'store', 'screenshots');
const STUBBED_PAGES = ['/setup/index.html', '/feedback-popup.html'];

const SHOTS = [
	{ name: '1-overview', n: 'overview', size: '1280,800' },
	{ name: '2-setup', n: 'setup', size: '1280,800' },
	{ name: '3-install', n: 'install', size: '1280,800' },
	{ name: '4-error', n: 'error', size: '1280,800' },
	{ name: 'promo-small', n: 'promo', size: '440,280' },
];
const LANGS = ['ja', 'en'];

const CONTENT_TYPES = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.mjs': 'text/javascript; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.png': 'image/png',
	'.py': 'text/plain; charset=utf-8',
	'.sh': 'text/plain; charset=utf-8',
	'.bat': 'text/plain; charset=utf-8',
};

const findChrome = () => [
	process.env.CHROME_PATH,
	'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
	'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
	'/usr/bin/google-chrome',
].find(candidate => candidate && existsSync(candidate));

const serve = () => new Promise(resolve => {
	const server = createServer((req, res) => {
		const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
		const file = path.join(ROOT, urlPath);
		if (!file.startsWith(ROOT) || !existsSync(file)) {
			res.writeHead(404).end();
			return;
		}
		let body = readFileSync(file);
		if (STUBBED_PAGES.includes(urlPath)) {
			// The stub has to run before the page's own module script
			body = body.toString().replace('<script type="module"', '<script src="/store/screenshots/chrome-stub.js"></script><script type="module"');
		}
		res.writeHead(200, { 'Content-Type': CONTENT_TYPES[path.extname(file)] ?? 'application/octet-stream' }).end(body);
	});
	server.listen(0, '127.0.0.1', () => resolve(server));
});

const chrome = findChrome();
if (!chrome) throw new Error('Chrome not found: set CHROME_PATH');

const server = await serve();
const { port } = server.address();
const profile = mkdtempSync(path.join(tmpdir(), 'obd-screenshots-'));
try {
	for (const lang of LANGS) {
		mkdirSync(path.join(OUT, lang), { recursive: true });
		for (const shot of SHOTS) {
			const out = path.join(OUT, lang, `${shot.name}.png`);
			// Asynchronous on purpose: a synchronous call would block this process's server while Chrome loads the page
			await promisify(execFile)(chrome, [
				'--headless=new',
				'--hide-scrollbars',
				'--force-device-scale-factor=1',
				`--user-data-dir=${profile}`,
				`--window-size=${shot.size}`,
				'--virtual-time-budget=5000',
				`--screenshot=${out}`,
				`http://127.0.0.1:${port}/store/screenshots/slide.html?n=${shot.n}&lang=${lang}`,
			]);
			console.log(path.relative(ROOT, out));
		}
	}
} finally {
	server.close();
	rmSync(profile, { recursive: true, force: true });
}
