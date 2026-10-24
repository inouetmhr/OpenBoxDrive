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
