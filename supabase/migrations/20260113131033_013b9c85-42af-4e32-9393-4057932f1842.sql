-- Add unique constraint on platform_variant_id for smartlead_variants
ALTER TABLE smartlead_variants ADD CONSTRAINT smartlead_variants_platform_variant_id_key UNIQUE (platform_variant_id);

-- Add unique constraint on platform_variant_id for replyio_variants
ALTER TABLE replyio_variants ADD CONSTRAINT replyio_variants_platform_variant_id_key UNIQUE (platform_variant_id);