from __future__ import annotations

from sqlalchemy.orm import Session

from app.core.analytics_cache import set as cache_set
from app.schemas.analytics import AnalyticsFilters, CobranzasCohorteFirstPaintIn, CobranzasCohorteIn, PortfolioSummaryIn
from app.services.analytics_service import AnalyticsService


def prewarm_analytics_cache_after_sync(db: Session, domain: str, append_log) -> None:
    try:
        base_filters = AnalyticsFilters()
        if domain in {"cartera", "cobranzas", "analytics"}:
            portfolio_options = AnalyticsService.fetch_portfolio_corte_options_v2(db, base_filters)
            cache_set("portfolio/corte/options", base_filters, portfolio_options, ttl_seconds=600)
            cache_set("portfolio-corte-v2/options", base_filters, portfolio_options, ttl_seconds=600)
            portfolio_filters = PortfolioSummaryIn(include_rows=False)
            portfolio_summary = AnalyticsService.fetch_portfolio_corte_summary_v2(db, portfolio_filters)
            cache_set("portfolio-corte-v2/summary", portfolio_filters, portfolio_summary, ttl_seconds=180)
            portfolio_fp = AnalyticsService.fetch_portfolio_corte_first_paint_v2(db, portfolio_filters)
            cache_set("portfolio-corte-v2/first-paint", portfolio_filters, portfolio_fp, ttl_seconds=180)
            rendimiento_options = AnalyticsService.fetch_rendimiento_options_v2(db, base_filters)
            cache_set("rendimiento-v2/options", base_filters, rendimiento_options, ttl_seconds=120)
            rendimiento_summary = AnalyticsService.fetch_rendimiento_summary_v2(db, base_filters)
            cache_set("rendimiento-v2/summary", base_filters, rendimiento_summary, ttl_seconds=300)
            rendimiento_fp = AnalyticsService.fetch_rendimiento_first_paint_v2(db, base_filters)
            cache_set("rendimiento-v2/first-paint", base_filters, rendimiento_fp, ttl_seconds=180)
            anuales_options = AnalyticsService.fetch_anuales_options_v2(db, base_filters)
            cache_set("anuales-v2/options", base_filters, anuales_options, ttl_seconds=120)
            anuales_summary = AnalyticsService.fetch_anuales_summary_v2(db, base_filters)
            cache_set("anuales-v2/summary", base_filters, anuales_summary, ttl_seconds=300)
            anuales_fp = AnalyticsService.fetch_anuales_first_paint_v2(db, base_filters)
            cache_set("anuales-v2/first-paint", base_filters, anuales_fp, ttl_seconds=180)
        if domain in {"cobranzas", "cartera"}:
            cohorte_options_filters = CobranzasCohorteIn()
            cohorte_options = AnalyticsService.fetch_cobranzas_cohorte_options_v1(db, cohorte_options_filters)
            cache_set("cobranzas-cohorte/options", cohorte_options_filters, cohorte_options, ttl_seconds=1800)
            cache_set("cobranzas-cohorte-v2/options", cohorte_options_filters, cohorte_options, ttl_seconds=1800)
            cohorte_fp_filters = CobranzasCohorteFirstPaintIn()
            cohorte_fp = AnalyticsService.fetch_cobranzas_cohorte_first_paint_v2(db, cohorte_fp_filters)
            cache_set("cobranzas-cohorte-v2/first-paint", cohorte_fp_filters, cohorte_fp, ttl_seconds=300)
        append_log(domain, "Cache prewarm completado (best-effort)")
    except Exception as exc:
        append_log(domain, f"Cache prewarm omitido: {exc}")
