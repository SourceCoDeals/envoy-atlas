-- Extend phoneburner_daily_metrics with additional tracking columns
ALTER TABLE public.phoneburner_daily_metrics 
ADD COLUMN IF NOT EXISTS decision_maker_connects integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS meaningful_conversations integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS meetings_booked integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS qualified_opportunities integer DEFAULT 0;

-- Create lead_call_attempts table for tracking attempts per lead
CREATE TABLE IF NOT EXISTS public.lead_call_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  attempt_count integer NOT NULL DEFAULT 1,
  first_attempt_at timestamp with time zone NOT NULL DEFAULT now(),
  last_attempt_at timestamp with time zone NOT NULL DEFAULT now(),
  outcome text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, lead_id)
);

-- Enable RLS on lead_call_attempts
ALTER TABLE public.lead_call_attempts ENABLE ROW LEVEL SECURITY;

-- RLS policies for lead_call_attempts
CREATE POLICY "Users can view lead call attempts in their workspace"
ON public.lead_call_attempts FOR SELECT
USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Users can insert lead call attempts in their workspace"
ON public.lead_call_attempts FOR INSERT
WITH CHECK (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Users can update lead call attempts in their workspace"
ON public.lead_call_attempts FOR UPDATE
USING (is_workspace_member(workspace_id, auth.uid()));

-- Create cold_calling_benchmarks table with industry standards
CREATE TABLE IF NOT EXISTS public.cold_calling_benchmarks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  metric_name text NOT NULL UNIQUE,
  metric_key text NOT NULL UNIQUE,
  benchmark_value numeric NOT NULL,
  benchmark_unit text NOT NULL,
  benchmark_range_low numeric,
  benchmark_range_high numeric,
  description text,
  source text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on cold_calling_benchmarks (public read)
ALTER TABLE public.cold_calling_benchmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view benchmarks"
ON public.cold_calling_benchmarks FOR SELECT
USING (true);

-- Insert industry benchmarks
INSERT INTO public.cold_calling_benchmarks (metric_name, metric_key, benchmark_value, benchmark_unit, benchmark_range_low, benchmark_range_high, description, source) VALUES
('Connect Rate', 'connect_rate', 25, 'percent', 20, 30, 'Percentage of calls where you speak to someone', 'Industry Standard'),
('Decision-Maker Connect Rate', 'dm_connect_rate', 30, 'percent', 25, 35, 'Percentage reaching the right person', 'Industry Standard'),
('Calls Per Hour', 'calls_per_hour', 17.5, 'calls', 15, 20, 'Efficiency in dialing', 'Industry Standard'),
('Calls Per Day', 'calls_per_day', 75, 'calls', 50, 100, 'Daily productivity', 'Industry Standard'),
('Attempts Per Lead', 'attempts_per_lead', 7, 'attempts', 6, 8, 'Average tries to reach one prospect', 'Industry Standard'),
('Conversation to Meeting Rate', 'conv_to_meeting_rate', 15, 'percent', 10, 20, 'Quality talks to booked meetings', 'Industry Standard'),
('Cold Call Conversion Rate', 'cold_call_conversion', 3.5, 'percent', 2, 5, 'Calls leading to closed deals', 'Industry Standard'),
('Voicemail Return Rate', 'vm_return_rate', 4.8, 'percent', 3, 7, 'Voicemails that get returned', 'Industry Standard'),
('Meaningful Conversation Duration', 'meaningful_duration', 3.5, 'minutes', 2, 5, 'Length of successful calls', 'Industry Standard'),
('Lead Quality Conversion', 'lead_quality_conv', 20, 'percent', 15, 25, 'Cold calls to qualified pipeline', 'Industry Standard')
ON CONFLICT (metric_key) DO NOTHING;

-- Add trigger for updated_at on lead_call_attempts
CREATE TRIGGER update_lead_call_attempts_updated_at
BEFORE UPDATE ON public.lead_call_attempts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();