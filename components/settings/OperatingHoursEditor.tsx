"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  clearBranchHoursRequest,
  updateBranchHoursRequest,
  updateRestaurantHoursRequest,
} from "@/lib/api/hours-client";
import { SpecialHoursSection } from "@/components/settings/SpecialHoursSection";
import { SettingsFormActions } from "@/components/settings/SettingsFormActions";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import type { TimeFormat } from "@/lib/utils/datetime";
import {
  WEEKDAYS,
  copyMondayToOtherDays,
  defaultWeekSchedule,
  emptyWeekSchedule,
  formatDayHours,
  validateWeekSchedule,
  type OperatingPeriod,
  type SpecialHoursEntry,
  type WeekSchedule,
} from "@/lib/utils/hours";
import type { Branch } from "@/lib/context/restaurant";

type OperatingHoursEditorProps = {
  restaurantId: string;
  branches: Branch[];
  restaurantHours: WeekSchedule;
  restaurantConfigured: boolean;
  branchHours: Record<string, WeekSchedule>;
  restaurantSpecialHours: Array<SpecialHoursEntry & { id: string }>;
  branchSpecialHours: Record<string, Array<SpecialHoursEntry & { id: string }>>;
  timeFormat: TimeFormat;
  dateFormat: string;
  canManage: boolean;
  initialBranchId?: string | null;
};

function cloneWeek(week: WeekSchedule): WeekSchedule {
  return week.map((day) => ({
    ...day,
    periods: day.periods.map((period) => ({ ...period })),
  }));
}

function weeksEqual(left: WeekSchedule, right: WeekSchedule): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function OperatingHoursEditor({
  restaurantId,
  branches,
  restaurantHours,
  restaurantConfigured,
  branchHours,
  restaurantSpecialHours,
  branchSpecialHours,
  timeFormat,
  dateFormat,
  canManage,
  initialBranchId = null,
}: OperatingHoursEditorProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [scope, setScope] = useState<string>(
    initialBranchId && branches.some((branch) => branch.id === initialBranchId)
      ? initialBranchId
      : "restaurant",
  );
  const [customizing, setCustomizing] = useState(false);

  const branchOverride = scope !== "restaurant" && Boolean(branchHours[scope]);
  const usingRestaurantHours =
    scope !== "restaurant" && !branchOverride && !customizing;

  const savedDays = useMemo(() => {
    if (scope === "restaurant") {
      return restaurantConfigured
        ? cloneWeek(restaurantHours)
        : emptyWeekSchedule();
    }
    if (branchHours[scope]) {
      return cloneWeek(branchHours[scope]!);
    }
    return restaurantConfigured
      ? cloneWeek(restaurantHours)
      : emptyWeekSchedule();
  }, [scope, restaurantHours, restaurantConfigured, branchHours]);

  const [days, setDays] = useState<WeekSchedule>(savedDays);
  const [savedSnapshot, setSavedSnapshot] = useState(savedDays);

  const switchScope = (next: string) => {
    setScope(next);
    setCustomizing(false);
    const nextDays =
      next === "restaurant"
        ? restaurantConfigured
          ? cloneWeek(restaurantHours)
          : emptyWeekSchedule()
        : branchHours[next]
          ? cloneWeek(branchHours[next]!)
          : restaurantConfigured
            ? cloneWeek(restaurantHours)
            : emptyWeekSchedule();
    setDays(nextDays);
    setSavedSnapshot(nextDays);
  };

  const dirty = !usingRestaurantHours && !weeksEqual(days, savedSnapshot);
  useUnsavedChanges(dirty && canManage);

  const updateDay = (
    dayOfWeek: number,
    patch: Partial<WeekSchedule[number]>,
  ) => {
    setDays((current) =>
      current.map((day) =>
        day.dayOfWeek === dayOfWeek ? { ...day, ...patch } : day,
      ),
    );
  };

  const setClosed = (dayOfWeek: number, closed: boolean) => {
    updateDay(dayOfWeek, {
      isClosed: closed,
      periods: closed
        ? []
        : [{ openTime: "11:00", closeTime: "23:00", sortOrder: 0 }],
    });
  };

  const addPeriod = (dayOfWeek: number) => {
    setDays((current) =>
      current.map((day) => {
        if (day.dayOfWeek !== dayOfWeek || day.isClosed) return day;
        const last = day.periods[day.periods.length - 1];
        const next: OperatingPeriod = last
          ? {
              openTime: last.closeTime,
              closeTime: "23:00",
              sortOrder: day.periods.length,
            }
          : { openTime: "11:00", closeTime: "23:00", sortOrder: 0 };
        return { ...day, periods: [...day.periods, next] };
      }),
    );
  };

  const removePeriod = (dayOfWeek: number, index: number) => {
    setDays((current) =>
      current.map((day) => {
        if (day.dayOfWeek !== dayOfWeek) return day;
        const periods = day.periods.filter(
          (_, itemIndex) => itemIndex !== index,
        );
        return {
          ...day,
          periods,
          isClosed: periods.length === 0 ? true : day.isClosed,
        };
      }),
    );
  };

  const updatePeriod = (
    dayOfWeek: number,
    index: number,
    patch: Partial<OperatingPeriod>,
  ) => {
    setDays((current) =>
      current.map((day) => {
        if (day.dayOfWeek !== dayOfWeek) return day;
        return {
          ...day,
          periods: day.periods.map((period, itemIndex) =>
            itemIndex === index ? { ...period, ...patch } : period,
          ),
        };
      }),
    );
  };

  const save = () => {
    if (!canManage) return;
    const error = validateWeekSchedule(days);
    if (error) {
      toast.error(error);
      return;
    }

    startTransition(async () => {
      const result =
        scope === "restaurant"
          ? await updateRestaurantHoursRequest(restaurantId, days)
          : await updateBranchHoursRequest(scope, days);

      if (!result.ok) {
        toast.error(result.message ?? "Unable to save operating hours.");
        return;
      }

      toast.success(
        scope === "restaurant"
          ? "Restaurant hours updated."
          : "Branch hours updated.",
      );
      setSavedSnapshot(cloneWeek(days));
      setCustomizing(false);
      router.refresh();
    });
  };

  const restoreRestaurantHours = () => {
    if (scope === "restaurant") return;
    startTransition(async () => {
      const result = await clearBranchHoursRequest(scope);
      if (!result.ok) {
        toast.error(result.message ?? "Unable to restore restaurant hours.");
        return;
      }
      toast.success("Now using restaurant hours.");
      setCustomizing(false);
      const next = restaurantConfigured
        ? cloneWeek(restaurantHours)
        : emptyWeekSchedule();
      setDays(next);
      setSavedSnapshot(next);
      router.refresh();
    });
  };

  const disabled = !canManage || pending || usingRestaurantHours;
  const specialEntries =
    scope === "restaurant"
      ? restaurantSpecialHours
      : (branchSpecialHours[scope] ?? []);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Weekly schedule</CardTitle>
          <CardDescription>
            Restaurant hours are the default. Branches can override them when a
            location keeps different times.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              save();
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="hours-scope">Location</Label>
                <Select
                  id="hours-scope"
                  value={scope}
                  onChange={(event) => switchScope(event.target.value)}
                >
                  <option value="restaurant">Restaurant defaults</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                {scope === "restaurant" ? (
                  <Badge variant="secondary">Restaurant defaults</Badge>
                ) : usingRestaurantHours ? (
                  <Badge variant="secondary">Using restaurant hours</Badge>
                ) : (
                  <Badge>Custom branch hours</Badge>
                )}
              </div>
            </div>

            {usingRestaurantHours ? (
              <Alert>
                This branch uses restaurant default hours. Customize to keep a
                different schedule, or leave it as-is.
              </Alert>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {scope !== "restaurant" && usingRestaurantHours && canManage ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setCustomizing(true);
                    setDays(
                      restaurantConfigured
                        ? cloneWeek(restaurantHours)
                        : defaultWeekSchedule(),
                    );
                  }}
                >
                  Customize hours
                </Button>
              ) : null}
              {scope !== "restaurant" && !usingRestaurantHours && canManage ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={restoreRestaurantHours}
                >
                  Use restaurant hours
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                disabled={disabled}
                onClick={() => setDays(copyMondayToOtherDays(days))}
              >
                Copy Monday to other days
              </Button>
              {scope === "restaurant" ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={disabled}
                  onClick={() => setDays(defaultWeekSchedule())}
                >
                  Restore defaults
                </Button>
              ) : null}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[36rem] text-left text-sm">
                <thead>
                  <tr className="text-muted-foreground border-b">
                    <th className="py-2 pr-3 font-medium">Day</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 font-medium">Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {days.map((day) => (
                    <tr key={day.dayOfWeek} className="border-b align-top">
                      <td className="py-3 pr-3 font-medium">
                        {WEEKDAYS[day.dayOfWeek - 1]?.name}
                      </td>
                      <td className="py-3 pr-3">
                        <label className="flex items-center gap-2">
                          <Switch
                            checked={!day.isClosed}
                            disabled={disabled}
                            onCheckedChange={(checked) =>
                              setClosed(day.dayOfWeek, !checked)
                            }
                          />
                          <span>{day.isClosed ? "Closed" : "Open"}</span>
                        </label>
                      </td>
                      <td className="py-3">
                        <DayPeriods
                          day={day}
                          disabled={disabled}
                          timeFormat={timeFormat}
                          onAdd={() => addPeriod(day.dayOfWeek)}
                          onRemove={(index) =>
                            removePeriod(day.dayOfWeek, index)
                          }
                          onChange={(index, patch) =>
                            updatePeriod(day.dayOfWeek, index, patch)
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 md:hidden">
              {days.map((day) => (
                <div
                  key={day.dayOfWeek}
                  className="border-border rounded-xl border p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">
                      {WEEKDAYS[day.dayOfWeek - 1]?.name}
                    </p>
                    <label className="flex items-center gap-2 text-sm">
                      <Switch
                        checked={!day.isClosed}
                        disabled={disabled}
                        onCheckedChange={(checked) =>
                          setClosed(day.dayOfWeek, !checked)
                        }
                      />
                      {day.isClosed ? "Closed" : "Open"}
                    </label>
                  </div>
                  <div className="mt-3">
                    <DayPeriods
                      day={day}
                      disabled={disabled}
                      timeFormat={timeFormat}
                      onAdd={() => addPeriod(day.dayOfWeek)}
                      onRemove={(index) => removePeriod(day.dayOfWeek, index)}
                      onChange={(index, patch) =>
                        updatePeriod(day.dayOfWeek, index, patch)
                      }
                    />
                  </div>
                </div>
              ))}
            </div>

            <SettingsFormActions
              dirty={dirty}
              pending={pending}
              canManage={canManage}
              onCancel={() => setDays(cloneWeek(savedSnapshot))}
            />
          </form>
        </CardContent>
      </Card>

      <SpecialHoursSection
        restaurantId={restaurantId}
        branchId={scope === "restaurant" ? null : scope}
        entries={specialEntries}
        inheritedEntries={scope === "restaurant" ? [] : restaurantSpecialHours}
        timeFormat={timeFormat}
        dateFormat={dateFormat}
        canManage={canManage}
      />
    </div>
  );
}

function DayPeriods({
  day,
  disabled,
  timeFormat,
  onAdd,
  onRemove,
  onChange,
}: {
  day: WeekSchedule[number];
  disabled: boolean;
  timeFormat: TimeFormat;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onChange: (index: number, patch: Partial<OperatingPeriod>) => void;
}) {
  if (day.isClosed) {
    return <p className="text-muted-foreground">—</p>;
  }

  return (
    <div className="space-y-2">
      {day.periods.map((period, index) => (
        <div
          key={`${day.dayOfWeek}-${index}`}
          className="flex flex-wrap items-center gap-2"
        >
          <Input
            type="time"
            value={period.openTime}
            disabled={disabled}
            onChange={(event) =>
              onChange(index, { openTime: event.target.value })
            }
            className="w-[8.5rem]"
            aria-label="Opening time"
          />
          <span className="text-muted-foreground">→</span>
          <Input
            type="time"
            value={period.closeTime}
            disabled={disabled}
            onChange={(event) =>
              onChange(index, { closeTime: event.target.value })
            }
            className="w-[8.5rem]"
            aria-label="Closing time"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={disabled || day.periods.length === 1}
            onClick={() => onRemove(index)}
            aria-label="Remove period"
          >
            <Trash2 />
          </Button>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={onAdd}
        >
          <Plus />
          Add period
        </Button>
        <span className="text-muted-foreground text-xs">
          {formatDayHours(day, timeFormat)}
        </span>
      </div>
    </div>
  );
}
