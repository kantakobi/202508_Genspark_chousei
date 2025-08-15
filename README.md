# Schedule Coordinator - スケジュール調整アプリ

## プロジェクト概要
- **名前**: Schedule Coordinator
- **目標**: Google Calendar連携によるマルチユーザースケジュール調整システム
- **主要機能**: 
  - Google OAuth 2.0認証
  - 複数人でのスケジュール候補提案・回答
  - Google Calendarとの自動連携
  - レスポンシブUIによる使いやすいインターフェース

## 公開URL
- **開発環境**: https://3000-i5oa7t29uya6mmx6ylv0q-6532622b.e2b.dev
- **APIヘルスチェック**: https://3000-i5oa7t29uya6mmx6ylv0q-6532622b.e2b.dev/api/health
- **GitHub**: 未設定（予定）

## データアーキテクチャ
- **データモデル**: 
  - Users (Google OAuth情報)
  - Events (スケジュール調整イベント)
  - Event Participants (参加者管理)
  - Time Slots (候補日時)
  - Availability Responses (参加可否回答)
  - Confirmed Events (確定したイベント)
- **ストレージサービス**: Cloudflare D1 (SQLite互換の分散データベース)
- **認証**: Google OAuth 2.0 + JWT session

## 現在実装済みの機能

### ✅ 完了した機能
1. **基本アプリケーション構造**
   - Hono + TypeScript + Cloudflare Pages構成
   - レスポンシブUIデザイン (Tailwind CSS)
   - PM2による開発サーバー管理

2. **API エンドポイント (モックデータ)**
   - `GET /api/health` - ヘルスチェック
   - `GET /api/auth/google` - Google OAuth開始
   - `GET /api/auth/google/callback` - OAuth コールバック
   - `GET /api/auth/me` - ユーザー情報取得
   - `GET /api/events` - イベント一覧
   - `POST /api/events` - イベント作成
   - `GET /api/events/:id` - イベント詳細
   - `POST /api/events/:id/respond` - 参加可否回答
   - `POST /api/events/:id/confirm` - イベント確定

3. **フロントエンドUI**
   - ダッシュボード画面
   - イベント作成モーダル
   - イベント詳細・回答画面
   - カレンダー表示
   - レスポンシブデザイン

4. **データベース設計**
   - D1データベーススキーマ設計完了
   - マイグレーションファイル作成
   - テストデータ準備

### ⏳ 未実装の機能
1. **Google OAuth 2.0認証** (高優先度)
   - 実際のGoogle OAuth実装
   - JWTセッション管理
   - ユーザー情報の永続化

2. **Google Calendar API連携** (高優先度)
   - カレンダーイベント作成
   - 参加者への自動招待
   - 空き時間チェック機能

3. **複数人スケジュール調整ロジック** (高優先度)
   - 実際のデータベース操作
   - 最適な時間帯の自動提案
   - リアルタイム更新機能

4. **本番環境デプロイ** (低優先度)
   - Cloudflare Pagesへのデプロイ
   - 環境変数設定
   - プロダクション用設定

## ユーザーガイド

### 基本的な使い方
1. **ログイン**: Googleアカウントでログイン
2. **イベント作成**: 「新しいイベント」から調整したいスケジュールを作成
3. **参加者招待**: 参加者のメールアドレスを入力して招待
4. **候補日時設定**: 複数の候補日時を提案
5. **回答収集**: 参加者が各候補日時に対して参加可否を回答
6. **イベント確定**: 最適な日時を選択してGoogleカレンダーに登録

### APIの使用方法
```bash
# ヘルスチェック
curl https://3000-i5oa7t29uya6mmx6ylv0q-6532622b.e2b.dev/api/health

# イベント一覧取得
curl https://3000-i5oa7t29uya6mmx6ylv0q-6532622b.e2b.dev/api/events

# イベント作成
curl -X POST https://3000-i5oa7t29uya6mmx6ylv0q-6532622b.e2b.dev/api/events \
  -H "Content-Type: application/json" \
  -d '{"title":"会議","participants":["user@example.com"]}'
```

## 開発環境セットアップ

### 必要な依存関係
```bash
npm install
```

### 開発サーバー起動
```bash
# ポートクリーンアップ
npm run clean-port

# ビルド
npm run build

# PM2で開発サーバー起動
pm2 start ecosystem.config.cjs

# テスト
npm run test
```

### 各種操作
```bash
# プロジェクトビルド
npm run build

# PM2管理
pm2 list
pm2 logs schedule-coordinator --nostream
pm2 restart schedule-coordinator
pm2 stop schedule-coordinator

# Git操作
npm run git:status
npm run git:commit "コミットメッセージ"
```

## デプロイ
- **プラットフォーム**: Cloudflare Pages (予定)
- **現在のステータス**: ❌ 未デプロイ (開発環境のみ)
- **技術スタック**: Hono + TypeScript + TailwindCSS + Cloudflare D1
- **最終更新**: 2025年8月15日

## 次のステップ
1. Google OAuth 2.0認証システムの実装
2. Cloudflare D1データベースの本格統合
3. Google Calendar API連携機能の実装
4. 本番環境へのデプロイ
