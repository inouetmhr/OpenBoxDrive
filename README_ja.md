( [English](README.md) / **日本語(Japanese)** )

# Chrome/Edge拡張: Open in Box Drive

## 機能
- ブラウザの拡張機能ボタンをクリックすると、その時Boxで開いているページに対応したフォルダーをExplorer (Box Drive) で開きます
- ブラウザで開いているのがファイルの場合、ファイルを選択した状態で親フォルダをExplorerで開きます

## インストール
- 通常のブラウザ拡張では Explorer を開くようなローカル環境に対する操作はできないため、ブラウザ拡張からの指示で動くローカルプロセス (native messaging host) のインストールが必要です。
- このため拡張機能のインストール時に表示されるセットアップ画面（拡張機能のオプション画面）の指示のとおり、Pythonのインストールおよびローカルプロセスのインストールが動作には必須です
- ローカルプロセスの Manifest には、拡張機能のユニークIDの埋め込みが必要なため、本拡張機能をフォルダからインストールしている場合、インストールするたびに上記のセットアップ（特にローカルプロセス用Manifestの更新）が必要です。何度もインストールし直した場合には注意してください。

## 開発: テスト
外部依存なし（Node.js 18+ の `node:test` と Python 標準の `unittest`）で動きます。

```bash
npm test
```

- `tests/path-utils.test.js`: URL→ファイルパス変換・右クリックメニューのパス抽出
- `tests/box-injection.test.js`: Box ページからのパス解決（DOM と fetch をスタブ化して `box-injection.js` を実行）
- `tests/test_native_host.py`: ネイティブホスト（パス組み立て、Explorer/Finder 呼び出し、stdio プロトコル）

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
これは以下の拡張機能のforkです。
  - https://chrome.google.com/webstore/detail/open-local-folder-by-expl/ehidkllolkmedbkjbdkcgabdadcfppfg?hl=ja
  - https://github.com/tksugimoto/chrome-extension_open-local-folder-by-explorer

このため、以下の機能もそのまま引き継いでいます。

---

### 機能
- フォルダをExplorerで開く
- （ファイルの場合）ファイルを選択した状態で親フォルダをExplorerで開く


### 対象可能なフォルダ・ファイル
- 現在のタブ（URLが `file://` 始まりの場合）
- リンク先URL（URLが `file://` 始まりの場合）
- 選択文字列（選択文字列が `C:\`, `\\ComputerName\` などで始まる場合）
    - 先頭と末尾の `"` （ダブルクォーテーション）は無視する（先頭末尾両方に存在する場合のみ）

### 使い方
1. 拡張をインストール
1. インストール時に開かれる `設定` タブに従って設定する
    - 再設定が必要な場合は、拡張のオプションページから可能
1. 以下のいずれかを実施
    - ローカルファイル・フォルダを開いているタブでこの拡張のアイコンをクリック
    - ページ・リンク・選択テキストの右クリックメニューから「～～をExplorerで開く」を選択
        - フォルダをExplorerで開く
        - リンク先をExplorerで開く（ローカルファイルの場合）
        - 選択文字列をExplorerで開く（ローカルファイルパスの場合）

#### 右クリックメニューのタイトル変更
##### メリット
アルファベット始まりに変更するとキーボードで選択が可能

##### 変更方法
1. 設定ページ（オプションページ）を開く
1. `右クリックメニュータイトル変更` 部分で右クリックメニューの種類ごとに新タイトルを設定
