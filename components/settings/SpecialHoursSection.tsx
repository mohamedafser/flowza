"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarOff } from "lucide-react";
import { toast } from "sonner";
import {
  createSpecialHoursRequest,
  deleteSpecialHoursRequest,
  updateSpecialHoursRequest,
} from "@/lib/api/hours-client";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  formatDisplayDate,
  type DateFormat,
  type TimeFormat,
} from "@/lib/utils/datetime";
import { formatPeriodRange, type SpecialHoursEntry } from "@/lib/utils/hours";

type SpecialHoursSectionProps = {
  restaurantId: string;
  branchId: string | null;
  entries: Array<SpecialHoursEntry & { id: string }>;
  inheritedEntries: Array<SpecialHoursEntry & { id: string }>;
  timeFormat: TimeFormat;
  dateFormat: string;
  canManage: boolean;
};

type Draft = {
  id?: string;
  date: string;
  isClosed: boolean;
  openTime: string;
  closeTime: string;
  reason: string;
};

const emptyDraft = (): Draft => ({
  date: "",
  isClosed: true,
  openTime: "12:00",
  closeTime: "20:00",
  reason: "",
});

function isDateFormatValue(value: string): value is DateFormat {
  return (
    value === "DD/MM/YYYY" || value === "MM/DD/YYYY" || value === "YYYY-MM-DD"
  );
}

export function SpecialHoursSection({
  restaurantId,
  branchId,
  entries,
  inheritedEntries,
  timeFormat,
  dateFormat,
  canManage,
}: SpecialHoursSectionProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const resolvedDateFormat: DateFormat = isDateFormatValue(dateFormat)
    ? dateFormat
    : "DD/MM/YYYY";

  const existingDates = useMemo(
    () => new Set(entries.map((entry) => entry.date)),
    [entries],
  );

  const inheritedVisible = inheritedEntries.filter(
    (entry) => !existingDates.has(entry.date),
  );

  const save = () => {
    if (!canManage) return;
    if (draft.id == null && existingDates.has(draft.date)) {
      toast.error("A special date already exists for this location.");
      return;
    }

    const payload = {
      date: draft.date,
      isClosed: draft.isClosed,
      openTime: draft.isClosed ? null : draft.openTime,
      closeTime: draft.isClosed ? null : draft.closeTime,
      reason: draft.reason.trim() === "" ? null : draft.reason.trim(),
      branchId,
    };

    startTransition(async () => {
      const result = draft.id
        ? await updateSpecialHoursRequest(restaurantId, draft.id, payload)
        : await createSpecialHoursRequest(restaurantId, payload);

      if (!result.ok) {
        toast.error(result.message ?? "Unable to save special hours.");
        return;
      }

      toast.success(
        draft.id ? "Special hours updated." : "Special date added.",
      );
      setOpen(false);
      setDraft(emptyDraft());
      router.refresh();
    });
  };

  const remove = () => {
    if (!deleteId) return;
    startTransition(async () => {
      const result = await deleteSpecialHoursRequest(restaurantId, deleteId);
      if (!result.ok) {
        toast.error(result.message ?? "Unable to delete special hours.");
        return;
      }
      toast.success("Special date removed.");
      setDeleteId(null);
      router.refresh();
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Special dates</CardTitle>
            <CardDescription>
              Holidays, private events, and one-off closures or shortened hours.
            </CardDescription>
          </div>
          {canManage ? (
            <Button
              type="button"
              onClick={() => {
                setDraft(emptyDraft());
                setOpen(true);
              }}
            >
              Add special date
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {entries.length === 0 ? (
          <EmptyState
            icon={<CalendarOff className="size-8" />}
            title="No special dates"
            description="Add holidays or one-off hours that override the weekly schedule."
          />
        ) : (
          <ul className="divide-y rounded-xl border">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    {formatDisplayDate(entry.date, resolvedDateFormat)}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {entry.isClosed
                      ? "Closed"
                      : formatPeriodRange(
                          {
                            openTime: entry.openTime ?? "00:00",
                            closeTime: entry.closeTime ?? "00:00",
                          },
                          timeFormat,
                        )}
                    {entry.reason ? ` — ${entry.reason}` : ""}
                  </p>
                </div>
                {canManage ? (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setDraft({
                          id: entry.id,
                          date: entry.date,
                          isClosed: entry.isClosed,
                          openTime: entry.openTime ?? "12:00",
                          closeTime: entry.closeTime ?? "20:00",
                          reason: entry.reason ?? "",
                        });
                        setOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => setDeleteId(entry.id)}
                    >
                      Delete
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {inheritedVisible.length > 0 ? (
          <Alert title="Restaurant special dates also apply">
            <ul className="mt-2 space-y-1">
              {inheritedVisible.map((entry) => (
                <li
                  key={entry.id}
                  className="flex flex-wrap items-center gap-2"
                >
                  <span>
                    {formatDisplayDate(entry.date, resolvedDateFormat)}
                  </span>
                  <Badge variant="secondary">
                    {entry.isClosed ? "Closed" : "Open"}
                  </Badge>
                  {entry.reason ? (
                    <span className="text-muted-foreground">
                      {entry.reason}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </Alert>
        ) : null}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {draft.id ? "Edit special date" : "Add special date"}
            </DialogTitle>
            <DialogDescription>
              Overrides the weekly schedule for a single calendar date.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="special-date">Date</Label>
              <Input
                id="special-date"
                type="date"
                value={draft.date}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    date: event.target.value,
                  }))
                }
              />
            </div>
            <label className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium">Closed all day</span>
              <Switch
                checked={draft.isClosed}
                onCheckedChange={(checked) =>
                  setDraft((current) => ({ ...current, isClosed: checked }))
                }
              />
            </label>
            {draft.isClosed ? null : (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="special-open">Opens</Label>
                  <Input
                    id="special-open"
                    type="time"
                    value={draft.openTime}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        openTime: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="special-close">Closes</Label>
                  <Input
                    id="special-close"
                    type="time"
                    value={draft.closeTime}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        closeTime: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="special-reason">Reason</Label>
              <Input
                id="special-reason"
                maxLength={200}
                placeholder="Christmas, private event…"
                value={draft.reason}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    reason: event.target.value,
                  }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={save}
              disabled={pending || !draft.date}
            >
              {pending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteId)}
        onOpenChange={(next) => {
          if (!next) setDeleteId(null);
        }}
        title="Delete special date?"
        description="This date will fall back to the weekly operating hours."
        confirmLabel="Delete"
        destructive
        loading={pending}
        onConfirm={remove}
      />
    </Card>
  );
}
