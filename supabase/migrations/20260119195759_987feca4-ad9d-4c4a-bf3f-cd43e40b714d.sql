
-- Add enrolled_at column to contacts table to track when they were added to a campaign
ALTER TABLE public.contacts 
ADD COLUMN IF NOT EXISTS enrolled_at TIMESTAMP WITH TIME ZONE;

-- Add index for efficient weekly grouping queries
CREATE INDEX IF NOT EXISTS idx_contacts_enrolled_at ON public.contacts(enrolled_at);
CREATE INDEX IF NOT EXISTS idx_contacts_engagement_enrolled ON public.contacts(engagement_id, enrolled_at);

-- Add comment
COMMENT ON COLUMN public.contacts.enrolled_at IS 'When this contact was enrolled/added to a campaign sequence';
