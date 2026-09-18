import { cn } from "@/lib/utils";
import type { PublicQueueInfo } from "@/lib/public-queue/types";
import { formatWaitMinutes } from "@/lib/utils/queue";
import { StatusBadge } from "@/components/common/StatusBadge";
import { queueStatusTone } from "@/lib/utils/queue";

type QueueAvailabilityCardProps = {
  info: PublicQueueInfo;
  className?: string;
};

export function QueueAvailabilityCard({
  info,
  className,
}: QueueAvailabilityCardProps) {
  const tone = info.availability.canJoin
    ? "success"
    : info.availability.reason === "paused"
      ? "warning"
      : "danger";

  return (
    <section
      className={cn(
        "border-border bg-card rounded-2xl border p-4 shadow-sm",
        className,
      )}
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-medium">
            {info.queue?.name ?? "Queue"}
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {info.availability.message}
          </p>
        </div>
        {info.queue ? (
          <StatusBadge
            label={info.queue.status === "ACTIVE" ? "Open" : info.queue.status}
            tone={queueStatusTone(info.queue.status)}
          />
        ) : (
          <StatusBadge label="Unavailable" tone={tone} />
        )}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-muted-foreground">Waiting</dt>
          <dd className="text-lg font-semibold">{info.waitingCount}</dd>
        </div>
        {info.settings.showEstimatedWait ? (
          <div>
            <dt className="text-muted-foreground">Estimated wait</dt>
            <dd className="text-lg font-semibold">
              {info.estimatedWaitMinutes == null
                ? "Unavailable"
                : formatWaitMinutes(info.estimatedWaitMinutes)}
            </dd>
          </div>
        ) : null}
        {info.nowServingToken ? (
          <div className="col-span-2">
            <dt className="text-muted-foreground">Now serving</dt>
            <dd className="font-mono text-lg font-semibold tracking-wide">
              {info.nowServingToken}
            </dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}
