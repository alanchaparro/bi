"use client";

import { I18nProvider } from "@react-aria/i18n";
import { CalendarDate, Time } from "@internationalized/date";
import { DateField, TimeField } from "@heroui/react";
import { formatAnalyticsTimestampForDisplay } from "@/shared/formatters";

function parseFreshnessToLocalParts(iso: string): { date: CalendarDate; time: Time } | null {
  const raw = String(iso).trim();
  const normalized = /[zZ]|[+\-]\d{2}:?\d{2}$/.test(raw) ? raw : `${raw}Z`;
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return null;
  return {
    date: new CalendarDate(d.getFullYear(), d.getMonth() + 1, d.getDate()),
    time: new Time(d.getHours(), d.getMinutes(), d.getSeconds()),
  };
}

type Props = {
  dataFreshnessAt: string;
  /** Tooltip con ISO original (API). */
  title?: string;
  className?: string;
};

/**
 * Muestra `data_freshness_at` con el aspecto de campos HeroUI (DateField + TimeField), solo lectura.
 * @see https://heroui.com/docs/react/components/time-field
 */
export function AnalyticsDataFreshnessHero({ dataFreshnessAt, title, className = "" }: Props) {
  const parts = parseFreshnessToLocalParts(dataFreshnessAt);
  const fallback = formatAnalyticsTimestampForDisplay(dataFreshnessAt);

  if (!parts) {
    return (
      <span className={className} title={title}>
        Actualizado: {fallback || dataFreshnessAt}
      </span>
    );
  }

  const groupClass =
    "analytics-freshness-field-group min-h-[22px] max-h-[22px] text-[0.62rem] leading-tight sm:min-h-[24px] sm:max-h-[24px] sm:text-[0.65rem]";

  return (
    <I18nProvider locale="es-PY">
      <span className={`inline-flex max-w-full flex-wrap items-center gap-x-1 gap-y-0.5 align-middle ${className}`.trim()}>
        <span className="shrink-0 text-[var(--color-text-muted)]">Actualizado:</span>
        <DateField
          value={parts.date}
          isReadOnly
          granularity="day"
          aria-label="Fecha de actualización de datos"
        >
          <DateField.Group variant="secondary" className={groupClass}>
            <DateField.Input>
              {(segment) => <DateField.Segment segment={segment} />}
            </DateField.Input>
          </DateField.Group>
        </DateField>
        <TimeField
          value={parts.time}
          isReadOnly
          granularity="second"
          aria-label="Hora de actualización de datos"
        >
          <TimeField.Group variant="secondary" className={groupClass}>
            <TimeField.Input>
              {(segment) => <TimeField.Segment segment={segment} />}
            </TimeField.Input>
          </TimeField.Group>
        </TimeField>
      </span>
    </I18nProvider>
  );
}
