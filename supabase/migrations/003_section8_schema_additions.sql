-- Section 8: Schema additions for Markzo major correction pass
-- Run against your Supabase project via the SQL editor or CLI

-- 1. committees: editable quorum fraction (default 25%)
ALTER TABLE committees
  ADD COLUMN IF NOT EXISTS quorum_fraction NUMERIC DEFAULT 0.25;

-- 2. marking_schema: weighted fields
ALTER TABLE marking_schema
  ADD COLUMN IF NOT EXISTS weight NUMERIC DEFAULT 1.0;

-- 3. marks: session tagging + unsure flag
ALTER TABLE marks
  ADD COLUMN IF NOT EXISTS session_tag TEXT;

ALTER TABLE marks
  ADD COLUMN IF NOT EXISTS is_unsure BOOLEAN DEFAULT FALSE;

-- 4. Confirm counts_toward_final exists (added in 001 but guard anyway)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'marks' AND column_name = 'counts_toward_final'
  ) THEN
    ALTER TABLE marks ADD COLUMN counts_toward_final BOOLEAN DEFAULT TRUE;
  END IF;
END $$;

-- Indexes for new columns
CREATE INDEX IF NOT EXISTS marks_session_tag_idx  ON marks (session_tag);
CREATE INDEX IF NOT EXISTS marks_is_unsure_idx     ON marks (is_unsure);
