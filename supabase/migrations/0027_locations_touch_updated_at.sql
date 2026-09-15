-- ============================================================
-- 0027_locations_touch_updated_at.sql
-- locations."updatedAt" が更新されない問題を直す（#127 の前提）
--
-- 症状:
--   列は 0001 の時点から存在する。
--
--     "updatedAt" timestamptz DEFAULT now()
--
--   しかし MapTab の upsert はこの列を送っていない。
--
--     .upsert({ userId, lat, lng, sharingState, sharedTeamIds },
--             { onConflict: 'userId' })
--
--   DEFAULT now() が効くのは **INSERT のときだけ**で、onConflict により
--   UPDATE に落ちる2回目以降は更新されない。つまり現状の "updatedAt" は
--   「そのユーザーが初めて位置を共有した時刻」で固定されている。
--
--   「いつ時点の位置か」を表示する #127 は、この値が正しいことが前提。
--   直さずに表示すると、毎分更新している人が「3か月前」と出る。
--
-- なぜクライアントではなくトリガーで直すのか:
--   upsert のペイロードに updatedAt を足す方法もあるが、**送り忘れが
--   再発する**。位置の書き込み経路が増えたときに毎回思い出す必要がある。
--   DB 側で強制すれば、どの経路から書いても必ず更新される。
--
-- 既存行の扱い:
--   既存の "updatedAt" は「初回共有時刻」という**別の意味の値**なので、
--   そのまま表示すると誤情報になる。かといって now() で埋めると
--   「たった今更新された」という嘘になる。
--   よって **NULL に戻して「不明」と表示させる**。各ユーザーが次に位置を
--   送った時点で正しい値が入る（ライブ共有中なら即座に埋まる）。
-- ============================================================

CREATE OR REPLACE FUNCTION touch_locations_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW."updatedAt" = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_locations_touch_updated_at ON locations;
CREATE TRIGGER trg_locations_touch_updated_at
  BEFORE UPDATE ON locations
  FOR EACH ROW EXECUTE FUNCTION touch_locations_updated_at();

-- 意味の違う既存値を消す。次の更新で正しい値が入る。
UPDATE locations SET "updatedAt" = NULL;
