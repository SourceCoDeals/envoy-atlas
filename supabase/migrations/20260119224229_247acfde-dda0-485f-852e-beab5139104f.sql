-- Create the positive replies trigger
DROP TRIGGER IF EXISTS trigger_update_positive_replies ON public.email_activities;

CREATE TRIGGER trigger_update_positive_replies
  AFTER INSERT OR UPDATE OF reply_category
  ON public.email_activities
  FOR EACH ROW
  EXECUTE FUNCTION public.update_daily_positive_replies();