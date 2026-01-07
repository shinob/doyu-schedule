# 同友会スケジュールエクスポーター

e-doyuから同友会のスケジュールを取得し、iCal形式に変換してスケジュール共有を実現するシステムです。

## 機能

- **Puppeteer**を使用したe-doyuからの自動ログインとスケジュール取得
- iCal形式への変換（正確な日時・場所・詳細ページURL付き）
- 定期的なスケジュール同期（6時間毎）
- **FTP自動アップロード**による外部サーバーとのファイル共有
- REST API経由でのスケジュール配信

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.example`をコピーして`.env`を作成し、必要な設定を入力してください。

```bash
cp .env.example .env
```

以下の項目を設定してください：

**必須項目：**
- `DOYU_PREFECTURE`: 県名（shimane, hiroshima, kagawa等）
- `DOYU_USERNAME`: e-doyuのユーザー名
- `DOYU_PASSWORD`: e-doyuのパスワード
- `SESSION_SECRET`: セッション用秘密鍵

**オプション項目：**
- `PORT`: サーバーポート番号（デフォルト: 3000）
- `ICAL_DOMAIN`: iCalendarドメイン（デフォルト: [県名]-doyu.local）
- `FTP_HOST`: FTPサーバーホスト名
- `FTP_USER`: FTPユーザー名
- `FTP_PASSWORD`: FTPパスワード
- `FTP_REMOTE_PATH`: FTPリモートパス
- `FTP_ENABLED`: FTPアップロード有効化（true/false）

### 3. 県別設定例

```bash
# 島根県の場合
DOYU_PREFECTURE=shimane
ICAL_DOMAIN=shimane-doyu.local

# 広島県の場合
DOYU_PREFECTURE=hiroshima
ICAL_DOMAIN=hiroshima-doyu.local

# 香川県の場合
DOYU_PREFECTURE=kagawa
ICAL_DOMAIN=kagawa-doyu.local
```

### 4. サーバー起動

**推奨: run.shスクリプトを使用**
```bash
# 基本起動
./run.sh

# カスタムポート
./run.sh -p 8080

# バックグラウンド起動
./run.sh --daemon

# ヘルプ表示
./run.sh --help
```

**従来の方法:**
```bash
npm start
```

または開発モードで起動：
```bash
npm run dev
```

## API エンドポイント

### GET /
システムの状態を取得

### GET /schedule.ics
iCal形式のスケジュールファイルをダウンロード

### POST /sync
手動でスケジュール同期を実行

### GET /status
詳細な同期状態を確認

### POST /ftp/test
FTP接続テスト

### POST /ftp/upload
手動FTPアップロード実行

## iCalの使用方法

1. サーバーを起動
2. `http://localhost:3000/schedule.ics` をカレンダーアプリに登録
3. 自動的にスケジュールが同期されます

**注意**: ポート番号は`.env`ファイルの`PORT`設定に依存します。

### 対応カレンダーアプリ
- Apple Calendar（Mac/iOS）
- Google Calendar
- Outlook
- Thunderbird

## プロジェクト構成

```
doyu-schedule/
├── src/
│   ├── app.js              # メインアプリケーション
│   ├── doyuClient.js       # HTML解析とデータ抽出
│   ├── puppeteerClient.js  # Puppeteer認証クライアント
│   ├── icalGenerator.js    # iCal生成機能
│   ├── ftpUploader.js      # FTP自動アップロード
│   └── scheduler.js        # スケジュール同期オーケストレーション
├── logs/                   # ログファイル
├── public/                 # 生成されたiCalファイル
├── .env.example           # 環境変数テンプレート
├── run.sh                 # 起動スクリプト
└── README.md
```

## バックグラウンド実行

### デーモンモードで起動
```bash
./run.sh --daemon
```

### プロセス管理
```bash
# プロセス確認
cat doyu-schedule.pid

# ログ確認
tail -f doyu-schedule.log

# 停止
kill $(cat doyu-schedule.pid)
```

## ログ

- アプリケーションログ: コンソール出力
- バックグラウンド実行時: `doyu-schedule.log`
- 同期状況とエラー詳細を記録

## トラブルシューティング

### ログイン失敗
- `.env`ファイルの認証情報を確認
- e-doyuサイトへの手動ログインが可能か確認
- Puppeteerのヘッドレスモードを無効にしてブラウザ動作を確認

### スケジュールが取得できない
- e-doyuサイトの構造変更を確認
- `src/doyuClient.js`のHTMLセレクタを確認
- ログで詳細なエラー内容を確認

### 日時が正しく表示されない
- 日本標準時（JST）での時刻設定を確認
- `src/icalGenerator.js`のタイムゾーン設定を確認

### FTPアップロードエラー
- FTP接続情報（ホスト、ユーザー名、パスワード）を確認
- `POST /ftp/test`でFTP接続テストを実行
- FTPサーバーの権限とディレクトリ構造を確認