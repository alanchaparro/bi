-- MySQL source hardening for incremental sync (40GB scale target)
-- Execute in a controlled maintenance window and adjust table names if needed.
-- Validate with EXPLAIN before/after.

-- 1) Payments (cobranzas): tie-break by updated_at + id
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS ix_payments_updated_id
  ON payments (updated_at, id);

CREATE INDEX IF NOT EXISTS ix_payments_date_status_type
  ON payments (date, status, type);

-- 2) Contracts: incremental over contract updates
ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS ix_contracts_updated_id
  ON contracts (updated_at, id);

CREATE INDEX IF NOT EXISTS ix_contracts_enterprise_status_date
  ON contracts (enterprise_id, status, date);

-- 3) Closed dates (cartera): incremental by close date + contract
ALTER TABLE contract_closed_dates
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS ix_ccd_updated_contract
  ON contract_closed_dates (updated_at, contract_id);

CREATE INDEX IF NOT EXISTS ix_ccd_closed_date_contract
  ON contract_closed_dates (closed_date, contract_id);

-- 4) Client portfolios (gestores): incremental by updated_at + id
ALTER TABLE client_portfolios
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS ix_client_portfolios_updated_id
  ON client_portfolios (updated_at, id);

CREATE INDEX IF NOT EXISTS ix_client_portfolios_from_status
  ON client_portfolios (from_date, status);

-- Optional: persistent checksum for very wide rows where updated_at is noisy
-- ALTER TABLE <table_name> ADD COLUMN IF NOT EXISTS row_checksum CHAR(64) NULL;
-- Populate via trigger or periodic batch depending on write profile.
