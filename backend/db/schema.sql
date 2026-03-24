-- ═══════════════════════════════════════════════════
--  Paper Trading App — MySQL Schema
--  Database: ovmobile_paper_trading_app
-- ═══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS users (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  username    VARCHAR(50)  NOT NULL UNIQUE,
  email       VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS wallets (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL UNIQUE,
  balance     DECIMAL(15,2) DEFAULT 100000.00,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS positions (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  user_id        INT NOT NULL,
  symbol         VARCHAR(50) NOT NULL,
  instrument_key VARCHAR(100) DEFAULT NULL,
  option_type    ENUM('CE','PE') DEFAULT NULL,
  strike         DECIMAL(15,2) DEFAULT NULL,
  expiry         DATE DEFAULT NULL,
  qty            INT NOT NULL DEFAULT 1,
  avg_price      DECIMAL(15,2) NOT NULL,
  target         DECIMAL(15,2) DEFAULT NULL,
  stoploss       DECIMAL(15,2) DEFAULT NULL,
  status         ENUM('OPEN','CLOSED') DEFAULT 'OPEN',
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_positions_user_status (user_id, status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS trades (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  user_id        INT NOT NULL,
  symbol         VARCHAR(50) NOT NULL,
  instrument_key VARCHAR(100) DEFAULT NULL,
  option_type    ENUM('CE','PE') DEFAULT NULL,
  strike         DECIMAL(15,2) DEFAULT NULL,
  expiry         DATE DEFAULT NULL,
  qty            INT NOT NULL,
  entry_price    DECIMAL(15,2) NOT NULL,
  exit_price     DECIMAL(15,2) NOT NULL,
  pnl            DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  side           ENUM('BUY','SELL') DEFAULT 'BUY',
  exit_reason    VARCHAR(50) DEFAULT NULL,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_trades_user (user_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS orders (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  user_id        INT NOT NULL,
  symbol         VARCHAR(50) NOT NULL,
  instrument_key VARCHAR(100) DEFAULT NULL,
  option_type    ENUM('CE','PE') DEFAULT NULL,
  strike         DECIMAL(15,2) DEFAULT NULL,
  expiry         DATE DEFAULT NULL,
  qty            INT NOT NULL,
  limit_price    DECIMAL(15,2) NOT NULL,
  side           ENUM('BUY','SELL') DEFAULT 'BUY',
  target         DECIMAL(15,2) DEFAULT NULL,
  stoploss       DECIMAL(15,2) DEFAULT NULL,
  status         ENUM('PENDING','EXECUTED','CANCELLED') DEFAULT 'PENDING',
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_orders_status (status),
  INDEX idx_orders_user (user_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS transactions (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  type        VARCHAR(30) NOT NULL,
  amount      DECIMAL(15,2) NOT NULL,
  description VARCHAR(255) DEFAULT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_transactions_user (user_id)
) ENGINE=InnoDB;
