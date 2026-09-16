-- 001_reference_templates.sql
-- Reference data every new patient is initialised from: the default daily
-- routine and the example people and places. The *_key values are i18n keys,
-- so each patient sees them in their own language.
--
-- Idempotent: safe to run on every deploy.

INSERT INTO task_templates (code, label_key, time_key, hour, icon, sort_order) VALUES
  ('med_am',   'task_med_am',   't8am',    8.00, 'medication',      1),
  ('water',    'task_water',    't1030am', 10.50, 'water_drop',     2),
  ('activity', 'task_activity', 't11am',   11.00, 'extension',      3),
  ('lunch',    'task_lunch',    't1pm',    13.00, 'restaurant',     4),
  ('walk',     'task_walk',     't5pm',    17.00, 'directions_walk', 5),
  ('med_pm',   'task_med_pm',   't8pm',    20.00, 'medication',     6)
ON CONFLICT (code) DO UPDATE SET
  label_key  = EXCLUDED.label_key,
  time_key   = EXCLUDED.time_key,
  hour       = EXCLUDED.hour,
  icon       = EXCLUDED.icon,
  sort_order = EXCLUDED.sort_order;

INSERT INTO person_templates (code, name_key, relation_key, note_key, emoji, is_place, sort_order) VALUES
  ('bishnu', 'nm_bishnu', 'rel_son',       'note_bishnu', '👨', false, 1),
  ('rupa',   'nm_rupa',   'rel_dil',       'note_rupa',   '👩', false, 2),
  ('mina',   'nm_mina',   'rel_neighbour', 'note_mina',   '🧓', false, 3),
  ('sharma', 'nm_sharma', 'rel_doctor',    'note_sharma', '🩺', false, 4),
  ('home',   'nm_home',   'rel_place',     'note_home',   '🏡', true,  5)
ON CONFLICT (code) DO UPDATE SET
  name_key     = EXCLUDED.name_key,
  relation_key = EXCLUDED.relation_key,
  note_key     = EXCLUDED.note_key,
  emoji        = EXCLUDED.emoji,
  is_place     = EXCLUDED.is_place,
  sort_order   = EXCLUDED.sort_order;
