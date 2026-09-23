-- 008_notification_delivery.sql
-- in_progress prevents two backend instances from delivering the same alert.

ALTER TABLE location_notifications DROP CONSTRAINT location_notifications_status_check;
ALTER TABLE location_notifications ADD CONSTRAINT location_notifications_status_check
  CHECK (status IN ('pending', 'in_progress', 'sent', 'failed', 'disabled'));
