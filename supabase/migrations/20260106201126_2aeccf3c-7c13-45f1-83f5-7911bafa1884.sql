-- Add enrichment fields to leads table for segment classification
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS seniority_level text,
ADD COLUMN IF NOT EXISTS department text,
ADD COLUMN IF NOT EXISTS company_size_category text,
ADD COLUMN IF NOT EXISTS enriched_at timestamp with time zone;

-- Create index for faster segment-based queries
CREATE INDEX IF NOT EXISTS idx_leads_seniority_level ON public.leads(seniority_level) WHERE seniority_level IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_department ON public.leads(department) WHERE department IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_company_size_category ON public.leads(company_size_category) WHERE company_size_category IS NOT NULL;

-- Create a composite index for common segment queries
CREATE INDEX IF NOT EXISTS idx_leads_segments ON public.leads(workspace_id, seniority_level, department, industry);