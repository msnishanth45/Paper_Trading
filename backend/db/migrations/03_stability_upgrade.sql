-- ==========================================================
-- Phase 7 & 8: Stability and Performance Upgrades
-- Run this block to upgrade your DB schema
-- ==========================================================

-- 1. Create tick_logs table for audit logging
CREATE TABLE IF NOT EXISTS tick_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    symbol VARCHAR(50) NOT NULL,
    price DOUBLE NOT NULL,
    source VARCHAR(20) NOT NULL, -- WS / SNAPSHOT / REST
    latency_ms INT DEFAULT 0,
    received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_symbol (symbol),
    INDEX idx_received_at (received_at)
);

-- 2. Add performance indexes for background workers and queries
-- Note: MySQL IGNORE syntax for duplicate index creation varies, usually need to just create and ignore errors. 
-- Assuming they don't exist yet based on old schema.

CREATE INDEX idx_positions_user_status ON positions(user_id, status);
CREATE INDEX idx_positions_status ON positions(status);
CREATE INDEX idx_orders_user_status ON orders(user_id, status);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_trades_user ON trades(user_id);
CREATE INDEX idx_option_inst_lookup ON option_instruments(symbol, expiry, strike);
