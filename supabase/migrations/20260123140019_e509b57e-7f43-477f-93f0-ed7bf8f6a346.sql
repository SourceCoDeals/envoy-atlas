-- Add pre-computed classification columns to cold_calls table
ALTER TABLE public.cold_calls 
ADD COLUMN IF NOT EXISTS normalized_category TEXT,
ADD COLUMN IF NOT EXISTS is_connection BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_meeting BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_voicemail BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_bad_data BOOLEAN DEFAULT false;

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_cold_calls_normalized_category ON public.cold_calls(normalized_category);
CREATE INDEX IF NOT EXISTS idx_cold_calls_is_connection ON public.cold_calls(is_connection) WHERE is_connection = true;
CREATE INDEX IF NOT EXISTS idx_cold_calls_is_meeting ON public.cold_calls(is_meeting) WHERE is_meeting = true;

-- Add comment for documentation
COMMENT ON COLUMN public.cold_calls.normalized_category IS 'Category with time suffixes stripped (e.g., "Voicemail" instead of "Voicemail - 39 seconds")';
COMMENT ON COLUMN public.cold_calls.is_connection IS 'Pre-computed: true if disposition indicates a live connection';
COMMENT ON COLUMN public.cold_calls.is_meeting IS 'Pre-computed: true if disposition indicates meeting/callback booked';
COMMENT ON COLUMN public.cold_calls.is_voicemail IS 'Pre-computed: true if disposition is any voicemail type';
COMMENT ON COLUMN public.cold_calls.is_bad_data IS 'Pre-computed: true if Bad Phone, Wrong Number, or Do Not Call';