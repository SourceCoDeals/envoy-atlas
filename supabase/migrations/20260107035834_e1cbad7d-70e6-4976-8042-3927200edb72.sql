-- Fix inbox_items view to match actual event_type values in database
DROP VIEW IF EXISTS inbox_items;

CREATE VIEW inbox_items AS
SELECT 
    me.id,
    me.workspace_id,
    me.campaign_id,
    c.name AS campaign_name,
    me.lead_id,
    l.email AS lead_email,
    l.email_type,
    l.email_domain,
    l.first_name,
    l.last_name,
    l.company,
    l.title,
    me.event_type,
    me.reply_content,
    me.reply_sentiment,
    me.sequence_step,
    me.occurred_at,
    me.created_at,
    cv.subject_line,
    cv.name AS variant_name
FROM message_events me
LEFT JOIN leads l ON l.id = me.lead_id
LEFT JOIN campaigns c ON c.id = me.campaign_id
LEFT JOIN campaign_variants cv ON cv.id = me.variant_id
WHERE me.event_type IN ('reply', 'replied', 'positive_reply', 'negative_reply', 'interested', 'not_interested', 'out_of_office', 'unsubscribe');