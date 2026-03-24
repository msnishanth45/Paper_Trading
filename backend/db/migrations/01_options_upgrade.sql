-- Migration: Add Options Trading capability to existing database
-- This script safely alters `positions`, `trades`, and `orders` to include options-specific columns

ALTER TABLE positions
  ADD COLUMN instrument_key VARCHAR(100) DEFAULT NULL AFTER symbol,
  ADD COLUMN option_type ENUM('CE','PE') DEFAULT NULL AFTER instrument_key,
  ADD COLUMN strike DECIMAL(15,2) DEFAULT NULL AFTER option_type,
  ADD COLUMN expiry DATE DEFAULT NULL AFTER strike;

ALTER TABLE trades
  ADD COLUMN instrument_key VARCHAR(100) DEFAULT NULL AFTER symbol,
  ADD COLUMN option_type ENUM('CE','PE') DEFAULT NULL AFTER instrument_key,
  ADD COLUMN strike DECIMAL(15,2) DEFAULT NULL AFTER option_type,
  ADD COLUMN expiry DATE DEFAULT NULL AFTER strike;

ALTER TABLE orders
  ADD COLUMN instrument_key VARCHAR(100) DEFAULT NULL AFTER symbol,
  ADD COLUMN option_type ENUM('CE','PE') DEFAULT NULL AFTER instrument_key,
  ADD COLUMN strike DECIMAL(15,2) DEFAULT NULL AFTER option_type,
  ADD COLUMN expiry DATE DEFAULT NULL AFTER strike;
