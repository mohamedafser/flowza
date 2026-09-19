-- Development seed only — applied by `supabase db reset` / local start.
-- Never run against production. No real customer PII.

INSERT INTO public.restaurants (
  id,
  name,
  slug,
  email,
  phone,
  description,
  timezone,
  status
)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'Demo Restaurant',
  'demo-restaurant',
  'demo@flowza.local',
  '+10000000000',
  'Local development restaurant for Flowza Phase 2.',
  'UTC',
  'ACTIVE'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.branches (
  id,
  restaurant_id,
  name,
  slug,
  address_line_1,
  city,
  country,
  timezone,
  is_active
)
VALUES (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'Demo Branch',
  'demo-branch',
  '100 Main Street',
  'Demo City',
  'US',
  'UTC',
  true
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.table_sections (id, branch_id, name, sort_order)
VALUES
  (
    '33333333-3333-3333-3333-333333333301',
    '22222222-2222-2222-2222-222222222222',
    'Indoor',
    1
  ),
  (
    '33333333-3333-3333-3333-333333333302',
    '22222222-2222-2222-2222-222222222222',
    'Outdoor',
    2
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.restaurant_tables (
  id,
  branch_id,
  section_id,
  table_number,
  name,
  capacity,
  status,
  sort_order
)
VALUES
  (
    '44444444-4444-4444-4444-444444444401',
    '22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333301',
    '1',
    'Table 1',
    2,
    'AVAILABLE',
    1
  ),
  (
    '44444444-4444-4444-4444-444444444402',
    '22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333301',
    '2',
    'Table 2',
    4,
    'AVAILABLE',
    2
  ),
  (
    '44444444-4444-4444-4444-444444444403',
    '22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333302',
    '3',
    'Patio 1',
    4,
    'AVAILABLE',
    3
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.queues (
  id,
  branch_id,
  name,
  status,
  prefix,
  current_number,
  estimated_service_minutes
)
VALUES (
  '55555555-5555-5555-5555-555555555555',
  '22222222-2222-2222-2222-222222222222',
  'Main Queue',
  'ACTIVE',
  'A',
  0,
  15
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.displays (
  id,
  branch_id,
  queue_id,
  name,
  display_code,
  public_token,
  mode,
  is_active,
  settings
)
VALUES (
  '66666666-6666-6666-6666-666666666666',
  '22222222-2222-2222-2222-222222222222',
  '55555555-5555-5555-5555-555555555555',
  'Lobby TV',
  'DEMO01',
  'flowza_demo_display_public_token_phase11_secure_01',
  'QUEUE',
  true,
  '{"nextTokenCount":3,"showRestaurantLogo":true,"showBranchName":true,"showQueueName":true,"theme":"dark","preferFullscreen":false}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.operating_hours (
  id,
  restaurant_id,
  branch_id,
  day_of_week,
  is_closed
)
VALUES
  ('55555555-5555-5555-5555-555555555501', '11111111-1111-1111-1111-111111111111', NULL, 1, false),
  ('55555555-5555-5555-5555-555555555502', '11111111-1111-1111-1111-111111111111', NULL, 2, false),
  ('55555555-5555-5555-5555-555555555503', '11111111-1111-1111-1111-111111111111', NULL, 3, false),
  ('55555555-5555-5555-5555-555555555504', '11111111-1111-1111-1111-111111111111', NULL, 4, false),
  ('55555555-5555-5555-5555-555555555505', '11111111-1111-1111-1111-111111111111', NULL, 5, false),
  ('55555555-5555-5555-5555-555555555506', '11111111-1111-1111-1111-111111111111', NULL, 6, false),
  ('55555555-5555-5555-5555-555555555507', '11111111-1111-1111-1111-111111111111', NULL, 7, true)
ON CONFLICT DO NOTHING;

INSERT INTO public.operating_periods (
  operating_hours_id,
  open_time,
  close_time,
  sort_order
)
SELECT id, TIME '11:00', TIME '23:00', 0
FROM public.operating_hours
WHERE restaurant_id = '11111111-1111-1111-1111-111111111111'
  AND branch_id IS NULL
  AND is_closed = false
ON CONFLICT DO NOTHING;

INSERT INTO public.special_hours (
  id,
  restaurant_id,
  branch_id,
  date,
  is_closed,
  reason
)
VALUES (
  '55555555-5555-5555-5555-555555555599',
  '11111111-1111-1111-1111-111111111111',
  NULL,
  '2026-12-25',
  true,
  'Christmas'
)
ON CONFLICT DO NOTHING;
