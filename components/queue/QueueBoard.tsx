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
  Pause,
  Play,
  Plus,
  RefreshCw,
  Settings2,
  Users,
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
    let payload: {
      queueId: string;
      partySize: number;
      customerId?: string;
      name?: string;
      phone?: string | null;
      email?: string | null;
    };
    if (values.mode === "existing") {
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
        toast.error("Enter a valid name, phone, or email.");
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
    <div className="flex flex-wrap items-center gap-2">
      {queue ? <RealtimeStatusIndicator status={realtimeStatus} /> : null}
      {queue ? (
        <Button variant="outline" disabled={pending} onClick={() => refresh()}>
          <RefreshCw />
          Refresh
        </Button>
      ) : null}
      {canManage && queue ? (
        <Button
          onClick={() => setAddOpen(true)}
          disabled={pending || !accepting || !bundle.defaults.allowManualEntry}
        >
          <Plus />
          Add customer
        </Button>
      ) : null}
      {canManage && queue && waiting.length > 0 ? (
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() => run(handleCallNext)}
        >
          Call next
        </Button>
      ) : null}
      {canManage && queue?.status === "ACTIVE" ? (
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => setConfirm({ kind: "pause" })}
        >
          <Pause />
          Pause
        </Button>
      ) : null}
      {canManage && queue?.status === "PAUSED" ? (
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => run(() => handleStatus("ACTIVE"))}
        >
          <Play />
          Resume
        </Button>
      ) : null}
      {canManage && queue && queue.status !== "CLOSED" ? (
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => setConfirm({ kind: "close" })}
        >
          <Ban />
          Close
        </Button>
      ) : null}
      {canConfigure && queue ? (
        <Button
          variant="outline"
          onClick={() => setSettingsOpen(true)}
          disabled={pending}
        >
          <Settings2 />
          Queue settings
        </Button>
      ) : (
        <Button variant="outline" render={<Link href={SETTINGS_QUEUE_PATH} />}>
          <Settings2 />
          Queue settings
        </Button>
      )}
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Queue Management"
        description="Call, seat, and complete waiting guests for this branch."
        breadcrumbs={QUEUE_BREADCRUMBS}
        actions={headerActions}
      />

      {bundle.queues.length > 1 ? (
        <div className="mb-4 max-w-xs">
          <Select
            value={queue?.id ?? ""}
            onChange={(event) => handleQueueChange(event.target.value)}
            aria-label="Select queue"
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
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <StatusBadge
              label={queueStatusLabel(queue.status)}
              tone={queueStatusTone(queue.status)}
            />
            {realtimeStatus === "error" || realtimeStatus === "disconnected" ? (
              <p className="text-muted-foreground text-sm">
                {REALTIME_MESSAGES.staffUnavailable}
              </p>
            ) : null}
            {queue.status === "PAUSED" ? (
              <p className="text-sm text-amber-800 dark:text-amber-200">
                Queue is paused. Waiting guests stay in line, but new entries
                are not accepted.
              </p>
            ) : null}
            {queue.status === "CLOSED" ? (
              <p className="text-destructive text-sm">Queue is closed.</p>
            ) : null}
            {!bundle.defaults.queueEnabled ? (
              <p className="text-muted-foreground text-sm">
                Restaurant queue setting is disabled.
              </p>
            ) : null}
          </div>

          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard
              title="Waiting"
              value={bundle.stats.waiting}
              icon={<Users />}
            />
            <StatCard title="Called" value={bundle.stats.called} />
            <StatCard title="Seated" value={bundle.stats.seated} />
            <StatCard title="Completed" value={bundle.stats.completed} />
            <StatCard title="No-show" value={bundle.stats.noShow} />
          </div>

          <div className="mb-4 flex gap-2">
            <Button
              variant={view === "live" ? "default" : "outline"}
              onClick={() => setView("live")}
            >
              Live queue
            </Button>
            <Button
              variant={view === "history" ? "default" : "outline"}
              onClick={() => setView("history")}
            >
              History
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
              <section className="border-border bg-card mb-6 rounded-xl border p-4 sm:p-5">
                <h2 className="text-muted-foreground text-sm font-medium">
                  Currently serving
                </h2>
                {serving.length === 0 ? (
                  <p className="text-muted-foreground mt-3 text-sm">
                    No guest is currently being served.
                  </p>
                ) : (
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {serving.map((entry) => {
                      const elapsed = elapsedMinutesSince(
                        entry.called_at ?? entry.joined_at,
                        now,
                      );
                      const actions = queueActionsForStatus(entry.status);
                      return (
                        <div
                          key={entry.id}
                          className="border-border rounded-lg border p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-mono text-3xl font-semibold tracking-tight">
                                {entry.token}
                              </p>
                              <p className="text-sm font-medium">
                                {entry.customer?.name ?? "Guest"}
                              </p>
                            </div>
                            <StatusBadge
                              label={queueEntryStatusLabel(entry.status)}
                              tone={queueEntryStatusTone(entry.status)}
                            />
                          </div>
                          <p className="text-muted-foreground mt-2 text-sm">
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

              <section>
                <div className="mb-3 flex items-center justify-between gap-2">
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
                  <div className="grid gap-3 lg:grid-cols-2">
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
