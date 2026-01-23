-- Add more sponsor aliases to improve auto-pairing
INSERT INTO public.sponsor_aliases (workspace_id, alias, canonical_name) VALUES
  ('65fa0b62-b880-4961-80f5-8289c5163230', 'HTR', 'HTR Capital'),
  ('65fa0b62-b880-4961-80f5-8289c5163230', 'BC', 'Baum Capital'),
  ('65fa0b62-b880-4961-80f5-8289c5163230', 'TH', 'Trinity Hunt'),
  ('65fa0b62-b880-4961-80f5-8289c5163230', 'CF', 'Centerfield'),
  ('65fa0b62-b880-4961-80f5-8289c5163230', 'NY', 'Northern Yard'),
  ('65fa0b62-b880-4961-80f5-8289c5163230', 'HS', 'Harbor Street'),
  ('65fa0b62-b880-4961-80f5-8289c5163230', 'AP', 'Apax Partners'),
  ('65fa0b62-b880-4961-80f5-8289c5163230', 'TS', 'TouchSuite'),
  ('65fa0b62-b880-4961-80f5-8289c5163230', 'TK', 'Triskelion'),
  ('65fa0b62-b880-4961-80f5-8289c5163230', 'FMS', 'FMS'),
  ('65fa0b62-b880-4961-80f5-8289c5163230', 'HLS', 'HLS'),
  ('65fa0b62-b880-4961-80f5-8289c5163230', 'KT', 'KeyTrust'),
  ('65fa0b62-b880-4961-80f5-8289c5163230', 'PM', 'Property Management'),
  ('65fa0b62-b880-4961-80f5-8289c5163230', 'PropMgmt', 'Property Management'),
  ('65fa0b62-b880-4961-80f5-8289c5163230', 'Prop Mgmt', 'Property Management')
ON CONFLICT (workspace_id, alias) DO NOTHING;