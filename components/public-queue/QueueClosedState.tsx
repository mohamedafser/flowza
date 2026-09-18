import type { PublicQueueAvailabilityReason } from "@/lib/public-queue/types";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { Clock3, PauseCircle, ShieldX, Users } from "lucide-react";

type QueueClosedStateProps = {
  reason: PublicQueueAvailabilityReason;
  message: string;
};

export function QueueClosedState({ reason, message }: QueueClosedStateProps) {
  if (reason === "unavailable") {
    return (
      <ErrorState
        title="Queue not found"
        message={message}
        className="border-dashed"
      />
    );
  }

  const icon =
    reason === "paused" ? (
      <PauseCircle className="size-8" />
    ) : reason === "full" ? (
      <Users className="size-8" />
    ) : reason === "outside_hours" ? (
      <Clock3 className="size-8" />
    ) : (
      <ShieldX className="size-8" />
    );

  const title =
    reason === "paused"
      ? "Queue paused"
      : reason === "full"
        ? "Queue is full"
        : reason === "outside_hours"
          ? "Currently closed"
          : "Queue closed";

  return <EmptyState title={title} description={message} icon={icon} />;
}
