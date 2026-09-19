"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarCheck,
  CalendarClock,
  CalendarPlus,
  CalendarRange,
  Check,
  CheckCheck,
  History,
  LayoutGrid,
  ListOrdered,
  Pencil,
  RefreshCw,
  UserRound,
  UserX,
  Utensils,
  Users,
  X,
} from "lucide-react";
import {
  assignReservationTableRequest,
  cancelReservationRequest,
  completeReservationRequest,
  confirmReservationRequest,
  convertReservationToQueueRequest,
  createReservationRequest,
  createWalkInRequest,
  getReservationsBundleRequest,
  markReservationArrivedRequest,
  markReservationNoShowRequest,
  seatReservationRequest,
  updateReservationRequest,
} from "@/lib/api/reservations-client";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { SearchInput } from "@/components/common/SearchInput";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ReservationFormDialog } from "@/components/reservations/ReservationFormDialog";
import { WalkInDialog } from "@/components/reservations/WalkInDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useReservationRealtime } from "@/hooks/realtime/use-reservation-realtime";
import { createCoalescedRefresh } from "@/lib/realtime/refresh";
import { reservationActionsForStatus } from "@/lib/reservations/transitions";
import {
  formatReservationTime,
  reservationStatusLabel,
  reservationStatusTone,
  type ReservationWithRelations,
} from "@/lib/utils/reservations";
import type {
  ReservationFormValues,
  ReservationStatus,
  ReservationView,
  WalkInFormValues,
} from "@/lib/validations/reservation";
import {
  RESERVATION_STATUSES,
  RESERVATION_STATUS_LABELS,
} from "@/lib/validations/reservation";
import type { ReservationBundle } from "@/services/reservations";

type ReservationBoardProps = {
  initialBundle: ReservationBundle;
  restaurantId: string;
};

type PendingAction =
  | { type: "cancel"; reservation: ReservationWithRelations }
  | { type: "no_show"; reservation: ReservationWithRelations }
  | null;

export function ReservationBoard({
  initialBundle,
  restaurantId,
}: ReservationBoardProps) {
  const router = useRouter();
  const [bundle, setBundle] = useState(initialBundle);
  const [view, setView] = useState<ReservationView>(initialBundle.view);
  const [statusFilter, setStatusFilter] = useState<ReservationStatus | "all">(
    "all",
  );
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState(
    initialBundle.view === "today" ? initialBundle.businessDate : "",
  );
  const [pending, startTransition] = useTransition();
  const [formOpen, setFormOpen] = useState(false);
  const [editReservation, setEditReservation] =
    useState<ReservationWithRelations | null>(null);
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [tableDialog, setTableDialog] = useState<{
    reservation: ReservationWithRelations;
    mode: "assign" | "seat";
  } | null>(null);
  const [queueDialog, setQueueDialog] =
    useState<ReservationWithRelations | null>(null);
  const [selectedTableId, setSelectedTableId] = useState("");
  const [selectedQueueId, setSelectedQueueId] = useState("");
  const [confirmAction, setConfirmAction] = useState<PendingAction>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    startTransition(async () => {
      const result = await getReservationsBundleRequest({
        branchId: bundle.branch.id,
        view,
        date: dateFilter || undefined,
        status: statusFilter === "all" ? undefined : statusFilter,
        search: search || undefined,
        page: 1,
      });
      if (result.ok && result.data) {
        setBundle(result.data);
      }
      router.refresh();
    });
  }, [bundle.branch.id, view, dateFilter, statusFilter, search, router]);

  const coalesced = useMemo(
    () => createCoalescedRefresh(() => refresh()),
    [refresh],
  );

  useEffect(() => () => coalesced.cancel(), [coalesced]);

  useReservationRealtime({
    restaurantId,
    branchId: bundle.branch.id,
    onChange: () => coalesced.request(),
  });

  const tablesForSelect = useMemo(() => {
    return bundle.tables.map((table) => ({
      id: table.id,
      capacity: table.capacity,
      status: table.status,
      label: table.name
        ? `${table.tableNumber} (${table.name})`
        : table.tableNumber,
    }));
  }, [bundle.tables]);

  const runMutation = async (
    action: () => Promise<{ ok: boolean; message?: string }>,
    successMessage: string,
  ) => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await action();
      if (!result.ok) {
        toast.error(result.message ?? "Something went wrong.");
        return;
      }
      toast.success(successMessage);
      refresh();
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = async (values: ReservationFormValues) => {
    await runMutation(async () => {
      const result = await createReservationRequest({
        branchId: bundle.branch.id,
        customerId: values.customerId,
        reservationDate: values.reservationDate,
        startTime: values.startTime,
        partySize: values.partySize,
        durationMinutes: values.durationMinutes,
        tableId: values.tableId ? values.tableId : null,
        notes: values.notes?.trim() ? values.notes : null,
        specialRequests: values.specialRequests?.trim()
          ? values.specialRequests
          : null,
        confirm: values.confirm ?? false,
      });
      if (!result.ok) return result;
      setFormOpen(false);
      return result;
    }, "Reservation created");
  };

  const handleEdit = async (values: ReservationFormValues) => {
    if (!editReservation) return;
    await runMutation(async () => {
      const result = await updateReservationRequest({
        reservationId: editReservation.id,
        reservationDate: values.reservationDate,
        startTime: values.startTime,
        partySize: values.partySize,
        durationMinutes: values.durationMinutes,
        tableId: values.tableId ? values.tableId : null,
        notes: values.notes?.trim() ? values.notes : null,
        specialRequests: values.specialRequests?.trim()
          ? values.specialRequests
          : null,
      });
      if (!result.ok) return result;
      setEditReservation(null);
      return result;
    }, "Reservation updated");
  };

  const handleWalkIn = async (values: WalkInFormValues) => {
    await runMutation(async () => {
      const result = await createWalkInRequest({
        branchId: bundle.branch.id,
        mode: values.mode,
        queueId: values.queueId || undefined,
        tableId: values.tableId || undefined,
        customerId: values.customerId || undefined,
        name: values.name || undefined,
        phone: values.phone || undefined,
        email: values.email || undefined,
        partySize: values.partySize,
        notes: values.notes?.trim() ? values.notes : null,
      });
      if (!result.ok) return result;
      setWalkInOpen(false);
      return result;
    }, values.mode === "queue" ? "Walk-in added to queue" : "Walk-in seated");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {(["today", "upcoming", "past"] as const).map((item) => (
            <Button
              key={item}
              size="sm"
              variant={view === item ? "default" : "outline"}
              onClick={() => {
                setView(item);
                startTransition(async () => {
                  const result = await getReservationsBundleRequest({
                    branchId: bundle.branch.id,
                    view: item,
                    page: 1,
                  });
                  if (result.ok && result.data) {
                    setBundle(result.data);
                    setDateFilter(
                      item === "today" ? result.data.businessDate : "",
                    );
                  }
                });
              }}
            >
              {item === "today" ? (
                <CalendarCheck />
              ) : item === "upcoming" ? (
                <CalendarClock />
              ) : (
                <History />
              )}
              {item === "today"
                ? "Today"
                : item === "upcoming"
                  ? "Upcoming"
                  : "Past"}
            </Button>
          ))}
        </div>

        {bundle.canManage ? (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setWalkInOpen(true)}
            >
              <UserRound />
              Walk-in
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setEditReservation(null);
                setFormOpen(true);
              }}
            >
              <CalendarPlus />
              New reservation
            </Button>
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1">
          <Label>Search</Label>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Name, phone, or code"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="dateFilter">Date</Label>
          <Input
            id="dateFilter"
            type="date"
            value={dateFilter}
            onChange={(event) => setDateFilter(event.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="statusFilter">Status</Label>
          <Select
            id="statusFilter"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value === "all"
                  ? "all"
                  : (event.target.value as ReservationStatus),
              )
            }
          >
            <option value="all">All statuses</option>
            {RESERVATION_STATUSES.map((status) => (
              <option key={status} value={status}>
                {RESERVATION_STATUS_LABELS[status]}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex items-end">
          <Button
            variant="outline"
            className="w-full"
            onClick={refresh}
            disabled={pending}
          >
            <RefreshCw className={pending ? "animate-spin" : undefined} />
            Apply filters
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Confirmed"
          value={bundle.stats.confirmed}
          icon={<Check className="size-4" />}
        />
        <StatCard
          label="Arrived"
          value={bundle.stats.arrived}
          icon={<Users className="size-4" />}
        />
        <StatCard
          label="Seated"
          value={bundle.stats.seated}
          icon={<Utensils className="size-4" />}
        />
        <StatCard
          label="Pending"
          value={bundle.stats.pending}
          icon={<CalendarRange className="size-4" />}
        />
      </div>

      {bundle.reservations.length === 0 ? (
        <EmptyState
          title="No reservations"
          description={
            view === "today"
              ? "No reservations for this date yet."
              : "No reservations match these filters."
          }
        />
      ) : (
        <div className="space-y-3">
          {/* Desktop table */}
          <div className="border-border hidden overflow-x-auto rounded-lg border md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Time</th>
                  <th className="px-3 py-2 font-medium">Customer</th>
                  <th className="px-3 py-2 font-medium">Party</th>
                  <th className="px-3 py-2 font-medium">Table</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Code</th>
                  <th className="px-3 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {bundle.reservations.map((reservation) => (
                  <tr key={reservation.id} className="border-t">
                    <td className="px-3 py-2 whitespace-nowrap">
                      {reservation.reservation_date !== bundle.businessDate
                        ? `${reservation.reservation_date} `
                        : ""}
                      {formatReservationTime(reservation.start_time)}
                    </td>
                    <td className="px-3 py-2">
                      {reservation.customer?.name ?? "Guest"}
                    </td>
                    <td className="px-3 py-2">{reservation.party_size}</td>
                    <td className="px-3 py-2">
                      {reservation.table
                        ? reservation.table.name
                          ? `${reservation.table.table_number} (${reservation.table.name})`
                          : reservation.table.table_number
                        : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge
                        label={reservationStatusLabel(reservation.status)}
                        tone={reservationStatusTone(reservation.status)}
                      />
                    </td>
                    <td className="text-muted-foreground px-3 py-2 font-mono text-xs">
                      {reservation.reservation_code ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      <ReservationActions
                        reservation={reservation}
                        canManage={bundle.canManage}
                        busy={busy}
                        onConfirm={() =>
                          void runMutation(
                            () =>
                              confirmReservationRequest(reservation.id),
                            "Reservation confirmed",
                          )
                        }
                        onArrive={() =>
                          void runMutation(
                            () =>
                              markReservationArrivedRequest(reservation.id),
                            "Guest checked in",
                          )
                        }
                        onComplete={() =>
                          void runMutation(
                            () =>
                              completeReservationRequest(reservation.id),
                            "Reservation completed",
                          )
                        }
                        onEdit={() => setEditReservation(reservation)}
                        onAssign={() => {
                          setSelectedTableId(reservation.table_id ?? "");
                          setTableDialog({ reservation, mode: "assign" });
                        }}
                        onSeat={() => {
                          setSelectedTableId(reservation.table_id ?? "");
                          setTableDialog({ reservation, mode: "seat" });
                        }}
                        onQueue={() => {
                          setSelectedQueueId(bundle.queues[0]?.id ?? "");
                          setQueueDialog(reservation);
                        }}
                        onCancel={() =>
                          setConfirmAction({ type: "cancel", reservation })
                        }
                        onNoShow={() =>
                          setConfirmAction({ type: "no_show", reservation })
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {bundle.reservations.map((reservation) => (
              <article
                key={reservation.id}
                className="border-border space-y-3 rounded-lg border p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {reservation.customer?.name ?? "Guest"}
                    </p>
                    <p className="text-muted-foreground text-sm">
                      {formatReservationTime(reservation.start_time)} · party{" "}
                      {reservation.party_size}
                    </p>
                  </div>
                  <StatusBadge
                    label={reservationStatusLabel(reservation.status)}
                    tone={reservationStatusTone(reservation.status)}
                  />
                </div>
                <p className="text-muted-foreground text-xs font-mono">
                  {reservation.reservation_code ?? "—"}
                </p>
                <ReservationActions
                  reservation={reservation}
                  canManage={bundle.canManage}
                  busy={busy}
                  compact
                  onConfirm={() =>
                    void runMutation(
                      () =>
                        confirmReservationRequest(reservation.id),
                      "Reservation confirmed",
                    )
                  }
                  onArrive={() =>
                    void runMutation(
                      () =>
                        markReservationArrivedRequest(reservation.id),
                      "Guest checked in",
                    )
                  }
                  onComplete={() =>
                    void runMutation(
                      () =>
                        completeReservationRequest(reservation.id),
                      "Reservation completed",
                    )
                  }
                  onEdit={() => setEditReservation(reservation)}
                  onAssign={() => {
                    setSelectedTableId(reservation.table_id ?? "");
                    setTableDialog({ reservation, mode: "assign" });
                  }}
                  onSeat={() => {
                    setSelectedTableId(reservation.table_id ?? "");
                    setTableDialog({ reservation, mode: "seat" });
                  }}
                  onQueue={() => {
                    setSelectedQueueId(bundle.queues[0]?.id ?? "");
                    setQueueDialog(reservation);
                  }}
                  onCancel={() =>
                    setConfirmAction({ type: "cancel", reservation })
                  }
                  onNoShow={() =>
                    setConfirmAction({ type: "no_show", reservation })
                  }
                />
              </article>
            ))}
          </div>
        </div>
      )}

      <ReservationFormDialog
        open={formOpen || Boolean(editReservation)}
        onOpenChange={(open) => {
          if (!open) {
            setFormOpen(false);
            setEditReservation(null);
          }
        }}
        mode={editReservation ? "edit" : "create"}
        reservation={editReservation}
        tables={tablesForSelect}
        defaultDate={bundle.businessDate}
        onSubmit={editReservation ? handleEdit : handleCreate}
      />

      <WalkInDialog
        open={walkInOpen}
        onOpenChange={setWalkInOpen}
        queues={bundle.queues}
        tables={tablesForSelect}
        onSubmit={handleWalkIn}
      />

      <Dialog
        open={Boolean(tableDialog)}
        onOpenChange={(open) => {
          if (!open) setTableDialog(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {tableDialog?.mode === "seat" ? "Seat guest" : "Assign table"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="tableSelect">Table</Label>
            <Select
              id="tableSelect"
              value={selectedTableId}
              onChange={(event) => setSelectedTableId(event.target.value)}
              placeholder="Select a table"
            >
              <option value="">Select a table</option>
              {tablesForSelect.map((table) => (
                <option key={table.id} value={table.id}>
                  {table.label} · seats {table.capacity} · {table.status}
                </option>
              ))}
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTableDialog(null)}>
              Cancel
            </Button>
            <Button
              disabled={!selectedTableId || busy}
              onClick={() => {
                if (!tableDialog || !selectedTableId) return;
                if (tableDialog.mode === "seat") {
                  void runMutation(
                    () =>
                      seatReservationRequest({
                        reservationId: tableDialog.reservation.id,
                        tableId: selectedTableId,
                      }),
                    "Guest seated",
                  ).then(() => setTableDialog(null));
                } else {
                  void runMutation(
                    () =>
                      assignReservationTableRequest({
                        reservationId: tableDialog.reservation.id,
                        tableId: selectedTableId,
                      }),
                    "Table assigned",
                  ).then(() => setTableDialog(null));
                }
              }}
            >
              {tableDialog?.mode === "seat" ? "Seat" : "Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(queueDialog)}
        onOpenChange={(open) => {
          if (!open) setQueueDialog(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to queue</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="queueSelect">Queue</Label>
            <Select
              id="queueSelect"
              value={selectedQueueId}
              onChange={(event) => setSelectedQueueId(event.target.value)}
            >
              {bundle.queues.map((queue) => (
                <option key={queue.id} value={queue.id}>
                  {queue.name}
                </option>
              ))}
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQueueDialog(null)}>
              Cancel
            </Button>
            <Button
              disabled={!selectedQueueId || busy}
              onClick={() => {
                if (!queueDialog || !selectedQueueId) return;
                void runMutation(
                  () =>
                    convertReservationToQueueRequest({
                      reservationId: queueDialog.id,
                      queueId: selectedQueueId,
                    }),
                  "Added to queue",
                ).then(() => setQueueDialog(null));
              }}
            >
              Add to queue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(confirmAction)}
        onOpenChange={(open) => {
          if (!open) setConfirmAction(null);
        }}
        title={
          confirmAction?.type === "no_show"
            ? "Mark as no-show?"
            : "Cancel reservation?"
        }
        description={
          confirmAction?.type === "no_show"
            ? "This preserves history and releases any reserved table."
            : "This preserves history and cannot be undone from the dashboard."
        }
        confirmLabel={
          confirmAction?.type === "no_show" ? "Mark no-show" : "Cancel reservation"
        }
        destructive
        loading={busy}
        onConfirm={() => {
          if (!confirmAction) return;
          if (confirmAction.type === "no_show") {
            void runMutation(
              () =>
                markReservationNoShowRequest(confirmAction.reservation.id),
              "Marked as no-show",
            ).then(() => setConfirmAction(null));
          } else {
            void runMutation(
              () =>
                cancelReservationRequest({
                  reservationId: confirmAction.reservation.id,
                }),
              "Reservation cancelled",
            ).then(() => setConfirmAction(null));
          }
        }}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="border-border rounded-lg border px-3 py-3">
      <div className="text-muted-foreground flex items-center gap-2 text-xs">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function ReservationActions({
  reservation,
  canManage,
  busy,
  compact,
  onConfirm,
  onArrive,
  onComplete,
  onEdit,
  onAssign,
  onSeat,
  onQueue,
  onCancel,
  onNoShow,
}: {
  reservation: ReservationWithRelations;
  canManage: boolean;
  busy: boolean;
  compact?: boolean;
  onConfirm: () => void;
  onArrive: () => void;
  onComplete: () => void;
  onEdit: () => void;
  onAssign: () => void;
  onSeat: () => void;
  onQueue: () => void;
  onCancel: () => void;
  onNoShow: () => void;
}) {
  if (!canManage) return null;
  const actions = reservationActionsForStatus(reservation.status);
  const size = compact ? "sm" : "sm";

  return (
    <div className="flex flex-wrap gap-1.5">
      {actions.canConfirm ? (
        <Button size={size} variant="outline" disabled={busy} onClick={onConfirm}>
          <Check />
          Confirm
        </Button>
      ) : null}
      {actions.canArrive ? (
        <Button size={size} disabled={busy} onClick={onArrive}>
          <UserRound />
          Arrived
        </Button>
      ) : null}
      {actions.canSeat ? (
        <Button size={size} disabled={busy} onClick={onSeat}>
          <Utensils />
          Seat
        </Button>
      ) : null}
      {actions.canAssignTable ? (
        <Button size={size} variant="outline" disabled={busy} onClick={onAssign}>
          <LayoutGrid />
          Table
        </Button>
      ) : null}
      {actions.canConvertToQueue ? (
        <Button size={size} variant="outline" disabled={busy} onClick={onQueue}>
          <ListOrdered />
          Queue
        </Button>
      ) : null}
      {actions.canComplete ? (
        <Button size={size} disabled={busy} onClick={onComplete}>
          <CheckCheck />
          Complete
        </Button>
      ) : null}
      {actions.canEdit ? (
        <Button size={size} variant="outline" disabled={busy} onClick={onEdit}>
          <Pencil />
          Edit
        </Button>
      ) : null}
      {actions.canNoShow ? (
        <Button
          size={size}
          variant="outline"
          disabled={busy}
          onClick={onNoShow}
        >
          <UserX />
          No-show
        </Button>
      ) : null}
      {actions.canCancel ? (
        <Button
          size={size}
          variant="ghost"
          disabled={busy}
          onClick={onCancel}
        >
          <X />
          <span className="sr-only">Cancel</span>
        </Button>
      ) : null}
    </div>
  );
}
