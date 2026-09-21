# リリース前チェックリスト

このセッションで実装した「出す前に必須」項目と、運用側で対応が必要な項目をまとめる。

## ✅ 実装済み（コード/マイグレーション）

- **フレンド機能**（申請・承認・解除）— `friend_requests` テーブル + RPC（migration 0005）。これにより公開範囲「友だち」が機能する。
- **パスワードリセット** — ログイン画面から再設定メール送信、リンク後に新パスワード設定。
- **アカウント削除** — `delete_own_account()` RPC で `auth.users` を削除し、関連データは CASCADE で完全削除（migration 0006）。アカウント設定の「危険ゾーン」から二段階確認。
- **同意取得** — サインアップ時に利用規約・プライバシーポリシーへの同意チェックを必須化。`LegalModal` に雛形を同梱。

## ⚠️ 運用側で必須の対応（コードでは完結しない）

### 1. 法務テキストの確定
`src/components/Legal/LegalModal.tsx` の利用規約・プライバシーポリシーは**雛形**。公開前に必ず：
- 運営者情報・連絡先・準拠法・お問い合わせ窓口を記載
- 弁護士のレビューを受ける
- 位置情報の取得・保存・共有について実態と一致させる

### 2. 環境の分離（staging / production） ✅ 2026-09-21 完了
- [x] 本番（ソウル `mdetcjwmwzjeupheppgo`、従来どおり）と staging（東京 `zlptsmiqfzwisgerwwet`、新規作成）に分離
- [x] マイグレーション 27 本を staging へ頭から適用し、本番と一致することを匿名プローブで検証
- [x] `npm run db:push:prod` / `db:push:staging` で適用先を明示する仕組みを追加（`scripts/db.mjs`）
- [x] 本番は動かさない方針に決定（Vercel / Google OAuth の切替は不要。SnowHam さんに頼むことは無い）
- [ ] ローカルの `.env.local` を staging（東京）に向ける
- [ ] Migration Check の Secrets（`SUPABASE_PROJECT_REF`）が**本番（ソウル）**を指していることを確認 ← 9/21 に一時東京へ変えたので戻す
- [ ] Vercel の **Preview** 環境変数を staging（東京）に設定（任意。SnowHam さんの操作が要る）
- [ ] Sentry の DSN を本番用に（必要なら）

### 3. マイグレーション運用の固定化
今回、本番DBのマイグレーション履歴が空で `supabase db push` が破壊的な `0001`（全テーブル DROP）から流そうとする事故が起きかけた。今後は：
- スキーマ変更は必ず `supabase/migrations/` のファイル経由で行う
- 新規プロジェクトには `supabase db push` で 0001 から順に適用
- 既存DBに手で当てた場合は `supabase migration repair --status applied <version>` で履歴を同期してから push
- 適用前に必ず `supabase db push --dry-run` で対象を確認する

### 4. Supabase ダッシュボード設定
- **メール確認（Confirm email）を有効化**（本番では必須）
- パスワード再設定・確認メールの**リダイレクト URL（Redirect URLs）**に本番ドメインを登録
- Google OAuth の本番リダイレクト URI を登録
- pg_cron 拡張が有効であること（チャットの自動削除 0004 で使用）

## 推奨（次フェーズ）

- テスト（重要パス + RLS）と CI でのテスト有効化
- エラー監視（Sentry 等）と利用分析
- チーム admin の権限活用（メンバー削除・ロール変更）
- 通知（チャット新着・予定リマインド）
- バンドル分割・PWA 化・アクセシビリティ（絵文字→SVG アイコン）
