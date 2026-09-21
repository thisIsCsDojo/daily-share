#!/usr/bin/env node
/**
 * マイグレーションの適用先を明示して実行する。
 *
 *   node scripts/db.mjs dry  staging   … staging に対する dry-run
 *   node scripts/db.mjs push staging   … staging に適用
 *   node scripts/db.mjs dry  prod      … 本番に対する dry-run
 *   node scripts/db.mjs push prod      … 本番に適用（確認入力あり）
 *
 * なぜこのスクリプトが要るか:
 *   Supabase CLI は `supabase link` した 1 つのプロジェクトしか覚えない。
 *   素の `supabase db push` は「いま link されている方」へ流れるため、
 *   staging のつもりで本番を触る事故が起きうる。
 *   このスクリプトは対象を引数で受け取り、link → 実行 → **必ず staging へ
 *   link を戻す** を一括で行う。途中で失敗しても finally で戻すので、
 *   ローカルの既定は常に staging に保たれる。
 *
 *   本番への適用は確認入力（"production" とタイプ）を要求する。
 *   docs/migration-deploy-runbook.md の鉄則（コードのマージ・デプロイ後に
 *   適用する）を守ったうえで実行すること。
 */
import { spawnSync } from 'node:child_process'
import { createInterface } from 'node:readline'

// 公開識別子なのでここに直書きしてよい（URL や anon key と同じ扱い）。
const PROJECTS = {
  // 東京。友達が使う本番。2026-09-21 にソウルから移行。
  prod: 'zlptsmiqfzwisgerwwet',
  // ソウル。旧本番を staging として流用。ローカル開発・検証はこちら。
  staging: 'mdetcjwmwzjeupheppgo',
}

const [, , action, target] = process.argv
if (!['dry', 'push'].includes(action) || !PROJECTS[target]) {
  console.error('usage: node scripts/db.mjs <dry|push> <staging|prod>')
  process.exit(2)
}

function supabase(...args) {
  const r = spawnSync('npx', ['--yes', 'supabase', ...args], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  if (r.status !== 0) throw new Error(`supabase ${args.join(' ')} failed (${r.status})`)
}

async function confirmProd() {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer = await new Promise((res) =>
    rl.question('\n本番（東京・友達が使っている DB）に適用します。続けるなら "production" と入力: ', res),
  )
  rl.close()
  if (answer.trim() !== 'production') {
    console.log('中止しました。')
    process.exit(1)
  }
}

try {
  console.log(`\n▶ ${target} (${PROJECTS[target]}) に link`)
  supabase('link', '--project-ref', PROJECTS[target])

  console.log(`\n▶ dry-run`)
  supabase('db', 'push', '--dry-run', '--yes')

  if (action === 'push') {
    if (target === 'prod') await confirmProd()
    console.log(`\n▶ ${target} に適用`)
    supabase('db', 'push', '--yes')
  }
} finally {
  // 何があってもローカルの既定を staging に戻す。
  // これにより素の `supabase db push` が本番へ流れることは無い。
  console.log(`\n▶ link を staging に戻す`)
  spawnSync('npx', ['--yes', 'supabase', 'link', '--project-ref', PROJECTS.staging], {
    stdio: 'ignore',
    shell: process.platform === 'win32',
  })
}
