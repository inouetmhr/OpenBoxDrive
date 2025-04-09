import{zip,dl}from'./setup/zip.mjs';

const description = 'Open Box Drive';

//const applicationName = `com.github.inouetmhr.${description.toLowerCase().replace(/ /g, '_')}_${chrome.runtime.id}`;
const applicationName = `com.github.inouetmhr.${description.toLowerCase().replace(/ /g, '_')}`

const generateManifestJson = (nativeMessagingHostPath) => {
	const value = {
		name: applicationName,
		description,
		path: nativeMessagingHostPath,
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
async function generateSetupZip() {
	const ua = window.navigator.userAgent.toLowerCase();
	const isMac = ua.includes('macintosh');
	const browser = (ua.indexOf(" edg/") !== -1) ? 'edge' : 'chrome';

	const nativePyFileName = 'native-messaging-host-app.py';
	let nativeAppFileName, manifestJsonContent, setupTemplateUrl;
	if (isMac) {
		nativeAppFileName = 'native-messaging-host-app.sh';
		manifestJsonContent = generateManifestJson('___INSTDIR___/' + nativeAppFileName);
		setupTemplateUrl = "setup.template.sh";
	} else {
		nativeAppFileName = 'native-messaging-host-app.bat';
		manifestJsonContent = generateManifestJson(nativeAppFileName);
		setupTemplateUrl = "setup.template.bat";
	}

	const filePromises = [
		getBlobArrayBuffer(`../host-app-src/${nativeAppFileName}`),
		getBlobArrayBuffer(`../host-app-src/${nativePyFileName}`),
		getTextFromURL(setupTemplateUrl)
	];

	const [nativeAppBuffer, nativePyBuffer, setupTemplate] = await Promise.all(filePromises);
	const setupScript = setupTemplate.replace("___BROWSER___", browser).replace("___APPLICATIONNAME___", applicationName);

	const files = [
		{name: nativeAppFileName, buffer: nativeAppBuffer},
		{name: nativePyFileName, buffer: nativePyBuffer},
		{name: "manifest-template.json", buffer: new Blob([manifestJsonContent])},
		{name: isMac ? 'setup.sh' : 'setup.bat', buffer: new Blob([setupScript])},
	];
	return zip(files);
}

async function generateSetupZipWin() {
	if (navigator.userAgent.toLowerCase().includes('macintosh')) {
		return generateSetupZipMac();
	};
	const ua = window.navigator.userAgent.toLowerCase(); 
	const browser = (ua.indexOf(" edg/") != -1)? 'edge' : 'chrome';

	const manifestFileName = browser + "-manifest.json";
	const manifestJsonContent = generateManifestJson('native-messaging-host-app.bat');

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

async function generateSetupZipMac() {
	const ua = window.navigator.userAgent.toLowerCase(); 
	const browser = (ua.indexOf(" edg/") != -1)? 'edge' : 'chrome';

	const manifestFileName = "manifest-template.json";
	const manifestJsonContent = generateManifestJson('___INSTDIR___/native-messaging-host-app.sh');

	const promises = [];
	promises.push(getBlobArrayBuffer("../host-app-src/native-messaging-host-app.sh"));
	promises.push(getBlobArrayBuffer("../host-app-src/native-messaging-host-app.py"));
	promises.push(getTextFromURL("setup.template.sh"));
	const [nativehost_sh, nativehost_py, setup_template] = await Promise.all(promises);

	const setup_sh = setup_template.replace("___BROWSER___", browser).replace("___APPLICATIONNAME___", applicationName);
	const files=[
		{name:'native-messaging-host-app.sh',buffer:nativehost_sh},
		{name:'native-messaging-host-app.py',buffer:nativehost_py},
		{name:manifestFileName,buffer:new Blob([manifestJsonContent])},
		{name:'setup.sh',buffer:new Blob([setup_sh])},
	  ];
	return zip(files);
};

export default {
	applicationName,
	generateManifestJson,
	generateRegistryInfo,
	generateSetupZip,
};
