/* Injection code. This file will be serialized before injection. */
async function getBoxDrivePath() {
  // Match Box item pages:
  // https://*.app.box.com/(file|folder|notes|canvas|officeonline)/<id>
  // and also https://*.app.box.com/integrations/(file|folder|...)/<id>
  const found = document.URL.match(
    /(https:\/\/.*\.?app\.box\.com)(?:\/integrations)?\/(file|folder|notes|canvas|officeonline)\/(?:openOfficeOnline\?fileId=)?(\d+)/
  );
  if (!found) {
    alert("This extension works only with box pages.");
    throw Error("URL unmatch: unsupported page");
  }

  const urlbase = found[1];
  const typeStr = found[2];
  const idNoStr = found[3];

  let folderid = null;
  let fname = null;

  // --- Type-specific extraction of folderid / fname ---
  if (typeStr === "folder") {
    folderid = idNoStr;
  }

  if (typeStr === "file") {
    const folder = document.querySelector("[class='parent-name']");
    if (folder && folder.href) {
      folderid = folder.href.split("/").pop();
    }
    const itemname =
      document.querySelector("h1.item-name") ||
      document.querySelector("div.preview-header-title-section > h1");
    if (itemname) fname = itemname.innerText;
  }

  if (typeStr === "notes" || typeStr === "officeonline") {
    // Need to fetch the underlying file page to get parentFolderID and name
    const fileUrl = `${urlbase}/file/${idNoStr}`;
    const postStreamData = await fetch(fileUrl)
      .then((response) => response.text())
      .then((resText) => new DOMParser().parseFromString(resText, "text/html"))
      .then((resDOM) => {
        const lastScript = resDOM.querySelector("script:last-of-type");
        if (!lastScript) throw Error("Cannot find embedded JSON script on file page.");
        return lastScript.innerHTML;
      })
      .then((lastScrText) => {
        const start = lastScrText.indexOf("{");
        const end = lastScrText.lastIndexOf("}") + 1;
        if (start < 0 || end <= start) throw Error("Cannot slice embedded JSON.");
        return lastScrText.substring(start, end);
      })
      .then((jsonPart) => JSON.parse(jsonPart));
    console.log(postStreamData);
    const firstKey = Object.keys(postStreamData)[0];
    const item = postStreamData?.[firstKey]?.items?.[0];
    if (!item) throw Error("Unexpected JSON structure while reading notes/officeonline info.");

    folderid = item.parentFolderID;
    fname = item.name;
  }

  if (typeStr === "canvas") {
    const folder = document.querySelector("[data-testid='board-info-parent-folder-link']");
    if (folder && folder.href) {
      folderid = folder.href.split("/").pop();
    }
    const title = document.querySelector("title");
    if (title) fname = `${title.innerText}.boxcanvas`;
  }

  if (!folderid) {
    throw Error(`Failed to resolve folder id for type=${typeStr}`);
  }

  // --- Resolve folder path by folderid via Box API ---
  const folderApiUrl = `${urlbase}/app-api/enduserapp/folder/${folderid}`;
  const path = await fetch(folderApiUrl)
    .then((response) => response.json())
    .then((json) => {
      const names = json?.folder?.path?.map((i) => i.name);
      if (!Array.isArray(names)) throw Error("Unexpected folder API response shape.");
      return names;
    });

  // Keep previous behavior: path is array of folder names.
  // Add filename if this page represents a file-like item.
  if (typeStr !== "folder") {
    // If fname couldn't be resolved, try a last fallback (file pages)
    if (!fname) {
      const itemname =
        document.querySelector("h1.item-name") ||
        document.querySelector("div.preview-header-title-section > h1");
      if (itemname) fname = itemname.innerText;
    }
    if (fname) path.push(fname);
  }

  console.log("derived BoxDrive path:", path);
  return path;
}

getBoxDrivePath();
