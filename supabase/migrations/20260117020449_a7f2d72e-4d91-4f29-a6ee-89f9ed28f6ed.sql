-- Drop trigger first, then function with CASCADE
DROP TRIGGER IF EXISTS check_email_account_thresholds ON email_accounts;
DROP FUNCTION IF EXISTS check_deliverability_thresholds() CASCADE;

-- Recreate function with explicit search_path
CREATE OR REPLACE FUNCTION check_deliverability_thresholds()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check bounce rate thresholds
  IF NEW.bounce_rate IS NOT NULL AND NEW.bounce_rate > 5 THEN
    INSERT INTO deliverability_alerts (
      workspace_id, 
      alert_type, 
      severity, 
      title, 
      message, 
      entity_type, 
      entity_id,
      entity_name,
      metric_value,
      threshold_value
    )
    VALUES (
      NEW.workspace_id,
      'bounce_rate',
      CASE WHEN NEW.bounce_rate > 10 THEN 'critical' ELSE 'warning' END,
      'High Bounce Rate: ' || NEW.email_address,
      'Bounce rate of ' || ROUND(NEW.bounce_rate::numeric, 2) || '% exceeds threshold. This may damage your sender reputation.',
      'email_account',
      NEW.id::text,
      NEW.email_address,
      NEW.bounce_rate,
      5
    )
    ON CONFLICT DO NOTHING;
  END IF;
  
  -- Check spam complaint thresholds
  IF NEW.spam_complaint_rate IS NOT NULL AND NEW.spam_complaint_rate > 0.1 THEN
    INSERT INTO deliverability_alerts (
      workspace_id, 
      alert_type, 
      severity, 
      title, 
      message, 
      entity_type, 
      entity_id,
      entity_name,
      metric_value,
      threshold_value
    )
    VALUES (
      NEW.workspace_id,
      'spam_complaint',
      CASE WHEN NEW.spam_complaint_rate > 0.3 THEN 'critical' ELSE 'warning' END,
      'High Spam Complaints: ' || NEW.email_address,
      'Spam complaint rate of ' || ROUND(NEW.spam_complaint_rate::numeric, 3) || '% is above safe threshold.',
      'email_account',
      NEW.id::text,
      NEW.email_address,
      NEW.spam_complaint_rate,
      0.1
    )
    ON CONFLICT DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate trigger
CREATE TRIGGER check_email_account_thresholds
AFTER UPDATE OF bounce_rate, spam_complaint_rate ON email_accounts
FOR EACH ROW
EXECUTE FUNCTION check_deliverability_thresholds();