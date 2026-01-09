-- Backfill calling_deals from scored external_calls with seller interest >= 5
INSERT INTO calling_deals (
  workspace_id,
  company_name,
  contact_name,
  contact_email,
  business_description,
  interest_level,
  seller_interest_score,
  seller_interest_summary,
  timeline_to_sell,
  timeline_score,
  motivation_score,
  motivation_factors,
  key_concerns,
  last_contact_at,
  status,
  exit_reason,
  financial_data,
  growth_information,
  ownership_information,
  valuation_expectations,
  ma_discussions,
  target_pain_points,
  future_growth_plans,
  business_history,
  transaction_goals,
  employees,
  company_size_score,
  created_at,
  updated_at
)
SELECT 
  ec.workspace_id,
  COALESCE(ec.company_name, ec.call_title, 'Unknown Company') as company_name,
  ec.contact_name,
  ec.host_email as contact_email,
  ec.business_description,
  CASE 
    WHEN ec.seller_interest_score >= 8 THEN 'Hot'
    WHEN ec.seller_interest_score >= 6 THEN 'Warm'
    WHEN ec.seller_interest_score >= 4 THEN 'Interested'
    ELSE 'Cold'
  END as interest_level,
  ec.seller_interest_score::integer,
  ec.seller_interest_justification as seller_interest_summary,
  ec.timeline_to_sell,
  CASE 
    WHEN ec.timeline_to_sell ILIKE '%immediate%' OR ec.timeline_to_sell ILIKE '%now%' OR ec.timeline_to_sell ILIKE '%asap%' THEN 30
    WHEN ec.timeline_to_sell ILIKE '%6 month%' OR ec.timeline_to_sell ILIKE '%soon%' THEN 25
    WHEN ec.timeline_to_sell ILIKE '%1 year%' OR ec.timeline_to_sell ILIKE '%12 month%' THEN 20
    WHEN ec.timeline_to_sell ILIKE '%2 year%' OR ec.timeline_to_sell ILIKE '%24 month%' THEN 10
    ELSE 15
  END as timeline_score,
  CASE 
    WHEN ec.seller_interest_score >= 8 THEN 30
    WHEN ec.seller_interest_score >= 6 THEN 20
    WHEN ec.seller_interest_score >= 4 THEN 10
    ELSE 5
  END as motivation_score,
  ec.motivation_factors,
  ec.key_concerns,
  ec.date_time as last_contact_at,
  'open' as status,
  ec.exit_reason,
  ec.financial_data,
  ec.growth_information,
  ec.ownership_information,
  ec.valuation_expectations,
  ec.ma_discussions,
  ec.target_pain_points,
  ec.future_growth_plans,
  ec.business_history,
  ec.transaction_goals,
  ec.employee_count as employees,
  40 as company_size_score,
  NOW() as created_at,
  NOW() as updated_at
FROM external_calls ec
WHERE ec.composite_score IS NOT NULL
  AND ec.seller_interest_score >= 5
  AND NOT EXISTS (
    SELECT 1 FROM calling_deals cd 
    WHERE cd.workspace_id = ec.workspace_id 
    AND cd.company_name = COALESCE(ec.company_name, ec.call_title, 'Unknown Company')
  );