# UI State Model

## State Domains
- `sidebar`: `open | closed`
- `activeTab`: one of `cartera|cobranzas|analisisCartera|rendimiento|cosecha|ltv|ltvAge|analisisCobranza|culminados|gestores|config`
- `filters`: `{ draft, applied }` keyed by tab and filter id
- `dataReadiness`: `{ cartera, cobranzas, gestores, contratos }`

## Navigation Rules
- `switchTab(tabId)` updates active button and visible content.
- Sidebar closes on tab click.
- Sidebar overlay click closes sidebar.

## Error and Notification Model
- `showInfo(message)` for normal workflow feedback.
- `showWarning(message)` for recoverable data quality issues.
- `showError(message, error)` for hard failures.

## Consistency Constraints
- Tabs are shown only after `showTabsNav()`.
- Each tab render path must guard on required datasets.
- Chart rendering must fail gracefully without breaking tab interaction.
