-- 001_functions.sql  (repeatable)
-- Applied after every migration run, so it must stay idempotent:
-- CREATE OR REPLACE for functions, DROP ... IF EXISTS before CREATE TRIGGER.

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_set_updated_at ON users;
CREATE TRIGGER users_set_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS patients_set_updated_at ON patients;
CREATE TRIGGER patients_set_updated_at
  BEFORE UPDATE ON patients
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS safe_zones_set_updated_at ON safe_zones;
CREATE TRIGGER safe_zones_set_updated_at
  BEFORE UPDATE ON safe_zones
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
