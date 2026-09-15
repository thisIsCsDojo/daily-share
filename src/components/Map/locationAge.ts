/**
 * 位置情報の鮮度表示（#127）。
 *
 * 画面から切り離してテストできるよう純粋関数にしている
 * （roomListUtils / unreadUtils と同じ方針）。`now` を引数で受けるのは
 * 境界のテストを書けるようにするため。
 *
 * チャット一覧の formatListTime とは仕様が異なる（あちらは「今日なら時刻、
 * それ以外は M/D」）。こちらは経過時間を出すので別関数として持つ。
 */

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/**
 * 位置がいつ時点のものかを「たった今 / N分前 / N時間前 / N日前」で返す。
 *
 * - `null` は '不明'（0027 で既存行を NULL にしているため、まだ一度も
 *   位置を送っていないユーザーはこれになる）
 * - 未来の時刻は端末の時計ずれなので 'たった今' に丸める
 */
export function formatLocationAge(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return '不明'
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return '不明'

  const diff = now.getTime() - t
  if (diff < MINUTE) return 'たった今'
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}分前`
  if (diff < DAY) return `${Math.floor(diff / HOUR)}時間前`
  return `${Math.floor(diff / DAY)}日前`
}
