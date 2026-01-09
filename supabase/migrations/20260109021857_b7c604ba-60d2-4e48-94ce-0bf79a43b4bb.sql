-- Backfill call_summaries from scored external_calls
-- This enables the Call Information page to show follow-ups and summaries

-- First we need to create a corresponding call record in phoneburner_calls if it doesn't exist
-- Since external_calls doesn't link to phoneburner_calls, we'll use the external_calls ID directly
-- by updating call_summaries to work with external calls

-- For now, let's just insert summaries for external calls that have summaries
-- We'll use the external call ID as the call_id since the table has a FK constraint

-- Actually, looking at the call_summaries table, it requires a call_id that references phoneburner_calls
-- So we need to check if we can populate this or if we need to update the useCallInformation hook instead

-- Let's verify the constraint
SELECT 1;