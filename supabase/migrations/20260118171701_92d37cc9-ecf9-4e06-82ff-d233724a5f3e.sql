
-- Drop and recreate view to fix health_score column type

-- Step 1: Drop the dependent view
DROP VIEW IF EXISTS domain_health_summary;

-- Step 2: Alter column types
ALTER TABLE email_accounts 
ALTER COLUMN health_score TYPE numeric(5,2);

ALTER TABLE sending_domains 
ALTER COLUMN health_score TYPE numeric(5,2);

-- Step 3: Recreate the view
CREATE VIEW domain_health_summary AS
SELECT 
    substring(ea.email_address, '@(.*)$'::text) AS domain,
    ea.workspace_id,
    count(*) AS mailbox_count,
    count(CASE WHEN ea.is_active THEN 1 ELSE NULL END) AS active_mailboxes,
    sum(ea.daily_limit) AS total_daily_capacity,
    avg(ea.health_score) AS avg_health_score,
    avg(ea.warmup_percentage) AS avg_warmup_percentage,
    count(CASE WHEN ea.warmup_enabled THEN 1 ELSE NULL END) AS warming_up_count,
    avg(ea.bounce_rate) AS avg_bounce_rate,
    avg(ea.reply_rate) AS avg_reply_rate,
    sd.spf_valid,
    sd.dkim_valid,
    sd.dmarc_valid,
    sd.is_bulk_sender,
    sd.blacklist_status,
    sd.google_postmaster_reputation,
    sd.domain_status
FROM email_accounts ea
LEFT JOIN sending_domains sd ON (
    sd.domain = substring(ea.email_address, '@(.*)$'::text) 
    AND sd.workspace_id = ea.workspace_id
)
GROUP BY 
    substring(ea.email_address, '@(.*)$'::text), 
    ea.workspace_id, 
    sd.spf_valid, 
    sd.dkim_valid, 
    sd.dmarc_valid, 
    sd.is_bulk_sender, 
    sd.blacklist_status, 
    sd.google_postmaster_reputation, 
    sd.domain_status;
