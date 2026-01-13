-- Add called_date_time column to cold_calls table for accurate call timestamps
ALTER TABLE public.cold_calls 
ADD COLUMN IF NOT EXISTS called_date_time TIMESTAMP WITH TIME ZONE;