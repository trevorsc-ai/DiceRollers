-- ============================================================
-- Migration 071: Remove recovery email
-- Drops profiles.recovery_email so no personal contact
-- information is stored anywhere in the app.
--
-- Destructive and irreversible: every stored recovery address
-- is deleted. That is the intent of this change.
-- ============================================================

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS recovery_email;
