async function waitQuerySelector(selector, node=document){ /* https://zenn.dev/doma_itachi/articles/0289cc5b40bace */
    let obj=null;
    for(let i=0;i<100&&!obj;i++){
        obj=await new Promise(resolve=>setTimeout(()=>resolve(node.querySelector(selector), 10)));
        /* console.log("!") */
    }
    return obj;
  }

async function getBoxDrivePath(){ // injection code (to be serialized)
	//console.log("getBoxDrivePath");
	const found = document.URL.match(/(https:\/\/.*\.?app.box.com)\/(file|folder)\/(\d+)/);
	if (!found) {
	  alert("This extension works only with box pages or file:// URLs.");
	  throw Error("URL unmatch: unsupported page");
	}
	const urlbase = found[1];
	let path = [];
	const dotButton = document.querySelectorAll(".ItemListBreadcrumb > button")[0];
	if (dotButton) {
	  dotButton.click();
	  const menuItem = "a[data-resin-target='openfolder'].menu-item";
	  await waitQuerySelector(menuItem);
	  path = [...document.querySelectorAll(menuItem),]
	  		.map((e) => e.innerText)
	  document.body.click();
	}
	path.push(...[
	  	...document.querySelectorAll(".ItemListBreadcrumb-listItem > a, .ItemListBreadcrumb-listItem > h1"),
		]
	  .map((v) => v.innerText)
	  .filter((v) => v !== ""));
	//console.log(path);
	if (path.length == 0) { /* this page is a file and there is no folder elements in the document*/
	  console.log("fetching folder id using BOX API")
	  const folder = document.querySelector("[class='parent-name']");
	  if (folder) {
		const folderid = folder.href.split('/').pop();
		//const url = Box.prefetchedData['/app-api/enduserapp/current-user'].preview.appHost + 'app-api/enduserapp/folder/' + folderid;
		const url = urlbase + "/app-api/enduserapp/folder/" + folderid;
		path = await fetch(url)
		  .then(response => response.json())
		  .then(json => json.folder.path.map(i => i.name));
	  }
	  console.log("fetch completed: " + path);
	}
	//add filename if exists
	const itemname = document.querySelector("h1[class='item-name']");
	if (itemname) { path.push(itemname.innerText); }
	console.log("derived BoxDrive path: " + path);
	return(path);
};
getBoxDrivePath();
