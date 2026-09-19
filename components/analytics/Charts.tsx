"use client";

import { cn } from "@/lib/utils";

export type ChartDatum = {
  key: string;
  label: string;
  value: number;
  colorClass?: string;
};

type SimpleBarChartProps = {
  data: ChartDatum[];
  ariaLabel: string;
  summary: string;
  className?: string;
  heightClass?: string;
  valueFormatter?: (value: number) => string;
  emptyMessage?: string;
  compact?: boolean;
};

export function SimpleBarChart({
  data,
  ariaLabel,
  summary,
  className,
  heightClass,
  valueFormatter = (value) => String(value),
  emptyMessage = "No data for this period.",
  compact = false,
}: SimpleBarChartProps) {
  const max = Math.max(0, ...data.map((item) => item.value));
  const hasData = data.some((item) => item.value > 0);
  const chartHeight = compact ? "h-28" : (heightClass ?? "h-36");

  if (!hasData) {
    return (
      <div
        className={cn(
          "text-muted-foreground flex items-center justify-center text-xs",
          chartHeight,
          className,
        )}
        role="img"
        aria-label={ariaLabel}
      >
        {emptyMessage}
      </div>
    );
  }

  const width = 640;
  const height = compact ? 120 : 160;
  const padding = {
    top: 8,
    right: 8,
    bottom: compact ? 22 : 28,
    left: compact ? 28 : 32,
  };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const barGap = Math.min(6, plotWidth / Math.max(data.length, 1) / 5);
  const barWidth = Math.max(
    3,
    (plotWidth - barGap * (data.length - 1)) / data.length,
  );

  return (
    <div className={cn("w-full", className)}>
      <p className="sr-only">{summary}</p>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className={cn("text-foreground w-full", chartHeight)}
        role="img"
        aria-label={ariaLabel}
      >
        <title>{ariaLabel}</title>
        <desc>{summary}</desc>
        {[0.5, 1].map((fraction) => {
          const y = padding.top + plotHeight * (1 - fraction);
          return (
            <line
              key={fraction}
              x1={padding.left}
              x2={width - padding.right}
              y1={y}
              y2={y}
              className="stroke-border/70"
              strokeWidth={1}
            />
          );
        })}
        {data.map((item, index) => {
          const barHeight = max === 0 ? 0 : (item.value / max) * plotHeight;
          const x = padding.left + index * (barWidth + barGap);
          const y = padding.top + plotHeight - barHeight;
          const showLabel =
            data.length <= 10 || index % Math.ceil(data.length / 6) === 0;
          return (
            <g key={item.key}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(barHeight, item.value > 0 ? 2 : 0)}
                className={item.colorClass ?? "fill-primary"}
                rx={2}
              >
                <title>{`${item.label}: ${valueFormatter(item.value)}`}</title>
              </rect>
              {showLabel ? (
                <text
                  x={x + barWidth / 2}
                  y={height - 6}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[9px]"
                >
                  {item.label.length > 6 ? item.label.slice(-5) : item.label}
                </text>
              ) : null}
            </g>
          );
        })}
        <text
          x={4}
          y={padding.top + 8}
          className="fill-muted-foreground text-[9px]"
        >
          {valueFormatter(max)}
        </text>
      </svg>
    </div>
  );
}

type SimpleLineChartProps = {
  data: ChartDatum[];
  ariaLabel: string;
  summary: string;
  className?: string;
  valueFormatter?: (value: number) => string;
  emptyMessage?: string;
  compact?: boolean;
};

export function SimpleLineChart({
  data,
  ariaLabel,
  summary,
  className,
  valueFormatter = (value) => String(value),
  emptyMessage = "No data for this period.",
  compact = false,
}: SimpleLineChartProps) {
  const values = data.map((item) => item.value);
  const max = Math.max(0, ...values);
  const hasData = values.some((value) => value > 0);
  const chartHeight = compact ? "h-28" : "h-36";

  if (!hasData) {
    return (
      <div
        className={cn(
          "text-muted-foreground flex items-center justify-center text-xs",
          chartHeight,
          className,
        )}
        role="img"
        aria-label={ariaLabel}
      >
        {emptyMessage}
      </div>
    );
  }

  const width = 640;
  const height = compact ? 120 : 160;
  const padding = { top: 10, right: 10, bottom: 24, left: 30 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const points = data.map((item, index) => {
    const x =
      padding.left +
      (data.length === 1
        ? plotWidth / 2
        : (index / (data.length - 1)) * plotWidth);
    const y =
      padding.top +
      (max === 0 ? plotHeight : plotHeight * (1 - item.value / max));
    return { x, y, item };
  });

  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1]!.x} ${padding.top + plotHeight} L ${points[0]!.x} ${padding.top + plotHeight} Z`;

  return (
    <div className={cn("w-full", className)}>
      <p className="sr-only">{summary}</p>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className={cn("text-foreground w-full", chartHeight)}
        role="img"
        aria-label={ariaLabel}
      >
        <title>{ariaLabel}</title>
        <desc>{summary}</desc>
        <defs>
          <linearGradient id="lineFill" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor="currentColor"
              className="text-primary"
              stopOpacity="0.22"
            />
            <stop
              offset="100%"
              stopColor="currentColor"
              className="text-primary"
              stopOpacity="0.02"
            />
          </linearGradient>
        </defs>
        {[0.5, 1].map((fraction) => {
          const y = padding.top + plotHeight * (1 - fraction);
          return (
            <line
              key={fraction}
              x1={padding.left}
              x2={width - padding.right}
              y1={y}
              y2={y}
              className="stroke-border/70"
              strokeWidth={1}
            />
          );
        })}
        <path d={areaPath} fill="url(#lineFill)" className="text-primary" />
        <path
          d={linePath}
          className="stroke-primary fill-none"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points.map((point) => (
          <circle
            key={point.item.key}
            cx={point.x}
            cy={point.y}
            r={2.5}
            className="fill-primary"
          >
            <title>{`${point.item.label}: ${valueFormatter(point.item.value)}`}</title>
          </circle>
        ))}
      </svg>
    </div>
  );
}

type DonutChartProps = {
  data: ChartDatum[];
  ariaLabel: string;
  summary: string;
  centerLabel?: string;
  centerValue?: string;
  className?: string;
  size?: number;
};

const DONUT_COLORS = [
  "stroke-primary",
  "stroke-chart-2",
  "stroke-chart-3",
  "stroke-chart-4",
  "stroke-chart-5",
  "stroke-muted-foreground",
  "stroke-destructive/80",
];

export function DonutChart({
  data,
  ariaLabel,
  summary,
  centerLabel,
  centerValue,
  className,
  size = 128,
}: DonutChartProps) {
  const total = data.reduce((sum, item) => sum + Math.max(0, item.value), 0);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;

  if (total <= 0) {
    return (
      <div
        className={cn(
          "text-muted-foreground flex items-center justify-center text-xs",
          className,
        )}
        style={{ width: size, height: size }}
        role="img"
        aria-label={ariaLabel}
      >
        No data
      </div>
    );
  }

  const segments = data
    .filter((item) => item.value > 0)
    .reduce<
      Array<ChartDatum & { length: number; dashOffset: number; index: number }>
    >((acc, item, index) => {
      const length = (item.value / total) * circumference;
      const dashOffset = acc.reduce((sum, segment) => sum + segment.length, 0);
      acc.push({ ...item, length, dashOffset, index });
      return acc;
    }, []);

  return (
    <div className={cn("relative shrink-0", className)} style={{ width: size, height: size }}>
      <p className="sr-only">{summary}</p>
      <svg
        viewBox="0 0 100 100"
        className="size-full -rotate-90"
        role="img"
        aria-label={ariaLabel}
      >
        <title>{ariaLabel}</title>
        <desc>{summary}</desc>
        <circle
          cx="50"
          cy="50"
          r={radius}
          className="stroke-muted fill-none"
          strokeWidth="12"
        />
        {segments.map((item) => (
          <circle
            key={item.key}
            cx="50"
            cy="50"
            r={radius}
            className={cn(
              "fill-none",
              item.colorClass ?? DONUT_COLORS[item.index % DONUT_COLORS.length],
            )}
            strokeWidth="12"
            strokeDasharray={`${item.length} ${circumference - item.length}`}
            strokeDashoffset={-item.dashOffset}
            strokeLinecap="butt"
          >
            <title>{`${item.label}: ${item.value}`}</title>
          </circle>
        ))}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        {centerValue ? (
          <span className="text-lg leading-none font-semibold tracking-tight">
            {centerValue}
          </span>
        ) : null}
        {centerLabel ? (
          <span className="text-muted-foreground mt-0.5 text-[10px]">
            {centerLabel}
          </span>
        ) : null}
      </div>
    </div>
  );
}

type SegmentBarProps = {
  data: ChartDatum[];
  ariaLabel: string;
  className?: string;
};

export function SegmentBar({ data, ariaLabel, className }: SegmentBarProps) {
  const total = data.reduce((sum, item) => sum + Math.max(0, item.value), 0);

  if (total <= 0) {
    return (
      <div
        className={cn("bg-muted h-2.5 w-full rounded-full", className)}
        role="img"
        aria-label={ariaLabel}
      />
    );
  }

  return (
    <div
      className={cn(
        "bg-muted flex h-2.5 w-full overflow-hidden rounded-full",
        className,
      )}
      role="img"
      aria-label={ariaLabel}
    >
      {data.map((item, index) => {
        if (item.value <= 0) return null;
        const width = (item.value / total) * 100;
        return (
          <div
            key={item.key}
            title={`${item.label}: ${item.value}`}
            className={cn(
              "h-full",
              item.colorClass ??
                [
                  "bg-primary",
                  "bg-chart-2",
                  "bg-chart-3",
                  "bg-chart-4",
                  "bg-chart-5",
                  "bg-muted-foreground",
                ][index % 6],
            )}
            style={{ width: `${width}%` }}
          />
        );
      })}
    </div>
  );
}

type HorizontalMeterProps = {
  label: string;
  value: number;
  max: number;
  display?: string;
  className?: string;
};

export function HorizontalMeter({
  label,
  value,
  max,
  display,
  className,
}: HorizontalMeterProps) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="text-muted-foreground truncate">{label}</span>
        <span className="font-medium tabular-nums">
          {display ?? String(value)}
        </span>
      </div>
      <div className="bg-muted h-1.5 overflow-hidden rounded-full">
        <div
          className="bg-primary h-full rounded-full transition-[width]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
