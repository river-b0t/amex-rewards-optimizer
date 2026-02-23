insert into amex_benefits
  (name, description, amount_cents, reset_period, category, enrolled, enrollment_required, sort_order)
values
  ('Airline Fee Credit',    'Incidental fees on selected airline (Alaska Airlines)', 20000, 'annual',      'travel',        true,  false, 1),
  ('Digital Entertainment', '$25/month at Disney+, Hulu, ESPN+, Peacock, NYT, WSJ', 30000, 'monthly',     'entertainment', true,  true,  2),
  ('Hotel Credit',          '$300 semi-annually on prepaid hotels via Amex Travel',  60000, 'semi-annual', 'travel',        true,  false, 3),
  ('Uber Cash',             '$15/month + $20 in December via Uber app',              20000, 'annual',      'travel',        false, true,  4),
  ('Uber One Credit',       'Auto-renewing Uber One membership',                     12000, 'annual',      'travel',        false, true,  5),
  ('Resy Credit',           '$100/quarter at Resy restaurants',                      40000, 'quarterly',   'dining',        true,  true,  6),
  ('lululemon Credit',      '$75/quarter at lululemon US',                           30000, 'quarterly',   'shopping',      true,  true,  7),
  ('Oura Ring Credit',      'Oura Ring purchase at ouraring.com',                    20000, 'annual',      'wellness',      false, true,  8),
  ('Walmart+ Credit',       'Monthly Walmart+ membership (~$12.95/month)',           15600, 'annual',      'shopping',      true,  false, 9),
  ('Saks Fifth Avenue',     '$50 semi-annually at Saks',                             10000, 'semi-annual', 'shopping',      false, true,  10),
  ('Equinox/SoulCycle',     'Equinox+ or club membership, or SoulCycle bike',        30000, 'annual',      'wellness',      false, true,  11),
  ('CLEAR+ Credit',         'CLEAR+ annual membership',                              20900, 'annual',      'travel',        true,  false, 12),
  ('Global Entry / TSA',    '$120 Global Entry or $85 TSA PreCheck every 4 years',  12000, '4-year',      'travel',        true,  false, 13);
