# Chrome ウェブストア掲載情報

ストアのデベロッパー ダッシュボードに貼り付けるための文章です。画像は `npm run screenshots` で `store/screenshots/` に作ります。

## ストア掲載情報

### 概要（manifest の `extension_description` から自動で入ります）
- ja: Box の Web ページで見ているフォルダやファイルを、Box Drive（Windows は Explorer、macOS は Finder）で開きます。
- en: Open the Box folder or file you are viewing in Box Drive, with Explorer on Windows or Finder on macOS.

### 説明（日本語）
```
Box の Web ページで見ているフォルダやファイルを、Box Drive のフォルダとしてすぐに開ける拡張機能です。

※ Windows または macOS の Box Drive と、インストール後の設定画面から入れる小さなヘルパーが必要です（Linux と ChromeOS では Box Drive が使えないため動作しません）。

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

Note: requires Box Drive on Windows or macOS, and a small helper program that the setup page installs after you add the extension. It doesn't work on Linux or ChromeOS, where Box Drive isn't available.

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

## テストの手順（ダッシュボードの「Test instructions」タブ）
審査担当者向けです。Box のテスト用アカウントは渡さず、審査担当者に無料の Box アカウントを作ってもらう前提です。Box がなくても確かめられる動作も書いてあります。

提出前に確かめておくこと:
- 無料の個人向けプラン（Box Individual）のアカウントで、Box Drive にサインインできるか（料金ページには「すべてのプランにデスクトップ機能」とあるが、Box Drive の名前は明記されていない）
- 動画を添える場合は、下の手順 A の 1〜6 を録画して、限定公開の URL を最後の行に入れる

```
This extension opens the Box folder that the user is viewing on the Box website in Box Drive, using Explorer (Windows) or Finder (macOS). It relies on Box Drive and on a small native messaging host that the extension's setup page installs.

Requirements
- Windows 10/11 or macOS. Box Drive is not available on Linux or ChromeOS, so the extension cannot open folders there; its setup page says so.
- A Box account. A free Box Individual account works: https://www.box.com/pricing/individual
- Box Drive installed and signed in with that account: https://www.box.com/resources/downloads
- Windows: Python 3 from python.org. macOS: /usr/bin/python3 (macOS may offer to install the command line developer tools on first use).

A. Full test (about 10 minutes)
1. Sign in to Box Drive with the Box account. A folder appears at C:\Users\<name>\Box (Windows) or ~/Library/CloudStorage/Box-Box (macOS).
2. Install the extension. Its setup page opens and shows "Install the helper".
3. Click "Download the setup file".
   - Windows: extract nativehost-setup.zip and double-click setup.bat. If SmartScreen appears, choose "More info" and "Run anyway".
   - macOS: in Terminal, run: sh ~/Downloads/open-box-drive-setup.sh
4. Without reloading, the setup page changes to "Ready" and shows the Box Drive folder.
5. Click "Try opening Box Drive" on the setup page: the Box Drive folder opens in Explorer or Finder.
6. In the browser, open https://app.box.com/folder/0 (signed in), open any folder, and click the extension's toolbar icon (or press Ctrl+Shift+B / Cmd+Shift+B): the same folder opens in Explorer or Finder. On a file page, the parent folder opens with the file selected.

B. Behaviour you can check without Box Drive
- Before step 3, the setup page explains what is missing and shows the setup file for the current OS.
- After step 3 without Box Drive, the setup page shows "The Box Drive folder wasn't found" with the expected path and a link to Box Drive.
- On a page that is not a Box folder or file page (for example https://example.com), clicking the icon shows a popup under the icon: "Works only on Box folder and file pages."
- On a Linux or ChromeOS device, the setup page states that only Windows and macOS are supported.

Demo video of steps 1-6: <URL>
```

### 短い版（500 文字以内の欄用、493 文字。改行を 2 文字と数えても 498 文字）
```
Needs Windows or macOS with Box Drive (not on Linux/ChromeOS) and Python 3 (macOS: /usr/bin/python3). A free Box account works.
1. Sign in to Box Drive.
2. Install the extension; its setup page opens.
3. Click "Download the setup file" and run it (Windows: setup.bat in the zip; macOS: sh ~/Downloads/open-box-drive-setup.sh). The page turns "Ready".
4. Open a folder on app.box.com, click the toolbar icon: it opens in Explorer/Finder.
If anything is missing, the setup page or popup says so.
```

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
