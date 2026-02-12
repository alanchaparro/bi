# Manual Regression Checklist

## Core
- [ ] App opens at `http://localhost:5000`.
- [ ] No recursive or stack overflow errors.
- [ ] Config tab sync works for available CSV files.
- [ ] Docker validation pipeline executed (`.\scripts\docker-validate.ps1`).

## Navigation
- [ ] Sidebar opens/closes with menu button.
- [ ] Sidebar closes on overlay click.
- [ ] Sidebar closes after tab click.

## Filters
- [ ] Apply filters changes visuals.
- [ ] Reset filters restores default state.
- [ ] No tab crashes with empty selection combinations.

## Charts
- [ ] Charts render in each tab.
- [ ] Tooltips show formatted values.
- [ ] Compliance line and labels are visible.
- [ ] Movimiento cartera renders bars + `% sobre vigentes` from API/fallback.
- [ ] No severe overlap between bar labels and line labels in movimiento.

## Data Validation
- [ ] Missing required columns fail with clear error.
- [ ] Invalid rows produce warnings, not silent failures.

## Flags & Rollout
- [ ] Feature flags loaded (`data/feature-flags.js`) and expected defaults active.
- [ ] If stale assets appear, run hard refresh (`Ctrl+F5`) after deploy.
- [ ] Confirm fallback behavior when analytics API endpoint is unavailable.
