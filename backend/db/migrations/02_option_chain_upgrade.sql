-- ═══════════════════════════════════════════════════
--  Migration v4: Option Chain Trading System Upgrade
--  Run after 01_options_upgrade.sql
-- ═══════════════════════════════════════════════════

-- 1. option_instruments table — daily CSV cache
CREATE TABLE IF NOT EXISTS option_instruments (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  instrument_key  VARCHAR(100) NOT NULL,
  trading_symbol  VARCHAR(100) NOT NULL,
  name            VARCHAR(50)  NOT NULL,
  instrument_type VARCHAR(20)  NOT NULL,
  option_type     ENUM('CE','PE') DEFAULT NULL,
  strike          DECIMAL(15,2) DEFAULT NULL,
  expiry          DATE DEFAULT NULL,
  lot_size        INT DEFAULT 1,
  exchange        VARCHAR(20) DEFAULT 'NSE_FO',
  loaded_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_oi_name_expiry (name, expiry),
  INDEX idx_oi_instrument_key (instrument_key),
  INDEX idx_oi_strike (strike)
) ENGINE=InnoDB;

-- 2. Expand orders.status to include OPEN/CLOSED lifecycle
ALTER TABLE orders
  MODIFY COLUMN status ENUM('PENDING','OPEN','EXECUTED','CLOSED','CANCELLED') DEFAULT 'PENDING';

-- 3. Add order_type for MARKET vs LIMIT distinction
ALTER TABLE orders
  ADD COLUMN order_type ENUM('MARKET','LIMIT') DEFAULT 'MARKET' AFTER status;

-- 4. Add trailing SL to orders and positions
ALTER TABLE orders
  ADD COLUMN trailing_sl DECIMAL(15,2) DEFAULT NULL AFTER stoploss;

ALTER TABLE positions
  ADD COLUMN trailing_sl DECIMAL(15,2) DEFAULT NULL AFTER stoploss;

ALTER TABLE positions
  ADD COLUMN side ENUM('BUY','SELL') DEFAULT 'BUY' AFTER status;

-- 5. Add entry/exit tracking columns to orders (for lifecycle)
ALTER TABLE orders
  ADD COLUMN entry_price DECIMAL(15,2) DEFAULT NULL,
  ADD COLUMN exit_price DECIMAL(15,2) DEFAULT NULL,
  ADD COLUMN pnl DECIMAL(15,2) DEFAULT NULL,
  ADD COLUMN exit_reason VARCHAR(50) DEFAULT NULL;

-- 6. Add peak_price to positions for trailing SL tracking
ALTER TABLE positions
  ADD COLUMN peak_price DECIMAL(15,2) DEFAULT NULL AFTER avg_price;
