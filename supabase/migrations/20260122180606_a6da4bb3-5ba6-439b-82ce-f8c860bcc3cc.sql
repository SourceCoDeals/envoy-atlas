-- Create an Unassigned engagement for orphaned campaigns
INSERT INTO engagements (id, name, status, client_id, is_platform)
SELECT 
  '00000000-0000-0000-0000-000000000000',
  'Unassigned Campaigns',
  'active',
  (SELECT id FROM clients LIMIT 1),
  false
WHERE NOT EXISTS (SELECT 1 FROM engagements WHERE id = '00000000-0000-0000-0000-000000000000');