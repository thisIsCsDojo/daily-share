# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev              # Start Vite dev server
npm run build           # TypeScript check + Vite build
npm run lint            # ESLint check
npm run preview         # Preview production build
npm run storybook       # Run Storybook on port 6006
npm run build-storybook # Build Storybook static site
```

### Supabase

```bash
npm run db:dry:staging    # staging に対する dry-run
npm run db:push:staging   # staging に適用（ローカル開発・検証用）
npm run db:dry:prod       # 本番に対する dry-run
npm run db:push:prod      # 本番に適用（"production" の確認入力あり）

npx supabase gen types --lang=typescript --project-id <ref> > src/types/database.ts  # 型を再生成（Docker 不要）
```

> **素の `npx supabase db push` は使わないこと。** CLI は link 中の 1 プロジェクトにしか
> 流せず、staging のつもりで本番を触る事故が起きる。`scripts/db.mjs` は対象を引数で
> 受け取り、実行後に必ず link を staging へ戻す。本番への適用は確認入力を要求する。

> ## ⚠️ マイグレーションを本番に適用する前に必ず読む
>
> **`db push` は対応するコードがマージ・デプロイされた後に行うこと。**
>
> 2026-08-11、PR を出す前に本番へ適用して**本番を壊した**（チーム作成が不能、フレンド名が出ない、地図のピンが消える）。DB とフロントエンドは「どのテーブルをどう読み書きするか」の契約で結ばれており、片方だけ動かせば必ず壊れる。
>
> 古いコードが動かなくなる変更（RLS の厳格化、ポリシー削除、列の削除）は **①新経路を足す → ②コードを切り替えてデプロイ → ③古い経路を塞ぐ** の3段階に分ける。①と③を同時にやると壊れる。
>
> 手順・影響範囲の洗い方・過去の事故は **[docs/migration-deploy-runbook.md](docs/migration-deploy-runbook.md)** に集約してある。RLS やポリシーを触る前に必ず目を通すこと。
>
> **マイグレーション番号は絶対に重複させない。** 過去に `0007` / `0008` が重複し、片方が「適用済み」と記録されたまま中身が本番に入らず、招待コード参加が長期間壊れていた。

## Architecture

**Stack:** React 19 + TypeScript, Vite, Chakra UI, Supabase (Auth/DB/Realtime), Leaflet, deployed on Vercel.

**App flow:** `main.tsx` → `App.tsx` wraps everything in `AuthGuard` → shows `LoginForm` or `Map` based on auth state.

### Key layers

- `src/lib/supabase.ts` — Supabase client singleton (reads `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
- `src/hooks/useAuth.ts` — Session state, email/password sign-in/up, Google OAuth, sign-out
- `src/hooks/useRealtime.ts` — Subscribes to Supabase Realtime channel for live location updates
- `src/types/database.ts` — Auto-generated Supabase types (regenerate via `npx supabase gen types`)
- `src/components/ui/` — Chakra-based UI primitives, each with a `.stories.tsx`
- `src/theme/theme.ts` — Chakra UI custom theme (primary/danger/success/gray tokens)

### Database

Schema defined in `supabase/migrations/0001_init.sql`. Key tables:

| Table | Purpose |
|---|---|
| `users` | Linked to `auth.users` via trigger on signup |
| `teams` | Groups with unique `invitationalCode` and `removalPolicy` |
| `user_teams` | Many-to-many with `role` (admin/member) |
| `team_invitations` | Team invites awaiting the invitee's consent |
| `team_messages` | Talk room messages; deleted after 30 days |
| `friend_requests` | Friend requests awaiting approval |
| `user_friends` | Bidirectional friendship pairs |
| `events` | Calendar events. `teamId` が NULL なら作成者だけの個人予定（`0024`）。外部カレンダーから取り込んだ行は `externalUid` を持つ |
| `locations` | One row per user, updated in-place; Realtime enabled |

`sharing_state` enum: `'private' | 'friends' | 'team'` — used in both `events` and `locations`.

RLS is enabled on all tables. Auth trigger `handle_new_user()` auto-inserts into `public.users` on signup.

### Team membership rules (`0012`)

`user_teams` の RLS は自分の行しか見えないため、メンバー一覧・招待・追放・退出はすべて `SECURITY DEFINER` の RPC 経由で行う（`list_team_members` / `invite_team_member` / `accept_team_invitation` / `remove_team_member` / `leave_team` など）。

- **参加は必ず本人の同意が要る。** 他人を直接 `user_teams` へ入れる関数は無い。招待を出し、招待された本人が承諾して初めて参加する
- 例外は招待コード参加（`join_team_by_code`）。本人がコードを入力する操作なので同意済みとみなす
- 誰が他メンバーを追放できるかは `teams."removalPolicy"`（`admin_only` / `anyone` / `nobody`）で決まる。チーム作成時に決定し、あとから変更する導線は無い
- `is_team_member` / `is_team_admin` は内部ヘルパで、`authenticated` から `REVOKE` 済み（membership oracle を防ぐため）。**新しい RPC を足すときも GRANT しないこと**

### RPC を足すときの `REVOKE` の書き方（必ず `anon` を明示する）

**`REVOKE EXECUTE ... FROM public` だけでは anon を締め出せない。** 必ず `FROM anon, public` と書くこと。

```sql
GRANT  EXECUTE ON FUNCTION public.my_rpc(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.my_rpc(uuid) FROM anon, public;  -- anon を省かない
```

Supabase は `ALTER DEFAULT PRIVILEGES ... GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role` を既定で設定しているため、新しく作られた関数には **`anon` への明示的な GRANT** が付く。`PUBLIC` 擬似ロールへの既定付与とは別物なので、`FROM public` を剥がしても anon の明示 GRANT は残る。

2026-08-17 に本番で実証した。`FROM public` だけで REVOKE していた `0014` の3関数は未ログインから実行でき、`FROM anon, public` で剥がしていた関数だけが `42501` を返していた（#117 / `0022` で修正・適用済み）。

**例外:** `shares_team_for_location` は `locations_select` のポリシー式から評価されるため、`authenticated` の `EXECUTE` を残すこと。剥がすと `locations` の SELECT 自体が `42501` になる（`0019` に記録あり）。

### Migrations

番号のプレフィックスが Supabase の履歴テーブルの主キーになるため、**番号を重複させないこと**。過去に `0007` と `0008` が重複し、片方が履歴に記録されず `db push` が通らなくなった（`0013` / `0014` へリナンバーして解消）。

## GitHub Workflows

### CI (`ci.yml`)

`pull_request` to `main` でトリガー。リポジトリルートで Install → Lint → Build → Test を実行する。

テストは `npm test`（`vitest run --project unit`）。現状テストファイルは `src/components/Calendar/calendarUtils.test.ts` の 1 本のみで、認証・RLS・チーム権限のテストは無い。

バックエンド用ジョブは `ci.yml` にコメントアウトで雛形が残っている（バックエンド導入時に有効化）。

### Issue テンプレート

- **バグ報告** (`bug.md`) — タイトルプレフィックス `fix:`, ラベル `bug`
- **機能追加** (`feature.md`) — タイトルプレフィックス `feat:`, ラベル `feature`

### PR テンプレート

マージ前のチェックリスト：
- [ ] `npm run lint` が通る
- [ ] `npm run build` が通る
- [ ] 動作確認済み
- [ ] レビュアーを設定した

## Environment

### 本番と staging は別プロジェクト（2026-09-21 に分離）

| 環境 | Supabase project ref | リージョン | 用途 |
|---|---|---|---|
| **production** | `zlptsmiqfzwisgerwwet` | 東京 | 友達が使う。Vercel の Production がこちらを向く |
| **staging** | `mdetcjwmwzjeupheppgo` | ソウル | ローカル開発・検証・Vercel の Preview。旧本番を流用 |

**ローカル開発と検証は staging で行う。本番を触って検証しない。** 分離前は同一プロジェクト
だったため「本番で検証するしかない」構造になっていたが、それは解消済み。

旧本番がソウルだったのは作成時の取り違え。Supabase はリージョンを後から変更できないため、
東京に新規作成して移行した。マイグレーション 27 本を空の DB へ頭から適用し、匿名プローブで
旧本番と完全一致することを確認している。

Copy `.env.example` to **`.env.local`** and fill in the **staging** project URL and anon key.

> **`.env` ではなく `.env.local` を使うこと。** `.env` は過去に追跡されており（`4d6f8ea` で untrack）、古いブランチ 26 本が今も `.env` をツリーに持っている。gitignore は「切替先のコミットが追跡しているファイル」を守れないため、それらのブランチと `main` を `git checkout` で行き来すると**ディスク上の `.env` が消える**。`.env.local` はどのブランチも追跡していないので、この問題が起きない。Vite は `.env.local` を優先して読むため設定変更は不要。

## エラー監視（Sentry）

`src/lib/sentry.ts` で初期化し、`App.tsx` の `Sentry.ErrorBoundary` で描画クラッシュを捕捉する。収集対象は**未捕捉例外のみ**（トレース・リプレイは `tracesSampleRate: 0` で無効）。

- **`VITE_SENTRY_DSN` を設定したときだけ有効。** 未設定ならビルドから SDK の初期化ごと除去され no-op になるため、ローカル開発では何も設定しなくてよい
- `release` と `environment` は `vite.config.ts` が `VERCEL_GIT_COMMIT_SHA` / `VERCEL_ENV` から `define` でバンドルへ埋め込む。`Sentry.init` に `release: undefined` を渡すと、プラグインが注入した `__SENTRY_RELEASE__` を上書きしてイベントに release が付かなくなるので注意（ソースマップの突き合わせ自体は debug ID で行われるため release とは独立）
- ユーザー識別は `setSentryUser` で **ID のみ**。メール等の PII は送らない（`sendDefaultPii: false`）
- **`supabase.from(...)` の失敗は届かない。** エラーを throw せず戻り値で返すため、拾いたい箇所に `Sentry.captureException` を足す必要がある

有効化手順（DSN 登録・通知設定・ソースマップ）は **[docs/sentry-setup.md](docs/sentry-setup.md)** に集約してある。
