# Tests

Run all tests:

```powershell
python -m unittest discover -s tests -p "test_*.py"
```

Current scope:
- Static regression checks for dashboard structure.
- KPI compliance rule sanity checks.
- Environment template presence checks.
- Golden datasets versioned under `tests/fixtures/golden/` for deterministic business KPI validation.
- Minimal UI regression checks for key cards/canvases and module render entrypoints.
