import{zip,dl}from'./setup/zip.mjs';

const description = 'Open Box Drive';

//const applicationName = `com.github.inouetmhr.${description.toLowerCase().replace(/ /g, '_')}_${chrome.runtime.id}`;
const applicationName = `com.github.inouetmhr.${description.toLowerCase().replace(/ /g, '_')}`

const nativeMessagingHostBinaryPath = 'native-messaging-host-app.bat';

const generateManifestJson = () => {
	const value = {
		name: applicationName,
		description,
		path: nativeMessagingHostBinaryPath,
		type: 'stdio',
		allowed_origins: [
			`chrome-extension://${chrome.runtime.id}/`,
		],
	};
	const replacer = null;
	const space = '\t';
	return JSON.stringify(value, replacer, space);
};

const generateRegistryInfo = (dirPath) => {
	const ua = window.navigator.userAgent.toLowerCase(); 
	const browser = (ua.indexOf(" edg/") != -1)? 'Microsoft/Edge' : 'Google/Chrome';
	const filePath = `${dirPath.replace(/[\\/]$/, '')}/manifest.json`;
	const key = `HKEY_CURRENT_USER/Software/${browser}/NativeMessagingHosts/${applicationName}`.replace(/[/]/g, '\\');
	const value = filePath.replace(/[/]/g, '\\');
	const regFileContent = `
Windows Registry Editor Version 5.00

[${key}]
@="${value.replace(/[\\]/g, '\\\\')}"
	`.trim();
	return {
		key,
		value,
		regFileContent,
	};
};

async function getTextFromURL(url) {
	const response = await fetch(url);
	const blob = await response.blob();
	const reader = new FileReader();
  
	return new Promise((resolve, reject) => {
	  reader.onload = function() {
		const text = reader.result;
		resolve(text);
	  };
  
	  reader.onerror = function() {
		reject(new Error('Failed to read Blob'));
	  };
  
	  reader.readAsText(blob);
	});
  }

 async function getBlobArrayBuffer(url) {
	const response = await fetch(url);
	const blob = await response.blob();
	const arrayBuffer = await blob.arrayBuffer();
  	return arrayBuffer;
}  

async function generateSetupScript() {
	const promises = [];
	promises.push(getTextFromURL("../host-app-src/native-messaging-host-app.bat"));
	promises.push(getTextFromURL("../host-app-src/native-messaging-host-app.py"));
	promises.push(getTextFromURL("./nativehost-setup.template.py"));
	const [nativehost_bat, nativehost_py, setup_py] = await Promise.all(promises);
	const ua = window.navigator.userAgent.toLowerCase(); 
	const browser = (ua.indexOf(" edg/") != -1)? 'edge' : 'chrome';

	const content = setup_py.replace("___NATIVEHOST_BAT___", nativehost_bat)
							.replace("___NATIVEHOST_PY___", nativehost_py)
							.replace("___EXTENTION_ID___", chrome.runtime.id)
							.replace("___BROWSER___", browser);
	return content;
};

async function generateSetupBatch(browser) {
	const setup_bat = await getTextFromURL("nativehost-setup.template.bat");
	const content = setup_bat.replace("___BROWSER___", browser);
	return content;
};

async function generateSetupZip() {
	const ua = window.navigator.userAgent.toLowerCase(); 
	const browser = (ua.indexOf(" edg/") != -1)? 'edge' : 'chrome';

	const manifestFileName = browser + "-manifest.json";
	const manifestJsonContent = generateManifestJson();

	const promises = [];
	promises.push(getBlobArrayBuffer("../host-app-src/native-messaging-host-app.bat"));
	promises.push(getBlobArrayBuffer("../host-app-src/native-messaging-host-app.py"));
	promises.push(getTextFromURL("setup.template.bat"));
	const [nativehost_bat, nativehost_py, setup_template] = await Promise.all(promises);

	const setup_bat = setup_template.replace("___BROWSER___", browser);
	const files=[
		{name:'native-messaging-host-app.bat',buffer:nativehost_bat},
		{name:'native-messaging-host-app.py',buffer:nativehost_py},
		{name:manifestFileName,buffer:new Blob([manifestJsonContent])},
		{name:'setup.bat',buffer:new Blob([setup_bat])},
	  ];
	return zip(files);
};

export default {
	applicationName,
	generateManifestJson,
	generateRegistryInfo,
	generateSetupScript,
	generateSetupZip,
};
