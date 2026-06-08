-- ============================================================
-- Add a 'bonus' transaction type for non-revenue credit grants
-- (e.g. signup bonuses). Kept separate from 'deposit' so the admin
-- Revenue / Deposits metrics — which count only paid deposits — are
-- never inflated by free credits.
--
-- This lives in its own migration on purpose: the value must be
-- committed before any function body that references it is created,
-- otherwise CREATE FUNCTION validation raises
-- "unsafe use of new value 'bonus' of enum type transaction_type".
-- The signup-bonus function that uses it is in the next migration.
-- ============================================================

alter type transaction_type add value if not exists 'bonus';
