"use client";

import { useMemo, useState } from "react";
import { StatusBadge } from "@/components/common/StatusBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { Select } from "@/components/ui/select";
import {
  actualWaitMinutes,
  formatActualWaitMinutes,
  isHistoryEntry,
  queueEntryStatusLabel,
  queueEntryStatusTone,
} from "@/lib/utils/queue";
import {
  formatDate,
  formatTime,
  type DateFormat,
  type TimeFormat,
} from "@/lib/utils/datetime";
import {
  QUEUE_HISTORY_STATUSES,
  QUEUE_ENTRY_STATUS_LABELS,
  type QueueEntryStatus,
} from "@/lib/validations/queue";
import type { QueueEntryView } from "@/services/queues";

type QueueHistoryProps = {
  entries: QueueEntryView[];
  timezone: string;
  dateFormat: DateFormat;
  timeFormat: TimeFormat;
  onSelect: (entry: QueueEntryView) => void;
};

function stamp(
  value: string | null,
  timezone: string,
  dateFormat: DateFormat,
  timeFormat: TimeFormat,
): string {
  if (!value) return "—";
  const instant = new Date(value);
  return `${formatDate(instant, dateFormat, timezone)} ${formatTime(instant, timeFormat, timezone)}`;
}

export function QueueHistory({
  entries,
  timezone,
  dateFormat,
  timeFormat,
  onSelect,
}: QueueHistoryProps) {
  const [status, setStatus] = useState<QueueEntryStatus | "all">("all");
  const rows = useMemo(() => {
    return entries
      .filter(
        (entry) =>
          isHistoryEntry(entry.status) ||
          entry.status === "SEATED" ||
          entry.status === "CALLED",
      )
      .filter((entry) =>
        status === "all"
          ? isHistoryEntry(entry.status)
          : entry.status === status,
      )
      .slice()
      .sort((a, b) => b.joined_at.localeCompare(a.joined_at));
  }, [entries, status]);

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-medium">Queue history</h2>
        <Select
          value={status}
          onChange={(event) =>
            setStatus((event.target.value as QueueEntryStatus | "all") ?? "all")
          }
          aria-label="Filter history by status"
          className="w-full sm:max-w-48"
        >
          <option value="all">Processed today</option>
          {QUEUE_HISTORY_STATUSES.map((value) => (
            <option key={value} value={value}>
              {QUEUE_ENTRY_STATUS_LABELS[value]}
            </option>
          ))}
        </Select>
      </div>
      {rows.length === 0 ? (
        <EmptyState
          title="No processed guests yet"
          description="Completed, skipped, cancelled, and no-show visits for this business date will appear here."
        />
      ) : (
        <>
          <div className="border-border hidden overflow-x-auto rounded-xl border md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Token</th>
                  <th className="px-3 py-2 font-medium">Customer</th>
                  <th className="px-3 py-2 font-medium">Party</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Wait</th>
                  <th className="px-3 py-2 font-medium">Joined</th>
                  <th className="px-3 py-2 font-medium">Called</th>
                  <th className="px-3 py-2 font-medium">Seated</th>
                  <th className="px-3 py-2 font-medium">Completed</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((entry) => (
                  <tr
                    key={entry.id}
                    className="border-border hover:bg-muted/40 cursor-pointer border-t"
                    onClick={() => onSelect(entry)}
                  >
                    <td className="px-3 py-2 font-mono font-medium">
                      {entry.token}
                    </td>
                    <td className="px-3 py-2">
                      {entry.customer?.name ?? "Guest"}
                    </td>
                    <td className="px-3 py-2">{entry.party_size}</td>
                    <td className="px-3 py-2">
                      <StatusBadge
                        label={queueEntryStatusLabel(entry.status)}
                        tone={queueEntryStatusTone(entry.status)}
                      />
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {formatActualWaitMinutes(actualWaitMinutes(entry))}
                    </td>
                    <td className="px-3 py-2">
                      {stamp(entry.joined_at, timezone, dateFormat, timeFormat)}
                    </td>
                    <td className="px-3 py-2">
                      {stamp(entry.called_at, timezone, dateFormat, timeFormat)}
                    </td>
                    <td className="px-3 py-2">
                      {stamp(entry.seated_at, timezone, dateFormat, timeFormat)}
                    </td>
                    <td className="px-3 py-2">
                      {stamp(
                        entry.completed_at,
                        timezone,
                        dateFormat,
                        timeFormat,
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-3 md:hidden">
            {rows.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className="border-border bg-card w-full rounded-xl border p-4 text-left"
                onClick={() => onSelect(entry)}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-lg font-semibold">
                    {entry.token}
                  </span>
                  <StatusBadge
                    label={queueEntryStatusLabel(entry.status)}
                    tone={queueEntryStatusTone(entry.status)}
                  />
                </div>
                <p className="mt-1 text-sm">
                  {entry.customer?.name ?? "Guest"} · party {entry.party_size}
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  Wait {formatActualWaitMinutes(actualWaitMinutes(entry))} ·
                  Joined{" "}
                  {stamp(entry.joined_at, timezone, dateFormat, timeFormat)}
                </p>
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
