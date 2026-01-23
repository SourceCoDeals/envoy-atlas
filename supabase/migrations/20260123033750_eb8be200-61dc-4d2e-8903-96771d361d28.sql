-- Add classification columns to call_activities for pre-computed metrics
ALTER TABLE call_activities 
ADD COLUMN IF NOT EXISTS counts_as_connection boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS counts_as_conversation boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS counts_as_meeting boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS counts_as_bad_data boolean DEFAULT false;

-- Create indexes for faster filtering on classification columns
CREATE INDEX IF NOT EXISTS idx_call_activities_connection ON call_activities(counts_as_connection) WHERE counts_as_connection = true;
CREATE INDEX IF NOT EXISTS idx_call_activities_conversation ON call_activities(counts_as_conversation) WHERE counts_as_conversation = true;
CREATE INDEX IF NOT EXISTS idx_call_activities_meeting ON call_activities(counts_as_meeting) WHERE counts_as_meeting = true;
CREATE INDEX IF NOT EXISTS idx_call_activities_bad_data ON call_activities(counts_as_bad_data) WHERE counts_as_bad_data = true;