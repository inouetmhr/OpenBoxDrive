# Chrome ウェブストア掲載情報

ストアのデベロッパー ダッシュボードに貼り付けるための文章です。画像は `npm run screenshots` で `store/screenshots/` に作ります。

## ストア掲載情報

### 概要（manifest の `extension_description` から自動で入ります）
- ja: Box の Web ページで見ているフォルダやファイルを、Box Drive（Windows は Explorer、macOS は Finder）で開きます。
- en: Open the Box folder or file you are viewing in Box Drive, with Explorer on Windows or Finder on macOS.

### 説明（日本語）
```
Box の Web ページで見ているフォルダやファイルを、Box Drive のフォルダとしてすぐに開ける拡張機能です。

■ できること
・Box のフォルダのページでツールバーのアイコンをクリックすると、同じフォルダを Box Drive で開きます（Windows は Explorer、macOS は Finder）。
・キーボードショートカット: Windows は Ctrl+Shift+B、macOS は ⌘⇧B
・ファイルのページでは、そのファイルを選択した状態で親フォルダを開きます。
・対応しているページ: フォルダ、ファイル、Box Notes、Box Canvas、Office Online で開いているファイル
・開けなかったときは、アイコンの下に理由を表示します。

■ 必要なもの
・Windows または macOS と、Box Drive（インストールしてサインインしていること）
・Windows: Python 3（python.org のインストーラー） / macOS: /usr/bin/python3
・パソコンに入れる小さなヘルパー（native messaging host）
  インストール後に開く設定画面が、ヘルパーの状態を自動で確認し、必要な手順だけを表示します。

■ プライバシー
・アイコンを押したときだけ、開いている Box のページからフォルダの場所を読み取ります。
・情報を開発者や第三者に送信しません。

Box および Box Drive は Box, Inc. の商標です。この拡張機能は Box, Inc. が提供・承認するものではありません。
```

### Description (English)
```
Open the Box folder or file you are viewing on the Box website directly in Box Drive.

What it does
- On a Box folder page, click the toolbar icon to open the same folder in Box Drive (Explorer on Windows, Finder on macOS).
- Keyboard shortcut: Ctrl+Shift+B on Windows, ⌘⇧B on macOS
- On a file page, the parent folder opens with the file selected.
- Supported pages: folders, files, Box Notes, Box Canvas, and files opened in Office Online
- If the folder can't be opened, the reason appears under the icon.

Requirements
- Windows or macOS with Box Drive installed and signed in
- Windows: Python 3 (from the python.org installer) / macOS: /usr/bin/python3
- A small helper program (native messaging host) on your computer
  The setup page that opens after installation checks the helper and shows only the steps you need.

Privacy
- Reads the folder location from the Box page only when you click the icon.
- Sends nothing to the developer or third parties.

Box and Box Drive are trademarks of Box, Inc. This extension is not made or endorsed by Box, Inc.
```

### カテゴリ・言語
- カテゴリ: 仕事効率化（Productivity）
- 言語: 日本語、英語（`_locales` の 2 言語）

### 画像
| 種類 | サイズ | ファイル |
|---|---|---|
| ストアアイコン | 128×128 | `icons/icon128.png` |
| スクリーンショット | 1280×800 | `store/screenshots/<ja\|en>/1-overview.png` 〜 `4-error.png` |
| 小さいプロモーション タイル | 440×280 | `store/screenshots/<ja\|en>/promo-small.png` |

## プライバシーへの取り組み

### 単一用途
```
Box の Web ページで見ているフォルダやファイルを、Box Drive のフォルダとして Explorer / Finder で開くこと。
```

### 権限が必要な理由
| 権限 | 理由 |
|---|---|
| `nativeMessaging` | Box Drive のフォルダを Explorer / Finder で開くため、利用者がパソコンにインストールしたヘルパーと通信します。 |
| `activeTab` | 利用者がアイコンを押したときだけ、開いている Box のページにアクセスします。 |
| `scripting` | アイコンを押したときに、開いている Box のページからフォルダの場所（親フォルダへのリンクやファイル名）を読み取ります。 |
| `declarativeContent` | Box のページでだけ、ツールバーのアイコンを色付きで表示します。 |
| `storage` | エラーの内容をアイコンの下のポップアップに渡すため、セッションストレージに一時的に保存します。 |

### リモートコード
使用していません。すべてのコードはパッケージに含まれています。

### データの使用
- 収集するデータ: なし（ページの内容は利用者のブラウザとパソコンの中で使うだけで、開発者や第三者には送信しません）
- 次の 3 つの宣言にすべて同意します: 承認された用途以外でデータを販売・転送しない / 単一用途と関係のない目的で使わない / 信用力の判断や融資の目的で使わない

### プライバシー ポリシーの URL
https://github.com/inouetmhr/OpenBoxDrive/blob/main/PrivacyPolicy.md
