-- ==========================================
-- Migration 012: Arrivals Enhancement
-- Adds arrival notes and expected arrival time to bookings
-- ==========================================

-- Staff notes about the arrival (flight info, ETA, special instructions)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS arrival_notes TEXT;

-- Optional expected time of arrival
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS expected_arrival_time TIME;
