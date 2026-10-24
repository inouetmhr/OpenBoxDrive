( [English](README.md) / **日本語(Japanese)** )

# Open Box Drive（Chrome / Edge 拡張機能）

Box の Web ページで見ているフォルダやファイルを、Box Drive のフォルダとして Explorer（Windows）や Finder（macOS）で開きます。

## 機能
- Box のフォルダのページでツールバーのアイコンをクリックすると、そのフォルダを Box Drive で開きます。
- ファイルのページでは、そのファイルを選択した状態で親フォルダを開きます。
- 対応しているページ: フォルダ、ファイル、Box Notes、Box Canvas、Office Online で開いているファイル
- キーボードショートカット: Windows は `Ctrl+Shift+B`、macOS は `⌘⇧B`（ブラウザの拡張機能の設定で変更できます）
- 開けなかったときは、アイコンの下に理由を表示します。開けたときは何も表示しません（Explorer / Finder のウインドウが開くことが結果です）。
- その他の機能
  - `file:` のページでアイコンをクリックすると、そのフォルダやファイルを開きます。
  - `file:` のリンクや、選択したパスの文字列（`C:\...`、`\\server\...`、`/Users/...` など）を右クリックメニューから開けます。前後の `"` は無視します。

## 動作環境
- Windows または macOS（Box Drive が使える OS のみ）
- Box Drive がインストールされ、サインインしていること
- Google Chrome または Microsoft Edge
- Windows: Python 3（[python.org](https://www.python.org/downloads/) のインストーラーで入れたもの）
- macOS: `/usr/bin/python3`（初回にコマンドライン・デベロッパ・ツールのインストールを求められたらインストールしてください）

## セットアップ
ブラウザの拡張機能だけでは Explorer や Finder を開けないため、拡張機能から呼び出される小さなヘルパー（native messaging host）をパソコンに入れます。

1. 拡張機能をインストールすると、設定画面が開きます（後からは拡張機能の「オプション」で開けます）。
2. 設定画面がヘルパーの状態を自動で調べ、次にやることを表示します。
   - Windows: `nativehost-setup.zip` をダウンロードして展開し、中の `setup.bat` を実行します。
   - macOS: `open-box-drive-setup.sh` をダウンロードし、ターミナルで `sh` に続けてファイルをドラッグして実行します。
3. セットアップが終わると、設定画面が自動で「準備完了」に変わります。

次の場合はセットアップをやり直す必要があります。どちらも設定画面やツールバーのアイコンが知らせます。
- 拡張機能の ID が変わったとき（入れ直したときや、別のフォルダから読み込んだとき）
- 拡張機能の更新で、新しいヘルパーが必要になったとき

### ヘルパーのインストール先と削除方法
| | ファイル | ブラウザへの登録 |
|---|---|---|
| Windows | `%LOCALAPPDATA%\OpenBoxDrive\NativeHost` | レジストリ `HKCU\Software\Microsoft\Edge\NativeMessagingHosts\com.github.inouetmhr.open_box_drive`（Chrome は `Google\Chrome`） |
| macOS | `~/Library/Application Support/OpenBoxDrive` | `~/Library/Application Support/Microsoft Edge/NativeMessagingHosts/com.github.inouetmhr.open_box_drive.json`（Chrome は `Google/Chrome`） |

拡張機能を削除したあとは、これらを消せばヘルパーもなくなります。

## プライバシー
本拡張機能は情報を外部に送信しません。詳しくは [PrivacyPolicy.md](PrivacyPolicy.md) を参照してください。

## 開発: テスト
外部依存なし（Node.js 18+ の `node:test` と Python 標準の `unittest`）で動きます。

```bash
npm test
```

| テスト | 対象 |
|---|---|
| `tests/box-injection.test.js` | Box のページからのパスの取得（DOM と fetch を差し替えて `box-injection.js` を実行） |
| `tests/background.test.js` | アイコンや右クリックメニューを押したときの動き、エラー表示、設定画面を開く条件 |
| `tests/status.test.js` | 設定画面の状態判定（ブラウザのエラーメッセージ → 次にやること） |
| `tests/installer.test.js` | セットアップファイルの生成（macOS では生成した `.sh` を仮のホームディレクトリで実際に実行） |
| `tests/test_native_host.py` | ヘルパー（パスの組み立て、Explorer / Finder の呼び出し、`ping`、stdio のやり取り） |
| `tests/path-utils.test.js`、`tests/context-menu.test.js`、`tests/common.test.js` | URL とパスの変換、メニューの表記、ヘルパーとの通信 |
| `tests/setup-templates.test.js`、`tests/package.test.js` | セットアップのテンプレートと設定画面の HTML、ストア提出用パッケージの中身 |

ヘルパーとの間のメッセージ形式を変えるときは、インストール済みの古いヘルパーとも動くようにしてください。ヘルパーは利用者がセットアップをやり直すまで更新されません。新しいヘルパーが必要になったら、`host-app-src/native-messaging-host-app.py` の `HOST_VERSION` と `common.js` の `REQUIRED_HOST_VERSION` を一緒に上げます。

## 開発: ストア提出用パッケージ
```bash
npm run package
```

`dist/open-box-drive-<version>.zip` を作ります。git 管理下のファイルから、テスト・スクリプト・README などの開発用ファイルを除いたものです（作業ツリーの内容が入ります）。

## 開発: Box の画面が変わったとき

Box の Web ページの作りに依存しているのは `box-injection.js` だけです。依存している箇所と、壊れたときの症状は次のとおりです。

| 依存している箇所 | コード | 壊れたときの症状 |
|---|---|---|
| URL の形（`/file/<id>`、`/folder/<id>`、`/notes/`、`/canvas/`、`/integrations/officeonline/openOfficeOnline?fileId=` など） | `parseBoxItemUrl` | 普通のフォルダやファイルのページなのに「Boxのフォルダ・ファイルのページか…でのみ動作します」と出る |
| ファイルのページの親フォルダへのリンク | `BOX_SELECTORS.fileParentFolderLink` | 「このBoxページのフォルダを特定できませんでした」、詳細が `Failed to resolve folder id for type=file` |
| ファイルのページのファイル名の見出し | `BOX_SELECTORS.fileName` | エラーにはならず、ファイルが選択されないまま親フォルダが開く。または「存在しません」と出て、パスの末尾がおかしい |
| Canvas の親フォルダへのリンクと `<title>` | `BOX_SELECTORS.canvasParentFolderLink`、`resolveBoxItem` の `canvas` | Canvas のページで上の 2 つと同じ症状 |
| Box の内部 API `/app-api/enduserapp/folder/<id>` の `folder.path[].name` | `fetchFolderPath` | すべてのページで失敗し、詳細が `Unexpected folder API response shape` |
| Box Notes / Office Online: `/file/<id>` の HTML の最後の `<script>` にある JSON の `items[0].parentFolderID` と `name` | `fetchEmbeddedItem`、`parseEmbeddedItem` | Notes と Office のページだけ失敗し、詳細が `Cannot find embedded JSON…` か `Unexpected JSON structure…` |

失敗したときは、アイコンの下のポップアップに詳細が出ます。拡張機能のサービスワーカーのコンソールにも `Box lookup result:` として結果がそのまま出ます（拡張機能の管理ページの「ビューを検査: Service Worker」）。

### 調べ方
壊れたページで開発者ツールのコンソールを開き、該当する部分を直接試します。

```js
// セレクタがまだ要素を見つけるか（null なら変わっている）
document.querySelector("[data-resin-target='parentfoldername']")
document.querySelector("h1.item-name")

// フォルダ API の応答の形（0 はルートフォルダ）
await (await fetch('/app-api/enduserapp/folder/0')).json()
```

セレクタが `null` を返したら、要素パネルで親フォルダのリンクやファイル名の見出しを探し、使える属性やクラス名を確かめます。

### 直し方
1. セレクタが変わった場合は、`BOX_SELECTORS` の該当するリストの**先頭**に新しいセレクタを足します。古いセレクタは残しておけば、古い画面でも動き続けます。
2. `tests/box-injection.test.js` に、新しいセレクタの場合のテストを足します（「falls back to the older preview header selector」をコピーして書き換えるのが手軽です）。
3. `npm test` を実行し、拡張機能を再読み込みして、実際の Box のページで試します。

API や埋め込み JSON の形が変わった場合は、`fetchFolderPath` や `parseEmbeddedItem` を新しい形に合わせて書き直します。`parseEmbeddedItem` は文字列を受け取るだけなので、実際のページの `<script>` の中身をテストにそのまま入れて確かめられます。

`box-injection.js` はページに何度も注入されるので、トップレベルには `function` と `var` だけを置いてください（`const` や `let` は 2 回目の注入でエラーになります。テストでも確かめています）。

## ライセンス
- MITライセンス
- PetitZip ライブラリ https://github.com/McbeEringi/petit/blob/main/docs/zip.md を `setup/zip.mjs` として同梱しています

## 謝辞
これは以下の拡張機能の fork です。`file:` のページ・リンク・選択文字列を開く機能は、この拡張機能から引き継いでいます。
  - https://chrome.google.com/webstore/detail/open-local-folder-by-expl/ehidkllolkmedbkjbdkcgabdadcfppfg?hl=ja
  - https://github.com/tksugimoto/chrome-extension_open-local-folder-by-explorer
