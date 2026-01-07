-- Create storage bucket for industry documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('industry-documents', 'industry-documents', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policy: Users can upload to their workspace folder
CREATE POLICY "Users can upload industry documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'industry-documents' 
  AND auth.role() = 'authenticated'
);

-- RLS policy: Users can view documents in their workspace
CREATE POLICY "Users can view industry documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'industry-documents' 
  AND auth.role() = 'authenticated'
);

-- RLS policy: Users can delete their documents
CREATE POLICY "Users can delete industry documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'industry-documents' 
  AND auth.role() = 'authenticated'
);