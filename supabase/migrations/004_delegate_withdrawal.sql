-- Delegate withdrawal support
ALTER TABLE public.delegates
  ADD COLUMN IF NOT EXISTS withdrawn_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN public.delegates.withdrawn_at IS 'If non-null, delegate has withdrawn from the committee as of this timestamp';
