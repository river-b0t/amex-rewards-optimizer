insert into cards (id, name, network, reward_currency, color) values
  ('11111111-1111-1111-1111-111111111111', 'Amex Platinum', 'amex', 'MR', '#1a1a2e'),
  ('22222222-2222-2222-2222-222222222222', 'Alaska Visa', 'visa', 'miles', '#01426a'),
  ('33333333-3333-3333-3333-333333333333', 'Discover it', 'discover', 'cashback', '#f76400');

insert into card_categories (card_id, category_name, earn_rate, earn_type, notes) values
  ('11111111-1111-1111-1111-111111111111', 'flights', 5, 'multiplier', 'Direct with airline or AmexTravel.com. Cap $500k/year'),
  ('11111111-1111-1111-1111-111111111111', 'prepaid_hotels', 5, 'multiplier', 'Prepaid hotels via AmexTravel.com only'),
  ('11111111-1111-1111-1111-111111111111', 'everything_else', 1, 'multiplier', null),
  ('22222222-2222-2222-2222-222222222222', 'alaska_airlines', 3, 'multiplier', 'Alaska Airlines purchases'),
  ('22222222-2222-2222-2222-222222222222', 'gas', 2, 'multiplier', null),
  ('22222222-2222-2222-2222-222222222222', 'ev_charging', 2, 'multiplier', null),
  ('22222222-2222-2222-2222-222222222222', 'transit', 2, 'multiplier', null),
  ('22222222-2222-2222-2222-222222222222', 'rideshare', 2, 'multiplier', null),
  ('22222222-2222-2222-2222-222222222222', 'grocery', 2, 'multiplier', null),
  ('22222222-2222-2222-2222-222222222222', 'everything_else', 1, 'multiplier', null),
  ('33333333-3333-3333-3333-333333333333', 'grocery', 5, 'percent', '5% Jan-Mar 2026. Cap $1,500/quarter'),
  ('33333333-3333-3333-3333-333333333333', 'fitness', 5, 'percent', '5% Jan-Mar 2026. Cap $1,500/quarter'),
  ('33333333-3333-3333-3333-333333333333', 'everything_else', 1, 'percent', null);
