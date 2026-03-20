-- ============================================================
-- Backfill roll_date for rolls made between midnight and 4:59am
-- A "night" runs 5:00 PM to 4:59 AM — any roll with hour < 5
-- in America/New_York time belongs to the previous calendar date.
-- ============================================================

UPDATE rolls
SET roll_date = (roll_time AT TIME ZONE 'America/New_York')::date - INTERVAL '1 day'
WHERE EXTRACT(HOUR FROM roll_time AT TIME ZONE 'America/New_York') < 5;
