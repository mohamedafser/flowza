"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  Ban,
  CheckCircle2,
  History,
  ListOrdered,
  Megaphone,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Settings2,
  UserX,
  Users,
  Utensils,
} from "lucide-react";
import {
  callNextQueueEntryAction,
  callQueueEntryAction,
  cancelQueueEntryAction,
  completeQueueEntryAction,
  getQueueBundleAction,
  markQueueEntryNoShowAction,
  seatQueueEntryAction,
  skipQueueEntryAction,
  updateQueueAction,
  updateQueueStatusAction,
} from "@/app/actions/queue";
import {
  addCustomerToQueueRequest,
  createQueueRequest,
} from "@/lib/api/queues-client";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { RealtimeStatusIndicator } from "@/components/common/RealtimeStatusIndicator";
import { StatCard } from "@/components/common/StatCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { AddCustomerToQueueDialog } from "@/components/queue/AddCustomerToQueueDialog";
import { QueueEntryCard } from "@/components/queue/QueueEntryCard";
import { QueueEntryDetails } from "@/components/queue/QueueEntryDetails";
import { QueueFormDialog } from "@/components/queue/QueueFormDialog";
import { QueueHistory } from "@/components/queue/QueueHistory";
import { SeatCustomerDialog } from "@/components/queue/SeatCustomerDialog";
import { DASHBOARD_QUEUE_PATH, SETTINGS_QUEUE_PATH } from "@/lib/auth/paths";
import { QUEUE_BREADCRUMBS } from "@/lib/navigation/breadcrumbs";
import { queueActionsForStatus } from "@/lib/queue/transitions";
import { createCoalescedRefresh } from "@/lib/realtime/refresh";
import { REALTIME_MESSAGES } from "@/lib/realtime/messages";
import { REALTIME_REFRESH_DEBOUNCE_MS } from "@/lib/realtime/types";
import { PUBLIC_QUEUE_FALLBACK_INTERVAL_MS } from "@/lib/public-queue/paths";
import { useQueueRealtime } from "@/hooks/realtime/use-queue-realtime";
import { formatTime } from "@/lib/utils/datetime";
import {
  currentlyServingEntries,
  elapsedMinutesSince,
  formatWaitMinutes,
  queueEntryStatusLabel,
  queueEntryStatusTone,
  queueStatusLabel,
  queueStatusTone,
  queueTableLabel,
  sortWaitingEntries,
} from "@/lib/utils/queue";
import type {
  AddCustomerFormValues,
  AddCustomerToQueueInput,
  QueueFormValues,
} from "@/lib/validations/queue";
import { toCustomerWritePayload } from "@/lib/validations/customer";
import type { QueueBundle, QueueEntryView } from "@/services/queues";

type QueueBoardProps = {
  bundle: QueueBundle;
  canManage: boolean;
  canConfigure: boolean;
};

type ConfirmKind = "skip" | "cancel" | "noShow" | "pause" | "close" | null;

export function QueueBoard({
  bundle: initialBundle,
  canManage,
  canConfigure,
}: QueueBoardProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [bundle, setBundle] = useState(initialBundle);
  const bundleRef = useRef(bundle);
  const [view, setView] = useState<"live" | "history">("live");
  const [addOpen, setAddOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [seatEntry, setSeatEntry] = useState<QueueEntryView | null>(null);
  const [details, setDetails] = useState<QueueEntryView | null>(null);
  const [confirm, setConfirm] = useState<{
    kind: ConfirmKind;
    entry?: QueueEntryView;
  }>({ kind: null });
  const refreshController = useRef<ReturnType<
    typeof createCoalescedRefresh
  > | null>(null);

  useEffect(() => {
    bundleRef.current = bundle;
  });

  const loadBundle = useCallback(async () => {
    const current = bundleRef.current;
    const result = await getQueueBundleAction({
      branchId: current.branch.id,
      queueId: current.queue?.id ?? null,
    });
    if (result.ok && result.data) {
      setBundle(result.data);
    }
  }, []);

  useEffect(() => {
    const controller = createCoalescedRefresh(
      loadBundle,
      REALTIME_REFRESH_DEBOUNCE_MS,
    );
    refreshController.current = controller;
    return () => {
      controller.cancel();
      if (refreshController.current === controller) {
        refreshController.current = null;
      }
    };
  }, [loadBundle]);

  const queue = bundle.queue;
  const { status: realtimeStatus } = useQueueRealtime({
    restaurantId: bundle.branch.restaurant_id,
    queueId: queue?.id ?? null,
    branchId: bundle.branch.id,
    enabled: Boolean(queue?.id),
    onChange: () => {
      refreshController.current?.request();
    },
  });

  useEffect(() => {
    if (!queue?.id || realtimeStatus === "connected") return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const loop = () => {
      timer = setTimeout(() => {
        if (cancelled) return;
        if (document.visibilityState === "visible") {
          refreshController.current?.request();
        }
        if (!cancelled) loop();
      }, PUBLIC_QUEUE_FALLBACK_INTERVAL_MS);
    };

    loop();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [queue?.id, realtimeStatus]);

  const waiting = useMemo(
    () => sortWaitingEntries(bundle.entries),
    [bundle.entries],
  );
  const serving = useMemo(
    () => currentlyServingEntries(bundle.entries),
    [bundle.entries],
  );
  const activeDetails = details
    ? (bundle.entries.find((entry) => entry.id === details.id) ?? details)
    : null;
  const activeSeatEntry = seatEntry
    ? (bundle.entries.find((entry) => entry.id === seatEntry.id) ?? seatEntry)
    : null;
  const accepting = queue?.status === "ACTIVE" && bundle.defaults.queueEnabled;
  const now = new Date();

  function run(task: () => Promise<void>) {
    if (pending) return;
    startTransition(() => {
      void task();
    });
  }

  function refresh() {
    refreshController.current?.request();
  }

  function handleQueueChange(queueId: string) {
    router.push(`${DASHBOARD_QUEUE_PATH}?queueId=${queueId}`);
  }

  async function handleCreate(values: QueueFormValues) {
    const result = await createQueueRequest({
      ...values,
      branchId: bundle.branch.id,
    });
    if (!result.ok) {
      toast.error(result.message ?? "Unable to create queue.");
      return;
    }
    toast.success("Queue created.");
    setCreateOpen(false);
    if (result.data?.queue.id) {
      router.push(`${DASHBOARD_QUEUE_PATH}?queueId=${result.data.queue.id}`);
    } else {
      refresh();
    }
  }

  async function handleUpdate(values: QueueFormValues) {
    if (!queue) return;
    const result = await updateQueueAction({
      ...values,
      queueId: queue.id,
    });
    if (!result.ok) {
      toast.error(result.message ?? "Unable to update queue.");
      return;
    }
    toast.success("Queue settings saved.");
    setSettingsOpen(false);
    refresh();
  }

  async function handleStatus(status: "ACTIVE" | "PAUSED" | "CLOSED") {
    if (!queue) return;
    const result = await updateQueueStatusAction({
      queueId: queue.id,
      status,
    });
    if (!result.ok) {
      toast.error(result.message ?? "Unable to update queue status.");
      return;
    }
    toast.success(`Queue ${queueStatusLabel(status).toLowerCase()}.`);
    setConfirm({ kind: null });
    refresh();
  }

  async function handleAdd(values: AddCustomerFormValues) {
    if (!queue) return;
    let payload: AddCustomerToQueueInput;
    if (values.customerId) {
      payload = {
        queueId: queue.id,
        partySize: values.partySize,
        customerId: values.customerId,
      };
    } else {
      try {
        payload = {
          queueId: queue.id,
          partySize: values.partySize,
          ...toCustomerWritePayload({
            name: values.name,
            phone: values.phone,
            email: values.email,
          }),
        };
      } catch {
        toast.error("Enter a valid name and phone number.");
        return;
      }
    }
    const result = await addCustomerToQueueRequest(payload);
    if (!result.ok) {
      toast.error(result.message ?? "Unable to add customer.");
      return;
    }
    toast.success(`Added ${result.data?.entry.token ?? "guest"} to the queue.`);
    setAddOpen(false);
    refresh();
  }

  async function handleCallNext() {
    if (!queue) return;
    const result = await callNextQueueEntryAction({ queueId: queue.id });
    if (!result.ok) {
      toast.error(result.message ?? "Unable to call next.");
      return;
    }
    toast.success(`Called ${result.data?.entry.token ?? "next guest"}.`);
    refresh();
  }

  async function handleCall(entry: QueueEntryView) {
    const result = await callQueueEntryAction({ entryId: entry.id });
    if (!result.ok) {
      toast.error(result.message ?? "Unable to call this customer.");
      return;
    }
    toast.success(`Called ${entry.token}.`);
    setDetails(null);
    refresh();
  }

  async function handleSkip(entry: QueueEntryView) {
    const result = await skipQueueEntryAction({ entryId: entry.id });
    if (!result.ok) {
      toast.error(result.message ?? "Unable to skip this customer.");
      return;
    }
    toast.success(`Skipped ${entry.token}.`);
    setConfirm({ kind: null });
    setDetails(null);
    refresh();
  }

  async function handleCancel(entry: QueueEntryView) {
    const result = await cancelQueueEntryAction({ entryId: entry.id });
    if (!result.ok) {
      toast.error(result.message ?? "Unable to cancel this customer.");
      return;
    }
    toast.success(`Cancelled ${entry.token}.`);
    setConfirm({ kind: null });
    setDetails(null);
    refresh();
  }

  async function handleNoShow(entry: QueueEntryView) {
    const result = await markQueueEntryNoShowAction({ entryId: entry.id });
    if (!result.ok) {
      toast.error(result.message ?? "Unable to mark no-show.");
      return;
    }
    toast.success(`Marked ${entry.token} as no-show.`);
    setConfirm({ kind: null });
    setDetails(null);
    refresh();
  }

  async function handleSeat(tableId: string) {
    if (!activeSeatEntry) return;
    const result = await seatQueueEntryAction({
      entryId: activeSeatEntry.id,
      tableId,
    });
    if (!result.ok) {
      toast.error(result.message ?? "Unable to seat this customer.");
      return;
    }
    toast.success(`Seated ${activeSeatEntry.token}.`);
    setBundle((current) => ({
      ...current,
      tables: current.tables.map((table) =>
        table.id === tableId ? { ...table, status: "OCCUPIED" } : table,
      ),
    }));
    setSeatEntry(null);
    setDetails(null);
    refresh();
  }

  async function handleComplete(entry: QueueEntryView) {
    const result = await completeQueueEntryAction({ entryId: entry.id });
    if (!result.ok) {
      toast.error(result.message ?? "Unable to complete this visit.");
      return;
    }
    toast.success(`Completed ${entry.token}.`);
    if (entry.table_id) {
      const freedTableId = entry.table_id;
      setBundle((current) => ({
        ...current,
        tables: current.tables.map((table) =>
          table.id === freedTableId ? { ...table, status: "AVAILABLE" } : table,
        ),
      }));
    }
    setDetails(null);
    refresh();
  }

  const headerActions = (
    <div className="flex w-full flex-col gap-2 sm:w-auto">
      {queue ? (
        <div className="flex flex-wrap items-center gap-2">
          <RealtimeStatusIndicator
            status={realtimeStatus}
            className="mr-auto sm:mr-0"
          />
          <Button
            variant="outline"
            size="icon-sm"
            className="sm:hidden"
            disabled={pending}
            onClick={() => refresh()}
            aria-label="Refresh queue"
          >
            <RefreshCw />
          </Button>
          <Button
            variant="outline"
            className="hidden sm:inline-flex"
            disabled={pending}
            onClick={() => refresh()}
          >
            <RefreshCw />
            Refresh
          </Button>
          {canConfigure ? (
            <>
              <Button
                variant="outline"
                size="icon-sm"
                className="sm:hidden"
                onClick={() => setSettingsOpen(true)}
                disabled={pending}
                aria-label="Queue settings"
              >
                <Settings2 />
              </Button>
              <Button
                variant="outline"
                className="hidden sm:inline-flex"
                onClick={() => setSettingsOpen(true)}
                disabled={pending}
              >
                <Settings2 />
                Queue settings
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="icon-sm"
                className="sm:hidden"
                render={<Link href={SETTINGS_QUEUE_PATH} />}
                aria-label="Queue settings"
              >
                <Settings2 />
              </Button>
              <Button
                variant="outline"
                className="hidden sm:inline-flex"
                render={<Link href={SETTINGS_QUEUE_PATH} />}
              >
                <Settings2 />
                Queue settings
              </Button>
            </>
          )}
        </div>
      ) : null}

      {canManage && queue ? (
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <Button
            className="col-span-2 sm:col-auto"
            onClick={() => setAddOpen(true)}
            disabled={
              pending || !accepting || !bundle.defaults.allowManualEntry
            }
          >
            <Plus />
            Add customer
          </Button>
          {waiting.length > 0 ? (
            <Button
              variant="secondary"
              className="col-span-2 sm:col-auto"
              disabled={pending}
              onClick={() => run(handleCallNext)}
            >
              <Megaphone />
              Call next
            </Button>
          ) : null}
          {queue.status === "ACTIVE" ? (
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => setConfirm({ kind: "pause" })}
            >
              <Pause />
              Pause
            </Button>
          ) : null}
          {queue.status === "PAUSED" ? (
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => run(() => handleStatus("ACTIVE"))}
            >
              <Play />
              Resume
            </Button>
          ) : null}
          {queue.status !== "CLOSED" ? (
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => setConfirm({ kind: "close" })}
            >
              <Ban />
              Close
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="min-w-0">
      <PageHeader
        title="Queue Management"
        description="Call, seat, and complete waiting guests for this branch."
        breadcrumbs={QUEUE_BREADCRUMBS}
        actions={headerActions}
      />

      {bundle.queues.length > 1 ? (
        <div className="mb-4 w-full max-w-md">
          <Select
            value={queue?.id ?? ""}
            onChange={(event) => handleQueueChange(event.target.value)}
            aria-label="Select queue"
            className="w-full"
          >
            {bundle.queues.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
                {item.status !== "ACTIVE"
                  ? ` (${queueStatusLabel(item.status)})`
                  : ""}
              </option>
            ))}
          </Select>
        </div>
      ) : null}

      {!queue ? (
        <EmptyState
          title="No queue for this branch"
          description="Create a queue to start taking walk-ins and managing tokens."
          action={
            canConfigure ? (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus />
                Create queue
              </Button>
            ) : null
          }
        />
      ) : (
        <>
          <div className="mb-4 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge
                label={queueStatusLabel(queue.status)}
                tone={queueStatusTone(queue.status)}
              />
            </div>
            {realtimeStatus === "error" || realtimeStatus === "disconnected" ? (
              <p className="text-muted-foreground text-sm text-pretty">
                {REALTIME_MESSAGES.staffUnavailable}
              </p>
            ) : null}
            {queue.status === "PAUSED" ? (
              <p className="text-sm text-pretty text-amber-800 dark:text-amber-200">
                Queue is paused. Waiting guests stay in line, but new entries
                are not accepted.
              </p>
            ) : null}
            {queue.status === "CLOSED" ? (
              <p className="text-destructive text-sm">Queue is closed.</p>
            ) : null}
            {!bundle.defaults.queueEnabled ? (
              <p className="text-muted-foreground text-sm text-pretty">
                Restaurant queue setting is disabled.
              </p>
            ) : null}
          </div>

          <div className="mb-6 grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 lg:grid-cols-5">
            <StatCard
              title="Waiting"
              value={bundle.stats.waiting}
              icon={<Users />}
            />
            <StatCard
              title="Called"
              value={bundle.stats.called}
              icon={<ListOrdered />}
            />
            <StatCard
              title="Seated"
              value={bundle.stats.seated}
              icon={<Utensils />}
            />
            <StatCard
              title="Completed"
              value={bundle.stats.completed}
              icon={<CheckCircle2 />}
            />
            <StatCard
              title="No-show"
              value={bundle.stats.noShow}
              icon={<UserX />}
              className="col-span-2 md:col-span-1 lg:col-span-1"
            />
          </div>

          <div className="border-border mb-4 flex rounded-lg border p-0.5">
            <Button
              variant={view === "live" ? "secondary" : "ghost"}
              className="min-w-0 flex-1"
              aria-pressed={view === "live"}
              onClick={() => setView("live")}
            >
              <ListOrdered />
              <span className="truncate">Live queue</span>
            </Button>
            <Button
              variant={view === "history" ? "secondary" : "ghost"}
              className="min-w-0 flex-1"
              aria-pressed={view === "history"}
              onClick={() => setView("history")}
            >
              <History />
              <span className="truncate">History</span>
            </Button>
          </div>

          {view === "history" ? (
            <QueueHistory
              entries={bundle.entries}
              timezone={bundle.timezone}
              dateFormat={bundle.dateFormat}
              timeFormat={bundle.timeFormat}
              onSelect={setDetails}
            />
          ) : (
            <>
              <section className="border-border bg-card mb-6 rounded-xl border p-3 sm:p-5">
                <h2 className="text-muted-foreground text-sm font-medium">
                  Currently serving
                </h2>
                {serving.length === 0 ? (
                  <p className="text-muted-foreground mt-3 text-sm">
                    No guest is currently being served.
                  </p>
                ) : (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {serving.map((entry) => {
                      const elapsed = elapsedMinutesSince(
                        entry.called_at ?? entry.joined_at,
                        now,
                      );
                      const actions = queueActionsForStatus(entry.status);
                      return (
                        <div
                          key={entry.id}
                          className="border-border min-w-0 rounded-lg border p-3 sm:p-4"
                        >
                          <div className="flex items-start justify-between gap-2 sm:gap-3">
                            <div className="min-w-0">
                              <p className="font-mono text-2xl font-semibold tracking-tight sm:text-3xl">
                                {entry.token}
                              </p>
                              <p className="truncate text-sm font-medium">
                                {entry.customer?.name ?? "Guest"}
                              </p>
                            </div>
                            <StatusBadge
                              label={queueEntryStatusLabel(entry.status)}
                              tone={queueEntryStatusTone(entry.status)}
                            />
                          </div>
                          <p className="text-muted-foreground mt-2 text-sm text-pretty">
                            Party {entry.party_size}
                            {entry.table
                              ? ` · ${queueTableLabel(entry.table)}`
                              : ""}
                            {elapsed !== null
                              ? ` · ${formatWaitMinutes(elapsed)} elapsed`
                              : ""}
                          </p>
                          {canManage ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {actions.canSeat ? (
                                <Button
                                  size="sm"
                                  disabled={pending}
                                  onClick={() => setSeatEntry(entry)}
                                >
                                  <Utensils />
                                  Seat
                                </Button>
                              ) : null}
                              {actions.canComplete ? (
                                <Button
                                  size="sm"
                                  disabled={pending}
                                  onClick={() =>
                                    run(() => handleComplete(entry))
                                  }
                                >
                                  <CheckCircle2 />
                                  Complete
                                </Button>
                              ) : null}
                              {actions.canNoShow ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={pending}
                                  onClick={() =>
                                    setConfirm({ kind: "noShow", entry })
                                  }
                                >
                                  <UserX />
                                  No show
                                </Button>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="min-w-0">
                <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                  <h2 className="text-lg font-medium">Waiting queue</h2>
                  <p className="text-muted-foreground text-xs">
                    Ordered by join time ·{" "}
                    {formatTime(now, bundle.timeFormat, bundle.timezone)}
                  </p>
                </div>
                {waiting.length === 0 ? (
                  <EmptyState
                    title="No customers are currently waiting."
                    description={
                      accepting
                        ? "Add a walk-in when the next guest arrives."
                        : "Resume or open the queue to accept new guests."
                    }
                  />
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {waiting.map((entry) => (
                      <QueueEntryCard
                        key={entry.id}
                        entry={entry}
                        timezone={bundle.timezone}
                        timeFormat={bundle.timeFormat}
                        canManage={canManage}
                        pending={pending}
                        onOpen={() => setDetails(entry)}
                        onCall={() => run(() => handleCall(entry))}
                        onSkip={() => setConfirm({ kind: "skip", entry })}
                        onCancel={() => setConfirm({ kind: "cancel", entry })}
                        onSeat={() => setSeatEntry(entry)}
                        onNoShow={() => setConfirm({ kind: "noShow", entry })}
                        onComplete={() => run(() => handleComplete(entry))}
                      />
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </>
      )}

      <AddCustomerToQueueDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSubmit={handleAdd}
      />
      <QueueFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        defaults={bundle.defaults}
        pending={pending}
        onSubmit={(values) => run(() => handleCreate(values))}
      />
      <QueueFormDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        mode="edit"
        queue={queue}
        defaults={bundle.defaults}
        pending={pending}
        onSubmit={(values) => run(() => handleUpdate(values))}
      />
      <SeatCustomerDialog
        open={Boolean(activeSeatEntry)}
        onOpenChange={(open) => {
          if (!open) setSeatEntry(null);
        }}
        entry={activeSeatEntry}
        tables={bundle.tables}
        pending={pending}
        onSeat={(tableId) => run(() => handleSeat(tableId))}
      />
      <QueueEntryDetails
        entry={activeDetails}
        open={Boolean(activeDetails)}
        onOpenChange={(open) => {
          if (!open) setDetails(null);
        }}
        timezone={bundle.timezone}
        dateFormat={bundle.dateFormat}
        timeFormat={bundle.timeFormat}
        canManage={canManage}
        pending={pending}
        onCall={() => activeDetails && run(() => handleCall(activeDetails))}
        onSkip={() =>
          activeDetails && setConfirm({ kind: "skip", entry: activeDetails })
        }
        onCancel={() =>
          activeDetails && setConfirm({ kind: "cancel", entry: activeDetails })
        }
        onSeat={() => activeDetails && setSeatEntry(activeDetails)}
        onNoShow={() =>
          activeDetails && setConfirm({ kind: "noShow", entry: activeDetails })
        }
        onComplete={() =>
          activeDetails && run(() => handleComplete(activeDetails))
        }
      />
      <ConfirmDialog
        open={confirm.kind !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm({ kind: null });
        }}
        title={
          confirm.kind === "pause"
            ? "Pause this queue?"
            : confirm.kind === "close"
              ? "Close this queue?"
              : confirm.kind === "skip"
                ? `Skip ${confirm.entry?.token ?? "this guest"}?`
                : confirm.kind === "cancel"
                  ? `Cancel ${confirm.entry?.token ?? "this guest"}?`
                  : `Mark ${confirm.entry?.token ?? "this guest"} as no-show?`
        }
        description={
          confirm.kind === "pause"
            ? "Waiting guests stay in line. New customers cannot be added until you resume."
            : confirm.kind === "close"
              ? "The queue will stop accepting new entries. Existing guests are not deleted."
              : "This guest stays in history and is not removed from the restaurant."
        }
        confirmLabel={
          confirm.kind === "pause"
            ? "Pause queue"
            : confirm.kind === "close"
              ? "Close queue"
              : confirm.kind === "skip"
                ? "Skip"
                : confirm.kind === "cancel"
                  ? "Cancel guest"
                  : "Mark no-show"
        }
        destructive={
          confirm.kind === "close" ||
          confirm.kind === "cancel" ||
          confirm.kind === "noShow"
        }
        loading={pending}
        onConfirm={() => {
          if (confirm.kind === "pause") {
            run(() => handleStatus("PAUSED"));
            return;
          }
          if (confirm.kind === "close") {
            run(() => handleStatus("CLOSED"));
            return;
          }
          if (!confirm.entry) return;
          if (confirm.kind === "skip") {
            run(() => handleSkip(confirm.entry!));
            return;
          }
          if (confirm.kind === "cancel") {
            run(() => handleCancel(confirm.entry!));
            return;
          }
          if (confirm.kind === "noShow") {
            run(() => handleNoShow(confirm.entry!));
          }
        }}
      />
    </div>
  );
}
