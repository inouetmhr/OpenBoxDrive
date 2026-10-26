// Shows the message that feedback.js stored just before opening this popup
import { FEEDBACK_KEY } from './feedback.js';

const AUTO_CLOSE_MS = 8000;

const { [FEEDBACK_KEY]: feedback } = await chrome.storage.session.get(FEEDBACK_KEY);
document.getElementById('title').textContent = feedback?.title ?? chrome.i18n.getMessage('extension_name');
document.getElementById('detail').textContent = feedback?.detail ?? '';
setTimeout(() => window.close(), AUTO_CLOSE_MS);
