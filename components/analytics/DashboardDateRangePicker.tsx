"use client";

import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  DASHBOARD_DATE_PRESETS,
  type DashboardDatePreset,
} from "@/lib/analytics/date-range";

const PRESET_OPTIONS: { value: DashboardDatePreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last_7_days", label: "Last 7 days" },
  { value: "last_30_days", label: "Last 30 days" },
  { value: "custom", label: "Custom range" },
];

type DashboardDateRangePickerProps = {
  preset: DashboardDatePreset;
  startDate?: string;
  endDate?: string;
  onPresetChange: (preset: DashboardDatePreset) => void;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  disabled?: boolean;
};

export function DashboardDateRangePicker({
  preset,
  startDate = "",
  endDate = "",
  onPresetChange,
  onStartDateChange,
  onEndDateChange,
  disabled = false,
}: DashboardDateRangePickerProps) {
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-end sm:gap-2">
      <div className="min-w-[9.5rem] flex-1 sm:flex-none">
        <label
          htmlFor="dashboard-date-preset"
          className="text-muted-foreground mb-0.5 block text-[11px] font-medium"
        >
          Date range
        </label>
        <Select
          id="dashboard-date-preset"
          value={preset}
          disabled={disabled}
          className="h-7"
          onChange={(event) => {
            const value = event.target.value as DashboardDatePreset;
            if ((DASHBOARD_DATE_PRESETS as readonly string[]).includes(value)) {
              onPresetChange(value);
            }
          }}
          aria-label="Dashboard date range preset"
        >
          {PRESET_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>

      {preset === "custom" ? (
        <>
          <div className="min-w-[8.5rem] flex-1 sm:flex-none">
            <label
              htmlFor="dashboard-start-date"
              className="text-muted-foreground mb-0.5 block text-[11px] font-medium"
            >
              Start
            </label>
            <Input
              id="dashboard-start-date"
              type="date"
              value={startDate}
              disabled={disabled}
              className="h-7"
              onChange={(event) => onStartDateChange(event.target.value)}
              aria-label="Custom range start date"
            />
          </div>
          <div className="min-w-[8.5rem] flex-1 sm:flex-none">
            <label
              htmlFor="dashboard-end-date"
              className="text-muted-foreground mb-0.5 block text-[11px] font-medium"
            >
              End
            </label>
            <Input
              id="dashboard-end-date"
              type="date"
              value={endDate}
              disabled={disabled}
              className="h-7"
              onChange={(event) => onEndDateChange(event.target.value)}
              aria-label="Custom range end date"
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
