# Data Validation Rules

Validation is executed at file load (`processFile`), before per-dataset processing.

## Fatal Checks
- Dataset has at least one row.
- Required columns for dataset exist in the first row schema.

## Warning Checks (sample: up to 5000 rows)
- Empty logical id fields.
- Non numeric amounts (`monto`, `monto_cuota`, `monto_vencido`).
- Invalid date/month normalization input.

## Actions
- Fatal: reject dataset processing and show error message.
- Warning: continue processing and show warning message with counts.

## Notes
- Validation does not mutate source rows except normalizations performed by processing routines.
- Warnings are intended for operator review and troubleshooting.
