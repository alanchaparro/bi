# Debugging Rendimiento Filter Issue

## Symptoms
- **0 Selected in Tramo**: Shows Gs. 2.295.584.213 (Almost total collection).
- **"Todos" Selected in Tramo**: Shows Gs. 808.434.521 (Too low).
- **MatchSum (PowerShell)**: Was Gs. 1.742.417.425.

## Hypothesis
1. **Null/Default Mismatch**: `setupFilter` uses `r.tramo || '0'`, but `calculatePerformance` filter uses `r.tramo || ''`. Selecting "Todos" excludes the empty ones because the filter set doesn't have `''`.
2. **Key Inflation**: If no tramos are selected, why is it showing 2.29B? My PowerShell match was 1.74B. This suggests that without the tramo filter, it's matching too many rows or the same contract appears multiple times in different months and I'm not filtering by date correctly.
3. **Selector Logic**: `selTramo.size === 0` might be triggered when the user thinks things are checked? No, "0 sel." literally means set size is 0.

## Plan
1. Inspect `calculatePerformance` logic for Tramo/UN normalization.
2. Verify duplicate rows in `state.cartera.data` from the browser's perspective.
3. Fix the "All selected" logic to handle defaults consistently.
4. Add diagnostic logs to the dashboard UI to show MatchCount and NonMatchCount more clearly.
