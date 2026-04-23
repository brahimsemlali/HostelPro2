-- Add iCal integration fields to properties
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS booking_com_ical_url TEXT,
  ADD COLUMN IF NOT EXISTS last_ical_sync TIMESTAMPTZ;
